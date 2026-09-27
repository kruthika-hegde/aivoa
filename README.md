# AIVOA — AI-Powered Deviation Intake Module

An AI-assisted **Deviation Management** workflow for an API pharmaceutical
manufacturer: paste an email/report or upload a PDF → AI extracts the
structured fields → AI recommends initial impact/severity with a reason →
user reviews and edits → save.

Two things are included:

1. **`/frontend` + `/backend`** — the production-shaped stack requested in
   the brief: **React + Redux Toolkit**, **FastAPI**, **LangGraph + Groq**,
   **PostgreSQL**. Run these locally with your own Groq API key.
2. A **live interactive demo** (a single published HTML page) that
   implements the exact same workflow end-to-end using Claude as the model
   instead of Groq, so it works with no setup at all — useful for the demo
   video and for reviewers who don't want to stand up Postgres/Groq first.
   Ask for the link if you don't already have it.

---

## 1. Architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐        ┌────────────────────┐
│   React + Redux (UI)     │  REST  │        FastAPI            │        │     PostgreSQL      │
│  LogDeviationForm         │ ─────▶ │  /api/ai/extract           │        │   deviations table   │
│  AIAssistantPanel         │ ◀───── │  /api/ai/extract-pdf       │ ─────▶ │  (+ AI audit trail)  │
│  (Redux Toolkit slices:   │        │  /api/ai/ask                │        └────────────────────┘
│   deviationForm, ai)      │        │  /api/deviations (CRUD)     │
└─────────────────────────┘        └────────────┬─────────────┘
                                                   │
                                                   ▼
                                     ┌─────────────────────────────┐
                                     │   LangGraph workflow          │
                                     │   extract_fields               │
                                     │        ↓                       │
                                     │   assess_severity              │
                                     │        ↓                       │
                                     │   finalize (missing fields)    │
                                     │   — each node calls Groq via   │
                                     │     langchain-groq —            │
                                     └─────────────────────────────┘
```

## 2. Workflow, mapped to the brief

| Brief requirement | Where it lives |
|---|---|
| Accept a deviation document or pasted text/email | `AIAssistantPanel` drag-drop + paste box → `POST /api/ai/extract` (text) or `/api/ai/extract-pdf` (PDF, parsed server-side with `pypdf`) |
| AI extracts relevant information and populates the form | `extractTextThunk` / `extractPdfThunk` (Redux) → `applyAiExtraction` reducer fills `deviationForm.fields` and flags them for the purple "AI-filled" highlight |
| Initial impact/severity recommendation with a short reason | LangGraph's `assess_severity` node; rendered in the chat as an "AI rationale" and also shown inline above the impact/severity selects |
| User reviews and edits before saving | Editing any select/input clears its AI-filled highlight and is recorded in `editedFields` (Redux) as an audit trail |
| Save | `POST /api/deviations`, stores the final (possibly edited) record **plus** `ai_extracted`, `ai_source_text` and `edited_fields` for traceability |
| "Ask me anything about deviations" | `POST /api/ai/ask`, aware of the current form draft |

**The three AI tools called out in the deliverables:**
- **PDF extraction tool** → `POST /api/ai/extract-pdf` (`pypdf` + LangGraph)
- **Log interaction tool** → `POST /api/deviations` (create)
- **Edit interaction** → `PATCH /api/deviations/{id}` + in-form editing before save

---

## 3. Running it locally

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # then fill in DATABASE_URL and GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
```

Postgres: create the database referenced by `DATABASE_URL` first, e.g.
`createdb aivoa_deviations`. Tables are created automatically on startup
(see `Base.metadata.create_all` in `app/main.py`) — fine for a demo; use
Alembic migrations for anything beyond that.

Groq: get a key at https://console.groq.com/keys. `GROQ_MODEL` defaults to
`llama-3.3-70b-versatile`; `gemma2-9b-it` also works and is faster/cheaper.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:3000` and proxies `/api` to the backend on
`:8000` (see `vite.config.js`).

---

## 4. Example scenario to demo

> "During Batch API-2026-014 manufacturing, the reactor temperature during
> the crystallization step drifted to 68°C against an approved range of
> 55–60°C for approximately 12 minutes before the operator noticed and
> corrected it. Detected during in-process check by the shift supervisor.
> Product: Metformin Hydrochloride API. Batch: API-2026-014. Occurred
> 24-Sep-2026 at API Manufacturing Unit."

Paste that into the AI panel and click **Extract with AI** — it should
populate site/plant, date, title, source, product, batch, a structured
description, and recommend an impact/severity with a short rationale you
can review, edit, and save.

## 5. Notes / next steps for a production build

- Add authentication (the nav bar's org/user chip is currently static)
- Add role-based routing to CAPA / Change Control once a deviation is
  classified as Major/Critical
- Add Alembic migrations instead of `create_all`
- Rate-limit `/api/ai/*` and add request/response logging for GMP audit
  requirements
- Swap `pypdf` text extraction for OCR (e.g. via a vision-capable model)
  for scanned PDFs
