import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { saveDeviation as apiSaveDeviation, updateDeviation as apiUpdateDeviation } from "../api/client";

const emptyForm = {
  site_plant: "",
  date_of_occurrence: "",
  title: "",
  source: "",
  related_product: "",
  batch_lot: "",
  detailed_description: "",
  initial_impact: "",
  initial_severity: "",
  severity_reason: "",
};

const initialState = {
  fields: { ...emptyForm },
  aiFilledFields: [],   // fields currently highlighted as AI-populated
  editedFields: [],     // fields the user has hand-edited since the last AI fill
  status: "Draft",      // Draft | Saving | Saved
  savedId: null,
  editingId: null,      // set when editing a previously-saved record (drives PATCH vs POST)
  saveError: null,
};

export const saveDeviationThunk = createAsyncThunk(
  "deviationForm/save",
  async ({ aiExtracted, aiSourceText }, { getState, rejectWithValue }) => {
    const { fields, editedFields, editingId } = getState().deviationForm;
    try {
      if (editingId) {
        // 'Edit interaction' tool: user-reviewed corrections to a
        // previously saved record -> PATCH /api/deviations/{id}
        return await apiUpdateDeviation(editingId, { ...fields, status: "Saved" });
      }
      const payload = {
        ...fields,
        ai_extracted: aiExtracted || null,
        ai_source_text: aiSourceText || null,
        edited_fields: editedFields,
      };
      return await apiSaveDeviation(payload);
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || "Could not save deviation");
    }
  }
);

const deviationFormSlice = createSlice({
  name: "deviationForm",
  initialState,
  reducers: {
    setField(state, action) {
      const { name, value } = action.payload;
      state.fields[name] = value;
      // once a user edits a field, it's no longer "AI-filled" styling,
      // and we record it for the audit trail
      state.aiFilledFields = state.aiFilledFields.filter((f) => f !== name);
      if (!state.editedFields.includes(name)) state.editedFields.push(name);
    },
    applyAiExtraction(state, action) {
      const extracted = action.payload;
      const filled = [];
      Object.entries(extracted).forEach(([key, value]) => {
        if (key in state.fields && value) {
          state.fields[key] = value;
          filled.push(key);
        }
      });
      state.aiFilledFields = filled;
      state.editedFields = [];
    },
    resetForm(state) {
      state.fields = { ...emptyForm };
      state.aiFilledFields = [];
      state.editedFields = [];
      state.status = "Draft";
      state.savedId = null;
      state.editingId = null;
      state.saveError = null;
    },
    loadForEdit(state, action) {
      // Pulls a previously-saved record back into the form for review/correction.
      const record = action.payload;
      Object.keys(emptyForm).forEach((key) => {
        state.fields[key] = record[key] ?? "";
      });
      state.aiFilledFields = [];
      state.editedFields = [];
      state.status = "Editing";
      state.savedId = record.id;
      state.editingId = record.id;
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(saveDeviationThunk.pending, (state) => {
        state.status = "Saving";
        state.saveError = null;
      })
      .addCase(saveDeviationThunk.fulfilled, (state, action) => {
        state.status = "Saved";
        state.savedId = action.payload.id;
        // Keep editingId set to this record: further tweaks before Reset
        // Form continue to PATCH the same record rather than creating a duplicate.
        state.editingId = action.payload.id;
      })
      .addCase(saveDeviationThunk.rejected, (state, action) => {
        state.status = "Draft";
        state.saveError = action.payload;
      });
  },
});

export const { setField, applyAiExtraction, resetForm, loadForEdit } = deviationFormSlice.actions;
export default deviationFormSlice.reducer;

export const REQUIRED_FIELDS = [
  ["site_plant", "Site / Plant"],
  ["date_of_occurrence", "Date of Occurrence"],
  ["title", "Title"],
  ["source", "Source"],
  ["detailed_description", "Detailed Description"],
  ["initial_impact", "Initial Impact"],
  ["initial_severity", "Initial Severity"],
];

export function validateForm(fields) {
  return REQUIRED_FIELDS.filter(([key]) => !String(fields[key] || "").trim()).map(([, label]) => label);
}
