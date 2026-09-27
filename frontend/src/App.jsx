import React, { useState, useCallback } from "react";
import Navbar from "./components/Navbar";
import LogDeviationForm from "./components/LogDeviationForm";
import AIAssistantPanel from "./components/AIAssistantPanel";

export default function App() {
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }, []);

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-head">
          <div>
            <h1>Log Deviation</h1>
            <p>Record any unexpected event, out-of-specification result or non-conformance.</p>
          </div>
        </div>
        <div className="grid">
          <LogDeviationForm onToast={showToast} />
          <AIAssistantPanel onToast={showToast} />
        </div>
      </div>
      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>
    </>
  );
}
