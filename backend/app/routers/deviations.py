import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/deviations", tags=["deviations"])


@router.post("", response_model=schemas.DeviationOut, status_code=201)
def create_deviation(payload: schemas.DeviationCreate, db: Session = Depends(get_db)):
    """'Log interaction' tool: persist a reviewed deviation record.
    Carries forward the AI extraction payload + which fields the user
    edited, for audit purposes."""
    record = models.Deviation(
        site_plant=payload.site_plant,
        date_of_occurrence=payload.date_of_occurrence,
        title=payload.title,
        source=payload.source,
        related_product=payload.related_product,
        batch_lot=payload.batch_lot,
        detailed_description=payload.detailed_description,
        initial_impact=payload.initial_impact,
        initial_severity=payload.initial_severity,
        severity_reason=payload.severity_reason,
        ai_extracted=payload.ai_extracted,
        ai_source_text=payload.ai_source_text,
        edited_fields=payload.edited_fields,
        status="Saved",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("", response_model=List[schemas.DeviationOut])
def list_deviations(db: Session = Depends(get_db), limit: int = 50):
    return (
        db.query(models.Deviation)
        .order_by(desc(models.Deviation.created_at))
        .limit(limit)
        .all()
    )


@router.get("/{deviation_id}", response_model=schemas.DeviationOut)
def get_deviation(deviation_id: uuid.UUID, db: Session = Depends(get_db)):
    record = db.get(models.Deviation, deviation_id)
    if not record:
        raise HTTPException(status_code=404, detail="Deviation not found")
    return record


@router.patch("/{deviation_id}", response_model=schemas.DeviationOut)
def update_deviation(deviation_id: uuid.UUID, payload: schemas.DeviationUpdate, db: Session = Depends(get_db)):
    """'Edit interaction' tool: user-reviewed corrections to an
    AI-populated or previously saved record."""
    record = db.get(models.Deviation, deviation_id)
    if not record:
        raise HTTPException(status_code=404, detail="Deviation not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{deviation_id}", status_code=204)
def delete_deviation(deviation_id: uuid.UUID, db: Session = Depends(get_db)):
    record = db.get(models.Deviation, deviation_id)
    if not record:
        raise HTTPException(status_code=404, detail="Deviation not found")
    db.delete(record)
    db.commit()
    return None
