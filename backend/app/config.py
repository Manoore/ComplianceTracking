from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str = "sqlite:///./compliance.db"
    secret_key: str = "changeme-in-production-32chars-min"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8  # 8 hours
    refresh_token_expire_days: int = 30

    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None
    smtp_from: str = "noreply@compliance.local"

    frontend_url: str = "http://localhost:3000"
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 20

    super_admin_email: str = "superadmin@complinow.app"
    super_admin_password: str = "SuperAdmin2025!"

    sso_enabled: bool = False
    sso_provider: Optional[str] = None
    sso_client_id: Optional[str] = None
    sso_client_secret: Optional[str] = None
    sso_discovery_url: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
