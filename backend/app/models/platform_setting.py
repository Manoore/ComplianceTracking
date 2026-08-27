from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import JSONB
from ..database import Base


class PlatformSetting(Base):
    __tablename__ = "platform_settings"
    key = Column(String, primary_key=True)
    value = Column(JSONB, nullable=True)
