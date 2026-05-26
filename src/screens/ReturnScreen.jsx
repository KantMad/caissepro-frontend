import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Trash2, CreditCard, Banknote, Gift, Plus, Minus, Receipt, RotateCcw, Shield, CheckCircle2, AlertTriangle, Printer, ScanLine, Edit } from "lucide-react";
import printer from "../printer.js";
import { CO, C } from "../constants.jsx";
import { verifyPin, EAN13Svg } from "../utils.jsx";
import { Modal, Btn, Input, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";

function ReturnScreen(){
  const{tickets,products,processReturn,findByEAN,avoirs,settings,notify,printerConnected,thermalPrint,setSelectedAvoir,setMode:setAppMode,users,currentUser,addAudit,isAvoirExpired,setScanOverride,clearScanOverride}=useApp();
  const rp=settings.returnPolicy||{};
  const[mode,setMode]=useState("ticket");// ticket | scan | free
  const[searchTk,setSearchTk]=useState("");const[selectedTk,setSelectedTk]=useState(null);
  const[returnItems,setReturnItems]=useState([]);
  const REASONS=rp.reasons?.length?rp.reasons:["Echange taille","Echange couleur","Defectueux","N'aime plus","Cadeau a retourner","Erreur de commande","Autre"];
  const[reason,setReason]=useState(REASONS[0]);
  const ALL_REFUND_METHODS=[{id:"avoir",l:"Avoir / Credit magasin",i:Gift,d:"Genere un avoir utilisable en caisse",sk:"allowAvoir"},
    {id:"cash",l:"Remboursement especes",i:Banknote,d:"Remboursement immediat en liquide",sk:"allowCashRefund"},
    {id:"card",l:"Remboursement carte",i:CreditCard,d:"Remboursement sur la carte du client",sk:"allowCardRefund"},
    {id:"exchange",l:"Echange immediat",i:RotateCcw,d:"Retour + nouvelle vente, payer la difference",sk:"allowExchange"}];
  const REFUND_METHODS=ALL_REFUND_METHODS.filter(m=>rp[m.sk]!==false);
  const[refundMethod,setRefundMethod]=useState(()=>REFUND_METHODS[0]?.id||"avoir");
  const[restock,setRestock]=useState(rp.autoRestock!==false);const[defective,setDefective]=useState(false);
  const[searchProd,setSearchProd]=useState("");const[freeItem,setFreeItem]=useState(null);const[freeQty,setFreeQty]=useState(1);
  const[lastAvoir,setLastAvoir]=useState(null);const[returnBusy,setReturnBusy]=useState(false);
  const[avoirLookup,setAvoirLookup]=useState("");const[avoirDetail,setAvoirDetail]=useState(null);
  // C5 fix: Manager approval required for free/scan returns
  const[managerApproved,setManagerApproved]=useState(false);const[managerPinInput,setManagerPinInput]=useState("");const[managerPinError,setManagerPinError]=useState("");
  const verifyManagerPin=async()=>{const admin=users.find(u=>u.role==="admin");
    if(!admin){setManagerPinError("Aucun admin trouve");return;}
    const ok=await verifyPin(managerPinInput,admin.pin);
    if(ok){setManagerApproved(true);setManagerPinError("");setManagerPinInput("");addAudit("MANAGER_APPROVE","Approbation manager pour retour libre/scan");}
    else{setManagerPinError("PIN manager incorrect");}};
  // Avoir search for history panel
  const filteredAvoirs=useMemo(()=>{if(!avoirLookup)return avoirs.slice(0,20);const q=avoirLookup.toLowerCase();
    return avoirs.filter(a=>(a.avoirNumber||"").toLowerCase().includes(q)||(a.customerName||"").toLowerCase().includes(q)||
      (a.originalTicket||"").toLowerCase().includes(q)).slice(0,30);},[avoirs,avoirLookup]);

  const foundTickets=useMemo(()=>{if(!searchTk||searchTk.length<2)return[];const q=searchTk.toLowerCase();
    return tickets.filter(t=>(t.ticketNumber||"").toLowerCase().includes(q)||(t.customerName||"").toLowerCase().includes(q)||(t.barcode||"").includes(q))
      .slice(0,10);},[tickets,searchTk]);

  const foundProducts=useMemo(()=>{if(!searchProd||searchProd.length<2)return[];const q=searchProd.toLowerCase();
    return products.filter(p=>p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)||p.variants.some(v=>(v.ean||"").includes(q)))
      .slice(0,8);},[products,searchProd]);

  // ══ Scan override: intercept barcode scans to search products instead of adding to cart ══
  const handleReturnScan=useCallback((code)=>{
    // Try as ticket barcode first
    const tk=tickets.find(t=>t.barcode===code);
    if(tk){setSearchTk(code);setMode("ticket");notify(`Ticket ${tk.ticketNumber} trouvé`,"info");return;}
    // Try as avoir barcode
    const av=avoirs.find(a=>a.barcode===code);
    if(av){setAvoirLookup(code);notify(`Avoir ${av.avoirNumber} trouvé`,"info");return;}
    // Try as product EAN — set search field
    const found=findByEAN(code);
    if(found){setSearchProd(code);if(mode==="ticket")setMode("scan");notify(`${found.product.name} ${found.variant.color}/${found.variant.size} trouvé`,"info");return;}
    notify("Code-barres inconnu: "+code,"warn");
  },[tickets,avoirs,findByEAN,notify,mode]);
  useEffect(()=>{setScanOverride(handleReturnScan);return()=>clearScanOverride();},[setScanOverride,clearScanOverride,handleReturnScan]);

  // C4 fix: compute already-returned quantities for the selected ticket
  const alreadyReturnedMap=useMemo(()=>{if(!selectedTk)return{};const existing=avoirs.filter(a=>a.originalTicket===selectedTk.ticketNumber);
    const map={};existing.forEach(a=>(a.items||[]).forEach(ai=>{const key=`${ai.productId||ai.product?.id}-${ai.variantId||ai.variant?.id}`;map[key]=(map[key]||0)+(ai.qty||ai.quantity||0);}));return map;},[selectedTk,avoirs]);

  const toggleItem=(item,variant,maxQty)=>{const key=`${item.product?.id||item.productId}-${variant?.id||item.variantId}`;
    const alreadyReturned=alreadyReturnedMap[key]||0;const effectiveMax=Math.max(0,(maxQty||item.quantity)-alreadyReturned);
    if(effectiveMax<=0&&mode==="ticket"){notify("Article déjà entièrement remboursé","warn");return;}
    setReturnItems(prev=>{const existing=prev.find(r=>r.key===key);
      if(existing)return prev.filter(r=>r.key!==key);
      return[...prev,{key,productId:item.product?.id||item.productId,variantId:variant?.id||item.variantId,
        productName:item.product?.name||item.product_name,variantColor:variant?.color||item.variant_color,variantSize:variant?.size||item.variant_size,
        qty:1,maxQty:mode==="ticket"?effectiveMax:(maxQty||item.quantity),
        unitPrice:mode==="ticket"?((Number(item.lineTTC||item.line_ttc)||0)/(item.quantity||1)||Number(item.unit_price)||0)
          :(()=>{const pr=item.product||{};const pm=settings.pricingMode||"TTC";const base=pr.price||item.unit_price||0;
            return pm==="TTC"?base:base*(1+(pr.taxRate||0.20));})()}];});};
  const updateReturnQty=(key,qty)=>setReturnItems(prev=>prev.map(r=>r.key===key?{...r,qty:Math.min(Math.max(1,qty),r.maxQty)}:r));
  const returnTotal=Math.round(returnItems.reduce((s,r)=>s+(r.unitPrice||0)*r.qty,0)*100)/100;

  const doReturn=async()=>{if(returnBusy)return;if(!returnItems.length){notify("Selectionnez au moins un article","error");return;}
    // Enforce maxNoApproval
    const maxNA=rp.maxNoApproval||Infinity;
    if(returnTotal>maxNA&&currentUser?.role!=="admin"&&!managerApproved){
      notify(`Montant > ${maxNA}EUR -- approbation manager requise`,"error");return;}
    // Anti-doublon par article: le backend verifie les quantites deja retournees
    // Le alreadyReturnedMap + effectiveMax dans toggleItem empechent deja de depasser cote UI
    setReturnBusy(true);
    const items=returnItems.map(r=>({productId:r.productId,variantId:r.variantId,qty:r.qty,
      productName:r.productName,variantColor:r.variantColor,variantSize:r.variantSize,unitPrice:r.unitPrice||0}));
    // Construire le ticket synthétique pour scan/free avec le bon taux de TVA par produit
    // Arrondi au centime a chaque etape pour eviter les erreurs de precision
    const syntheticTicket=selectedTk||{ticketNumber:`RETOUR-LIBRE-${Date.now()}`,date:new Date().toISOString(),items:returnItems.map(r=>{
      const prod=products.find(p=>p.id===r.productId);const taxRate=prod?.taxRate||0.20;const pm=settings.pricingMode||"TTC";
      const lineTTC=Math.round((r.unitPrice||0)*r.qty*100)/100;
      const lineHT=Math.round((pm==="TTC"?lineTTC/(1+taxRate):lineTTC)*100)/100;
      const lineTVA=Math.round(lineHT*taxRate*100)/100;
      return{product:{id:r.productId,name:r.productName,taxRate},product_id:r.productId,product_name:r.productName,
        variant:{id:r.variantId,color:r.variantColor,size:r.variantSize},variant_id:r.variantId,variant_color:r.variantColor,variant_size:r.variantSize,
        quantity:r.qty,tax_rate:taxRate,lineHT,lineTVA,lineTTC};})};
    // Enrichir les items avec unitPrice et taxRate pour le processReturn
    const enrichedItems=returnItems.map(r=>({...r,
      unitPrice:r.unitPrice||0,
      taxRate:products.find(p=>p.id===r.productId)?.taxRate||0.20}));
    try{
    const avoir=await processReturn(syntheticTicket,enrichedItems,reason,refundMethod==="exchange"?"avoir":refundMethod,restock,defective);
    if(avoir){
      if(refundMethod==="exchange"){
        setSelectedAvoir({avoirNumber:avoir.avoirNumber,totalTTC:avoir.totalTTC||0,remaining:avoir.remaining||avoir.totalTTC||0,applied:avoir.totalTTC||0});
        setAppMode("cashier");
        notify(`Avoir ${avoir.avoirNumber} de ${(avoir.totalTTC||0).toFixed(2)}EUR applique -- Scannez les nouveaux articles`,"success");
        setReturnItems([]);setSelectedTk(null);setSearchTk("");setSearchProd("");setFreeItem(null);
      } else {
        setLastAvoir(avoir);setReturnItems([]);setSelectedTk(null);setSearchTk("");setSearchProd("");setFreeItem(null);
      }
    }}finally{setReturnBusy(false);}};

  const returnWindow=settings.returnPolicy?.days||30;
  const isExpired=(tk)=>{if(!tk)return false;const d=new Date(tk.date||tk.createdAt||tk.created_at);
    return(Date.now()-d.getTime())/(1000*60*60*24)>returnWindow;};

  return(<div style={{height:"100%",overflowY:"auto",padding:"var(--pad,16px)",background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <h2 style={{fontSize:20,fontWeight:800,margin:0}}>Retours & Avoirs</h2>
      <div style={{display:"flex",gap:6}}>
        <Badge color={C.fiscal}>{avoirs.length} avoir{avoirs.length>1?"s":""}</Badge>
        <Badge color={C.textMuted}>Délai: {returnWindow}j</Badge></div></div>

    {/* Mode tabs */}
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {[{id:"ticket",l:"Par ticket de caisse",i:Receipt},
        ...(rp.requireReceipt===true?[]:[{id:"scan",l:"Par scan / recherche produit",i:ScanLine},{id:"free",l:"Retour libre (sans ticket)",i:Edit}])
      ].map(m=>(
        <button key={m.id} onClick={()=>{setMode(m.id);setSelectedTk(null);setReturnItems([]);setFreeItem(null);if(m.id==="ticket")setManagerApproved(false);setManagerPinInput("");setManagerPinError("");}}
          style={{flex:1,padding:"12px 14px",borderRadius:12,border:`2px solid ${mode===m.id?C.primary:C.border}`,
            background:mode===m.id?C.primaryLight:"transparent",cursor:"pointer",transition:"all 0.15s",textAlign:"left"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <m.i size={16} color={mode===m.id?C.primary:C.textMuted}/>
            <span style={{fontSize:12,fontWeight:mode===m.id?700:500,color:mode===m.id?C.primary:C.text}}>{m.l}</span></div>
        </button>))}</div>

    <div style={{display:"grid",gridTemplateColumns:returnItems.length?"1fr 380px":"1fr",gap:14}}>
      {/* Left — Select items */}
      <div>
        {mode==="ticket"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4}}>RECHERCHER UN TICKET</label>
          <Input value={searchTk} onChange={e=>setSearchTk(e.target.value)} placeholder="N° ticket, nom client…" style={{marginBottom:8,height:40}}/>
          {!selectedTk&&foundTickets.map(t=>{const expired=isExpired(t);return(
            <div key={t.ticketNumber} onClick={()=>{if(!expired){setSelectedTk(t);setReturnItems([]);}}}
              style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,border:`1.5px solid ${expired?C.danger+"44":C.border}`,
                marginBottom:4,cursor:expired?"not-allowed":"pointer",opacity:expired?0.6:1,background:expired?C.dangerLight+"20":"transparent"}}>
              <Receipt size={14} color={expired?C.danger:C.primary}/>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{t.ticketNumber}</div>
                <div style={{fontSize:10,color:C.textMuted}}>{new Date(t.date||t.createdAt||t.created_at).toLocaleDateString("fr-FR")} — {(t.items||[]).length} art. — {(t.totalTTC||parseFloat(t.total_ttc)||0).toFixed(2)}€{t.customerName?` — ${t.customerName}`:""}</div></div>
              {expired&&<Badge color={C.danger}>Hors délai</Badge>}
              <span style={{fontSize:14,fontWeight:800,color:C.primary}}>{(t.totalTTC||parseFloat(t.total_ttc)||0).toFixed(2)}€</span>
            </div>);})}
          {selectedTk&&<div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:C.primaryLight,borderRadius:10,marginBottom:10,border:`1px solid ${C.primary}22`}}>
              <div><div style={{fontSize:13,fontWeight:700,color:C.primaryDark}}>Ticket {selectedTk.ticketNumber}</div>
                <div style={{fontSize:10,color:C.primary}}>{new Date(selectedTk.date||selectedTk.createdAt||selectedTk.created_at).toLocaleDateString("fr-FR")} — {selectedTk.userName}{selectedTk.customerName?` — ${selectedTk.customerName}`:""}</div></div>
              <Btn variant="outline" onClick={()=>{setSelectedTk(null);setReturnItems([]);}} style={{fontSize:10,padding:"4px 10px"}}>Changer</Btn></div>
            <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:6}}>SÉLECTIONNEZ LES ARTICLES À RETOURNER</div>
            {(selectedTk.items||[]).map((item,idx)=>{const key=`${item.product?.id||item.product_id}-${item.variant?.id||item.variant_id}`;
              const selected=returnItems.find(r=>r.key===key);
              return(<div key={idx} onClick={()=>toggleItem(item,item.variant||{id:item.variant_id,color:item.variant_color,size:item.variant_size},item.quantity)}
                style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,border:`2px solid ${selected?C.primary:C.border}`,
                  marginBottom:4,cursor:"pointer",background:selected?C.primaryLight+"50":"transparent",transition:"all 0.15s"}}>
                {selected?<CheckCircle2 size={18} color={C.primary}/>:<div style={{width:18,height:18,borderRadius:9,border:`2px solid ${C.border}`}}/>}
                <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{item.product?.name||item.product_name}</div>
                  <div style={{fontSize:10,color:C.textMuted}}>{item.variant?.color||item.variant_color}/{item.variant?.size||item.variant_size} — Qté: {item.quantity}</div></div>
                <span style={{fontSize:13,fontWeight:700,color:C.primary}}>{(item.lineTTC||item.line_ttc||((item.unit_price||0)*(item.quantity||1))||0).toFixed(2)}€</span>
              </div>);})}
          </div>}
        </div>}

        {(mode==="scan"||mode==="free")&&!managerApproved&&currentUser?.role!=="admin"&&<div style={{background:C.surface,borderRadius:14,padding:20,border:`1.5px solid ${C.warn}44`,textAlign:"center"}}>
          <Shield size={32} color={C.warn} style={{marginBottom:10}}/>
          <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>Approbation manager requise</div>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>Les retours sans ticket nécessitent la validation d'un responsable.</div>
          <Input type="password" value={managerPinInput} onChange={e=>setManagerPinInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&verifyManagerPin()} placeholder="PIN Manager / Admin" style={{width:200,margin:"0 auto 8px",textAlign:"center"}}/>
          {managerPinError&&<div style={{fontSize:11,color:C.danger,marginBottom:6}}>{managerPinError}</div>}
          <Btn onClick={verifyManagerPin} style={{fontSize:12}}>Valider</Btn>
        </div>}

        {mode==="scan"&&(managerApproved||currentUser?.role==="admin")&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4}}>SCANNER OU RECHERCHER UN PRODUIT</label>
          <Input value={searchProd} onChange={e=>setSearchProd(e.target.value)} placeholder="Nom, SKU ou scanner code-barres…" style={{marginBottom:8,height:40}}/>
          {foundProducts.map(p=>(<div key={p.id}>
            {p.variants.map(v=>{const key=`${p.id}-${v.id}`;const selected=returnItems.find(r=>r.key===key);
              return(<div key={v.id} onClick={()=>toggleItem({product:p,variant:v,quantity:1,lineTTC:p.price,unit_price:p.price},v,99)}
                style={{display:"flex",alignItems:"center",gap:10,padding:8,borderRadius:8,border:`1.5px solid ${selected?C.primary:C.border}`,
                  marginBottom:3,cursor:"pointer",background:selected?C.primaryLight+"50":"transparent"}}>
                {selected?<CheckCircle2 size={16} color={C.primary}/>:<div style={{width:16,height:16,borderRadius:8,border:`2px solid ${C.border}`}}/>}
                <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:9,color:C.textMuted}}>{v.color}/{v.size} — SKU: {p.sku}{v.ean?` — EAN: ${v.ean}`:""}</div></div>
                <span style={{fontSize:12,fontWeight:700,color:C.primary}}>{(p.price||0).toFixed(2)}€</span>
              </div>);})}</div>))}</div>}

        {mode==="free"&&(managerApproved||currentUser?.role==="admin")&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4}}>RETOUR LIBRE — RECHERCHER DANS LE CATALOGUE</label>
          <Input value={searchProd} onChange={e=>setSearchProd(e.target.value)} placeholder="Nom, SKU ou scanner…" style={{marginBottom:8,height:40}}/>
          <div style={{padding:8,background:C.warnLight,borderRadius:8,marginBottom:10,fontSize:11,color:"#92400E",border:`1px solid ${C.warn}33`}}>
            <AlertTriangle size={12} style={{verticalAlign:"middle",marginRight:4}}/> Retour sans ticket — approbation manager recommandée</div>
          {foundProducts.map(p=>(<div key={p.id}>
            {p.variants.map(v=>{const key=`${p.id}-${v.id}`;const selected=returnItems.find(r=>r.key===key);
              return(<div key={v.id} onClick={()=>toggleItem({product:p,variant:v,quantity:1,lineTTC:p.price,unit_price:p.price},v,99)}
                style={{display:"flex",alignItems:"center",gap:10,padding:8,borderRadius:8,border:`1.5px solid ${selected?C.primary:C.border}`,
                  marginBottom:3,cursor:"pointer",background:selected?C.primaryLight+"50":"transparent"}}>
                {selected?<CheckCircle2 size={16} color={C.primary}/>:<div style={{width:16,height:16,borderRadius:8,border:`2px solid ${C.border}`}}/>}
                <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:9,color:C.textMuted}}>{v.color}/{v.size}</div></div>
                <span style={{fontSize:12,fontWeight:700,color:C.primary}}>{(p.price||0).toFixed(2)}€</span>
              </div>);})}</div>))}</div>}

        {/* Historique avoirs — avec recherche */}
        {!returnItems.length&&!selectedTk&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginTop:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{fontSize:14,fontWeight:700,flex:1}}>Avoirs ({avoirs.length})</div>
            <div style={{position:"relative",flex:1,maxWidth:260}}><Search size={13} style={{position:"absolute",left:8,top:9,color:C.textMuted}}/>
              <Input value={avoirLookup} onChange={e=>setAvoirLookup(e.target.value)} placeholder="Rechercher avoir, client, ticket..." style={{paddingLeft:28,height:34,fontSize:11}}/></div></div>
          {filteredAvoirs.length===0&&<div style={{color:C.textLight,fontSize:11,textAlign:"center",padding:14}}>Aucun avoir{avoirLookup?" pour cette recherche":""}</div>}
          {filteredAvoirs.map(a=>{const expired=isAvoirExpired?.(a);const isAvoirType=a.refundMethod==="avoir";
            return(<div key={a.avoirNumber||a.id} onClick={()=>setAvoirDetail(a)} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderBottom:`1px solid ${C.border}`,opacity:expired?0.5:1,cursor:"pointer"}}>
            <div style={{width:30,height:30,borderRadius:8,background:expired?C.surfaceAlt:isAvoirType&&!a.used?C.fiscalLight:C.dangerLight,
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <RotateCcw size={13} color={expired?C.textMuted:isAvoirType&&!a.used?C.fiscal:C.danger}/></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                <span style={{fontSize:11,fontWeight:700,fontFamily:"monospace"}}>{a.avoirNumber}</span>
                <Badge color={a.refundMethod==="avoir"?C.primary:a.refundMethod==="cash"?C.accent:a.refundMethod==="card"?C.info:"#8B5CF6"}>
                  {({avoir:"Avoir",cash:"ESP",card:"CB",exchange:"ECH"})[a.refundMethod]||a.refundMethod}</Badge>
                {isAvoirType&&!a.used&&!expired&&<Badge color={C.fiscal}>Solde: {(a.remaining??a.totalTTC??0).toFixed(2)}EUR</Badge>}
                {a.used&&<Badge color={C.textMuted}>Utilise</Badge>}
                {expired&&<Badge color={C.danger}>Expire</Badge>}</div>
              <div style={{fontSize:9,color:C.textMuted,marginTop:1}}>
                {new Date(a.date).toLocaleDateString("fr-FR")} -- Ref: {a.originalTicket}{a.customerName?` -- ${a.customerName}`:""}{a.reason?` -- ${a.reason}`:""}</div></div>
            <span style={{fontSize:12,fontWeight:700,color:C.danger,whiteSpace:"nowrap"}}>-{(a.totalTTC||0).toFixed(2)}EUR</span>
          </div>);})}</div>}
      </div>

      {/* Right — Return summary */}
      {returnItems.length>0&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,alignSelf:"start",position:"sticky",top:20}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
          <RotateCcw size={16} color={C.fiscal}/> Résumé du retour</div>

        {returnItems.map(r=>(<div key={r.key} style={{display:"flex",alignItems:"center",gap:8,padding:8,borderBottom:`1px solid ${C.border}`,marginBottom:4}}>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600}}>{r.productName}</div>
            <div style={{fontSize:9,color:C.textMuted}}>{r.variantColor}/{r.variantSize}</div></div>
          <div style={{display:"flex",alignItems:"center",gap:2,background:C.surfaceAlt,borderRadius:8,padding:2}}>
            <button onClick={()=>updateReturnQty(r.key,r.qty-1)} style={{width:22,height:22,borderRadius:6,border:"none",background:C.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Minus size={10}/></button>
            <span style={{width:24,textAlign:"center",fontSize:11,fontWeight:700}}>{r.qty}</span>
            <button onClick={()=>updateReturnQty(r.key,r.qty+1)} style={{width:22,height:22,borderRadius:6,border:"none",background:C.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Plus size={10}/></button></div>
          <span style={{fontSize:12,fontWeight:700,color:C.danger,minWidth:60,textAlign:"right"}}>{((r.unitPrice||0)*r.qty).toFixed(2)}€</span>
          <button onClick={()=>setReturnItems(p=>p.filter(x=>x.key!==r.key))} style={{background:C.dangerLight,border:"none",cursor:"pointer",borderRadius:6,width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Trash2 size={10} color={C.danger}/></button>
        </div>))}

        <div style={{background:C.surfaceAlt,borderRadius:10,padding:12,margin:"10px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:16,fontWeight:800}}>Total retour</span>
            <span style={{fontSize:20,fontWeight:900,color:C.danger}}>-{returnTotal.toFixed(2)}€</span></div></div>

        <div style={{marginBottom:10}}>
          <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4}}>MOTIF DU RETOUR</label>
          <select value={reason} onChange={e=>setReason(e.target.value)} style={{width:"100%",padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}}>
            {REASONS.map(r=>(<option key={r} value={r}>{r}</option>))}</select></div>

        <div style={{marginBottom:10}}>
          <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4}}>MODE DE REMBOURSEMENT</label>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {REFUND_METHODS.map(m=>(<button key={m.id} onClick={()=>setRefundMethod(m.id)}
              style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,border:`2px solid ${refundMethod===m.id?C.fiscal:C.border}`,
                background:refundMethod===m.id?`${C.fiscal}08`:"transparent",cursor:"pointer",textAlign:"left"}}>
              <m.i size={14} color={refundMethod===m.id?C.fiscal:C.textMuted}/>
              <div><div style={{fontSize:11,fontWeight:refundMethod===m.id?700:500,color:refundMethod===m.id?C.fiscal:C.text}}>{m.l}</div>
                <div style={{fontSize:9,color:C.textMuted}}>{m.d}</div></div>
            </button>))}</div></div>

        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:6,cursor:"pointer"}}>
          <input type="checkbox" checked={restock} onChange={e=>setRestock(e.target.checked)}
            style={{width:16,height:16,accentColor:C.primary}}/> Remettre en stock</label>
        {restock&&<label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:600,color:C.danger,marginBottom:12,cursor:"pointer",paddingLeft:22}}>
          <input type="checkbox" checked={defective} onChange={e=>setDefective(e.target.checked)}
            style={{width:16,height:16,accentColor:C.danger}}/> Produit défectueux (stock défectueux)</label>}
        {!restock&&<div style={{marginBottom:12}}/>}

        <Btn onClick={doReturn} disabled={returnBusy||!returnItems.length} style={{width:"100%",height:44,background:C.fiscal,fontSize:13,opacity:returnBusy?0.6:1}}>
          {returnBusy?<span className="spin-loader"/>:<RotateCcw size={16}/>} {returnBusy?"Traitement...":"Valider le retour"} — {returnTotal.toFixed(2)}EUR</Btn>
      </div>}
    </div>

    {/* Avoir confirmation */}
    <Modal open={!!lastAvoir} onClose={()=>setLastAvoir(null)} title="Avoir émis">
      {lastAvoir&&<div style={{textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:32,background:C.fiscal,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:10,
          boxShadow:`0 8px 24px ${C.fiscal}35`}}><CheckCircle2 size={32} color="#fff"/></div>
        <div style={{fontSize:20,fontWeight:900,color:C.fiscal,marginBottom:4}}>{lastAvoir.avoirNumber}</div>
        <div style={{fontSize:14,color:C.text,marginBottom:4}}>Montant: <strong>{(lastAvoir.totalTTC||0).toFixed(2)}€</strong></div>
        <div style={{fontSize:12,color:C.textMuted,marginBottom:4}}>Motif: {lastAvoir.reason} — Mode: {lastAvoir.refundMethod}</div>
        <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>Réf. ticket: {lastAvoir.originalTicket}</div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="outline" onClick={()=>thermalPrint("avoir",lastAvoir)} style={{flex:1}}><Printer size={14}/> Imprimer</Btn>
          <Btn variant="success" onClick={()=>setLastAvoir(null)} style={{flex:1}}><CheckCircle2 size={14}/> Terminé</Btn></div>
      </div>}</Modal>

    {/* Avoir detail modal (ReturnScreen) */}
    <Modal open={!!avoirDetail} onClose={()=>setAvoirDetail(null)} title={`Avoir ${avoirDetail?.avoirNumber||avoirDetail?.avoir_number||"?"}`} wide>
      {avoirDetail&&(()=>{try{
        const av=avoirDetail;
        const avNum=av.avoirNumber||av.avoir_number||"?";
        const avOrigTk=av.originalTicket||av.original_ticket||"?";
        const avOrigDate=av.originalDate||av.original_date||"";
        const avDate=av.date||av.created_at||"";
        const avUser=av.userName||av.user_name||"?";
        const avCust=av.customerName||av.customer_name||"";
        const avReason=av.reason||"";
        const avTTC=Number(av.totalTTC||av.total_ttc)||0;
        const avItems=av.items||[];
        const avRefund=av.refundMethod||av.refund_method||"?";
        const avFp=av.fingerprint||av.fiscal_fingerprint||"";
        return(<>
        <div data-print-receipt style={{fontFamily:"'Courier New',monospace",fontSize:10,background:C.dangerLight,borderRadius:10,padding:16,border:`1px solid ${C.danger}33`}}>
        <div style={{textAlign:"center",marginBottom:6,color:C.danger,fontWeight:700,fontSize:12}}>AVOIR / NOTE DE CRÉDIT</div>
        <div style={{textAlign:"center",marginBottom:6}}><div style={{fontSize:12,fontWeight:700}}>{settings.name||CO.name}</div>
          <div>SIRET: {settings.siret||CO.siret}</div></div>
        <div style={{borderTop:`1px dashed ${C.danger}`,margin:"4px 0"}}/>
        <div>N° {avNum}</div>
        <div>Ticket original: {avOrigTk}{avOrigDate?` du ${new Date(avOrigDate).toLocaleDateString("fr-FR")}`:""}</div>
        <div>Date: {avDate?new Date(avDate).toLocaleString("fr-FR"):"?"} — {avUser}</div>
        {avCust&&<div>Client: {avCust}</div>}
        <div>Motif: {avReason}</div>
        <div style={{borderTop:`1px dashed ${C.danger}`,margin:"4px 0"}}/>
        {avItems.map((i,k)=>{const sku=i.product?.sku||i.product_sku||i.sku||"";const ean=i.variant?.ean||i.variant_ean||i.ean||"";
          const name=i.product?.name||i.product_name||i.name||"?";
          const color=i.variant?.color||i.variant_color||i.color||"";
          const size=i.variant?.size||i.variant_size||i.size||"";
          const lineAmt=Number(i.lineTTC||i.line_ttc)||0;
          return(<div key={k}>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>{name}{(color||size)?` (${color}/${size})`:""} x{i.quantity||1}</span>
          <span>-{lineAmt.toFixed(2)}€</span></div>
          {(sku||ean)&&<div style={{fontSize:8,color:`${C.danger}99`}}>{sku?`Réf: ${sku}`:""}{sku&&ean?" — ":""}{ean?`EAN: ${ean}`:""}</div>}
        </div>);})}
        <div style={{borderTop:`1px dashed ${C.danger}`,margin:"4px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,color:C.danger}}><span>TOTAL AVOIR</span><span>-{avTTC.toFixed(2)}€</span></div>
        <div>Remboursement: {({cash:"Espèces",card:"Carte bancaire",avoir:"Avoir client"})[avRefund]||avRefund}</div>
        {avFp&&<div style={{textAlign:"center",background:C.dangerLight,padding:6,borderRadius:6,margin:"6px 0"}}>
          <div style={{fontSize:8,color:C.danger,fontWeight:700}}>EMPREINTE NF525</div>
          <div style={{fontSize:11,fontWeight:700,color:C.danger,letterSpacing:2}}>{avFp}</div></div>}
        {(av.barcode)&&<div style={{marginTop:6,display:"flex",justifyContent:"center"}}><EAN13Svg code={av.barcode} width={160} height={45}/></div>}
      </div>
      <Btn variant="outline" onClick={()=>thermalPrint("avoir",av)} style={{width:"100%",marginTop:10}}><Printer size={14}/> {printerConnected?"Ticket":"Imprimer"}</Btn>
      </>);
      }catch(err){return(<div style={{padding:20,color:C.danger}}><div style={{fontWeight:700,marginBottom:8}}>Erreur d affichage</div><Btn variant="danger" onClick={()=>setAvoirDetail(null)} style={{marginTop:10}}>Fermer</Btn></div>);}})()}
    </Modal>
  </div>);
}

/* ══════════ CLOSURE ══════════ */

export default ReturnScreen;
export { ReturnScreen };
