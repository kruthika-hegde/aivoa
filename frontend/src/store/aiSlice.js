import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  extractFromText as apiExtractText,
  extractFromPdf as apiExtractPdf,
  askAssistant as apiAsk,
  listDeviations as apiListDeviations,
} from "../api/client";

const initialState = {
  messages: [
    {
      role: "assistant",
      kind: "text",
      text:
        "Upload a deviation report, lab result, or paste text above. I'll automatically extract the relevant details and populate the form for you.",
    },
  ],
  extracting: false,
  extractionError: null,
  lastExtraction: null,   // full extracted payload (for save audit trail)
  lastSourceText: null,
  asking: false,
  recent: [],
};

export const extractTextThunk = createAsyncThunk(
  "ai/extractText",
  async (text, { rejectWithValue }) => {
    try {
      return await apiExtractText(text);
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || "Extraction failed");
    }
  }
);

export const extractPdfThunk = createAsyncThunk(
  "ai/extractPdf",
  async (file, { rejectWithValue }) => {
    try {
      return await apiExtractPdf(file);
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || "PDF extraction failed");
    }
  }
);

export const askThunk = createAsyncThunk(
  "ai/ask",
  async ({ question, formState }, { rejectWithValue }) => {
    try {
      const res = await apiAsk(question, formState);
      return res.answer;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || "Could not get a response");
    }
  }
);

export const fetchRecentThunk = createAsyncThunk("ai/fetchRecent", async () => {
  return await apiListDeviations();
});

const aiSlice = createSlice({
  name: "ai",
  initialState,
  reducers: {
    addUserMessage(state, action) {
      state.messages.push({ role: "user", kind: "text", text: action.payload });
    },
    addAssistantMessage(state, action) {
      state.messages.push({ role: "assistant", kind: "text", text: action.payload });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(extractTextThunk.pending, (state) => {
        state.extracting = true;
        state.extractionError = null;
      })
      .addCase(extractTextThunk.fulfilled, (state, action) => {
        state.extracting = false;
        state.lastExtraction = action.payload.extracted;
        state.lastSourceText = action.payload.source_text;
        state.messages.push({ role: "assistant", kind: "extraction", data: action.payload.extracted });
      })
      .addCase(extractTextThunk.rejected, (state, action) => {
        state.extracting = false;
        state.extractionError = action.payload;
        state.messages.push({ role: "assistant", kind: "text", text: `⚠️ ${action.payload}` });
      })
      .addCase(extractPdfThunk.pending, (state) => {
        state.extracting = true;
        state.extractionError = null;
      })
      .addCase(extractPdfThunk.fulfilled, (state, action) => {
        state.extracting = false;
        state.lastExtraction = action.payload.extracted;
        state.lastSourceText = action.payload.source_text;
        state.messages.push({ role: "assistant", kind: "extraction", data: action.payload.extracted });
      })
      .addCase(extractPdfThunk.rejected, (state, action) => {
        state.extracting = false;
        state.extractionError = action.payload;
        state.messages.push({ role: "assistant", kind: "text", text: `⚠️ ${action.payload}` });
      })
      .addCase(askThunk.pending, (state) => {
        state.asking = true;
      })
      .addCase(askThunk.fulfilled, (state, action) => {
        state.asking = false;
        state.messages.push({ role: "assistant", kind: "text", text: action.payload });
      })
      .addCase(askThunk.rejected, (state, action) => {
        state.asking = false;
        state.messages.push({ role: "assistant", kind: "text", text: `⚠️ ${action.payload}` });
      })
      .addCase(fetchRecentThunk.fulfilled, (state, action) => {
        state.recent = action.payload;
      });
  },
});

export const { addUserMessage, addAssistantMessage } = aiSlice.actions;
export default aiSlice.reducer;
