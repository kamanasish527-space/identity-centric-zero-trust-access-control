import random
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_csrf_token,
    get_password_hash,
    verify_password,
)
from app.models.step_up import StepUpChallenge
from app.models.user import User, UserRole
from app.services.anomaly_engine import (
    evaluate_behavior_anomaly,
    record_anomaly_event,
    resolve_combined_risk,
)
from app.services.audit_service import log_event
from app.services.baseline_service import create_or_update_baseline
from app.services.policy_engine import PolicyDecision, decide_policy
from app.services.risk_engine import BehaviorContext, evaluate_risk
from app.services.session_service import create_session, get_active_session_for_user, terminate_session
from app.services.settings_service import get_app_settings


class AuthServiceError(Exception):
    def __init__(self, message: str, code: str = "auth_error") -> None:
        super().__init__(message)
        self.code = code


class AuthService:
    @staticmethod
    def _normalize_lock_until(lock_until: datetime | None) -> datetime | None:
        if lock_until is None:
            return None
        if lock_until.tzinfo is None:
            return lock_until.replace(tzinfo=timezone.utc)
        return lock_until.astimezone(timezone.utc)

    @staticmethod
    def register_user(db: Session, username: str, email: str, password: str) -> User:
        existing = db.scalar(select(User).where(or_(User.username == username, User.email == email)))
        if existing:
            raise AuthServiceError("Username or email already exists", code="duplicate_identity")

        user = User(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            role=UserRole.VIEWER,
            is_active=True,
            is_locked=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        log_event(
            db,
            user_id=user.id,
            actor_role=user.role.value,
            event_type="AUTH_REGISTER",
            action="register_user",
            message="User registered",
            decision="allow",
            commit=True,
        )
        return user

    @staticmethod
    def _issue_tokens(user: User, session_id: str) -> dict[str, Any]:
        csrf_token = generate_csrf_token()
        access_token = create_access_token(
            {
                "sub": str(user.id),
                "role": user.role.value,
                "session_id": session_id,
                "csrf": csrf_token,
                "type": "access",
            }
        )
        refresh_token = create_refresh_token(
            {
                "sub": str(user.id),
                "role": user.role.value,
                "session_id": session_id,
                "type": "refresh",
            }
        )
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "csrf_token": csrf_token,
            "expires_in": settings.access_token_expire_minutes * 60,
            "refresh_expires_in": settings.refresh_token_expire_minutes * 60,
        }

    @staticmethod
    def _lock_user_if_needed(db: Session, user: User, ip_address: str, device_fingerprint: str) -> None:
        if user.role == UserRole.ADMIN:
            return
        if user.failed_login_attempts < settings.max_failed_logins:
            return

        user.is_locked = True
        user.lock_until = datetime.now(tz=timezone.utc) + timedelta(minutes=settings.account_lock_minutes)
        user.failed_login_attempts = 0
        db.commit()

        log_event(
            db,
            user_id=user.id,
            actor_role=user.role.value,
            event_type="AUTH_LOCK",
            action="lock_account",
            message="Account locked after repeated failed logins",
            risk_level="high",
            decision="lock",
            ip_address=ip_address,
            device_id=device_fingerprint,
        )

    @staticmethod
    def authenticate(
        db: Session,
        *,
        identifier: str,
        password: str,
        ip_address: str,
        device_fingerprint: str,
        location: str,
        protocol: str,
        simulated_phishing: bool,
    ) -> dict[str, Any]:
        user = db.scalar(select(User).where(or_(User.username == identifier, User.email == identifier)))
        now = datetime.now(tz=timezone.utc)

        if not user:
            log_event(
                db,
                user_id=None,
                actor_role=None,
                event_type="AUTH_FAILURE",
                action="login",
                message="Unknown identity login attempt",
                risk_level="medium",
                decision="deny",
                ip_address=ip_address,
                device_id=device_fingerprint,
            )
            raise AuthServiceError("Invalid credentials", code="invalid_credentials")

        if user.is_locked:
            lock_until = AuthService._normalize_lock_until(user.lock_until)
            if user.role == UserRole.ADMIN:
                user.is_locked = False
                user.lock_until = None
                user.failed_login_attempts = 0
                db.commit()
            elif lock_until and lock_until > now:
                raise AuthServiceError("Account locked. Try later.", code="account_locked")
            else:
                user.is_locked = False
                user.lock_until = None
                user.failed_login_attempts = 0
                db.commit()

        if not verify_password(password, user.hashed_password):
            user.failed_login_attempts += 1
            db.commit()
            AuthService._lock_user_if_needed(db, user, ip_address, device_fingerprint)

            log_event(
                db,
                user_id=user.id,
                actor_role=user.role.value,
                event_type="AUTH_FAILURE",
                action="login",
                message="Invalid password",
                risk_level="medium",
                decision="deny",
                ip_address=ip_address,
                device_id=device_fingerprint,
                details={"failed_attempts": user.failed_login_attempts},
            )
            raise AuthServiceError("Invalid credentials", code="invalid_credentials")

        failed_attempts_snapshot = user.failed_login_attempts
        user.failed_login_attempts = 0

        app_settings = get_app_settings(db)
        context = BehaviorContext(
            login_time=now,
            ip_address=ip_address,
            device_fingerprint=device_fingerprint,
            location=location,
            protocol=protocol,
            access_frequency_24h=len(user.sessions) + 1,
            failed_login_attempts=failed_attempts_snapshot,
            simulated_phishing=simulated_phishing,
        )
        evaluation = evaluate_risk(user.baseline, context, app_settings, app_settings.mitre_mapping_enabled)
        anomaly_evaluation = evaluate_behavior_anomaly(
            db,
            user=user,
            context=context,
            session_obj=None,
            event_source="login",
        )
        combined_risk_score, combined_risk_level = resolve_combined_risk(
            base_risk_score=evaluation.score,
            anomaly_evaluation=anomaly_evaluation,
            app_settings=app_settings,
        )
        decision = decide_policy(evaluation.level)
        admin_override = False
        original_decision = decision
        if user.role == UserRole.ADMIN and decision != PolicyDecision.ALLOW:
            decision = PolicyDecision.ALLOW
            admin_override = True

        mitre_first = evaluation.mitre_matches[0] if evaluation.mitre_matches else None

        if decision == PolicyDecision.ALLOW:
            user.last_login_at = now
            session_obj = create_session(
                db,
                user=user,
                context=context,
                risk_score=combined_risk_score,
                risk_level=combined_risk_level,
                commit=False,
            )
            record_anomaly_event(
                db,
                user_id=user.id,
                session_id=session_obj.id,
                context=context,
                event_source="login",
                total_risk_score=combined_risk_score,
                risk_level=combined_risk_level,
                anomaly_evaluation=anomaly_evaluation,
                commit=False,
            )
            create_or_update_baseline(db, user, context)
            db.commit()
            db.refresh(session_obj)
            db.refresh(user)

            tokens = AuthService._issue_tokens(user, session_obj.id)
            log_event(
                db,
                user_id=user.id,
                actor_role=user.role.value,
                event_type="AUTH_SUCCESS",
                action="login",
                message="Login allowed (admin override)" if admin_override else "Login allowed",
                risk_score=combined_risk_score,
                risk_level=combined_risk_level,
                decision="allow",
                mitre_technique_id=mitre_first["technique_id"] if mitre_first else None,
                mitre_technique_name=mitre_first["technique_name"] if mitre_first else None,
                mitre_tactic=mitre_first["tactic"] if mitre_first else None,
                ip_address=ip_address,
                device_id=device_fingerprint,
                details={
                    "anomalies": evaluation.anomalies,
                    "mitre": evaluation.mitre_matches,
                    "anomaly_score": anomaly_evaluation.anomaly_score,
                    "anomaly_factors": anomaly_evaluation.factors.api(),
                    "admin_override": admin_override,
                    "original_decision": original_decision.value,
                },
            )

            if anomaly_evaluation.alert_triggered:
                log_event(
                    db,
                    user_id=user.id,
                    actor_role=user.role.value,
                    event_type="ANOMALY_ALERT",
                    action="login_anomaly_alert",
                    message="Behavioral anomaly score exceeded threshold",
                    risk_score=combined_risk_score,
                    risk_level=combined_risk_level,
                    decision="alert",
                    ip_address=ip_address,
                    device_id=device_fingerprint,
                    details={"anomaly_score": anomaly_evaluation.anomaly_score},
                )

            return {
                "status": "success",
                "message": "Login successful",
                "decision": "allow",
                "risk_score": combined_risk_score,
                "risk_level": combined_risk_level,
                "session_id": session_obj.id,
                **tokens,
            }

        if decision == PolicyDecision.STEP_UP:
            challenge = StepUpChallenge(
                id=str(uuid4()),
                user_id=user.id,
                challenge_code=f"{random.randint(100000, 999999)}",
                expires_at=now + timedelta(minutes=5),
                is_used=False,
            )
            db.add(challenge)
            record_anomaly_event(
                db,
                user_id=user.id,
                session_id=None,
                context=context,
                event_source="login_step_up",
                total_risk_score=combined_risk_score,
                risk_level=combined_risk_level,
                anomaly_evaluation=anomaly_evaluation,
                commit=False,
            )
            db.commit()

            log_event(
                db,
                user_id=user.id,
                actor_role=user.role.value,
                event_type="AUTH_STEP_UP_REQUIRED",
                action="login_step_up",
                message="Step-up authentication required",
                risk_score=combined_risk_score,
                risk_level=combined_risk_level,
                decision="step_up",
                mitre_technique_id=mitre_first["technique_id"] if mitre_first else None,
                mitre_technique_name=mitre_first["technique_name"] if mitre_first else None,
                mitre_tactic=mitre_first["tactic"] if mitre_first else None,
                ip_address=ip_address,
                device_id=device_fingerprint,
                details={
                    "anomalies": evaluation.anomalies,
                    "anomaly_score": anomaly_evaluation.anomaly_score,
                    "anomaly_factors": anomaly_evaluation.factors.api(),
                },
            )

            if anomaly_evaluation.alert_triggered:
                log_event(
                    db,
                    user_id=user.id,
                    actor_role=user.role.value,
                    event_type="ANOMALY_ALERT",
                    action="login_step_up_anomaly_alert",
                    message="Behavioral anomaly score exceeded threshold",
                    risk_score=combined_risk_score,
                    risk_level=combined_risk_level,
                    decision="alert",
                    ip_address=ip_address,
                    device_id=device_fingerprint,
                    details={"anomaly_score": anomaly_evaluation.anomaly_score},
                )

            return {
                "status": "step_up_required",
                "message": "Risk is medium. Complete OTP verification.",
                "decision": "step_up",
                "risk_score": combined_risk_score,
                "risk_level": combined_risk_level,
                "challenge_id": challenge.id,
                "otp_hint": challenge.challenge_code,
            }

        if decision == PolicyDecision.DENY:
            record_anomaly_event(
                db,
                user_id=user.id,
                session_id=None,
                context=context,
                event_source="login_deny",
                total_risk_score=combined_risk_score,
                risk_level=combined_risk_level,
                anomaly_evaluation=anomaly_evaluation,
                commit=False,
            )
            log_event(
                db,
                user_id=user.id,
                actor_role=user.role.value,
                event_type="AUTH_DENY",
                action="login_deny",
                message="Login denied due to high risk",
                risk_score=combined_risk_score,
                risk_level=combined_risk_level,
                decision="deny",
                mitre_technique_id=mitre_first["technique_id"] if mitre_first else None,
                mitre_technique_name=mitre_first["technique_name"] if mitre_first else None,
                mitre_tactic=mitre_first["tactic"] if mitre_first else None,
                ip_address=ip_address,
                device_id=device_fingerprint,
                details={
                    "anomalies": evaluation.anomalies,
                    "anomaly_score": anomaly_evaluation.anomaly_score,
                    "anomaly_factors": anomaly_evaluation.factors.api(),
                },
            )
            if anomaly_evaluation.alert_triggered:
                log_event(
                    db,
                    user_id=user.id,
                    actor_role=user.role.value,
                    event_type="ANOMALY_ALERT",
                    action="login_deny_anomaly_alert",
                    message="Behavioral anomaly score exceeded threshold",
                    risk_score=combined_risk_score,
                    risk_level=combined_risk_level,
                    decision="alert",
                    ip_address=ip_address,
                    device_id=device_fingerprint,
                    details={"anomaly_score": anomaly_evaluation.anomaly_score},
                )
            raise AuthServiceError("Login denied due to high risk", code="risk_denied")

        user.is_locked = True
        user.lock_until = now + timedelta(minutes=settings.account_lock_minutes)
        record_anomaly_event(
            db,
            user_id=user.id,
            session_id=None,
            context=context,
            event_source="login_critical_lock",
            total_risk_score=combined_risk_score,
            risk_level=combined_risk_level,
            anomaly_evaluation=anomaly_evaluation,
            commit=False,
        )
        db.commit()

        log_event(
            db,
            user_id=user.id,
            actor_role=user.role.value,
            event_type="AUTH_CRITICAL_LOCK",
            action="lock_and_alert",
            message="Critical risk detected. Account locked and alert generated",
            risk_score=combined_risk_score,
            risk_level=combined_risk_level,
            decision="lock_and_alert",
            mitre_technique_id=mitre_first["technique_id"] if mitre_first else None,
            mitre_technique_name=mitre_first["technique_name"] if mitre_first else None,
            mitre_tactic=mitre_first["tactic"] if mitre_first else None,
            ip_address=ip_address,
            device_id=device_fingerprint,
            details={
                "anomalies": evaluation.anomalies,
                "anomaly_score": anomaly_evaluation.anomaly_score,
                "anomaly_factors": anomaly_evaluation.factors.api(),
            },
        )
        if anomaly_evaluation.alert_triggered:
            log_event(
                db,
                user_id=user.id,
                actor_role=user.role.value,
                event_type="ANOMALY_ALERT",
                action="login_critical_anomaly_alert",
                message="Behavioral anomaly score exceeded threshold",
                risk_score=combined_risk_score,
                risk_level=combined_risk_level,
                decision="alert",
                ip_address=ip_address,
                device_id=device_fingerprint,
                details={"anomaly_score": anomaly_evaluation.anomaly_score},
            )
        raise AuthServiceError("Account locked due to critical risk", code="critical_lock")

    @staticmethod
    def verify_step_up(
        db: Session,
        *,
        challenge_id: str,
        otp_code: str,
        ip_address: str,
        device_fingerprint: str,
        location: str,
        protocol: str,
    ) -> dict[str, Any]:
        challenge = db.get(StepUpChallenge, challenge_id)
        now = datetime.now(tz=timezone.utc)

        if not challenge or challenge.is_used or challenge.expires_at < now:
            raise AuthServiceError("Invalid or expired challenge", code="invalid_challenge")

        user = db.get(User, challenge.user_id)
        if not user:
            raise AuthServiceError("User not found", code="user_not_found")

        if challenge.challenge_code != otp_code:
            log_event(
                db,
                user_id=user.id,
                actor_role=user.role.value,
                event_type="AUTH_STEP_UP_FAILURE",
                action="verify_step_up",
                message="Invalid step-up OTP",
                risk_level="medium",
                decision="deny",
                ip_address=ip_address,
                device_id=device_fingerprint,
            )
            raise AuthServiceError("Invalid OTP", code="invalid_otp")

        challenge.is_used = True
        context = BehaviorContext(
            login_time=now,
            ip_address=ip_address,
            device_fingerprint=device_fingerprint,
            location=location,
            protocol=protocol,
            access_frequency_24h=len(user.sessions) + 1,
            failed_login_attempts=user.failed_login_attempts,
            simulated_phishing=False,
        )
        app_settings = get_app_settings(db)
        anomaly_evaluation = evaluate_behavior_anomaly(
            db,
            user=user,
            context=context,
            session_obj=None,
            event_source="step_up",
        )
        combined_risk_score, combined_risk_level = resolve_combined_risk(
            base_risk_score=50.0,
            anomaly_evaluation=anomaly_evaluation,
            app_settings=app_settings,
        )

        session_obj = create_session(
            db,
            user=user,
            context=context,
            risk_score=combined_risk_score,
            risk_level=combined_risk_level,
            commit=False,
        )
        record_anomaly_event(
            db,
            user_id=user.id,
            session_id=session_obj.id,
            context=context,
            event_source="step_up",
            total_risk_score=combined_risk_score,
            risk_level=combined_risk_level,
            anomaly_evaluation=anomaly_evaluation,
            commit=False,
        )
        create_or_update_baseline(db, user, context)

        user.last_login_at = now
        user.failed_login_attempts = 0

        db.commit()
        db.refresh(session_obj)

        tokens = AuthService._issue_tokens(user, session_obj.id)
        log_event(
            db,
            user_id=user.id,
            actor_role=user.role.value,
            event_type="AUTH_STEP_UP_SUCCESS",
            action="verify_step_up",
            message="Step-up authentication successful",
            risk_score=combined_risk_score,
            risk_level=combined_risk_level,
            decision="allow",
            ip_address=ip_address,
            device_id=device_fingerprint,
            details={
                "anomaly_score": anomaly_evaluation.anomaly_score,
                "anomaly_factors": anomaly_evaluation.factors.api(),
            },
        )
        if anomaly_evaluation.alert_triggered:
            log_event(
                db,
                user_id=user.id,
                actor_role=user.role.value,
                event_type="ANOMALY_ALERT",
                action="step_up_anomaly_alert",
                message="Behavioral anomaly score exceeded threshold",
                risk_score=combined_risk_score,
                risk_level=combined_risk_level,
                decision="alert",
                ip_address=ip_address,
                device_id=device_fingerprint,
                details={"anomaly_score": anomaly_evaluation.anomaly_score},
            )

        return {
            "status": "success",
            "message": "Step-up verification successful",
            "decision": "allow",
            "risk_score": combined_risk_score,
            "risk_level": combined_risk_level,
            "session_id": session_obj.id,
            **tokens,
        }

    @staticmethod
    def refresh_tokens(db: Session, refresh_token: str) -> dict[str, Any]:
        try:
            payload = decode_token(refresh_token, settings.refresh_secret_key)
        except TokenError as exc:
            raise AuthServiceError("Invalid refresh token", code="invalid_refresh_token") from exc

        if payload.get("type") != "refresh":
            raise AuthServiceError("Invalid refresh token type", code="invalid_refresh_token")

        user_id = payload.get("sub")
        session_id = payload.get("session_id")
        if not user_id or not session_id:
            raise AuthServiceError("Malformed refresh token", code="invalid_refresh_token")

        user = db.get(User, int(user_id))
        if not user or not user.is_active:
            raise AuthServiceError("Inactive user", code="inactive_user")

        session_obj = get_active_session_for_user(db, user.id, session_id)
        if not session_obj:
            raise AuthServiceError("Session inactive", code="session_inactive")

        tokens = AuthService._issue_tokens(user, session_obj.id)
        log_event(
            db,
            user_id=user.id,
            actor_role=user.role.value,
            event_type="AUTH_REFRESH",
            action="refresh_token",
            message="Token refresh successful",
            decision="allow",
            ip_address=session_obj.ip_address,
            device_id=session_obj.device_fingerprint,
        )
        return tokens

    @staticmethod
    def logout(db: Session, user: User, session_id: str) -> None:
        session_obj = get_active_session_for_user(db, user.id, session_id)
        if session_obj:
            terminate_session(db, session_obj, "User logout", commit=True)

        log_event(
            db,
            user_id=user.id,
            actor_role=user.role.value,
            event_type="AUTH_LOGOUT",
            action="logout",
            message="User logged out",
            decision="allow",
            ip_address=session_obj.ip_address if session_obj else None,
            device_id=session_obj.device_fingerprint if session_obj else None,
        )
