import React, { useState, useMemo, useEffect, useCallback } from "react";
import { CreditCard, Banknote, Lock, Receipt, RotateCcw, TrendingUp, AlertTriangle, Archive, Printer, Calendar } from "lucide-react";
import * as API from "../api.js";
import printer from "../printer.js";
import { CO, C } from "../constants.jsx";
import { Modal, Btn, Input, SC } from "../ui.jsx";
import { useApp } from "../context.jsx";
import { dayKey } from "../lib/dates.js";
import { formatAmount, libelleCloture } from "../lib/formatters.js";

function ClosureScreen(){
  const{tickets,cashReg,closures,createClosure,gt,closeReg,perm:p,avoirs,settings,printerConnected,thermalPrint,notify,trainingMode,mode,cashMovements,pendingSync}=useApp();
  const[aCash,setACash]=useState("");const[aCard,setACard]=useState("");
  const[reportModal,setReportModal]=useState(null);
  const[denomMode,setDenomMode]=useState(false);
  const bills=[500,200,100,50,20,10,5];const coins=[2,1,0.5,0.2,0.1,0.05,0.02,0.01];
  const[denomCounts,setDenomCounts]=useState(()=>{const o={};[...bills,...coins].forEach(d=>o[d]=0);return o;});
  const denomTotal=useMemo(()=>Object.entries(denomCounts).reduce((s,[d,c])=>s+parseFloat(d)*c,0),[denomCounts]);
  const setDenom=(d,v)=>{setDenomCounts(p=>({...p,[d]:Math.max(0,parseInt(v)||0)}));};
  useEffect(()=>{if(denomMode)setACash(denomTotal.toFixed(2));},[denomMode,denomTotal]);
  // Journées de vente pas encore clôturées : si la caisse n'a pas été fermée la veille,
  // la clôture doit porter sur CETTE journée-là, pas sur aujourd'hui (Z à 0,00 €).
  const[pending,setPending]=useState(null);
  const chargerPending=useCallback(()=>{API.fiscal.pendingClosures().then(setPending).catch(()=>setPending(null));},[]);
  useEffect(()=>{chargerPending();},[chargerPending,closures.length]);
  if(!p().canCloseZ)return<div style={{padding:40,textAlign:"center",color:C.textMuted}}>Accès réservé aux administrateurs</div>;
  // Journée LOCALE, mode formation exclu (le Z serveur l'exclut : l'aperçu doit dire pareil)
  const aujourdhui=dayKey();
  const enAttente=(pending?.days||[]);
  // Journée que le Z principal clôture (avec le comptage du tiroir) : aujourd'hui, ou la
  // DERNIÈRE journée non clôturée si elle est récente (fermeture le lendemain matin, week-end).
  // Les journées plus anciennes oubliées (ex. 12 mai) ne prennent JAMAIS le comptage du jour :
  // elles se clôturent à part, une par une, en Z tardif (sans comptage).
  const ecartJours=(d)=>Math.round((new Date(`${aujourdhui}T12:00:00`)-new Date(`${d}T12:00:00`))/86400000);
  const derniere=enAttente[enAttente.length-1];
  const today=derniere&&ecartJours(derniere.day)<=4?derniere.day:aujourdhui;
  const enRetard=today!==aujourdhui;
  const ciblePending=enAttente.find(d=>d.day===today);
  const anciennes=enAttente.filter(d=>d.day!==today&&d.day<today);
  // Z mensuel / annuel. Si la période a déjà un Z fait AVANT sa fin (ex. Z d'octobre fait le
  // 08/10/2026), le serveur ne refait pas le mois : il propose un Z COMPLÉMENTAIRE qui couvre
  // uniquement les ventes postérieures à ce Z. Le premier Z reste tel quel (immuable).
  const clotureAvecComplement=async(type)=>{
    let cl=await createClosure(type,null,null);
    if(cl?.complementPossible){
      const quand=cl.previousAt?new Date(cl.previousAt).toLocaleString("fr-FR"):"?";
      if(!confirm(`${cl.message}\n\nUn Z ${type==="monthly"?"mensuel":"annuel"} a déjà été fait le ${quand}, AVANT la fin de la période : les ventes faites ensuite ne sont couvertes par aucun Z ${type==="monthly"?"mensuel":"annuel"}.\n\nFaire un Z COMPLÉMENTAIRE couvrant les ventes postérieures au ${quand} ?\n(Le premier Z reste inchangé. Opération définitive, NF525.)`))return;
      cl=await createClosure(type,null,null,null,{complement:true});
    }
    if(cl&&!cl.complementPossible)setReportModal(cl);};
  const zTardif=async(d)=>{
    if(!confirm(`Z tardif du ${fmtJour(d.day)} : ${d.ticket_count} ticket(s), ${Number(d.total_ttc).toFixed(2)} € TTC.\n\nCette journée n'avait jamais été clôturée. Le Z est définitif (NF525) et sera daté d'aujourd'hui, sans comptage du tiroir. Continuer ?`))return;
    const cl=await createClosure("daily",null,null,d.day);chargerPending();if(cl)setReportModal(cl);};
  const fmtJour=(d)=>new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  const estFormation=(t)=>t.trainingMode||String(t.ticketNumber||t.ticket_number||"").match(/^(FACTICE|FORMATION)/);
  const pt=tickets.filter(t=>dayKey(new Date(t.date||t.createdAt||t.created_at||0))===today&&!estFormation(t));
  const todayAvoirs=avoirs.filter(a=>dayKey(new Date(a.date||a.createdAt||0))===today);
  const todayAvoirsRembourses=(mode)=>todayAvoirs.filter(a=>(a.refundMethod||a.refund_method)===mode).reduce((s,a)=>s+(Number(a.totalTTC??a.total_ttc)||0),0);
  const somme=(methodes)=>pt.reduce((s,t)=>s+(t.payments?.filter(p=>methodes.includes(p.method)).reduce((a,p)=>a+Number(p.amount||0),0)||0),0);
  const cash=somme(["cash"]);
  // « Carte » = CB + Amex + sans-contact, comme le TPE et le Z
  // Carte attendue au TPE = encaissements carte − remboursements carte du jour
  const remboursCarte=todayAvoirsRembourses("card");
  const card=Math.round((somme(["card","amex","contactless"])-remboursCarte)*100)/100;
  const cheque=somme(["cheque"]);
  const giftcard=somme(["giftcard"]);
  const totalTTC=pt.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0);const totalHT=pt.reduce((s,t)=>s+(t.totalHT||parseFloat(t.total_ht)||0),0);
  const totalTVA=pt.reduce((s,t)=>s+(t.totalTVA||parseFloat(t.total_tva)||0),0);const totalMargin=pt.reduce((s,t)=>s+(parseFloat(t.margin)||0),0);
  const totalReturns=todayAvoirs.reduce((s,a)=>s+(a.totalTTC||parseFloat(a.total_ttc)||0),0);
  // Espèces attendues = fond d'ouverture + encaissements + apports − prélèvements du jour,
  // exactement la formule du Z serveur (sinon l'écart affiché avant et après diffère).
  const mvtsJour=(cashMovements||[]).filter(m=>dayKey(new Date(m.date||m.created_at||0))===today);
  const apports=mvtsJour.filter(m=>(m.direction||m.kind)==="in").reduce((s,m)=>s+Number(m.amount||0),0);
  const prelevements=mvtsJour.filter(m=>(m.direction||m.kind)==="out").reduce((s,m)=>s+Number(m.amount||0),0);
  const expected=Math.round(((cashReg?.openingAmount||0)+cash+apports-prelevements)*100)/100;
  const cashDiff=aCash?(parseFloat(aCash)-expected):null;
  const cardDiff=aCard?(parseFloat(aCard)-card):null;

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    {enRetard&&<div style={{background:C.warnLight,border:`2px solid ${C.warn}`,borderRadius:12,padding:14,marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:800,color:"#92400E",marginBottom:4}}>
        Journée non clôturée : {fmtJour(today)}</div>
      <div style={{fontSize:12,color:"#92400E",lineHeight:1.5}}>
        {ciblePending?.ticket_count} ticket(s) — {Number(ciblePending?.total_ttc||0).toFixed(2)} € TTC. La clôture ci‑dessous
        porte sur <b>cette journée</b>, pas sur aujourd'hui. Comptez le tiroir tel qu'il était à la fermeture.</div></div>}
    {/* Z mensuel du mois terminé encore à faire (ou à compléter) : signalé par le serveur, mêmes
        règles que le contrôle d'instance (mise en service, Z fait trop tôt). */}
    {pending?.monthly&&<div data-testid="z-mensuel-attente" style={{background:C.fiscalLight||"#FFF7ED",border:`1px solid ${C.fiscal}`,borderRadius:12,padding:14,marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:200}}>
        <div style={{fontSize:13,fontWeight:800}}>{pending.monthly.complement?"Z mensuel complémentaire à faire":"Z mensuel à faire"} — {new Date(`${pending.monthly.periode}-15T12:00:00`).toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</div>
        <div style={{fontSize:11,color:C.textMuted}}>{pending.monthly.ventes} vente(s) {pending.monthly.complement?"postérieures au Z mensuel déjà fait":"non couvertes par un Z mensuel"}</div>
      </div>
      <Btn onClick={async()=>{if(!confirm(`Clôture mensuelle de ${pending.monthly.periode} ?\n\nOpération définitive (NF525).`))return;await clotureAvecComplement("monthly");chargerPending();}} style={{height:36,fontSize:11}}><Calendar size={14}/> Faire le Z mensuel</Btn>
    </div>}
    {anciennes.length>0&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:800,marginBottom:4}}>Anciennes journées jamais clôturées ({anciennes.length})</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:8,lineHeight:1.5}}>
        Ces journées n'ont pas de Z. Elles n'empêchent pas de clôturer aujourd'hui. Clôturez‑les une par une
        (Z tardif, sans comptage du tiroir) — à valider avec votre expert‑comptable.</div>
      {anciennes.map(d=><div key={d.day} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderTop:`1px solid ${C.border}`,fontSize:12}}>
        <span style={{flex:1}}>{fmtJour(d.day)} {d.day.slice(0,4)} — {d.ticket_count} ticket(s), {Number(d.total_ttc).toFixed(2)} € TTC</span>
        <Btn variant="outline" onClick={()=>zTardif(d)} style={{height:30,fontSize:11}}>Z tardif</Btn></div>)}
    </div>}
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:14}}>Clôture Z</h2>
    {trainingMode&&<div style={{background:"#FEF3C7",border:"2px dashed #D97706",borderRadius:12,padding:12,marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
      <AlertTriangle size={18} color="#D97706"/><div><div style={{fontSize:12,fontWeight:700,color:"#92400E"}}>MODE FORMATION ACTIF</div>
        <div style={{fontSize:10,color:"#B45309"}}>Les tickets FACTICE ne sont pas inclus dans les totaux reels.</div></div></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>
      <SC icon={Receipt} label="Tickets" value={pt.length} color={C.info}/>
      <SC icon={Banknote} label="Espèces" value={`${cash.toFixed(2)}€`} color={C.primary}/>
      <SC icon={CreditCard} label="Carte" value={`${card.toFixed(2)}€`} color={C.info}/>
      {mode!=="cashier"&&<SC icon={TrendingUp} label="Marge" value={`${formatAmount(totalMargin)}€`} color="#059669"/>}
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
              <span style={{fontSize:9,color:C.textMuted,marginLeft:"auto"}}>{formatAmount(d*(denomCounts[d]||0))}€</span>
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
        // Ventes hors-ligne pas encore reçues par le serveur : le Z les oublierait.
        const ventesEnFile=(pendingSync||[]).filter(a=>a.type==="offlineSale").length;
        if(ventesEnFile){notify(`${ventesEnFile} vente(s) hors-ligne pas encore envoyée(s) au serveur : attendez la synchronisation (connexion internet) avant de clôturer.`,"error");return;}
        // Journée visée déjà clôturée ? (par PÉRIODE, jamais par date de création du Z)
        if(closures.some(c=>c.type==="daily"&&String(c.period||"").slice(0,10)===today)){
          notify(`La journée du ${today.split("-").reverse().join("/")} est déjà clôturée`,"error");return;}
        // Also verify server-side to prevent multi-tab/device duplicates
        try{const serverClosures=await API.fiscal.closures();
          if(serverClosures?.some(c=>c.closure_type==="daily"&&(c.period||c.created_at||"").startsWith(todayStr))){
            notify("Une clôture Z existe déjà sur le serveur pour aujourd'hui","error");return;}
        }catch(e){/* offline — local check is our best guard */}
        const cl=await createClosure("daily",aCash?parseFloat(aCash):null,aCard?parseFloat(aCard):null,today);chargerPending();if(cl){closeReg(aCash?parseFloat(aCash):null,aCard?parseFloat(aCard):null,{ticketCount:cl.ticketCount,totalHT:cl.totalHT,totalTVA:cl.totalTVA,totalTTC:cl.totalTTC,byPayment:cl.byPayment,byPaymentCount:cl.byPaymentCount,tvaByRate:cl.tvaByRate,bySeller:cl.bySeller,byCategory:cl.byCategory,discounts:cl.discounts,cancellations:cl.cancellations,returns:cl.returns,itemCount:cl.itemCount,avgItemsPerSale:cl.avgItemsPerSale,avgBasketHT:cl.avgBasketHT,avgBasketTTC:cl.avgBasketTTC,expectedCash:cl.expectedCash,cashIn:cl.cashIn,cashOut:cl.cashOut,returnCount:cl.returns?.count??todayAvoirs.length,totalReturns:cl.returns?.totalTTC??totalReturns,netRevenue:(cl.totalTTC||0)-(cl.returns?.totalTTC??totalReturns),grandTotal:cl.grandTotal});setReportModal(cl);}else{notify("Erreur lors de la clôture","danger");}}}
        style={{width:"100%",height:44,marginBottom:8}}><Lock size={16}/> Clôture journalière (Z)</Btn>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <Btn variant="outline" onClick={async()=>{const d=new Date();const mp=new Date(d.getFullYear(),d.getMonth()-1,1);
          // Z mensuel = mois PRECEDENT, termine (le serveur le garantit). Irreversible (NF525) : confirmation.
          if(!confirm(`Clôture mensuelle de ${mp.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})} ?\n\nOpération définitive (NF525). À faire une fois le mois terminé, après le dernier Z journalier.`))return;
          await clotureAvecComplement("monthly");}} style={{height:36,fontSize:11}}><Calendar size={14}/> Clôture mensuelle</Btn>
        <Btn variant="outline" onClick={async()=>{const an=new Date().getFullYear()-1;
          if(!confirm(`Clôture annuelle de l'exercice ${an} ?\n\nOpération définitive (NF525). À faire une fois l'année terminée et le Z mensuel de décembre effectué.`))return;
          await clotureAvecComplement("annual");}} style={{height:36,fontSize:11}}><Archive size={14}/> Clôture annuelle</Btn>
      </div></div>

    {/* Closure history */}
    <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Historique des clôtures ({closures.length})</div>
    {closures.map(c=>(<div key={c.id} onClick={()=>setReportModal(c)} style={{display:"flex",alignItems:"center",gap:10,padding:8,borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,marginBottom:4,cursor:"pointer"}}>
      <Archive size={12} color={C.fiscal}/>
      <span style={{fontSize:11,fontWeight:700,flex:1}}>Z {c.type==="daily"?"Journalière":c.type==="monthly"?"Mensuelle":"Annuelle"}{c.complementIndex>0?` complémentaire ${c.complementIndex}`:""} — {c.period} ({c.ticketCount} tickets)</span>
      <span style={{fontSize:10,color:C.textMuted}}>{new Date(c.date).toLocaleString("fr-FR")}</span>
      <span style={{fontSize:12,fontWeight:700,color:C.primary}}>{(c.totalTTC||0).toFixed(2)}€</span></div>))}

    {/* Closure detail/print modal */}
    <Modal open={!!reportModal} onClose={()=>setReportModal(null)} title={`Rapport Z — ${reportModal?.period}`} wide>
      {reportModal&&<div data-print-receipt data-doc="closure" style={{fontFamily:"'Courier New',monospace",fontSize:10,background:"#FAFAF8",borderRadius:10,padding:20,border:`1px solid ${C.border}`}}>
        <div style={{textAlign:"center",marginBottom:8}}>
          <div style={{fontSize:14,fontWeight:700}}>RAPPORT DE CLÔTURE</div>
          <div style={{fontSize:12,fontWeight:700}}>{settings.name||CO.name}</div>
          <div>{settings.address||CO.address}, {settings.postalCode||CO.postalCode} {settings.city||CO.city}</div>
          <div>SIRET: {settings.siret||CO.siret}</div></div>
        <div style={{borderTop:"2px solid #333",margin:"6px 0"}}/>
        {(()=>{const lib=libelleCloture(reportModal);return<>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Type</span><span style={{fontWeight:700}}>{lib.titre}</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Période</span><span>{lib.periode}</span></div>
        {lib.detail&&<div style={{fontWeight:700}}>{lib.detail}</div>}</>;})()}
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
        <div style={{fontWeight:700,marginBottom:4}}>CA PAR VENDEUR (HT)</div>
        {reportModal.bySeller&&Object.entries(reportModal.bySeller).map(([name,amount])=>(
          <div key={name} style={{display:"flex",justifyContent:"space-between"}}><span>{name}</span><span>{amount.toFixed(2)}€</span></div>))}
        <div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
        <div style={{fontWeight:700,marginBottom:4}}>CONTRÔLE CAISSE</div>
        {/* Détail = formule du Z. Avant, « Fond de caisse ouverture » affichait en réalité
            apports − prélèvements (0,00 € les jours sans mouvement). */}
        {reportModal.expectedCash!=null&&(reportModal.openingFloat!=null
          ?<div style={{display:"flex",justifyContent:"space-between"}}><span>Fond de caisse ouverture</span><span>{Number(reportModal.openingFloat).toFixed(2)}€</span></div>
          :<div style={{display:"flex",justifyContent:"space-between"}}><span>Fond + mouvements de tiroir</span><span>{(reportModal.expectedCash-(reportModal.byPayment?.cash||0)).toFixed(2)}€</span></div>)}
        {reportModal.expectedCash!=null&&<div style={{display:"flex",justifyContent:"space-between"}}><span>+ Encaissements espèces</span><span>{(reportModal.byPayment?.cash||0).toFixed(2)}€</span></div>}
        {reportModal.openingFloat!=null&&Number(reportModal.cashIn)>0&&<div style={{display:"flex",justifyContent:"space-between"}}><span>+ Apports</span><span>{Number(reportModal.cashIn).toFixed(2)}€</span></div>}
        {reportModal.openingFloat!=null&&Number(reportModal.cashOut)>0&&<div style={{display:"flex",justifyContent:"space-between"}}><span>− Prélèvements</span><span>{Number(reportModal.cashOut).toFixed(2)}€</span></div>}
        {reportModal.expectedCash!=null&&<div style={{display:"flex",justifyContent:"space-between",fontWeight:700}}><span>= Espèces attendues</span><span>{reportModal.expectedCash.toFixed(2)}€</span></div>}
        {reportModal.actualCash!=null&&<div style={{display:"flex",justifyContent:"space-between"}}><span>Espèces comptées</span><span>{reportModal.actualCash.toFixed(2)}€</span></div>}
        {reportModal.actualCash!=null&&reportModal.expectedCash!=null&&<div style={{display:"flex",justifyContent:"space-between",color:Math.abs(reportModal.actualCash-reportModal.expectedCash)<0.01?"#059669":C.danger,fontWeight:700}}>
          <span>Écart espèces</span><span>{(reportModal.actualCash-reportModal.expectedCash)>=0?"+":""}{(reportModal.actualCash-reportModal.expectedCash).toFixed(2)}€</span></div>}
        {reportModal.actualCard!=null&&<><div style={{display:"flex",justifyContent:"space-between"}}><span>CB attendues</span><span>{(reportModal.byPayment?.card||0).toFixed(2)}€</span></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>CB comptées</span><span>{parseFloat(reportModal.actualCard).toFixed(2)}€</span></div>
          <div style={{display:"flex",justifyContent:"space-between",color:Math.abs(parseFloat(reportModal.actualCard)-(reportModal.byPayment?.card||0))<0.01?"#059669":C.danger,fontWeight:700}}>
            <span>Écart CB</span><span>{(parseFloat(reportModal.actualCard)-(reportModal.byPayment?.card||0))>=0?"+":""}{(parseFloat(reportModal.actualCard)-(reportModal.byPayment?.card||0)).toFixed(2)}€</span></div></>}
        {/* Retours de la PÉRIODE du Z (calculés par le serveur). Avant, un Z rouvert depuis
            l'historique affichait les retours du jour courant. */}
        {(()=>{const r=reportModal.returns;const nb=r?Number(r.count)||0:todayAvoirs.length;
          const tot=r?Number(r.totalTTC)||0:totalReturns;
          return(<>{(tot>0||nb>0)&&<><div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
            <div style={{fontWeight:700,marginBottom:4}}>RETOURS / AVOIRS</div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span>Nombre d'avoirs</span><span>{nb}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",color:C.danger}}><span>Total retours</span><span>-{tot.toFixed(2)}€</span></div></>}
          <div style={{borderTop:"2px solid #333",margin:"6px 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:11}}><span>CA NET (TTC - Retours)</span><span>{((reportModal.totalTTC||0)-tot).toFixed(2)}€</span></div></>);})()}
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
