import React, { useState, useMemo } from "react";
import { Search, Receipt, RotateCcw, Users, DollarSign, Download, FileText, Database, Grid, Split, Check, X } from "lucide-react";
import { CO, C } from "../constants.jsx";
import { Modal, Btn, Input } from "../ui.jsx";
import { useApp } from "../context.jsx";

function ExportsScreen(){
  const{tickets,avoirs,customers,settings,exportCSVReport,notify,addAudit,addJET,perm}=useApp();
  if(!perm().canExport)return<div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:16,fontWeight:600}}>Accès réservé aux administrateurs</div>;
  const[tab,setTab]=useState("sales");
  const[dateFrom,setDateFrom]=useState(()=>{const d=new Date();d.setMonth(d.getMonth()-1);return d.toISOString().split("T")[0];});
  const[dateTo,setDateTo]=useState(()=>new Date().toISOString().split("T")[0]);
  const[searchQ,setSearchQ]=useState("");
  const[minAmount,setMinAmount]=useState("");
  const[maxAmount,setMaxAmount]=useState("");
  const[payMethodFilter,setPayMethodFilter]=useState("all");
  const[refundMethodFilter,setRefundMethodFilter]=useState("all");
  const[customerFilter,setCustomerFilter]=useState("");

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
  const[invoiceModal,setInvoiceModal]=useState(false);
  const[invoiceTicket,setInvoiceTicket]=useState(null);
  const[invoiceClient,setInvoiceClient]=useState(null);
  const[invoiceClientSearch,setInvoiceClientSearch]=useState("");
  const[invoiceTicketSearch,setInvoiceTicketSearch]=useState("");
  const[invoiceNotes,setInvoiceNotes]=useState("");
  const[invoiceDue,setInvoiceDue]=useState(()=>{const d=new Date();d.setDate(d.getDate()+30);return d.toISOString().split("T")[0];});

  // --- Filtered data ---
  const filterByDate=(items,dateField="date")=>items.filter(i=>{
    const d=(i[dateField]||i.createdAt||i.created_at||"").slice(0,10);
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

  const allReturns=useMemo(()=>avoirs.filter(a=>a.refundMethod!=="exchange"),[avoirs]);
  const allExchanges=useMemo(()=>avoirs.filter(a=>a.refundMethod==="exchange"),[avoirs]);
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
    return data;
  },[allExchanges,dateFrom,dateTo,searchQ]);

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
      if(sel.paymentMethod)row["Paiement"]=(t.payments||[]).map(p=>`${payLabels[p.method]||p.method}: ${p.amount.toFixed(2)}€`).join(", ");
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

  const doExport=()=>{
    let rows,filename;
    const d=dateFrom&&dateTo?`${dateFrom}_${dateTo}`:"all";
    if(tab==="sales"){rows=buildSalesRows();filename=`ventes_${d}.csv`;}
    else if(tab==="returns"){rows=buildReturnsRows(filteredReturns,fields.returns);filename=`retours_${d}.csv`;}
    else if(tab==="exchanges"){rows=buildReturnsRows(filteredExchanges,fields.exchanges);filename=`echanges_${d}.csv`;}
    else if(tab==="refunds"){rows=buildReturnsRows(filteredRefunds,fields.refunds);filename=`remboursements_${d}.csv`;}
    else if(tab==="clients"){rows=buildClientRows();filename=`clients_${d}.csv`;}
    if(!rows||!rows.length){notify("Aucune donnée à exporter","warn");return;}
    exportCSVReport(rows,filename);
    addAudit("EXPORT",`Export ${tab} — ${rows.length} lignes`);
    addJET("EXPORT",`Export CSV ${tab}`);
    notify(`${rows.length} lignes exportées`,"success");
  };

  // --- Invoice generation ---
  const generateInvoice=(ticket,client)=>{
    const storeName=settings.name||CO.name;
    const storeAddr=settings.address||CO.address;
    const storePC=settings.postalCode||CO.postalCode;
    const storeCity=settings.city||CO.city;
    const storeSiret=settings.siret||CO.siret;
    const storeTVA=settings.tvaIntra||CO.tvaIntra;
    const storePhone=settings.phone||CO.phone;
    const storeLegal=settings.legalForm||CO.legalForm||"";
    const storeCapital=settings.capital||CO.capital||"";
    const invoiceNum=`FA-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const invoiceDate=new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});

    const clientName=client?`${client.firstName||""} ${client.lastName||""}`.trim():(ticket.customerName||"Client comptoir");
    const clientEmail=client?.email||"";
    const clientPhone=client?.phone||"";
    const clientCity=client?.city||"";
    const clientAddr=client?.address||"";

    const items=(ticket.items||[]).map(i=>{
      const name=i.product?.name||i.product_name||"Article";
      const variant=i.variant?` (${i.variant.color||i.variant_color||""}${i.variant.size||i.variant_size?"/":""}${i.variant.size||i.variant_size||""})`.replace("(/","(").replace("/)",")").replace("()",""):"";
      const qty=i.quantity;
      const unitHT=i.lineHT?i.lineHT/qty:(i.line_ht||0)/qty;
      const taxRate=i.product?.taxRate||i.tax_rate||0.20;
      const lineHT=unitHT*qty;
      const lineTVA=lineHT*taxRate;
      return{name:name+variant,qty,unitHT,taxRate,lineHT,lineTVA,lineTTC:lineHT+lineTVA};
    });

    const totalHT=items.reduce((s,i)=>s+i.lineHT,0);
    const totalTVA=items.reduce((s,i)=>s+i.lineTVA,0);
    const totalTTC=items.reduce((s,i)=>s+i.lineTTC,0);
    const globalDisc=ticket.globalDiscount||0;
    const netTTC=totalTTC-globalDisc;

    // TVA breakdown
    const tvaBreakdown={};items.forEach(i=>{const r=`${(i.taxRate*100).toFixed(1)}%`;if(!tvaBreakdown[r])tvaBreakdown[r]={base:0,tva:0};tvaBreakdown[r].base+=i.lineHT;tvaBreakdown[r].tva+=i.lineTVA;});

    const payLabels={cash:"Espèces",card:"Carte bancaire",amex:"American Express",contactless:"Sans-contact",giftcard:"Carte cadeau",cheque:"Chèque",avoir:"Avoir"};
    const paymentInfo=(ticket.payments||[]).map(p=>`${payLabels[p.method]||p.method}: ${p.amount.toFixed(2)} EUR`).join(" / ");

    // Generate printable HTML
    const html=`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Facture ${invoiceNum}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1e293b;background:#fff;padding:40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.5;}
.header{display:flex;justify-content:space-between;align-items:start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #047857;}
.store-name{font-size:22px;font-weight:800;color:#047857;letter-spacing:-0.5px;margin-bottom:4px;}
.store-info{font-size:11px;color:#64748b;line-height:1.6;}
.invoice-title{text-align:right;}
.invoice-title h1{font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.8px;}
.invoice-title .num{font-size:13px;color:#047857;font-weight:600;margin-top:2px;}
.invoice-title .date{font-size:11px;color:#64748b;margin-top:4px;}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:28px;}
.party{background:#f8fafc;border-radius:10px;padding:16px;border:1px solid #e2e8f0;}
.party-label{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;}
.party-name{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;}
.party-detail{font-size:11px;color:#64748b;line-height:1.5;}
table{width:100%;border-collapse:collapse;margin-bottom:20px;}
thead th{text-align:left;padding:10px 12px;background:#f1f5f9;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;border-bottom:2px solid #e2e8f0;}
thead th:last-child,thead th:nth-child(2),thead th:nth-child(3),thead th:nth-child(4),thead th:nth-child(5){text-align:right;}
tbody td{padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;}
tbody td:last-child,tbody td:nth-child(2),tbody td:nth-child(3),tbody td:nth-child(4),tbody td:nth-child(5){text-align:right;font-variant-numeric:tabular-nums;}
tbody tr:last-child td{border-bottom:2px solid #e2e8f0;}
.totals{display:flex;justify-content:flex-end;margin-bottom:20px;}
.totals-table{width:280px;}
.totals-row{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#64748b;}
.totals-row.bold{font-weight:700;color:#0f172a;font-size:14px;padding:10px 0;border-top:2px solid #0f172a;margin-top:4px;}
.totals-row.discount{color:#059669;}
.tva-box{background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:20px;border:1px solid #e2e8f0;}
.tva-box h4{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;}
.tva-row{display:flex;justify-content:space-between;font-size:11px;color:#475569;padding:3px 0;}
.payment-box{background:#ecfdf5;border-radius:10px;padding:14px;margin-bottom:20px;border:1px solid #04785722;}
.payment-box .label{font-size:10px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;}
.payment-box .value{font-size:12px;color:#065f46;font-weight:600;}
.notes{background:#fffbeb;border-radius:10px;padding:14px;margin-bottom:20px;border:1px solid #d9770622;font-size:11px;color:#92400e;}
.notes .label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center;line-height:1.6;}
.ref{font-size:10px;color:#94a3b8;margin-bottom:20px;}
@media print{body{padding:20px;} .no-print{display:none !important;}}
.print-btn{position:fixed;top:16px;right:16px;background:#047857;color:#fff;border:none;border-radius:10px;padding:12px 24px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(4,120,87,0.3);}
.print-btn:hover{background:#065f46;}
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Imprimer / PDF</button>
<div class="header">
  <div><div class="store-name">${storeName}</div>
    <div class="store-info">${storeAddr}<br>${storePC} ${storeCity}<br>Tel: ${storePhone}<br>SIRET: ${storeSiret}<br>TVA: ${storeTVA}${storeLegal?`<br>${storeLegal}${storeCapital?` — Capital: ${storeCapital}`:""}`:""}
    </div></div>
  <div class="invoice-title"><h1>FACTURE</h1><div class="num">${invoiceNum}</div>
    <div class="date">${invoiceDate}</div>
    <div class="date">Échéance: ${new Date(invoiceDue).toLocaleDateString("fr-FR")}</div></div></div>
<div class="parties">
  <div class="party"><div class="party-label">Émetteur</div>
    <div class="party-name">${storeName}</div>
    <div class="party-detail">${storeAddr}<br>${storePC} ${storeCity}<br>SIRET: ${storeSiret}<br>TVA: ${storeTVA}</div></div>
  <div class="party"><div class="party-label">Client</div>
    <div class="party-name">${clientName}</div>
    <div class="party-detail">${clientAddr?clientAddr+"<br>":""}${clientCity?clientCity+"<br>":""}${clientEmail?clientEmail+"<br>":""}${clientPhone?clientPhone:""}</div></div></div>
<div class="ref">Réf. ticket: ${ticket.ticketNumber||""} du ${new Date(ticket.date||ticket.createdAt).toLocaleDateString("fr-FR")}</div>
<table><thead><tr><th>Désignation</th><th>Qté</th><th>P.U. HT</th><th>TVA</th><th>Total HT</th><th>Total TTC</th></tr></thead>
<tbody>${items.map(i=>`<tr><td>${i.name}</td><td>${i.qty}</td><td>${i.unitHT.toFixed(2)} EUR</td><td>${(i.taxRate*100).toFixed(1)}%</td><td>${i.lineHT.toFixed(2)} EUR</td><td>${i.lineTTC.toFixed(2)} EUR</td></tr>`).join("")}</tbody></table>
<div class="tva-box"><h4>Récapitulatif TVA</h4>${Object.entries(tvaBreakdown).map(([r,v])=>`<div class="tva-row"><span>TVA ${r} sur ${v.base.toFixed(2)} EUR</span><span>${v.tva.toFixed(2)} EUR</span></div>`).join("")}</div>
<div class="totals"><div class="totals-table">
  <div class="totals-row"><span>Sous-total HT</span><span>${totalHT.toFixed(2)} EUR</span></div>
  <div class="totals-row"><span>TVA</span><span>${totalTVA.toFixed(2)} EUR</span></div>
  ${globalDisc>0?`<div class="totals-row discount"><span>Remise</span><span>-${globalDisc.toFixed(2)} EUR</span></div>`:""}
  <div class="totals-row bold"><span>TOTAL TTC</span><span>${netTTC.toFixed(2)} EUR</span></div></div></div>
<div class="payment-box"><div class="label">Règlement</div><div class="value">${paymentInfo||"Non renseigné"}</div></div>
${invoiceNotes?`<div class="notes"><div class="label">Remarques</div>${invoiceNotes}</div>`:""}
<div class="footer">${storeName} — ${storeAddr}, ${storePC} ${storeCity} — SIRET: ${storeSiret} — TVA intracommunautaire: ${storeTVA}<br>
${storeLegal?`${storeLegal}${storeCapital?` au capital de ${storeCapital}`:""}`:""}<br>
Facture générée par ${CO.sw} v${CO.ver}</div></body></html>`;

    const w=window.open("","_blank","width=860,height=1000");
    w.document.write(html);w.document.close();
    addAudit("FACTURE",`Facture ${invoiceNum} pour ${clientName} — ${netTTC.toFixed(2)}€`);
    addJET("FACTURE",`Génération facture ${invoiceNum}`);
    notify(`Facture ${invoiceNum} générée`,"success");
    setInvoiceModal(false);setInvoiceTicket(null);setInvoiceClient(null);setInvoiceNotes("");
  };

  const tabs=[
    {id:"sales",label:"Ventes",icon:Receipt,count:filteredSales.length},
    {id:"returns",label:"Retours",icon:RotateCcw,count:filteredReturns.length},
    {id:"exchanges",label:"Échanges",icon:Split,count:filteredExchanges.length},
    {id:"refunds",label:"Remboursements",icon:DollarSign,count:filteredRefunds.length},
    {id:"clients",label:"Clients",icon:Users,count:filteredClients.length},
  ];

  const currentCount=tab==="sales"?filteredSales.length:tab==="returns"?filteredReturns.length:tab==="exchanges"?filteredExchanges.length:tab==="refunds"?filteredRefunds.length:filteredClients.length;
  const activeFields=FIELD_DEFS[tab]||[];
  const selectedCount=activeFields.filter(f=>fields[tab]?.[f.key]).length;

  // Data preview (first 10 rows)
  const previewData=useMemo(()=>{
    if(tab==="sales")return filteredSales.slice(0,10);
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
        <p style={{fontSize:12,color:C.textMuted,margin:"4px 0 0"}}>Exportez vos données en CSV et générez des factures clients</p></div>
      <div style={{display:"flex",gap:8}}>
        <Btn variant="outline" onClick={()=>setInvoiceModal(true)} style={{gap:6}}><FileText size={14}/> Générer une facture</Btn>
        <Btn onClick={doExport} disabled={selectedCount===0||currentCount===0} style={{background:C.primary,gap:6}}><Download size={14}/> Exporter CSV ({currentCount})</Btn></div></div>

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

        {/* Field selection */}
        <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
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
        </div>
      </div>

      {/* Right panel — Preview */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6}}><FileText size={13}/> Aperçu ({currentCount} résultats)</div>
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
                  buildClientRows()[idx];
                if(!rowData)return null;
                const vals=Object.values(rowData);
                return(<tr key={idx} style={{borderBottom:`1px solid ${C.surfaceAlt}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {tab==="sales"&&<td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                    <button onClick={()=>{setInvoiceTicket(item);setInvoiceModal(true);
                      const c=customers.find(c=>c.id===item.customerId);if(c)setInvoiceClient(c);}}
                      style={{background:`${C.primary}10`,color:C.primary,border:"none",borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:3}}>
                      <FileText size={10}/> Facture</button></td>}
                  {vals.map((v,vi)=>(
                    <td key={vi} style={{padding:"8px 10px",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                      textAlign:typeof v==="number"||String(v).match(/^\d+\.\d{2}$/)?"right":"left",fontVariantNumeric:"tabular-nums"}}>{String(v)}</td>))}
                </tr>);})}
            </tbody></table>}
          {currentCount>10&&<div style={{textAlign:"center",padding:"10px",fontSize:11,color:C.textMuted,borderTop:`1px solid ${C.surfaceAlt}`,marginTop:4}}>
            ... et {currentCount-10} autres lignes (incluses dans l'export)</div>}
        </div>
      </div>
    </div>

    {/* Invoice generation modal */}
    <Modal open={invoiceModal} onClose={()=>{setInvoiceModal(false);setInvoiceTicket(null);setInvoiceClient(null);}} title="Générer une facture" sub="Sélectionnez un ticket de vente et un client pour créer une facture">
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Ticket selection */}
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>TICKET DE VENTE</label>
          {invoiceTicket?<div style={{display:"flex",alignItems:"center",gap:10,padding:10,background:C.primaryLight,borderRadius:10,border:`1px solid ${C.primary}22`}}>
            <Receipt size={16} color={C.primary}/>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700}}>{invoiceTicket.ticketNumber}</div>
              <div style={{fontSize:10,color:C.textMuted}}>{new Date(invoiceTicket.date||invoiceTicket.createdAt).toLocaleString("fr-FR")} — {(invoiceTicket.totalTTC||0).toFixed(2)}€ — {invoiceTicket.customerName||"Comptoir"}</div></div>
            <button onClick={()=>setInvoiceTicket(null)} style={{background:"none",border:"none",cursor:"pointer"}}><X size={14} color={C.textMuted}/></button></div>
          :<div>
            <Input value={invoiceTicketSearch} onChange={e=>setInvoiceTicketSearch(e.target.value)} placeholder="Rechercher un ticket..." style={{fontSize:11,padding:"8px 10px",marginBottom:6}}/>
            <div style={{maxHeight:160,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:10}}>
              {tickets.filter(t=>!invoiceTicketSearch||(t.ticketNumber||"").toLowerCase().includes(invoiceTicketSearch.toLowerCase())||(t.customerName||"").toLowerCase().includes(invoiceTicketSearch.toLowerCase()))
                .slice(0,20).map(t=>(<button key={t.ticketNumber||t.seq} onClick={()=>{setInvoiceTicket(t);setInvoiceTicketSearch("");
                  const c=customers.find(c=>c.id===t.customerId);if(c)setInvoiceClient(c);}}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"transparent",border:"none",borderBottom:`1px solid ${C.surfaceAlt}`,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{fontSize:11,fontWeight:600,color:C.primary,minWidth:120}}>{t.ticketNumber}</span>
                  <span style={{fontSize:10,color:C.textMuted,flex:1}}>{new Date(t.date||t.createdAt).toLocaleDateString("fr-FR")} — {t.customerName||"Comptoir"}</span>
                  <span style={{fontSize:11,fontWeight:700}}>{(t.totalTTC||0).toFixed(2)}€</span></button>))}</div></div>}
        </div>

        {/* Client selection */}
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>CLIENT</label>
          {invoiceClient?<div style={{display:"flex",alignItems:"center",gap:10,padding:10,background:C.surfaceAlt,borderRadius:10,border:`1px solid ${C.border}`}}>
            <div style={{width:28,height:28,borderRadius:8,background:`${C.primary}15`,display:"flex",alignItems:"center",justifyContent:"center",color:C.primary,fontSize:12,fontWeight:700}}>{(invoiceClient.firstName||"C")[0]}</div>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700}}>{invoiceClient.firstName} {invoiceClient.lastName}</div>
              <div style={{fontSize:10,color:C.textMuted}}>{invoiceClient.email||""} {invoiceClient.phone?`— ${invoiceClient.phone}`:""}</div></div>
            <button onClick={()=>setInvoiceClient(null)} style={{background:"none",border:"none",cursor:"pointer"}}><X size={14} color={C.textMuted}/></button></div>
          :<div>
            <Input value={invoiceClientSearch} onChange={e=>setInvoiceClientSearch(e.target.value)} placeholder="Rechercher un client..." style={{fontSize:11,padding:"8px 10px",marginBottom:6}}/>
            <div style={{maxHeight:140,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:10}}>
              {customers.filter(c=>!invoiceClientSearch||`${c.firstName} ${c.lastName}`.toLowerCase().includes(invoiceClientSearch.toLowerCase())||(c.email||"").toLowerCase().includes(invoiceClientSearch.toLowerCase())||(c.phone||"").includes(invoiceClientSearch))
                .slice(0,15).map(c=>(<button key={c.id} onClick={()=>{setInvoiceClient(c);setInvoiceClientSearch("");}}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"transparent",border:"none",borderBottom:`1px solid ${C.surfaceAlt}`,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{width:24,height:24,borderRadius:6,background:`${C.primary}12`,display:"flex",alignItems:"center",justifyContent:"center",color:C.primary,fontSize:10,fontWeight:700}}>{(c.firstName||"?")[0]}</div>
                  <span style={{fontSize:11,fontWeight:600,flex:1}}>{c.firstName} {c.lastName}</span>
                  <span style={{fontSize:10,color:C.textMuted}}>{c.email||c.phone||""}</span></button>))}</div></div>}
        </div>

        {/* Due date + notes */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>DATE D'ÉCHÉANCE</label>
            <Input type="date" value={invoiceDue} onChange={e=>setInvoiceDue(e.target.value)} style={{fontSize:11,padding:"8px 10px"}}/></div></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>REMARQUES (optionnel)</label>
          <textarea value={invoiceNotes} onChange={e=>setInvoiceNotes(e.target.value)} placeholder="Conditions de paiement, remarques..."
            style={{width:"100%",height:60,padding:"8px 10px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit",resize:"vertical",background:C.surface}}/></div>

        <Btn onClick={()=>{if(!invoiceTicket){notify("Sélectionnez un ticket","error");return;}generateInvoice(invoiceTicket,invoiceClient);}}
          disabled={!invoiceTicket} style={{width:"100%",height:44,background:C.primary,gap:6,marginTop:4}}>
          <FileText size={14}/> Générer la facture</Btn>
      </div>
    </Modal>
  </div>);
}


// Export all screen components

export default ExportsScreen;
export { ExportsScreen };
