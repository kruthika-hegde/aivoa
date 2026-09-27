# AIVOA — AI-Powered Deviation Intake Module

An AI-assisted **Deviation Management** workflow for an API pharmaceutical
manufacturer: paste an email/report or upload a PDF → AI extracts the
structured fields → AI recommends an initial impact/severity with a reason →
the user reviews and edits → save.

Built for the *AI Product Engineer Challenge — Deviation Intake Module*
assignment, following the required stack: **React + Redux**, **FastAPI**,
**LangGraph + Groq**, **PostgreSQL**.

---

## 1. What this covers

| Brief requirement | Where it lives |
|---|---|
| Accept a deviation document or pasted text/email | `AIAssistantPanel.jsx` (drag-drop + paste box) → `POST /api/ai/extract` (text) or `POST /api/ai/extract-pdf` (PDF, parsed server-side with `pypdf`) |
| AI extracts information and populates the form | `extractTextThunk` / `extractPdfThunk` (Redux) → `applyAiExtraction` reducer fills `deviationForm.fields` and flags each AI-filled field for the highlight in the UI |
| Initial impact/severity recommendation with a short reason | LangGraph's `assess_severity` node; shown as an AI rationale in the panel and inline above the impact/severity fields |
| User reviews and edits AI-generated info before saving | Editing any field clears its AI-filled highlight and records the change in `editedFields` (Redux) as an audit trail |
| Save | `POST /api/deviations` — stores the final (possibly edited) record plus `ai_extracted`, `ai_source_text`, and `edited_fields` for traceability |

**The three AI tools called out in the deliverables:**
- **PDF extraction tool** → `POST /api/ai/extract-pdf`
- **Log interaction tool** → `POST /api/deviations` (create)
- **Edit interaction** → `PATCH /api/deviations/{id}` + in-form editing before save

---

## 2. Architecture

```
┌────────────────────────────    ┐          ┌──────────────────────────────┐         ┌─────────────────────┐
│   React + Redux (UI)           │  REST   │           FastAPI             │         |     PostgreSQL        │
│  LogDeviationForm              │ ─────▶ │ /api/ai/extract                │         │   deviations table    │
│  AIAssistantPanel              │ ◀───── │  /api/ai/extract-pdf           │ ─────▶ |  (+ AI audit trail)   │
│  Redux slices:                 │         │  /api/ai/ask                   │         └─────────────────────┘
│   deviationFormSlice, aiSlice  │         │  /api/deviations (CRUD)        │
└────────────────────────────┘             └──────────────┬─────────────────┘
                                                        │
                                                        ▼
                                          ┌─────────────────────────────────┐
                                          │        LangGraph workflow       │
                                          │        extract_fields           │
                                          │             ↓                   │
                                          │        assess_severity          │
                                          │             ↓                   │
                                          │        finalize                 │
                                          │  (each node calls Groq via      │
                                          │   langchain-groq)               │
                                          └─────────────────────────────────┘
```

---

## 3. Tech stack

- **Frontend:** React 18, Redux Toolkit, Vite
- **Backend:** Python, FastAPI, SQLAlchemy
- **AI:** LangGraph, Groq (`llama-3.3-70b-versatile` / `gemma2-9b-it`, configurable)
- **Database:** PostgreSQL

---

## 4. Running it locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # fill in DATABASE_URL and GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
```

- **Postgres:** create the database referenced by `DATABASE_URL` first, e.g.
  `createdb aivoa_deviations`. Tables are created automatically on startup
  (`Base.metadata.create_all` in `app/main.py`) — fine for a demo; use
  Alembic migrations for anything beyond that.
- **Groq:** get a key at https://console.groq.com/keys and set it as
  `GROQ_API_KEY` in `.env`. `GROQ_MODEL` can be `llama-3.3-70b-versatile`,
  `gemma2-9b-it`, or another Groq-hosted model.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:3000` and proxies `/api` requests to the backend
on `:8000` (see `vite.config.js`).

---

## 5. Example scenario to demo

> During Batch API-2026-014 manufacturing, the reactor temperature during
> the crystallization step drifted to 68°C against an approved range of
> 55–60°C for approximately 12 minutes before the operator noticed and
> corrected it. Detected during in-process check by the shift supervisor.
> Product: Metformin Hydrochloride API. Batch: API-2026-014. Occurred
> 24-Sep-2026 at the API Manufacturing Unit.

Paste that into the AI panel and click **Extract with AI**. It should
populate the site/plant, date, title, source, product, batch, and a
structured description, then recommend an impact/severity rating with a
short rationale you can review, edit, and save.

---

## 6. Project structure

```
project/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── ai.py             # extract / extract-pdf / ask endpoints
│   │   │   └── deviations.py     # CRUD for saved deviations
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── langgraph_workflow.py # extract_fields -> assess_severity -> finalize
│   │   ├── main.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── api/client.js
    │   ├── components/
    │   │   ├── AIAssistantPanel.jsx
    │   │   ├── LogDeviationForm.jsx
    │   │   └── Navbar.jsx
    │   ├── store/
    │   │   ├── aiSlice.js
    │   │   ├── deviationFormSlice.js
    │   │   └── store.js
    │   ├── App.jsx
    │   └── index.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## 7. Notes / next steps for a production build

- Add authentication (the nav bar's org/user chip is currently static)
- Add role-based routing to CAPA / Change Control once a deviation is
  classified as Major/Critical
- Add Alembic migrations instead of `create_all`
- Rate-limit `/api/ai/*` and add request/response logging for GMP audit
  requirements
- Swap `pypdf` text extraction for OCR (e.g. via a vision-capable model)
  for scanned PDFs
