import React, { useRef, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  extractTextThunk,
  extractPdfThunk,
  askThunk,
  addUserMessage,
  fetchRecentThunk,
} from "../store/aiSlice";
import { applyAiExtraction, loadForEdit } from "../store/deviationFormSlice";

const SEV_CLASS = { Critical: "sev-Critical", Major: "sev-Major", Minor: "sev-Minor", Minimal: "sev-Minimal" };

function ExtractionCard({ data }) {
  const rows = [
    ["Site / Plant", data.site_plant],
    ["Date", data.date_of_occurrence],
    ["Title", data.title],
    ["Source", data.source],
    ["Product", data.related_product],
    ["Batch/Lot", data.batch_lot],
  ].filter(([, v]) => v);

  return (
    <div>
      <p>{data.summary || "I extracted the following details from your document."}</p>
      <div className="extract-card">
        {rows.map(([k, v]) => (
          <div className="extract-row" key={k}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
        {data.initial_severity && (
          <div className="extract-row">
            <span className="k">Severity</span>
            <span className={`sev-badge ${SEV_CLASS[data.initial_severity] || ""}`}>{data.initial_severity}</span>
          </div>
        )}
      </div>
      {data.severity_reason && (
        <p style={{ marginTop: 8 }}>
          <strong>Why:</strong> {data.severity_reason}
        </p>
      )}
      {data.missing_fields && data.missing_fields.length > 0 ? (
        <p style={{ marginTop: 6 }}>⚠️ I couldn't confidently determine: {data.missing_fields.join(", ")}. Please review.</p>
      ) : (
        <p style={{ marginTop: 6 }}>✅ All fields populated — please review before saving.</p>
      )}
    </div>
  );
}

export default function AIAssistantPanel({ onToast }) {
  const dispatch = useDispatch();
  const { messages, extracting, asking, recent } = useSelector((s) => s.ai);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [question, setQuestion] = useState("");
  const fileInputRef = useRef(null);
  const chatRef = useRef(null);
  const formState = useSelector((s) => s.deviationForm.fields);

  useEffect(() => {
    dispatch(fetchRecentThunk());
  }, [dispatch]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const runExtraction = async (kind, payload, label) => {
    dispatch(addUserMessage(label));
    const action = kind === "pdf" ? extractPdfThunk(payload) : extractTextThunk(payload);
    const result = await dispatch(action);
    const ok = kind === "pdf" ? extractPdfThunk.fulfilled.match(result) : extractTextThunk.fulfilled.match(result);
    if (ok) {
      dispatch(applyAiExtraction(result.payload.extracted));
      onToast("Form populated from AI extraction — review before saving");
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      onToast("File exceeds 10MB limit");
      return;
    }
    setFileName(file.name);
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      runExtraction("pdf", file, `📎 Uploaded ${file.name}`);
    } else {
      file.text().then((text) => runExtraction("text", text, `📎 Uploaded ${file.name}`));
    }
  };

  const handleAsk = async () => {
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    dispatch(addUserMessage(q));
    await dispatch(askThunk({ question: q, formState }));
  };

  return (
    <div className="ai-panel">
      <div className="card ai-card">
        <div className="ai-head">
          <div className="ai-title">
            <div className="ai-icon">✨</div>
            AI Deviation Assistant
          </div>
          <span className="beta-tag">BETA</span>
        </div>

        <div
          className={`drop-zone${dragOver ? " drag" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files[0]);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <div className="main">
            Drag &amp; drop supporting document here
            <br />
            or <a>click to browse</a>
          </div>
          {fileName && <div className="fname">📎 {fileName}</div>}
        </div>

        <div className="or-div">OR</div>

        <button className="paste-btn" onClick={() => setPasteOpen((v) => !v)}>
          📝 Paste deviation details / notes
        </button>
        {pasteOpen && (
          <div className="paste-box open">
            <textarea
              placeholder="Paste an email, batch record note, or free-text description of the deviation here…"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="paste-actions">
              <button
                className="btn btn-reset"
                onClick={() => {
                  setPasteOpen(false);
                  setPasteText("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!pasteText.trim()) {
                    onToast("Paste some deviation details first");
                    return;
                  }
                  const label = pasteText.length > 220 ? pasteText.slice(0, 220) + "…" : pasteText;
                  runExtraction("text", pasteText, label);
                  setPasteOpen(false);
                  setPasteText("");
                }}
              >
                ✨ Extract with AI
              </button>
            </div>
          </div>
        )}

        <div className="support-note">✓ Supported formats: PDF, TXT, MD · Max file size 10MB</div>

        {extracting && (
          <div className="progress-wrap">
            <div className="progress-head">
              <span>Extraction progress</span>
            </div>
            <div className="progress-track">
              <div className="progress-bar indeterminate" />
            </div>
            <div className="progress-stage">Analyzing document content and extracting key details…</div>
          </div>
        )}
      </div>

      <div className="card ai-card">
        <div className="chat-scroll" ref={chatRef}>
          {messages.map((m, i) => (
            <div className={`msg ${m.role}`} key={i}>
              <div className="bubble-icon">{m.role === "user" ? "🧑" : "✨"}</div>
              <div className="msg-body">{m.kind === "extraction" ? <ExtractionCard data={m.data} /> : <p>{m.text}</p>}</div>
            </div>
          ))}
          {asking && (
            <div className="msg assistant">
              <div className="bubble-icon">✨</div>
              <div className="msg-body">
                <div className="typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="ask-row">
          <input
            type="text"
            placeholder="Ask me anything about deviations…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          />
          <button className="ask-send" onClick={handleAsk} disabled={asking}>
            ➤
          </button>
        </div>
        <div className="ai-disclaimer">AI responses may contain errors. Please verify information.</div>
      </div>

      <div className="card recent-card">
        <div className="recent-head">
          <h3>Recent Deviations</h3>
          <span style={{ fontSize: 11, color: "var(--ink-400)" }}>{recent.length ? `${recent.length} total` : ""}</span>
        </div>
        {recent.length === 0 ? (
          <div className="empty-recent">No deviations logged yet.</div>
        ) : (
          <>
            <div className="empty-recent" style={{ paddingTop: 0 }}>Click a record to review or edit it.</div>
            {recent.slice(0, 6).map((r) => (
              <div
                className="recent-item recent-item-clickable"
                key={r.id}
                onClick={() => {
                  dispatch(loadForEdit(r));
                  onToast(`Loaded "${r.title}" for editing`);
                }}
              >
                <span className="rt">{r.title}</span>
                <span className={`sev-badge ${SEV_CLASS[r.initial_severity] || ""}`}>{r.initial_severity}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
