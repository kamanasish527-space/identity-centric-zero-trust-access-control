from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.services.settings_service import get_app_settings


def initialize_defaults(db: Session) -> None:
    get_app_settings(db)

    admin_username = settings.bootstrap_admin_username
    admin_email = settings.bootstrap_admin_email
    admin_password = settings.bootstrap_admin_password

    if not (admin_username and admin_email and admin_password):
        return

    existing_admin = db.scalar(select(User).where(User.email == admin_email))
    if existing_admin:
        return

    user = User(
        username=admin_username,
        email=admin_email,
        hashed_password=get_password_hash(admin_password),
        role=UserRole.ADMIN,
        is_active=True,
        is_locked=False,
    )
    db.add(user)
    db.commit()
