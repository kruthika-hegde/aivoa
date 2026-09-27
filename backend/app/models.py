import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID

from .database import Base


class Deviation(Base):
    """A logged deviation record.

    Mirrors the 'Log Deviation' form fields plus the AI extraction
    metadata (source text, confidence notes, missing fields) so the
    full AI -> human-review -> save trail is auditable.
    """

    __tablename__ = "deviations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Section 1 - Deviation Information
    site_plant = Column(String(120), nullable=False)
    date_of_occurrence = Column(String(20), nullable=False)  # ISO date string
    title = Column(String(200), nullable=False)
    source = Column(String(80), nullable=False)
    related_product = Column(String(200), nullable=True)
    batch_lot = Column(String(80), nullable=True)

    # Section 2 - Deviation Details
    detailed_description = Column(Text, nullable=False)
    initial_impact = Column(String(80), nullable=False)
    initial_severity = Column(String(20), nullable=False)
    severity_reason = Column(Text, nullable=True)

    # AI provenance / audit trail
    ai_extracted = Column(JSON, nullable=True)      # raw AI extraction payload
    ai_source_text = Column(Text, nullable=True)     # the document/notes text that was analyzed
    edited_fields = Column(JSON, nullable=True)      # which fields the user changed after AI extraction
    status = Column(String(20), nullable=False, default="Draft")  # Draft | Saved | Under Review | Closed

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
