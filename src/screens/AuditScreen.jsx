import React, { useState, useEffect } from "react";
import { Download } from "lucide-react";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { Btn, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";

function AuditScreen(){
  const{audit:localAudit,jet:localJet,exportCSVReport,isOnline,currentStore,viewingStoreId,stores,effectiveStoreId,perm}=useApp();
  if(!perm().canExport)return<div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:16,fontWeight:600}}>Accès réservé aux administrateurs</div>;
  const storeName=viewingStoreId==="all"?"Tous les magasins":viewingStoreId?stores.find(s=>s.id===viewingStoreId)?.name:currentStore?.name||"";
  const[filterUser,setFilterUser]=useState("");const[tab,setTab]=useState("audit");const[page,setPage]=useState(0);
  const[apiAudit,setApiAudit]=useState(null);const[apiJet,setApiJet]=useState(null);
  const PAGE_SIZE=50;
  // Charger depuis le backend — recharger quand le magasin change
  useEffect(()=>{
    if(!API.getToken())return;
    setApiAudit(null);setApiJet(null);setPage(0);
    API.audit.list({limit:500}).then(rows=>setApiAudit(rows.map(r=>({id:r.id,date:r.created_at,action:r.action,detail:r.detail,ref:r.reference,user:r.user_name})))).catch(()=>{});
    API.audit.jet().then(rows=>setApiJet(rows.map(r=>({id:r.id,date:r.created_at,type:r.event_type,detail:r.detail,user:r.user_name})))).catch(()=>{});
  },[effectiveStoreId]);
  // Utiliser les données backend si dispo, sinon local
  const audit=apiAudit||localAudit;const jet=apiJet||localJet;
  const ac={VENTE:C.primary,VOID_LINE:C.warn,VOID_SALE:C.danger,CLOTURE:C.fiscal,CAISSE:C.accent,IMPORT:C.warn,PARK:"#888",PRODUCT:C.info,RECEPTION:"#059669",RGPD:C.fiscal,FEC:C.info,CLOCK_IN:"#059669",CLOCK_OUT:C.accent,PRICE_CHANGE:C.warn,EXPORT:C.info,AVOIR:C.fiscal};
  const jc={LOGIN:C.primary,LOGIN_OFFLINE:C.warn,LOGOUT:C.accent,AVOIR:C.fiscal,SYS_START:C.info,PARAM_CHANGE:C.warn,EXPORT:C.info,ERROR:C.danger,VOID_LINE:C.warn,VOID_SALE:C.danger};
  const users=[...new Set(audit.map(e=>e.user))];
  const filtered=filterUser?(tab==="audit"?audit:jet).filter(e=>e.user===filterUser):(tab==="audit"?audit:jet);
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);const pageData=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>{tab==="audit"?"Journal d'audit":"JET — Journal Événements Techniques"}</h2>
      {storeName&&<Badge color={C.primary}>{storeName}</Badge>}
      <div style={{display:"flex",gap:4,marginLeft:8}}>
        {[{id:"audit",l:"Audit"},{id:"jet",l:"JET (NF525)"}].map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setPage(0);}} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${tab===t.id?C.fiscal:C.border}`,
            background:tab===t.id?C.fiscalLight:"transparent",cursor:"pointer",fontSize:11,fontWeight:600,color:tab===t.id?C.fiscal:C.textMuted}}>{t.l}</button>))}</div>
      <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} style={{padding:6,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit",marginLeft:"auto"}}>
        <option value="">Tous les utilisateurs</option>{users.map(u=>(<option key={u} value={u}>{u}</option>))}</select>
      <Btn variant="outline" onClick={()=>{const data=filtered.map(e=>({date:e.date,action:e.action||e.type,detail:e.detail,ref:e.ref||"",user:e.user}));
        exportCSVReport(data,`${tab}-${new Date().toISOString().split("T")[0]}.csv`);}} style={{height:32,fontSize:10}}><Download size={12}/> Export</Btn></div>
    {!filtered.length&&<div style={{textAlign:"center",padding:30,color:C.textLight}}>Aucune entrée</div>}
    {tab==="audit"&&pageData.map(e=>(<div key={e.id} style={{display:"flex",alignItems:"start",gap:8,padding:6,borderBottom:`1px solid ${C.border}`}}>
      <div style={{width:6,height:6,borderRadius:3,marginTop:5,background:ac[e.action]||C.textMuted,flexShrink:0}}/>
      <div style={{flex:1}}><Badge color={ac[e.action]||C.textMuted}>{e.action}</Badge> <span style={{fontSize:10,color:C.textMuted}}>{e.user}</span>
        <div style={{fontSize:10,marginTop:1}}>{e.detail}</div></div>
      <span style={{fontSize:8,color:C.textLight,whiteSpace:"nowrap"}}>{new Date(e.date).toLocaleString("fr-FR")}</span></div>))}
    {tab==="jet"&&pageData.map(e=>(<div key={e.id} style={{display:"flex",alignItems:"start",gap:8,padding:6,borderBottom:`1px solid ${C.border}`}}>
      <div style={{width:6,height:6,borderRadius:3,marginTop:5,background:jc[e.type]||C.textMuted,flexShrink:0}}/>
      <div style={{flex:1}}><Badge color={jc[e.type]||C.fiscal}>{e.type}</Badge> <span style={{fontSize:10,color:C.textMuted}}>{e.user}</span>
        <div style={{fontSize:10,marginTop:1}}>{e.detail}</div></div>
      <span style={{fontSize:8,color:C.textLight,whiteSpace:"nowrap"}}>{new Date(e.date).toLocaleString("fr-FR")}</span></div>))}
    {totalPages>1&&<div style={{display:"flex",gap:6,justifyContent:"center",marginTop:12}}>
      <Btn variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)} style={{height:28,fontSize:10}}>← Précédent</Btn>
      <span style={{fontSize:11,color:C.textMuted,alignSelf:"center"}}>{page+1} / {totalPages}</span>
      <Btn variant="outline" disabled={page>=totalPages-1} onClick={()=>setPage(p=>p+1)} style={{height:28,fontSize:10}}>Suivant →</Btn></div>}
  </div>);
}

/* ══════════ CSV IMPORT WIZARD ══════════ */

export default AuditScreen;
export { AuditScreen };
