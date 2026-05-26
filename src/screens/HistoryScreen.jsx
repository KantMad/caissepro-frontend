import React, { useState, useMemo, useEffect } from "react";
import { CreditCard, Banknote, Gift, Plus, Minus, User as UserIcon, Receipt, RotateCcw, AlertTriangle, Printer, Mail } from "lucide-react";
import * as API from "../api.js";
import printer from "../printer.js";
import { CO, C } from "../constants.jsx";
import { EAN13Svg, ean13SvgHtml } from "../utils.jsx";
import { Modal, Btn, Input, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";

function HistoryScreen(){
  const{tickets,avoirs,settings,processReturn,perm:p,printerConnected,thermalPrint,setSelectedAvoir,setMode,notify,customers,retoucheBons,updateRetoucheStatus,scanBarcode,setScanBarcode,trainingMode}=useApp();
  const[tab,setTab]=useState("tickets");const[reprintTk,setReprintTk]=useState(null);const[reassignModal,setReassignModal]=useState(null);const[reassignCust,setReassignCust]=useState(null);
  const[search,setSearch]=useState("");const[dateFilter,setDateFilter]=useState("");const[retDateFrom,setRetDateFrom]=useState("");const[retDateTo,setRetDateTo]=useState("");const[retClientFilter,setRetClientFilter]=useState("");const[retStatusFilter,setRetStatusFilter]=useState("");
  // Pre-fill search from barcode scan
  useEffect(()=>{if(scanBarcode){setSearch(scanBarcode);
    // Auto-detect tab from barcode prefix
    if(scanBarcode.startsWith("201"))setTab("avoirs");
    else if(scanBarcode.startsWith("203"))setTab("retouches");
    else setTab("tickets");
    setScanBarcode(null);}},[scanBarcode,setScanBarcode]);
  const[returnModal,setReturnModal]=useState(null);
  const[returnItems,setReturnItems]=useState([]);const[returnReason,setReturnReason]=useState("");const[returnMethod,setReturnMethod]=useState("cash");
  const[avoirDetail,setAvoirDetail]=useState(null);
  const[page,setPage]=useState(0);const PAGE_SIZE=25;

  useEffect(()=>{setPage(0);},[search,dateFilter]);
  const filteredTickets=useMemo(()=>tickets.filter(t=>{
    const q=search.toLowerCase();
    const matchSearch=!q||(t.ticketNumber||"").toLowerCase().includes(q)||(t.customerName||"").toLowerCase().includes(q)||(t.userName||t.user_name||"").toLowerCase().includes(q)||(t.barcode||"").includes(q);
    const matchDate=!dateFilter||(t.date||t.createdAt||t.created_at||"").startsWith(dateFilter);
    return matchSearch&&matchDate;
  }),[tickets,search,dateFilter]);
  const totalPages=Math.ceil(filteredTickets.length/PAGE_SIZE);
  const pagedTickets=filteredTickets.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);

  const openReturn=(ticket)=>{
    // Calculer les quantites deja retournees par article pour ce ticket
    const existingAvoirs=avoirs.filter(a=>a.originalTicket===ticket.ticketNumber);
    const returnedMap={};
    existingAvoirs.forEach(a=>(a.items||[]).forEach(ai=>{
      const key=`${ai.productId||ai.product_id||ai.product?.id}-${ai.variantId||ai.variant_id||ai.variant?.id}`;
      returnedMap[key]=(returnedMap[key]||0)+(ai.qty||ai.quantity||0);
    }));
    const items=(ticket.items||[]).map(i=>{const pid=i.product?.id||i.product_id;const vid=i.variant?.id||i.variant_id;
      const unitTTC=Math.round(((Number(i.lineTTC||i.line_ttc)||((Number(i.unit_price)||0)*(i.quantity||1)))/(i.quantity||1))*100)/100;
      const origQty=i.quantity||1;
      const alreadyReturned=returnedMap[`${pid}-${vid}`]||0;
      const remainingQty=Math.max(0,origQty-alreadyReturned);
      return{productId:pid,variantId:vid,
      productName:i.product?.name||i.product_name,name:i.product?.name||i.product_name,
      sku:i.product?.sku||i.product_sku||"",ean:i.variant?.ean||i.variant_ean||"",
      variantColor:i.variant?.color||i.variant_color,color:i.variant?.color||i.variant_color,
      variantSize:i.variant?.size||i.variant_size,size:i.variant?.size||i.variant_size,
      maxQty:remainingQty,qty:0,unitTTC,unitPrice:unitTTC,alreadyReturned};});
    // Bloquer seulement si TOUS les articles sont deja entierement retournes
    if(items.every(i=>i.maxQty<=0)){notify("Tous les articles de ce ticket ont deja ete retournes","error");return;}
    setReturnModal(ticket);
    setReturnItems(items.filter(i=>i.maxQty>0));
    setReturnReason("");setReturnMethod("cash");
  };
  const returnTotal=Math.round(returnItems.reduce((s,i)=>s+(i.qty||0)*(i.unitTTC||0),0)*100)/100;

  return(<div style={{height:"100%",overflowY:"auto",padding:"var(--pad,16px)",background:C.bg}}>
    <h2 style={{fontSize:20,fontWeight:800,marginBottom:10}}>Historique fiscal</h2>
    {trainingMode&&<div style={{background:"#FEF3C7",border:"2px dashed #D97706",borderRadius:12,padding:12,marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
      <AlertTriangle size={18} color="#D97706"/><div><div style={{fontSize:12,fontWeight:700,color:"#92400E"}}>MODE FORMATION ACTIF</div>
        <div style={{fontSize:10,color:"#B45309"}}>Les donnees affichees incluent des tickets FACTICE non comptabilises.</div></div></div>}
    <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center"}}>
      <Btn variant={tab==="tickets"?"primary":"outline"} onClick={()=>setTab("tickets")} style={{fontSize:11}}>Tickets ({tickets.length})</Btn>
      <Btn variant={tab==="avoirs"?"danger":"outline"} onClick={()=>setTab("avoirs")} style={{fontSize:11}}>Avoirs ({avoirs.length})</Btn>
      <Btn variant={tab==="retouches"?"primary":"outline"} onClick={()=>setTab("retouches")} style={{fontSize:11}}>Retouches ({retoucheBons.length})</Btn>
      <div style={{flex:1}}/>
      <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher N°, client, caissier…" style={{width:220,height:32,fontSize:11,padding:"4px 10px"}}/>
      <Input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={{width:140,height:32,fontSize:11,padding:"4px 10px"}}/>
      </div>
    {tab==="tickets"&&(<>{pagedTickets.length?pagedTickets.map((t,idx)=>(
      <div key={t.ticketNumber||t.id||idx} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:12,background:C.surface,border:`1.5px solid ${C.border}`,marginBottom:5,transition:"all 0.12s"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary+"44"} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
        <Receipt size={14} color={C.textMuted}/>
        <div style={{flex:1,cursor:"pointer"}} onClick={()=>setReprintTk({...t})}>
          <div style={{fontSize:11,fontWeight:700}}>N° {t.ticketNumber} <Badge color={C.info}>{t.paymentMethod}</Badge>
          {t.customerName&&<Badge color={C.accent}>{t.customerName}</Badge>}</div>
          <div style={{fontSize:9,color:C.textMuted}}>{new Date(t.date||t.createdAt||t.created_at).toLocaleString("fr-FR")} — {t.userName||t.user_name||"?"} — {(t.items||[]).length} art.</div></div>
        <div style={{textAlign:"right",marginRight:8}}><div style={{fontSize:13,fontWeight:700,color:C.primary}}>{(t.totalTTC||parseFloat(t.total_ttc)||0).toFixed(2)}€</div>
          <div style={{fontSize:7,color:C.fiscal,fontFamily:"monospace"}}>{t.fingerprint}</div></div>
        {p().canVoid&&<Btn variant="outline" onClick={()=>openReturn(t)} style={{fontSize:10,padding:"4px 10px",borderColor:C.danger+"44",color:C.danger}}>
          <RotateCcw size={11}/> Retour</Btn>}
      </div>
    )):<div style={{textAlign:"center",padding:30,color:C.textLight}}>Aucun ticket{search||dateFilter?" correspondant":""}</div>}
      {totalPages>1&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:12}}>
        <Btn variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)} style={{fontSize:10,padding:"4px 10px"}}>Précédent</Btn>
        <span style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Page {page+1} / {totalPages} ({filteredTickets.length} résultats)</span>
        <Btn variant="outline" disabled={page>=totalPages-1} onClick={()=>setPage(p=>p+1)} style={{fontSize:10,padding:"4px 10px"}}>Suivant</Btn>
      </div>}</>)}

    {tab==="avoirs"&&(avoirs.length?avoirs.map((a,idx)=>(
      <div key={a.avoirNumber||a.id||idx} onClick={()=>setAvoirDetail(a)} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,
        background:C.surface,border:`1.5px solid ${C.danger}33`,marginBottom:5,cursor:"pointer"}}>
        <RotateCcw size={14} color={C.danger}/>
        <div style={{flex:1}}>
          <div style={{fontSize:11,fontWeight:700,color:C.danger}}>{a.avoirNumber} <Badge color={C.textMuted}>Réf: {a.originalTicket}</Badge>
            {a.customerName&&<Badge color={C.accent}>{a.customerName}</Badge>}</div>
          <div style={{fontSize:9,color:C.textMuted}}>{new Date(a.date).toLocaleString("fr-FR")} — {a.userName} — {a.reason||"Sans motif"}</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:C.danger}}>-{(a.totalTTC||0).toFixed(2)}€</div>
          <div style={{fontSize:7,color:C.fiscal,fontFamily:"monospace"}}>{a.fingerprint}</div></div>
      </div>
    )):<div style={{textAlign:"center",padding:30,color:C.textLight}}>Aucun avoir</div>)}

    {tab==="retouches"&&(()=>{
      const retClients=[...new Set(retoucheBons.map(b=>b.client).filter(Boolean))].sort();
      const fBons=retoucheBons.filter(b=>{
        const q=search.toLowerCase();const sc=b.shortCode||(b.num||"").slice(-4);
        const matchS=!q||(b.num||"").toLowerCase().includes(q)||(b.client||"").toLowerCase().includes(q)||(b.seller||"").toLowerCase().includes(q)||(b.barcode||"").includes(q)||sc.includes(q);
        const bDate=(b.date||"").slice(0,10);
        const matchFrom=!retDateFrom||bDate>=retDateFrom;
        const matchTo=!retDateTo||bDate<=retDateTo;
        const matchClient=!retClientFilter||(b.client||"")===retClientFilter;
        const matchStatus=!retStatusFilter||(b.status||"pending")===retStatusFilter;
        return matchS&&matchFrom&&matchTo&&matchClient&&matchStatus;
      });
      const statusLabel={pending:"En attente",ready:"Prêt",delivered:"Livré",cancelled:"Annulé"};
      const statusColor={pending:"#F59E0B",ready:"#10B981",delivered:"#6366F1",cancelled:"#EF4444"};
      const countByStatus={pending:0,ready:0,delivered:0,cancelled:0};retoucheBons.forEach(b=>{const s=b.status||"pending";if(countByStatus[s]!==undefined)countByStatus[s]++;});
      const totalCA=fBons.reduce((s,b)=>s+(b.total||0),0);
      return<>
        {/* Compteurs par statut */}
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          {[{key:"pending",icon:"⏳",label:"En attente"},{key:"ready",icon:"✅",label:"Prêts"},{key:"delivered",icon:"📦",label:"Livrés"}].map(s=>(
            <div key={s.key} onClick={()=>setRetStatusFilter(retStatusFilter===s.key?"":s.key)}
              style={{flex:1,minWidth:100,padding:"10px 14px",borderRadius:10,background:retStatusFilter===s.key?statusColor[s.key]+"18":C.surface,border:`1.5px solid ${retStatusFilter===s.key?statusColor[s.key]:C.border}`,cursor:"pointer",transition:"all 0.15s"}}>
              <div style={{fontSize:20,fontWeight:900,color:statusColor[s.key]}}>{countByStatus[s.key]}</div>
              <div style={{fontSize:10,fontWeight:700,color:C.textMuted}}>{s.label}</div>
            </div>))}
          <div style={{flex:1,minWidth:100,padding:"10px 14px",borderRadius:10,background:C.surface,border:`1.5px solid ${C.border}`}}>
            <div style={{fontSize:20,fontWeight:900,color:C.primary}}>{retoucheBons.length}</div>
            <div style={{fontSize:10,fontWeight:700,color:C.textMuted}}>Total bons</div>
          </div>
          <div style={{flex:1,minWidth:100,padding:"10px 14px",borderRadius:10,background:C.surface,border:`1.5px solid ${C.border}`}}>
            <div style={{fontSize:20,fontWeight:900,color:C.primary}}>{totalCA.toFixed(2)}€</div>
            <div style={{fontSize:10,fontWeight:700,color:C.textMuted}}>CA retouches</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{fontSize:10,fontWeight:700,color:C.textMuted}}>Du</div>
          <Input type="date" value={retDateFrom} onChange={e=>setRetDateFrom(e.target.value)} style={{width:130,height:30,fontSize:10,padding:"3px 8px"}}/>
          <div style={{fontSize:10,fontWeight:700,color:C.textMuted}}>au</div>
          <Input type="date" value={retDateTo} onChange={e=>setRetDateTo(e.target.value)} style={{width:130,height:30,fontSize:10,padding:"3px 8px"}}/>
          <select value={retClientFilter} onChange={e=>setRetClientFilter(e.target.value)}
            style={{height:30,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:10,padding:"0 8px",fontFamily:"inherit",background:C.surface}}>
            <option value="">Tous les clients</option>{retClients.map(c=><option key={c} value={c}>{c}</option>)}</select>
          <select value={retStatusFilter} onChange={e=>setRetStatusFilter(e.target.value)}
            style={{height:30,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:10,padding:"0 8px",fontFamily:"inherit",background:C.surface}}>
            <option value="">Tous statuts</option><option value="pending">En attente</option><option value="ready">Prêt</option><option value="delivered">Livré</option></select>
          {(retDateFrom||retDateTo||retClientFilter||retStatusFilter)&&<Btn variant="ghost" onClick={()=>{setRetDateFrom("");setRetDateTo("");setRetClientFilter("");setRetStatusFilter("");}} style={{fontSize:9,padding:"2px 8px",color:C.danger}}>Effacer filtres</Btn>}
          <div style={{flex:1}}/><span style={{fontSize:10,color:C.textMuted,fontWeight:600}}>{fBons.length} résultat(s)</span>
        </div>
        {fBons.length?fBons.map((b,idx)=>{const sc=b.shortCode||(b.num||"").slice(-4);const st=b.status||"pending";return(
          <div key={b.id||b.num||idx} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,background:C.surface,border:`1.5px solid ${statusColor[st]||C.border}33`,marginBottom:5}}>
            <div style={{minWidth:56,textAlign:"center"}}>
              <div style={{minWidth:56,height:44,borderRadius:8,background:C.primary,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,letterSpacing:3}}>{sc}</div>
              <div style={{fontSize:7,fontWeight:600,color:C.textMuted,marginTop:2}}>{(b.num||"").replace("RET-","R-")}</div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{fontSize:12,fontWeight:800}}>{b.num||"?"}</span>
                <Badge color={C.info}>{b.client||"Sans client"}</Badge>
                <span style={{fontSize:8,fontWeight:700,padding:"1px 6px",borderRadius:6,background:statusColor[st]+"22",color:statusColor[st],border:`1px solid ${statusColor[st]}44`}}>{statusLabel[st]||st}</span>
              </div>
              <div style={{fontSize:9,color:C.textMuted,marginTop:2}}>{b.date?new Date(b.date).toLocaleString("fr-FR"):""} — {b.seller||"?"} — {(b.items||[]).filter(i=>i.desc).length} prestation(s)</div>
              <div style={{fontSize:9,color:C.textMuted,marginTop:1}}>{(b.items||[]).filter(i=>i.desc).map(i=>i.desc).join(", ")}</div>
              {b.dateRetrait&&<div style={{fontSize:9,fontWeight:600,color:new Date(b.dateRetrait)<new Date()?C.danger:C.primary,marginTop:1}}>Retrait: {new Date(b.dateRetrait).toLocaleDateString("fr-FR")}</div>}
              {b.phone&&<div style={{fontSize:9,color:C.textMuted}}>Tel: {b.phone}</div>}
              {b.barcode&&<div style={{marginTop:3}}><EAN13Svg code={b.barcode} width={110} height={32}/></div>}
            </div>
            <div style={{textAlign:"right",marginRight:6}}>
              <div style={{fontSize:14,fontWeight:800,color:C.primary}}>{(b.total||0).toFixed(2)}€</div>
            </div>
            <Btn variant="outline" onClick={async()=>{const printed=await thermalPrint("retouche",b);if(!printed){
              const w=window.open("","_blank","width=400,height=600");if(w){w.document.write(`<html><head><title>Bon ${b.num}</title><style>body{font-family:'Courier New',monospace;font-size:12px;padding:10px;max-width:300px;margin:0 auto;}h2{text-align:center;font-size:14px;margin:4px 0;}hr{border:none;border-top:1px dashed #333;margin:6px 0;}.row{display:flex;justify-content:space-between;}.center{text-align:center;}.short-code{text-align:center;font-size:32px;font-weight:900;letter-spacing:6px;margin:8px 0;padding:8px;border:3px solid #000;}</style></head><body>`+
                `<h2>${settings.name||"CaissePro"}</h2><hr><h2>BON DE RETOUCHE</h2><div class="short-code">${sc}</div><div class="center" style="font-size:10px;margin-bottom:6px;">Ref: ${b.num}</div><hr>`+
                `<div class="row"><span>Client:</span><strong>${b.client||""}</strong></div>`+
                `<div class="row"><span>Tel:</span><span>${b.phone||""}</span></div>`+
                (b.dateRetrait?`<div class="row"><span>Retrait:</span><span>${new Date(b.dateRetrait).toLocaleDateString("fr-FR")}</span></div>`:"")+`<hr>`+
                (b.items||[]).filter(i=>i.desc).map(i=>`<div class="row"><span>${i.desc}</span><strong>${parseFloat(i.price||0).toFixed(2)}EUR</strong></div>`).join("")+
                `<hr><div class="row"><strong>TOTAL</strong><strong>${(b.total||0).toFixed(2)}EUR TTC</strong></div>`+
                `</body></html>`);w.document.close();setTimeout(()=>w.print(),300);}
            }}} style={{fontSize:10,padding:"4px 10px"}}><Printer size={12}/></Btn>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {st==="pending"&&<Btn variant="outline" onClick={async()=>{if(await updateRetoucheStatus(b.id,"ready"))notify(`${b.num} marqué Prêt`);}} style={{fontSize:8,padding:"2px 6px",borderColor:"#10B981",color:"#10B981"}}>Prêt</Btn>}
              {(st==="pending"||st==="ready")&&<Btn variant="outline" onClick={async()=>{if(await updateRetoucheStatus(b.id,"delivered"))notify(`${b.num} marqué Livré`);}} style={{fontSize:8,padding:"2px 6px",borderColor:"#6366F1",color:"#6366F1"}}>Livré</Btn>}
            </div>
          </div>);
        }):<div style={{textAlign:"center",padding:30,color:C.textLight}}>Aucun bon de retouche{(retDateFrom||retDateTo||retClientFilter||search)?" correspondant":""}</div>}
      </>;
    })()}

    {/* Ticket detail/reprint modal */}
    <Modal open={!!reprintTk} onClose={()=>setReprintTk(null)} title={`Ticket ${reprintTk?.ticketNumber||reprintTk?.ticket_number||"?"}`} wide>
      {reprintTk&&(()=>{try{
        const tk=reprintTk;
        const tkNum=tk.ticketNumber||tk.ticket_number||"?";
        const tkDate=tk.date||tk.createdAt||tk.created_at||"";
        const tkDateStr=tkDate?new Date(tkDate).toLocaleString("fr-FR"):"?";
        const tkUser=tk.userName||tk.user_name||"?";
        const tkCust=tk.customerName||tk.customer_name||"";
        const tkTTC=Number(tk.totalTTC||tk.total_ttc)||0;
        const tkHT=Number(tk.totalHT||tk.total_ht)||0;
        const tkTVA=Number(tk.totalTVA||tk.total_tva)||0;
        const tkDisc=Number(tk.globalDiscount||tk.global_discount)||0;
        const tkItems=tk.items||[];
        const tkPayments=tk.payments||[];
        const tkFp=tk.fingerprint||tk.fiscal_fingerprint||"";
        const tkPayMethod=tk.paymentMethod||tk.payment_method||"?";
        return(<>
        <div data-print-receipt style={{fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:500,background:"#FAFAF8",borderRadius:10,padding:16,border:`1px solid ${C.border}`}}>
        <div style={{textAlign:"center",marginBottom:6}}>
          {settings.receiptLogo&&<div style={{marginBottom:4}}><img src={settings.receiptLogo} alt="" style={{maxHeight:40,maxWidth:180,objectFit:"contain"}}/></div>}
          <div style={{fontSize:14,fontWeight:800}}>{settings.name||CO.name}</div>
          <div style={{fontWeight:600}}>{settings.address}, {settings.postalCode} {settings.city}</div>
          {settings.phone&&<div style={{fontWeight:600}}>Tél: {settings.phone}</div>}
          <div style={{fontWeight:600}}>SIRET: {settings.siret||CO.siret} — TVA: {settings.tvaIntra||CO.tvaIntra}</div></div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700}}><span>N° {tkNum}</span><span>{tkDateStr}</span></div>
        <div style={{fontWeight:600}}>Caissier: {tkUser}{tkCust?` — Client: ${tkCust}`:""}</div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        {tkItems.map((i,k)=>{const sku=i.product?.sku||i.product_sku||i.sku||"";const ean=i.variant?.ean||i.variant_ean||i.ean||"";
          const name=i.product?.name||i.product_name||i.name||"Article";
          const color=i.variant?.color||i.variant_color||i.color||"";
          const size=i.variant?.size||i.variant_size||i.size||"";
          const isCustom=i.isCustom||i.is_custom;
          const lineAmt=Number(i.lineTTC||i.line_ttc)||(Number(i.unit_price||i.unitTTC||0)*Number(i.quantity||1));
          const disc=Number(i.discount)||0;
          return(<div key={k}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}><span style={{flex:1,wordBreak:"break-word",lineHeight:1.3}}>{name}{!isCustom&&(color||size)?` (${color}/${size})`:""} x{i.quantity||1}{disc>0?` -${disc}${i.discountType==="amount"||i.discount_type==="amount"?"€":"%"}`:""}</span>
          <span style={{whiteSpace:"nowrap",fontWeight:800}}>{lineAmt.toFixed(2)}€</span></div>
          {(sku||ean)&&<div style={{fontSize:9,color:"#888",fontWeight:600}}>{sku?`Réf: ${sku}`:""}{sku&&ean?" — ":""}{ean?`EAN: ${ean}`:""}</div>}
        </div>);})}
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        {tkDisc>0&&<div style={{display:"flex",justifyContent:"space-between",color:"#059669",fontWeight:600}}><span>Remise</span><span>-{tkDisc.toFixed(2)}€</span></div>}
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:600}}><span>Total HT</span><span>{tkHT.toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:600}}><span>TVA</span><span>{tkTVA.toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:800,marginTop:3}}><span>TOTAL TTC</span><span>{tkTTC.toFixed(2)}€</span></div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        <div style={{fontWeight:700}}>Paiement: {tkPayments.map(pm=>`${({cash:"ESP",card:"CB",amex:"AMEX",giftcard:"CAD",cheque:"CHQ",avoir:"AVOIR"})[pm.method]||pm.method} ${(Number(pm.amount)||0).toFixed(2)}€`).join(" + ")||tkPayMethod}</div>
        {tkFp&&<div style={{textAlign:"center",background:C.fiscalLight,padding:6,borderRadius:6,margin:"6px 0"}}>
          <div style={{fontSize:9,color:C.fiscal,fontWeight:800}}>EMPREINTE NF525</div>
          <div style={{fontSize:12,fontWeight:800,color:C.fiscal,letterSpacing:2}}>{tkFp}</div></div>}
        {(tk.barcode)&&<div style={{marginTop:6,display:"flex",justifyContent:"center"}}><EAN13Svg code={tk.barcode} width={160} height={45}/></div>}
        <div style={{textAlign:"center",fontSize:11,fontWeight:600,color:C.text,marginTop:4}}>Garantie légale 2 ans</div>
        {(settings.footerMsg||CO.footerMsg)&&<div style={{textAlign:"center",fontSize:15,fontWeight:800,color:C.text,marginTop:6,padding:"6px 0"}}>
          {settings.footerMsg||CO.footerMsg}</div>}
        {settings.ticketFreeText&&<div style={{textAlign:"center",fontSize:12,fontWeight:700,color:C.text,marginTop:4,whiteSpace:"pre-line"}}>
          {settings.ticketFreeText}</div>}
        <div style={{textAlign:"center",fontSize:8,color:C.textMuted,fontWeight:600,marginTop:4}}>{CO.sw} v{CO.ver} — Conforme NF525</div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
        <Btn variant="outline" onClick={()=>thermalPrint("receipt",tk)} style={{flex:1}}><Printer size={14}/> {printerConnected?"Ticket":"Réimprimer"}</Btn>
        <Btn variant="outline" onClick={()=>{
          const giftTk={...tk,_giftCard:true};
          const printed=thermalPrint("receipt",giftTk);
          if(!printed){const w=window.open("","_blank","width=400,height=600");if(!w)return;
            w.document.write(`<html><head><title>Ticket cadeau</title><style>body{font-family:'Courier New',monospace;font-size:12px;padding:10px;max-width:300px;margin:0 auto;}h2{text-align:center;font-size:14px;margin:4px 0;}hr{border:none;border-top:1px dashed #333;margin:6px 0;}.center{text-align:center;}</style></head><body>`+
            `<h2>${settings.name||CO.name}</h2><div class="center">${settings.address||""}, ${settings.postalCode||""} ${settings.city||""}</div><hr>`+
            `<h2>TICKET CADEAU</h2><div class="center">N° ${tkNum}</div><div class="center">${tkDateStr}</div><hr>`+
            tkItems.map(i=>`<div>${i.product?.name||i.product_name||i.name||"Article"}${i.isCustom||i.is_custom?"":" ("+((i.variant?.color||i.variant_color||i.color)||"")+"/"+((i.variant?.size||i.variant_size||i.size)||"")+")"} x${i.quantity||1}</div>`).join("")+
            `<hr><div class="center" style="font-size:10px;">${settings.footerMsg||CO.footerMsg||""}</div>`+
            (tk.barcode?ean13SvgHtml(tk.barcode,160,45):"")+
            `</body></html>`);w.document.close();setTimeout(()=>w.print(),300);}
        }} style={{flex:1}}><Gift size={14}/> Cadeau</Btn>
        <Btn variant="outline" onClick={()=>{setReassignModal(tk);setReassignCust(null);}} style={{flex:1}}><UserIcon size={14}/> Client</Btn>
        <Btn variant="outline" onClick={()=>{const s=encodeURIComponent(`Ticket ${tkNum} — ${settings.name||CO.name}`);
          const b=encodeURIComponent(`Bonjour,\n\nTicket N°${tkNum}\nDate: ${tkDateStr}\nTotal: ${tkTTC.toFixed(2)}€\n\n${settings.name||CO.name}\nSIRET: ${settings.siret||CO.siret}`);
          window.open(`mailto:?subject=${s}&body=${b}`);}} style={{flex:1}}><Mail size={14}/> Email</Btn>
        {p().canVoid&&<Btn variant="danger" onClick={()=>{setReprintTk(null);openReturn(tk);}} style={{flex:1}}><RotateCcw size={14}/> Retour</Btn>}
      </div></>);
      }catch(err){
        console.error("[TicketModal] Render crash:",err);
        window.__CAISSEPRO_ERRORS?.push({ts:new Date().toLocaleTimeString("fr-FR"),msg:`[TICKET MODAL] ${err.message}`,stack:err.stack||""});
        return(<div style={{padding:20,color:C.danger}}>
          <div style={{fontWeight:700,marginBottom:8}}>Erreur d affichage du ticket</div>
          <div style={{fontSize:11,fontFamily:"monospace",background:"#FEE2E2",padding:10,borderRadius:8,wordBreak:"break-all"}}>{err.message}<br/>{err.stack?.substring(0,500)}</div>
          <Btn variant="danger" onClick={()=>setReprintTk(null)} style={{marginTop:10}}>Fermer</Btn>
        </div>);
      }})()}
    </Modal>

    {/* Return modal */}
    <Modal open={!!returnModal} onClose={()=>setReturnModal(null)} title={`Retour — Ticket ${returnModal?.ticketNumber}`} wide>
      {returnModal&&<>
        <div style={{fontSize:11,color:C.textMuted,marginBottom:12}}>Sélectionnez les articles et quantités à retourner.</div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
          {returnItems.map((ri,idx)=>(<div key={idx} style={{display:"flex",alignItems:"center",gap:8,padding:8,borderRadius:8,border:`1px solid ${ri.qty>0?C.danger+"66":C.border}`,background:ri.qty>0?C.dangerLight:"transparent"}}>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{ri.name}</div>
              <div style={{fontSize:10,color:C.textMuted}}>{ri.color}/{ri.size} — {(ri.unitTTC||0).toFixed(2)}€/u — max: {ri.maxQty}{ri.sku?` — Réf: ${ri.sku}`:""}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <button onClick={()=>setReturnItems(p=>p.map((x,i)=>i===idx?{...x,qty:Math.max(0,x.qty-1)}:x))}
                style={{width:26,height:26,borderRadius:13,border:`1px solid ${C.border}`,background:C.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Minus size={11}/></button>
              <span style={{width:24,textAlign:"center",fontSize:13,fontWeight:700,color:ri.qty>0?C.danger:C.text}}>{ri.qty}</span>
              <button onClick={()=>setReturnItems(p=>p.map((x,i)=>i===idx?{...x,qty:Math.min(x.maxQty,x.qty+1)}:x))}
                style={{width:26,height:26,borderRadius:13,border:`1px solid ${C.border}`,background:C.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Plus size={11}/></button>
              <Btn variant="ghost" onClick={()=>setReturnItems(p=>p.map((x,i)=>i===idx?{...x,qty:x.maxQty}:x))} style={{fontSize:9,padding:"2px 6px"}}>Tout</Btn>
            </div>
            <div style={{width:60,textAlign:"right",fontSize:12,fontWeight:700,color:ri.qty>0?C.danger:C.textLight}}>
              {ri.qty>0?`-${((ri.qty||0)*(ri.unitTTC||0)).toFixed(2)}€`:"—"}</div>
          </div>))}
        </div>
        <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MOTIF DU RETOUR</label>
          <select value={returnReason} onChange={e=>setReturnReason(e.target.value)} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
            <option value="">Sélectionner un motif…</option>
            <option value="Défaut produit">Défaut produit</option>
            <option value="Taille incorrecte">Taille incorrecte</option>
            <option value="Ne convient pas">Ne convient pas</option>
            <option value="Erreur de caisse">Erreur de caisse</option>
            <option value="Autre">Autre</option></select></div>
        <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MODE DE REMBOURSEMENT</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
            {[{id:"cash",l:"Espèces",i:Banknote},{id:"card",l:"Carte",i:CreditCard},{id:"avoir",l:"Avoir client",i:Gift},{id:"exchange",l:"Échange immédiat",i:RotateCcw}].map(m=>(
              <button key={m.id} onClick={()=>setReturnMethod(m.id)} style={{padding:10,borderRadius:10,border:`2px solid ${returnMethod===m.id?C.danger:C.border}`,
                background:returnMethod===m.id?C.dangerLight:"transparent",cursor:"pointer",textAlign:"center"}}>
                <m.i size={16} color={returnMethod===m.id?C.danger:C.textMuted} style={{display:"block",margin:"0 auto 4px"}}/>
                <div style={{fontSize:11,fontWeight:600,color:returnMethod===m.id?C.danger:C.text}}>{m.l}</div></button>))}</div></div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,background:C.dangerLight,marginBottom:12}}>
          <span style={{fontSize:13,fontWeight:700,color:C.danger}}>Total remboursement</span>
          <span style={{fontSize:16,fontWeight:800,color:C.danger}}>{(returnTotal||0).toFixed(2)}€</span></div>
        <Btn variant="danger" disabled={returnTotal===0||!returnReason} onClick={async()=>{
          const avoir=await processReturn(returnModal,returnItems.filter(i=>i.qty>0),returnReason,returnMethod==="exchange"?"avoir":returnMethod);
          if(avoir&&returnMethod==="exchange"){setSelectedAvoir({avoirNumber:avoir.avoirNumber,totalTTC:avoir.totalTTC||0,remaining:avoir.remaining||avoir.totalTTC||0,applied:avoir.totalTTC||0});setMode("cashier");notify(`Avoir ${avoir.avoirNumber} de ${(avoir.totalTTC||0).toFixed(2)}€ appliqué — Scannez les nouveaux articles`,"success");}
          setReturnModal(null);}}
          style={{width:"100%",height:44}}><RotateCcw size={16}/> Valider le retour</Btn>
        {!returnReason&&returnTotal>0&&<div style={{marginTop:6,fontSize:10,color:C.warn,textAlign:"center"}}>Veuillez sélectionner un motif de retour</div>}
      </>}
    </Modal>

    {/* Avoir detail modal */}
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
        <div data-print-receipt style={{fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:500,background:C.dangerLight,borderRadius:10,padding:16,border:`1px solid ${C.danger}33`}}>
        <div style={{textAlign:"center",marginBottom:6,color:C.danger,fontWeight:800,fontSize:14}}>AVOIR / NOTE DE CRÉDIT</div>
        <div style={{textAlign:"center",marginBottom:6}}><div style={{fontSize:14,fontWeight:800}}>{settings.name||CO.name}</div>
          <div style={{fontWeight:600}}>SIRET: {settings.siret||CO.siret}</div></div>
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
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:14,color:C.danger}}><span>TOTAL AVOIR</span><span>-{avTTC.toFixed(2)}€</span></div>
        <div style={{fontWeight:700}}>Remboursement: {({cash:"Espèces",card:"Carte bancaire",avoir:"Avoir client"})[avRefund]||avRefund}</div>
        {avFp&&<div style={{textAlign:"center",background:C.dangerLight,padding:6,borderRadius:6,margin:"6px 0"}}>
          <div style={{fontSize:9,color:C.danger,fontWeight:800}}>EMPREINTE NF525</div>
          <div style={{fontSize:12,fontWeight:800,color:C.danger,letterSpacing:2}}>{avFp}</div></div>}
        {(av.barcode)&&<div style={{marginTop:6,display:"flex",justifyContent:"center"}}><EAN13Svg code={av.barcode} width={160} height={45}/></div>}
      </div>
      <Btn variant="outline" onClick={()=>thermalPrint("avoir",av)} style={{width:"100%",marginTop:10}}><Printer size={14}/> {printerConnected?"Ticket":"Imprimer"}</Btn>
      </>);
      }catch(err){
        console.error("[AvoirModal] Render crash:",err);
        return(<div style={{padding:20,color:C.danger}}>
          <div style={{fontWeight:700,marginBottom:8}}>Erreur d affichage de l avoir</div>
          <div style={{fontSize:11,fontFamily:"monospace",background:"#FEE2E2",padding:10,borderRadius:8,wordBreak:"break-all"}}>{err.message}</div>
          <Btn variant="danger" onClick={()=>setAvoirDetail(null)} style={{marginTop:10}}>Fermer</Btn>
        </div>);
      }})()}
    </Modal>

    <Modal open={!!reassignModal} onClose={()=>setReassignModal(null)} title="Changer le client">
      {reassignModal&&<div>
        <div style={{fontSize:11,color:C.textMuted,marginBottom:10}}>Ticket: {reassignModal.ticketNumber} — {(reassignModal.totalTTC||parseFloat(reassignModal.total_ttc)||0).toFixed(2)}€</div>
        <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:300,overflowY:"auto"}}>
          <button onClick={()=>setReassignCust(null)} style={{padding:8,borderRadius:8,border:`2px solid ${!reassignCust?C.primary:C.border}`,background:!reassignCust?C.primaryLight:"transparent",cursor:"pointer",textAlign:"left",fontSize:11,fontWeight:600}}>Aucun client</button>
          {customers.map(c=>(<button key={c.id} onClick={()=>setReassignCust(c)}
            style={{padding:8,borderRadius:8,border:`2px solid ${reassignCust?.id===c.id?C.primary:C.border}`,background:reassignCust?.id===c.id?C.primaryLight:"transparent",cursor:"pointer",textAlign:"left"}}>
            <div style={{fontSize:11,fontWeight:600}}>{c.firstName} {c.lastName}</div>
            <div style={{fontSize:9,color:C.textMuted}}>{c.email||c.phone||""}</div></button>))}
        </div>
        <Btn onClick={async()=>{
          try{
            const custId=reassignCust?.id||null;const custName=reassignCust?`${reassignCust.firstName} ${reassignCust.lastName}`:null;
            // M7 fix: properly handle API errors for reassignment
            if(reassignModal.id){try{await API.sales.update?.(reassignModal.id,{customerId:custId});}catch(e){notify("Erreur serveur: "+e.message+" — modification locale uniquement","warn");}}
            // Update local ticket state
            setTickets(prev=>prev.map(t=>t.ticketNumber===reassignModal.ticketNumber?{...t,customerId:custId,customerName:custName}:t));
            notify(`Client ${custName||"retiré"} attribué au ticket ${reassignModal.ticketNumber}`,"success");
            setReassignModal(null);
          }catch(e){notify("Erreur: "+e.message,"error");}
        }} style={{width:"100%",height:40,marginTop:10,background:C.primary}}>Attribuer</Btn>
      </div>}
    </Modal>
  </div>);
}

/* ══════════ RETURN SCREEN ══════════ */

export default HistoryScreen;
export { HistoryScreen };
