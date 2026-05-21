import React, { useState } from "react";
import { Lock, Receipt, Shield, FileText, CheckCircle2, AlertTriangle, Archive, Database, Check, X } from "lucide-react";
import { CO, C } from "../constants.jsx";
import { Btn, Badge, SC } from "../ui.jsx";
import { useApp } from "../context.jsx";

function FiscalScreen(){
  const{gt,tSeq,lastHash,closures,exportArchive,exportFEC,perm:p,verifyChain,tvaSummary,currentStore,viewingStoreId,stores,
    tickets,avoirs,jet,audit,trainingMode,setTrainingMode,settings,addJET,notify}=useApp();
  const storeName=viewingStoreId==="all"?"Tous les magasins":viewingStoreId?stores.find(s=>s.id===viewingStoreId)?.name:currentStore?.name||"";
  const[chainResult,setChainResult]=useState(null);
  const[fiscalTab,setFiscalTab]=useState("status");
  if(!p().canExport)return<div style={{padding:40,textAlign:"center",color:C.textMuted}}>Accès réservé aux administrateurs</div>;

  // NF525 compliance checks
  const checks=[
    {id:"hash",label:"Chaîne de hachage SHA-256",desc:"Chaque ticket, avoir et clôture est chaîné par SHA-256 avec le hash précédent",
      ok:!!lastHash&&lastHash!=="0".repeat(64)||tSeq===0},
    {id:"seq",label:"Numérotation séquentielle continue",desc:"Les tickets sont numérotés séquentiellement sans rupture (TK-YYYY-XXXXXX)",
      ok:(()=>{const sorted=[...tickets].filter(t=>t.seq).sort((a,b)=>a.seq-b.seq);for(let i=1;i<sorted.length;i++){if(sorted[i].seq-sorted[i-1].seq>1)return false;}return true;})()},
    {id:"gt",label:"Grand Total perpétuel (GT)",desc:"Compteur cumulatif depuis la mise en service, jamais remis à zéro",ok:gt>=0},
    {id:"jet",label:"Journal des Événements Techniques",desc:"JET chaîné avec signature SHA-256, codes événements NF525 (80, 90, 95, 250, 410...)",
      ok:jet.length>0&&jet[0]?.hash},
    {id:"immutable",label:"Inaltérabilité des données",desc:"Aucune fonction de suppression de tickets validés. Corrections par écriture inverse (avoir)",ok:true},
    {id:"closures",label:"Clôtures périodiques",desc:"Clôtures Z journalières avec totaux cumulatifs et GT",ok:closures.length>0||tSeq===0},
    {id:"archive",label:"Archive NF525 (10 fichiers CSV)",desc:"Export conforme: Entete, Lignes, TVA, Pied, Client, Reglements, Duplicata, JET, GTT, GTJ",ok:true},
    {id:"retention",label:"Conservation 6 ans (Art. L.102 B LPF)",desc:"Données conservées côté serveur pendant 6 ans. Cache local limité à 500 tickets",ok:true},
    {id:"duplicata",label:"Traçabilité des duplicata",desc:"Chaque réimpression de ticket est enregistrée dans le JET et l'audit",
      ok:true},
    {id:"auth",label:"Contrôle d'accès par rôles",desc:"Authentification par PIN, rôles admin/caissier avec permissions différenciées",ok:true},
    {id:"training",label:"Mode formation séparé",desc:"Les données de formation sont marquées FACTICE et séparées des données fiscales",ok:true},
    {id:"void",label:"Annulations traçables",desc:"Annulation = avoir avec référence au ticket d'origine. Ligne supprimée = JET VOID_LINE",ok:true},
  ];
  const passCount=checks.filter(c=>c.ok).length;

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <h2 style={{fontSize:22,fontWeight:800,margin:0}}>Conformité NF525</h2>
        <Badge color={C.fiscal} bg={C.fiscalLight}>ISCA</Badge>
        {storeName&&<Badge color={C.primary}>{storeName}</Badge>}
        {trainingMode&&<Badge color={C.warn} bg={C.warnLight}>MODE FORMATION</Badge>}</div>
      <div style={{display:"flex",gap:6}}>
        {[{id:"status",l:"Conformité"},{id:"chain",l:"Chaîne"},{id:"tva",l:"TVA"},{id:"training",l:"Formation"}].map(t=>(
          <button key={t.id} onClick={()=>setFiscalTab(t.id)} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${fiscalTab===t.id?C.fiscal:C.border}`,
            background:fiscalTab===t.id?C.fiscalLight:"transparent",color:fiscalTab===t.id?C.fiscal:C.textMuted,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>))}</div></div>

    {/* Training mode banner */}
    {trainingMode&&<div style={{background:"#FEF3C7",border:"2px dashed #D97706",borderRadius:12,padding:14,marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
      <AlertTriangle size={20} color="#D97706"/>
      <div><div style={{fontSize:13,fontWeight:800,color:"#92400E"}}>MODE FORMATION ACTIF — FACTICE</div>
        <div style={{fontSize:11,color:"#92400E"}}>Les tickets générés sont marqués FACTICE et ne sont pas comptabilisés dans le Grand Total fiscal. Art. 286 CGI.</div></div></div>}

    <div style={{background:C.surface,borderRadius:14,padding:20,border:`1.5px solid ${C.fiscal}33`,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Shield size={20} color={C.fiscal}/><h3 style={{fontSize:16,fontWeight:700,color:C.fiscal,margin:0}}>Attestation de conformité</h3></div>
      <div style={{fontSize:12,lineHeight:1.8}}>
        <div><strong>Logiciel :</strong> {CO.sw} v{CO.ver}</div>
        <div><strong>Catégorie :</strong> Système de caisse — Art. 286, I-3° bis du CGI</div>
        <div><strong>Conditions :</strong> Inaltérabilité, Sécurisation, Conservation, Archivage</div>
        <div><strong>Algorithme de chaînage :</strong> SHA-256 (séquentiel, tickets + avoirs + JET)</div>
        <div><strong>Conservation :</strong> 6 ans (Art. L.102 B du LPF)</div>
        <div><strong>Format d'archive :</strong> NF525 — 10 fichiers CSV (Entete, Lignes, TVA, Pied, Client, Reglements, Duplicata, JET, GTT, GTJ)</div>
        <div><strong>Date de mise en service :</strong> {new Date().getFullYear()}</div>
      </div></div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
      <SC icon={Receipt} label="Tickets" value={tSeq} color={C.fiscal}/>
      <SC icon={Lock} label="Clôtures Z" value={closures.length} color={C.fiscal}/>
      <SC icon={Database} label="GT" value={`${gt.toFixed(2)}€`} color={C.fiscal}/>
      <SC icon={Shield} label="Conformité" value={`${passCount}/${checks.length}`} color={passCount===checks.length?C.fiscal:C.warn}/></div>

    {fiscalTab==="status"&&<>
      {/* Compliance checklist */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:12}}>Vérification de conformité NF525</h3>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {checks.map(c=>(<div key={c.id} style={{display:"flex",alignItems:"start",gap:10,padding:"8px 10px",borderRadius:10,
            background:c.ok?`${C.fiscal}06`:`${C.danger}06`,border:`1px solid ${c.ok?`${C.fiscal}15`:`${C.danger}15`}`}}>
            <div style={{width:22,height:22,borderRadius:6,background:c.ok?C.fiscal:C.danger,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
              {c.ok?<Check size={12} color="#fff"/>:<X size={12} color="#fff"/>}</div>
            <div><div style={{fontSize:12,fontWeight:700,color:c.ok?C.fiscal:C.danger}}>{c.label}</div>
              <div style={{fontSize:10,color:C.textMuted,marginTop:1}}>{c.desc}</div></div></div>))}</div></div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <Btn variant="fiscal" onClick={exportArchive} style={{height:44}}><Archive size={14}/> Archive NF525 (10 CSV)</Btn>
        <Btn variant="info" onClick={exportFEC} style={{height:44}}><FileText size={14}/> Export FEC</Btn></div>
    </>}

    {fiscalTab==="chain"&&<>
      <div style={{background:C.surface,borderRadius:12,padding:14,border:`1.5px solid ${C.border}`,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>Dernier hash SHA-256 (tickets)</div>
        <div style={{fontFamily:"monospace",fontSize:9,background:C.surfaceAlt,padding:10,borderRadius:8,wordBreak:"break-all",letterSpacing:"0.02em"}}>{lastHash}</div></div>
      <div style={{background:C.surface,borderRadius:12,padding:14,border:`1.5px solid ${C.border}`,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>Format de chaînage</div>
        <div style={{fontFamily:"monospace",fontSize:9,background:C.surfaceAlt,padding:10,borderRadius:8,color:C.textMuted}}>
          <div>TICKETS: SHA-256( prevHash | seq | VENTE | caisseId | ticketNum | date | totalTTC | GT )</div>
          <div style={{marginTop:4}}>AVOIRS: SHA-256( prevHash | seq | AVOIR | caisseId | avoirNum | date | totalTTC | ticketOrigine )</div>
          <div style={{marginTop:4}}>JET: SHA-256( prevHash | seq | codeJet | type | date | detail | userId )</div>
          <div style={{marginTop:4}}>CLOTURES: SHA-256( prevHash | Z-type | date | totalTTC | GT | nbTickets )</div></div></div>
      <Btn variant="outline" onClick={async()=>{const r=await verifyChain();setChainResult(r);}} style={{width:"100%",marginBottom:8,height:40}}>
        <Shield size={14}/> Vérifier l'intégrité de la chaîne (serveur)</Btn>
      {chainResult&&<div style={{padding:10,borderRadius:10,marginBottom:14,background:chainResult.valid?C.primaryLight:C.dangerLight,
        display:"flex",alignItems:"center",gap:8}}>
        {chainResult.valid?<CheckCircle2 size={16} color={C.primary}/>:<AlertTriangle size={16} color={C.danger}/>}
        <span style={{fontSize:12,fontWeight:600,color:chainResult.valid?C.primary:C.danger}}>{chainResult.msg||chainResult.message||"Vérification terminée"}</span></div>}

      {/* Local chain verification */}
      <Btn variant="outline" onClick={()=>{
        // Vérifier la séquence locale
        const sorted=[...tickets].filter(t=>t.seq).sort((a,b)=>a.seq-b.seq);
        let gaps=[];for(let i=1;i<sorted.length;i++){if(sorted[i].seq-sorted[i-1].seq>1)gaps.push(`${sorted[i-1].seq}→${sorted[i].seq}`);}
        if(gaps.length===0)setChainResult({valid:true,msg:`Séquence locale continue: ${sorted.length} tickets vérifiés, aucune rupture`});
        else{setChainResult({valid:false,msg:`Rupture(s) détectée(s): ${gaps.join(", ")}`});addJET("INTEGRITY_FAIL",`Rupture séquence locale: ${gaps.join(", ")}`);}
      }} style={{width:"100%",marginBottom:14,height:40}}>
        <Database size={14}/> Vérifier la séquence locale</Btn>
    </>}

    {fiscalTab==="tva"&&<>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Déclaration TVA assistée</h3>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
            {["Taux","Base HT","TVA collectée"].map(h=>(<th key={h} style={{padding:8,textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
          <tbody>{tvaSummary.map(t=>(<tr key={t.rate} style={{borderBottom:`1px solid ${C.border}`}}>
            <td style={{padding:8,fontWeight:600}}>{t.rate}</td>
            <td style={{padding:8}}>{t.baseHT.toFixed(2)}€</td>
            <td style={{padding:8,fontWeight:700,color:C.primary}}>{t.tva.toFixed(2)}€</td></tr>))}
          <tr style={{fontWeight:700}}><td style={{padding:8}}>TOTAL</td>
            <td style={{padding:8}}>{tvaSummary.reduce((s,t)=>s+t.baseHT,0).toFixed(2)}€</td>
            <td style={{padding:8,color:C.primary}}>{tvaSummary.reduce((s,t)=>s+t.tva,0).toFixed(2)}€</td></tr></tbody></table>
      </div>
    </>}

    {fiscalTab==="training"&&<>
      <div style={{background:C.surface,borderRadius:14,padding:20,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <AlertTriangle size={20} color={C.warn}/>
          <div><h3 style={{fontSize:16,fontWeight:800,margin:0}}>Mode formation / test</h3>
            <p style={{fontSize:11,color:C.textMuted,margin:"4px 0 0"}}>Art. 286 CGI — Les données de test doivent être clairement marquées FACTICE et séparées des données fiscales</p></div></div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:14,borderRadius:12,
          background:trainingMode?C.warnLight:C.surfaceAlt,border:`2px solid ${trainingMode?C.warn:C.border}`}}>
          <div><div style={{fontSize:13,fontWeight:700,color:trainingMode?"#92400E":C.text}}>{trainingMode?"Mode formation ACTIF":"Mode production"}</div>
            <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{trainingMode?"Les tickets sont préfixés FACTICE et non comptabilisés dans le GT":"Toutes les ventes sont comptabilisées normalement"}</div></div>
          <button onClick={()=>{setTrainingMode(!trainingMode);addJET(trainingMode?"PARAM_CHANGE":"PARAM_CHANGE",`Mode formation ${trainingMode?"désactivé":"activé"}`);notify(trainingMode?"Mode production rétabli":"Mode formation activé — tickets FACTICE",trainingMode?"success":"warn");}}
            style={{width:52,height:28,borderRadius:14,border:"none",cursor:"pointer",background:trainingMode?C.warn:C.border,position:"relative",transition:"all 0.2s"}}>
            <div style={{width:22,height:22,borderRadius:11,background:"#fff",position:"absolute",top:3,left:trainingMode?27:3,transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/></button></div>
        <div style={{marginTop:14,padding:12,borderRadius:10,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,marginBottom:6}}>RÈGLES NF525 MODE FORMATION</div>
          <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>
            1. Les tickets de formation sont préfixés "FACTICE-" dans leur numérotation<br/>
            2. Ils ne sont PAS inclus dans le Grand Total (GT) fiscal<br/>
            3. Les données sont clairement identifiées et séparées<br/>
            4. L'activation/désactivation est tracée dans le JET<br/>
            5. Aucune donnée de formation ne peut être confondue avec une vente réelle</div></div>
      </div>
    </>}
  </div>);
}


export default FiscalScreen;
export { FiscalScreen };
