import React, { useState } from "react";
import { Search, RotateCcw, Save, Check } from "lucide-react";
import { C } from "../constants.jsx";
import { Btn, Input, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";
import { getAvoirRemaining, formatAmount } from "../lib/formatters.js";

function ReturnsHistoryScreen(){
  const{avoirs,tickets,notify,settings,setSettings,saveSettingsToAPI,addAudit,isAvoirExpired}=useApp();
  const[filter,setFilter]=useState("all");const[search,setSearch]=useState("");
  const[tab,setTab]=useState(avoirs.length>0?"history":"settings");
  const sorted=[...avoirs].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const filtered=sorted.filter(a=>{
    if(filter==="avoir"&&a.refundMethod!=="avoir")return false;
    if(filter==="cash"&&a.refundMethod!=="cash")return false;
    if(filter==="card"&&a.refundMethod!=="card")return false;
    if(filter==="exchange"&&a.refundMethod!=="exchange")return false;
    if(search){const s=search.toLowerCase();return(a.avoirNumber||"").toLowerCase().includes(s)||(a.reason||"").toLowerCase().includes(s)||
      (a.originalTicket||"").toLowerCase().includes(s)||(a.customerName||"").toLowerCase().includes(s)||(a.barcode||"").includes(s)||
      (a.items||[]).some(it=>((it.product?.name||it.product_name||"").toLowerCase().includes(s)));}
    return true;
  });
  const totalReturns=avoirs.length;
  const totalValue=avoirs.reduce((s,a)=>s+(a.totalTTC||0),0);
  const totalItems=avoirs.reduce((s,a)=>s+(a.items||[]).reduce((ss,it)=>ss+(it.quantity||it.qty||1),0),0);
  const reasonStats={};avoirs.forEach(a=>{const r=a.reason||"Non spécifié";reasonStats[r]=(reasonStats[r]||0)+1;});
  const methodStats={};avoirs.forEach(a=>{const m=a.refundMethod||"avoir";methodStats[m]=(methodStats[m]||0)+1;});

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div><h2 style={{fontSize:22,fontWeight:800,margin:0}}>Retours & Avoirs</h2>
        <p style={{fontSize:12,color:C.textMuted,margin:0}}>Historique, statistiques et paramètres des retours</p></div></div>
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {[{id:"history",l:"📋 Historique"},{id:"settings",l:"⚙️ Paramètres retours"}].map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${tab===t.id?C.primary:C.border}`,
          background:tab===t.id?C.primary:"transparent",color:tab===t.id?"#fff":C.text,fontSize:12,fontWeight:600,cursor:"pointer"}}>{t.l}</button>))}
    </div>

    {tab==="settings"&&<div style={{maxWidth:600}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <RotateCcw size={20} color={C.primary}/>
          <div><h3 style={{fontSize:16,fontWeight:800,margin:0}}>Politique de retour</h3>
            <p style={{fontSize:11,color:C.textMuted,margin:0}}>Configurez les règles de retour et d'échange</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>DÉLAI DE RETOUR (jours)</label>
            <Input type="number" value={settings.returnPolicy?.days||30} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,days:parseInt(e.target.value)||30}}))}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MONTANT MAX SANS APPROBATION (EUR)</label>
            <Input type="number" value={settings.returnPolicy?.maxNoApproval||100} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,maxNoApproval:parseFloat(e.target.value)||100}}))}/></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>VALIDITE AVOIR (mois)</label>
            <Input type="number" value={settings.returnPolicy?.avoirExpiryMonths||12} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,avoirExpiryMonths:parseInt(e.target.value)||12}}))}/></div>
          <div/>
        </div>
        <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>CONDITIONS DE RETOUR</label>
          <textarea value={settings.returnPolicy?.conditions||""} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,conditions:e.target.value}}))}
            style={{width:"100%",height:60,padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit",resize:"vertical"}}
            placeholder="Article non porte, etiquette presente..."/></div>
        <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MOTIFS DE RETOUR PERSONNALISES (un par ligne)</label>
          <textarea value={(settings.returnPolicy?.reasons||[]).join("\n")} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,reasons:e.target.value.split("\n").filter(r=>r.trim())}}))}
            style={{width:"100%",height:80,padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit",resize:"vertical"}}
            placeholder={"Echange taille\nEchange couleur\nDefectueux\nN'aime plus\nCadeau a retourner\nErreur de commande\nAutre"}/></div>
      </div>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:10}}>Modes de remboursement autorisés</h4>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{k:"allowAvoir",l:"Avoir / Crédit magasin"},{k:"allowCashRefund",l:"Remboursement espèces"},
            {k:"allowCardRefund",l:"Remboursement carte"},{k:"allowExchange",l:"Échange article"}].map(opt=>{
            const val=settings.returnPolicy?.[opt.k]!==false;
            return(<button key={opt.k} onClick={()=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,[opt.k]:!val}}))}
              style={{padding:10,borderRadius:10,border:`2px solid ${val?C.primary:C.border}`,background:val?`${C.primary}08`:"#fff",cursor:"pointer",textAlign:"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${val?C.primary:C.border}`,background:val?C.primary:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {val&&<Check size={10} color="#fff"/>}</div>
                <span style={{fontSize:12,fontWeight:600}}>{opt.l}</span></div>
            </button>);})}
        </div>
      </div>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>Options</h4>
        {[{k:"autoRestock",l:"Remise en stock automatique"},{k:"requireReceipt",l:"Ticket obligatoire"},
          {k:"printAvoir",l:"Imprimer le ticket d'avoir"},{k:"requireReason",l:"Motif obligatoire"}].map(opt=>{
          const val=settings.returnPolicy?.[opt.k]!==false;
          return(<div key={opt.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:12,fontWeight:600}}>{opt.l}</span>
            <button onClick={()=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,[opt.k]:!val}}))}
              style={{width:40,height:22,borderRadius:11,border:"none",cursor:"pointer",background:val?C.primary:C.border,position:"relative",transition:"all 0.2s"}}>
              <div style={{width:16,height:16,borderRadius:8,background:"#fff",position:"absolute",top:3,left:val?21:3,transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/></button>
          </div>);})}
      </div>
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Politique de retour mise à jour");notify("Paramètres sauvegardés","success");}} style={{width:"100%",height:44,background:C.primary}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="history"&&<>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <div style={{fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4}}>TOTAL RETOURS</div>
        <div style={{fontSize:24,fontWeight:800}}>{totalReturns}</div></div>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <div style={{fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4}}>VALEUR TOTALE</div>
        <div style={{fontSize:24,fontWeight:800,color:C.danger}}>{totalValue.toFixed(2)}€</div></div>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <div style={{fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4}}>ARTICLES RETOURNÉS</div>
        <div style={{fontSize:24,fontWeight:800}}>{totalItems}</div></div>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <div style={{fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4}}>TAUX DE RETOUR</div>
        <div style={{fontSize:24,fontWeight:800}}>{tickets.length?((totalReturns/tickets.length)*100).toFixed(1):0}%</div></div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:10}}>Par motif</h4>
        {Object.entries(reasonStats).sort((a,b)=>b[1]-a[1]).map(([reason,count])=>(
          <div key={reason} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:12}}>{reason}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:60,height:6,borderRadius:3,background:C.surfaceAlt,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:3,background:C.primary,width:`${(count/totalReturns)*100}%`}}/></div>
              <span style={{fontSize:11,fontWeight:700,minWidth:30,textAlign:"right"}}>{count}</span></div></div>))}
        {Object.keys(reasonStats).length===0&&<div style={{color:C.textLight,fontSize:12,textAlign:"center",padding:16}}>Aucun retour</div>}
      </div>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:10}}>Par mode de remboursement</h4>
        {Object.entries(methodStats).sort((a,b)=>b[1]-a[1]).map(([method,count])=>{
          const labels={avoir:"Avoir / Crédit",cash:"Espèces",card:"Carte bancaire",exchange:"Échange"};
          const colors={avoir:C.primary,cash:C.accent,card:C.info,exchange:"#8B5CF6"};
          return(<div key={method} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:10,height:10,borderRadius:3,background:colors[method]||C.textMuted}}/>
              <span style={{fontSize:12}}>{labels[method]||method}</span></div>
            <span style={{fontSize:11,fontWeight:700}}>{count}</span></div>);})}
        {Object.keys(methodStats).length===0&&<div style={{color:C.textLight,fontSize:12,textAlign:"center",padding:16}}>Aucun retour</div>}
      </div>
    </div>

    <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <div style={{flex:1,position:"relative"}}><Search size={14} style={{position:"absolute",left:10,top:10,color:C.textMuted}}/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un retour…" style={{paddingLeft:30}}/></div>
        <div style={{display:"flex",gap:4}}>
          {[{id:"all",l:"Tous"},{id:"avoir",l:"Avoirs"},{id:"cash",l:"Espèces"},{id:"card",l:"Carte"},{id:"exchange",l:"Échanges"}].map(f=>(
            <button key={f.id} onClick={()=>setFilter(f.id)} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${filter===f.id?C.primary:C.border}`,
              background:filter===f.id?C.primary:"transparent",color:filter===f.id?"#fff":C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>{f.l}</button>))}
        </div>
      </div>
      {filtered.length===0&&<div style={{textAlign:"center",padding:30,color:C.textLight}}>
        <RotateCcw size={32} style={{marginBottom:8,opacity:0.3}}/><div>Aucun retour trouvé</div></div>}
      {filtered.map(a=>{const expired=isAvoirExpired?.(a);return(<div key={a.id||a.avoirNumber} style={{padding:12,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,opacity:expired?0.6:1}}>
        <div style={{width:40,height:40,borderRadius:10,background:expired?C.surfaceAlt:C.dangerLight,display:"flex",alignItems:"center",justifyContent:"center"}}><RotateCcw size={16} color={expired?C.textMuted:C.danger}/></div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <span style={{fontSize:13,fontWeight:700}}>{a.avoirNumber||("RET-"+String(a.id).slice(-6))}</span>
            <Badge color={a.refundMethod==="avoir"?C.primary:a.refundMethod==="cash"?C.accent:a.refundMethod==="card"?C.info:"#8B5CF6"}>
              {a.refundMethod==="avoir"?"Avoir":a.refundMethod==="cash"?"Especes":a.refundMethod==="card"?"Carte":"Echange"}</Badge>
            {a.originalTicket&&<span style={{fontSize:10,color:C.textMuted,fontFamily:"monospace"}}>Ticket: {a.originalTicket}</span>}
            {a.customerName&&<span style={{fontSize:10,color:C.accent}}>Client: {a.customerName}</span>}
            {expired&&<Badge color={C.danger}>Expire</Badge>}
            {a.refundMethod==="avoir"&&!a.used&&!expired&&<Badge color={C.fiscal}>Solde: {formatAmount(getAvoirRemaining(a))}EUR</Badge>}
            {a.used&&<Badge color={C.textMuted}>Utilise</Badge>}</div>
          <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>
            {(a.items||[]).map(it=>`${it.product?.name||it.product_name||"?"}${it.variant?(" ("+((it.variant?.color||it.variant_color||"")+"/"+(it.variant?.size||it.variant_size||""))+")"):""} x${it.quantity||it.qty||1}`).join(", ")}
            {a.reason&&<span> -- {a.reason}</span>}</div>
          {a.userName&&<div style={{fontSize:9,color:C.textLight,marginTop:1}}>Par: {a.userName}</div>}</div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:14,fontWeight:800,color:C.danger}}>-{(a.totalTTC||0).toFixed(2)}EUR</div>
          <div style={{fontSize:10,color:C.textMuted}}>{new Date(a.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
          {a.fingerprint&&<div style={{fontSize:8,color:C.fiscal,fontFamily:"monospace"}}>{a.fingerprint}</div>}
        </div>
      </div>);})}
    </div>
    </>}
  </div>);
}


export default ReturnsHistoryScreen;
export { ReturnsHistoryScreen };
