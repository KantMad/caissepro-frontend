import React, { useState, useMemo } from "react";
import { Search, Receipt, RotateCcw, Users, DollarSign, Download, FileText, Database, Grid, Split, Check, X } from "lucide-react";
import { CO, C } from "../constants.jsx";
import { Modal, Btn, Input } from "../ui.jsx";
import { useApp } from "../context.jsx";
import FactureDialog from "../FactureDialog.jsx";
import * as API from "../api.js";
import { dayKey } from "../lib/dates.js";

function ExportsScreen(){
  const{tickets,avoirs,customers,settings,notify,addAudit,addJET,perm}=useApp();
  if(!perm().canExport)return<div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:16,fontWeight:600}}>Accès réservé aux administrateurs</div>;
  const[tab,setTab]=useState("sales");
  const[dateFrom,setDateFrom]=useState(()=>{const d=new Date();d.setMonth(d.getMonth()-1);return dayKey(d);});
  const[dateTo,setDateTo]=useState(()=>dayKey());
  const[searchQ,setSearchQ]=useState("");
  const[minAmount,setMinAmount]=useState("");
  const[maxAmount,setMaxAmount]=useState("");
  const[payMethodFilter,setPayMethodFilter]=useState("all");
  const[refundMethodFilter,setRefundMethodFilter]=useState("all");
  const[customerFilter,setCustomerFilter]=useState("");

  // Colonnes des fichiers produits par le serveur (fixes, pas de sélection de champs)
  const SERVER_COLUMNS={
    sales:"N° ticket, date, heure, vendeur, client, nb articles, détail articles, remise lignes €, remise ticket €, total HT, TVA, total TTC, marge, paiement, note, empreinte NF525.",
    salesDetail:"N° ticket, date, heure, vendeur, client, produit, réf/SKU, EAN, catégorie, collection, couleur, code couleur, taille, quantité, PU TTC, remise ligne €, remise ticket €, ligne HT, TVA, ligne TTC, paiement.",
    returns:"N° avoir, date, heure, ticket d'origine, responsable, client, motif, articles, total HT, TVA, total TTC, type, mode de remboursement, ticket d'utilisation, solde avoir, empreinte NF525.",
    refunds:"N° avoir, date, heure, ticket d'origine, responsable, client, motif, articles, total HT, TVA, total TTC, type, mode de remboursement, ticket d'utilisation, solde avoir, empreinte NF525.",
    exchanges:"N° avoir, date, heure, ticket d'origine, responsable, client, motif, articles, total HT, TVA, total TTC, type, mode de remboursement, ticket d'utilisation, solde avoir, empreinte NF525.",
    clients:"Nom complet, prénom, nom, email, téléphone, ville, points fidélité, niveau, total dépensé, nb achats, panier moyen, premier achat, dernier achat, notes.",
  };

  // Field configuration per export type
  const FIELD_DEFS={
    sales:[
      {key:"ticketNumber",label:"N° Ticket",default:true},
      {key:"date",label:"Date",default:true},
      {key:"userName",label:"Vendeur",default:true},
      {key:"customerName",label:"Client",default:true},
      {key:"itemCount",label:"Nb articles",default:true},
      {key:"itemDetails",label:"Détail articles",default:false},
      {key:"totalHT",label:"Total HT",default:true},
      {key:"totalTVA",label:"TVA",default:true},
      {key:"totalTTC",label:"Total TTC",default:true},
      {key:"paymentMethod",label:"Mode de paiement",default:true},
      {key:"globalDiscount",label:"Remise globale",default:false},
      {key:"margin",label:"Marge",default:false},
      {key:"saleNote",label:"Note de vente",default:false},
      {key:"fingerprint",label:"Empreinte NF525",default:false},
    ],
    salesDetail:[
      {key:"ticketNumber",label:"N° Ticket",default:true},
      {key:"date",label:"Date",default:true},
      {key:"userName",label:"Vendeur",default:true},
      {key:"customerName",label:"Client",default:true},
      {key:"productName",label:"Produit",default:true},
      {key:"sku",label:"Réf/SKU",default:true},
      {key:"ean",label:"EAN",default:true},
      {key:"category",label:"Catégorie",default:true},
      {key:"collection",label:"Collection",default:true},
      {key:"color",label:"Couleur",default:true},
      {key:"size",label:"Taille",default:true},
      {key:"quantity",label:"Quantité",default:true},
      {key:"unitPrice",label:"PU HT",default:true},
      {key:"lineTTC",label:"Ligne TTC",default:true},
      {key:"discount",label:"Remise article",default:true},
      {key:"paymentMethod",label:"Mode de paiement",default:true},
    ],
    returns:[
      {key:"avoirNumber",label:"N° Avoir",default:true},
      {key:"date",label:"Date",default:true},
      {key:"originalTicket",label:"Ticket d'origine",default:true},
      {key:"userName",label:"Responsable",default:true},
      {key:"customerName",label:"Client",default:true},
      {key:"reason",label:"Motif",default:true},
      {key:"itemDetails",label:"Articles retournés",default:true},
      {key:"totalHT",label:"Total HT",default:true},
      {key:"totalTVA",label:"TVA",default:true},
      {key:"totalTTC",label:"Total TTC",default:true},
      {key:"refundMethod",label:"Mode remboursement",default:true},
      {key:"remaining",label:"Solde avoir",default:false},
      {key:"fingerprint",label:"Empreinte NF525",default:false},
    ],
    exchanges:[
      {key:"avoirNumber",label:"N° Avoir",default:true},
      {key:"date",label:"Date",default:true},
      {key:"originalTicket",label:"Ticket d'origine",default:true},
      {key:"userName",label:"Responsable",default:true},
      {key:"customerName",label:"Client",default:true},
      {key:"reason",label:"Motif",default:true},
      {key:"itemDetails",label:"Articles échangés",default:true},
      {key:"totalTTC",label:"Montant",default:true},
    ],
    refunds:[
      {key:"avoirNumber",label:"N° Avoir",default:true},
      {key:"date",label:"Date",default:true},
      {key:"originalTicket",label:"Ticket d'origine",default:true},
      {key:"userName",label:"Responsable",default:true},
      {key:"customerName",label:"Client",default:true},
      {key:"reason",label:"Motif",default:true},
      {key:"itemDetails",label:"Articles remboursés",default:true},
      {key:"totalHT",label:"Total HT",default:true},
      {key:"totalTVA",label:"TVA",default:true},
      {key:"totalTTC",label:"Total TTC",default:true},
      {key:"refundMethod",label:"Mode remboursement",default:true},
    ],
    clients:[
      {key:"fullName",label:"Nom complet",default:true},
      {key:"firstName",label:"Prénom",default:false},
      {key:"lastName",label:"Nom",default:false},
      {key:"email",label:"Email",default:true},
      {key:"phone",label:"Téléphone",default:true},
      {key:"city",label:"Ville",default:true},
      {key:"points",label:"Points fidélité",default:true},
      {key:"tier",label:"Niveau fidélité",default:true},
      {key:"totalSpent",label:"Total dépensé",default:true},
      {key:"purchaseCount",label:"Nb achats",default:true},
      {key:"avgBasket",label:"Panier moyen",default:false},
      {key:"lastPurchase",label:"Dernier achat",default:true},
      {key:"notes",label:"Notes",default:false},
    ],
  };

  const[fields,setFields]=useState(()=>{
    const init={};Object.keys(FIELD_DEFS).forEach(t=>{init[t]={};FIELD_DEFS[t].forEach(f=>{init[t][f.key]=f.default;});});return init;
  });
  const toggleField=(t,key)=>setFields(p=>({...p,[t]:{...p[t],[key]:!p[t][key]}}));
  const selectAllFields=(t)=>setFields(p=>{const n={...p,[t]:{}};FIELD_DEFS[t].forEach(f=>{n[t][f.key]=true;});return n;});
  const deselectAllFields=(t)=>setFields(p=>{const n={...p,[t]:{}};FIELD_DEFS[t].forEach(f=>{n[t][f.key]=false;});return n;});

  // Invoice state
  const[invoiceModal,setInvoiceModal]=useState(false);   // choix du ticket a facturer
  const[invoiceTicketSearch,setInvoiceTicketSearch]=useState("");
  const[factureTk,setFactureTk]=useState(null);

  // --- Filtered data ---
  const filterByDate=(items,dateField="date")=>items.filter(i=>{
    const brut=i[dateField]||i.createdAt||i.created_at||"";
    // Jour LOCAL (horodatage serveur en UTC) — même découpage que l'export serveur
    const d=brut?(/^\d{4}-\d{2}-\d{2}$/.test(brut)?brut:dayKey(new Date(brut))):"";
    return(!dateFrom||d>=dateFrom)&&(!dateTo||d<=dateTo);
  });
  const filterByAmount=(items,field="totalTTC")=>items.filter(i=>{
    const v=parseFloat(i[field])||0;
    if(minAmount&&v<parseFloat(minAmount))return false;
    if(maxAmount&&v>parseFloat(maxAmount))return false;
    return true;
  });
  const filterBySearch=(items,searchFields)=>items.filter(i=>{
    if(!searchQ)return true;const q=searchQ.toLowerCase();
    return searchFields.some(f=>(String(i[f]||"")).toLowerCase().includes(q));
  });

  const filteredSales=useMemo(()=>{
    let data=[...tickets];
    data=filterByDate(data);data=filterByAmount(data);
    data=filterBySearch(data,["ticketNumber","userName","customerName","saleNote"]);
    if(payMethodFilter!=="all")data=data.filter(t=>(t.payments||[]).some(p=>p.method===payMethodFilter));
    if(customerFilter)data=data.filter(t=>(t.customerName||"").toLowerCase().includes(customerFilter.toLowerCase()));
    return data;
  },[tickets,dateFrom,dateTo,minAmount,maxAmount,searchQ,payMethodFilter,customerFilter]);

  // Un echange est un avoir consomme immediatement par une nouvelle vente (isExchange,
  // calcule par le serveur) : avant, rien n'etait jamais marque "exchange" en base et
  // l'onglet Echanges restait vide en permanence.
  const allReturns=useMemo(()=>avoirs.filter(a=>!a.isExchange&&!["cash","card"].includes(a.refundMethod)),[avoirs]);
  const allExchanges=useMemo(()=>avoirs.filter(a=>a.isExchange),[avoirs]);
  const allRefunds=useMemo(()=>avoirs.filter(a=>a.refundMethod==="cash"||a.refundMethod==="card"),[avoirs]);

  const filteredReturns=useMemo(()=>{
    let data=[...allReturns];data=filterByDate(data);data=filterByAmount(data);
    data=filterBySearch(data,["avoirNumber","originalTicket","userName","customerName","reason"]);
    if(refundMethodFilter!=="all")data=data.filter(a=>a.refundMethod===refundMethodFilter);
    return data;
  },[allReturns,dateFrom,dateTo,minAmount,maxAmount,searchQ,refundMethodFilter]);

  const filteredExchanges=useMemo(()=>{
    let data=[...allExchanges];data=filterByDate(data);
    data=filterBySearch(data,["avoirNumber","originalTicket","userName","customerName","reason"]);
    data=filterByAmount(data,"totalTTC");
    return data;
  },[allExchanges,dateFrom,dateTo,searchQ,minAmount,maxAmount]);

  const filteredRefunds=useMemo(()=>{
    let data=[...allRefunds];data=filterByDate(data);data=filterByAmount(data);
    data=filterBySearch(data,["avoirNumber","originalTicket","userName","customerName","reason"]);
    return data;
  },[allRefunds,dateFrom,dateTo,minAmount,maxAmount,searchQ]);

  const filteredClients=useMemo(()=>{
    let data=[...customers];
    if(searchQ){const q=searchQ.toLowerCase();data=data.filter(c=>
      `${c.firstName||""} ${c.lastName||""}`.toLowerCase().includes(q)||(c.email||"").toLowerCase().includes(q)||(c.phone||"").includes(q)||(c.city||"").toLowerCase().includes(q));}
    if(minAmount)data=data.filter(c=>(c.totalSpent||0)>=parseFloat(minAmount));
    if(maxAmount)data=data.filter(c=>(c.totalSpent||0)<=parseFloat(maxAmount));
    return data;
  },[customers,searchQ,minAmount,maxAmount]);

  const getLoyaltyTierName=(points)=>{
    const tiers=[{min:500,name:"Platine"},{min:250,name:"Or"},{min:100,name:"Argent"},{min:0,name:"Bronze"}];
    return(tiers.find(t=>points>=t.min)||tiers[tiers.length-1]).name;
  };

  // --- Build export rows ---
  const buildSalesRows=()=>{
    const sel=fields.sales;const payLabels={cash:"Espèces",card:"CB",amex:"Amex",contactless:"Sans-contact",giftcard:"Carte cadeau",cheque:"Chèque",avoir:"Avoir"};
    return filteredSales.map(t=>{const row={};
      if(sel.ticketNumber)row["N° Ticket"]=t.ticketNumber;
      if(sel.date)row["Date"]=new Date(t.date||t.createdAt).toLocaleString("fr-FR");
      if(sel.userName)row["Vendeur"]=t.sellerName||t.seller_name||t.userName||t.user_name||"";
      if(sel.customerName)row["Client"]=t.customerName||"";
      if(sel.itemCount)row["Nb articles"]=(t.items||[]).reduce((s,i)=>s+i.quantity,0);
      if(sel.itemDetails)row["Détail articles"]=(t.items||[]).map(i=>`${i.product?.name||i.product_name} x${i.quantity}`).join(" | ");
      if(sel.totalHT)row["Total HT"]=(t.totalHT||parseFloat(t.total_ht)||0).toFixed(2);
      if(sel.totalTVA)row["TVA"]=(t.totalTVA||parseFloat(t.total_tva)||0).toFixed(2);
      if(sel.totalTTC)row["Total TTC"]=(t.totalTTC||parseFloat(t.total_ttc)||0).toFixed(2);
      if(sel.paymentMethod)row["Paiement"]=(t.payments||[]).map(p=>`${payLabels[p.method]||p.method}: ${(Number(p.amount)||0).toFixed(2)}€`).join(", ");
      if(sel.globalDiscount)row["Remise globale"]=(t.globalDiscount||0).toFixed(2);
      if(sel.margin)row["Marge"]=(parseFloat(t.margin)||0).toFixed(2);
      if(sel.saleNote)row["Note"]=t.saleNote||"";
      if(sel.fingerprint)row["Empreinte"]=t.fingerprint||"";
      return row;});
  };

  const buildReturnsRows=(data,sel)=>{
    const refundLabels={avoir:"Avoir",cash:"Espèces",card:"CB",exchange:"Échange"};
    return data.map(a=>{const row={};
      if(sel.avoirNumber)row["N° Avoir"]=a.avoirNumber||a.code||"";
      if(sel.date)row["Date"]=new Date(a.date).toLocaleString("fr-FR");
      if(sel.originalTicket)row["Ticket d'origine"]=a.originalTicket||"";
      if(sel.userName)row["Responsable"]=a.userName||"";
      if(sel.customerName)row["Client"]=a.customerName||"";
      if(sel.reason)row["Motif"]=a.reason||"";
      if(sel.itemDetails)row["Articles"]=(a.items||[]).map(i=>`${i.product?.name||i.product_name||i.name||""} x${i.quantity||i.qty||1}`).join(" | ");
      if(sel.totalHT)row["Total HT"]=(a.totalHT||0).toFixed(2);
      if(sel.totalTVA)row["TVA"]=(a.totalTVA||0).toFixed(2);
      if(sel.totalTTC)row["Total TTC"]=(a.totalTTC||a.amount||0).toFixed(2);
      if(sel.refundMethod)row["Mode remboursement"]=refundLabels[a.refundMethod]||a.refundMethod||"";
      if(sel.remaining)row["Solde avoir"]=(a.remaining||0).toFixed(2);
      if(sel.fingerprint)row["Empreinte"]=a.fingerprint||"";
      return row;});
  };

  const buildClientRows=()=>{
    const sel=fields.clients;
    return filteredClients.map(c=>{const row={};
      if(sel.fullName)row["Nom complet"]=`${c.firstName||""} ${c.lastName||""}`.trim();
      if(sel.firstName)row["Prénom"]=c.firstName||"";
      if(sel.lastName)row["Nom"]=c.lastName||"";
      if(sel.email)row["Email"]=c.email||"";
      if(sel.phone)row["Téléphone"]=c.phone||"";
      if(sel.city)row["Ville"]=c.city||"";
      if(sel.points)row["Points fidélité"]=c.points||0;
      if(sel.tier)row["Niveau"]=getLoyaltyTierName(c.points||0);
      if(sel.totalSpent)row["Total dépensé"]=(c.totalSpent||0).toFixed(2);
      if(sel.purchaseCount){const count=tickets.filter(t=>t.customerId===c.id).length;row["Nb achats"]=count;}
      if(sel.avgBasket){const ct=tickets.filter(t=>t.customerId===c.id);const total=ct.reduce((s,t)=>s+(t.totalTTC||0),0);row["Panier moyen"]=ct.length?(total/ct.length).toFixed(2):"0.00";}
      if(sel.lastPurchase){const last=tickets.filter(t=>t.customerId===c.id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];row["Dernier achat"]=last?new Date(last.date).toLocaleDateString("fr-FR"):"Jamais";}
      if(sel.notes)row["Notes"]=c.notes||"";
      return row;});
  };

  const buildSalesDetailRows=()=>{
    const sel=fields.salesDetail||{};const payLabels={cash:"Espèces",card:"CB",amex:"Amex",contactless:"Sans-contact",giftcard:"Carte cadeau",cheque:"Chèque",avoir:"Avoir"};
    const rows=[];
    filteredSales.forEach(t=>{const seller=t.sellerName||t.seller_name||t.userName||t.user_name||"";
      const client=t.customerName||t.customer_name||"";
      const tkDate=new Date(t.date||t.createdAt||t.created_at).toLocaleString("fr-FR");
      const payStr=(t.payments||[]).map(p=>`${payLabels[p.method]||p.method}: ${Number(p.amount||0).toFixed(2)}€`).join(", ");
      (t.items||[]).forEach(i=>{const row={};
        if(sel.ticketNumber)row["N° Ticket"]=t.ticketNumber||t.ticket_number||"";
        if(sel.date)row["Date"]=tkDate;
        if(sel.userName)row["Vendeur"]=seller;
        if(sel.customerName)row["Client"]=client;
        if(sel.productName)row["Produit"]=i.product?.name||i.product_name||i.name||"";
        if(sel.sku)row["Réf/SKU"]=i.product?.sku||i.product_sku||i.sku||"";
        if(sel.ean)row["EAN"]=i.variant?.ean||i.variant_ean||i.ean||"";
        if(sel.category)row["Catégorie"]=i.product?.category||i.category||"";
        if(sel.collection)row["Collection"]=i.product?.collection||i.collection||"";
        if(sel.color)row["Couleur"]=i.variant?.color||i.variant_color||i.color||"";
        if(sel.size)row["Taille"]=i.variant?.size||i.variant_size||i.size||"";
        if(sel.quantity)row["Quantité"]=i.quantity||1;
        if(sel.unitPrice)row["PU HT"]=Number(i.unit_price||i.unitTTC||0).toFixed(2);
        if(sel.lineTTC)row["Ligne TTC"]=Number(i.lineTTC||i.line_ttc||(Number(i.unit_price||0)*(i.quantity||1))).toFixed(2);
        if(sel.discount)row["Remise article"]=(i.lineDiscountHT||0)>0?`${i.lineDiscountHT.toFixed(2)}€ HT`:"";
        if(sel.paymentMethod)row["Paiement"]=payStr;
        rows.push(row);});
    });return rows;
  };

  // Tous les exports sont générés par le backend : l'écran ne charge que les 200 dernières
  // ventes, un export construit depuis la mémoire tronquait donc les périodes chargées.
  const SERVER_EXPORT={
    sales:{kind:"sales",label:"ventes"},
    salesDetail:{kind:"sales-detail",label:"ventes détaillées"},
    returns:{kind:"returns",label:"retours",params:{mode:"avoir"}},
    refunds:{kind:"returns",label:"remboursements",params:{mode:"refund"}},
    exchanges:{kind:"returns",label:"échanges",params:{mode:"exchange"}},
    clients:{kind:"customers",label:"clients"},
  };
  const downloadServerExport=(format)=>{
    const conf=SERVER_EXPORT[tab];if(!conf)return;
    const url=API.exports.url(conf.kind,{from:dateFrom+"T00:00:00",to:dateTo+"T23:59:59",format,...(conf.params||{})});
    window.open(url,"_blank");
    addAudit&&addAudit("EXPORT",`Export ${conf.label} (${format}) ${dateFrom} → ${dateTo}`);
    // Le fichier s'ouvre dans un nouvel onglet : en cas de refus (session expirée, droits),
    // c'est là que s'affiche le message — on ne prétend donc pas que l'export a réussi.
    notify(`Export ${conf.label} : téléchargement demandé (vérifiez le fichier reçu)`,"info");
  };
  const downloadSalesDetail=downloadServerExport;

  // Tous les onglets sont servis par le backend (cf. SERVER_EXPORT).
  const doExport=()=>downloadServerExport("xlsx");

  // Facture : FactureDialog (emission serveur, rendu A4 serveur, email) — partagee avec l'ecran Tickets

  const salesDetailCount=useMemo(()=>filteredSales.reduce((s,t)=>s+(t.items||[]).length,0),[filteredSales]);
  const tabs=[
    {id:"sales",label:"Ventes",icon:Receipt,count:filteredSales.length},
    {id:"salesDetail",label:"Détail articles",icon:Grid,count:salesDetailCount},
    {id:"returns",label:"Retours",icon:RotateCcw,count:filteredReturns.length},
    {id:"exchanges",label:"Échanges",icon:Split,count:filteredExchanges.length},
    {id:"refunds",label:"Remboursements",icon:DollarSign,count:filteredRefunds.length},
    {id:"clients",label:"Clients",icon:Users,count:filteredClients.length},
  ];

  const currentCount=tab==="sales"?filteredSales.length:tab==="salesDetail"?salesDetailCount:tab==="returns"?filteredReturns.length:tab==="exchanges"?filteredExchanges.length:tab==="refunds"?filteredRefunds.length:filteredClients.length;
  const activeFields=FIELD_DEFS[tab]||[];
  const selectedCount=activeFields.filter(f=>fields[tab]?.[f.key]).length;

  // Data preview (first 10 rows)
  const previewData=useMemo(()=>{
    if(tab==="sales")return filteredSales.slice(0,10);
    if(tab==="salesDetail"){const rows=[];filteredSales.some(t=>{(t.items||[]).forEach(i=>{if(rows.length<10)rows.push({...t,_item:i});});return rows.length>=10;});return rows;}
    if(tab==="returns")return filteredReturns.slice(0,10);
    if(tab==="exchanges")return filteredExchanges.slice(0,10);
    if(tab==="refunds")return filteredRefunds.slice(0,10);
    if(tab==="clients")return filteredClients.slice(0,10);
    return[];
  },[tab,filteredSales,filteredReturns,filteredExchanges,filteredRefunds,filteredClients]);

  return(<div style={{height:"100%",overflowY:"auto",padding:24,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
      <div>
        <h2 style={{fontSize:22,fontWeight:800,margin:0,letterSpacing:"-0.4px"}}>Exports & Factures</h2>
        <p style={{fontSize:12,color:C.textMuted,margin:"4px 0 0"}}>Exportez vos données en CSV/Excel et générez des factures clients</p></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
        <Btn variant="outline" onClick={()=>setInvoiceModal(true)} style={{gap:6}}><FileText size={14}/> Générer une facture</Btn>
        <Btn variant="outline" onClick={()=>{const url=API.exports.invoiceEanUrl({from:dateFrom+"T00:00:00",to:dateTo+"T23:59:59"});window.open(url,"_blank");addAudit&&addAudit("EXPORT",`Facturation EAN ${dateFrom} → ${dateTo}`);}} style={{gap:6,color:C.fiscal,borderColor:C.fiscal+"44"}} title="Excel : ventes + avoirs par EAN (2 onglets)"><Grid size={14}/> Facturation EAN (Excel)</Btn>
        {SERVER_EXPORT[tab]&&<Btn variant="outline" onClick={()=>downloadServerExport("csv")} style={{gap:6}} title="CSV séparé par ; — s'ouvre directement en colonnes dans Excel FR"><Download size={14}/> CSV (Excel FR)</Btn>}
        <Btn onClick={doExport} disabled={!SERVER_EXPORT[tab]&&(selectedCount===0||currentCount===0)} style={{background:C.primary,gap:6}}><Download size={14}/> {SERVER_EXPORT[tab]?"Exporter Excel":`Exporter CSV (${currentCount})`}</Btn></div></div>

    {/* Tabs */}
    <div style={{display:"flex",gap:4,marginBottom:16,background:C.surfaceAlt,borderRadius:12,padding:4}}>
      {tabs.map(t=>{const I=t.icon;return(<button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 14px",borderRadius:9,border:"none",cursor:"pointer",
        background:tab===t.id?C.surface:"transparent",color:tab===t.id?C.text:C.textMuted,fontSize:12,fontWeight:tab===t.id?700:500,fontFamily:"inherit",
        boxShadow:tab===t.id?`0 1px 3px ${C.shadow}, 0 0 0 1px ${C.border}`:"none",transition:"all 0.15s"}}>
        <I size={14}/>{t.label}<span style={{background:tab===t.id?`${C.primary}15`:C.surfaceAlt,color:tab===t.id?C.primary:C.textLight,
          padding:"2px 7px",borderRadius:6,fontSize:10,fontWeight:700}}>{t.count}</span></button>);})}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16}}>
      {/* Left panel — Filters + Fields */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Filters */}
        <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><Search size={13}/> Filtres</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>RECHERCHE</label>
              <Input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Ticket, client, vendeur..." style={{fontSize:11,padding:"8px 10px"}}/></div>
            {tab!=="clients"&&<>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>DATE DÉBUT</label>
                  <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{fontSize:11,padding:"7px 8px"}}/></div>
                <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>DATE FIN</label>
                  <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{fontSize:11,padding:"7px 8px"}}/></div></div></>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>{tab==="clients"?"DÉPENSÉ MIN":"MONTANT MIN"}</label>
                <Input type="number" value={minAmount} onChange={e=>setMinAmount(e.target.value)} placeholder="0.00" style={{fontSize:11,padding:"7px 8px"}}/></div>
              <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>{tab==="clients"?"DÉPENSÉ MAX":"MONTANT MAX"}</label>
                <Input type="number" value={maxAmount} onChange={e=>setMaxAmount(e.target.value)} placeholder="9999" style={{fontSize:11,padding:"7px 8px"}}/></div></div>
            {tab==="sales"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MODE PAIEMENT</label>
              <select value={payMethodFilter} onChange={e=>setPayMethodFilter(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit",background:C.surface}}>
                <option value="all">Tous</option><option value="cash">Espèces</option><option value="card">CB</option><option value="amex">Amex</option><option value="cheque">Chèque</option><option value="giftcard">Carte cadeau</option><option value="avoir">Avoir</option></select></div>}
            {(tab==="returns"||tab==="refunds")&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MODE REMBOURSEMENT</label>
              <select value={refundMethodFilter} onChange={e=>setRefundMethodFilter(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit",background:C.surface}}>
                <option value="all">Tous</option><option value="avoir">Avoir</option><option value="cash">Espèces</option><option value="card">CB</option></select></div>}
            {tab==="sales"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>CLIENT</label>
              <Input value={customerFilter} onChange={e=>setCustomerFilter(e.target.value)} placeholder="Nom du client..." style={{fontSize:11,padding:"8px 10px"}}/></div>}
          </div>
        </div>

        {/* Field selection — le détail articles est généré par le backend : colonnes fixes */}
        {SERVER_EXPORT[tab]?
        <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <div style={{fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6,marginBottom:8}}><Grid size={13}/> Colonnes du fichier</div>
          <div style={{fontSize:11,color:C.textMuted,lineHeight:1.7}}>{SERVER_COLUMNS[tab]}</div>
          <div style={{fontSize:10,color:C.textLight,marginTop:8}}>Généré par le serveur sur toute la période choisie — les filtres de l'écran ne s'y appliquent pas.</div>
        </div>
        :<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6}}><Grid size={13}/> Champs ({selectedCount}/{activeFields.length})</div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>selectAllFields(tab)} style={{fontSize:9,fontWeight:600,color:C.primary,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Tout</button>
              <span style={{color:C.textLight,fontSize:9}}>|</span>
              <button onClick={()=>deselectAllFields(tab)} style={{fontSize:9,fontWeight:600,color:C.textMuted,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Aucun</button></div></div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            {activeFields.map(f=>{const on=fields[tab]?.[f.key];return(
              <button key={f.key} onClick={()=>toggleField(tab,f.key)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:8,border:"none",cursor:"pointer",
                background:on?`${C.primary}08`:"transparent",textAlign:"left",fontFamily:"inherit",transition:"all 0.1s"}}>
                <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${on?C.primary:C.border}`,background:on?C.primary:"transparent",
                  display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                  {on&&<Check size={10} color="#fff"/>}</div>
                <span style={{fontSize:11,fontWeight:on?600:400,color:on?C.text:C.textMuted}}>{f.label}</span></button>);})}
          </div>
        </div>}
      </div>

      {/* Right panel — Preview */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6}}><FileText size={13}/> Aperçu ({currentCount} résultats)
            {SERVER_EXPORT[tab]&&<span style={{fontSize:10,fontWeight:500,color:C.textMuted}}>— écran uniquement : le fichier contient toute la période</span>}</div>
          {tab==="sales"&&<Btn variant="ghost" onClick={()=>setInvoiceModal(true)} style={{fontSize:10,gap:4}}><FileText size={12}/> Facturer</Btn>}
        </div>
        <div style={{overflowX:"auto"}}>
          {currentCount===0?
            <div style={{textAlign:"center",padding:"40px 20px",color:C.textLight}}>
              <Database size={32} style={{marginBottom:8,opacity:0.3}}/>
              <div style={{fontSize:13,fontWeight:600}}>Aucune donnée</div>
              <div style={{fontSize:11,marginTop:4}}>Ajustez vos filtres ou sélectionnez une période différente</div></div>
          :<table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
              {tab==="sales"&&<th style={{padding:"8px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,whiteSpace:"nowrap"}}>Action</th>}
              {activeFields.filter(f=>fields[tab]?.[f.key]).map(f=>(
                <th key={f.key} style={{padding:"8px 10px",textAlign:f.key.includes("total")||f.key.includes("amount")||f.key==="margin"||f.key==="points"||f.key==="totalSpent"||f.key==="avgBasket"?"right":"left",
                  fontSize:10,fontWeight:700,color:C.textMuted,whiteSpace:"nowrap"}}>{f.label}</th>))}
            </tr></thead>
            <tbody>
              {previewData.map((item,idx)=>{
                const rowData=tab==="sales"?buildSalesRows().find((_,i)=>i===idx):
                  tab==="returns"?buildReturnsRows(filteredReturns,fields.returns)[idx]:
                  tab==="exchanges"?buildReturnsRows(filteredExchanges,fields.exchanges)[idx]:
                  tab==="refunds"?buildReturnsRows(filteredRefunds,fields.refunds)[idx]:
                  tab==="salesDetail"?buildSalesDetailRows()[idx]:
                  buildClientRows()[idx];
                if(!rowData)return null;
                const vals=Object.values(rowData);
                return(<tr key={idx} style={{borderBottom:`1px solid ${C.surfaceAlt}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {tab==="sales"&&<td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                    <button onClick={()=>setFactureTk(item)}
                      style={{background:`${C.primary}10`,color:C.primary,border:"none",borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:3}}>
                      <FileText size={10}/> Facture</button></td>}
                  {vals.map((v,vi)=>(
                    <td key={vi} style={{padding:"8px 10px",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                      textAlign:typeof v==="number"||String(v).match(/^\d+\.\d{2}$/)?"right":"left",fontVariantNumeric:"tabular-nums"}}>{String(v)}</td>))}
                </tr>);})}
            </tbody></table>}
          {currentCount>10&&<div style={{textAlign:"center",padding:"10px",fontSize:11,color:C.textMuted,borderTop:`1px solid ${C.surfaceAlt}`,marginTop:4}}>
            ... et {currentCount-10} autres lignes{SERVER_EXPORT[tab]?"":" (incluses dans l'export)"}</div>}
        </div>
      </div>
    </div>

    {/* Choix du ticket, puis FactureDialog (client, emission, impression / email) */}
    <Modal open={invoiceModal} onClose={()=>setInvoiceModal(false)} title="Générer une facture" sub="Sélectionnez le ticket de vente à facturer">
      <Input value={invoiceTicketSearch} onChange={e=>setInvoiceTicketSearch(e.target.value)} placeholder="Rechercher un ticket (numéro, client)..." style={{fontSize:11,padding:"8px 10px",marginBottom:6}}/>
      <div style={{maxHeight:320,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:10}}>
        {tickets.filter(t=>!invoiceTicketSearch||(t.ticketNumber||"").toLowerCase().includes(invoiceTicketSearch.toLowerCase())||(t.customerName||"").toLowerCase().includes(invoiceTicketSearch.toLowerCase()))
          .slice(0,30).map(t=>(<button key={t.ticketNumber||t.seq} onClick={()=>{setInvoiceModal(false);setInvoiceTicketSearch("");setFactureTk(t);}}
            style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"transparent",border:"none",borderBottom:`1px solid ${C.surfaceAlt}`,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}
            onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:11,fontWeight:600,color:C.primary,minWidth:120}}>{t.ticketNumber}</span>
            <span style={{fontSize:10,color:C.textMuted,flex:1}}>{new Date(t.date||t.createdAt).toLocaleDateString("fr-FR")} — {t.customerName||"Comptoir"}</span>
            <span style={{fontSize:11,fontWeight:700}}>{(t.totalTTC||0).toFixed(2)}€</span></button>))}</div>
    </Modal>
    <FactureDialog ticket={factureTk} onClose={()=>setFactureTk(null)}/>
  </div>);
}


// Export all screen components

export default ExportsScreen;
export { ExportsScreen };
