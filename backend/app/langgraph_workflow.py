"""
LangGraph workflow that turns a raw deviation document / pasted text into
a structured, review-ready deviation record.

Graph shape:

    extract_fields  --->  assess_severity  --->  finalize
         |                      |                    |
   pulls out site/plant,   reasons about GMP     packages the merged
   title, batch, dates,    impact + severity      result + missing-field
   description, etc.       with a short           list for the API layer
                            rationale

Each node is a small, focused Groq call (via langchain-groq) so failures
are isolated and each step's prompt stays simple and auditable - this
mirrors the "AI extraction -> AI impact/severity assistance" pipeline
described in the assignment.
"""

import json
import re
from typing import TypedDict, List, Optional

from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END

from .config import get_settings

settings = get_settings()

SITE_OPTIONS = [
    "API Manufacturing Unit",
    "Formulation Unit",
    "QC Laboratory",
    "Warehouse & Logistics",
    "Utilities & Engineering",
]
SOURCE_OPTIONS = [
    "Batch Record Review",
    "In-Process Check",
    "QC Testing / OOS",
    "Internal Audit",
    "Customer Complaint",
    "Equipment / Utility Alarm",
    "Self-Reported",
    "Other",
]
IMPACT_OPTIONS = [
    "Patient Safety",
    "Product Quality",
    "Regulatory Compliance",
    "Data Integrity",
    "No Impact Anticipated",
]
SEVERITY_OPTIONS = ["Critical", "Major", "Minor", "Minimal"]


def _get_llm(temperature: float = 0.0) -> ChatGroq:
    if not settings.groq_api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Add it to backend/.env (see .env.example)."
        )
    return ChatGroq(
        model=settings.groq_model,
        api_key=settings.groq_api_key,
        temperature=temperature,
    )


def _extract_json(raw: str) -> dict:
    """Tolerant JSON extraction: strips markdown fences and grabs the
    first {...} block if the model added any stray commentary."""
    raw = raw.strip()
    raw = re.sub(r"^```(json)?", "", raw).strip()
    raw = re.sub(r"```$", "", raw).strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        raw = match.group(0)
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Graph state
# ---------------------------------------------------------------------------

class DeviationState(TypedDict, total=False):
    source_text: str
    site_plant: str
    date_of_occurrence: str
    title: str
    source: str
    related_product: str
    batch_lot: str
    detailed_description: str
    initial_impact: str
    initial_severity: str
    severity_reason: str
    missing_fields: List[str]
    summary: str
    error: Optional[str]


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

def extract_fields(state: DeviationState) -> DeviationState:
    """Node 1: pull structured fields out of the raw source text."""
    llm = _get_llm()
    prompt = f"""You are a GMP quality assistant for an API pharmaceutical manufacturer.
Extract deviation record fields from the SOURCE TEXT.

Return ONLY strict JSON (no markdown fences, no commentary) with exactly these keys:
{{
  "site_plant": one of {SITE_OPTIONS} or "",
  "date_of_occurrence": "YYYY-MM-DD or empty string if not stated",
  "title": "concise 6-12 word title",
  "source": one of {SOURCE_OPTIONS} or "",
  "related_product": "product/material name or empty string",
  "batch_lot": "batch or lot number or empty string",
  "detailed_description": "clear 2-5 sentence formal QA description of what happened, where, when, how detected"
}}

Only use "" when the information truly is not present in the text - never invent values.

SOURCE TEXT:
\"\"\"
{state['source_text'][:12000]}
\"\"\"
"""
    resp = llm.invoke(prompt)
    data = _extract_json(resp.content)
    return {
        "site_plant": data.get("site_plant", ""),
        "date_of_occurrence": data.get("date_of_occurrence", ""),
        "title": data.get("title", ""),
        "source": data.get("source", ""),
        "related_product": data.get("related_product", ""),
        "batch_lot": data.get("batch_lot", ""),
        "detailed_description": data.get("detailed_description", ""),
    }


def assess_severity(state: DeviationState) -> DeviationState:
    """Node 2: reason about GMP impact/severity given the extracted description."""
    llm = _get_llm()
    prompt = f"""You are a GMP quality assistant for an API pharmaceutical manufacturer,
applying ICH Q9 quality-risk-management judgement to classify a deviation.

Deviation title: {state.get('title', '')}
Description: {state.get('detailed_description', '')}
Source: {state.get('source', '')}
Product/material: {state.get('related_product', '')}

Return ONLY strict JSON (no markdown fences) with exactly these keys:
{{
  "initial_impact": one of {IMPACT_OPTIONS},
  "initial_severity": one of {SEVERITY_OPTIONS},
  "severity_reason": "1-2 sentence rationale citing specifics from the description"
}}

Guidance: patient safety / sterility / potency risk => Critical or Major.
Contained, procedural, no product impact => Minor or Minimal.
"""
    resp = llm.invoke(prompt)
    data = _extract_json(resp.content)
    return {
        "initial_impact": data.get("initial_impact", ""),
        "initial_severity": data.get("initial_severity", ""),
        "severity_reason": data.get("severity_reason", ""),
    }


def finalize(state: DeviationState) -> DeviationState:
    """Node 3: figure out what's still missing and write a friendly summary."""
    required = {
        "Site / Plant": state.get("site_plant"),
        "Date of Occurrence": state.get("date_of_occurrence"),
        "Title": state.get("title"),
        "Source": state.get("source"),
        "Detailed Description": state.get("detailed_description"),
        "Initial Impact": state.get("initial_impact"),
        "Initial Severity": state.get("initial_severity"),
    }
    missing = [label for label, val in required.items() if not val]

    severity = state.get("initial_severity") or "unclassified"
    summary = (
        f"Extracted the deviation details and assessed it as {severity} severity."
        if not missing
        else f"Extracted most details ({severity} severity) — a few fields need your input."
    )
    return {"missing_fields": missing, "summary": summary}


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

def build_graph():
    graph = StateGraph(DeviationState)
    graph.add_node("extract_fields", extract_fields)
    graph.add_node("assess_severity", assess_severity)
    graph.add_node("finalize", finalize)

    graph.set_entry_point("extract_fields")
    graph.add_edge("extract_fields", "assess_severity")
    graph.add_edge("assess_severity", "finalize")
    graph.add_edge("finalize", END)

    return graph.compile()


_compiled_graph = None


def get_compiled_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph


def run_extraction(source_text: str) -> dict:
    """Entry point used by the API layer."""
    app = get_compiled_graph()
    result = app.invoke({"source_text": source_text})
    result.pop("source_text", None)
    return result


def answer_question(question: str, form_state: Optional[dict] = None) -> str:
    """Free-form Q&A used by the 'Ask me anything about deviations' box.
    Kept outside the graph since it's a single independent turn, not a
    pipeline stage."""
    llm = _get_llm(temperature=0.3)
    context = json.dumps(form_state or {}, indent=2)
    prompt = f"""You are the AI Deviation Assistant inside AIVOA, a GMP quality
management system for an API pharmaceutical manufacturer. Answer the
user's question helpfully and concisely (2-5 sentences, plain language).
Use GMP/QA best practice. If relevant, refer to the deviation currently
drafted in the form below.

Current form draft (JSON, may be partially empty):
{context}

User question: {question}
"""
    resp = llm.invoke(prompt)
    return resp.content.strip()
