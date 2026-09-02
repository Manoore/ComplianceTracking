from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from ..database import Base

BUILTIN_STANDARDS = [
    {"code": "AAAHC", "name": "Accreditation Association for Ambulatory Health Care"},
    {"code": "OSHA", "name": "Occupational Safety and Health Administration"},
    {"code": "HIPAA", "name": "Health Insurance Portability and Accountability Act"},
    {"code": "CLIA", "name": "Clinical Laboratory Improvement Amendments"},
    {"code": "CMS", "name": "Centers for Medicare & Medicaid Services"},
    {"code": "TJC", "name": "The Joint Commission"},
    {"code": "DNV", "name": "DNV Healthcare Accreditation"},
    {"code": "ISO9001", "name": "ISO 9001 Quality Management"},
    {"code": "NFPA", "name": "National Fire Protection Association"},
    {"code": "EPA", "name": "Environmental Protection Agency"},
]


class AccreditationStandard(Base):
    __tablename__ = "accreditation_standards"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_builtin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
