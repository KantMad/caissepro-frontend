// ═══════════════════════════════════════════════════════════════
// CaissePro — Application Entry Point (Orchestrator)
// ═══════════════════════════════════════════════════════════════
// Modules:
//   constants.js — Company info, TVA, permissions, seed data, colors
//   utils.js     — Security (hash, escape), pricing helpers, normalizers
//   ui.js        — Shared UI components (Modal, Btn, Input, Badge, etc.)
//   context.js   — AppProvider (business logic, state, API calls)
//   screens.jsx  — All screen components (Sales, Stats, Stock, etc.)
//   nav.jsx      — Navigation and layout orchestration
//   api.js       — API service layer
//   printer.js   — Thermal printer integration
// ═══════════════════════════════════════════════════════════════

import React from "react";
import AppProvider from "./context.jsx";
import { ErrorBoundary, ToastContainer } from "./ui.jsx";
import { AppContent } from "./nav.jsx";

/* ══════════ KEYFRAMES (injected once) ══════════ */
const style = document.createElement("style");
style.textContent = `
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes modalPop { from { opacity: 0; transform: scale(0.92) translateY(10px) } to { opacity: 1; transform: scale(1) translateY(0) } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.6 } }
  @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
  @keyframes shake { 0%, 100% { transform: translateX(0) } 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }
  @media print {
    body * { visibility: hidden !important; }
    [data-print-receipt], [data-print-receipt] * { visibility: visible !important; }
    [data-print-receipt] { position: absolute; left: 0; top: 0; width: 72mm; }
  }
`;
if (!document.querySelector("[data-caissepro-styles]")) {
  style.setAttribute("data-caissepro-styles", "");
  document.head.appendChild(style);
}

/* ══════════ APP ══════════ */
export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastContainer />
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
