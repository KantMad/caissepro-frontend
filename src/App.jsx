// ═══════════════════════════════════════════════════════════════
// CaissePro — Application Entry Point (Orchestrator)
// ═══════════════════════════════════════════════════════════════
import React,{useState,useEffect,useCallback} from "react";
import AppProvider from "./context.jsx";
import { ErrorBoundary, ToastContainer } from "./ui.jsx";
import { AppContent } from "./nav.jsx";
import { C } from "./constants.jsx";

/* ══════════ Manual Payment Confirmation Modal ══════════ */
function ManualPaymentModal(){
  const[req,setReq]=useState(null);
  useEffect(()=>{
    const handler=(e)=>setReq(e.detail);
    window.addEventListener('caissepro:payment-manual',handler);
    return()=>window.removeEventListener('caissepro:payment-manual',handler);
  },[]);
  const confirm=useCallback(()=>{
    if(req?.resolve)req.resolve({success:true,status:'approved',authCode:'MANUAL',manual:true});
    setReq(null);
  },[req]);
  const cancel=useCallback(()=>{
    if(req?.resolve)req.resolve({success:false,status:'cancelled',error:'Annule par le caissier'});
    setReq(null);
  },[req]);
  if(!req)return null;
  return(<div style={{position:'fixed',inset:0,zIndex:99998,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeIn 0.2s ease-out'}}>
    <div style={{background:'#fff',borderRadius:20,padding:32,maxWidth:420,width:'90%',boxShadow:'0 24px 48px rgba(0,0,0,0.2)',animation:'modalPop 0.25s ease-out'}}>
      <div style={{textAlign:'center',marginBottom:24}}>
        <div style={{width:56,height:56,borderRadius:16,background:C.primary+'15',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        </div>
        <h3 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:8}}>{req.type||'Paiement'}</h3>
        <div style={{fontSize:36,fontWeight:800,color:C.primary,marginBottom:8}}>{(req.amount||0).toFixed(2)} EUR</div>
        <p style={{color:C.textLight,fontSize:14,lineHeight:1.5}}>{req.message||'Effectuez le paiement sur le TPE puis confirmez'}</p>
      </div>
      <div style={{display:'flex',gap:12}}>
        <button onClick={cancel} style={{flex:1,padding:'14px 20px',borderRadius:12,border:`1px solid ${C.border}`,background:'#fff',color:C.textLight,fontWeight:600,fontSize:15,cursor:'pointer'}}>Annuler</button>
        <button onClick={confirm} style={{flex:2,padding:'14px 20px',borderRadius:12,border:'none',background:C.primary,color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer',boxShadow:`0 4px 12px ${C.primary}40`}}>Confirmer le paiement</button>
      </div>
    </div>
  </div>);
}

/* ══════════ APP ══════════ */
export default function App(){
  return(<ErrorBoundary><AppProvider><AppContent/><ToastContainer/><ManualPaymentModal/>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}
      :root{--cart-w:380px;--nav-w:72px;--bottomnav-h:0px;--tap:44px;--pad:20px;--pad-sm:14px;--gap:14px;--gap-sm:10px;--radius:14px;--radius-sm:10px;--card-min:155px;--font-base:13px;--topbar-pad:12px 20px;--cart-pad:16px 20px 12px;--cart-item-pad:12px;--total-pad:16px;--btn-h:52px;--btn-font:14px}
      html,body,#root{height:100%;min-height:100vh;background:${C.bg}}
      body{font-family:'DM Sans',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:${C.text};font-size:var(--font-base);letter-spacing:-0.01em}
      ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.borderDark};border-radius:4px}::-webkit-scrollbar-thumb:hover{background:${C.textLight}}
      @keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}
      @keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}
      @keyframes slideUp{from{transform:translateY(100%);opacity:0.5}to{transform:translateY(0);opacity:1}}
      @keyframes slideInLeft{from{transform:translateX(-100%)}to{transform:translateX(0)}}
      @keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
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
      @media (max-width:1024px){.hide-md{display:none!important}}
      @media (max-width:1366px){:root{--cart-w:340px;--pad:16px;--pad-sm:12px;--gap:10px;--gap-sm:8px;--card-min:140px;--font-base:12px;--topbar-pad:10px 16px;--cart-pad:12px 16px 10px;--cart-item-pad:10px;--total-pad:12px;--btn-h:46px;--btn-font:13px}}
      @media (max-width:1024px){:root{--cart-w:300px;--nav-w:64px;--pad:14px;--pad-sm:10px;--gap:10px;--gap-sm:6px;--radius:10px;--radius-sm:8px;--card-min:130px;--font-base:12px;--topbar-pad:8px 14px;--cart-pad:10px 14px 8px;--cart-item-pad:9px;--total-pad:10px;--btn-h:48px;--btn-font:13px}}
      /* ── Téléphone : nav passe en bas, panier en panneau plein écran ── */
      @media (max-width:640px){:root{--cart-w:100%;--nav-w:0px;--bottomnav-h:60px;--pad:12px;--pad-sm:10px;--gap:10px;--gap-sm:8px;--radius:14px;--radius-sm:10px;--card-min:150px;--font-base:13px;--topbar-pad:10px 12px;--cart-pad:14px 14px 10px;--cart-item-pad:12px;--total-pad:14px;--btn-h:52px;--btn-font:15px}
        input,select,textarea{font-size:16px!important}/* évite le zoom auto iOS sur focus */
        /* ── Tableaux → cartes empilées (.rtable) ── */
        .rtable thead{display:none}
        .rtable,.rtable tbody,.rtable tr,.rtable td{display:block;width:100%}
        .rtable tr{border:1px solid ${C.border};border-radius:12px;margin:0 0 10px;padding:8px 12px;background:${C.surface};box-shadow:0 1px 3px ${C.shadow}}
        .rtable td{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:6px 0!important;border:0!important;text-align:right;min-height:0}
        .rtable td::before{content:attr(data-label);font-weight:600;color:${C.textMuted};font-size:11px;text-align:left;white-space:nowrap;flex-shrink:0}
        .rtable td:first-child{text-align:left;font-size:15px;font-weight:700;border-bottom:1px solid ${C.border}!important;padding-bottom:8px!important;margin-bottom:4px}
        .rtable td:first-child::before{display:none}
        .rtable td:empty{display:none}}
      @media (max-width:380px){:root{--card-min:130px}}`}</style>
  </AppProvider></ErrorBoundary>);
}
