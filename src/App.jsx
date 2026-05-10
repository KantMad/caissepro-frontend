// ═══════════════════════════════════════════════════════════════
// CaissePro — Application Entry Point (Orchestrator)
// ═══════════════════════════════════════════════════════════════
import React from "react";
import AppProvider from "./context.jsx";
import { ErrorBoundary, ToastContainer } from "./ui.jsx";
import { AppContent } from "./nav.jsx";
import { C } from "./constants.jsx";

/* ══════════ APP ══════════ */
export default function App(){
  return(<ErrorBoundary><AppProvider><AppContent/><ToastContainer/>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}
      html,body,#root{height:100%;min-height:100vh;background:${C.bg}}
      body{font-family:'DM Sans',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:${C.text};font-size:14px;letter-spacing:-0.01em}
      ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.borderDark};border-radius:4px}::-webkit-scrollbar-thumb:hover{background:${C.textLight}}
      @keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}
      @keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}
      @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      @keyframes modalPop{from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @keyframes successPulse{0%{transform:scale(0.8);opacity:0}50%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
      @keyframes checkDraw{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}
      .spin-loader{display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite}
      button:active{transform:scale(0.97)!important}button{transition:all 0.2s cubic-bezier(0.16,1,0.3,1)}
      input:focus,select:focus,textarea:focus{outline:none;border-color:${C.primary}!important;box-shadow:0 0 0 3px ${C.primary}10!important}
      ::selection{background:${C.primary}15;color:${C.primaryDark}}
      select{cursor:pointer;font-family:inherit}
      @media print{body *{visibility:hidden!important}[data-print-receipt],[data-print-receipt] *{visibility:visible!important}
        [data-print-receipt]{position:absolute!important;left:0!important;top:0!important;width:72mm!important;padding:4mm!important;background:#fff!important;border:none!important;box-shadow:none!important;border-radius:0!important}
        @page{size:72mm auto;margin:2mm}}
      @media (max-width:1024px){.hide-md{display:none!important}}`}</style>
  </AppProvider></ErrorBoundary>);
}
