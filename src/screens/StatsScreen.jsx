import React, { useState, useMemo, useEffect } from "react";
import { Percent, Receipt, RotateCcw, TrendingUp, Euro, Download, BarChart2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { Btn, Input, Badge, SC } from "../ui.jsx";
import { useApp } from "../context.jsx";

function StatsScreen(){
  const{tickets,products,avoirs,bestSellers:allBestSellers,salesBySeller,salesByVariant,caEvolution,salesByCollection,exportCSVReport,perm,commissions,salesGoals,setSellerGoal}=useApp();
  const[tab,setTab]=useState("ca");
  const[dateFrom,setDateFrom]=useState("");const[dateTo,setDateTo]=useState("");const[catFilter,setCatFilter]=useState("");
  const[apiSummary,setApiSummary]=useState(null);const[apiBySeller,setApiBySeller]=useState(null);const[apiByDay,setApiByDay]=useState(null);const[apiBestSellers,setApiBestSellers]=useState(null);
  useEffect(()=>{
    API.sales.stats().then(d=>setApiSummary(d)).catch(()=>{});
    API.sales.bestSellers().then(d=>setApiBestSellers(Array.isArray(d)?d:[])).catch(()=>{});
    API.sales.bySeller().then(d=>setApiBySeller(Array.isArray(d)?d:[])).catch(()=>{});
    API.sales.byDay().then(d=>setApiByDay(Array.isArray(d)?d:[])).catch(()=>{});
  },[]);
  const setPreset=(p)=>{const now=new Date();const fmt=d=>d.toISOString().split("T")[0];
    if(p==="today"){setDateFrom(fmt(now));setDateTo(fmt(now));}
    else if(p==="week"){const d=new Date(now);d.setDate(d.getDate()-d.getDay()+1);setDateFrom(fmt(d));setDateTo(fmt(now));}
    else if(p==="month"){setDateFrom(fmt(new Date(now.getFullYear(),now.getMonth(),1)));setDateTo(fmt(now));}
    else if(p==="lastmonth"){setDateFrom(fmt(new Date(now.getFullYear(),now.getMonth()-1,1)));setDateTo(fmt(new Date(now.getFullYear(),now.getMonth(),0)));}
    else if(p==="year"){setDateFrom(fmt(new Date(now.getFullYear(),0,1)));setDateTo(fmt(now));}
    else{setDateFrom("");setDateTo("");}};
  const fTickets=useMemo(()=>{return tickets.filter(t=>{const d=(t.date||t.createdAt||t.created_at||"").split("T")[0];
    if(dateFrom&&d<dateFrom)return false;if(dateTo&&d>dateTo)return false;
    if(catFilter){const hasItem=(t.items||[]).some(i=>(i.product?.category||"")===catFilter);if(!hasItem)return false;}return true;});},[tickets,dateFrom,dateTo,catFilter]);
  const prevTickets=useMemo(()=>{if(!dateFrom||!dateTo)return[];const from=new Date(dateFrom);const to=new Date(dateTo);
    const span=to-from;const pFrom=new Date(from-span-86400000);const pTo=new Date(from-86400000);
    const fmt=d=>d.toISOString().split("T")[0];
    return tickets.filter(t=>{const d=(t.date||t.createdAt||t.created_at||"").split("T")[0];return d>=fmt(pFrom)&&d<=fmt(pTo);});},[tickets,dateFrom,dateTo]);
  const stats=useMemo(()=>{const t=fTickets.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0);const h=fTickets.reduce((s,t)=>s+(t.totalHT||parseFloat(t.total_ht)||0),0);
    const m=fTickets.reduce((s,t)=>s+(parseFloat(t.margin)||0),0);return{tTTC:t,tHT:h,margin:m,avg:fTickets.length?t/fTickets.length:0,count:fTickets.length};},[fTickets]);
  const prevStats=useMemo(()=>{const t=prevTickets.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0);return{tTTC:t,count:prevTickets.length};},[prevTickets]);
  const pctChange=(cur,prev)=>{if(!prev)return null;const pct=((cur-prev)/prev*100);return pct;};
  const PctBadge=({cur,prev})=>{const p=pctChange(cur,prev);if(p===null||!dateFrom)return null;
    return<Badge color={p>=0?"#059669":C.danger}>{p>=0?"+":""}{p.toFixed(1)}%</Badge>;};
  // Lookup maps: product_id→{sku,name}, variant_id→{colorCode}
  const prodMap=useMemo(()=>{const m={};products.forEach(p=>{m[p.id]={sku:p.sku,name:p.name};(p.variants||[]).forEach(v=>{m[`v_${v.id}`]={colorCode:v.colorCode||"",color:v.color,size:v.size};});});return m;},[products]);
  const enrichItem=(i)=>{
    const pid=i.product_id||i.product?.id;const vid=i.variant_id||i.variant?.id;
    const pm=pid?prodMap[pid]:null;const vm=vid?prodMap[`v_${vid}`]:null;
    return{sku:i.product?.sku||pm?.sku||"",name:i.product?.name||i.product_name||pm?.name||"?",
      colorCode:i.variant?.colorCode||vm?.colorCode||"",color:i.variant?.color||i.variant_color||vm?.color||"?",
      size:i.variant?.size||i.variant_size||vm?.size||"?"};
  };
  const fBestSellers=useMemo(()=>{const m={};fTickets.forEach(t=>(t.items||[]).forEach(i=>{
    const e=enrichItem(i);const k=e.sku||e.name;
    if(!m[k])m[k]={name:e.name,sku:e.sku,qty:0,revenue:0,margin:0,colors:new Set()};
    m[k].qty+=i.quantity;m[k].revenue+=(i.lineTTC||i.line_ttc||0);m[k].margin+=((i.lineHT||i.line_ht||0)-(i.product?.costPrice||i.cost_price||0)*i.quantity);
    if(e.colorCode)m[k].colors.add(e.colorCode);}));
    return Object.values(m).map(p=>({...p,colors:[...p.colors]})).sort((a,b)=>b.qty-a.qty);},[fTickets,prodMap]);
  const fCommissions=useMemo(()=>{const m={};fTickets.forEach(t=>{
    const n=t.userName||t.user_name||"?";if(!m[n])m[n]={name:n,count:0,revenue:0,margin:0};
    m[n].count++;m[n].revenue+=(t.totalTTC||parseFloat(t.total_ttc)||0);m[n].margin+=(parseFloat(t.margin)||0);});
    return Object.values(m).sort((a,b)=>b.revenue-a.revenue).map(s=>({...s,commission:s.margin*0.05,goal:salesGoals[s.name]||0,goalProgress:salesGoals[s.name]?(s.revenue/salesGoals[s.name]*100):0}));},[fTickets,salesGoals]);
  const fByVariant=useMemo(()=>{const bySize={},byColor={};fTickets.forEach(t=>(t.items||[]).forEach(i=>{
    const e=enrichItem(i);
    bySize[e.size]=(bySize[e.size]||0)+i.quantity;
    const colorLabel=e.colorCode?`${e.color} (${e.colorCode})`:e.color;
    byColor[colorLabel]=(byColor[colorLabel]||0)+i.quantity;}));
    return{bySize:Object.entries(bySize).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({name:k,qty:v})),
      byColor:Object.entries(byColor).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({name:k,qty:v}))};
  },[fTickets]);
  const fByCollection=useMemo(()=>{const m={};fTickets.forEach(t=>(t.items||[]).forEach(i=>{
    const col=i.product?.collection||"Sans collection";if(!m[col])m[col]={name:col,qty:0,revenue:0,margin:0};
    m[col].qty+=i.quantity;m[col].revenue+=(i.lineTTC||i.line_ttc||0);m[col].margin+=((i.lineHT||i.line_ht||0)-(i.product?.costPrice||i.cost_price||0)*i.quantity);}));
    return Object.values(m).sort((a,b)=>b.revenue-a.revenue);},[fTickets]);
  const fCAEvol=useMemo(()=>{const m={};fTickets.forEach(t=>{
    const d=new Date(t.date||t.createdAt||t.created_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"});
    m[d]=(m[d]||0)+(t.totalTTC||parseFloat(t.total_ttc)||0);});
    return Object.entries(m).reverse().map(([d,v])=>({date:d,ca:Math.round(v*100)/100}));},[fTickets]);
  const pieData=[...new Set(fTickets.map(t=>t.paymentMethod||t.payment_method))].map(m=>({name:({cash:"Espèces",card:"CB",amex:"Amex",giftcard:"Cadeau",MIXTE:"Mixte",avoir:"Avoir"})[m]||m,
    value:Math.round(fTickets.filter(t=>(t.paymentMethod||t.payment_method)===m).reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0)*100)/100}));
  const pieColors=[C.info,C.primary,C.accent,C.fiscal,C.warn];
  const byHour=useMemo(()=>{const h=Array(24).fill(0);fTickets.forEach(t=>{const hr=new Date(t.date||t.createdAt||t.created_at).getHours();
    h[hr]+=(t.totalTTC||parseFloat(t.total_ttc)||0);});return h.map((v,i)=>({hour:`${i}h`,ca:Math.round(v*100)/100})).filter(x=>x.ca>0);},[fTickets]);
  const byDow=useMemo(()=>{const days=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];const d=Array(7).fill(0);
    fTickets.forEach(t=>{const dow=new Date(t.date||t.createdAt||t.created_at).getDay();d[dow]+=(t.totalTTC||parseFloat(t.total_ttc)||0);});
    return d.map((v,i)=>({day:days[i],ca:Math.round(v*100)/100}));},[fTickets]);
  const allCats=[...new Set(products.flatMap(p=>[p.category]).filter(Boolean))];
  return(<div style={{height:"100%",overflowY:"auto",padding:"var(--pad,16px)",background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <h2 style={{fontSize:20,fontWeight:800,margin:0}}>Statistiques</h2>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:12,fontWeight:600,color:C.textMuted,fontVariantNumeric:"tabular-nums"}}>{new Date().toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})} {new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span>
        <Btn variant="outline" onClick={()=>exportCSVReport(fBestSellers,"best-sellers.csv")} style={{fontSize:11}}><Download size={12}/> Export CSV</Btn></div></div>
    {/* Filters */}
    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
      <span style={{fontSize:10,fontWeight:600,color:C.textMuted}}>Période:</span>
      {[{id:"all",l:"Tout"},{id:"today",l:"Aujourd'hui"},{id:"week",l:"Semaine"},{id:"month",l:"Ce mois"},{id:"lastmonth",l:"Mois dernier"},{id:"year",l:"Année"}].map(p=>(
        <button key={p.id} onClick={()=>setPreset(p.id)} style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",
          fontSize:10,fontWeight:600,cursor:"pointer",color:C.text}}>{p.l}</button>))}
      <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:120,height:28,fontSize:10,padding:"2px 6px"}}/>
      <span style={{fontSize:10,color:C.textMuted}}>au</span>
      <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:120,height:28,fontSize:10,padding:"2px 6px"}}/>
      <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,fontFamily:"inherit"}}>
        <option value="">Toutes catégories</option>{allCats.map(c=>(<option key={c} value={c}>{c}</option>))}</select></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
      <div><SC icon={Euro} label="CA TTC" value={`${stats.tTTC.toFixed(0)}€`} color={C.primary} sub={<PctBadge cur={stats.tTTC} prev={prevStats.tTTC}/>}/></div>
      <div><SC icon={Receipt} label="Tickets" value={stats.count} color={C.info} sub={<PctBadge cur={stats.count} prev={prevStats.count}/>}/></div>
      <SC icon={TrendingUp} label="Panier moy." value={`${stats.avg.toFixed(1)}€`} color={C.accent}/>
      {perm().canViewMargin&&<SC icon={BarChart2} label="Marge" value={`${stats.margin.toFixed(0)}€`} color="#059669"/>}
      <SC icon={BarChart2} label="Marge %" value={stats.tHT>0?`${(stats.margin/stats.tHT*100).toFixed(1)}%`:"—"} color="#059669"/></div>

    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[{id:"ca",l:"Évolution CA"},{id:"compare",l:"Comparaison"},{id:"hour",l:"CA par heure"},{id:"dow",l:"CA par jour"},{id:"best",l:"Best-sellers"},{id:"variantDetail",l:"Détail variantes"},{id:"seller",l:"Par vendeur"},{id:"variant",l:"Tailles/Couleurs"},{id:"collection",l:"Collections"},{id:"customers",l:"Clients"},{id:"returns",l:"Retours"},{id:"pay",l:"Paiements"},{id:"discounts",l:"Remises"}].map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${tab===t.id?C.primary:C.border}`,
          background:tab===t.id?C.primary:"transparent",color:tab===t.id?"#fff":C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>{t.l}</button>))}</div>

    {tab==="ca"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <ResponsiveContainer width="100%" height={280}><LineChart data={(!dateFrom&&!dateTo&&apiByDay&&apiByDay.length)?apiByDay.map(d=>({date:new Date(d.day||d.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"}),ca:parseFloat(d.total||d.ca)||0})).reverse():fCAEvol}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="date" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
        <Tooltip formatter={v=>`${v.toFixed(2)}€`}/><Line type="monotone" dataKey="ca" stroke={C.primary} strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer></div>}

    {tab==="hour"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>CA par heure</h3>
      <ResponsiveContainer width="100%" height={280}><BarChart data={byHour}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="hour" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
        <Tooltip formatter={v=>`${v.toFixed(2)}€`}/><Bar dataKey="ca" fill={C.primary} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>}

    {tab==="dow"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>CA par jour de la semaine</h3>
      <ResponsiveContainer width="100%" height={280}><BarChart data={byDow}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="day" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
        <Tooltip formatter={v=>`${v.toFixed(2)}€`}/><Bar dataKey="ca" fill={C.accent} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>}

    {tab==="best"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
          {["#","Produit","Réf","Codes couleur","Qté","CA TTC",perm().canViewMargin?"Marge":""].filter(Boolean).map(h=>(
            <th key={h} style={{padding:8,textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,whiteSpace:"nowrap"}}>{h}</th>))}</tr></thead>
        <tbody>{fBestSellers.slice(0,20).map((p,i)=>(<tr key={p.sku} style={{borderBottom:`1px solid ${C.border}`}}>
          <td style={{padding:8,fontWeight:700,color:i<3?C.primary:C.text}}>{i+1}</td>
          <td style={{padding:8,fontWeight:600}}>{p.name}</td>
          <td style={{padding:8,color:C.textMuted,fontFamily:"monospace",fontSize:10}}>{p.sku}</td>
          <td style={{padding:8}}>{p.colors.length>0?<div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{p.colors.map(c=>(<span key={c} style={{fontSize:8,fontFamily:"monospace",background:C.accentLight,color:C.accent,padding:"1px 5px",borderRadius:4,fontWeight:600}}>{c}</span>))}</div>:<span style={{color:C.textLight,fontSize:9}}>—</span>}</td>
          <td style={{padding:8,fontWeight:700}}>{p.qty}</td>
          <td style={{padding:8,fontWeight:700,color:C.primary}}>{p.revenue.toFixed(2)}€</td>
          {perm().canViewMargin&&<td style={{padding:8,color:"#059669",fontWeight:600}}>{p.margin.toFixed(2)}€</td>}
        </tr>))}</tbody></table></div>}

    {tab==="seller"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
          {["Vendeur","Nb ventes","Nb pièces","Panier moyen","Art./vente",perm().canViewMargin?"Marge":"","CA TTC",perm().canViewMargin?"Commission":"","Objectif","Progression"].filter(Boolean).map(h=>(
            <th key={h} style={{padding:8,textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
        <tbody>{fCommissions.map(s=>(<tr key={s.name} style={{borderBottom:`1px solid ${C.border}`}}>
          <td style={{padding:8,fontWeight:600}}>{s.name}</td>
          <td style={{padding:8}}>{s.count}</td>
          <td style={{padding:8,fontWeight:600}}>{s.totalItems||0}</td>
          <td style={{padding:8,fontWeight:700,color:C.info}}>{(s.avgBasket||0).toFixed(2)}€</td>
          <td style={{padding:8}}>{(s.avgItems||0).toFixed(1)}</td>
          {perm().canViewMargin&&<td style={{padding:8,color:"#059669"}}>{s.margin.toFixed(2)}€</td>}
          <td style={{padding:8,fontWeight:700,color:C.primary}}>{s.revenue.toFixed(2)}€</td>
          {perm().canViewMargin&&<td style={{padding:8,color:C.accent,fontWeight:600}}>{s.commission.toFixed(2)}€</td>}
          <td style={{padding:8}}><input type="number" value={s.goal||""} onChange={e=>setSellerGoal(s.name,parseFloat(e.target.value)||0)}
            style={{width:70,padding:"2px 6px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}} placeholder="€"/></td>
          <td style={{padding:8}}>{s.goal>0?<div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{flex:1,height:6,background:C.surfaceAlt,borderRadius:3,overflow:"hidden"}}>
              <div style={{width:`${Math.min(100,s.goalProgress)}%`,height:"100%",background:s.goalProgress>=100?"#059669":C.primary,borderRadius:3}}/></div>
            <span style={{fontSize:10,fontWeight:600,color:s.goalProgress>=100?"#059669":C.textMuted}}>{s.goalProgress.toFixed(0)}%</span></div>:"—"}</td>
        </tr>))}</tbody></table></div>}

    {tab==="variant"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Par taille</h3>
        <ResponsiveContainer width="100%" height={200}><BarChart data={fByVariant.bySize}>
          <XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/>
          <Bar dataKey="qty" fill={C.primary} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Par couleur</h3>
        <ResponsiveContainer width="100%" height={200}><BarChart data={fByVariant.byColor}>
          <XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/>
          <Bar dataKey="qty" fill={C.accent} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>}

    {tab==="collection"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Performance par collection</h3>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
          {["Collection","Qté vendue","CA TTC","Marge"].map(h=>(<th key={h} style={{padding:8,textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
        <tbody>{fByCollection.map(s=>(<tr key={s.name} style={{borderBottom:`1px solid ${C.border}`}}>
          <td style={{padding:8,fontWeight:600}}><Badge color={C.info}>{s.name}</Badge></td>
          <td style={{padding:8}}>{s.qty}</td>
          <td style={{padding:8,fontWeight:700,color:C.primary}}>{s.revenue.toFixed(2)}€</td>
          <td style={{padding:8,color:"#059669"}}>{s.margin.toFixed(2)}€</td></tr>))}</tbody></table></div>}

    {tab==="pay"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
        {pieData.map((d,i)=><Cell key={i} fill={pieColors[i%pieColors.length]}/>)}</Pie><Tooltip formatter={v=>`${v.toFixed(2)}€`}/><Legend/></PieChart></ResponsiveContainer></div>}

    {/* Comparaison de périodes */}
    {tab==="compare"&&(()=>{const pctCA=pctChange(stats.tTTC,prevStats.tTTC);const pctCount=pctChange(stats.count,prevStats.count);
      const prevAvg=prevStats.count?prevStats.tTTC/prevStats.count:0;const pctAvg=pctChange(stats.avg,prevAvg);
      return(<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Comparaison période actuelle vs précédente</h3>
        {!dateFrom?<div style={{padding:20,textAlign:"center",color:C.textMuted,fontSize:12}}>Sélectionnez une période ci-dessus pour activer la comparaison</div>
        :<div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
            {[{l:"CA TTC",cur:stats.tTTC,prev:prevStats.tTTC,fmt:v=>`${v.toFixed(0)}€`},{l:"Nb tickets",cur:stats.count,prev:prevStats.count,fmt:v=>v},
              {l:"Panier moyen",cur:stats.avg,prev:prevAvg,fmt:v=>`${v.toFixed(1)}€`}].map(x=>{const p=pctChange(x.cur,x.prev);return(
              <div key={x.l} style={{padding:14,borderRadius:12,background:C.surfaceAlt,textAlign:"center"}}>
                <div style={{fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4}}>{x.l}</div>
                <div style={{fontSize:20,fontWeight:800,color:C.primary,marginBottom:2}}>{x.fmt(x.cur)}</div>
                <div style={{fontSize:11,color:C.textMuted}}>vs {x.fmt(x.prev)}</div>
                {p!==null&&<div style={{fontSize:13,fontWeight:700,color:p>=0?"#059669":C.danger,marginTop:4}}>{p>=0?"▲":"▼"} {Math.abs(p).toFixed(1)}%</div>}
              </div>);})}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><h4 style={{fontSize:12,fontWeight:700,marginBottom:8}}>Top produits — Période actuelle</h4>
              {fBestSellers.slice(0,5).map((p,i)=>(<div key={p.sku} style={{display:"flex",justifyContent:"space-between",padding:4,fontSize:11,borderBottom:`1px solid ${C.border}`}}>
                <span>{i+1}. {p.name}</span><span style={{fontWeight:700}}>{p.qty} vendus</span></div>))}</div>
            <div><h4 style={{fontSize:12,fontWeight:700,marginBottom:8}}>Répartition paiements</h4>
              {pieData.map((d,i)=>(<div key={d.name} style={{display:"flex",justifyContent:"space-between",padding:4,fontSize:11,borderBottom:`1px solid ${C.border}`}}>
                <span style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:5,background:pieColors[i%pieColors.length]}}/>{d.name}</span>
                <span style={{fontWeight:700}}>{d.value.toFixed(2)}€</span></div>))}</div></div>
        </div>}</div>);})()}

    {/* Détail variantes vendues */}
    {tab==="variantDetail"&&(()=>{const byProd={};fTickets.forEach(t=>(t.items||[]).forEach(i=>{
      const e=enrichItem(i);
      const pk=e.sku||e.name;if(!byProd[pk])byProd[pk]={name:e.name,sku:e.sku,variants:{}};const vk=`${e.color}/${e.size}`;
      if(!byProd[pk].variants[vk])byProd[pk].variants[vk]={color:e.color,colorCode:e.colorCode,size:e.size,qty:0,revenue:0};
      byProd[pk].variants[vk].qty+=i.quantity;byProd[pk].variants[vk].revenue+=(i.lineTTC||i.line_ttc||0);}));
      const prodList=Object.values(byProd).sort((a,b)=>{const aq=Object.values(a.variants).reduce((s,v)=>s+v.qty,0);
        const bq=Object.values(b.variants).reduce((s,v)=>s+v.qty,0);return bq-aq;});
      const exportVariantCSV=()=>{
        const headers=["Produit","Reference","Code couleur","Libelle coloris","Taille","Quantite vendue","CA TTC"];
        const rows=[];
        prodList.forEach(p=>{Object.values(p.variants).sort((a,b)=>b.qty-a.qty).forEach(v=>{
          rows.push([p.name,p.sku,v.colorCode,v.color,v.size,v.qty,v.revenue.toFixed(2)]);});});
        const csv="﻿"+[headers.join(";"),...rows.map(r=>r.map(c=>`"${String(c==null?"":c).replace(/"/g,'""')}"`).join(";"))].join("\r\n");
        const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);
        const a=document.createElement("a");a.href=url;
        const period=dateFrom&&dateTo?`_${dateFrom}_${dateTo}`:dateFrom?`_depuis_${dateFrom}`:"_tout";
        a.download=`variantes_vendues${period}.csv`;a.click();URL.revokeObjectURL(url);
      };
      return(<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <h3 style={{fontSize:14,fontWeight:700,margin:0}}>Détail des variantes vendues</h3>
          <Btn variant="outline" onClick={exportVariantCSV} style={{fontSize:11,gap:4}}><Download size={12}/> Export Excel</Btn></div>
        {prodList.slice(0,15).map(p=>{const vars=Object.values(p.variants).sort((a,b)=>b.qty-a.qty);
          const totalQty=vars.reduce((s,v)=>s+v.qty,0);
          return(<div key={p.sku||p.name} style={{marginBottom:14,padding:12,borderRadius:10,background:C.surfaceAlt}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div><span style={{fontSize:13,fontWeight:700}}>{p.name}</span>
                {p.sku&&<span style={{fontSize:10,fontFamily:"monospace",color:C.textMuted,marginLeft:6}}>Réf: {p.sku}</span>}</div>
              <Badge color={C.primary}>{totalQty} vendus</Badge></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:4}}>
              {vars.map(v=>{const pct=totalQty?(v.qty/totalQty*100):0;return(
                <div key={`${v.color}/${v.size}`} style={{padding:6,borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,fontSize:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontWeight:600}}>{v.color}</span>
                    {v.colorCode&&<span style={{fontSize:8,fontFamily:"monospace",color:C.accent,background:C.accentLight,padding:"0 4px",borderRadius:3}}>{v.colorCode}</span>}
                    <span style={{color:C.textMuted}}>— {v.size}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                    <span style={{fontWeight:700,color:C.primary}}>{v.qty} ({pct.toFixed(0)}%)</span>
                    <span style={{color:C.textMuted}}>{v.revenue.toFixed(0)}€</span></div>
                  <div style={{height:3,background:C.surfaceAlt,borderRadius:2,marginTop:3}}>
                    <div style={{width:`${pct}%`,height:"100%",background:C.primary,borderRadius:2}}/></div>
                </div>);})}
            </div></div>);})}
      </div>);})()}

    {/* Clients analytics */}
    {tab==="customers"&&(()=>{const identified=fTickets.filter(t=>t.customerId||t.customer_id);const anonymous=fTickets.filter(t=>!t.customerId&&!t.customer_id);
      const identCA=identified.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0);
      const anonCA=anonymous.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0);
      const custMap={};identified.forEach(t=>{const cid=t.customerId||t.customer_id;if(!custMap[cid])custMap[cid]={name:t.customerName||"Client",count:0,total:0};
        custMap[cid].count++;custMap[cid].total+=(t.totalTTC||parseFloat(t.total_ttc)||0);});
      const topCusts=Object.values(custMap).sort((a,b)=>b.total-a.total);
      const newCustsThisPeriod=fTickets.filter(t=>{const cn=t.customerName||t.customer_name;if(!cn)return false;
        const firstTk=tickets.find(tk=>(tk.customerName||tk.customer_name)===cn);return firstTk&&firstTk.ticketNumber===t.ticketNumber;});
      return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Répartition clients</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <div style={{padding:12,borderRadius:10,background:C.primaryLight,textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:C.primary}}>{identified.length}</div>
              <div style={{fontSize:10,color:C.primaryDark,fontWeight:600}}>Ventes identifiées</div>
              <div style={{fontSize:12,fontWeight:700,color:C.primary}}>{identCA.toFixed(0)}€</div></div>
            <div style={{padding:12,borderRadius:10,background:C.surfaceAlt,textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:C.textMuted}}>{anonymous.length}</div>
              <div style={{fontSize:10,color:C.textMuted,fontWeight:600}}>Ventes anonymes</div>
              <div style={{fontSize:12,fontWeight:700,color:C.textMuted}}>{anonCA.toFixed(0)}€</div></div></div>
          <div style={{fontSize:11,color:C.textMuted}}>Taux d'identification: <strong style={{color:C.primary}}>{fTickets.length?(identified.length/fTickets.length*100).toFixed(1):0}%</strong></div>
          {identified.length>0&&<div style={{fontSize:11,color:C.textMuted,marginTop:4}}>Panier moyen identifié: <strong>{(identCA/identified.length).toFixed(1)}€</strong> vs anonyme: <strong>{anonymous.length?(anonCA/anonymous.length).toFixed(1):0}€</strong></div>}
        </div>
        <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Top clients</h3>
          {topCusts.slice(0,8).map((c,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:6,borderBottom:`1px solid ${C.border}`,fontSize:11}}>
            <span style={{fontWeight:i<3?700:400}}>{i+1}. {c.name}</span>
            <span><Badge color={C.primary}>{c.count} achats</Badge> <strong style={{color:C.primary}}>{c.total.toFixed(0)}€</strong></span></div>))}</div>
      </div>);})()}

    {/* Retours stats */}
    {tab==="returns"&&(()=>{
      // Filtrer les avoirs par plage de dates
      const returnData=avoirs.filter(a=>{const d=(a.date||a.createdAt||"").slice(0,10);return(!dateFrom||d>=dateFrom)&&(!dateTo||d<=dateTo);});
      const totalReturns=returnData.length;const totalReturnValue=returnData.reduce((s,a)=>s+(a.totalTTC||0),0);
      const returnRate=fTickets.length?(totalReturns/fTickets.length*100):0;
      const byReason={};returnData.forEach(a=>{const r=a.reason||"Autre";byReason[r]=(byReason[r]||0)+1;});
      const reasonData=Object.entries(byReason).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({name:k,value:v}));
      return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Statistiques retours</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            <SC icon={RotateCcw} label="Retours" value={totalReturns} color={C.fiscal}/>
            <SC icon={Euro} label="Montant" value={`${totalReturnValue.toFixed(0)}€`} color={C.danger}/>
            <SC icon={TrendingUp} label="Taux retour" value={`${returnRate.toFixed(1)}%`} color={returnRate>5?C.danger:C.primary}/></div></div>
        <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Motifs de retour</h3>
          {reasonData.length===0&&<div style={{color:C.textLight,fontSize:11}}>Aucun retour</div>}
          {reasonData.map((r,i)=>(<div key={r.name} style={{display:"flex",justifyContent:"space-between",padding:6,borderBottom:`1px solid ${C.border}`,fontSize:11}}>
            <span>{r.name}</span><Badge color={C.fiscal}>{r.value}</Badge></div>))}</div>
      </div>);})()}

    {/* Discounts analysis */}
    {tab==="discounts"&&(()=>{const discounted=fTickets.filter(t=>t.globalDiscount>0||(t.items||[]).some(i=>i.discount>0));
      const totalDisc=fTickets.reduce((s,t)=>{const gd=t.globalDiscount||0;const id=(t.items||[]).reduce((si,i)=>si+(i.product?.price||0)*i.quantity*(i.discount||0)/100,0);return s+gd+id;},0);
      return(<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Analyse des remises</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
          <SC icon={Percent} label="Ventes avec remise" value={discounted.length} color={C.accent}/>
          <SC icon={Euro} label="Total remisé" value={`${totalDisc.toFixed(0)}€`} color={C.warn}/>
          <SC icon={TrendingUp} label="% ventes remisées" value={`${fTickets.length?(discounted.length/fTickets.length*100).toFixed(1):0}%`} color={C.info}/></div>
      </div>);})()}
  </div>);
}

/* ══════════ STOCK MATRIX ══════════ */

export default StatsScreen;
export { StatsScreen };
