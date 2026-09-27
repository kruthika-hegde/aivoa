import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field


# ---------- AI extraction ----------

class ExtractionRequest(BaseModel):
    text: str = Field(..., description="Raw deviation text: pasted notes/email, or extracted PDF text")


class ExtractedDeviation(BaseModel):
    site_plant: str = ""
    date_of_occurrence: str = ""
    title: str = ""
    source: str = ""
    related_product: str = ""
    batch_lot: str = ""
    detailed_description: str = ""
    initial_impact: str = ""
    initial_severity: str = ""
    severity_reason: str = ""
    missing_fields: List[str] = []
    summary: str = ""


class ExtractionResponse(BaseModel):
    extracted: ExtractedDeviation
    source_text: str


class AskRequest(BaseModel):
    question: str
    form_state: Optional[Dict[str, Any]] = None


class AskResponse(BaseModel):
    answer: str


# ---------- Deviation CRUD ----------

class DeviationBase(BaseModel):
    site_plant: str
    date_of_occurrence: str
    title: str
    source: str
    related_product: Optional[str] = ""
    batch_lot: Optional[str] = ""
    detailed_description: str
    initial_impact: str
    initial_severity: str
    severity_reason: Optional[str] = ""


class DeviationCreate(DeviationBase):
    ai_extracted: Optional[Dict[str, Any]] = None
    ai_source_text: Optional[str] = None
    edited_fields: Optional[List[str]] = None


class DeviationUpdate(BaseModel):
    site_plant: Optional[str] = None
    date_of_occurrence: Optional[str] = None
    title: Optional[str] = None
    source: Optional[str] = None
    related_product: Optional[str] = None
    batch_lot: Optional[str] = None
    detailed_description: Optional[str] = None
    initial_impact: Optional[str] = None
    initial_severity: Optional[str] = None
    severity_reason: Optional[str] = None
    status: Optional[str] = None


class DeviationOut(DeviationBase):
    id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
