from __future__ import annotations

import copy
import threading
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import delete, or_, select

from app.db.session import SessionLocal
from app.models.anomaly_event import BehaviorAnomalyEvent
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.user_session import AccessSession
from app.services.anomaly_engine import (
    evaluate_behavior_anomaly,
    record_anomaly_event,
    resolve_combined_risk,
)
from app.services.audit_service import log_event
from app.services.risk_engine import BehaviorContext
from app.services.settings_service import get_app_settings


@dataclass(frozen=True)
class SimulationStepDefinition:
    id: int
    name: str
    risk_increment: float
    anomaly_increment: float
    detection_confidence: float
    mitre_technique_id: str
    mitre_technique_name: str
    mitre_tactic: str
    step_message: str
    step_decision: str


@dataclass(frozen=True)
class SimulationRunContext:
    user_id: int | None
    actor_role: str | None
    session_id: str | None
    ip_address: str
    device_id: str


STEP_DEFINITIONS: tuple[SimulationStepDefinition, ...] = (
    SimulationStepDefinition(
        id=1,
        name="Suspicious Login",
        risk_increment=30.0,
        anomaly_increment=20.0,
        detection_confidence=40.0,
        mitre_technique_id="T1078",
        mitre_technique_name="Valid Accounts",
        mitre_tactic="Persistence",
        step_message="Suspicious Login detected",
        step_decision="monitor",
    ),
    SimulationStepDefinition(
        id=2,
        name="Brute Force Attempts",
        risk_increment=35.0,
        anomaly_increment=30.0,
        detection_confidence=70.0,
        mitre_technique_id="T1110",
        mitre_technique_name="Brute Force",
        mitre_tactic="Credential Access",
        step_message="Brute Force Attempts detected",
        step_decision="monitor",
    ),
    SimulationStepDefinition(
        id=3,
        name="Privilege Escalation Attempt",
        risk_increment=25.0,
        anomaly_increment=40.0,
        detection_confidence=95.0,
        mitre_technique_id="TA0004",
        mitre_technique_name="Privilege Escalation",
        mitre_tactic="Privilege Escalation",
        step_message="Privilege Escalation blocked",
        step_decision="deny",
    ),
)


def _utc_now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _clamp_score(value: float) -> float:
    return float(max(0.0, min(100.0, round(value, 2))))


def _risk_level(score: float) -> str:
    if score >= 90:
        return "critical"
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


