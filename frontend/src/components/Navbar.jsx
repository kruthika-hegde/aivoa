import React from "react";

const LINKS = ["Dashboard", "Deviations", "CAPAs", "Change Control", "Audits", "Documents", "Reports"];

export default function Navbar() {
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path d="M12 2 L22 20 L16 20 L12 10 L8 20 L2 20 Z" fill="#2E5EEA" />
          </svg>
          AIVOA
        </div>
        <nav className="navlinks">
          {LINKS.map((l) => (
            <a key={l} href="#" className={l === "Deviations" ? "active" : ""}>
              {l}
            </a>
          ))}
        </nav>
        <div className="topbar-right">
          <span className="org-pill">🏭 Vasudha Pharma Chem Ltd</span>
          <div className="avatar">MH</div>
        </div>
      </div>
    </div>
  );
}
