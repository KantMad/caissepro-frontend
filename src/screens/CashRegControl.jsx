import React, { useState } from "react";
import { Wallet, XCircle } from "lucide-react";
import { C } from "../constants.jsx";
import { Btn, Input } from "../ui.jsx";
import { useApp } from "../context.jsx";

function CashRegControl({onSkip,onDone}){
  const{currentUser,openReg}=useApp();const[a,setA]=useState("");const[denomMode,setDenomMode]=useState(false);
  const bills=[{v:500,l:"500€"},{v:200,l:"200€"},{v:100,l:"100€"},{v:50,l:"50€"},{v:20,l:"20€"},{v:10,l:"10€"},{v:5,l:"5€"}];
  const coins=[{v:2,l:"2€"},{v:1,l:"1€"},{v:0.50,l:"0.50€"},{v:0.20,l:"0.20€"},{v:0.10,l:"0.10€"},{v:0.05,l:"0.05€"},{v:0.02,l:"0.02€"},{v:0.01,l:"0.01€"}];
  const[denom,setDenom]=useState(()=>{const d={};bills.concat(coins).forEach(x=>d[x.v]=0);return d;});
  const denomTotal=Object.entries(denom).reduce((s,[v,n])=>s+parseFloat(v)*n,0);
  const quickAmounts=[50,100,150,200,300];
  return(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:denomMode?580:440,background:C.surface,borderRadius:20,padding:36,boxShadow:"0 20px 60px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)",transition:"width 0.3s",maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center"}}><Wallet size={22} color="#fff"/></div>
          <div><h1 style={{fontSize:20,fontWeight:700,margin:0,letterSpacing:"-0.4px"}}>Ouverture de caisse</h1>
            <p style={{color:C.textMuted,fontSize:12,margin:0}}>Bienvenue {currentUser?.name} — {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</p></div></div></div>

      <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:14}}>
        <button onClick={()=>setDenomMode(false)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${!denomMode?C.accent:C.border}`,background:!denomMode?C.accentLight:"transparent",
          cursor:"pointer",fontSize:11,fontWeight:600,color:!denomMode?C.accent:C.textMuted}}>Montant rapide</button>
        <button onClick={()=>setDenomMode(true)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${denomMode?C.accent:C.border}`,background:denomMode?C.accentLight:"transparent",
          cursor:"pointer",fontSize:11,fontWeight:600,color:denomMode?C.accent:C.textMuted}}>Compter les coupures</button></div>

      {!denomMode?<>
        <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.5px"}}>Fond de caisse (€)</label>
        <Input type="number" step="0.01" value={a} onChange={e=>setA(e.target.value)} placeholder="100.00" style={{marginBottom:8,height:48,fontSize:16,fontWeight:700,textAlign:"center"}}/>
        <div style={{display:"flex",gap:6,marginBottom:16,justifyContent:"center"}}>
          {quickAmounts.map(v=>(<button key={v} onClick={()=>setA(String(v))} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${a===String(v)?C.accent:C.border}`,background:a===String(v)?C.accentLight:"transparent",
            cursor:"pointer",fontSize:11,fontWeight:600,color:a===String(v)?C.accent:C.textMuted,transition:"all 0.12s"}}>{v}€</button>))}</div>
      </>:<>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,marginBottom:6}}>BILLETS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {bills.map(b=>(<div key={b.v} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 8px",borderRadius:10,border:`1.5px solid ${denom[b.v]>0?C.accent:C.border}`,background:denom[b.v]>0?C.accentLight+"60":"transparent"}}>
              <span style={{fontSize:10,fontWeight:700,color:C.accent,minWidth:36}}>{b.l}</span>
              <span style={{fontSize:9,color:C.textMuted}}>×</span>
              <input type="number" min="0" value={denom[b.v]||""} onChange={e=>{const n=parseInt(e.target.value)||0;setDenom(d=>({...d,[b.v]:n}));}}
                style={{width:40,padding:"3px 4px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontWeight:700,textAlign:"center",fontFamily:"inherit"}}/>
            </div>))}</div></div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,marginBottom:6}}>PIÈCES</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {coins.map(c=>(<div key={c.v} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 8px",borderRadius:10,border:`1.5px solid ${denom[c.v]>0?C.info:C.border}`,background:denom[c.v]>0?`${C.info}10`:"transparent"}}>
              <span style={{fontSize:10,fontWeight:700,color:C.info,minWidth:36}}>{c.l}</span>
              <span style={{fontSize:9,color:C.textMuted}}>×</span>
              <input type="number" min="0" value={denom[c.v]||""} onChange={e=>{const n=parseInt(e.target.value)||0;setDenom(d=>({...d,[c.v]:n}));}}
                style={{width:40,padding:"3px 4px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontWeight:700,textAlign:"center",fontFamily:"inherit"}}/>
            </div>))}</div></div>
        <div style={{background:C.accentLight,borderRadius:14,padding:14,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${C.accent}22`}}>
          <span style={{fontSize:14,fontWeight:700,color:C.accent}}>Total fond de caisse</span>
          <span style={{fontSize:22,fontWeight:900,color:C.accent}}>{denomTotal.toFixed(2)}€</span></div>
      </>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Btn variant="outline" onClick={onSkip} style={{height:48,borderRadius:12}}><XCircle size={14}/> Passer</Btn>
        <Btn onClick={()=>{const amt=denomMode?denomTotal:parseFloat(a);if(amt){openReg(amt,denomMode?denom:null);onDone();}}} disabled={denomMode?denomTotal===0:!a}
          style={{height:48,borderRadius:12,background:C.accent,boxShadow:(denomMode?denomTotal>0:a)?`0 4px 16px ${C.accent}33`:"none"}}><Wallet size={14}/> Ouvrir la caisse</Btn>
      </div></div></div>);
}


export default CashRegControl;
export { CashRegControl };