class AttackSimulationEngine:
    """In-memory global simulation engine with 3-second sequential steps."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self._worker: threading.Thread | None = None
        self._generation = 0
        self._run_context: SimulationRunContext | None = None
        self._state = self._build_initial_state()

    def _build_initial_state(self) -> dict:
        state = {
            "running": False,
            "step": 0,
            "riskScore": 0.0,
            "anomalyScore": 0.0,
            "detectionConfidence": 0.0,
            "attackBlocked": False,
            "sessionTerminated": False,
            "finalOutcome": None,
            "timeline": [
                {"id": step.id, "name": step.name, "status": "pending"}
                for step in STEP_DEFINITIONS
            ],
            "lastUpdated": _utc_now(),
        }
        state["isRunning"] = state["running"]
        state["currentStep"] = state["step"]
        return state

    def _set_running_locked(self, running: bool) -> None:
        self._state["running"] = bool(running)
        self._state["isRunning"] = bool(running)

    def _set_step_locked(self, step: int) -> None:
        safe_step = int(max(0, step))
        self._state["step"] = safe_step
        self._state["currentStep"] = safe_step

    def _all_steps_completed_locked(self) -> bool:
        return all(item["status"] == "completed" for item in self._state["timeline"])

    def _next_pending_step_index_locked(self) -> int | None:
        for idx, item in enumerate(self._state["timeline"]):
            if item["status"] != "completed":
                return idx
        return None

    def _snapshot_locked(self) -> dict:
        snapshot = copy.deepcopy(self._state)
        snapshot["lastUpdated"] = self._state["lastUpdated"]
        return snapshot

    def get_status(self) -> dict:
        with self._lock:
            return self._snapshot_locked()

    def start(self, *, user: User | None, session_id: str | None) -> dict:
        with self._lock:
            if self._state["running"]:
                return self._snapshot_locked()

            if self._state["sessionTerminated"] or self._all_steps_completed_locked():
                self._state = self._build_initial_state()

            self._generation += 1
            generation = self._generation
            self._stop_event.clear()

            self._run_context = SimulationRunContext(
                user_id=user.id if user else None,
                actor_role=user.role.value if user and user.role else None,
                session_id=session_id,
                ip_address="203.0.113.77",
                device_id="sim-device-attack-lab",
            )

            self._set_running_locked(True)
            self._state["attackBlocked"] = False
            self._state["finalOutcome"] = "Running"
            self._state["lastUpdated"] = _utc_now()

            self._worker = threading.Thread(
                target=self._run_steps,
                kwargs={"generation": generation},
                daemon=True,
                name="attack-simulation-engine",
            )
            self._worker.start()
            return self._snapshot_locked()

    def stop(self) -> dict:
        with self._lock:
            self._generation += 1
            self._set_running_locked(False)
            if not self._state["sessionTerminated"]:
                self._state["finalOutcome"] = "Stopped"
            self._state["lastUpdated"] = _utc_now()
            self._stop_event.set()
            return self._snapshot_locked()

    def reset(self) -> dict:
        with self._lock:
            self._generation += 1
            self._stop_event.set()
            reset_context = self._run_context
            self._run_context = None
            self._state = self._build_initial_state()
            snapshot = self._snapshot_locked()

        self._cleanup_simulation_artifacts(context=reset_context)
        return snapshot

    def _build_behavior_context(
        self,
        *,
        step: SimulationStepDefinition,
        run_context: SimulationRunContext,
        user: User,
    ) -> BehaviorContext:
        now = _utc_now()
        login_time = now
        failed_attempts = 0

        if step.id == 1:
            login_time = now.replace(hour=0, minute=12, second=0, microsecond=0)
            failed_attempts = 1
        elif step.id == 2:
            login_time = now.replace(hour=1, minute=25, second=0, microsecond=0)
            failed_attempts = 5
        elif step.id == 3:
            login_time = now.replace(hour=3, minute=40, second=0, microsecond=0)
            failed_attempts = 2

        return BehaviorContext(
            login_time=login_time,
            ip_address=run_context.ip_address,
            device_fingerprint=run_context.device_id,
            location="RU-MOW-MOSCOW",
            protocol="https",
            access_frequency_24h=max(1, len(user.sessions) + (step.id * 3)),
            failed_login_attempts=failed_attempts,
            simulated_phishing=False,
        )

    def _apply_ml_scoring(
        self,
        *,
        step: SimulationStepDefinition,
        base_risk: float,
        run_context: SimulationRunContext | None,
    ) -> tuple[float, float] | None:
        if run_context is None or run_context.user_id is None:
            return None

        try:
            with SessionLocal() as db:
                user = db.scalar(select(User).where(User.id == run_context.user_id).limit(1))
                if not user:
                    return None

                session_obj = None
                if run_context.session_id:
                    session_obj = db.scalar(
                        select(AccessSession)
                        .where(
                            AccessSession.id == run_context.session_id,
                            AccessSession.user_id == run_context.user_id,
                        )
                        .limit(1)
                    )

                app_settings = get_app_settings(db)
                behavior_context = self._build_behavior_context(
                    step=step,
                    run_context=run_context,
                    user=user,
                )

                anomaly_eval = evaluate_behavior_anomaly(
                    db,
                    user=user,
                    context=behavior_context,
                    session_obj=session_obj,
                    event_source="simulation_engine",
                )

                total_risk, risk_level = resolve_combined_risk(
                    base_risk_score=base_risk,
                    anomaly_evaluation=anomaly_eval,
                    app_settings=app_settings,
                )

                if session_obj:
                    session_obj.current_risk_score = max(float(session_obj.current_risk_score or 0.0), total_risk)
                    session_obj.current_risk_level = risk_level

                record_anomaly_event(
                    db,
                    user_id=user.id,
                    session_id=session_obj.id if session_obj else None,
                    context=behavior_context,
                    event_source="simulation_engine",
                    total_risk_score=total_risk,
                    risk_level=risk_level,
                    anomaly_evaluation=anomaly_eval,
                    commit=False,
                )

                db.commit()

            return anomaly_eval.anomaly_score, total_risk
        except Exception:
            return None

    def _run_steps(self, *, generation: int) -> None:
        while True:
            if self._stop_event.wait(timeout=3.0):
                return

            with self._lock:
                if generation != self._generation or not self._state["running"]:
                    return

                step_idx = self._next_pending_step_index_locked()
                if step_idx is None:
                    self._set_running_locked(False)
                    if not self._state["finalOutcome"] or self._state["finalOutcome"] == "Running":
                        self._state["finalOutcome"] = "Simulation Completed"
                    self._state["lastUpdated"] = _utc_now()
                    return

                step = STEP_DEFINITIONS[step_idx]
                for idx, item in enumerate(self._state["timeline"]):
                    if idx < step_idx:
                        item["status"] = "completed"
                    elif idx == step_idx:
                        item["status"] = "active"
                    elif item["status"] != "completed":
                        item["status"] = "pending"

                self._set_step_locked(step.id)
                self._state["riskScore"] = _clamp_score(self._state["riskScore"] + step.risk_increment)
                self._state["anomalyScore"] = _clamp_score(self._state["anomalyScore"] + step.anomaly_increment)
                self._state["detectionConfidence"] = _clamp_score(step.detection_confidence)
                self._state["lastUpdated"] = _utc_now()
                base_risk = float(self._state["riskScore"])
                run_context = self._run_context
                step_for_ml = step

            ml_result = self._apply_ml_scoring(
                step=step_for_ml,
                base_risk=base_risk,
                run_context=run_context,
            )
            if ml_result:
                ml_anomaly, ml_risk = ml_result
                with self._lock:
                    if generation != self._generation or not self._state["running"]:
                        return
                    self._state["anomalyScore"] = _clamp_score(max(self._state["anomalyScore"], ml_anomaly))
                    self._state["riskScore"] = _clamp_score(max(self._state["riskScore"], ml_risk))
                    self._state["lastUpdated"] = _utc_now()

            with self._lock:
                if generation != self._generation:
                    return

                timeline_step = self._state["timeline"][step_idx]
                if timeline_step["status"] == "active":
                    timeline_step["status"] = "completed"

                risk_score = float(self._state["riskScore"])
                self._state["lastUpdated"] = _utc_now()

                if risk_score >= 85:
                    self._set_running_locked(False)
                    self._state["attackBlocked"] = True
                    self._state["sessionTerminated"] = True
                    self._state["finalOutcome"] = "Access Blocked"
                    block_context = self._run_context
                elif self._next_pending_step_index_locked() is None:
                    self._set_running_locked(False)
                    self._state["finalOutcome"] = "Simulation Completed"
                    block_context = None
                else:
                    block_context = None

                completed_snapshot = self._snapshot_locked()
                completed_context = self._run_context

            self._record_step_log(step=step, snapshot=completed_snapshot, context=completed_context)

            if block_context is not None:
                self._mark_access_blocked(context=block_context, risk_score=risk_score)
                return

    def _record_step_log(
        self,
        *,
        step: SimulationStepDefinition,
        snapshot: dict,
        context: SimulationRunContext | None,
    ) -> None:
        if context is None:
            return

        with SessionLocal() as db:
            log_event(
                db,
                user_id=context.user_id,
                actor_role=context.actor_role,
                event_type="SIMULATION_STEP_COMPLETED",
                action=f"simulation_step_{step.id}",
                message=step.step_message,
                risk_score=snapshot["riskScore"],
                risk_level=_risk_level(snapshot["riskScore"]),
                decision=step.step_decision,
                mitre_technique_id=step.mitre_technique_id,
                mitre_technique_name=step.mitre_technique_name,
                mitre_tactic=step.mitre_tactic,
                ip_address=context.ip_address,
                device_id=context.device_id,
                details={
                    "stepId": step.id,
                    "stepName": step.name,
                    "stepStatus": "completed",
                    "currentStep": snapshot["currentStep"],
                    "riskScore": snapshot["riskScore"],
                    "anomalyScore": snapshot["anomalyScore"],
                    "detectionConfidence": snapshot["detectionConfidence"],
                },
                commit=True,
            )

    def _mark_access_blocked(self, *, context: SimulationRunContext, risk_score: float) -> None:
        termination_reason = "Access Denied - High Risk (Simulation Engine)"
        with SessionLocal() as db:
            session_obj = None
            if context.user_id and context.session_id:
                session_obj = db.scalar(
                    select(AccessSession)
                    .where(
                        AccessSession.id == context.session_id,
                        AccessSession.user_id == context.user_id,
                    )
                    .limit(1)
                )

            if session_obj:
                session_obj.current_risk_score = max(float(session_obj.current_risk_score or 0.0), risk_score)
                session_obj.current_risk_level = _risk_level(risk_score)

            log_event(
                db,
                user_id=context.user_id,
                actor_role=context.actor_role,
                event_type="ACCESS_DENIED_HIGH_RISK",
                action="simulation_auto_block",
                message="Access Denied - High Risk",
                risk_score=risk_score,
                risk_level=_risk_level(risk_score),
                decision="deny",
                mitre_technique_id="T1110",
                mitre_technique_name="Brute Force",
                mitre_tactic="Credential Access",
                ip_address=context.ip_address,
                device_id=context.device_id,
                details={
                    "finalOutcome": "Access Blocked",
                    "sessionTerminated": True,
                    "operatorSessionPreserved": True,
                    "targetSessionId": context.session_id,
                    "terminationReason": termination_reason,
                },
                commit=False,
            )
            db.commit()

    def _cleanup_simulation_artifacts(self, *, context: SimulationRunContext | None) -> None:
        if context is None or context.user_id is None:
            return

        now = _utc_now()
        with SessionLocal() as db:
            # Clear simulation-only anomaly telemetry so live risk returns to baseline after reset.
            db.execute(
                delete(BehaviorAnomalyEvent).where(
                    BehaviorAnomalyEvent.user_id == context.user_id,
                    BehaviorAnomalyEvent.event_source.in_(
                        ["attack_simulation", "attack_simulation_reset", "simulation_engine"]
                    ),
                )
            )

            # Remove simulation-generated audit events from active threat surfaces.
            db.execute(
                delete(AuditLog).where(
                    AuditLog.user_id == context.user_id,
                    or_(
                        AuditLog.event_type.in_(
                            [
                                "SIMULATION_STEP_COMPLETED",
                                "ATTACK_SIMULATION",
                                "ATTACK_SIMULATION_RESET",
                            ]
                        ),
                        AuditLog.action.like("simulation_step_%"),
                        AuditLog.action.in_(
                            [
                                "simulation_auto_block",
                                "run_attack_simulation",
                                "reset_attack_simulation",
                            ]
                        ),
                    ),
                )
            )

            active_sessions = db.scalars(
                select(AccessSession).where(
                    AccessSession.user_id == context.user_id,
                    AccessSession.is_active.is_(True),
                    AccessSession.expires_at > now,
                )
            ).all()

            for session_obj in active_sessions:
                session_obj.current_risk_score = 0.0
                session_obj.current_risk_level = "low"
                if session_obj.termination_reason and "Simulation" in session_obj.termination_reason:
                    session_obj.termination_reason = None
                    session_obj.terminated_at = None

            # If the operator session was marked inactive by a previous simulation run, restore it.
            if context.session_id:
                previous_session = db.scalar(
                    select(AccessSession).where(
                        AccessSession.id == context.session_id,
                        AccessSession.user_id == context.user_id,
                    )
                )
                if previous_session:
                    previous_session.current_risk_score = 0.0
                    previous_session.current_risk_level = "low"
                    if (
                        not previous_session.is_active
                        and previous_session.termination_reason
                        and "Simulation" in previous_session.termination_reason
                    ):
                        previous_session.is_active = True
                        previous_session.termination_reason = None
                        previous_session.terminated_at = None

            log_event(
                db,
                user_id=context.user_id,
                actor_role=context.actor_role,
                event_type="SIMULATION_RESET",
                action="simulation_reset_environment",
                message="Simulation environment reset and telemetry normalized",
                risk_score=0.0,
                risk_level="low",
                decision="allow",
                ip_address=context.ip_address,
                device_id=context.device_id,
                details={
                    "normalizedAt": now.isoformat(),
                    "operatorSessionId": context.session_id,
                },
                commit=False,
            )
            db.commit()


simulation_engine = AttackSimulationEngine()
