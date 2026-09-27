from fastapi import APIRouter, HTTPException, UploadFile, File
from pypdf import PdfReader
import io

from ..schemas import (
    ExtractionRequest,
    ExtractionResponse,
    ExtractedDeviation,
    AskRequest,
    AskResponse,
)
from ..langgraph_workflow import run_extraction, answer_question

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/extract", response_model=ExtractionResponse)
def extract_from_text(payload: ExtractionRequest):
    """AI extraction tool (text/email path):
    runs the LangGraph pipeline over pasted deviation notes/email text."""
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")
    try:
        result = run_extraction(payload.text)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI extraction failed: {e}")

    return ExtractionResponse(
        extracted=ExtractedDeviation(**result),
        source_text=payload.text,
    )


@router.post("/extract-pdf", response_model=ExtractionResponse)
async def extract_from_pdf(file: UploadFile = File(...)):
    """AI extraction tool (PDF path):
    parses text out of an uploaded PDF deviation report, then runs it
    through the same LangGraph extraction/assessment pipeline."""
    if file.content_type not in ("application/pdf",) and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported on this endpoint")

    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    try:
        reader = PdfReader(io.BytesIO(raw))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {e}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="No extractable text found in PDF (it may be a scanned image)")

    try:
        result = run_extraction(text)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI extraction failed: {e}")

    return ExtractionResponse(
        extracted=ExtractedDeviation(**result),
        source_text=text,
    )


@router.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest):
    """Free-form 'ask me anything about deviations' assistant, aware of
    whatever is currently drafted in the form."""
    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")
    try:
        answer = answer_question(payload.question, payload.form_state)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI request failed: {e}")
    return AskResponse(answer=answer)
