import React, { useState, useMemo, useEffect } from "react";
import { CreditCard, Banknote, Lock, Receipt, RotateCcw, TrendingUp, AlertTriangle, Archive, Printer, Calendar } from "lucide-react";
import * as API from "../api.js";
import printer from "../printer.js";
import { CO, C } from "../constants.jsx";
import { Modal, Btn, Input, SC } from "../ui.jsx";
import { useApp } from "../context.jsx";

function ClosureScreen(){
  const{tickets,cashReg,closures,createClosure,gt,closeReg,perm:p,avoirs,settings,printerConnected,thermalPrint,notify,trainingMode,mode}=useApp();
  const[aCash,setACash]=useState("");const[aCard,setACard]=useState("");
  const[reportModal,setReportModal]=useState(null);
  const[denomMode,setDenomMode]=useState(false);
  const bills=[500,200,100,50,20,10,5];const coins=[2,1,0.5,0.2,0.1,0.05,0.02,0.01];
  const[denomCounts,setDenomCounts]=useState(()=>{const o={};[...bills,...coins].forEach(d=>o[d]=0);return o;});
  const denomTotal=useMemo(()=>Object.entries(denomCounts).reduce((s,[d,c])=>s+parseFloat(d)*c,0),[denomCounts]);
  const setDenom=(d,v)=>{setDenomCounts(p=>({...p,[d]:Math.max(0,parseInt(v)||0)}));};
  useEffect(()=>{if(denomMode)setACash(denomTotal.toFixed(2));},[denomMode,denomTotal]);
  if(!p().canCloseZ)return<div style={{padding:40,textAlign:"center",color:C.textMuted}}>Accès réservé aux administrateurs</div>;
  const today=new Date().toISOString().split("T")[0];const pt=tickets.filter(t=>(t.date||t.createdAt||t.created_at||"").startsWith(today));
  const todayAvoirs=avoirs.filter(a=>(a.date||a.createdAt||"").startsWith(today));
  const cash=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="cash").reduce((a,p)=>a+p.amount,0)||0),0);
  const card=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="card").reduce((a,p)=>a+p.amount,0)||0),0);
  const cheque=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="cheque").reduce((a,p)=>a+p.amount,0)||0),0);
  const giftcard=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="giftcard").reduce((a,p)=>a+p.amount,0)||0),0);
  const totalTTC=pt.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0);const totalHT=pt.reduce((s,t)=>s+(t.totalHT||parseFloat(t.total_ht)||0),0);
  const totalTVA=pt.reduce((s,t)=>s+(t.totalTVA||parseFloat(t.total_tva)||0),0);const totalMargin=pt.reduce((s,t)=>s+(parseFloat(t.margin)||0),0);
  const totalReturns=todayAvoirs.reduce((s,a)=>s+(a.totalTTC||parseFloat(a.total_ttc)||0),0);
  const expected=(cashReg?.openingAmount||0)+cash;
  const cashDiff=aCash?(parseFloat(aCash)-expected):null;
  const cardDiff=aCard?(parseFloat(aCard)-card):null;

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:14}}>Clôture Z</h2>
    {trainingMode&&<div style={{background:"#FEF3C7",border:"2px dashed #D97706",borderRadius:12,padding:12,marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
      <AlertTriangle size={18} color="#D97706"/><div><div style={{fontSize:12,fontWeight:700,color:"#92400E"}}>MODE FORMATION ACTIF</div>
        <div style={{fontSize:10,color:"#B45309"}}>Les tickets FACTICE ne sont pas inclus dans les totaux reels.</div></div></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>
      <SC icon={Receipt} label="Tickets" value={pt.length} color={C.info}/>
      <SC icon={Banknote} label="Espèces" value={`${cash.toFixed(2)}€`} color={C.primary}/>
      <SC icon={CreditCard} label="Carte" value={`${card.toFixed(2)}€`} color={C.info}/>
      {mode!=="cashier"&&<SC icon={TrendingUp} label="Marge" value={`${totalMargin.toFixed(0)}€`} color="#059669"/>}
      <SC icon={RotateCcw} label="Retours" value={`-${totalReturns.toFixed(2)}€`} color={C.danger}/></div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      <div style={{background:C.fiscalLight,borderRadius:10,padding:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:700,color:C.fiscal}}>GT PERPÉTUEL</span>
        <span style={{fontSize:18,fontWeight:800,color:C.fiscal}}>{gt.toFixed(2)}€</span></div>
      <div style={{background:C.primaryLight,borderRadius:10,padding:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:700,color:C.primary}}>CA NET DU JOUR</span>
        <span style={{fontSize:18,fontWeight:800,color:C.primary}}>{(totalTTC-totalReturns).toFixed(2)}€</span></div></div>

    <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <span style={{fontSize:14,fontWeight:700}}>Comptage espèces</span>
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          <button onClick={()=>setDenomMode(false)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${!denomMode?C.accent:C.border}`,background:!denomMode?C.accentLight:"transparent",
            cursor:"pointer",fontSize:11,fontWeight:600,color:!denomMode?C.accent:C.textMuted}}>Montant rapide</button>
          <button onClick={()=>{setDenomMode(true);const o={};[...bills,...coins].forEach(d=>o[d]=0);setDenomCounts(o);}} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${denomMode?C.accent:C.border}`,background:denomMode?C.accentLight:"transparent",
            cursor:"pointer",fontSize:11,fontWeight:600,color:denomMode?C.accent:C.textMuted}}>Compter les coupures</button></div></div>

      {denomMode?<>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,marginBottom:6}}>BILLETS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {bills.map(d=>(<div key={d} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 8px",borderRadius:10,border:`1.5px solid ${denomCounts[d]>0?C.accent:C.border}`,background:denomCounts[d]>0?C.accentLight+"60":"transparent"}}>
              <span style={{fontSize:10,fontWeight:700,color:C.accent,minWidth:36}}>{d}€</span>
              <span style={{fontSize:9,color:C.textMuted}}>×</span>
              <input type="number" min="0" value={denomCounts[d]||""} onChange={e=>setDenom(d,e.target.value)}
                style={{width:40,padding:"3px 4px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontWeight:700,textAlign:"center",fontFamily:"inherit"}}/>
              <span style={{fontSize:9,color:C.textMuted,marginLeft:"auto"}}>{(d*(denomCounts[d]||0)).toFixed(0)}€</span>
            </div>))}</div></div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,marginBottom:6}}>PIÈCES</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {coins.map(d=>(<div key={d} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 8px",borderRadius:10,border:`1.5px solid ${denomCounts[d]>0?C.info:C.border}`,background:denomCounts[d]>0?`${C.info}10`:"transparent"}}>
              <span style={{fontSize:10,fontWeight:700,color:C.info,minWidth:36}}>{d>=1?d+"€":(d*100).toFixed(0)+"c"}</span>
              <span style={{fontSize:9,color:C.textMuted}}>×</span>
              <input type="number" min="0" value={denomCounts[d]||""} onChange={e=>setDenom(d,e.target.value)}
                style={{width:40,padding:"3px 4px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontWeight:700,textAlign:"center",fontFamily:"inherit"}}/>
              <span style={{fontSize:9,color:C.textMuted,marginLeft:"auto"}}>{(d*(denomCounts[d]||0)).toFixed(2)}€</span>
            </div>))}</div></div>
        <div style={{background:C.accentLight,borderRadius:14,padding:14,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${C.accent}22`}}>
          <span style={{fontSize:14,fontWeight:700,color:C.accent}}>Total coupures</span>
          <span style={{fontSize:22,fontWeight:900,color:C.accent}}>{denomTotal.toFixed(2)}€</span></div>
        <div style={{fontSize:11,fontWeight:600,marginBottom:10,padding:"6px 10px",borderRadius:8,
          background:Math.abs(denomTotal-expected)<0.01?C.primaryLight:C.dangerLight,
          color:Math.abs(denomTotal-expected)<0.01?"#059669":C.danger}}>
          Écart vs attendu ({expected.toFixed(2)}€): {(denomTotal-expected)>=0?"+":""}{(denomTotal-expected).toFixed(2)}€ {Math.abs(denomTotal-expected)<0.01?"✓ OK":"⚠ Attention"}</div>
      </>:<>
        <div style={{marginBottom:10}}><label style={{fontSize:9,fontWeight:600,color:C.textMuted}}>ESPÈCES COMPTÉES (attendu: {expected.toFixed(2)}€)</label>
          <Input type="number" step="0.01" value={aCash} onChange={e=>setACash(e.target.value)} placeholder={expected.toFixed(2)}/>
          {cashDiff!==null&&<div style={{fontSize:10,fontWeight:600,marginTop:3,color:Math.abs(cashDiff)<0.01?"#059669":C.danger}}>
            Écart: {cashDiff>=0?"+":""}{cashDiff.toFixed(2)}€ {Math.abs(cashDiff)<0.01?"(OK)":"(attention)"}</div>}</div>
      </>}
      <div style={{marginBottom:12}}>
        <label style={{fontSize:9,fontWeight:600,color:C.textMuted}}>CARTE COMPTÉE (attendu: {card.toFixed(2)}€)</label>
        <Input type="number" step="0.01" value={aCard} onChange={e=>setACard(e.target.value)} placeholder={card.toFixed(2)}/>
        {cardDiff!==null&&<div style={{fontSize:10,fontWeight:600,marginTop:3,color:Math.abs(cardDiff)<0.01?"#059669":C.danger}}>
          Écart: {cardDiff>=0?"+":""}{cardDiff.toFixed(2)}€ {Math.abs(cardDiff)<0.01?"(OK)":"(attention)"}</div>}</div>
      <Btn variant="danger" onClick={async()=>{
        // M2 fix: check both local AND server for existing daily closure
        const todayStr=new Date().toISOString().split("T")[0];
        if(closures.some(c=>c.type==="daily"&&(c.period||c.date||c.created_at||"").startsWith(todayStr))){
          notify("Une clôture Z a déjà été faite aujourd'hui","error");return;}
        // Also verify server-side to prevent multi-tab/device duplicates
        try{const serverClosures=await API.fiscal.closures();
          if(serverClosures?.some(c=>c.closure_type==="daily"&&(c.period||c.created_at||"").startsWith(todayStr))){
            notify("Une clôture Z existe déjà sur le serveur pour aujourd'hui","error");return;}
        }catch(e){/* offline — local check is our best guard */}
        const cl=await createClosure("daily",aCash?parseFloat(aCash):null,aCard?parseFloat(aCard):null);if(cl){closeReg(aCash?parseFloat(aCash):null,aCard?parseFloat(aCard):null,{ticketCount:cl.ticketCount,totalHT:cl.totalHT,totalTVA:cl.totalTVA,totalTTC:cl.totalTTC,byPayment:cl.byPayment,expectedCash:cl.expectedCash,returnCount:todayAvoirs.length,totalReturns,netRevenue:(cl.totalTTC||0)-totalReturns,grandTotal:cl.grandTotal});setReportModal(cl);}else{notify("Erreur lors de la clôture","danger");}}}
        style={{width:"100%",height:44,marginBottom:8}}><Lock size={16}/> Clôture journalière (Z)</Btn>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <Btn variant="outline" onClick={async()=>{const cl=await createClosure("monthly",null,null);if(cl)setReportModal(cl);}} style={{height:36,fontSize:11}}><Calendar size={14}/> Clôture mensuelle</Btn>
        <Btn variant="outline" onClick={async()=>{const cl=await createClosure("annual",null,null);if(cl)setReportModal(cl);}} style={{height:36,fontSize:11}}><Archive size={14}/> Clôture annuelle</Btn>
      </div></div>

    {/* Closure history */}
    <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Historique des clôtures ({closures.length})</div>
    {closures.map(c=>(<div key={c.id} onClick={()=>setReportModal(c)} style={{display:"flex",alignItems:"center",gap:10,padding:8,borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,marginBottom:4,cursor:"pointer"}}>
      <Archive size={12} color={C.fiscal}/>
      <span style={{fontSize:11,fontWeight:700,flex:1}}>Z {c.type==="daily"?"Journalière":c.type==="monthly"?"Mensuelle":"Annuelle"} — {c.period} ({c.ticketCount} tickets)</span>
      <span style={{fontSize:10,color:C.textMuted}}>{new Date(c.date).toLocaleString("fr-FR")}</span>
      <span style={{fontSize:12,fontWeight:700,color:C.primary}}>{(c.totalTTC||0).toFixed(2)}€</span></div>))}

    {/* Closure detail/print modal */}
    <Modal open={!!reportModal} onClose={()=>setReportModal(null)} title={`Rapport Z — ${reportModal?.period}`} wide>
      {reportModal&&<div data-print-receipt style={{fontFamily:"'Courier New',monospace",fontSize:10,background:"#FAFAF8",borderRadius:10,padding:20,border:`1px solid ${C.border}`}}>
        <div style={{textAlign:"center",marginBottom:8}}>
          <div style={{fontSize:14,fontWeight:700}}>RAPPORT DE CLÔTURE</div>
          <div style={{fontSize:12,fontWeight:700}}>{settings.name||CO.name}</div>
          <div>{settings.address||CO.address}, {settings.postalCode||CO.postalCode} {settings.city||CO.city}</div>
          <div>SIRET: {settings.siret||CO.siret}</div></div>
        <div style={{borderTop:"2px solid #333",margin:"6px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Type</span><span style={{fontWeight:700}}>{reportModal.type==="daily"?"JOURNALIÈRE":reportModal.type==="monthly"?"MENSUELLE":"ANNUELLE"}</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Période</span><span>{reportModal.period}</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Date d'émission</span><span>{new Date(reportModal.date||reportModal.createdAt||"").toLocaleString("fr-FR")}</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Caissier</span><span>{reportModal.userName}</span></div>
        <div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
        <div style={{fontWeight:700,marginBottom:4}}>ACTIVITÉ</div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Nombre de tickets</span><span style={{fontWeight:700}}>{reportModal.ticketCount}</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Total HT</span><span>{(reportModal.totalHT||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Total TVA</span><span>{(reportModal.totalTVA||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:12}}><span>Total TTC</span><span>{(reportModal.totalTTC||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between",color:"#059669"}}><span>Marge brute</span><span>{(reportModal.totalMargin||0).toFixed(2)}€</span></div>
        <div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
        <div style={{fontWeight:700,marginBottom:4}}>VENTILATION PAIEMENTS</div>
        {reportModal.byPayment&&<>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>Espèces</span><span>{(reportModal.byPayment.cash||0).toFixed(2)}€</span></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>Carte bancaire</span><span>{(reportModal.byPayment.card||0).toFixed(2)}€</span></div>
          {(reportModal.byPayment.cheque||0)>0&&<div style={{display:"flex",justifyContent:"space-between"}}><span>Chèques</span><span>{reportModal.byPayment.cheque.toFixed(2)}€</span></div>}
          {(reportModal.byPayment.giftcard||0)>0&&<div style={{display:"flex",justifyContent:"space-between"}}><span>Cartes cadeaux</span><span>{reportModal.byPayment.giftcard.toFixed(2)}€</span></div>}
          {(reportModal.byPayment.amex||0)>0&&<div style={{display:"flex",justifyContent:"space-between"}}><span>American Express</span><span>{reportModal.byPayment.amex.toFixed(2)}€</span></div>}
          {(reportModal.byPayment.avoir||0)>0&&<div style={{display:"flex",justifyContent:"space-between"}}><span>Avoirs utilisés</span><span>{reportModal.byPayment.avoir.toFixed(2)}€</span></div>}
        </>}
        <div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
        <div style={{fontWeight:700,marginBottom:4}}>CA PAR VENDEUR</div>
        {reportModal.bySeller&&Object.entries(reportModal.bySeller).map(([name,amount])=>(
          <div key={name} style={{display:"flex",justifyContent:"space-between"}}><span>{name}</span><span>{amount.toFixed(2)}€</span></div>))}
        <div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
        <div style={{fontWeight:700,marginBottom:4}}>CONTRÔLE CAISSE</div>
        {reportModal.expectedCash!=null&&<div style={{display:"flex",justifyContent:"space-between"}}><span>Fond de caisse ouverture</span><span>{(reportModal.expectedCash-(reportModal.byPayment?.cash||0)).toFixed(2)}€</span></div>}
        {reportModal.expectedCash!=null&&<div style={{display:"flex",justifyContent:"space-between"}}><span>+ Encaissements espèces</span><span>{(reportModal.byPayment?.cash||0).toFixed(2)}€</span></div>}
        {reportModal.expectedCash!=null&&<div style={{display:"flex",justifyContent:"space-between",fontWeight:700}}><span>= Espèces attendues</span><span>{reportModal.expectedCash.toFixed(2)}€</span></div>}
        {reportModal.actualCash!=null&&<div style={{display:"flex",justifyContent:"space-between"}}><span>Espèces comptées</span><span>{reportModal.actualCash.toFixed(2)}€</span></div>}
        {reportModal.actualCash!=null&&reportModal.expectedCash!=null&&<div style={{display:"flex",justifyContent:"space-between",color:Math.abs(reportModal.actualCash-reportModal.expectedCash)<0.01?"#059669":C.danger,fontWeight:700}}>
          <span>Écart espèces</span><span>{(reportModal.actualCash-reportModal.expectedCash)>=0?"+":""}{(reportModal.actualCash-reportModal.expectedCash).toFixed(2)}€</span></div>}
        {reportModal.actualCard!=null&&<><div style={{display:"flex",justifyContent:"space-between"}}><span>CB attendues</span><span>{(reportModal.byPayment?.card||0).toFixed(2)}€</span></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>CB comptées</span><span>{parseFloat(reportModal.actualCard).toFixed(2)}€</span></div>
          <div style={{display:"flex",justifyContent:"space-between",color:Math.abs(parseFloat(reportModal.actualCard)-(reportModal.byPayment?.card||0))<0.01?"#059669":C.danger,fontWeight:700}}>
            <span>Écart CB</span><span>{(parseFloat(reportModal.actualCard)-(reportModal.byPayment?.card||0))>=0?"+":""}{(parseFloat(reportModal.actualCard)-(reportModal.byPayment?.card||0)).toFixed(2)}€</span></div></>}
        {(totalReturns>0||todayAvoirs.length>0)&&<><div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
          <div style={{fontWeight:700,marginBottom:4}}>RETOURS / AVOIRS</div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>Nombre d'avoirs</span><span>{todayAvoirs.length}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",color:C.danger}}><span>Total retours</span><span>-{totalReturns.toFixed(2)}€</span></div></>}
        <div style={{borderTop:"2px solid #333",margin:"6px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:11}}><span>CA NET (TTC - Retours)</span><span>{((reportModal.totalTTC||0)-(totalReturns||0)).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:12,marginTop:4}}><span>GRAND TOTAL PERPÉTUEL</span><span>{(reportModal.grandTotal||0).toFixed(2)}€</span></div>
        <div style={{textAlign:"center",background:C.fiscalLight,padding:8,borderRadius:6,margin:"8px 0"}}>
          <div style={{fontSize:8,color:C.fiscal,fontWeight:700}}>EMPREINTE NF525</div>
          <div style={{fontSize:11,fontWeight:700,color:C.fiscal,letterSpacing:2}}>{reportModal.fingerprint}</div></div>
        <div style={{textAlign:"center",fontSize:8,color:C.textMuted}}>{CO.sw} v{CO.ver} — Document non modifiable</div>
      </div>}
      {reportModal&&<Btn variant="outline" onClick={()=>thermalPrint("closure",reportModal)} style={{width:"100%",marginTop:10}}><Printer size={14}/> {printerConnected?"Ticket":"Imprimer le rapport"}</Btn>}
    </Modal>
  </div>);
}

/* ══════════ CUSTOMERS ══════════ */

export default ClosureScreen;
export { ClosureScreen };
