import { configureStore } from "@reduxjs/toolkit";
import deviationFormReducer from "./deviationFormSlice";
import aiReducer from "./aiSlice";

export const store = configureStore({
  reducer: {
    deviationForm: deviationFormReducer,
    ai: aiReducer,
  },
});
