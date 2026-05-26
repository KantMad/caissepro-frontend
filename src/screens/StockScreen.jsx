import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, RotateCcw, CheckCircle2, AlertTriangle, Save, Upload, Trash2, User, Filter } from "lucide-react";
import Papa from "papaparse";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { norm } from "../utils.jsx";
import { Modal, Btn, Input, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";
import { sortSizes } from "./_shared.js";

function StockScreen(){
  const{products,setProducts,stockAlerts,stockMoves,receiveStock,receiveBatchStock,stockAging,reorderSuggestions,adjustStock,notify,findByEAN,users,addStockMove,addAudit,settings,perm,defectiveStock,loadDefectiveStock,receiveDefectiveStock,adjustDefectiveStock,setScanOverride,clearScanOverride}=useApp();
  if(!perm().canCreateProduct)return<div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:16,fontWeight:600}}>Accès réservé aux administrateurs</div>;
  const[sel,setSel]=useState(products[0]?.id||"");const[tab,setTab]=useState("matrix");
  const[rcModal,setRcModal]=useState(false);const[rcProd,setRcProd]=useState("");const[rcVar,setRcVar]=useState("");const[rcQty,setRcQty]=useState("");const[rcSup,setRcSup]=useState("");
  // Batch reception state
  const[batchItems,setBatchItems]=useState([]);const[batchSupplier,setBatchSupplier]=useState("");const[batchSaving,setBatchSaving]=useState(false);
  const batchScanRef=useRef(null);const batchLastScan=useRef(0);
  const batchAddByEAN=useCallback((ean)=>{
    const found=findByEAN(ean);if(!found){notify("Code-barres inconnu: "+ean,"warn");return;}
    const{product:p,variant:v}=found;
    setBatchItems(prev=>{const idx=prev.findIndex(i=>i.variantId===v.id);
      if(idx>=0){const next=[...prev];next[idx]={...next[idx],qty:next[idx].qty+1};return next;}
      return[...prev,{productId:p.id,variantId:v.id,name:p.name,sku:p.sku,color:v.color,size:v.size,ean:v.ean,currentStock:v.stock,qty:1}];});
    // Audio feedback
    try{const ac=new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator();const g=ac.createGain();o.connect(g);g.connect(ac.destination);o.frequency.value=1200;g.gain.value=0.08;o.start();o.stop(ac.currentTime+0.08);}catch(e){}
  },[findByEAN,notify]);
  // EAN scan helper: resolves an EAN to productId+variantId
  const resolveEAN=useCallback((ean)=>{const found=findByEAN(ean);if(!found)return null;return{productId:found.product.id,variantId:found.variant.id,product:found.product,variant:found.variant};},[findByEAN]);
  const[adjProd,setAdjProd]=useState("");const[adjVar,setAdjVar]=useState("");const[adjQty,setAdjQty]=useState("");const[adjReason,setAdjReason]=useState("INVENTAIRE");
  const[invSearch,setInvSearch]=useState("");const[invCounts,setInvCounts]=useState({});
  const[stSearchMatrix,setStSearchMatrix]=useState("");const[stSearchReceipt,setStSearchReceipt]=useState("");const[stSearchAdj,setStSearchAdj]=useState("");
  const[csvStockModal,setCsvStockModal]=useState(false);const[csvStStep,setCsvStStep]=useState(0);const[csvStData,setCsvStData]=useState([]);const[csvStHeaders,setCsvStHeaders]=useState([]);const[csvStMapping,setCsvStMapping]=useState({});const[csvStPreview,setCsvStPreview]=useState([]);
  const[csvStMode,setCsvStMode]=useState("add");// "add" = ajouter au stock, "replace" = remplacer
  const[csvStMatchField,setCsvStMatchField]=useState("ean");// champ de matching: ean, sku, name_color_size
  const[csvStImporting,setCsvStImporting]=useState(false);const[csvStResult,setCsvStResult]=useState(null);
  const[defProd,setDefProd]=useState("");const[defVar,setDefVar]=useState("");const[defQty,setDefQty]=useState("");const[defReason,setDefReason]=useState("");
  const[defAdjProd,setDefAdjProd]=useState("");const[defAdjVar,setDefAdjVar]=useState("");const[defAdjQty,setDefAdjQty]=useState("");const[defAdjReason,setDefAdjReason]=useState("");
  const[defSearch,setDefSearch]=useState("");
  useEffect(()=>{if(tab==="defective")loadDefectiveStock();},[tab]);// eslint-disable-line react-hooks/exhaustive-deps
  // ══ Tenues: multi-scan list ══
  const[tenUser,setTenUser]=useState("");
  const[tenItems,setTenItems]=useState([]); // [{productId,variantId,name,sku,color,size,ean,qty}]
  const[tenSaving,setTenSaving]=useState(false);
  const[tenHistoryFilter,setTenHistoryFilter]=useState(""); // filter history by employee
  const tenScanRef=useRef(null);
  const tenAddByEAN=useCallback((ean)=>{
    const found=findByEAN(ean);if(!found){notify("EAN inconnu: "+ean,"warn");return;}
    const{product:p,variant:v}=found;
    setTenItems(prev=>{const idx=prev.findIndex(i=>i.variantId===v.id);
      if(idx>=0){const next=[...prev];next[idx]={...next[idx],qty:next[idx].qty+1};return next;}
      return[...prev,{productId:p.id,variantId:v.id,name:p.name,sku:p.sku,color:v.color,size:v.size,ean:v.ean||"",stock:v.stock,qty:1}];});
    try{const ac=new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator();const g=ac.createGain();o.connect(g);g.connect(ac.destination);o.frequency.value=1200;g.gain.value=0.08;o.start();o.stop(ac.currentTime+0.08);}catch(e){}
    notify(`${p.name} ${v.color}/${v.size} ajouté`,"info");
  },[findByEAN,notify]);
  const[trProd,setTrProd]=useState("");const[trVar,setTrVar]=useState("");const[trQty,setTrQty]=useState("1");const[trDest,setTrDest]=useState("");const[trRef,setTrRef]=useState("");
  const p=products.find(x=>x.id===sel);
  const sizes=[...new Set(p?.variants.map(v=>v.size)||[])].sort(sortSizes);const colors=[...new Set(p?.variants.map(v=>v.color)||[])].sort();
  return(<div style={{height:"100%",overflowY:"auto",padding:"var(--pad,16px)",background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",gap:"var(--gap,10px)",marginBottom:10}}>
      <h2 style={{fontSize:20,fontWeight:800,margin:0}}>Stock</h2>
      {stockAlerts.length>0&&<Badge color={C.danger}>{stockAlerts.length} alertes</Badge>}
      <div style={{flex:1}}/>
      <Btn variant="outline" onClick={()=>setTab("reception")}><Upload size={14}/> Réception</Btn></div>
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      {[{id:"matrix",l:"Matrice"},{id:"reception",l:"Réception"},{id:"alerts",l:"Alertes"},{id:"moves",l:"Mouvements"},{id:"inventory",l:"Inventaire"},{id:"adjust",l:"Ajustement"},{id:"defective",l:"Défectueux"},{id:"tenues",l:"Tenues"},{id:"transfers",l:"Transferts"},{id:"aging",l:"Vieillissement"}].map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${tab===t.id?C.primary:C.border}`,
          background:tab===t.id?C.primary:"transparent",color:tab===t.id?"#fff":C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>{t.l}</button>))}</div>

    {tab==="matrix"&&<><Input value={stSearchMatrix} onChange={e=>{setStSearchMatrix(e.target.value);}} placeholder="Rechercher produit (nom, SKU, EAN)..." style={{marginBottom:6,height:32,fontSize:11,padding:"4px 10px"}}
        onKeyDown={e=>{if(e.key==="Enter"){const r=resolveEAN(stSearchMatrix.trim());if(r){setSel(r.productId);setStSearchMatrix("");notify(`${r.product.name} — ${r.variant.color}/${r.variant.size}`,"info");}}}}/>
      <select value={sel} onChange={e=>setSel(e.target.value)} style={{padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:12,marginBottom:12,fontFamily:"inherit"}}>
      {products.filter(p=>!stSearchMatrix||p.name.toLowerCase().includes(stSearchMatrix.toLowerCase())||p.sku.toLowerCase().includes(stSearchMatrix.toLowerCase())||(p.variants||[]).some(v=>(v.ean||"").includes(stSearchMatrix))).map(p=>(<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}</select>
    {p&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr><th style={{padding:8,textAlign:"left",borderBottom:`2px solid ${C.border}`,fontSize:10}}>Couleur\Taille</th>
          {sizes.map(s=>(<th key={s} style={{padding:8,textAlign:"center",borderBottom:`2px solid ${C.border}`,fontWeight:700}}>{s}</th>))}</tr></thead>
        <tbody>{colors.map(c=>(<tr key={c}><td style={{padding:8,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>{c}</td>
          {sizes.map(s=>{const v=p.variants.find(v=>v.color===c&&v.size===s);const st=v?.stock||0;
            const bg=st===0?C.dangerLight:st<=(v?.stockAlert||5)?C.warnLight:C.primaryLight;
            return(<td key={s} style={{padding:8,textAlign:"center",borderBottom:`1px solid ${C.border}`,background:bg,fontWeight:700,
              color:st===0?C.danger:st<=(v?.stockAlert||5)?C.warn:C.primary}}>{v?st:"—"}</td>);})}</tr>))}</tbody></table>
      <div style={{marginTop:10,fontSize:11,color:C.textMuted}}>Prix: {p.price.toFixed(2)}€ — Coût: {p.costPrice?.toFixed(2)||"—"}€ — Marge: {p.costPrice?((p.price-p.costPrice)/p.price*100).toFixed(1)+"%":"—"} — TVA: {(p.taxRate*100).toFixed(0)}% — Collection: {p.collection||"—"}</div>
    </div>}</>}

    {tab==="reception"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <h3 style={{fontSize:14,fontWeight:700,margin:0}}>Réception réassort</h3>
        <Badge color={C.primary}>{batchItems.reduce((s,i)=>s+i.qty,0)} pièces — {batchItems.length} réf</Badge>
        <div style={{flex:1}}/>
        {batchItems.length>0&&<Btn variant="outline" onClick={()=>{if(confirm("Vider la réception en cours ?"))setBatchItems([]);}} style={{fontSize:10,padding:"4px 10px",color:C.danger,borderColor:C.danger}}>Vider</Btn>}
      </div>

      {/* Scanner input — always visible, auto-focused */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <div style={{flex:1,position:"relative"}}>
          <Input ref={batchScanRef} autoFocus placeholder="Scanner un code-barres ou saisir EAN..."
            style={{height:44,fontSize:15,fontWeight:600,paddingLeft:12,paddingRight:12,borderColor:C.primary,borderWidth:2}}
            onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();const v=e.target.value.trim();if(v){batchAddByEAN(v);e.target.value="";e.target.focus();}}}}/>
          <div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50)",fontSize:9,color:C.textLight,pointerEvents:"none"}}>ENTREE pour ajouter</div>
        </div>
        <Input value={batchSupplier} onChange={e=>setBatchSupplier(e.target.value)} placeholder="Fournisseur"
          style={{width:160,height:44,fontSize:12}}/></div>

      {/* Batch items list */}
      {batchItems.length===0&&<div style={{textAlign:"center",padding:40,color:C.textLight}}>
        <Upload size={32} style={{marginBottom:8,opacity:0.3}}/>
        <div style={{fontSize:13,fontWeight:600}}>Scannez les codes-barres pour commencer</div>
        <div style={{fontSize:11,marginTop:4}}>Chaque scan ajoute +1. Vous pouvez aussi modifier la quantité manuellement.</div></div>}

      {batchItems.length>0&&<div style={{maxHeight:400,overflowY:"auto",marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr style={{borderBottom:`2px solid ${C.border}`,position:"sticky",top:0,background:C.surface}}>
            {["Produit","Variante","EAN","Stock actuel","Qté reçue",""].map(h=>(
              <th key={h} style={{padding:6,textAlign:"left",fontSize:9,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
          <tbody>{batchItems.map((item,i)=>(<tr key={item.variantId} style={{borderBottom:`1px solid ${C.border}`,background:i===batchItems.length-1?`${C.primary}08`:"transparent"}}>
            <td style={{padding:6,fontWeight:600}}>{item.name} <span style={{color:C.textMuted,fontSize:9}}>({item.sku})</span></td>
            <td style={{padding:6}}>{item.color}/{item.size}</td>
            <td style={{padding:6,fontSize:9,color:C.textMuted,fontFamily:"monospace"}}>{item.ean||"—"}</td>
            <td style={{padding:6,color:C.textMuted}}>{item.currentStock}</td>
            <td style={{padding:6}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <button onClick={()=>setBatchItems(prev=>{const next=[...prev];if(next[i].qty>1)next[i]={...next[i],qty:next[i].qty-1};else next.splice(i,1);return next;})}
                  style={{width:24,height:24,borderRadius:6,border:`1.5px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>-</button>
                <input type="number" min="1" value={item.qty} onChange={e=>{const val=parseInt(e.target.value);if(val>0)setBatchItems(prev=>{const next=[...prev];next[i]={...next[i],qty:val};return next;});}}
                  style={{width:50,textAlign:"center",padding:4,borderRadius:6,border:`1.5px solid ${C.primary}`,fontWeight:700,fontSize:13,color:C.primary,background:`${C.primary}08`}}/>
                <button onClick={()=>setBatchItems(prev=>{const next=[...prev];next[i]={...next[i],qty:next[i].qty+1};return next;})}
                  style={{width:24,height:24,borderRadius:6,border:`1.5px solid ${C.primary}`,background:`${C.primary}10`,cursor:"pointer",fontSize:14,fontWeight:700,color:C.primary,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
              </div></td>
            <td style={{padding:6}}>
              <button onClick={()=>setBatchItems(prev=>prev.filter((_,j)=>j!==i))}
                style={{background:"transparent",border:"none",cursor:"pointer",color:C.danger,fontSize:14}}>✕</button></td>
          </tr>))}</tbody></table></div>}

      {/* Summary + validate */}
      {batchItems.length>0&&<div style={{display:"flex",alignItems:"center",gap:12,padding:12,borderRadius:10,background:C.primaryLight,border:`1.5px solid ${C.primary}33`}}>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:C.primary}}>{batchItems.reduce((s,i)=>s+i.qty,0)} pièces — {batchItems.length} référence{batchItems.length>1?"s":""}</div>
          <div style={{fontSize:10,color:C.textMuted}}>{batchSupplier?`Fournisseur: ${batchSupplier}`:"Aucun fournisseur renseigné"}</div></div>
        <Btn onClick={async()=>{
          setBatchSaving(true);
          try{const payload=batchItems.map(i=>({productId:i.productId,variantId:i.variantId,quantity:i.qty}));
            const res=await receiveBatchStock(payload,batchSupplier||"Non spécifié");
            const totalQty=batchItems.reduce((s,i)=>s+i.qty,0);
            notify(`Réception validée: ${totalQty} pièces, ${batchItems.length} réf`,"success");
            setBatchItems([]);setBatchSupplier("");
            if(batchScanRef.current)batchScanRef.current.focus();
          }catch(e){}finally{setBatchSaving(false);}
        }} disabled={batchSaving} style={{height:40,minWidth:160,background:C.primary,fontSize:13,fontWeight:700}}>
          {batchSaving?"Enregistrement...":"Valider la réception"}</Btn>
      </div>}
    </div>}

    {tab==="alerts"&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
      {stockAlerts.length===0&&<div style={{textAlign:"center",padding:30,color:C.textLight}}>Aucune alerte</div>}
      {stockAlerts.map((a,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,
        background:a.level==="rupture"?C.dangerLight:C.warnLight,border:`1.5px solid ${a.level==="rupture"?C.danger+"44":C.warn+"44"}`}}>
        <AlertTriangle size={16} color={a.level==="rupture"?C.danger:C.warn}/>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{a.product.name} — {a.variant.color}/{a.variant.size}</div>
          <div style={{fontSize:10,color:C.textMuted}}>Stock: {a.variant.stock} | Seuil: {a.variant.stockAlert}{a.product.sku?` | Réf: ${a.product.sku}`:""}{a.variant.ean?` | EAN: ${a.variant.ean}`:""}</div></div>
        <Badge color={a.level==="rupture"?C.danger:C.warn}>{a.level==="rupture"?"RUPTURE":"BAS"}</Badge></div>))}</div>}

    {tab==="moves"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
          {["Date","Type","Produit","Variante","Qté","Réf","User"].map(h=>(
            <th key={h} style={{padding:6,textAlign:"left",fontSize:9,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
        <tbody>{stockMoves.slice(0,50).map(m=>(<tr key={m.id} style={{borderBottom:`1px solid ${C.border}`}}>
          <td style={{padding:6,fontSize:10}}>{new Date(m.date).toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</td>
          <td style={{padding:6}}><Badge color={m.qty>0?"#059669":C.danger}>{m.type}</Badge></td>
          <td style={{padding:6,fontWeight:600}}>{m.productName}</td>
          <td style={{padding:6,color:C.textMuted}}>{m.variantColor}/{m.variantSize}</td>
          <td style={{padding:6,fontWeight:700,color:m.qty>0?"#059669":C.danger}}>{m.qty>0?"+":""}{m.qty}</td>
          <td style={{padding:6,color:C.textMuted,fontSize:9}}>{m.ref}</td>
          <td style={{padding:6,color:C.textMuted}}>{m.user}</td></tr>))}</tbody></table>
      {stockMoves.length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight}}>Aucun mouvement</div>}
    </div>}

    {tab==="aging"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Vieillissement du stock</h3>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
          {["Produit","Stock","Valeur","Jours sans vente","Statut"].map(h=>(
            <th key={h} style={{padding:8,textAlign:"left",fontSize:9,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
        <tbody>{stockAging.slice(0,20).map(p=>(<tr key={p.id} style={{borderBottom:`1px solid ${C.border}`}}>
          <td style={{padding:8,fontWeight:600}}>{p.name} <span style={{color:C.textMuted,fontSize:10}}>({p.sku})</span></td>
          <td style={{padding:8}}>{p.totalStock}</td>
          <td style={{padding:8,color:C.primary,fontWeight:600}}>{p.totalValue.toFixed(2)}€</td>
          <td style={{padding:8,fontWeight:700,color:p.daysSinceLastSale>30?C.danger:p.daysSinceLastSale>14?C.warn:C.primary}}>{p.daysSinceLastSale===999?"Jamais vendu":p.daysSinceLastSale+"j"}</td>
          <td style={{padding:8}}><Badge color={p.daysSinceLastSale>60?C.danger:p.daysSinceLastSale>30?C.warn:"#059669"}>{p.daysSinceLastSale>60?"Critique":p.daysSinceLastSale>30?"À surveiller":"OK"}</Badge></td>
        </tr>))}</tbody></table></div>}


    {tab==="defective"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Stock défectueux ({defectiveStock.length} variante{defectiveStock.length>1?"s":""})</h3>
      <p style={{fontSize:11,color:C.textMuted,marginBottom:12}}>Produits signalés comme défectueux lors de réceptions ou retours.</p>

      {/* Receive defective */}
      <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:14,border:`1.5px solid ${C.border}`}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8,color:C.danger}}>Réception défectueux</div>
        <Input placeholder="Scanner EAN ou saisir code-barres..." style={{marginBottom:8,height:34,fontSize:12,borderColor:C.danger}}
          onKeyDown={e=>{if(e.key==="Enter"){const r=resolveEAN(e.target.value.trim());if(r){setDefProd(r.productId);setDefVar(r.variantId);setDefQty(prev=>prev&&defProd===r.productId&&defVar===r.variantId?String(parseInt(prev)+1):"1");e.target.value="";notify(`${r.product.name} ${r.variant.color}/${r.variant.size}`,"info");}else{notify("EAN inconnu: "+e.target.value,"warn");e.target.value="";}}}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>PRODUIT</label>
            <select value={defProd} onChange={e=>{setDefProd(e.target.value);setDefVar("");setDefQty("");}} style={{width:"100%",padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}}>
              <option value="">Sélectionner…</option>{products.map(p=>(<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}</select></div>
          {defProd&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>VARIANTE</label>
            <select value={defVar} onChange={e=>setDefVar(e.target.value)} style={{width:"100%",padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}}>
              <option value="">Sélectionner…</option>{products.find(x=>x.id===defProd)?.variants.map(v=>(<option key={v.id} value={v.id}>{v.color}/{v.size} (stock: {v.stock}, def: {v.defective||0})</option>))}</select></div>}
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>QUANTITE</label>
            <Input type="number" min="1" value={defQty} onChange={e=>setDefQty(e.target.value)} placeholder="Qte defectueuse"/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>MOTIF</label>
            <Input value={defReason} onChange={e=>setDefReason(e.target.value)} placeholder="Ex: produit abime a la reception"/></div></div>
        <Btn onClick={()=>{if(defProd&&defVar&&parseInt(defQty)>0){receiveDefectiveStock(defProd,defVar,parseInt(defQty),defReason);setDefProd("");setDefVar("");setDefQty("");setDefReason("");}}}
          disabled={!defProd||!defVar||!defQty||parseInt(defQty)<=0} style={{height:34,background:C.danger,fontSize:11}}>
          <AlertTriangle size={12}/> Enregistrer reception defectueux</Btn></div>

      {/* Adjust defective inventory */}
      <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:14,border:`1.5px solid ${C.border}`}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8,color:C.warn}}>Inventaire / Ajustement defectueux</div>
        <Input placeholder="Scanner EAN ou saisir code-barres..." style={{marginBottom:8,height:34,fontSize:12,borderColor:C.warn}}
          onKeyDown={e=>{if(e.key==="Enter"){const r=resolveEAN(e.target.value.trim());if(r){setDefAdjProd(r.productId);setDefAdjVar(r.variantId);setDefAdjQty(String(r.variant.defective||0));e.target.value="";notify(`${r.product.name} ${r.variant.color}/${r.variant.size}`,"info");}else{notify("EAN inconnu: "+e.target.value,"warn");e.target.value="";}}}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>PRODUIT</label>
            <select value={defAdjProd} onChange={e=>{setDefAdjProd(e.target.value);setDefAdjVar("");setDefAdjQty("");}} style={{width:"100%",padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}}>
              <option value="">Sélectionner…</option>{products.map(p=>(<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}</select></div>
          {defAdjProd&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>VARIANTE</label>
            <select value={defAdjVar} onChange={e=>{setDefAdjVar(e.target.value);const pr=products.find(x=>x.id===defAdjProd);const v=pr?.variants.find(x=>x.id===e.target.value);if(v)setDefAdjQty(String(v.defective||0));}} style={{width:"100%",padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}}>
              <option value="">Sélectionner…</option>{products.find(x=>x.id===defAdjProd)?.variants.map(v=>(<option key={v.id} value={v.id}>{v.color}/{v.size} (stock: {v.stock}, def: {v.defective||0})</option>))}</select></div>}
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>NOUVEAU QTÉ DÉFECTUEUX</label>
            <Input type="number" min="0" value={defAdjQty} onChange={e=>setDefAdjQty(e.target.value)} placeholder="Qté réelle défectueuse"/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>MOTIF</label>
            <Input value={defAdjReason} onChange={e=>setDefAdjReason(e.target.value)} placeholder="Ex: inventaire, réparation…"/></div></div>
        {defAdjProd&&defAdjVar&&defAdjQty!==""&&(()=>{const pr=products.find(x=>x.id===defAdjProd);const v=pr?.variants.find(x=>x.id===defAdjVar);
          const diff=parseInt(defAdjQty)-(v?.defective||0);
          return diff!==0?<div style={{padding:6,borderRadius:6,background:diff>0?C.dangerLight:C.primaryLight,marginBottom:8,fontSize:10,fontWeight:600,
            color:diff>0?C.danger:C.primary}}>{diff>0?`+${diff}`:diff} — Défectueux actuel: {v?.defective||0} → Nouveau: {defAdjQty}</div>:
            <div style={{padding:6,borderRadius:6,background:C.surfaceAlt,marginBottom:8,fontSize:10,color:C.textMuted}}>Aucun changement</div>;})()}
        <Btn onClick={()=>{if(defAdjProd&&defAdjVar&&defAdjQty!==""&&parseInt(defAdjQty)>=0){adjustDefectiveStock(defAdjProd,defAdjVar,parseInt(defAdjQty),defAdjReason);setDefAdjProd("");setDefAdjVar("");setDefAdjQty("");setDefAdjReason("");}}}
          disabled={!defAdjProd||!defAdjVar||defAdjQty===""} style={{height:34,background:C.warn,fontSize:11}}>
          <Save size={12}/> Enregistrer ajustement défectueux</Btn></div>

      {/* Defective stock list */}
      <Input value={defSearch} onChange={e=>setDefSearch(e.target.value)} placeholder="Rechercher dans les défectueux..." style={{marginBottom:8,height:30,fontSize:11,padding:"4px 10px"}}/>
      {defectiveStock.length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight}}>Aucun stock défectueux enregistré</div>}
      {defectiveStock.length>0&&<table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
          {["Produit","Variante","EAN","Stock sain","Défectueux","Coût"].map(h=>(
            <th key={h} style={{padding:6,textAlign:"left",fontSize:9,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
        <tbody>{defectiveStock.filter(d=>!defSearch||d.name.toLowerCase().includes(defSearch.toLowerCase())||d.sku?.toLowerCase().includes(defSearch.toLowerCase())||(d.ean||"").includes(defSearch)).map((d,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
          <td style={{padding:6,fontWeight:600}}>{d.name} <span style={{color:C.textMuted,fontSize:9}}>({d.sku})</span></td>
          <td style={{padding:6}}>{d.color}/{d.size}</td>
          <td style={{padding:6,fontSize:9,color:C.textMuted}}>{d.ean||"—"}</td>
          <td style={{padding:6}}>{d.stock}</td>
          <td style={{padding:6,fontWeight:700,color:C.danger}}>{d.defective}</td>
          <td style={{padding:6,color:C.textMuted}}>{d.cost_price?`${(d.defective*parseFloat(d.cost_price)).toFixed(2)}€`:"—"}</td>
        </tr>))}</tbody></table>}
      {defectiveStock.length>0&&<div style={{marginTop:8,fontSize:10,color:C.textMuted,fontWeight:600}}>
        Total défectueux: {defectiveStock.reduce((s,d)=>s+d.defective,0)} unités
        {defectiveStock.some(d=>d.cost_price)&&` — Valeur: ${defectiveStock.reduce((s,d)=>s+d.defective*parseFloat(d.cost_price||0),0).toFixed(2)}€`}</div>}
    </div>}

    {tab==="adjust"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Ajustement de stock manuel</h3>
      <p style={{fontSize:11,color:C.textMuted,marginBottom:12}}>Inventaire, casse, perte, correction d'erreur…</p>
      <Input placeholder="Scanner EAN ou saisir code-barres..." style={{marginBottom:10,height:36,fontSize:12,borderColor:C.primary,borderWidth:2}}
        onKeyDown={e=>{if(e.key==="Enter"){const r=resolveEAN(e.target.value.trim());if(r){setAdjProd(r.productId);setAdjVar(r.variantId);setAdjQty(String(r.variant.stock));setStSearchAdj("");e.target.value="";notify(`${r.product.name} ${r.variant.color}/${r.variant.size} — stock: ${r.variant.stock}`,"info");}else{notify("EAN inconnu: "+e.target.value,"warn");e.target.value="";}}}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>PRODUIT</label>
          <Input value={stSearchAdj} onChange={e=>setStSearchAdj(e.target.value)} placeholder="Rechercher (nom, SKU, EAN)..." style={{marginBottom:4,height:28,fontSize:10,padding:"2px 8px"}}/>
          <select value={adjProd} onChange={e=>{setAdjProd(e.target.value);setAdjVar("");setAdjQty("");}} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
            <option value="">Sélectionner…</option>{products.filter(p=>!stSearchAdj||p.name.toLowerCase().includes(stSearchAdj.toLowerCase())||p.sku.toLowerCase().includes(stSearchAdj.toLowerCase())||(p.variants||[]).some(v=>(v.ean||"").includes(stSearchAdj))).map(p=>(<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}</select></div>
        {adjProd&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>VARIANTE</label>
          <select value={adjVar} onChange={e=>{setAdjVar(e.target.value);const pr=products.find(x=>x.id===adjProd);const v=pr?.variants.find(x=>x.id===e.target.value);if(v)setAdjQty(String(v.stock));}} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
            <option value="">Sélectionner…</option>{products.find(x=>x.id===adjProd)?.variants.map(v=>(<option key={v.id} value={v.id}>{v.color}/{v.size} (stock: {v.stock})</option>))}</select></div>}
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>NOUVEAU STOCK</label>
          <Input type="number" value={adjQty} onChange={e=>setAdjQty(e.target.value)} placeholder="Quantité réelle"/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>MOTIF</label>
          <select value={adjReason} onChange={e=>setAdjReason(e.target.value)} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
            <option value="INVENTAIRE">Inventaire</option><option value="CASSE">Casse</option>
            <option value="PERTE">Perte</option><option value="VOL">Vol</option>
            <option value="CORRECTION">Correction d'erreur</option><option value="AUTRE">Autre</option></select></div></div>
      {adjProd&&adjVar&&adjQty&&(()=>{const pr=products.find(x=>x.id===adjProd);const v=pr?.variants.find(x=>x.id===adjVar);
        const diff=parseInt(adjQty)-v.stock;
        return diff!==0?<div style={{padding:8,borderRadius:8,background:diff>0?C.primaryLight:C.dangerLight,marginBottom:10,fontSize:11,fontWeight:600,
          color:diff>0?C.primary:C.danger}}>{diff>0?`+${diff}`:diff} unité(s) — Stock actuel: {v.stock} → Nouveau: {adjQty}</div>:
          <div style={{padding:8,borderRadius:8,background:C.surfaceAlt,marginBottom:10,fontSize:11,color:C.textMuted}}>Aucun changement</div>;})()}
      <Btn onClick={()=>{if(adjProd&&adjVar&&adjQty!==""){adjustStock(adjProd,adjVar,parseInt(adjQty),adjReason);setAdjProd("");setAdjVar("");setAdjQty("");}}}
        disabled={!adjProd||!adjVar||adjQty===""} style={{width:"100%",height:40,background:C.primary}}>
        <Save size={14}/> Enregistrer l'ajustement</Btn>
    </div>}

    {/* Inventory tab */}
    {tab==="inventory"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Inventaire complet</h3>
      <Input value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="Rechercher produit (nom, SKU, EAN)..." style={{marginBottom:10,height:32,fontSize:11,padding:"4px 10px"}}
        onKeyDown={e=>{if(e.key==="Enter"){const r=resolveEAN(invSearch.trim());if(r){setInvSearch(r.product.name);notify(`${r.product.name} ${r.variant.color}/${r.variant.size}`,"info");}}}}/>
      <div style={{maxHeight:400,overflowY:"auto",marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr style={{borderBottom:`2px solid ${C.border}`,position:"sticky",top:0,background:C.surface}}>
            {["Produit","Variante","EAN","Stock actuel","Stock compté","Écart"].map(h=>(<th key={h} style={{padding:6,textAlign:"left",fontSize:9,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
          <tbody>{products.filter(p=>!invSearch||p.name.toLowerCase().includes(invSearch.toLowerCase())||p.sku.toLowerCase().includes(invSearch.toLowerCase())||(p.variants||[]).some(v=>(v.ean||"").includes(invSearch))).flatMap(p=>
            p.variants.map(v=>{const key=`${p.id}_${v.id}`;const counted=invCounts[key];const diff=counted!==undefined&&counted!==""?parseInt(counted)-v.stock:null;
              return(<tr key={key} style={{borderBottom:`1px solid ${C.border}`,background:diff!==null&&diff!==0?(diff>0?C.primaryLight:C.dangerLight):"transparent"}}>
                <td style={{padding:6,fontWeight:600}}>{p.name} <span style={{color:C.textMuted,fontSize:9}}>({p.sku})</span></td>
                <td style={{padding:6}}>{v.color}/{v.size}</td>
                <td style={{padding:6,fontFamily:"monospace",fontSize:9}}>{v.ean||"—"}</td>
                <td style={{padding:6,fontWeight:700}}>{v.stock}</td>
                <td style={{padding:6}}><input type="number" min="0" value={invCounts[key]??""}
                  onChange={e=>setInvCounts(prev=>({...prev,[key]:e.target.value}))}
                  style={{width:60,padding:"3px 6px",borderRadius:6,border:`1.5px solid ${C.border}`,fontSize:11,textAlign:"center",fontFamily:"inherit"}}/></td>
                <td style={{padding:6,fontWeight:700,color:diff===null||diff===0?C.textMuted:diff>0?"#059669":C.danger}}>
                  {diff!==null?(diff>0?`+${diff}`:diff):"—"}</td></tr>);})
          )}</tbody></table></div>
      <Btn onClick={()=>{let count=0;Object.entries(invCounts).forEach(([key,val])=>{if(val===""||val===undefined)return;
        const[pid,vid]=key.split("_");const pr=products.find(x=>x.id===pid);const vr=pr?.variants.find(x=>x.id===vid);
        if(pr&&vr&&parseInt(val)!==vr.stock){adjustStock(pid,vid,parseInt(val),"INVENTAIRE");count++;}});
        setInvCounts({});notify(`${count} ajustement(s) validé(s)`,"success");}}
        disabled={!Object.values(invCounts).some(v=>v!==""&&v!==undefined)}
        style={{width:"100%",height:40,background:C.primary}}><Save size={14}/> Valider l'inventaire</Btn>
    </div>}

    {/* Stock receipt modal */}
    <Modal open={rcModal} onClose={()=>setRcModal(false)} title="Réception de marchandise">
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn variant="outline" onClick={()=>{setCsvStockModal(true);setCsvStStep(0);setCsvStData([]);setCsvStPreview([]);setCsvStResult(null);setCsvStMode("add");setCsvStMatchField("ean");}} style={{fontSize:10,padding:"4px 10px"}}><Upload size={11}/> Import CSV stock</Btn></div>
        <Input value={stSearchReceipt} onChange={e=>setStSearchReceipt(e.target.value)} placeholder="Rechercher produit..." style={{height:28,fontSize:10,padding:"2px 8px"}}/>
        <select value={rcProd} onChange={e=>{setRcProd(e.target.value);setRcVar("");}} style={{padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
          <option value="">Sélectionner un produit</option>{products.filter(p=>!stSearchReceipt||p.name.toLowerCase().includes(stSearchReceipt.toLowerCase())||p.sku.toLowerCase().includes(stSearchReceipt.toLowerCase())).map(p=>(<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}</select>
        {rcProd&&<select value={rcVar} onChange={e=>setRcVar(e.target.value)} style={{padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
          <option value="">Variante</option>{products.find(x=>x.id===rcProd)?.variants.map(v=>(<option key={v.id} value={v.id}>{v.color}/{v.size} (stock: {v.stock})</option>))}</select>}
        <Input type="number" value={rcQty} onChange={e=>setRcQty(e.target.value)} placeholder="Quantité reçue"/>
        <Input value={rcSup} onChange={e=>setRcSup(e.target.value)} placeholder="Fournisseur"/></div>
      <Btn onClick={()=>{if(rcProd&&rcVar&&rcQty){receiveStock(rcProd,rcVar,parseInt(rcQty),rcSup||"Non spécifié");setRcModal(false);setRcQty("");setRcSup("");}}}
        style={{width:"100%",height:40,background:C.primary}}><Upload size={14}/> Enregistrer la réception</Btn></Modal>

    {/* CSV Stock Import Modal — matching configurable + mode add/replace */}
    <Modal open={csvStockModal} onClose={()=>{setCsvStockModal(false);setCsvStStep(0);setCsvStResult(null);}} title="Import CSV stock" wide>
      {/* STEP 0: Upload + config */}
      {csvStStep===0&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <div style={{padding:12,borderRadius:12,border:`2px solid ${csvStMode==="add"?C.primary:C.border}`,background:csvStMode==="add"?`${C.primary}08`:"transparent",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
            onClick={()=>setCsvStMode("add")}>
            <Upload size={20} color={csvStMode==="add"?C.primary:C.textMuted} style={{marginBottom:4}}/>
            <div style={{fontSize:12,fontWeight:700,color:csvStMode==="add"?C.primary:C.text}}>Ajouter au stock</div>
            <div style={{fontSize:10,color:C.textMuted}}>Les quantites du CSV s'ajoutent au stock existant</div></div>
          <div style={{padding:12,borderRadius:12,border:`2px solid ${csvStMode==="replace"?"#D97706":C.border}`,background:csvStMode==="replace"?"#FEF3C710":"transparent",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
            onClick={()=>setCsvStMode("replace")}>
            <RotateCcw size={20} color={csvStMode==="replace"?"#D97706":C.textMuted} style={{marginBottom:4}}/>
            <div style={{fontSize:12,fontWeight:700,color:csvStMode==="replace"?"#D97706":C.text}}>Remplacer le stock</div>
            <div style={{fontSize:10,color:C.textMuted}}>Le stock est ecrase par la quantite du CSV</div></div></div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,color:C.textMuted,display:"block",marginBottom:4}}>CHAMP DE CORRESPONDANCE</label>
          <select value={csvStMatchField} onChange={e=>setCsvStMatchField(e.target.value)}
            style={{width:"100%",padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}}>
            <option value="ean">Code-barres EAN</option>
            <option value="sku">Reference / SKU</option>
            <option value="name_color_size">Nom produit + Couleur + Taille</option></select>
          <div style={{fontSize:9,color:C.textLight,marginTop:3}}>Le champ utilise pour faire correspondre les lignes CSV avec les variantes existantes</div></div>
        <div style={{textAlign:"center",padding:14,border:`2px dashed ${C.border}`,borderRadius:12,marginBottom:8}}>
          <Upload size={28} color={C.primary} style={{marginBottom:6}}/>
          <p style={{fontSize:11,color:C.textMuted,marginBottom:8}}>CSV avec colonnes correspondant au champ choisi + quantite</p>
          <input type="file" accept=".csv,.txt,.xls,.xlsx" onChange={e=>{const file=e.target.files[0];if(!file)return;
            Papa.parse(file,{header:true,skipEmptyLines:true,complete:(r)=>{if(!r.data.length){notify("Fichier vide","error");return;}
              setCsvStHeaders(r.meta.fields||[]);setCsvStData(r.data);
              // Auto-mapping intelligent
              const map={};(r.meta.fields||[]).forEach(h=>{const hl=h.toLowerCase().trim().replace(/[^a-z0-9]/g,"");
                if(["sku","ref","reference","code","codearticle","refarticle","codeproduit"].includes(hl))map[h]="sku";
                else if(["ean","ean13","barcode","codebarre","codebarres","gtin"].includes(hl))map[h]="ean";
                else if(["quantity","quantite","qty","qte","stock","stockqty","enstock","quantiteenstock"].includes(hl))map[h]="stock";
                else if(["nom","name","produit","product","designation","libelle","article","nomproduit"].includes(hl))map[h]="name";
                else if(["couleur","color","colour","coloris"].includes(hl))map[h]="color";
                else if(["taille","size","pointure","dimension"].includes(hl))map[h]="size";
                else if(["supplier","fournisseur","source"].includes(hl))map[h]="supplier";});
              setCsvStMapping(map);setCsvStStep(1);}});}} style={{fontSize:11}}/></div></div>}

      {/* STEP 1: Column mapping */}
      {csvStStep===1&&<div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:700}}>Associer les colonnes ({csvStData.length} lignes)</div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <Badge color={csvStMode==="add"?C.primary:"#D97706"}>{csvStMode==="add"?"Ajout":"Remplacement"}</Badge>
            <Badge color={C.info}>{csvStMatchField==="ean"?"EAN":csvStMatchField==="sku"?"SKU":"Nom+Couleur+Taille"}</Badge></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
          {csvStHeaders.map(h=>(<div key={h} style={{display:"flex",alignItems:"center",gap:6,padding:8,borderRadius:8,background:csvStMapping[h]?`${C.primary}08`:C.surfaceAlt,
            border:`1.5px solid ${csvStMapping[h]?C.primary+"30":C.border}`}}>
            <span style={{fontSize:11,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={h}>{h}</span>
            <select value={csvStMapping[h]||""} onChange={e=>{const v=e.target.value;setCsvStMapping(p=>{const n={...p};if(!v)delete n[h];else n[h]=v;return n;});}}
              style={{padding:4,borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,fontFamily:"inherit",minWidth:100}}>
              <option value="">-- ignorer --</option>
              <option value="ean">EAN / Code-barres</option>
              <option value="sku">SKU / Reference</option>
              <option value="name">Nom produit</option>
              <option value="color">Couleur</option>
              <option value="size">Taille</option>
              <option value="stock">Quantite / Stock</option>
              <option value="supplier">Fournisseur</option></select></div>))}</div>
        {/* Apercu premiere ligne */}
        {csvStData.length>0&&<div style={{padding:8,background:C.surfaceAlt,borderRadius:8,marginBottom:10,fontSize:10}}>
          <div style={{fontWeight:700,marginBottom:4,color:C.textMuted}}>Apercu 1ere ligne :</div>
          {Object.entries(csvStMapping).filter(([,v])=>v).map(([col,role])=>(<span key={col} style={{display:"inline-block",marginRight:10}}>
            <span style={{color:C.textMuted}}>{role}:</span> <span style={{fontWeight:600}}>{csvStData[0][col]||"(vide)"}</span></span>))}</div>}
        <div style={{display:"flex",gap:6}}>
          <Btn variant="outline" onClick={()=>setCsvStStep(0)} style={{flex:1}}>Retour</Btn>
          <Btn onClick={()=>{
            // Validation
            const hasStock=Object.values(csvStMapping).includes("stock");
            if(!hasStock){notify("Associez au moins une colonne 'Quantite / Stock'","error");return;}
            const matchField=csvStMatchField;
            if(matchField==="ean"&&!Object.values(csvStMapping).includes("ean")){notify("Associez une colonne EAN (mode matching EAN)","error");return;}
            if(matchField==="sku"&&!Object.values(csvStMapping).includes("sku")){notify("Associez une colonne SKU (mode matching SKU)","error");return;}
            if(matchField==="name_color_size"&&(!Object.values(csvStMapping).includes("name")||!Object.values(csvStMapping).includes("color")||!Object.values(csvStMapping).includes("size"))){
              notify("Associez les colonnes Nom, Couleur et Taille (mode matching Nom+Couleur+Taille)","error");return;}
            // Build preview
            const getF=(row,f)=>{const h=Object.entries(csvStMapping).find(([,v])=>v===f);return h?(row[h[0]]??"").toString().trim():"";};
            const rows=csvStData.map(row=>{
              const ean=getF(row,"ean");const sku=getF(row,"sku");const name=getF(row,"name");const color=getF(row,"color");const size=getF(row,"size");
              const stockVal=parseInt(getF(row,"stock"));const qty=isNaN(stockVal)?null:stockVal;const sup=getF(row,"supplier");
              // Matching
              let match=null;
              for(const p of products){for(const v of (p.variants||[])){
                if(matchField==="ean"&&ean&&v.ean&&v.ean.toLowerCase()===ean.toLowerCase()){match={product:p,variant:v};break;}
                if(matchField==="sku"&&sku&&p.sku&&p.sku.toLowerCase()===sku.toLowerCase()){match={product:p,variant:v};break;}
                if(matchField==="name_color_size"&&name&&color&&size&&
                  p.name.toLowerCase().trim()===name.toLowerCase().trim()&&
                  (v.color||"").toLowerCase().trim()===color.toLowerCase().trim()&&
                  (v.size||"").toLowerCase().trim()===size.toLowerCase().trim()){match={product:p,variant:v};break;}
              }if(match)break;}
              const currentStock=match?match.variant.stock:null;
              const newStock=match&&qty!==null?(csvStMode==="add"?currentStock+qty:qty):null;
              const diff=match&&newStock!==null?newStock-currentStock:null;
              return{ean,sku,name:name||match?.product.name||"",color:color||match?.variant.color||"",size:size||match?.variant.size||"",
                qty,supplier:sup,match,currentStock,newStock,diff,status:match?(qty!==null?"found":"no_qty"):"not_found"};});
            setCsvStPreview(rows);setCsvStStep(2);}}
            style={{flex:2,height:36,background:C.primary}}><Search size={12}/> Analyser et previsualiser</Btn></div></div>}

      {/* STEP 2: Preview + confirm */}
      {csvStStep===2&&!csvStResult&&<div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700}}>Previsualisation</div>
          <div style={{display:"flex",gap:6}}>
            <Badge color="#059669">{csvStPreview.filter(r=>r.status==="found").length} trouves</Badge>
            <Badge color={C.danger}>{csvStPreview.filter(r=>r.status==="not_found").length} non trouves</Badge>
            {csvStPreview.some(r=>r.status==="no_qty")&&<Badge color={C.warn}>{csvStPreview.filter(r=>r.status==="no_qty").length} sans qte</Badge>}</div></div>
        {csvStMode==="replace"&&<div style={{padding:8,background:"#FEF3C7",border:"1.5px solid #D97706",borderRadius:8,marginBottom:8,fontSize:10,color:"#92400E",display:"flex",alignItems:"center",gap:6}}>
          <AlertTriangle size={14} color="#D97706"/> Le stock existant sera ecrase par les valeurs du CSV pour les lignes trouvees.</div>}
        <div style={{maxHeight:340,overflowY:"auto",marginBottom:10,border:`1px solid ${C.border}`,borderRadius:10}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
            <thead><tr style={{borderBottom:`2px solid ${C.border}`,position:"sticky",top:0,background:C.surface}}>
              {["Ref","Produit","Variante","Stock actuel",csvStMode==="add"?"+ Ajout":"Nouveau stock","Resultat","Statut"].map(h=>(
                <th key={h} style={{padding:"6px 4px",textAlign:"left",fontSize:9,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
            <tbody>{csvStPreview.map((r,i)=>{
              const bgColor=r.status==="found"?"transparent":r.status==="no_qty"?`${C.warn}10`:C.dangerLight+"40";
              return(<tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:bgColor}}>
                <td style={{padding:4,fontFamily:"monospace",fontSize:9}}>{r.ean||r.sku||"—"}</td>
                <td style={{padding:4,fontWeight:600,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={r.name}>{r.name||"—"}</td>
                <td style={{padding:4}}>{r.match?`${r.match.variant.color} / ${r.match.variant.size}`:(r.color&&r.size?`${r.color} / ${r.size}`:"—")}</td>
                <td style={{padding:4,fontFamily:"monospace",textAlign:"center"}}>{r.currentStock!==null?r.currentStock:"—"}</td>
                <td style={{padding:4,fontFamily:"monospace",textAlign:"center",fontWeight:700,color:csvStMode==="add"?C.primary:"#D97706"}}>{r.qty!==null?(csvStMode==="add"?`+${r.qty}`:r.qty):"—"}</td>
                <td style={{padding:4,fontFamily:"monospace",textAlign:"center",fontWeight:700}}>
                  {r.newStock!==null?<span style={{color:r.diff>0?"#059669":r.diff<0?C.danger:C.text}}>{r.newStock} ({r.diff>0?"+":""}{r.diff})</span>:"—"}</td>
                <td style={{padding:4}}>{r.status==="found"?<Badge color="#059669">OK</Badge>:r.status==="no_qty"?<Badge color={C.warn}>Sans qte</Badge>:<Badge color={C.danger}>Non trouve</Badge>}</td>
              </tr>);})}</tbody></table></div>
        <div style={{display:"flex",gap:6}}>
          <Btn variant="outline" onClick={()=>setCsvStStep(1)} style={{flex:1}}>Retour</Btn>
          <Btn onClick={async()=>{
            const toProcess=csvStPreview.filter(r=>r.status==="found"&&r.qty!==null&&r.match);
            if(!toProcess.length){notify("Aucune ligne a traiter","warn");return;}
            setCsvStImporting(true);
            let ok=0,err=0;
            for(const r of toProcess){
              try{
                if(csvStMode==="add"){
                  await receiveStock(r.match.product.id,r.match.variant.id,r.qty,r.supplier||"Import CSV");
                }else{
                  await adjustStock(r.match.product.id,r.match.variant.id,r.qty,r.supplier?`Import CSV (${r.supplier})`:"Import CSV - remplacement stock");
                }
                ok++;
              }catch(e){err++;console.warn("Stock import error:",e.message);}
            }
            setCsvStImporting(false);
            setCsvStResult({ok,err,total:toProcess.length});
            addAudit("STOCK",`Import CSV stock (${csvStMode}) — ${ok}/${toProcess.length} lignes traitees`);
          }} disabled={csvStImporting||!csvStPreview.some(r=>r.status==="found"&&r.qty!==null)}
            style={{flex:2,height:40,background:csvStMode==="add"?C.primary:"#D97706"}}>
            {csvStImporting?<span className="spin-loader"/>:<><Upload size={14}/> {csvStMode==="add"?"Ajouter":"Remplacer"} le stock — {csvStPreview.filter(r=>r.status==="found"&&r.qty!==null).length} ligne(s)</>}</Btn></div></div>}

      {/* STEP 2b: Result */}
      {csvStResult&&<div style={{textAlign:"center",padding:20}}>
        <CheckCircle2 size={40} color="#059669" style={{marginBottom:10}}/>
        <div style={{fontSize:16,fontWeight:800,marginBottom:6}}>Import termine</div>
        <div style={{fontSize:13,color:C.textMuted,marginBottom:14}}>
          <span style={{color:"#059669",fontWeight:700}}>{csvStResult.ok}</span> ligne(s) traitee(s) sur {csvStResult.total}
          {csvStResult.err>0&&<span style={{color:C.danger,marginLeft:8}}>{csvStResult.err} erreur(s)</span>}</div>
        <Btn onClick={()=>{setCsvStockModal(false);setCsvStStep(0);setCsvStResult(null);setCsvStPreview([]);setCsvStData([]);}}
          style={{width:"100%",height:40,background:C.primary}}>Fermer</Btn></div>}
    </Modal>

    {tab==="tenues"&&<TenuesTab products={products} setProducts={setProducts} users={users} tenUser={tenUser} setTenUser={setTenUser}
      tenItems={tenItems} setTenItems={setTenItems} tenSaving={tenSaving} setTenSaving={setTenSaving}
      tenHistoryFilter={tenHistoryFilter} setTenHistoryFilter={setTenHistoryFilter}
      tenScanRef={tenScanRef} tenAddByEAN={tenAddByEAN} resolveEAN={resolveEAN}
      stockMoves={stockMoves} addStockMove={addStockMove} addAudit={addAudit} notify={notify}
      setScanOverride={setScanOverride} clearScanOverride={clearScanOverride} findByEAN={findByEAN}/>}

    {tab==="transfers"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Transfert de stock</h3>
      <div style={{padding:10,background:C.primaryLight,borderRadius:8,marginBottom:12,fontSize:11,color:C.primaryDark,border:`1px solid ${C.primary}22`}}>
        Transférez du stock vers un autre magasin ou une entité externe. Un justificatif est généré automatiquement.</div>
      <Input placeholder="Scanner EAN ou saisir code-barres..." style={{marginBottom:10,height:36,fontSize:12,borderColor:C.info,borderWidth:2}}
        onKeyDown={e=>{if(e.key==="Enter"){const r=resolveEAN(e.target.value.trim());if(r){setTrProd(r.productId);setTrVar(r.variantId);e.target.value="";notify(`${r.product.name} ${r.variant.color}/${r.variant.size} (stock: ${r.variant.stock})`,"info");}else{notify("EAN inconnu: "+e.target.value,"warn");e.target.value="";}}}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>PRODUIT</label>
          <select value={trProd} onChange={e=>{setTrProd(e.target.value);setTrVar("");}} style={{width:"100%",padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}}>
            <option value="">Sélectionner…</option>
            {products.map(p=>(<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}</select></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>VARIANTE</label>
          <select value={trVar} onChange={e=>setTrVar(e.target.value)} style={{width:"100%",padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}}>
            <option value="">Sélectionner…</option>
            {(products.find(p=>p.id===trProd)?.variants||[]).map(v=>(<option key={v.id} value={v.id}>{v.color} / {v.size} (stock: {v.stock})</option>))}</select></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>DESTINATION</label>
          <Input value={trDest} onChange={e=>setTrDest(e.target.value)} placeholder="Boutique Paris, Site web, Dépôt…" style={{height:36}}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>QUANTITÉ</label>
          <Input type="number" value={trQty} onChange={e=>setTrQty(e.target.value)} min="1" style={{height:36}}/></div>
        <div style={{gridColumn:"span 2"}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>RÉFÉRENCE / MOTIF</label>
          <Input value={trRef} onChange={e=>setTrRef(e.target.value)} placeholder="N° bon de transfert, motif…" style={{height:36}}/></div></div>
      <Btn onClick={async()=>{if(!trProd||!trVar||!trDest){notify("Remplissez produit, variante et destination","error");return;}
        const q=parseInt(trQty)||1;const prod=products.find(p=>p.id===trProd);const vari=prod?.variants.find(v=>v.id===trVar);
        if(!prod||!vari){notify("Produit introuvable","error");return;}
        if(vari.stock<q){notify(`Stock insuffisant (${vari.stock} dispo)`,"error");return;}
        const transferNum=`TR-${Date.now().toString(36).toUpperCase()}`;
        try{await API.stock.adjust({productId:trProd,variantId:trVar,quantity:-q,reason:`Transfert ${transferNum} → ${trDest}`});
          const prods=await API.products.list();setProducts(norm.products(prods));}
        catch(e){setProducts(prev=>prev.map(p=>p.id===trProd?{...p,variants:p.variants.map(v=>v.id===trVar?{...v,stock:Math.max(0,v.stock-q)}:v)}:p));}
        addStockMove("TRANSFERT",prod,vari,-q,`${transferNum} → ${trDest}`);
        addAudit("TRANSFERT",`${prod.name} ${vari.color}/${vari.size} x${q} → ${trDest} (${trRef||"sans réf"})`,transferNum);
        const slip=`JUSTIFICATIF DE TRANSFERT\n${"═".repeat(40)}\nN°: ${transferNum}\nDate: ${new Date().toLocaleString("fr-FR")}\nOrigine: ${settings.name||"Magasin"}\nDestination: ${trDest}\n${"─".repeat(40)}\nProduit: ${prod.name}\nVariante: ${vari.color} / ${vari.size}\nSKU: ${prod.sku}\nQuantité: ${q}\nRéférence: ${trRef||"—"}\n${"─".repeat(40)}\nOpérateur: ${currentUser?.name||"—"}\n\nSignature origine: ________________\nSignature destination: ________________`;
        const blob=new Blob([slip],{type:"text/plain"});const url=URL.createObjectURL(blob);
        const a=document.createElement("a");a.href=url;a.download=`transfert-${transferNum}.txt`;a.click();URL.revokeObjectURL(url);
        notify(`Transfert ${transferNum} — ${prod.name} x${q} → ${trDest} — Justificatif téléchargé`,"success");
        setTrProd("");setTrVar("");setTrQty("1");setTrDest("");setTrRef("");}}
        style={{width:"100%",height:44,background:C.info}}>Transférer et générer justificatif</Btn>
      <div style={{marginTop:16,fontSize:12,fontWeight:700,marginBottom:8}}>Historique transferts</div>
      {stockMoves.filter(m=>m.type==="TRANSFERT").length===0&&<div style={{color:C.textLight,fontSize:11}}>Aucun transfert</div>}
      {stockMoves.filter(m=>m.type==="TRANSFERT").slice(0,20).map((m,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:6,borderBottom:`1px solid ${C.border}`,fontSize:11}}>
        <span style={{color:C.textMuted,fontSize:9}}>{new Date(m.date).toLocaleDateString("fr-FR")}</span>
        <span style={{fontWeight:600}}>{m.productName}</span>
        <span style={{color:C.textMuted}}>{m.variantColor}/{m.variantSize}</span>
        <span style={{fontWeight:700,color:C.info}}>x{Math.abs(m.qty)}</span>
        <span style={{color:C.primary,fontWeight:600}}>{m.ref}</span></div>))}</div>}

  </div>);
}

/* ══════════ TENUES TAB ══════════ */
function TenuesTab({products,setProducts,users,tenUser,setTenUser,tenItems,setTenItems,tenSaving,setTenSaving,
  tenHistoryFilter,setTenHistoryFilter,tenScanRef,tenAddByEAN,resolveEAN,
  stockMoves,addStockMove,addAudit,notify,setScanOverride,clearScanOverride,findByEAN}){

  const[manualSearch,setManualSearch]=useState("");

  // Register scan override when this tab is active
  useEffect(()=>{
    setScanOverride((code)=>{
      if(!tenUser){notify("Sélectionnez d'abord un employé avant de scanner","warn");return;}
      tenAddByEAN(code);
    });
    return()=>clearScanOverride();
  },[setScanOverride,clearScanOverride,tenAddByEAN,tenUser,notify]);

  // Focus scan input on mount
  useEffect(()=>{if(tenScanRef.current)tenScanRef.current.focus();},[]);

  // Manual search results
  const searchResults=useMemo(()=>{if(!manualSearch||manualSearch.length<2)return[];const q=manualSearch.toLowerCase();
    return products.filter(p=>p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)||(p.variants||[]).some(v=>(v.ean||"").includes(q)||(v.color||"").toLowerCase().includes(q))).slice(0,8);
  },[products,manualSearch]);

  const addManualItem=(prod,vari)=>{
    setTenItems(prev=>{const idx=prev.findIndex(i=>i.variantId===vari.id);
      if(idx>=0){const next=[...prev];next[idx]={...next[idx],qty:next[idx].qty+1};return next;}
      return[...prev,{productId:prod.id,variantId:vari.id,name:prod.name,sku:prod.sku,color:vari.color,colorCode:vari.colorCode||"",size:vari.size,ean:vari.ean||"",stock:vari.stock,qty:1}];});
    notify(`${prod.name} ${vari.color}/${vari.size} ajouté`,"info");
    setManualSearch("");
  };

  const tenuesHistory=stockMoves.filter(m=>m.type==="TENUE");
  const filteredHistory=tenHistoryFilter
    ?tenuesHistory.filter(m=>(m.ref||"").toLowerCase().includes(tenHistoryFilter.toLowerCase()))
    :tenuesHistory;
  const employeeNames=[...new Set(tenuesHistory.map(m=>{const match=(m.ref||"").match(/Tenue (.+)/);return match?match[1]:null;}).filter(Boolean))];

  const validateAll=async()=>{
    if(!tenUser){notify("Sélectionnez un employé","error");return;}
    if(tenItems.length===0){notify("Ajoutez au moins un article","error");return;}
    setTenSaving(true);
    let ok=0,err=0;
    for(const item of tenItems){
      const prod=products.find(p=>p.id===item.productId);const vari=prod?.variants.find(v=>v.id===item.variantId);
      if(!prod||!vari){err++;continue;}
      try{await API.stock.adjust({productId:item.productId,variantId:item.variantId,quantity:-item.qty,reason:`Tenue employé: ${tenUser}`});ok++;}
      catch(e){
        setProducts(prev=>prev.map(p=>p.id===item.productId?{...p,variants:p.variants.map(v=>v.id===item.variantId?{...v,stock:Math.max(0,v.stock-item.qty)}:v)}:p));
        ok++;
      }
      addStockMove("TENUE",prod,vari,-item.qty,`Tenue ${tenUser}`);
      addAudit("TENUE",`${prod.name} ${vari?.color||""}/${vari?.size||""} x${item.qty} — ${tenUser}`);
    }
    // Refresh products
    try{const prods=await API.products.list();setProducts(norm.products(prods));}catch(e){}
    notify(`${ok} article(s) sorti(s) en tenue pour ${tenUser}${err>0?` (${err} erreur(s))`:""}`,"success");
    setTenItems([]);setTenSaving(false);
  };

  return(<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
    <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Sortie stock — Tenue employé</h3>
    <div style={{padding:10,background:C.warnLight,borderRadius:8,marginBottom:12,fontSize:11,color:"#92400E",border:`1px solid ${C.warn}33`}}>
      1. Sélectionnez un employé — 2. Scannez ou recherchez les articles — 3. Validez la liste</div>

    {/* Employé selector */}
    <div style={{marginBottom:12}}>
      <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:"0.5px"}}>EMPLOYÉ</label>
      <select value={tenUser} onChange={e=>setTenUser(e.target.value)} style={{width:"100%",padding:10,borderRadius:8,border:`1.5px solid ${tenUser?C.accent:C.danger}`,fontSize:12,fontWeight:600,fontFamily:"inherit",background:tenUser?C.accentLight+"40":"transparent"}}>
        <option value="">Sélectionner un employé…</option>
        {(users||[]).map(u=>(<option key={u.id} value={u.name}>{u.name}</option>))}</select>
    </div>

    {/* EAN scan input */}
    <Input ref={tenScanRef} placeholder={tenUser?"Scanner EAN ou saisir code-barres...":"Sélectionnez d'abord un employé"} disabled={!tenUser}
      style={{marginBottom:8,height:40,fontSize:13,borderColor:tenUser?C.accent:C.border,borderWidth:2,fontWeight:600}}
      onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){tenAddByEAN(e.target.value.trim());e.target.value="";}}}/>

    {/* Manual search — no barcode */}
    <div style={{marginBottom:12}}>
      <Input value={manualSearch} onChange={e=>setManualSearch(e.target.value)} disabled={!tenUser}
        placeholder={tenUser?"Rechercher par nom, réf, couleur...":""}
        style={{height:36,fontSize:12,borderColor:C.border}}/>
      {searchResults.length>0&&<div style={{border:`1.5px solid ${C.border}`,borderRadius:10,marginTop:4,maxHeight:220,overflowY:"auto",background:C.surface}}>
        {searchResults.map(p=>(
          <div key={p.id}>
            <div style={{padding:"6px 10px",background:C.surfaceAlt,fontSize:11,fontWeight:700,display:"flex",gap:6,alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
              <span>{p.name}</span>
              <span style={{fontSize:9,fontFamily:"monospace",color:C.textMuted}}>Réf: {p.sku}</span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,padding:"6px 10px"}}>
              {(p.variants||[]).map(v=>(
                <button key={v.id} onClick={()=>addManualItem(p,v)}
                  style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",
                    fontSize:10,fontWeight:600,display:"flex",alignItems:"center",gap:4,transition:"all 0.12s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.background=C.accentLight+"40";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background="transparent";}}>
                  <span style={{color:C.accent}}>{v.color}</span>
                  {v.colorCode&&<span style={{fontSize:8,fontFamily:"monospace",color:C.textMuted}}>{v.colorCode}</span>}
                  <span style={{color:C.info,fontWeight:700}}>{v.size}</span>
                  <span style={{fontSize:8,color:v.stock>0?C.textMuted:C.danger}}>{v.stock>0?`stk:${v.stock}`:"Rupture"}</span>
                </button>))}
            </div>
          </div>))}
      </div>}
    </div>

    {/* Items list */}
    {tenItems.length>0&&<div style={{marginBottom:12,border:`1.5px solid ${C.accent}33`,borderRadius:10,overflow:"hidden"}}>
      <div style={{background:C.accentLight+"30",padding:"6px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.accent}22`}}>
        <span style={{fontSize:11,fontWeight:700,color:C.accent}}>{tenItems.length} article(s) — {tenItems.reduce((s,i)=>s+i.qty,0)} pièce(s)</span>
        <button onClick={()=>setTenItems([])} style={{background:"none",border:"none",cursor:"pointer",color:C.danger,fontSize:10,fontWeight:600,display:"flex",alignItems:"center",gap:3}}>
          <Trash2 size={11}/> Vider</button></div>
      <div style={{maxHeight:200,overflowY:"auto"}}>
        {tenItems.map((item,i)=>(<div key={item.variantId} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderBottom:`1px solid ${C.border}`,fontSize:11}}>
          <div style={{flex:1}}>
            <span style={{fontWeight:600}}>{item.name}</span>
            <span style={{color:C.textMuted,marginLeft:6}}>{item.color}/{item.size}</span>
            {item.sku&&<span style={{color:C.textMuted,marginLeft:4,fontSize:9}}>({item.sku})</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <button onClick={()=>setTenItems(prev=>prev.map((x,j)=>j===i?{...x,qty:Math.max(1,x.qty-1)}:x))}
              style={{width:22,height:22,borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
            <span style={{fontWeight:700,minWidth:20,textAlign:"center"}}>{item.qty}</span>
            <button onClick={()=>setTenItems(prev=>prev.map((x,j)=>j===i?{...x,qty:x.qty+1}:x))}
              style={{width:22,height:22,borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
          </div>
          <span style={{fontSize:9,color:C.textMuted}}>stk:{item.stock}</span>
          <button onClick={()=>setTenItems(prev=>prev.filter((_,j)=>j!==i))}
            style={{background:"none",border:"none",cursor:"pointer",color:C.danger,padding:2}}><Trash2 size={12}/></button>
        </div>))}
      </div>
    </div>}

    {tenItems.length===0&&tenUser&&<div style={{padding:20,textAlign:"center",color:C.textMuted,fontSize:12,border:`1.5px dashed ${C.border}`,borderRadius:10,marginBottom:12}}>
      Scannez ou recherchez les articles pour les ajouter à la liste</div>}

    <Btn onClick={validateAll} disabled={tenSaving||!tenUser||tenItems.length===0}
      style={{width:"100%",height:44,background:C.accent,opacity:(!tenUser||tenItems.length===0)?0.5:1}}>
      {tenSaving?"Enregistrement...":tenItems.length>0?`Valider ${tenItems.reduce((s,i)=>s+i.qty,0)} pièce(s) pour ${tenUser||"…"}`:"Sortir en tenue employé"}</Btn>

    {/* ══ Historique tenues ══ */}
    <div style={{marginTop:20,borderTop:`1.5px solid ${C.border}`,paddingTop:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <h4 style={{fontSize:13,fontWeight:700,margin:0}}>Historique tenues</h4>
        <span style={{fontSize:10,color:C.textMuted}}>({filteredHistory.length} sortie(s))</span>
        <div style={{flex:1}}/>
        <Filter size={12} color={C.textMuted}/>
        <select value={tenHistoryFilter} onChange={e=>setTenHistoryFilter(e.target.value)}
          style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,fontFamily:"inherit",minWidth:120}}>
          <option value="">Tous les employés</option>
          {employeeNames.map(n=>(<option key={n} value={n}>{n}</option>))}
        </select>
      </div>
      {filteredHistory.length===0&&<div style={{color:C.textLight,fontSize:11,textAlign:"center",padding:10}}>Aucune sortie tenue{tenHistoryFilter?` pour "${tenHistoryFilter}"`:""}</div>}
      <div style={{maxHeight:300,overflowY:"auto"}}>
        {filteredHistory.slice(0,50).map((m,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:11}}>
          <span style={{color:C.textMuted,fontSize:9,minWidth:65}}>{new Date(m.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit"})}</span>
          <User size={11} color={C.accent}/>
          <span style={{color:C.accent,fontWeight:600,minWidth:70}}>{(m.ref||"").replace("Tenue ","")}</span>
          <span style={{fontWeight:600}}>{m.productName}</span>
          <span style={{color:C.textMuted}}>{m.variantColor}/{m.variantSize}</span>
          <span style={{fontWeight:700,color:C.danger}}>x{Math.abs(m.qty)}</span>
        </div>))}
      </div>
    </div>
  </div>);
}

export default StockScreen;
export { StockScreen };
