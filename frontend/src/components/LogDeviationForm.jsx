import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setField,
  resetForm,
  saveDeviationThunk,
  validateForm,
} from "../store/deviationFormSlice";
import { fetchRecentThunk } from "../store/aiSlice";

const SITE_OPTIONS = [
  "API Manufacturing Unit",
  "Formulation Unit",
  "QC Laboratory",
  "Warehouse & Logistics",
  "Utilities & Engineering",
];
const SOURCE_OPTIONS = [
  "Batch Record Review",
  "In-Process Check",
  "QC Testing / OOS",
  "Internal Audit",
  "Customer Complaint",
  "Equipment / Utility Alarm",
  "Self-Reported",
  "Other",
];
const IMPACT_OPTIONS = [
  "Patient Safety",
  "Product Quality",
  "Regulatory Compliance",
  "Data Integrity",
  "No Impact Anticipated",
];
const SEVERITY_OPTIONS = ["Critical", "Major", "Minor", "Minimal"];

function Field({ name, label, required, aiFilled, children }) {
  return (
    <div className={`field${aiFilled ? " ai-filled" : ""}`}>
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function LogDeviationForm({ onToast }) {
  const dispatch = useDispatch();
  const { fields, aiFilledFields, status, savedId, editingId } = useSelector((s) => s.deviationForm);
  const { lastExtraction, lastSourceText } = useSelector((s) => s.ai);
  const isAiFilled = (name) => aiFilledFields.includes(name);

  const onChange = (name) => (e) => dispatch(setField({ name, value: e.target.value }));

  const handleSave = async () => {
    const missing = validateForm(fields);
    if (missing.length) {
      onToast(`Please complete: ${missing.join(", ")}`);
      return;
    }
    const result = await dispatch(
      saveDeviationThunk({ aiExtracted: lastExtraction, aiSourceText: lastSourceText })
    );
    if (saveDeviationThunk.fulfilled.match(result)) {
      onToast(editingId ? "Deviation updated ✅" : "Deviation logged successfully ✅");
      dispatch(fetchRecentThunk());
    } else {
      onToast(result.payload || "Could not save deviation");
    }
  };

  const handleReset = () => dispatch(resetForm());

  return (
    <div className="card form-card">
      <div className="form-top">
        <div>
          <h2>Deviation Details</h2>
          <p className="sub">
            Fields marked <span style={{ color: "var(--crit-600)" }}>*</span> are required before saving.
          </p>
        </div>
        <span className={`status-chip${status === "Saved" ? " saved" : ""}`}>
          {editingId && status !== "Saved" ? "Editing saved record" : status}
        </span>
      </div>

      <div className="sec-label">
        <span className="num">1</span> Deviation Information
      </div>
      <div className="field-row">
        <Field name="site_plant" label="Site / Plant" required aiFilled={isAiFilled("site_plant")}>
          <select value={fields.site_plant} onChange={onChange("site_plant")}>
            <option value="">Select site / plant</option>
            {SITE_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field name="date_of_occurrence" label="Date of Occurrence" required aiFilled={isAiFilled("date_of_occurrence")}>
          <input type="date" value={fields.date_of_occurrence} onChange={onChange("date_of_occurrence")} />
        </Field>
      </div>

      <div className="field-row">
        <Field name="title" label="Title / Short Description" required aiFilled={isAiFilled("title")}>
          <input
            type="text"
            maxLength={140}
            placeholder="e.g. OOS result for Assay in Batch ABC-001"
            value={fields.title}
            onChange={onChange("title")}
          />
        </Field>
      </div>

      <div className="field-row">
        <Field name="source" label="Source" required aiFilled={isAiFilled("source")}>
          <select value={fields.source} onChange={onChange("source")}>
            <option value="">Select source</option>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field name="related_product" label="Related Product / Material" aiFilled={isAiFilled("related_product")}>
          <input
            type="text"
            placeholder="Search product or material"
            value={fields.related_product}
            onChange={onChange("related_product")}
          />
        </Field>
      </div>

      <div className="field-row">
        <Field name="batch_lot" label="Batch / Lot Number" aiFilled={isAiFilled("batch_lot")}>
          <input
            type="text"
            placeholder="Enter batch / lot no."
            value={fields.batch_lot}
            onChange={onChange("batch_lot")}
          />
        </Field>
        <div className="field" />
      </div>

      <div className="sec-label">
        <span className="num">2</span> Deviation Details
      </div>
      <div className="field-row">
        <Field name="detailed_description" label="Detailed Description" required aiFilled={isAiFilled("detailed_description")}>
          <textarea
            maxLength={2000}
            placeholder="Describe what happened, where, when and how it was detected…"
            value={fields.detailed_description}
            onChange={onChange("detailed_description")}
          />
          <span className="charcount">{fields.detailed_description.length}/2000</span>
        </Field>
      </div>

      <div className="field-row">
        <Field name="initial_impact" label="Initial Impact" required aiFilled={isAiFilled("initial_impact")}>
          <select value={fields.initial_impact} onChange={onChange("initial_impact")}>
            <option value="">Select impact</option>
            {IMPACT_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field name="initial_severity" label="Initial Severity" required aiFilled={isAiFilled("initial_severity")}>
          <select value={fields.initial_severity} onChange={onChange("initial_severity")}>
            <option value="">Select severity</option>
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
      </div>

      {fields.severity_reason && (
        <div className="ai-rationale">
          <strong>AI rationale:</strong> {fields.severity_reason}
        </div>
      )}

      <div className="form-actions">
        <button className="btn btn-reset" onClick={handleReset}>
          ↺ Reset Form
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={status === "Saving"}>
          💾 {status === "Saving" ? "Saving…" : editingId ? "Update Deviation" : "Save Deviation"}
        </button>
      </div>
    </div>
  );
}
