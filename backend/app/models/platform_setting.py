from sqlalchemy import Column, String, JSON
from ..database import Base


class PlatformSetting(Base):
    __tablename__ = "platform_settings"
    key = Column(String, primary_key=True)
    # Plain JSON (not the Postgres-only JSONB) so this table can also be created on
    # SQLite, which is the default local-dev database -- SQLAlchemy's JSON type still
    # works fine against an existing Postgres JSONB column in production.
    value = Column(JSON, nullable=True)
