import React, { useState } from "react";
import { C } from "../constants.jsx";
import { Btn, Input } from "../ui.jsx";
import { useApp } from "../context.jsx";

function FootfallScreen(){
  const{footfall,addFootfall,tickets,notify}=useApp();
  const[manualCount,setManualCount]=useState("");const[manualDate,setManualDate]=useState(new Date().toISOString().split("T")[0]);
  const[counterUrl,setCounterUrl]=useState(()=>{try{return localStorage.getItem("caissepro_counter_url")||"";}catch(e){return"";}});

  const todayStr=new Date().toISOString().split("T")[0];
  const todayFootfall=footfall.find(f=>f.date===todayStr)?.count||0;
  const todayTickets=tickets.filter(t=>(t.date||t.createdAt||t.created_at||"").startsWith(todayStr)).length;
  const conversionRate=todayFootfall>0?(todayTickets/todayFootfall*100):0;

  const fetchCounter=async()=>{if(!counterUrl){notify("URL du compteur non configurée","error");return;}
    // H6 fix: validate URL to prevent SSRF — only allow https and http, block localhost/private IPs
    try{const u=new URL(counterUrl);if(!["http:","https:"].includes(u.protocol)){notify("Protocole non autorisé — utilisez http ou https","error");return;}
      const host=u.hostname.toLowerCase();if(host==="localhost"||host==="127.0.0.1"||host.startsWith("192.168.")||host.startsWith("10.")||host.startsWith("172.")||host==="0.0.0.0"||host==="[::1]"){notify("URL locale non autorisée pour des raisons de sécurité","error");return;}
    }catch(e){notify("URL invalide","error");return;}
    try{const res=await fetch(counterUrl);const data=await res.json();
      if(data.count!=null){addFootfall(data.count);notify(`Compteur mis à jour: ${data.count} entrées`,"success");}
      else{notify("Format de réponse invalide (attendu: {count: N})","error");}
    }catch(e){notify("Erreur de connexion au compteur: "+e.message,"error");}};

  const last7=footfall.filter(f=>{const d=new Date(f.date);const now=new Date();const diff=(now-d)/(1000*60*60*24);return diff<=7;});

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <h2 style={{fontSize:22,fontWeight:800,margin:"0 0 14px"}}>Compteur d'entrées</h2>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,textAlign:"center"}}>
        <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:4}}>ENTRÉES AUJOURD'HUI</div>
        <div style={{fontSize:32,fontWeight:900,color:C.primary}}>{todayFootfall}</div></div>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,textAlign:"center"}}>
        <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:4}}>VENTES AUJOURD'HUI</div>
        <div style={{fontSize:32,fontWeight:900,color:C.info}}>{todayTickets}</div></div>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,textAlign:"center"}}>
        <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:4}}>TAUX DE CONVERSION</div>
        <div style={{fontSize:32,fontWeight:900,color:conversionRate>=20?"#059669":conversionRate>=10?C.warn:C.danger}}>{conversionRate.toFixed(1)}%</div></div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Saisie manuelle</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>DATE</label>
            <Input type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)} style={{height:36}}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>NB ENTRÉES</label>
            <Input type="number" value={manualCount} onChange={e=>setManualCount(e.target.value)} placeholder="0" style={{height:36}}/></div></div>
        <Btn onClick={()=>{const c=parseInt(manualCount);if(c>0&&manualDate){addFootfall(c,manualDate);notify(`${c} entrées enregistrées pour le ${manualDate}`,"success");setManualCount("");}}}
          style={{width:"100%",height:40,background:C.primary}}>Enregistrer</Btn>
      </div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Compteur automatique (API)</h3>
        <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>URL DU COMPTEUR</label>
          <Input value={counterUrl} onChange={e=>{setCounterUrl(e.target.value);try{localStorage.setItem("caissepro_counter_url",e.target.value);}catch(ex){}}}
            placeholder="https://api.counter.example/today" style={{height:36}}/></div>
        <div style={{fontSize:10,color:C.textMuted,marginBottom:8}}>Le compteur doit retourner du JSON: {"{"}"count": 123{"}"}</div>
        <Btn variant="outline" onClick={fetchCounter} style={{width:"100%",height:36}}>Récupérer le comptage</Btn>
      </div>
    </div>

    <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginTop:14}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Historique (7 derniers jours)</h3>
      {last7.length===0&&<div style={{color:C.textLight,fontSize:11}}>Aucune donnée</div>}
      <table className="rtable" style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        {last7.length>0&&<thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
          {["Date","Entrées","Ventes","Conversion"].map(h=>(<th key={h} style={{padding:8,textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>}
        <tbody>{last7.map(f=>{const dayTickets=tickets.filter(t=>(t.date||t.createdAt||t.created_at||"").startsWith(f.date)).length;
          const conv=f.count>0?(dayTickets/f.count*100):0;
          return(<tr key={f.date} style={{borderBottom:`1px solid ${C.border}`}}>
            <td data-label="Date" style={{padding:8,fontWeight:600}}>{new Date(f.date).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</td>
            <td data-label="Entrées" style={{padding:8,fontWeight:700,color:C.primary}}>{f.count}</td>
            <td data-label="Ventes" style={{padding:8}}>{dayTickets}</td>
            <td data-label="Conversion" style={{padding:8,fontWeight:700,color:conv>=20?"#059669":conv>=10?C.warn:C.danger}}>{conv.toFixed(1)}%</td>
          </tr>);})}</tbody></table>
    </div>
  </div>);
}


export default FootfallScreen;
export { FootfallScreen };
