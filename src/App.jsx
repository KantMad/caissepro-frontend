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
