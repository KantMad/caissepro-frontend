import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ShoppingCart, Search, Trash2, Percent, CreditCard, Banknote, Gift, Plus, Minus,
  Lock, User as UserIcon, Store, LayoutDashboard, LogOut, Wallet, XCircle,
  BarChart3, Package, Receipt, RotateCcw, Users, TrendingUp, DollarSign,
  Shield, Download, FileText, Settings, CheckCircle2, AlertTriangle, Save,
  Archive, Activity, Database, WifiOff, Pause, Play, Upload, Printer, Bell,
  Heart, Grid, Box, Star, Calendar, Zap, ScanLine, Split,
  Mail, XOctagon, Edit, BarChart2, Check, X, HelpCircle, ChevronDown, Scissors, Monitor, Wifi, Code
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar
} from "recharts";
import Papa from "papaparse";

// ── Size sorting for textile (XS→5XL, then numeric 24→56) ──
const SIZE_ORDER=['XXS','XS','S','M','L','XL','XXL','2XL','3XL','4XL','5XL',
  'TU','UNIQUE','STD',
  '24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39',
  '40','41','42','43','44','45','46','47','48','50','52','54','56','58','60'];
function sizeRank(s){const idx=SIZE_ORDER.indexOf((s||'').toUpperCase().trim());return idx>=0?idx:999;}
function sortSizes(a,b){return sizeRank(a)-sizeRank(b);}
function sortVariantsBySize(variants){return[...variants].sort((a,b)=>sizeRank(a.size)-sizeRank(b.size));}
import * as API from "./api.js";
import printer, { PAPER_48, PAPER_32 } from "./printer.js";
import { CO, DEFAULT_TVA_RATES, PERMS, initProducts, initUsers, initCustomers, LOYALTY_TIERS, initPromos, categories, C, CAT_COLORS } from "./constants.jsx";
import { escapeHtml, hashPin, verifyPin, sha256, getPriceHT, getPriceTTC, catIcon, norm, variantKey, getSizeRank, printBarcodeLabels, getVariantOrderMap, saveVariantOrderMap, setProductVariantOrder, DEFAULT_CAT_ICONS, DEFAULT_SIZE_RANKING, getSizeRanking, saveSizeRanking } from "./utils.jsx";
import { Modal, Btn, Input, Badge, SC, Numpad, ConfirmDialog } from "./ui.jsx";
import { useApp } from "./context.jsx";
import hardwareManager from "./hardware.js";

function LoginScreen(){
  const{login,setMode:setIM,users,setUsers}=useApp();const[su,setSu]=useState("");const[pw,setPw]=useState("");const[err,setErr]=useState("");const[m,setM]=useState("cashier");const[loading,setLoading]=useState(false);
  // Fetch user profiles from API on mount (public endpoint, no auth needed) — always shows current users
  useEffect(()=>{
    API.auth.profiles().then(profiles=>{
      if(profiles?.length){const merged=profiles.map(u=>({id:u.id,name:u.name,role:u.role,pin:"****",apiSynced:true}));setUsers(merged);}
    }).catch(()=>{});
  },[]);
  const allUsers=users&&users.length?users:initUsers;
  const go=async()=>{if(!su){setErr("Selectionnez un profil");return;}const u=allUsers.find(u=>u.id===su);if(!u){setErr("Profil introuvable");return;}
    setLoading(true);setErr("");try{const res=await login(u.name,pw||u.pin);if(res?.ok||res===true)setIM(m);else setErr("Code incorrect ou serveur indisponible");}catch(e){setErr("Erreur de connexion: "+e.message);}finally{setLoading(false);}};
  return(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:420,background:C.surface,borderRadius:20,padding:40,
      boxShadow:"0 20px 60px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)",animation:"fadeIn 0.4s ease"}}>
      <div style={{marginBottom:32}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{width:44,height:44,borderRadius:12,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Store size={22} color="#fff"/></div>
          <div><h1 style={{fontSize:22,fontWeight:700,margin:0,letterSpacing:"-0.5px",color:C.text}}>CaissePro</h1>
            <p style={{color:C.textMuted,fontSize:11,margin:0}}>v{CO.ver} — NF525</p>
            <p style={{color:C.textLight,fontSize:9,margin:0,fontFamily:"monospace"}}>{typeof __BUILD_TIME__!=='undefined'?__BUILD_TIME__:''}</p></div></div>
        <p style={{color:C.textMuted,fontSize:13,lineHeight:1.5}}>Selectionnez votre profil pour commencer</p></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
        {[{id:"cashier",i:Store,l:"Caisse",d:"Point de vente"},{id:"dashboard",i:LayoutDashboard,l:"Dashboard",d:"Gestion"}].map(x=>(
          <button key={x.id} onClick={()=>setM(x.id)} style={{padding:"14px 12px",borderRadius:12,border:`1.5px solid ${m===x.id?C.primary:C.border}`,
            background:m===x.id?C.primaryLight:C.surface,cursor:"pointer",transition:"all 0.2s cubic-bezier(0.16,1,0.3,1)"}}>
            <x.i size={20} color={m===x.id?C.primary:C.textLight} style={{margin:"0 auto 8px",display:"block"}}/>
            <div style={{fontSize:12,fontWeight:600,color:m===x.id?C.primary:C.text}}>{x.l}</div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{x.d}</div></button>))}</div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
        {allUsers.map(u=>(<button key={u.id} onClick={()=>setSu(u.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,
          border:`1.5px solid ${su===u.id?C.primary:C.border}`,background:su===u.id?C.primaryLight:C.surface,cursor:"pointer",transition:"all 0.2s cubic-bezier(0.16,1,0.3,1)"}}>
          <div style={{width:36,height:36,borderRadius:10,background:su===u.id?C.primary:C.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
            <UserIcon size={16} color={su===u.id?"#fff":C.textMuted}/></div>
          <div style={{textAlign:"left",flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.text}}>{u.name}</div><div style={{fontSize:10,color:C.textMuted}}>{u.role==="admin"?"Administrateur":"Caissier(e)"}</div></div>
          {su===u.id&&<CheckCircle2 size={16} color={C.primary}/>}</button>))}</div>
      <div style={{position:"relative",marginBottom:8}}>
        <Input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&go()} placeholder="Code PIN" style={{height:44,fontSize:14,paddingRight:36}}/>
        <Lock size={14} color={C.textLight} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)"}}/></div>
      <p style={{fontSize:10,color:C.textLight,marginBottom:14,textAlign:"center"}}>Saisissez votre code personnel</p>
      {err&&<div style={{padding:"10px 12px",background:C.dangerLight,borderRadius:10,marginBottom:12,display:"flex",alignItems:"center",gap:8,border:`1px solid ${C.danger}15`}}>
        <AlertTriangle size={14} color={C.danger}/><p style={{fontSize:12,color:C.danger,margin:0,fontWeight:500}}>{err}</p></div>}
      <Btn onClick={go} disabled={loading||!su} style={{width:"100%",height:46,fontSize:14,borderRadius:12}}>
        {loading?<><span style={{display:"inline-block",width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/> Connexion...</>:"Connexion"}</Btn>
    </div></div>);
}

function CashRegControl({onSkip,onDone}){
  const{currentUser,openReg}=useApp();const[a,setA]=useState("");const[denomMode,setDenomMode]=useState(false);
  const bills=[{v:500,l:"500€"},{v:200,l:"200€"},{v:100,l:"100€"},{v:50,l:"50€"},{v:20,l:"20€"},{v:10,l:"10€"},{v:5,l:"5€"}];
  const coins=[{v:2,l:"2€"},{v:1,l:"1€"},{v:0.50,l:"0.50€"},{v:0.20,l:"0.20€"},{v:0.10,l:"0.10€"},{v:0.05,l:"0.05€"},{v:0.02,l:"0.02€"},{v:0.01,l:"0.01€"}];
  const[denom,setDenom]=useState(()=>{const d={};bills.concat(coins).forEach(x=>d[x.v]=0);return d;});
  const denomTotal=Object.entries(denom).reduce((s,[v,n])=>s+parseFloat(v)*n,0);
  const quickAmounts=[50,100,150,200,300];
  return(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:denomMode?580:440,background:C.surface,borderRadius:20,padding:36,boxShadow:"0 20px 60px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)",transition:"width 0.3s",maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center"}}><Wallet size={22} color="#fff"/></div>
          <div><h1 style={{fontSize:20,fontWeight:700,margin:0,letterSpacing:"-0.4px"}}>Ouverture de caisse</h1>
            <p style={{color:C.textMuted,fontSize:12,margin:0}}>Bienvenue {currentUser?.name} — {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</p></div></div></div>

      <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:14}}>
        <button onClick={()=>setDenomMode(false)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${!denomMode?C.accent:C.border}`,background:!denomMode?C.accentLight:"transparent",
          cursor:"pointer",fontSize:11,fontWeight:600,color:!denomMode?C.accent:C.textMuted}}>Montant rapide</button>
        <button onClick={()=>setDenomMode(true)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${denomMode?C.accent:C.border}`,background:denomMode?C.accentLight:"transparent",
          cursor:"pointer",fontSize:11,fontWeight:600,color:denomMode?C.accent:C.textMuted}}>Compter les coupures</button></div>

      {!denomMode?<>
        <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.5px"}}>Fond de caisse (€)</label>
        <Input type="number" step="0.01" value={a} onChange={e=>setA(e.target.value)} placeholder="100.00" style={{marginBottom:8,height:48,fontSize:16,fontWeight:700,textAlign:"center"}}/>
        <div style={{display:"flex",gap:6,marginBottom:16,justifyContent:"center"}}>
          {quickAmounts.map(v=>(<button key={v} onClick={()=>setA(String(v))} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${a===String(v)?C.accent:C.border}`,background:a===String(v)?C.accentLight:"transparent",
            cursor:"pointer",fontSize:11,fontWeight:600,color:a===String(v)?C.accent:C.textMuted,transition:"all 0.12s"}}>{v}€</button>))}</div>
      </>:<>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,marginBottom:6}}>BILLETS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {bills.map(b=>(<div key={b.v} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 8px",borderRadius:10,border:`1.5px solid ${denom[b.v]>0?C.accent:C.border}`,background:denom[b.v]>0?C.accentLight+"60":"transparent"}}>
              <span style={{fontSize:10,fontWeight:700,color:C.accent,minWidth:36}}>{b.l}</span>
              <span style={{fontSize:9,color:C.textMuted}}>×</span>
              <input type="number" min="0" value={denom[b.v]||""} onChange={e=>{const n=parseInt(e.target.value)||0;setDenom(d=>({...d,[b.v]:n}));}}
                style={{width:40,padding:"3px 4px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontWeight:700,textAlign:"center",fontFamily:"inherit"}}/>
            </div>))}</div></div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,marginBottom:6}}>PIÈCES</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {coins.map(c=>(<div key={c.v} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 8px",borderRadius:10,border:`1.5px solid ${denom[c.v]>0?C.info:C.border}`,background:denom[c.v]>0?`${C.info}10`:"transparent"}}>
              <span style={{fontSize:10,fontWeight:700,color:C.info,minWidth:36}}>{c.l}</span>
              <span style={{fontSize:9,color:C.textMuted}}>×</span>
              <input type="number" min="0" value={denom[c.v]||""} onChange={e=>{const n=parseInt(e.target.value)||0;setDenom(d=>({...d,[c.v]:n}));}}
                style={{width:40,padding:"3px 4px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontWeight:700,textAlign:"center",fontFamily:"inherit"}}/>
            </div>))}</div></div>
        <div style={{background:C.accentLight,borderRadius:14,padding:14,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${C.accent}22`}}>
          <span style={{fontSize:14,fontWeight:700,color:C.accent}}>Total fond de caisse</span>
          <span style={{fontSize:22,fontWeight:900,color:C.accent}}>{denomTotal.toFixed(2)}€</span></div>
      </>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Btn variant="outline" onClick={onSkip} style={{height:48,borderRadius:12}}><XCircle size={14}/> Passer</Btn>
        <Btn onClick={()=>{const amt=denomMode?denomTotal:parseFloat(a);if(amt){openReg(amt);onDone();}}} disabled={denomMode?denomTotal===0:!a}
          style={{height:48,borderRadius:12,background:C.accent,boxShadow:(denomMode?denomTotal>0:a)?`0 4px 16px ${C.accent}33`:"none"}}><Wallet size={14}/> Ouvrir la caisse</Btn>
      </div></div></div>);
}

/* ══════════ SALES SCREEN ══════════ */
function SalesScreen(){
  const{products,cart,addToCart,addCustomItem,removeFromCart,voidSale,updateQty,updateItemDisc,clearCart,checkout,
    gDisc,gDiscType,setCartGD,promoCode,setPromoCode,calcPromoDiscount,isOnline,findByEAN,offlineMode,
    parked,parkCart,restoreCart,customers,addCustomer,selCust,setSelCust,perm,notify,
    stockAlerts,activePromos,avoirPayment,setAvoirPayment,getLoyaltyTier,tickets,saleNote,setSaleNote,favorites,toggleFavorite,getLastPriceForCustomer,settings,
    printerConnected,thermalPrint,pendingSync,clearPendingSync,users,currentUser,avoirs,consumeAvoir,addAudit,addJET}=useApp();
  const[search,setSearch]=useState("");const[cat,setCat]=useState("Tous");const[vm,setVm]=useState(null);const[selSeller,setSelSeller]=useState(null);const[detaxe,setDetaxe]=useState(false);
  const[dm,setDm]=useState(null);const[dv,setDv]=useState("");const[gm,setGm]=useState(false);const[gv,setGv]=useState("");const[gtp,setGtp]=useState("percentage");
  const[lastTk,setLastTk]=useState(null);const[tkModal,setTkModal]=useState(false);const[busy,setBusy]=useState(false);
  const[payModal,setPayModal]=useState(false);const[cashGiven,setCashGiven]=useState("");
  const[cashNumpadModal,setCashNumpadModal]=useState(false);const[numpadValue,setNumpadValue]=useState("");
  const[custModal,setCustModal]=useState(false);const[parkedModal,setParkedModal]=useState(false);
  const[customModal,setCustomModal]=useState(false);const[customName,setCustomName]=useState("");const[customPrice,setCustomPrice]=useState("");
  const[payMethodModal,setPayMethodModal]=useState(false);const[avoirSelectModal,setAvoirSelectModal]=useState(false);
  const[retoucheModal,setRetoucheModal]=useState(false);const[retForm,setRetForm]=useState({client:"",phone:"",date:new Date().toISOString().split("T")[0],notes:"",items:[{desc:"",price:""}]});
  const[newCustModal,setNewCustModal]=useState(false);const[ncF,setNcF]=useState("");const[ncL,setNcL]=useState("");const[ncE,setNcE]=useState("");const[ncP,setNcP]=useState("");
  const[syncConfirm,setSyncConfirm]=useState(false);
  const[codeInput,setCodeInput]=useState("");
  const[confirmVoid,setConfirmVoid]=useState(false);const[voidReason,setVoidReason]=useState("");
  const[showShortcuts,setShowShortcuts]=useState(false);
  const barcodeBuffer=useRef("");const barcodeTimer=useRef(null);

  // Keyboard shortcuts
  useEffect(()=>{const handler=(e)=>{
    if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT")return;
    if(e.key==="F2"){e.preventDefault();if(cart.length&&!busy)quickPay("card");}
    if(e.key==="F3"){e.preventDefault();if(cart.length&&!busy)quickPay("cash");}
    if(e.key==="F4"){e.preventDefault();if(cart.length)openPay();}
    if(e.key==="F5"){e.preventDefault();parkCart();}
    if(e.key==="F8"){e.preventDefault();if(cart.length)setConfirmVoid(true);}
    if(e.key==="?"&&e.shiftKey){e.preventDefault();setShowShortcuts(s=>!s);}
  };window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);
  },[cart,busy,parkCart]);

  // Barcode scan listener (compatible with USB/Bluetooth barcode scanners)
  useEffect(()=>{const h=(e)=>{if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
    if(e.key==="Enter"&&barcodeBuffer.current.length>=8){const ean=barcodeBuffer.current;barcodeBuffer.current="";
      const f=findByEAN(ean);if(f){addToCart(f.product,f.variant);notify("✅ "+f.product.name+" ajouté ("+ean+")");}
      else{notify("⚠️ Aucun produit pour EAN: "+ean,"warn");}}
    else if(e.key.length===1){if(barcodeBuffer.current.length<50)barcodeBuffer.current+=e.key;clearTimeout(barcodeTimer.current);
      barcodeTimer.current=setTimeout(()=>{barcodeBuffer.current="";},150);}};
    window.addEventListener("keydown",h);return()=>{window.removeEventListener("keydown",h);clearTimeout(barcodeTimer.current);};},[findByEAN,addToCart,notify]);

  const filtered=useMemo(()=>products.filter(p=>{const q=search.toLowerCase();
    const matchSearch=!q||p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)||p.variants.some(v=>v.ean.includes(q)||v.color.toLowerCase().includes(q));
    const matchCat=cat==="Tous"||cat==="Favoris"?true:p.category===cat;
    const matchFav=cat==="Favoris"?favorites.includes(p.id):true;
    return matchSearch&&matchCat&&matchFav;}),[products,search,cat,favorites]);

  const totals=useMemo(()=>{
    const pm=settings.pricingMode||"TTC";
    const sHT=cart.reduce((s,i)=>{const raw=i.discountType==="amount"?i.product.price*i.quantity-((i.discount||0)*i.quantity):i.product.price*i.quantity*(1-i.discount/100);
      return s+(pm==="TTC"?raw/(1+(i.product.taxRate||0.20)):raw);},0);
    let gd=gDiscType==="percentage"?sHT*(gDisc/100):Math.min(gDisc,sHT);
    const{promoDisc,applied}=calcPromoDiscount(cart);
    gd+=promoDisc;gd=Math.min(gd,sHT);
    const tHT=sHT-gd;
    // Per-item TVA
    const tTVA=detaxe?0:cart.reduce((s,i)=>{const raw=i.discountType==="amount"?i.product.price*i.quantity-((i.discount||0)*i.quantity):i.product.price*i.quantity*(1-i.discount/100);
      const lHT=pm==="TTC"?raw/(1+(i.product.taxRate||0.20)):raw;return s+lHT*(i.product.taxRate||0.20);},0)*(tHT/sHT||0);
    const tTTC=tHT+tTVA-avoirPayment;
    return{sHT,gd,promoDisc,applied,tHT,tTVA,tTTC:Math.max(0,tTTC)};
  },[cart,gDisc,gDiscType,calcPromoDiscount,avoirPayment,settings.pricingMode,detaxe]);

  const[payCard,setPayCard]=useState("");const[payCash,setPayCash]=useState("");const[payGC,setPayGC]=useState("");const[payChq,setPayChq]=useState("");const[payAmex,setPayAmex]=useState("");const[cardType,setCardType]=useState("card");
  const openPay=()=>{setPayCard("");setPayCash("");setPayGC("");setPayChq("");setPayAmex("");setCashGiven("");setCardType("card");setPayModal(true);};
  const doSplitPay=async()=>{const payments=[];
    const c=parseFloat(payCard)||0;const ca=parseFloat(payCash)||0;const g=parseFloat(payGC)||0;const chq=parseFloat(payChq)||0;
    if(c>0)payments.push({method:cardType,amount:c});if(ca>0)payments.push({method:"cash",amount:ca});
    if(g>0)payments.push({method:"giftcard",amount:g});if(chq>0)payments.push({method:"cheque",amount:chq});if(avoirPayment>0)payments.push({method:"avoir",amount:avoirPayment});
    if(!payments.length)return;setBusy(true);const t=await checkout(payments,selSeller);setBusy(false);if(t){setLastTk({...t,detaxe});setPayModal(false);setTkModal(true);setSelSeller(null);setDetaxe(false);}};
  const quickPay=async(method)=>{if(!cart.length||busy)return;setBusy(true);
    const payments=[{method,amount:totals.tTTC}];if(avoirPayment>0)payments.push({method:"avoir",amount:avoirPayment});
    const t=await checkout(payments,selSeller);setBusy(false);if(t){setLastTk({...t,detaxe});setTkModal(true);setSelSeller(null);setDetaxe(false);}};
  const change=cashGiven?Math.max(0,parseFloat(cashGiven)-totals.tTTC):0;
  const maxDisc=perm().maxDiscount;
  const custTier=selCust?getLoyaltyTier(selCust.points):null;

  // Email ticket
  const emailTicket=(tk)=>{if(!tk)return;
    const subj=encodeURIComponent(`Ticket ${tk.ticketNumber} — ${settings.name||CO.name}`);
    const body=encodeURIComponent(`Bonjour,\n\nVoici votre ticket N°${tk.ticketNumber}\nTotal: ${(tk.totalTTC||0).toFixed(2)}€\nDate: ${new Date(tk.date||tk.createdAt||"").toLocaleString("fr-FR")}\n\n${settings.name||CO.name}\n${settings.siret||CO.siret}`);
    window.open(`mailto:${selCust?.email||""}?subject=${subj}&body=${body}`);};

  const todayTickets=useMemo(()=>{const today=new Date().toISOString().split("T")[0];
    return tickets.filter(t=>(t.date||t.createdAt||t.created_at||"").startsWith(today));},[tickets]);
  const todayCA=todayTickets.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0);

  return(<div style={{display:"flex",height:"100%",background:C.bg,fontSize:13}}>
    {(offlineMode||!isOnline)&&<div style={{position:"absolute",top:0,left:72,right:0,zIndex:100,
      background:offlineMode?C.warnLight:C.dangerLight,padding:"8px 18px",
      display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:500,color:offlineMode?"#92400E":C.danger,
      borderBottom:`1px solid ${offlineMode?C.warn+"22":C.danger+"22"}`,animation:"slideDown 0.3s ease"}}>
      <WifiOff size={13}/> {offlineMode?"Mode hors-ligne — Donnees locales":"Connexion internet perdue"}
      {offlineMode&&<Badge color="#92400E">Local</Badge>}
      {pendingSync.length>0&&<span onClick={()=>setSyncConfirm(true)}
        style={{cursor:"pointer",marginLeft:"auto"}}><Badge color={C.warn}>{pendingSync.length} synchro(s) en attente</Badge></span>}</div>}

    {/* Products */}
    <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Daily summary bar */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,padding:"10px 16px",
        background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,
        boxShadow:`0 1px 3px ${C.shadow}`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:6,height:6,borderRadius:3,background:C.primary}}/>
          <span style={{fontSize:12,fontWeight:600,color:C.text}}>{new Date().toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</span></div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:12,color:C.textMuted}}>{todayTickets.length} vente{todayTickets.length>1?"s":""}</span>
          <span style={{fontSize:14,fontWeight:700,color:C.primary,letterSpacing:"-0.3px"}}>{todayCA.toFixed(2)}€</span>
          {stockAlerts.length>0&&<Badge color={C.danger}>{stockAlerts.length}</Badge>}
          <span style={{fontSize:10,color:printerConnected?"#059669":C.textLight,display:"flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:6,
            background:printerConnected?"#05966908":C.surfaceAlt}}>
            <Printer size={10}/> {printerConnected?"ESC/POS":"-"}</span>
          <span style={{fontSize:10,color:C.textMuted,cursor:"pointer",display:"flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:6,background:C.surfaceAlt}} onClick={()=>setShowShortcuts(true)}>
            ? Raccourcis</span></div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <div style={{position:"relative",flex:1}}>
          <Search size={15} color={C.textMuted} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}}/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher produit, SKU ou scanner…" style={{paddingLeft:38,height:42,fontSize:13,borderRadius:14}}/></div>
        <Btn variant="outline" onClick={()=>setParkedModal(true)} style={{height:42,padding:"0 14px",position:"relative",borderRadius:14}}>
          <Pause size={15}/>{parked.length>0&&<span style={{position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:9,
            background:C.danger,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 2px 6px rgba(209,69,59,0.4)"}}>{parked.length}</span>}</Btn>
        <Btn variant="outline" onClick={()=>setParkedModal(true)} style={{height:42,padding:"0 14px",borderRadius:14,position:"relative"}} title="Paniers en attente">
          <Play size={15}/>{parked.length>0&&<span style={{position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:9,background:C.danger,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{parked.length}</span>}</Btn>
      </div>
      {activePromos.length>0&&<div style={{background:C.warnLight,borderRadius:10,padding:"6px 12px",marginBottom:8,
        display:"flex",alignItems:"center",gap:8,fontSize:11,border:`1px solid ${C.warn}18`}}>
        <Zap size={13} color={C.warn}/><span style={{fontWeight:600,color:"#92720E"}}>Promos actives:</span>{activePromos.map(p=><Badge key={p.id} color={C.warn}>{p.name}</Badge>)}</div>}
      <div style={{display:"flex",gap:5,marginBottom:10,overflowX:"auto",flexShrink:0,paddingBottom:2}}>
        {categories.map(c=>{const cc=CAT_COLORS[c]||C.primary;return(
          <button key={c} onClick={()=>setCat(c)} style={{padding:"6px 14px",borderRadius:20,border:"none",
            background:cat===c?(c==="Tous"?C.primary:cc):"transparent",
            color:cat===c?"#fff":C.textMuted,fontSize:11,fontWeight:cat===c?700:500,cursor:"pointer",whiteSpace:"nowrap",
            transition:"all 0.15s",boxShadow:cat===c?`0 2px 8px ${cc}30`:"none"}}>{c}</button>);})}
        <button onClick={()=>setCat("Favoris")} style={{padding:"6px 14px",borderRadius:20,border:"none",
          background:cat==="Favoris"?C.accent:"transparent",color:cat==="Favoris"?"#fff":C.textMuted,
          fontSize:11,fontWeight:cat==="Favoris"?700:500,cursor:"pointer",whiteSpace:"nowrap",marginLeft:4,transition:"all 0.15s",
          boxShadow:cat==="Favoris"?`0 2px 8px ${C.accent}30`:"none"}}>
          <Star size={10} style={{verticalAlign:"middle"}}/> Favoris</button></div>
      <div style={{flex:1,overflowY:"auto",paddingRight:4}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"50px 20px",color:C.textLight}}>
          <div style={{width:56,height:56,borderRadius:16,background:C.surfaceAlt,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
            <Package size={26} style={{opacity:0.4}}/></div>
          <div style={{fontSize:14,fontWeight:700,marginBottom:4,color:C.text}}>Aucun produit trouvé</div>
          <div style={{fontSize:12}}>Essayez un autre terme de recherche</div></div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10}}>
        {filtered.map(p=>{const ts=p.variants.reduce((s,v)=>s+v.stock,0);const ha=p.variants.some(v=>v.stock<=(v.stockAlert||5));
          const cc=CAT_COLORS[p.category]||C.primary;
          return(<div key={p.id} onClick={()=>p.variants.length===1?addToCart(p,p.variants[0]):setVm(p)}
          style={{background:C.surface,borderRadius:16,padding:0,cursor:"pointer",border:`1px solid ${C.border}`,transition:"all 0.2s ease",
            animation:"fadeIn 0.25s ease",overflow:"hidden",boxShadow:`0 1px 3px ${C.shadow}`}}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 8px 24px ${C.shadowMd}`;e.currentTarget.style.borderColor=cc+"55";}}
          onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=`0 1px 3px ${C.shadow}`;e.currentTarget.style.borderColor=C.border;}}>
          <div style={{aspectRatio:"1.1",background:`${cc}06`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:32,opacity:0.7,filter:"grayscale(0.2)"}}>{catIcon(p.category,settings.categoryIcons)}</span>
            {ts<=0&&<div style={{position:"absolute",top:6,left:6,zIndex:2}}>
              <Badge color={C.danger}>{ts<0?`Stock ${ts}`:"Rupture"}</Badge></div>}
            {ha&&ts>0&&<div style={{position:"absolute",top:6,left:6}}><div style={{width:8,height:8,borderRadius:4,background:C.warn,boxShadow:`0 0 0 2px ${C.surface}`}}/></div>}
            {p.collection&&<span style={{position:"absolute",top:6,right:6,fontSize:8,background:"rgba(255,255,255,0.9)",color:cc,padding:"2px 6px",borderRadius:8,fontWeight:700,backdropFilter:"blur(4px)",boxShadow:`0 1px 4px ${C.shadow}`}}>{p.collection}</span>}
            <button onClick={e=>{e.stopPropagation();toggleFavorite(p.id);}} style={{position:"absolute",bottom:6,right:6,background:"rgba(255,255,255,0.9)",border:"none",cursor:"pointer",padding:4,borderRadius:8,boxShadow:`0 1px 4px ${C.shadow}`,transition:"all 0.15s"}}>
              <Star size={13} color={favorites.includes(p.id)?C.accent:C.textLight} fill={favorites.includes(p.id)?C.accent:"none"}/></button></div>
          <div style={{padding:"10px 11px 11px"}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:2,lineHeight:1.3,letterSpacing:"-0.2px"}}>{p.name}</div>
            {p.sku&&<div style={{fontSize:9,fontFamily:"'Courier New',monospace",color:C.textMuted,marginBottom:3,letterSpacing:"0.3px"}}>{p.sku}</div>}
            <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:6}}>
              <span style={{fontSize:9,color:cc,fontWeight:600,background:`${cc}10`,padding:"1px 5px",borderRadius:4}}>{p.category}</span>
              <span style={{fontSize:9,color:C.textLight}}>{p.variants.length} var.</span></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:16,fontWeight:800,color:cc,letterSpacing:"-0.5px"}}>{p.price.toFixed(2)}€</span>
              <span style={{fontSize:10,fontWeight:600,color:ts>5?C.primary:ts>0?C.warn:C.danger,background:ts>5?C.primaryLight:ts>0?C.warnLight:C.dangerLight,padding:"2px 7px",borderRadius:6}}>{ts}</span></div>
          </div></div>);})}</div></div></div>

    {/* Cart */}
    <div style={{width:380,background:C.surface,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",boxShadow:`-4px 0 20px ${C.shadow}`}}>
      {/* Cart header */}
      <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{width:40,height:40,borderRadius:12,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:`0 4px 14px ${C.primary}25`}}><ShoppingCart size={19} color="#fff"/></div>
          <div style={{flex:1}}><div style={{fontSize:16,fontWeight:800,letterSpacing:"-0.3px"}}>Panier</div>
            <div style={{fontSize:10,color:C.textMuted}}>{cart.reduce((s,i)=>s+i.quantity,0)} pièce{cart.reduce((s,i)=>s+i.quantity,0)>1?"s":""}</div></div>
          <Btn variant="outline" onClick={parkCart} disabled={!cart.length} style={{padding:"6px 10px",borderRadius:8,fontSize:9,fontWeight:700,gap:4,position:"relative"}} title="Mettre en attente"><Pause size={12}/> Attente
            {parked.length>0&&<span style={{position:"absolute",top:-5,right:-5,width:16,height:16,borderRadius:8,background:C.danger,color:"#fff",fontSize:8,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{parked.length}</span>}</Btn>
          {perm().canVoid&&<Btn variant="ghost" onClick={()=>{if(cart.length)setConfirmVoid(true);}} disabled={!cart.length} style={{padding:"6px 8px",color:C.danger,borderRadius:8}} title="Annuler"><XOctagon size={13}/></Btn>}
        </div>

        {/* Seller selection */}
        <div style={{display:"flex",gap:4,marginBottom:6}}>
          <select value={selSeller||""} onChange={e=>setSelSeller(e.target.value||null)} style={{flex:1,height:30,fontSize:10,padding:"4px 8px",borderRadius:10,border:`1px solid ${C.border}`,fontFamily:"inherit",background:C.surface,color:selSeller?C.text:C.textMuted}}>
            <option value="">Vendeur: {currentUser?.name} (moi)</option>
            {users.filter(u=>u.name!==currentUser?.name&&u.role!=="admin").map(u=>(<option key={u.id} value={u.name}>{u.name}</option>))}
          </select>
          <Input value={saleNote} onChange={e=>setSaleNote(e.target.value)} placeholder="Note…" style={{flex:1,height:30,fontSize:10,padding:"4px 10px",borderRadius:10}}/>
        </div>

        {/* Customer */}
        <button onClick={()=>setCustModal(true)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:10,width:"100%",
          border:`1.5px dashed ${selCust?C.primary:C.border}`,background:selCust?`${C.primary}08`:"transparent",cursor:"pointer",marginBottom:6,
          fontSize:11,fontWeight:600,color:selCust?C.primary:C.textMuted,transition:"all 0.15s"}}
          onMouseEnter={e=>{if(!selCust)e.currentTarget.style.borderColor=C.primary+"66";}} onMouseLeave={e=>{if(!selCust)e.currentTarget.style.borderColor=C.border;}}>
          {selCust?<><div style={{width:24,height:24,borderRadius:12,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:700}}>{selCust.firstName[0]}{selCust.lastName[0]}</div>{selCust.firstName} {selCust.lastName} — {selCust.points}pts <Badge color={C.accent}>{custTier?.name}</Badge></>
          :<><Users size={13}/> Associer un client</>}
        </button>

        {/* Promo code input */}
        <div style={{display:"flex",gap:4}}>
          <Input value={codeInput} onChange={e=>setCodeInput(e.target.value)} placeholder="Code promo…" style={{height:32,fontSize:11,padding:"4px 10px",borderRadius:10}}/>
          <Btn variant="outline" onClick={()=>{setPromoCode(codeInput);}} style={{height:32,padding:"0 12px",fontSize:11,borderRadius:10}}>OK</Btn>
        </div>
      </div>

      {/* Cart items */}
      <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
        {!cart.length?<div style={{textAlign:"center",padding:"40px 0",color:C.textLight}}>
          <div style={{width:52,height:52,borderRadius:14,background:C.surfaceAlt,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:10}}>
            <ScanLine size={24} style={{opacity:.4}}/></div>
          <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>Panier vide</div>
          <div style={{fontSize:11}}>Scannez ou sélectionnez un produit</div></div>
        :cart.map(i=>{const t=i.product.price*i.quantity;const d=i.discountType==="amount"?(i.discount||0)*i.quantity:t*(i.discount/100);
          const cc=CAT_COLORS[i.product.category]||C.primary;
          const lastP=selCust&&!i.isCustom?getLastPriceForCustomer(selCust.id,i.product.id):null;
          return(
          <div key={`${i.product.id}-${i.variant?.id}`} style={{padding:10,borderRadius:12,border:`1px solid ${C.border}`,marginBottom:6,
            background:C.surface,transition:"all 0.15s",boxShadow:`0 1px 3px ${C.shadow}`}}
            onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 3px 10px ${C.shadowMd}`}
            onMouseLeave={e=>e.currentTarget.style.boxShadow=`0 1px 3px ${C.shadow}`}>
            <div style={{display:"flex",gap:8,marginBottom:6}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${cc}10`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:16}}>{i.isCustom?"📝":catIcon(i.product.category,settings.categoryIcons)}</span></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i.product.name}{i.isCustom?" (divers)":""}</div>
                {!i.isCustom&&<><div style={{display:"flex",gap:3,marginTop:3}}>
                  <span style={{fontSize:9,color:cc,fontWeight:600,background:`${cc}10`,padding:"1px 5px",borderRadius:4}}>{i.variant?.color}</span>
                  <span style={{fontSize:9,color:C.info,fontWeight:600,background:`${C.info}10`,padding:"1px 5px",borderRadius:4}}>{i.variant?.size}</span>
                  {lastP&&<span style={{fontSize:8,color:C.textMuted,background:C.surfaceAlt,padding:"1px 4px",borderRadius:4}}>Préc. {lastP.toFixed(2)}€</span>}</div>
                <div style={{display:"flex",gap:4,marginTop:2}}>
                  {i.product.sku&&<span style={{fontSize:8,fontFamily:"monospace",color:C.textMuted}}>Réf: {i.product.sku}</span>}
                  {i.variant?.ean&&<span style={{fontSize:8,fontFamily:"monospace",color:C.textLight}}>EAN: {i.variant.ean}</span>}
                </div></>}</div>
              <button onClick={()=>removeFromCart(i.product.id,i.variant?.id)} style={{background:C.dangerLight,border:"none",cursor:"pointer",borderRadius:8,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.background=C.danger} onMouseLeave={e=>e.currentTarget.style.background=C.dangerLight}>
                <Trash2 size={11} color={C.danger} style={{transition:"color 0.15s"}}/></button></div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:1,background:C.surfaceAlt,borderRadius:20,padding:2}}>
                <button onClick={()=>updateQty(i.product.id,i.variant?.id,i.quantity-1)} style={{width:26,height:26,borderRadius:13,border:"none",background:C.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 1px 2px ${C.shadow}`,transition:"all 0.1s"}}><Minus size={11}/></button>
                <span style={{width:28,textAlign:"center",fontSize:13,fontWeight:700}}>{i.quantity}</span>
                <button onClick={()=>updateQty(i.product.id,i.variant?.id,i.quantity+1)} style={{width:26,height:26,borderRadius:13,border:"none",background:C.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 1px 2px ${C.shadow}`,transition:"all 0.1s"}}><Plus size={11}/></button></div>
              <button onClick={()=>{setDm({pid:i.product.id,vid:i.variant?.id,discType:i.discountType||"percent"});setDv(String(i.discount));}} style={{padding:"3px 8px",borderRadius:8,border:`1px solid ${i.discount>0?cc:C.border}`,background:i.discount>0?`${cc}08`:"transparent",cursor:"pointer",fontSize:9,fontWeight:600,color:i.discount>0?cc:C.textMuted,transition:"all 0.15s"}}>
                {i.discount>0?`-${i.discount}${i.discountType==="amount"?"€":"%"}`:"Remise"}</button>
              <div style={{textAlign:"right"}}>{i.discount>0&&<div style={{fontSize:8,color:C.textLight,textDecoration:"line-through"}}>{t.toFixed(2)}€</div>}
                <div style={{fontSize:14,fontWeight:800,color:cc,letterSpacing:"-0.3px"}}>{(t-d).toFixed(2)}€</div></div></div></div>);})}</div>

      {/* Totals & Payment */}
      <div style={{padding:"0 12px 12px",borderTop:`1px solid ${C.border}`}}>
        <div style={{background:C.surfaceAlt,borderRadius:14,padding:14,margin:"10px 0 8px",fontSize:11}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.textMuted}}>Sous-total HT</span><span style={{fontWeight:600}}>{totals.sHT.toFixed(2)}€</span></div>
          {totals.gd>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#059669",display:"flex",alignItems:"center",gap:3}}><Percent size={10}/> Remises & promos</span><span style={{fontWeight:700,color:"#059669"}}>-{totals.gd.toFixed(2)}€</span></div>}
          {totals.applied?.length>0&&<div style={{background:`${C.warn}10`,borderRadius:8,padding:"4px 8px",marginBottom:4,border:`1px solid ${C.warn}15`}}>{totals.applied.map((a,i)=><div key={i} style={{fontSize:9,color:"#92720E",fontWeight:600}}>✓ {a}</div>)}</div>}
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.textMuted}}>TVA</span><span style={{fontWeight:600}}>{totals.tTVA.toFixed(2)}€</span></div>
          {avoirPayment>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.fiscal}}>Avoir appliqué</span><span style={{fontWeight:700,color:C.fiscal}}>-{avoirPayment.toFixed(2)}€</span></div>}
          <div style={{borderTop:`2px solid ${C.border}`,paddingTop:8,marginTop:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:16,fontWeight:800}}>Total TTC</span>
            <span style={{fontSize:24,fontWeight:900,color:C.primary,letterSpacing:"-0.8px"}}>{totals.tTTC.toFixed(2)}€</span></div></div>

        {cashGiven&&parseFloat(cashGiven)>0&&<div style={{background:C.primaryLight,borderRadius:12,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",
          border:`1px solid ${C.primary}15`,boxShadow:`0 2px 8px ${C.primary}10`}}>
          <span style={{fontSize:13,fontWeight:700,color:C.primaryDark}}>Rendu monnaie</span>
          <span style={{fontSize:22,fontWeight:900,color:C.primary,letterSpacing:"-0.5px"}}>{change.toFixed(2)}€</span></div>}

        <div style={{display:"flex",gap:4,marginBottom:6}}>
          <Btn variant="outline" onClick={()=>{setGm(true);setGv(String(gDisc));setGtp(gDiscType);}} style={{flex:1,height:32,fontSize:10,padding:"0 6px",borderRadius:10}}><Percent size={11}/> Remise globale</Btn>
          <Btn variant={detaxe?"success":"outline"} onClick={()=>setDetaxe(!detaxe)} style={{height:32,fontSize:10,padding:"0 10px",borderRadius:10,background:detaxe?C.primary:"transparent"}}>{detaxe?"✓ Détaxe":"Détaxe"}</Btn></div>
        {detaxe&&<div style={{background:C.primaryLight,borderRadius:8,padding:8,marginBottom:6,fontSize:10,color:C.primaryDark,border:`1px solid ${C.primary}30`}}>
          Vente en détaxe — TVA à 0% — Réservé aux résidents hors UE (achat min. 100,01€)</div>}

        <Btn onClick={()=>setPayMethodModal(true)} disabled={!cart.length||busy} style={{width:"100%",height:52,borderRadius:14,background:C.primary,fontSize:14,gap:8,boxShadow:`0 4px 16px ${C.primary}30`,marginBottom:6,letterSpacing:"-0.3px"}}>
          {busy?<span className="spin-loader"/>:<><Wallet size={18}/> Règlement — {totals.tTTC.toFixed(2)}€</>}</Btn>
        <div style={{display:"flex",gap:4}}>
          <Btn variant="outline" onClick={()=>setRetoucheModal(true)} style={{flex:1,height:30,fontSize:10,borderRadius:10,gap:4}}><Edit size={11}/> Retouche</Btn>
          <Btn variant="outline" onClick={()=>setCustomModal(true)} style={{flex:1,height:30,fontSize:10,borderRadius:10,gap:4}}><Plus size={11}/> Divers</Btn>
          <Btn variant="outline" onClick={clearCart} style={{flex:1,borderColor:`${C.danger}20`,color:C.danger,height:30,fontSize:10,borderRadius:10}}><RotateCcw size={10}/> Vider</Btn>
        </div>
      </div>
    </div>

    {/* MODALS */}
    <Modal open={!!vm} onClose={()=>setVm(null)} title="Choisir une variante" sub={vm?`${vm.name} — ${vm.price.toFixed(2)}€`:""}>
      {vm&&<>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 12px",background:C.surfaceAlt,borderRadius:12}}>
          <span style={{fontSize:28}}>{catIcon(vm.category,settings.categoryIcons)}</span>
          <div><div style={{fontSize:13,fontWeight:700}}>{vm.name}</div>
            <div style={{fontSize:11,color:C.textMuted}}>{vm.category} — {vm.collection||"Sans collection"} — TVA {(vm.taxRate*100).toFixed(0)}%</div>
            {vm.sku&&<div style={{fontSize:10,fontFamily:"monospace",color:C.textMuted,marginTop:1}}>Réf: {vm.sku}</div>}</div>
          <div style={{marginLeft:"auto",fontSize:18,fontWeight:800,color:CAT_COLORS[vm.category]||C.primary}}>{vm.price.toFixed(2)}€</div></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
          {sortVariantsBySize(vm.variants).map(v=>{const cc=CAT_COLORS[vm.category]||C.primary;return(
            <button key={v.id} onClick={()=>{addToCart(vm,v);setVm(null);}}
              style={{padding:12,borderRadius:14,border:`1.5px solid ${v.stock<=0?C.danger+"30":C.border}`,background:v.stock<=0?C.dangerLight+"15":"transparent",
                cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=cc} onMouseLeave={e=>e.currentTarget.style.borderColor=v.stock<=0?C.danger+"30":C.border}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:14,height:14,borderRadius:7,background:cc+"30",border:`2px solid ${cc}`}}/>
                <span style={{fontSize:12,fontWeight:700}}>{v.color}</span></div>
              <div style={{fontSize:16,fontWeight:800,color:v.stock>0?C.text:C.danger,marginBottom:4}}>{v.size}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,fontWeight:600,color:v.stock>0?(v.stock<=(v.stockAlert||5)?C.warn:cc):C.danger,
                  background:v.stock>0?(v.stock<=(v.stockAlert||5)?C.warnLight:`${cc}10`):C.dangerLight,padding:"2px 7px",borderRadius:6}}>
                  {v.stock>0?`${v.stock} dispo`:v.stock===0?"Rupture":`${v.stock} (négatif)`}</span>
                {v.ean&&<span style={{fontSize:8,color:C.textLight,fontFamily:"monospace"}}>{v.ean}</span>}</div>
            </button>);})}
        </div>
      </>}</Modal>

    <Modal open={!!dm} onClose={()=>setDm(null)} title="Remise article">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
        <Btn variant={dm?.discType!=="amount"?"primary":"outline"} onClick={()=>setDm(p=>({...p,discType:"percent"}))}>%</Btn>
        <Btn variant={dm?.discType==="amount"?"primary":"outline"} onClick={()=>setDm(p=>({...p,discType:"amount"}))}>€</Btn></div>
      <Input type="number" value={dv} onChange={e=>setDv(e.target.value)} placeholder={dm?.discType==="amount"?"Montant en €":"Pourcentage"} style={{marginBottom:8,height:40}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12}}>{dm?.discType==="amount"?[2,5,10,20].map(v=>(<Btn key={v} variant="outline" onClick={()=>setDv(String(v))} style={{fontSize:12}}>{v}€</Btn>)):[5,10,15,20].map(v=>(<Btn key={v} variant="outline" onClick={()=>setDv(String(v))} style={{fontSize:12}}>{v}%</Btn>))}</div>
      {dm?.discType!=="amount"&&parseInt(dv)>maxDisc&&<div style={{padding:8,background:C.dangerLight,borderRadius:8,marginBottom:8,fontSize:11,color:C.danger}}>Remise max autorisée: {maxDisc}%</div>}
      <Btn onClick={()=>{const d=parseFloat(dv);if(d>=0&&dm){updateItemDisc(dm.pid,dm.vid,d,dm.discType||"percent");setDm(null);}}}
        disabled={dm?.discType!=="amount"&&parseInt(dv)>maxDisc} style={{width:"100%",height:40,background:C.primary}}>Appliquer</Btn></Modal>

    <Modal open={gm} onClose={()=>setGm(false)} title="Remise globale">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
        <Btn variant={gtp==="percentage"?"primary":"outline"} onClick={()=>setGtp("percentage")}>%</Btn>
        <Btn variant={gtp==="amount"?"primary":"outline"} onClick={()=>setGtp("amount")}>€</Btn></div>
      <Input type="number" value={gv} onChange={e=>setGv(e.target.value)} style={{marginBottom:12,height:40}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <Btn variant="outline" onClick={()=>{setCartGD(0,"percentage");setGm(false);}}>Supprimer</Btn>
        <Btn variant="success" onClick={()=>{const d=parseFloat(gv);if(d>=0){setCartGD(d,gtp);setGm(false);}}}>Appliquer</Btn></div></Modal>

    <Modal open={payModal} onClose={()=>setPayModal(false)} title="Paiement fractionné" sub={`Total: ${totals.tTTC.toFixed(2)}€`}>
      {(()=>{const paid=(parseFloat(payCard)||0)+(parseFloat(payCash)||0)+(parseFloat(payGC)||0)+(parseFloat(payChq)||0)+(avoirPayment||0);
        const remaining=Math.max(0,totals.tTTC-paid);
        return(<>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
          <CreditCard size={11} color={cardType==="amex"?"#006FCF":C.info}/>
          <span style={{display:"inline-flex",gap:2}}>
            <button onClick={()=>setCardType("card")} style={{padding:"1px 6px",borderRadius:4,border:`1px solid ${cardType==="card"?C.info:C.border}`,background:cardType==="card"?C.info:"transparent",color:cardType==="card"?"#fff":C.textMuted,fontSize:9,fontWeight:700,cursor:"pointer"}}>CB</button>
            <button onClick={()=>setCardType("amex")} style={{padding:"1px 6px",borderRadius:4,border:`1px solid ${cardType==="amex"?"#006FCF":C.border}`,background:cardType==="amex"?"#006FCF":"transparent",color:cardType==="amex"?"#fff":C.textMuted,fontSize:9,fontWeight:700,cursor:"pointer"}}>AMEX</button></span>
          <button onClick={()=>setPayCard(String(remaining.toFixed(2)))} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:9,color:C.primary,fontWeight:600}}>= Reste</button></label>
          <Input type="number" step="0.01" value={payCard} onChange={e=>setPayCard(e.target.value)} placeholder="0.00"/></div>
        {[{l:"ESPÈCES",v:payCash,s:setPayCash,i:Banknote,c:C.primary},{l:"CARTE CADEAU",v:payGC,s:setPayGC,i:Gift,c:C.accent},{l:"CHÈQUE",v:payChq||"",s:v=>setPayChq(v),i:FileText,c:"#7B8794"}].map(x=>(
          <div key={x.l}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"flex",alignItems:"center",gap:4,marginBottom:3}}><x.i size={11} color={x.c}/>{x.l}
            <button onClick={()=>x.s(String(remaining.toFixed(2)))} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:9,color:C.primary,fontWeight:600}}>= Reste</button></label>
            <Input type="number" step="0.01" value={x.v} onChange={e=>x.s(e.target.value)} placeholder="0.00"/></div>))}
        <div><label style={{fontSize:10,fontWeight:600,color:C.fiscal,display:"block",marginBottom:3}}>AVOIR CLIENT</label>
          <Input type="number" step="0.01" value={avoirPayment||""} onChange={e=>setAvoirPayment(parseFloat(e.target.value)||0)} placeholder="0.00"/></div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,background:remaining>0.01?C.warnLight:C.primaryLight,marginBottom:10}}>
        <span style={{fontSize:11,fontWeight:600,color:remaining>0.01?C.warn:C.primary}}>Reste à payer</span>
        <span style={{fontSize:13,fontWeight:800,color:remaining>0.01?C.warn:C.primary}}>{remaining.toFixed(2)}€</span></div>
      <Btn onClick={doSplitPay} disabled={busy||remaining>0.01} style={{width:"100%",height:44,background:C.fiscal}}><Split size={16}/> Valider</Btn>
      </>);})()}</Modal>

    <Modal open={custModal} onClose={()=>setCustModal(false)} title="Client">
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        <Btn variant="outline" onClick={()=>{setSelCust(null);setCustModal(false);}} style={{borderColor:C.danger+"44",color:C.danger}}>Aucun client</Btn>
        <Btn variant="outline" onClick={()=>{setCustModal(false);setNewCustModal(true);}}><Plus size={14}/> Nouveau client</Btn>
        {customers.map(c=>{const tier=getLoyaltyTier(c.points);return(<button key={c.id} onClick={()=>{setSelCust(c);setCustModal(false);}} style={{display:"flex",alignItems:"center",gap:10,
          padding:10,borderRadius:10,border:`1.5px solid ${selCust?.id===c.id?C.primary:C.border}`,background:selCust?.id===c.id?C.primaryLight:"transparent",cursor:"pointer"}}>
          <div style={{width:32,height:32,borderRadius:16,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:11}}>{c.firstName[0]}{c.lastName[0]}</div>
          <div style={{flex:1,textAlign:"left"}}><div style={{fontSize:12,fontWeight:600}}>{c.firstName} {c.lastName}</div>
            <div style={{fontSize:10,color:C.textMuted}}>{c.phone}</div></div>
          <div style={{textAlign:"right"}}><Badge color={C.accent}>{tier.name} — {c.points}pts</Badge></div>
        </button>);})}
      </div></Modal>

    {/* New customer */}
    <Modal open={newCustModal} onClose={()=>setNewCustModal(false)} title="Nouveau client">
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        <Input value={ncF} onChange={e=>setNcF(e.target.value)} placeholder="Prénom"/>
        <Input value={ncL} onChange={e=>setNcL(e.target.value)} placeholder="Nom"/>
        <Input value={ncE} onChange={e=>setNcE(e.target.value)} placeholder="Email"/>
        <Input value={ncP} onChange={e=>setNcP(e.target.value)} placeholder="Téléphone"/></div>
      <Btn onClick={async()=>{if(ncF&&ncL){const c=await addCustomer({firstName:ncF,lastName:ncL,email:ncE,phone:ncP,city:"",notes:""});
        if(c){setSelCust(c);setNewCustModal(false);setNcF("");setNcL("");setNcE("");setNcP("");}}}}
        style={{width:"100%",height:40,background:C.primary}}>Créer et associer</Btn></Modal>

    {/* Custom item */}
    <Modal open={customModal} onClose={()=>setCustomModal(false)} title="Article divers / Services">
      <div style={{marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:C.textMuted,marginBottom:6}}>SERVICES RAPIDES</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {[{n:"Retouche bas de manches",p:10},{n:"Retouche bas d'ourlet",p:15},{n:"Retouche ajustement",p:20},{n:"Emballage cadeau",p:5}].map(sv=>(
            <button key={sv.n} onClick={()=>{addCustomItem(sv.n,sv.p/1.20,0.20);setCustomModal(false);}}
              style={{padding:"8px 10px",borderRadius:10,border:`1.5px solid ${C.border}`,background:C.surfaceAlt,cursor:"pointer",textAlign:"left",transition:"all 0.12s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.background=C.primaryLight;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.surfaceAlt;}}>
              <div style={{fontSize:11,fontWeight:600}}>{sv.n}</div>
              <div style={{fontSize:12,fontWeight:700,color:C.primary}}>{sv.p.toFixed(2)}€</div></button>))}</div></div>
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:C.textMuted,marginBottom:6}}>ARTICLE PERSONNALISÉ</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="Description (ex: Retouche ourlet)"/>
          <Input type="number" step="0.01" value={customPrice} onChange={e=>setCustomPrice(e.target.value)} placeholder="Prix TTC"/></div></div>
      <Btn onClick={()=>{if(customName&&customPrice){const p=parseFloat(customPrice);addCustomItem(customName,p/1.20,0.20);
        setCustomModal(false);setCustomName("");setCustomPrice("");}}}
        style={{width:"100%",height:40,background:C.primary}}>Ajouter au panier</Btn></Modal>

    {/* Parked */}
    <Modal open={parkedModal} onClose={()=>setParkedModal(false)} title="Paniers en attente">
      {!parked.length?<div style={{textAlign:"center",padding:24,color:C.textLight,fontSize:12}}>Aucun panier</div>
      :parked.map(p=>(<div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,border:`1.5px solid ${C.border}`,marginBottom:6}}>
        <Pause size={14} color={C.textMuted}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{p.items.length} art.{p.customer?` — ${p.customer.firstName}`:""}</div>
          <div style={{fontSize:10,color:C.textMuted}}>{new Date(p.date).toLocaleTimeString("fr-FR")}</div></div>
        <Btn onClick={()=>{restoreCart(p.id);setParkedModal(false);}} style={{padding:"4px 10px",fontSize:11}}><Play size={12}/> Reprendre</Btn></div>))}</Modal>

    {/* Void confirmation */}
    <Modal open={confirmVoid} onClose={()=>{setConfirmVoid(false);setVoidReason("");}} title="Annuler le panier">
      <div style={{marginBottom:12}}><AlertTriangle size={20} color={C.danger} style={{marginRight:8,verticalAlign:"middle"}}/>
        <span style={{fontSize:13,color:C.textMuted}}>Annuler {cart.length} article(s) pour {totals.tTTC.toFixed(2)}€ ? Irréversible.</span></div>
      <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4}}>MOTIF D'ANNULATION (obligatoire NF525)</label>
      <select value={voidReason} onChange={e=>setVoidReason(e.target.value)} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,marginBottom:14,fontFamily:"inherit"}}>
        <option value="">Sélectionner un motif…</option>
        <option value="Erreur de saisie">Erreur de saisie</option>
        <option value="Client annule">Client annule l'achat</option>
        <option value="Produit indisponible">Produit indisponible</option>
        <option value="Erreur de prix">Erreur de prix</option>
        <option value="Autre">Autre</option></select>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="outline" onClick={()=>{setConfirmVoid(false);setVoidReason("");}}>Annuler</Btn>
        <Btn variant="danger" disabled={!voidReason} onClick={()=>{voidSale(voidReason);setConfirmVoid(false);setVoidReason("");}}>Confirmer l'annulation</Btn></div>
    </Modal>

    {/* Keyboard shortcuts help */}
    <Modal open={showShortcuts} onClose={()=>setShowShortcuts(false)} title="Raccourcis clavier">
      <div style={{display:"flex",flexDirection:"column",gap:6,fontSize:12}}>
        {[["F2","Paiement rapide CB"],["F3","Paiement rapide Espèces"],["F4","Paiement fractionné"],["F5","Mettre en attente"],["F8","Annuler le panier"],["Shift+?","Afficher les raccourcis"]].map(([k,l])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
            <span>{l}</span><kbd style={{background:C.surfaceAlt,padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:600,border:`1px solid ${C.border}`}}>{k}</kbd></div>))}
      </div></Modal>

    {/* TICKET */}
    <Modal open={tkModal} onClose={()=>setTkModal(false)} title="Vente confirmée" wide>
      {lastTk&&(<>
        <div style={{textAlign:"center",marginBottom:20,animation:"successPulse 0.5s ease"}}>
          <div style={{width:72,height:72,borderRadius:36,background:"#059669",display:"inline-flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 8px 32px rgba(47,158,85,0.35)",marginBottom:10,border:"3px solid rgba(47,158,85,0.2)"}}><CheckCircle2 size={36} color="#fff"/></div>
          <div style={{fontSize:11,fontWeight:600,color:"#059669",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Vente confirmée</div>
          <div style={{fontSize:28,fontWeight:900,color:"#059669",letterSpacing:"-1px"}}>{(lastTk.totalTTC||0).toFixed(2)}€</div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Paiement {({cash:"Espèces",card:"CB",amex:"American Express",giftcard:"Cadeau",MIXTE:"Mixte",cheque:"Chèque"})[lastTk.paymentMethod]||lastTk.paymentMethod}</div></div>
        <div data-print-receipt style={{fontFamily:"'Courier New',monospace",fontSize:10,background:"#FAFAF8",borderRadius:12,padding:18,border:`1px solid ${C.border}`,boxShadow:`inset 0 1px 3px ${C.shadow}`}}>
        <div style={{textAlign:"center",marginBottom:8}}><div style={{fontSize:12,fontWeight:700}}>{settings.name||CO.name}</div>
          <div>{settings.address}, {settings.postalCode} {settings.city}</div><div>SIRET: {settings.siret} — TVA: {settings.tvaIntra}</div></div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>N° {lastTk.ticketNumber}</span><span>{new Date(lastTk.date||lastTk.createdAt||"").toLocaleString("fr-FR")}</span></div>
        <div>Caissier: {lastTk.userName}{lastTk.customerName?` — Client: ${lastTk.customerName}`:""}</div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        {(lastTk.items||[]).map((i,k)=>{const sku=i.product?.sku||i.product_sku||"";const ean=i.variant?.ean||i.variant_ean||"";return(<div key={k}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}><span style={{flex:1,wordBreak:"break-word",lineHeight:1.3}}>{i.product?.name||i.product_name}{i.isCustom||i.is_custom?"":`(${i.variant?.color||i.variant_color}/${i.variant?.size||i.variant_size})`} x{i.quantity}{i.discount>0?` -${i.discount}${i.discountType==="amount"?"€":"%"}`:""}</span><span style={{whiteSpace:"nowrap",fontWeight:600}}>{(i.lineTTC||i.line_ttc||(i.unit_price*i.quantity)).toFixed(2)}€</span></div>
          {(sku||ean)&&<div style={{fontSize:8,color:"#999"}}>{sku?`Réf: ${sku}`:""}{sku&&ean?" — ":""}{ean?`EAN: ${ean}`:""}</div>}
        </div>);})}
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        {lastTk.promosApplied?.length>0&&lastTk.promosApplied.map((a,i)=><div key={i} style={{color:"#059669",fontSize:9}}>✓ {a}</div>)}
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Total HT</span><span>{(lastTk.totalHT||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>TVA</span><span>{(lastTk.totalTVA||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,marginTop:3}}><span>TOTAL TTC</span><span>{(lastTk.totalTTC||0).toFixed(2)}€</span></div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        <div>Paiement: {lastTk.payments?.map(p=>`${({cash:"ESP",card:"CB",amex:"AMEX",giftcard:"CAD",cheque:"CHQ",avoir:"AVOIR"})[p.method]||p.method} ${(p.amount||0).toFixed(2)}€`).join(" + ")}</div>
        <div style={{textAlign:"center",background:C.fiscalLight,padding:6,borderRadius:6,margin:"4px 0"}}>
          <div style={{fontSize:8,color:C.fiscal,fontWeight:700}}>EMPREINTE NF525</div>
          <div style={{fontSize:11,fontWeight:700,color:C.fiscal,letterSpacing:2}}>{lastTk.fingerprint}</div></div>
        {lastTk.detaxe&&<div style={{textAlign:"center",background:C.primaryLight,padding:6,borderRadius:6,margin:"4px 0",fontSize:9,color:C.primaryDark,fontWeight:700}}>VENTE EN DÉTAXE — TVA 0% — ART. 262 CGI</div>}
        <div style={{textAlign:"center",fontSize:8,color:C.textMuted}}>
          {CO.sw} v{CO.ver} — Conforme NF525<br/>{settings.footerMsg||CO.footerMsg}</div>
        {lastTk.saleNote&&<div style={{textAlign:"center",fontSize:9,color:C.text,marginTop:3,fontStyle:"italic"}}>Note: {lastTk.saleNote}</div>}
        {lastTk.customerName&&<div style={{textAlign:"center",fontSize:9,color:C.accent,marginTop:3}}>Fidélité: +{Math.floor(lastTk.totalTTC||0)}pts</div>}
      </div>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn variant="outline" onClick={()=>emailTicket(lastTk)} style={{flex:1,borderRadius:12}}><Mail size={14}/> Email</Btn>
        <Btn variant="outline" onClick={()=>thermalPrint("receipt",lastTk)} style={{flex:1,borderRadius:12}}><Printer size={14}/> {printerConnected?"Ticket":"Imprimer"}</Btn>
        <Btn variant="success" onClick={()=>setTkModal(false)} style={{flex:1,borderRadius:12}}><CheckCircle2 size={14}/> Terminé</Btn>
      </div></>)}
    </Modal>

    {/* CASH NUMPAD MODAL */}
    <Modal open={cashNumpadModal} onClose={()=>setCashNumpadModal(false)} title="Paiement Espèces" sub={`Total: ${totals.tTTC.toFixed(2)}€`}>
      <div style={{marginBottom:12}}>
        <Numpad value={numpadValue} onChange={setNumpadValue} label="Montant donné par le client"/>
        {parseFloat(numpadValue)>0&&<div style={{background:C.primaryLight,borderRadius:12,padding:14,marginTop:10,
          display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${C.primary}15`}}>
          <span style={{fontSize:14,fontWeight:700,color:C.primaryDark}}>Rendu monnaie</span>
          <span style={{fontSize:26,fontWeight:900,color:C.primary,letterSpacing:"-0.5px"}}>{Math.max(0,parseFloat(numpadValue)-totals.tTTC).toFixed(2)}€</span></div>}
        <div style={{display:"flex",gap:6,marginTop:10}}>
          {[totals.tTTC,Math.ceil(totals.tTTC),Math.ceil(totals.tTTC/5)*5,Math.ceil(totals.tTTC/10)*10,50,100].filter((v,i,a)=>v>0&&a.indexOf(v)===i).slice(0,4).map(v=>(
            <Btn key={v} variant="outline" onClick={()=>setNumpadValue(String(v))} style={{flex:1,fontSize:11,borderRadius:10}}>{v.toFixed(2)}€</Btn>))}
        </div>
      </div>
      <Btn onClick={async()=>{setCashNumpadModal(false);setCashGiven(numpadValue);await quickPay("cash");}}
        disabled={!numpadValue||parseFloat(numpadValue)<totals.tTTC}
        style={{width:"100%",height:50,fontSize:15,borderRadius:14,background:"#059669",boxShadow:`0 4px 16px ${C.primary}30`}}>
        <Banknote size={18}/> Encaisser {totals.tTTC.toFixed(2)}€</Btn>
    </Modal>

    {/* PAYMENT METHOD MODAL */}
    <Modal open={payMethodModal} onClose={()=>setPayMethodModal(false)} title="Règlement" sub={`Total: ${totals.tTTC.toFixed(2)}€`}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <button onClick={()=>{setPayMethodModal(false);quickPay("card");}} style={{padding:16,borderRadius:14,border:`2px solid ${C.info}25`,background:`${C.info}06`,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.info} onMouseLeave={e=>e.currentTarget.style.borderColor=`${C.info}25`}>
          <CreditCard size={24} color={C.info} style={{marginBottom:6}}/><div style={{fontSize:13,fontWeight:700,color:C.text}}>Carte bancaire</div><div style={{fontSize:10,color:C.textMuted}}>CB / Visa / Mastercard</div></button>
        <button onClick={()=>{setPayMethodModal(false);setCardType("amex");quickPay("amex");}} style={{padding:16,borderRadius:14,border:`2px solid #006FCF25`,background:"#006FCF06",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#006FCF"} onMouseLeave={e=>e.currentTarget.style.borderColor="#006FCF25"}>
          <CreditCard size={24} color="#006FCF" style={{marginBottom:6}}/><div style={{fontSize:13,fontWeight:700,color:C.text}}>American Express</div><div style={{fontSize:10,color:C.textMuted}}>AMEX</div></button>
        <button onClick={()=>{setPayMethodModal(false);setNumpadValue("");setCashNumpadModal(true);}} style={{padding:16,borderRadius:14,border:`2px solid ${C.primary}25`,background:`${C.primary}06`,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary} onMouseLeave={e=>e.currentTarget.style.borderColor=`${C.primary}25`}>
          <Banknote size={24} color={C.primary} style={{marginBottom:6}}/><div style={{fontSize:13,fontWeight:700,color:C.text}}>Espèces</div><div style={{fontSize:10,color:C.textMuted}}>Avec rendu monnaie</div></button>
        <button onClick={()=>{setPayMethodModal(false);quickPay("cheque");}} style={{padding:16,borderRadius:14,border:`2px solid #7B879425`,background:"#7B879406",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#7B8794"} onMouseLeave={e=>e.currentTarget.style.borderColor="#7B879425"}>
          <FileText size={24} color="#7B8794" style={{marginBottom:6}}/><div style={{fontSize:13,fontWeight:700,color:C.text}}>Chèque</div><div style={{fontSize:10,color:C.textMuted}}>Paiement par chèque</div></button>
        <button onClick={()=>{setPayMethodModal(false);quickPay("giftcard");}} style={{padding:16,borderRadius:14,border:`2px solid ${C.accent}25`,background:`${C.accent}06`,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=`${C.accent}25`}>
          <Gift size={24} color={C.accent} style={{marginBottom:6}}/><div style={{fontSize:13,fontWeight:700,color:C.text}}>Carte cadeau</div><div style={{fontSize:10,color:C.textMuted}}>Paiement par carte cadeau</div></button>
        <button onClick={()=>{setPayMethodModal(false);setAvoirSelectModal(true);}}
          style={{padding:16,borderRadius:14,border:`2px solid ${C.fiscal}25`,background:avoirs.filter(a=>!a.used&&(a.remaining||a.totalTTC)>0).length?`${C.fiscal}06`:`${C.border}08`,cursor:"pointer",textAlign:"center",transition:"all 0.15s",opacity:avoirs.filter(a=>!a.used&&(a.remaining||a.totalTTC)>0).length?1:0.5}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.fiscal} onMouseLeave={e=>e.currentTarget.style.borderColor=`${C.fiscal}25`}>
          <RotateCcw size={24} color={C.fiscal} style={{marginBottom:6}}/><div style={{fontSize:13,fontWeight:700,color:C.text}}>Avoir</div>
          <div style={{fontSize:10,color:C.textMuted}}>{avoirs.filter(a=>!a.used&&(a.remaining||a.totalTTC)>0).length} avoir(s) dispo.</div></button>
      </div>
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
        <button onClick={()=>{setPayMethodModal(false);openPay();}} style={{width:"100%",padding:14,borderRadius:14,border:`2px solid ${C.fiscal}25`,background:`${C.fiscal}06`,cursor:"pointer",textAlign:"center",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.fiscal} onMouseLeave={e=>e.currentTarget.style.borderColor=`${C.fiscal}25`}>
          <Split size={20} color={C.fiscal}/><div style={{textAlign:"left"}}><div style={{fontSize:13,fontWeight:700,color:C.text}}>Paiement fractionné</div>
            <div style={{fontSize:10,color:C.textMuted}}>Répartir entre plusieurs moyens de paiement</div></div></button>
      </div>
    </Modal>

    {/* AVOIR SELECTION MODAL */}
    <Modal open={avoirSelectModal} onClose={()=>setAvoirSelectModal(false)} title="Paiement par avoir" sub={`Total à payer: ${totals.tTTC.toFixed(2)}€`}>
      {(()=>{const available=avoirs.filter(a=>!a.used&&(a.remaining??a.totalTTC)>0);
        return available.length===0?<div style={{textAlign:"center",padding:30,color:C.textLight}}>
          <RotateCcw size={32} color={C.border} style={{marginBottom:10}}/>
          <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>Aucun avoir disponible</div>
          <div style={{fontSize:11}}>Les avoirs sont générés lors des retours en caisse.</div></div>
        :<div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>{available.length} avoir(s) disponible(s)</div>
          {available.map(a=>{const rem=a.remaining??a.totalTTC;const canApply=Math.min(rem,totals.tTTC);
            return(<div key={a.avoirNumber} style={{padding:14,borderRadius:14,border:`2px solid ${C.fiscal}25`,background:C.surfaceAlt,display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700}}>{a.avoirNumber}</div>
                <div style={{fontSize:10,color:C.textMuted}}>Ticket: {a.originalTicket} — {new Date(a.date).toLocaleDateString("fr-FR")}</div>
                {a.customerName&&<div style={{fontSize:10,color:C.textMuted}}>Client: {a.customerName}</div>}
                <div style={{fontSize:12,fontWeight:700,color:C.fiscal,marginTop:4}}>Solde: {rem.toFixed(2)}€</div></div>
              <Btn onClick={()=>{setAvoirPayment(canApply);consumeAvoir(a.avoirNumber,canApply);setAvoirSelectModal(false);
                if(canApply>=totals.tTTC){quickPay("avoir");}else{notify(`Avoir ${a.avoirNumber}: ${canApply.toFixed(2)}€ appliqué. Reste ${(totals.tTTC-canApply).toFixed(2)}€ à payer.`,"info");openPay();}}}
                style={{background:C.fiscal,padding:"10px 16px",fontSize:12}}>
                Appliquer {canApply.toFixed(2)}€</Btn>
            </div>);})}
        </div>;})()}
    </Modal>

    {/* RETOUCHE MODAL */}
    <Modal open={retoucheModal} onClose={()=>setRetoucheModal(false)} title="Bon de retouche" wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>NOM DU CLIENT</label>
          <Input value={retForm.client} onChange={e=>setRetForm(f=>({...f,client:e.target.value}))} placeholder="Nom complet"/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>TÉLÉPHONE</label>
          <Input value={retForm.phone} onChange={e=>setRetForm(f=>({...f,phone:e.target.value}))} placeholder="06 XX XX XX XX"/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>DATE DE RETRAIT</label>
          <Input type="date" value={retForm.date} onChange={e=>setRetForm(f=>({...f,date:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>ASSOCIER UN CLIENT</label>
          <select value="" onChange={e=>{const c=customers.find(x=>x.id===e.target.value);if(c)setRetForm(f=>({...f,client:`${c.firstName} ${c.lastName}`,phone:c.phone||""}));}}
            style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
            <option value="">— Sélectionner —</option>{customers.map(c=>(<option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>))}</select></div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>TRAVAUX DE RETOUCHE</label>
        {retForm.items.map((item,idx)=>(<div key={idx} style={{display:"flex",gap:6,marginBottom:6}}>
          <Input value={item.desc} onChange={e=>{const items=[...retForm.items];items[idx].desc=e.target.value;setRetForm(f=>({...f,items}));}} placeholder="Description (ex: Ourlet pantalon)" style={{flex:2}}/>
          <Input type="number" step="0.01" value={item.price} onChange={e=>{const items=[...retForm.items];items[idx].price=e.target.value;setRetForm(f=>({...f,items}));}} placeholder="Prix €" style={{flex:1}}/>
          {retForm.items.length>1&&<Btn variant="ghost" onClick={()=>{const items=retForm.items.filter((_,i)=>i!==idx);setRetForm(f=>({...f,items}));}} style={{padding:"4px 8px",color:C.danger}}><Trash2 size={12}/></Btn>}
        </div>))}
        <Btn variant="outline" onClick={()=>setRetForm(f=>({...f,items:[...f.items,{desc:"",price:""}]}))} style={{fontSize:10,padding:"4px 12px"}}><Plus size={11}/> Ajouter une ligne</Btn>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginTop:8}}>
          {(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}]).filter(sv=>sv.n).map(sv=>(
            <button key={sv.n} onClick={()=>setRetForm(f=>({...f,items:[...f.items.filter(i=>i.desc||i.price),{desc:sv.n,price:String(sv.p)}]}))}
              style={{padding:"6px 4px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surfaceAlt,cursor:"pointer",fontSize:9,fontWeight:600,textAlign:"center",transition:"all 0.1s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.background=C.primaryLight;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.surfaceAlt;}}>
              {sv.n}<br/><span style={{color:C.primary,fontWeight:700}}>{sv.p}€</span></button>))}</div>
      </div>
      <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>NOTES</label>
        <textarea value={retForm.notes} onChange={e=>setRetForm(f=>({...f,notes:e.target.value}))} placeholder="Instructions particulières, couleur fil, remarques…"
          style={{width:"100%",minHeight:60,padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit",resize:"vertical"}}/></div>
      {(()=>{const retTotal=retForm.items.reduce((s,i)=>s+(parseFloat(i.price)||0),0);return retTotal>0&&
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,background:C.primaryLight,marginBottom:12}}>
          <span style={{fontSize:13,fontWeight:700}}>Total retouche</span>
          <span style={{fontSize:18,fontWeight:900,color:C.primary}}>{retTotal.toFixed(2)}€</span></div>;})()}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Btn variant="outline" onClick={()=>{
          const retTotal=retForm.items.reduce((s,i)=>s+(parseFloat(i.price)||0),0);
          const tva=(settings.retoucheTVA||20)/100;
          retForm.items.filter(i=>i.desc&&i.price).forEach(i=>{addCustomItem(`Retouche: ${i.desc}`,parseFloat(i.price)/(1+tva),tva);});
          setRetoucheModal(false);notify(`Retouche ajoutée au panier (${retTotal.toFixed(2)}€)`);
        }} disabled={!retForm.items.some(i=>i.desc&&i.price)}>
          <ShoppingCart size={14}/> Ajouter au panier</Btn>
        <Btn onClick={()=>{
          const retTotal=retForm.items.reduce((s,i)=>s+(parseFloat(i.price)||0),0);
          const bonNum=`RET-${Date.now().toString(36).toUpperCase()}`;
          const bon={num:bonNum,client:retForm.client,phone:retForm.phone,dateRetrait:retForm.date,items:retForm.items.filter(i=>i.desc),notes:retForm.notes,total:retTotal,date:new Date().toISOString(),seller:selSeller||currentUser?.name};
          // Add items to cart
          const tva2=(settings.retoucheTVA||20)/100;
          retForm.items.filter(i=>i.desc&&i.price).forEach(i=>{addCustomItem(`Retouche: ${i.desc}`,parseFloat(i.price)/(1+tva2),tva2);});
          // Print bon
          const w=window.open("","_blank","width=400,height=600");if(w){w.document.write(`<html><head><title>Bon de retouche ${bonNum}</title><style>body{font-family:'Courier New',monospace;font-size:12px;padding:10px;max-width:300px;margin:0 auto;}h2{text-align:center;font-size:14px;margin:4px 0;}hr{border:none;border-top:1px dashed #333;margin:6px 0;}.row{display:flex;justify-content:space-between;}.center{text-align:center;}</style></head><body>`+
            `<h2>${settings.name||"CaissePro"}</h2><div class="center">${settings.address||""} ${settings.postalCode||""} ${settings.city||""}</div><hr>`+
            `<h2>BON DE RETOUCHE</h2><div class="center">N° ${bonNum}</div><hr>`+
            `<div class="row"><span>Client:</span><strong>${bon.client||"—"}</strong></div>`+
            `<div class="row"><span>Tél:</span><span>${bon.phone||"—"}</span></div>`+
            `<div class="row"><span>Date retrait:</span><span>${new Date(bon.dateRetrait).toLocaleDateString("fr-FR")}</span></div><hr>`+
            bon.items.filter(i=>i.desc).map(i=>`<div class="row"><span>${i.desc}</span><strong>${parseFloat(i.price||0).toFixed(2)}€</strong></div>`).join("")+
            `<hr><div class="row"><strong>TOTAL</strong><strong>${retTotal.toFixed(2)}€ TTC</strong></div><hr>`+
            (bon.notes?`<div><strong>Notes:</strong> ${bon.notes}</div><hr>`:"")+
            `<div class="center" style="font-size:10px;">Vendeur: ${bon.seller}<br>${new Date().toLocaleString("fr-FR")}<br>${settings.name||"CaissePro"} — ${settings.siret||""}</div>`+
            `</body></html>`);w.document.close();setTimeout(()=>{w.print();},300);}
          setRetoucheModal(false);setRetForm({client:"",phone:"",date:new Date().toISOString().split("T")[0],notes:"",items:[{desc:"",price:""}]});
          notify(`Bon de retouche ${bonNum} créé et ajouté au panier`);
          addAudit("RETOUCHE",`Bon ${bonNum} — ${bon.client} — ${retTotal.toFixed(2)}€`);
        }} disabled={!retForm.items.some(i=>i.desc&&i.price)||!retForm.client}
          style={{background:C.primary}}>
          <Printer size={14}/> Imprimer le bon + panier</Btn>
      </div>
    </Modal>

    {/* H8 fix: sync confirm modal instead of native confirm() */}
    <Modal open={syncConfirm} onClose={()=>setSyncConfirm(false)} title="Vider la file de synchronisation ?">
      <p style={{fontSize:12,color:C.textMuted,marginBottom:14}}>{pendingSync.length} action(s) en attente seront supprimées. Les ventes non synchronisées seront perdues.</p>
      <div style={{display:"flex",gap:8}}>
        <Btn variant="outline" onClick={()=>setSyncConfirm(false)} style={{flex:1}}>Annuler</Btn>
        <Btn variant="danger" onClick={()=>{clearPendingSync();setSyncConfirm(false);}} style={{flex:1}}>Vider la file</Btn></div>
    </Modal>
  </div>);
}

/* ══════════ STATS SCREEN ══════════ */
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
  const fBestSellers=useMemo(()=>{const m={};fTickets.forEach(t=>(t.items||[]).forEach(i=>{
    const k=i.product?.sku||i.product_name;if(!m[k])m[k]={name:i.product?.name||i.product_name,sku:k,qty:0,revenue:0,margin:0};
    m[k].qty+=i.quantity;m[k].revenue+=(i.lineTTC||i.line_ttc||0);m[k].margin+=((i.lineHT||i.line_ht||0)-(i.product?.costPrice||i.cost_price||0)*i.quantity);}));
    return Object.values(m).sort((a,b)=>b.qty-a.qty);},[fTickets]);
  const fCommissions=useMemo(()=>{const m={};fTickets.forEach(t=>{
    const n=t.userName||t.user_name||"?";if(!m[n])m[n]={name:n,count:0,revenue:0,margin:0};
    m[n].count++;m[n].revenue+=(t.totalTTC||parseFloat(t.total_ttc)||0);m[n].margin+=(parseFloat(t.margin)||0);});
    return Object.values(m).sort((a,b)=>b.revenue-a.revenue).map(s=>({...s,commission:s.margin*0.05,goal:salesGoals[s.name]||0,goalProgress:salesGoals[s.name]?(s.revenue/salesGoals[s.name]*100):0}));},[fTickets,salesGoals]);
  const fByVariant=useMemo(()=>{const bySize={},byColor={};fTickets.forEach(t=>(t.items||[]).forEach(i=>{
    const s=i.variant?.size||i.variant_size||"?";const c=i.variant?.color||i.variant_color||"?";
    bySize[s]=(bySize[s]||0)+i.quantity;byColor[c]=(byColor[c]||0)+i.quantity;}));
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
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>Statistiques</h2>
      <Btn variant="outline" onClick={()=>exportCSVReport(fBestSellers,"best-sellers.csv")} style={{fontSize:11}}><Download size={12}/> Export CSV</Btn></div>
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
      <div><SC icon={DollarSign} label="CA TTC" value={`${stats.tTTC.toFixed(0)}€`} color={C.primary} sub={<PctBadge cur={stats.tTTC} prev={prevStats.tTTC}/>}/></div>
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

    {tab==="best"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
          {["#","Produit","SKU","Qté vendue","CA TTC",perm().canViewMargin?"Marge":""].filter(Boolean).map(h=>(
            <th key={h} style={{padding:8,textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
        <tbody>{fBestSellers.slice(0,15).map((p,i)=>(<tr key={p.sku} style={{borderBottom:`1px solid ${C.border}`}}>
          <td style={{padding:8,fontWeight:700,color:i<3?C.primary:C.text}}>{i+1}</td>
          <td style={{padding:8,fontWeight:600}}>{p.name}</td>
          <td style={{padding:8,color:C.textMuted,fontFamily:"monospace"}}>{p.sku}</td>
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
      const pn=i.product?.name||i.product_name;const c=i.variant?.color||i.variant_color||"?";const s=i.variant?.size||i.variant_size||"?";
      if(!byProd[pn])byProd[pn]={name:pn,variants:{}};const vk=`${c}/${s}`;
      if(!byProd[pn].variants[vk])byProd[pn].variants[vk]={color:c,size:s,qty:0,revenue:0};
      byProd[pn].variants[vk].qty+=i.quantity;byProd[pn].variants[vk].revenue+=(i.lineTTC||i.line_ttc||0);}));
      const prodList=Object.values(byProd).sort((a,b)=>{const aq=Object.values(a.variants).reduce((s,v)=>s+v.qty,0);
        const bq=Object.values(b.variants).reduce((s,v)=>s+v.qty,0);return bq-aq;});
      return(<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Détail des variantes vendues</h3>
        {prodList.slice(0,10).map(p=>{const vars=Object.values(p.variants).sort((a,b)=>b.qty-a.qty);
          const totalQty=vars.reduce((s,v)=>s+v.qty,0);
          return(<div key={p.name} style={{marginBottom:14,padding:12,borderRadius:10,background:C.surfaceAlt}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:13,fontWeight:700}}>{p.name}</span>
              <Badge color={C.primary}>{totalQty} vendus</Badge></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:4}}>
              {vars.map(v=>{const pct=totalQty?(v.qty/totalQty*100):0;return(
                <div key={`${v.color}/${v.size}`} style={{padding:6,borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,fontSize:10}}>
                  <div style={{fontWeight:600}}>{v.color} — {v.size}</div>
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
            <SC icon={DollarSign} label="Montant" value={`${totalReturnValue.toFixed(0)}€`} color={C.danger}/>
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
          <SC icon={DollarSign} label="Total remisé" value={`${totalDisc.toFixed(0)}€`} color={C.warn}/>
          <SC icon={TrendingUp} label="% ventes remisées" value={`${fTickets.length?(discounted.length/fTickets.length*100).toFixed(1):0}%`} color={C.info}/></div>
      </div>);})()}
  </div>);
}

/* ══════════ STOCK MATRIX ══════════ */
function StockScreen(){
  const{products,setProducts,stockAlerts,stockMoves,receiveStock,stockAging,reorderSuggestions,adjustStock,notify,findByEAN,users,addStockMove,addAudit,settings}=useApp();
  const[sel,setSel]=useState(products[0]?.id||"");const[tab,setTab]=useState("matrix");
  const[rcModal,setRcModal]=useState(false);const[rcProd,setRcProd]=useState("");const[rcVar,setRcVar]=useState("");const[rcQty,setRcQty]=useState("");const[rcSup,setRcSup]=useState("");
  const[adjProd,setAdjProd]=useState("");const[adjVar,setAdjVar]=useState("");const[adjQty,setAdjQty]=useState("");const[adjReason,setAdjReason]=useState("INVENTAIRE");
  const[invSearch,setInvSearch]=useState("");const[invCounts,setInvCounts]=useState({});
  const[stSearchMatrix,setStSearchMatrix]=useState("");const[stSearchReceipt,setStSearchReceipt]=useState("");const[stSearchAdj,setStSearchAdj]=useState("");
  const[csvStockModal,setCsvStockModal]=useState(false);const[csvStStep,setCsvStStep]=useState(0);const[csvStData,setCsvStData]=useState([]);const[csvStHeaders,setCsvStHeaders]=useState([]);const[csvStMapping,setCsvStMapping]=useState({});const[csvStPreview,setCsvStPreview]=useState([]);
  const[tenProd,setTenProd]=useState("");const[tenVar,setTenVar]=useState("");const[tenUser,setTenUser]=useState("");const[tenQty,setTenQty]=useState("1");
  const[trProd,setTrProd]=useState("");const[trVar,setTrVar]=useState("");const[trQty,setTrQty]=useState("1");const[trDest,setTrDest]=useState("");const[trRef,setTrRef]=useState("");
  const p=products.find(x=>x.id===sel);
  const sizes=[...new Set(p?.variants.map(v=>v.size)||[])].sort(sortSizes);const colors=[...new Set(p?.variants.map(v=>v.color)||[])].sort();
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>Stock</h2>
      {stockAlerts.length>0&&<Badge color={C.danger}>{stockAlerts.length} alertes</Badge>}
      <div style={{flex:1}}/>
      <Btn variant="outline" onClick={()=>setRcModal(true)}><Upload size={14}/> Réception</Btn></div>
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      {[{id:"matrix",l:"Matrice"},{id:"alerts",l:"Alertes"},{id:"moves",l:"Mouvements"},{id:"inventory",l:"Inventaire"},{id:"adjust",l:"Ajustement"},{id:"tenues",l:"Tenues"},{id:"transfers",l:"Transferts"},{id:"aging",l:"Vieillissement"},{id:"reorder",l:"Réassort"}].map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${tab===t.id?C.primary:C.border}`,
          background:tab===t.id?C.primary:"transparent",color:tab===t.id?"#fff":C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>{t.l}</button>))}</div>

    {tab==="matrix"&&<><Input value={stSearchMatrix} onChange={e=>setStSearchMatrix(e.target.value)} placeholder="Rechercher produit (nom, SKU)..." style={{marginBottom:6,height:32,fontSize:11,padding:"4px 10px"}}/>
      <select value={sel} onChange={e=>setSel(e.target.value)} style={{padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:12,marginBottom:12,fontFamily:"inherit"}}>
      {products.filter(p=>!stSearchMatrix||p.name.toLowerCase().includes(stSearchMatrix.toLowerCase())||p.sku.toLowerCase().includes(stSearchMatrix.toLowerCase())).map(p=>(<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}</select>
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

    {tab==="reorder"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Suggestions de réassort ({reorderSuggestions.length})</h3>
      {reorderSuggestions.length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight}}>Aucune suggestion — tous les stocks sont OK</div>}
      {reorderSuggestions.map((s,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderBottom:`1px solid ${C.border}`}}>
        <AlertTriangle size={14} color={s.currentStock===0?C.danger:C.warn}/>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{s.product.name} — {s.variant.color}/{s.variant.size}</div>
          <div style={{fontSize:10,color:C.textMuted}}>Stock actuel: {s.currentStock} | Seuil: {s.variant.stockAlert}{s.product.sku?` | Réf: ${s.product.sku}`:""}</div></div>
        <Badge color={C.info}>Commander: {s.suggestedQty}</Badge>
      </div>))}</div>}

    {tab==="adjust"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Ajustement de stock manuel</h3>
      <p style={{fontSize:11,color:C.textMuted,marginBottom:12}}>Inventaire, casse, perte, correction d'erreur…</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>PRODUIT</label>
          <Input value={stSearchAdj} onChange={e=>setStSearchAdj(e.target.value)} placeholder="Rechercher..." style={{marginBottom:4,height:28,fontSize:10,padding:"2px 8px"}}/>
          <select value={adjProd} onChange={e=>{setAdjProd(e.target.value);setAdjVar("");setAdjQty("");}} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
            <option value="">Sélectionner…</option>{products.filter(p=>!stSearchAdj||p.name.toLowerCase().includes(stSearchAdj.toLowerCase())||p.sku.toLowerCase().includes(stSearchAdj.toLowerCase())).map(p=>(<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}</select></div>
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
      <Input value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="Rechercher produit (nom, SKU)..." style={{marginBottom:10,height:32,fontSize:11,padding:"4px 10px"}}/>
      <div style={{maxHeight:400,overflowY:"auto",marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr style={{borderBottom:`2px solid ${C.border}`,position:"sticky",top:0,background:C.surface}}>
            {["Produit","Variante","EAN","Stock actuel","Stock compté","Écart"].map(h=>(<th key={h} style={{padding:6,textAlign:"left",fontSize:9,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
          <tbody>{products.filter(p=>!invSearch||p.name.toLowerCase().includes(invSearch.toLowerCase())||p.sku.toLowerCase().includes(invSearch.toLowerCase())).flatMap(p=>
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
        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn variant="outline" onClick={()=>{setCsvStockModal(true);setCsvStStep(0);setCsvStData([]);}} style={{fontSize:10,padding:"4px 10px"}}><Upload size={11}/> Import CSV stock</Btn></div>
        <Input value={stSearchReceipt} onChange={e=>setStSearchReceipt(e.target.value)} placeholder="Rechercher produit..." style={{height:28,fontSize:10,padding:"2px 8px"}}/>
        <select value={rcProd} onChange={e=>{setRcProd(e.target.value);setRcVar("");}} style={{padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
          <option value="">Sélectionner un produit</option>{products.filter(p=>!stSearchReceipt||p.name.toLowerCase().includes(stSearchReceipt.toLowerCase())||p.sku.toLowerCase().includes(stSearchReceipt.toLowerCase())).map(p=>(<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}</select>
        {rcProd&&<select value={rcVar} onChange={e=>setRcVar(e.target.value)} style={{padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
          <option value="">Variante</option>{products.find(x=>x.id===rcProd)?.variants.map(v=>(<option key={v.id} value={v.id}>{v.color}/{v.size} (stock: {v.stock})</option>))}</select>}
        <Input type="number" value={rcQty} onChange={e=>setRcQty(e.target.value)} placeholder="Quantité reçue"/>
        <Input value={rcSup} onChange={e=>setRcSup(e.target.value)} placeholder="Fournisseur"/></div>
      <Btn onClick={()=>{if(rcProd&&rcVar&&rcQty){receiveStock(rcProd,rcVar,parseInt(rcQty),rcSup||"Non spécifié");setRcModal(false);setRcQty("");setRcSup("");}}}
        style={{width:"100%",height:40,background:C.primary}}><Upload size={14}/> Enregistrer la réception</Btn></Modal>

    {/* CSV Stock Import Modal */}
    <Modal open={csvStockModal} onClose={()=>setCsvStockModal(false)} title="Import CSV - Réception stock" wide>
      {csvStStep===0&&<div style={{textAlign:"center",padding:20}}>
        <Upload size={32} color={C.primary} style={{marginBottom:10}}/>
        <p style={{fontSize:12,color:C.textMuted,marginBottom:12}}>CSV avec colonnes: sku (ou ean), quantité, fournisseur</p>
        <input type="file" accept=".csv,.txt" onChange={e=>{const file=e.target.files[0];if(!file)return;
          Papa.parse(file,{header:true,skipEmptyLines:true,complete:(r)=>{if(!r.data.length)return;
            setCsvStHeaders(r.meta.fields||[]);setCsvStData(r.data);
            const map={};(r.meta.fields||[]).forEach(h=>{const hl=h.toLowerCase().trim();
              if(["sku","ref","reference","référence","code"].includes(hl))map[h]="sku";
              if(["ean","ean13","barcode","code_barre"].includes(hl))map[h]="ean";
              if(["quantity","quantite","quantité","qty","qte"].includes(hl))map[h]="quantity";
              if(["supplier","fournisseur","source"].includes(hl))map[h]="supplier";});
            setCsvStMapping(map);setCsvStStep(1);}});}} style={{fontSize:12}}/></div>}
      {csvStStep===1&&<div>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Associer les colonnes</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
          {csvStHeaders.map(h=>(<div key={h} style={{display:"flex",alignItems:"center",gap:6,padding:6,borderRadius:8,background:C.surfaceAlt}}>
            <span style={{fontSize:11,fontWeight:600,flex:1}}>{h}</span>
            <select value={csvStMapping[h]||""} onChange={e=>{const v=e.target.value;setCsvStMapping(p=>{const n={...p};if(!v)delete n[h];else n[h]=v;return n;});}}
              style={{padding:4,borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,fontFamily:"inherit"}}>
              <option value="">— ignorer —</option><option value="sku">SKU</option><option value="ean">EAN</option>
              <option value="quantity">Quantité</option><option value="supplier">Fournisseur</option></select></div>))}</div>
        <Btn onClick={()=>{const rows=csvStData.map(row=>{const getF=(f)=>{const h=Object.entries(csvStMapping).find(([k,v])=>v===f);return h?row[h[0]]?.trim()||"":"";};
          const sku=getF("sku");const ean=getF("ean");const qty=parseInt(getF("quantity"))||0;const sup=getF("supplier");
          let match=null;for(const p of products){for(const v of p.variants){if((ean&&v.ean===ean)||(sku&&p.sku===sku)){match={product:p,variant:v};break;}}if(match)break;}
          return{sku,ean,qty,supplier:sup,match,status:match?"found":"not_found"};});setCsvStPreview(rows);setCsvStStep(2);}}
          style={{width:"100%",height:36}}><Search size={12}/> Prévisualiser</Btn></div>}
      {csvStStep===2&&<div>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Aperçu ({csvStPreview.filter(r=>r.status==="found").length}/{csvStPreview.length} trouvés)</div>
        <div style={{maxHeight:300,overflowY:"auto",marginBottom:12}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
            <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
              {["SKU/EAN","Produit","Variante","Qté","Fournisseur","Statut"].map(h=>(<th key={h} style={{padding:4,textAlign:"left",fontSize:9,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
            <tbody>{csvStPreview.map((r,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:r.status==="found"?"transparent":C.dangerLight}}>
              <td style={{padding:4,fontFamily:"monospace"}}>{r.sku||r.ean}</td>
              <td style={{padding:4,fontWeight:600}}>{r.match?.product.name||"—"}</td>
              <td style={{padding:4}}>{r.match?`${r.match.variant.color}/${r.match.variant.size}`:"—"}</td>
              <td style={{padding:4,fontWeight:700}}>{r.qty}</td><td style={{padding:4}}>{r.supplier}</td>
              <td style={{padding:4}}>{r.status==="found"?<Badge color="#059669">Trouvé</Badge>:<Badge color={C.danger}>Non trouvé</Badge>}</td></tr>))}</tbody></table></div>
        <Btn onClick={()=>{csvStPreview.filter(r=>r.status==="found"&&r.qty>0).forEach(r=>{
          receiveStock(r.match.product.id,r.match.variant.id,r.qty,r.supplier||"Import CSV");});
          setCsvStockModal(false);setCsvStStep(0);}}
          style={{width:"100%",height:40,background:C.primary}}><Upload size={14}/> Réceptionner {csvStPreview.filter(r=>r.status==="found"&&r.qty>0).length} ligne(s)</Btn></div>}
    </Modal>

    {tab==="tenues"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Sortie stock — Tenue employé</h3>
      <div style={{padding:10,background:C.warnLight,borderRadius:8,marginBottom:12,fontSize:11,color:"#92400E",border:`1px solid ${C.warn}33`}}>
        Les articles sortis en tenue employé sont retirés du stock magasin et tracés dans les mouvements.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>PRODUIT</label>
          <select value={tenProd} onChange={e=>{setTenProd(e.target.value);setTenVar("");}} style={{width:"100%",padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}}>
            <option value="">Sélectionner…</option>
            {products.map(p=>(<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}</select></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>VARIANTE</label>
          <select value={tenVar} onChange={e=>setTenVar(e.target.value)} style={{width:"100%",padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}}>
            <option value="">Sélectionner…</option>
            {(products.find(p=>p.id===tenProd)?.variants||[]).map(v=>(<option key={v.id} value={v.id}>{v.color} / {v.size} (stock: {v.stock})</option>))}</select></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>EMPLOYÉ</label>
          <select value={tenUser} onChange={e=>setTenUser(e.target.value)} style={{width:"100%",padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}}>
            <option value="">Sélectionner…</option>
            {(users||[]).map(u=>(<option key={u.id} value={u.name}>{u.name}</option>))}</select></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>QUANTITÉ</label>
          <Input type="number" value={tenQty} onChange={e=>setTenQty(e.target.value)} min="1" style={{height:36}}/></div></div>
      <Btn onClick={async()=>{if(!tenProd||!tenVar||!tenUser){notify("Remplissez tous les champs","error");return;}
        const q=parseInt(tenQty)||1;const prod=products.find(p=>p.id===tenProd);const vari=prod?.variants.find(v=>v.id===tenVar);
        if(!prod||!vari){notify("Produit introuvable","error");return;}
        try{await API.stock.adjust({productId:tenProd,variantId:tenVar,quantity:-q,reason:`Tenue employé: ${tenUser}`});
          const prods=await API.products.list();setProducts(norm.products(prods));}
        catch(e){setProducts(prev=>prev.map(p=>p.id===tenProd?{...p,variants:p.variants.map(v=>v.id===tenVar?{...v,stock:Math.max(0,v.stock-q)}:v)}:p));}
        addStockMove("TENUE",prod,vari,-q,`Tenue ${tenUser}`);
        addAudit("TENUE",`${prod.name} ${vari.color}/${vari.size} x${q} — ${tenUser}`);
        notify(`${prod.name} ${vari.color}/${vari.size} x${q} sorti en tenue pour ${tenUser}`,"success");
        setTenProd("");setTenVar("");setTenUser("");setTenQty("1");}}
        style={{width:"100%",height:44,background:C.accent}}>Sortir en tenue employé</Btn>
      <div style={{marginTop:16,fontSize:12,fontWeight:700,marginBottom:8}}>Historique tenues</div>
      {stockMoves.filter(m=>m.type==="TENUE").length===0&&<div style={{color:C.textLight,fontSize:11}}>Aucune sortie tenue</div>}
      {stockMoves.filter(m=>m.type==="TENUE").slice(0,20).map((m,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:6,borderBottom:`1px solid ${C.border}`,fontSize:11}}>
        <span style={{color:C.textMuted,fontSize:9}}>{new Date(m.date).toLocaleDateString("fr-FR")}</span>
        <span style={{fontWeight:600}}>{m.productName}</span>
        <span style={{color:C.textMuted}}>{m.variantColor}/{m.variantSize}</span>
        <span style={{fontWeight:700,color:C.danger}}>x{Math.abs(m.qty)}</span>
        <span style={{color:C.accent,fontWeight:600}}>{m.ref}</span></div>))}</div>}

    {tab==="transfers"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Transfert de stock</h3>
      <div style={{padding:10,background:C.primaryLight,borderRadius:8,marginBottom:12,fontSize:11,color:C.primaryDark,border:`1px solid ${C.primary}22`}}>
        Transférez du stock vers un autre magasin ou une entité externe. Un justificatif est généré automatiquement.</div>
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

/* ══════════ HISTORY ══════════ */
function HistoryScreen(){
  const{tickets,avoirs,settings,processReturn,perm:p,printerConnected,thermalPrint,setAvoirPayment,setMode,notify,customers}=useApp();
  const[tab,setTab]=useState("tickets");const[reprintTk,setReprintTk]=useState(null);const[reassignModal,setReassignModal]=useState(null);const[reassignCust,setReassignCust]=useState(null);
  const[search,setSearch]=useState("");const[dateFilter,setDateFilter]=useState("");
  const[returnModal,setReturnModal]=useState(null);
  const[returnItems,setReturnItems]=useState([]);const[returnReason,setReturnReason]=useState("");const[returnMethod,setReturnMethod]=useState("cash");
  const[avoirDetail,setAvoirDetail]=useState(null);
  const[page,setPage]=useState(0);const PAGE_SIZE=25;
  const[debugClick,setDebugClick]=useState(null);
  const[testModal,setTestModal]=useState(false);

  useEffect(()=>{setPage(0);},[search,dateFilter]);
  const filteredTickets=useMemo(()=>tickets.filter(t=>{
    const q=search.toLowerCase();
    const matchSearch=!q||(t.ticketNumber||"").toLowerCase().includes(q)||(t.customerName||"").toLowerCase().includes(q)||(t.userName||t.user_name||"").toLowerCase().includes(q);
    const matchDate=!dateFilter||(t.date||t.createdAt||t.created_at||"").startsWith(dateFilter);
    return matchSearch&&matchDate;
  }),[tickets,search,dateFilter]);
  const totalPages=Math.ceil(filteredTickets.length/PAGE_SIZE);
  const pagedTickets=filteredTickets.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);

  const openReturn=(ticket)=>{
    setReturnModal(ticket);
    // C4 fix: Check already-returned quantities from existing avoirs for this ticket
    const existingAvoirs=avoirs.filter(a=>a.originalTicket===ticket.ticketNumber);
    const returnedQtys={};
    existingAvoirs.forEach(a=>(a.items||[]).forEach(ai=>{const key=`${ai.productId||ai.product?.id}-${ai.variantId||ai.variant?.id}`;returnedQtys[key]=(returnedQtys[key]||0)+(ai.qty||ai.quantity||0);}));
    const items=(ticket.items||[]).map(i=>{const pid=i.product?.id||i.product_id;const vid=i.variant?.id||i.variant_id;
      const alreadyReturned=returnedQtys[`${pid}-${vid}`]||0;const remaining=Math.max(0,i.quantity-alreadyReturned);
      return{productId:pid,variantId:vid,
      name:i.product?.name||i.product_name,sku:i.product?.sku||i.product_sku||"",ean:i.variant?.ean||i.variant_ean||"",color:i.variant?.color||i.variant_color,size:i.variant?.size||i.variant_size,
      maxQty:remaining,qty:0,alreadyReturned,unitTTC:(i.lineTTC||i.line_ttc||(i.unit_price*i.quantity))/i.quantity};}).filter(i=>i.maxQty>0);
    setReturnItems(items);
    setReturnReason("");setReturnMethod("cash");
  };
  const returnTotal=returnItems.reduce((s,i)=>s+i.qty*i.unitTTC,0);

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:14}}>Historique fiscal</h2>
    <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center"}}>
      <Btn variant={tab==="tickets"?"primary":"outline"} onClick={()=>setTab("tickets")} style={{fontSize:11}}>Tickets ({tickets.length})</Btn>
      <Btn variant={tab==="avoirs"?"danger":"outline"} onClick={()=>setTab("avoirs")} style={{fontSize:11}}>Avoirs ({avoirs.length})</Btn>
      <div style={{flex:1}}/>
      <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher N°, client, caissier…" style={{width:220,height:32,fontSize:11,padding:"4px 10px"}}/>
      <Input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={{width:140,height:32,fontSize:11,padding:"4px 10px"}}/>
      <Btn variant="outline" onClick={()=>setTestModal(true)} style={{fontSize:10,padding:"4px 10px",background:"#7C3AED",color:"#fff"}}>Test Modal</Btn></div>
    {debugClick&&<div style={{background:"#DCFCE7",border:"2px solid #16A34A",borderRadius:8,padding:8,marginBottom:8,fontSize:10,fontFamily:"monospace"}}>
      <strong>CLIC DETECTE:</strong> {debugClick} <button onClick={()=>setDebugClick(null)} style={{marginLeft:8,fontSize:10}}>X</button></div>}

    {tab==="tickets"&&(<>{pagedTickets.length?pagedTickets.map((t,idx)=>(
      <div key={t.ticketNumber||t.id||idx} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:12,background:C.surface,border:`1.5px solid ${C.border}`,marginBottom:5,transition:"all 0.12s"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary+"44"} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
        <Receipt size={14} color={C.textMuted}/>
        <div style={{flex:1,cursor:"pointer"}} onClick={()=>{
          const tkId=t.ticketNumber||t.ticket_number||"?";
          const keys=Object.keys(t).join(",");
          setDebugClick(`Ticket #${tkId} | keys: ${keys.substring(0,80)}`);
          console.log("[TICKET CLICK]",tkId,keys);
          try{setReprintTk({...t});}catch(e){
            setDebugClick(`CRASH: ${e.message}`);
          }
        }}>
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

    {/* TEST MODAL — ultra simple, to verify Modal works on Capacitor */}
    <Modal open={testModal} onClose={()=>setTestModal(false)} title="Test Modal">
      <div style={{padding:10}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>Si tu vois ce message, le Modal fonctionne!</div>
        <div style={{fontSize:11,color:"#666",marginBottom:10}}>reprintTk = {reprintTk?"OUI ("+Object.keys(reprintTk).length+" keys)":"null"}</div>
        {reprintTk&&<div style={{fontSize:10,fontFamily:"monospace",background:"#F1F5F9",padding:8,borderRadius:6,maxHeight:200,overflow:"auto",wordBreak:"break-all"}}>
          {JSON.stringify(reprintTk,null,1).substring(0,1000)}
        </div>}
        <Btn onClick={()=>setTestModal(false)} style={{marginTop:10,width:"100%"}}>Fermer</Btn>
      </div>
    </Modal>

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
        <div data-print-receipt style={{fontFamily:"'Courier New',monospace",fontSize:10,background:"#FAFAF8",borderRadius:10,padding:16,border:`1px solid ${C.border}`}}>
        <div style={{textAlign:"center",marginBottom:6}}><div style={{fontSize:12,fontWeight:700}}>{settings.name||CO.name}</div>
          <div>{settings.address}, {settings.postalCode} {settings.city}</div>
          <div>SIRET: {settings.siret||CO.siret} — TVA: {settings.tvaIntra||CO.tvaIntra}</div></div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>N° {tkNum}</span><span>{tkDateStr}</span></div>
        <div>Caissier: {tkUser}{tkCust?` — Client: ${tkCust}`:""}</div>
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
          <span style={{whiteSpace:"nowrap",fontWeight:600}}>{lineAmt.toFixed(2)}€</span></div>
          {(sku||ean)&&<div style={{fontSize:8,color:"#999"}}>{sku?`Réf: ${sku}`:""}{sku&&ean?" — ":""}{ean?`EAN: ${ean}`:""}</div>}
        </div>);})}
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        {tkDisc>0&&<div style={{display:"flex",justifyContent:"space-between",color:"#059669"}}><span>Remise</span><span>-{tkDisc.toFixed(2)}€</span></div>}
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Total HT</span><span>{tkHT.toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>TVA</span><span>{tkTVA.toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,marginTop:3}}><span>TOTAL TTC</span><span>{tkTTC.toFixed(2)}€</span></div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        <div>Paiement: {tkPayments.map(pm=>`${({cash:"ESP",card:"CB",amex:"AMEX",giftcard:"CAD",cheque:"CHQ",avoir:"AVOIR"})[pm.method]||pm.method} ${(Number(pm.amount)||0).toFixed(2)}€`).join(" + ")||tkPayMethod}</div>
        {tkFp&&<div style={{textAlign:"center",background:C.fiscalLight,padding:6,borderRadius:6,margin:"6px 0"}}>
          <div style={{fontSize:8,color:C.fiscal,fontWeight:700}}>EMPREINTE NF525</div>
          <div style={{fontSize:11,fontWeight:700,color:C.fiscal,letterSpacing:2}}>{tkFp}</div></div>}
        <div style={{textAlign:"center",fontSize:8,color:C.textMuted}}>{CO.sw} v{CO.ver} — Conforme NF525<br/>{settings.footerMsg||CO.footerMsg}</div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <Btn variant="outline" onClick={()=>thermalPrint("receipt",tk)} style={{flex:1}}><Printer size={14}/> {printerConnected?"Ticket":"Réimprimer"}</Btn>
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
              <div style={{fontSize:10,color:C.textMuted}}>{ri.color}/{ri.size} — {ri.unitTTC.toFixed(2)}€/u — max: {ri.maxQty}{ri.sku?` — Réf: ${ri.sku}`:""}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <button onClick={()=>setReturnItems(p=>p.map((x,i)=>i===idx?{...x,qty:Math.max(0,x.qty-1)}:x))}
                style={{width:26,height:26,borderRadius:13,border:`1px solid ${C.border}`,background:C.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Minus size={11}/></button>
              <span style={{width:24,textAlign:"center",fontSize:13,fontWeight:700,color:ri.qty>0?C.danger:C.text}}>{ri.qty}</span>
              <button onClick={()=>setReturnItems(p=>p.map((x,i)=>i===idx?{...x,qty:Math.min(x.maxQty,x.qty+1)}:x))}
                style={{width:26,height:26,borderRadius:13,border:`1px solid ${C.border}`,background:C.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Plus size={11}/></button>
              <Btn variant="ghost" onClick={()=>setReturnItems(p=>p.map((x,i)=>i===idx?{...x,qty:x.maxQty}:x))} style={{fontSize:9,padding:"2px 6px"}}>Tout</Btn>
            </div>
            <div style={{width:60,textAlign:"right",fontSize:12,fontWeight:700,color:ri.qty>0?C.danger:C.textLight}}>
              {ri.qty>0?`-${(ri.qty*ri.unitTTC).toFixed(2)}€`:"—"}</div>
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
          <span style={{fontSize:16,fontWeight:800,color:C.danger}}>{returnTotal.toFixed(2)}€</span></div>
        <Btn variant="danger" disabled={returnTotal===0||!returnReason} onClick={async()=>{
          const avoir=await processReturn(returnModal,returnItems.filter(i=>i.qty>0),returnReason,returnMethod==="exchange"?"avoir":returnMethod);
          if(avoir&&returnMethod==="exchange"){setAvoirPayment(avoir.totalTTC);setMode("cashier");notify(`Avoir ${avoir.avoirNumber} de ${avoir.totalTTC.toFixed(2)}€ appliqué — Scannez les nouveaux articles`,"success");}
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
function ReturnScreen(){
  const{tickets,products,processReturn,findByEAN,avoirs,settings,notify,printerConnected,thermalPrint,setAvoirPayment,setMode:setAppMode}=useApp();
  const[mode,setMode]=useState("ticket");// ticket | scan | free
  const[searchTk,setSearchTk]=useState("");const[selectedTk,setSelectedTk]=useState(null);
  const[returnItems,setReturnItems]=useState([]);const[reason,setReason]=useState("Échange taille");
  const[refundMethod,setRefundMethod]=useState("avoir");const[restock,setRestock]=useState(true);const[defective,setDefective]=useState(false);
  const[searchProd,setSearchProd]=useState("");const[freeItem,setFreeItem]=useState(null);const[freeQty,setFreeQty]=useState(1);
  const[lastAvoir,setLastAvoir]=useState(null);
  // C5 fix: Manager approval required for free/scan returns
  const[managerApproved,setManagerApproved]=useState(false);const[managerPinInput,setManagerPinInput]=useState("");const[managerPinError,setManagerPinError]=useState("");
  const verifyManagerPin=async()=>{const admin=users.find(u=>u.role==="admin");
    if(!admin){setManagerPinError("Aucun admin trouvé");return;}
    const ok=await verifyPin(managerPinInput,admin.pin);
    if(ok){setManagerApproved(true);setManagerPinError("");setManagerPinInput("");addAudit("MANAGER_APPROVE","Approbation manager pour retour libre/scan");}
    else{setManagerPinError("PIN manager incorrect");}};
  const REASONS=["Échange taille","Échange couleur","Défectueux","N'aime plus","Cadeau à retourner","Erreur de commande","Autre"];
  const REFUND_METHODS=[{id:"avoir",l:"Avoir / Crédit magasin",i:Gift,d:"Génère un avoir utilisable en caisse"},
    {id:"cash",l:"Remboursement espèces",i:Banknote,d:"Remboursement immédiat en liquide"},
    {id:"card",l:"Remboursement carte",i:CreditCard,d:"Remboursement sur la carte du client"},
    {id:"exchange",l:"Échange immédiat",i:RotateCcw,d:"Retour + nouvelle vente, payer la différence"}];

  const foundTickets=useMemo(()=>{if(!searchTk||searchTk.length<2)return[];const q=searchTk.toLowerCase();
    return tickets.filter(t=>(t.ticketNumber||"").toLowerCase().includes(q)||(t.customerName||"").toLowerCase().includes(q))
      .slice(0,10);},[tickets,searchTk]);

  const foundProducts=useMemo(()=>{if(!searchProd||searchProd.length<2)return[];const q=searchProd.toLowerCase();
    return products.filter(p=>p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)||p.variants.some(v=>(v.ean||"").includes(q)))
      .slice(0,8);},[products,searchProd]);

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
        qty:1,maxQty:mode==="ticket"?effectiveMax:(maxQty||item.quantity),unitPrice:item.lineTTC?item.lineTTC/item.quantity:(item.unit_price||0)}];});};
  const updateReturnQty=(key,qty)=>setReturnItems(prev=>prev.map(r=>r.key===key?{...r,qty:Math.min(Math.max(1,qty),r.maxQty)}:r));
  const returnTotal=returnItems.reduce((s,r)=>s+r.unitPrice*r.qty,0);

  const doReturn=async()=>{if(!returnItems.length){notify("Sélectionnez au moins un article","error");return;}
    const items=returnItems.map(r=>({productId:r.productId,variantId:r.variantId,qty:r.qty}));
    // Construire le ticket synthétique pour scan/free avec le bon taux de TVA par produit
    const syntheticTicket=selectedTk||{ticketNumber:"RETOUR-LIBRE",date:new Date().toISOString(),items:returnItems.map(r=>{
      const prod=products.find(p=>p.id===r.productId);const taxRate=prod?.taxRate||0.20;const pm=settings.pricingMode||"TTC";
      const lineTTC=r.unitPrice*r.maxQty;
      const lineHT=pm==="TTC"?lineTTC/(1+taxRate):lineTTC;
      const lineTVA=lineHT*taxRate;
      return{product:{id:r.productId,name:r.productName,taxRate},variant:{id:r.variantId,color:r.variantColor,size:r.variantSize},
        quantity:r.maxQty,lineHT,lineTVA,lineTTC:lineHT+lineTVA};})};
    const avoir=await processReturn(syntheticTicket,items,reason,refundMethod==="exchange"?"avoir":refundMethod,restock,defective);
    if(avoir){
      if(refundMethod==="exchange"){
        setAvoirPayment(avoir.totalTTC);
        setAppMode("cashier");
        notify(`Avoir ${avoir.avoirNumber} de ${avoir.totalTTC.toFixed(2)}€ appliqué — Scannez les nouveaux articles`,"success");
        setReturnItems([]);setSelectedTk(null);setSearchTk("");setSearchProd("");setFreeItem(null);
      } else {
        setLastAvoir(avoir);setReturnItems([]);setSelectedTk(null);setSearchTk("");setSearchProd("");setFreeItem(null);
      }
    }};

  const returnWindow=settings.returnPolicy?.days||30;
  const isExpired=(tk)=>{if(!tk)return false;const d=new Date(tk.date||tk.createdAt||tk.created_at);
    return(Date.now()-d.getTime())/(1000*60*60*24)>returnWindow;};

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>Retours & Avoirs</h2>
      <div style={{display:"flex",gap:6}}>
        <Badge color={C.fiscal}>{avoirs.length} avoir{avoirs.length>1?"s":""}</Badge>
        <Badge color={C.textMuted}>Délai: {returnWindow}j</Badge></div></div>

    {/* Mode tabs */}
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {[{id:"ticket",l:"Par ticket de caisse",i:Receipt},{id:"scan",l:"Par scan / recherche produit",i:ScanLine},{id:"free",l:"Retour libre (sans ticket)",i:Edit}].map(m=>(
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
                <span style={{fontSize:13,fontWeight:700,color:C.primary}}>{(item.lineTTC||item.line_ttc||(item.unit_price*item.quantity)).toFixed(2)}€</span>
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
              return(<div key={v.id} onClick={()=>toggleItem({product:p,variant:v,quantity:99,lineTTC:p.price,unit_price:p.price},v,99)}
                style={{display:"flex",alignItems:"center",gap:10,padding:8,borderRadius:8,border:`1.5px solid ${selected?C.primary:C.border}`,
                  marginBottom:3,cursor:"pointer",background:selected?C.primaryLight+"50":"transparent"}}>
                {selected?<CheckCircle2 size={16} color={C.primary}/>:<div style={{width:16,height:16,borderRadius:8,border:`2px solid ${C.border}`}}/>}
                <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:9,color:C.textMuted}}>{v.color}/{v.size} — SKU: {p.sku}{v.ean?` — EAN: ${v.ean}`:""}</div></div>
                <span style={{fontSize:12,fontWeight:700,color:C.primary}}>{p.price.toFixed(2)}€</span>
              </div>);})}</div>))}</div>}

        {mode==="free"&&(managerApproved||currentUser?.role==="admin")&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4}}>RETOUR LIBRE — RECHERCHER DANS LE CATALOGUE</label>
          <Input value={searchProd} onChange={e=>setSearchProd(e.target.value)} placeholder="Nom, SKU ou scanner…" style={{marginBottom:8,height:40}}/>
          <div style={{padding:8,background:C.warnLight,borderRadius:8,marginBottom:10,fontSize:11,color:"#92400E",border:`1px solid ${C.warn}33`}}>
            <AlertTriangle size={12} style={{verticalAlign:"middle",marginRight:4}}/> Retour sans ticket — approbation manager recommandée</div>
          {foundProducts.map(p=>(<div key={p.id}>
            {p.variants.map(v=>{const key=`${p.id}-${v.id}`;const selected=returnItems.find(r=>r.key===key);
              return(<div key={v.id} onClick={()=>toggleItem({product:p,variant:v,quantity:99,lineTTC:p.price,unit_price:p.price},v,99)}
                style={{display:"flex",alignItems:"center",gap:10,padding:8,borderRadius:8,border:`1.5px solid ${selected?C.primary:C.border}`,
                  marginBottom:3,cursor:"pointer",background:selected?C.primaryLight+"50":"transparent"}}>
                {selected?<CheckCircle2 size={16} color={C.primary}/>:<div style={{width:16,height:16,borderRadius:8,border:`2px solid ${C.border}`}}/>}
                <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:9,color:C.textMuted}}>{v.color}/{v.size}</div></div>
                <span style={{fontSize:12,fontWeight:700,color:C.primary}}>{p.price.toFixed(2)}€</span>
              </div>);})}</div>))}</div>}

        {/* Historique avoirs */}
        {!returnItems.length&&!selectedTk&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginTop:14}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>Avoirs émis ({avoirs.length})</div>
          {avoirs.length===0&&<div style={{color:C.textLight,fontSize:11}}>Aucun avoir</div>}
          {avoirs.slice(0,15).map(a=>(<div key={a.avoirNumber} style={{display:"flex",alignItems:"center",gap:10,padding:8,borderBottom:`1px solid ${C.border}`}}>
            <RotateCcw size={13} color={C.fiscal}/>
            <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600}}>{a.avoirNumber}</div>
              <div style={{fontSize:9,color:C.textMuted}}>{new Date(a.date).toLocaleDateString("fr-FR")} — Réf: {a.originalTicket} — {a.reason} — {a.refundMethod}</div></div>
            <span style={{fontSize:12,fontWeight:700,color:C.danger}}>-{a.totalTTC.toFixed(2)}€</span>
          </div>))}</div>}
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
          <span style={{fontSize:12,fontWeight:700,color:C.danger,minWidth:60,textAlign:"right"}}>{(r.unitPrice*r.qty).toFixed(2)}€</span>
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

        <Btn onClick={doReturn} style={{width:"100%",height:44,background:C.fiscal,fontSize:13}}>
          <RotateCcw size={16}/> Valider le retour — {returnTotal.toFixed(2)}€</Btn>
      </div>}
    </div>

    {/* Avoir confirmation */}
    <Modal open={!!lastAvoir} onClose={()=>setLastAvoir(null)} title="Avoir émis">
      {lastAvoir&&<div style={{textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:32,background:C.fiscal,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:10,
          boxShadow:`0 8px 24px ${C.fiscal}35`}}><CheckCircle2 size={32} color="#fff"/></div>
        <div style={{fontSize:20,fontWeight:900,color:C.fiscal,marginBottom:4}}>{lastAvoir.avoirNumber}</div>
        <div style={{fontSize:14,color:C.text,marginBottom:4}}>Montant: <strong>{lastAvoir.totalTTC.toFixed(2)}€</strong></div>
        <div style={{fontSize:12,color:C.textMuted,marginBottom:4}}>Motif: {lastAvoir.reason} — Mode: {lastAvoir.refundMethod}</div>
        <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>Réf. ticket: {lastAvoir.originalTicket}</div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="outline" onClick={()=>thermalPrint("avoir",lastAvoir)} style={{flex:1}}><Printer size={14}/> Imprimer</Btn>
          <Btn variant="success" onClick={()=>setLastAvoir(null)} style={{flex:1}}><CheckCircle2 size={14}/> Terminé</Btn></div>
      </div>}</Modal>
  </div>);
}

/* ══════════ CLOSURE ══════════ */
function ClosureScreen(){
  const{tickets,cashReg,closures,createClosure,gt,closeReg,perm:p,avoirs,settings,printerConnected,thermalPrint,notify}=useApp();
  const[aCash,setACash]=useState("");const[aCard,setACard]=useState("");
  const[reportModal,setReportModal]=useState(null);
  const[denomMode,setDenomMode]=useState(false);
  const bills=[500,200,100,50,20,10,5];const coins=[2,1,0.5,0.2,0.1,0.05,0.02,0.01];
  const[denomCounts,setDenomCounts]=useState(()=>{const o={};[...bills,...coins].forEach(d=>o[d]=0);return o;});
  const denomTotal=useMemo(()=>Object.entries(denomCounts).reduce((s,[d,c])=>s+parseFloat(d)*c,0),[denomCounts]);
  const setDenom=(d,v)=>{setDenomCounts(p=>({...p,[d]:Math.max(0,parseInt(v)||0)}));};
  useEffect(()=>{if(denomMode)setACash(denomTotal.toFixed(2));},[denomMode,denomTotal]);
  if(!p().canCloseZ)return<div style={{padding:40,textAlign:"center",color:C.textMuted}}>Accès réservé aux administrateurs</div>;
  const today=new Date().toISOString().split("T")[0];const pt=tickets.filter(t=>(t.date||t.createdAt||t.created_at||"").startsWith(today));
  const todayAvoirs=avoirs.filter(a=>(a.date||a.createdAt||"").startsWith(today));
  const cash=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="cash").reduce((a,p)=>a+p.amount,0)||0),0);
  const card=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="card").reduce((a,p)=>a+p.amount,0)||0),0);
  const cheque=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="cheque").reduce((a,p)=>a+p.amount,0)||0),0);
  const giftcard=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="giftcard").reduce((a,p)=>a+p.amount,0)||0),0);
  const totalTTC=pt.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0);const totalHT=pt.reduce((s,t)=>s+(t.totalHT||parseFloat(t.total_ht)||0),0);
  const totalTVA=pt.reduce((s,t)=>s+(t.totalTVA||parseFloat(t.total_tva)||0),0);const totalMargin=pt.reduce((s,t)=>s+(parseFloat(t.margin)||0),0);
  const totalReturns=todayAvoirs.reduce((s,a)=>s+(a.totalTTC||parseFloat(a.total_ttc)||0),0);
  const expected=(cashReg?.openingAmount||0)+cash;
  const cashDiff=aCash?(parseFloat(aCash)-expected):null;
  const cardDiff=aCard?(parseFloat(aCard)-card):null;

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:14}}>Clôture Z</h2>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>
      <SC icon={Receipt} label="Tickets" value={pt.length} color={C.info}/>
      <SC icon={Banknote} label="Espèces" value={`${cash.toFixed(2)}€`} color={C.primary}/>
      <SC icon={CreditCard} label="Carte" value={`${card.toFixed(2)}€`} color={C.info}/>
      <SC icon={TrendingUp} label="Marge" value={`${totalMargin.toFixed(0)}€`} color="#059669"/>
      <SC icon={RotateCcw} label="Retours" value={`-${totalReturns.toFixed(2)}€`} color={C.danger}/></div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      <div style={{background:C.fiscalLight,borderRadius:10,padding:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:700,color:C.fiscal}}>GT PERPÉTUEL</span>
        <span style={{fontSize:18,fontWeight:800,color:C.fiscal}}>{gt.toFixed(2)}€</span></div>
      <div style={{background:C.primaryLight,borderRadius:10,padding:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:700,color:C.primary}}>CA NET DU JOUR</span>
        <span style={{fontSize:18,fontWeight:800,color:C.primary}}>{(totalTTC-totalReturns).toFixed(2)}€</span></div></div>

    <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <span style={{fontSize:14,fontWeight:700}}>Comptage espèces</span>
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          <button onClick={()=>setDenomMode(false)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${!denomMode?C.accent:C.border}`,background:!denomMode?C.accentLight:"transparent",
            cursor:"pointer",fontSize:11,fontWeight:600,color:!denomMode?C.accent:C.textMuted}}>Montant rapide</button>
          <button onClick={()=>{setDenomMode(true);const o={};[...bills,...coins].forEach(d=>o[d]=0);setDenomCounts(o);}} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${denomMode?C.accent:C.border}`,background:denomMode?C.accentLight:"transparent",
            cursor:"pointer",fontSize:11,fontWeight:600,color:denomMode?C.accent:C.textMuted}}>Compter les coupures</button></div></div>

      {denomMode?<>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,marginBottom:6}}>BILLETS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {bills.map(d=>(<div key={d} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 8px",borderRadius:10,border:`1.5px solid ${denomCounts[d]>0?C.accent:C.border}`,background:denomCounts[d]>0?C.accentLight+"60":"transparent"}}>
              <span style={{fontSize:10,fontWeight:700,color:C.accent,minWidth:36}}>{d}€</span>
              <span style={{fontSize:9,color:C.textMuted}}>×</span>
              <input type="number" min="0" value={denomCounts[d]||""} onChange={e=>setDenom(d,e.target.value)}
                style={{width:40,padding:"3px 4px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontWeight:700,textAlign:"center",fontFamily:"inherit"}}/>
              <span style={{fontSize:9,color:C.textMuted,marginLeft:"auto"}}>{(d*(denomCounts[d]||0)).toFixed(0)}€</span>
            </div>))}</div></div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,marginBottom:6}}>PIÈCES</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {coins.map(d=>(<div key={d} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 8px",borderRadius:10,border:`1.5px solid ${denomCounts[d]>0?C.info:C.border}`,background:denomCounts[d]>0?`${C.info}10`:"transparent"}}>
              <span style={{fontSize:10,fontWeight:700,color:C.info,minWidth:36}}>{d>=1?d+"€":(d*100).toFixed(0)+"c"}</span>
              <span style={{fontSize:9,color:C.textMuted}}>×</span>
              <input type="number" min="0" value={denomCounts[d]||""} onChange={e=>setDenom(d,e.target.value)}
                style={{width:40,padding:"3px 4px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontWeight:700,textAlign:"center",fontFamily:"inherit"}}/>
              <span style={{fontSize:9,color:C.textMuted,marginLeft:"auto"}}>{(d*(denomCounts[d]||0)).toFixed(2)}€</span>
            </div>))}</div></div>
        <div style={{background:C.accentLight,borderRadius:14,padding:14,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${C.accent}22`}}>
          <span style={{fontSize:14,fontWeight:700,color:C.accent}}>Total coupures</span>
          <span style={{fontSize:22,fontWeight:900,color:C.accent}}>{denomTotal.toFixed(2)}€</span></div>
        <div style={{fontSize:11,fontWeight:600,marginBottom:10,padding:"6px 10px",borderRadius:8,
          background:Math.abs(denomTotal-expected)<0.01?C.primaryLight:C.dangerLight,
          color:Math.abs(denomTotal-expected)<0.01?"#059669":C.danger}}>
          Écart vs attendu ({expected.toFixed(2)}€): {(denomTotal-expected)>=0?"+":""}{(denomTotal-expected).toFixed(2)}€ {Math.abs(denomTotal-expected)<0.01?"✓ OK":"⚠ Attention"}</div>
      </>:<>
        <div style={{marginBottom:10}}><label style={{fontSize:9,fontWeight:600,color:C.textMuted}}>ESPÈCES COMPTÉES (attendu: {expected.toFixed(2)}€)</label>
          <Input type="number" step="0.01" value={aCash} onChange={e=>setACash(e.target.value)} placeholder={expected.toFixed(2)}/>
          {cashDiff!==null&&<div style={{fontSize:10,fontWeight:600,marginTop:3,color:Math.abs(cashDiff)<0.01?"#059669":C.danger}}>
            Écart: {cashDiff>=0?"+":""}{cashDiff.toFixed(2)}€ {Math.abs(cashDiff)<0.01?"(OK)":"(attention)"}</div>}</div>
      </>}
      <div style={{marginBottom:12}}>
        <label style={{fontSize:9,fontWeight:600,color:C.textMuted}}>CARTE COMPTÉE (attendu: {card.toFixed(2)}€)</label>
        <Input type="number" step="0.01" value={aCard} onChange={e=>setACard(e.target.value)} placeholder={card.toFixed(2)}/>
        {cardDiff!==null&&<div style={{fontSize:10,fontWeight:600,marginTop:3,color:Math.abs(cardDiff)<0.01?"#059669":C.danger}}>
          Écart: {cardDiff>=0?"+":""}{cardDiff.toFixed(2)}€ {Math.abs(cardDiff)<0.01?"(OK)":"(attention)"}</div>}</div>
      <Btn variant="danger" onClick={async()=>{
        // M2 fix: check both local AND server for existing daily closure
        const todayStr=new Date().toISOString().split("T")[0];
        if(closures.some(c=>c.type==="daily"&&(c.period||c.date||c.created_at||"").startsWith(todayStr))){
          notify("Une clôture Z a déjà été faite aujourd'hui","error");return;}
        // Also verify server-side to prevent multi-tab/device duplicates
        try{const serverClosures=await API.fiscal.closures();
          if(serverClosures?.some(c=>c.closure_type==="daily"&&(c.period||c.created_at||"").startsWith(todayStr))){
            notify("Une clôture Z existe déjà sur le serveur pour aujourd'hui","error");return;}
        }catch(e){/* offline — local check is our best guard */}
        const cl=await createClosure("daily",aCash?parseFloat(aCash):null,aCard?parseFloat(aCard):null);if(cl){closeReg(aCash?parseFloat(aCash):null,aCard?parseFloat(aCard):null);setReportModal(cl);}else{notify("Erreur lors de la clôture","danger");}}}
        style={{width:"100%",height:44,marginBottom:8}}><Lock size={16}/> Clôture journalière (Z)</Btn>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <Btn variant="outline" onClick={async()=>{const cl=await createClosure("monthly",null,null);if(cl)setReportModal(cl);}} style={{height:36,fontSize:11}}><Calendar size={14}/> Clôture mensuelle</Btn>
        <Btn variant="outline" onClick={async()=>{const cl=await createClosure("annual",null,null);if(cl)setReportModal(cl);}} style={{height:36,fontSize:11}}><Archive size={14}/> Clôture annuelle</Btn>
      </div></div>

    {/* Closure history */}
    <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Historique des clôtures ({closures.length})</div>
    {closures.map(c=>(<div key={c.id} onClick={()=>setReportModal(c)} style={{display:"flex",alignItems:"center",gap:10,padding:8,borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,marginBottom:4,cursor:"pointer"}}>
      <Archive size={12} color={C.fiscal}/>
      <span style={{fontSize:11,fontWeight:700,flex:1}}>Z {c.type==="daily"?"Journalière":c.type==="monthly"?"Mensuelle":"Annuelle"} — {c.period} ({c.ticketCount} tickets)</span>
      <span style={{fontSize:10,color:C.textMuted}}>{new Date(c.date).toLocaleString("fr-FR")}</span>
      <span style={{fontSize:12,fontWeight:700,color:C.primary}}>{(c.totalTTC||0).toFixed(2)}€</span></div>))}

    {/* Closure detail/print modal */}
    <Modal open={!!reportModal} onClose={()=>setReportModal(null)} title={`Rapport Z — ${reportModal?.period}`} wide>
      {reportModal&&<div data-print-receipt style={{fontFamily:"'Courier New',monospace",fontSize:10,background:"#FAFAF8",borderRadius:10,padding:20,border:`1px solid ${C.border}`}}>
        <div style={{textAlign:"center",marginBottom:8}}>
          <div style={{fontSize:14,fontWeight:700}}>RAPPORT DE CLÔTURE</div>
          <div style={{fontSize:12,fontWeight:700}}>{settings.name||CO.name}</div>
          <div>{settings.address||CO.address}, {settings.postalCode||CO.postalCode} {settings.city||CO.city}</div>
          <div>SIRET: {settings.siret||CO.siret}</div></div>
        <div style={{borderTop:"2px solid #333",margin:"6px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Type</span><span style={{fontWeight:700}}>{reportModal.type==="daily"?"JOURNALIÈRE":reportModal.type==="monthly"?"MENSUELLE":"ANNUELLE"}</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Période</span><span>{reportModal.period}</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Date d'émission</span><span>{new Date(reportModal.date||reportModal.createdAt||"").toLocaleString("fr-FR")}</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Caissier</span><span>{reportModal.userName}</span></div>
        <div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
        <div style={{fontWeight:700,marginBottom:4}}>ACTIVITÉ</div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Nombre de tickets</span><span style={{fontWeight:700}}>{reportModal.ticketCount}</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Total HT</span><span>{(reportModal.totalHT||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Total TVA</span><span>{(reportModal.totalTVA||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:12}}><span>Total TTC</span><span>{(reportModal.totalTTC||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between",color:"#059669"}}><span>Marge brute</span><span>{(reportModal.totalMargin||0).toFixed(2)}€</span></div>
        <div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
        <div style={{fontWeight:700,marginBottom:4}}>VENTILATION PAIEMENTS</div>
        {reportModal.bySeller&&Object.entries(reportModal.bySeller).map(([name,amount])=>(
          <div key={name} style={{display:"flex",justifyContent:"space-between"}}><span>{name}</span><span>{amount.toFixed(2)}€</span></div>))}
        <div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
        <div style={{fontWeight:700,marginBottom:4}}>CONTRÔLE CAISSE</div>
        {reportModal.expectedCash!=null&&<div style={{display:"flex",justifyContent:"space-between"}}><span>Espèces attendues</span><span>{reportModal.expectedCash.toFixed(2)}€</span></div>}
        {reportModal.actualCash!=null&&<div style={{display:"flex",justifyContent:"space-between"}}><span>Espèces comptées</span><span>{reportModal.actualCash.toFixed(2)}€</span></div>}
        {reportModal.actualCash!=null&&reportModal.expectedCash!=null&&<div style={{display:"flex",justifyContent:"space-between",color:Math.abs(reportModal.actualCash-reportModal.expectedCash)<0.01?"#059669":C.danger,fontWeight:700}}>
          <span>Écart espèces</span><span>{(reportModal.actualCash-reportModal.expectedCash).toFixed(2)}€</span></div>}
        <div style={{borderTop:"2px solid #333",margin:"6px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:12}}><span>GRAND TOTAL PERPÉTUEL</span><span>{reportModal.grandTotal.toFixed(2)}€</span></div>
        <div style={{textAlign:"center",background:C.fiscalLight,padding:8,borderRadius:6,margin:"8px 0"}}>
          <div style={{fontSize:8,color:C.fiscal,fontWeight:700}}>EMPREINTE NF525</div>
          <div style={{fontSize:11,fontWeight:700,color:C.fiscal,letterSpacing:2}}>{reportModal.fingerprint}</div></div>
        <div style={{textAlign:"center",fontSize:8,color:C.textMuted}}>{CO.sw} v{CO.ver} — Document non modifiable</div>
      </div>}
      {reportModal&&<Btn variant="outline" onClick={()=>thermalPrint("closure",reportModal)} style={{width:"100%",marginTop:10}}><Printer size={14}/> {printerConnected?"Ticket":"Imprimer le rapport"}</Btn>}
    </Modal>
  </div>);
}

/* ══════════ CUSTOMERS ══════════ */
function CustomersScreen(){
  const{customers,setCustomers,tickets,exportCustomerRGPD,getLoyaltyTier,updateCustomer,deleteCustomer,addCustomer,notify}=useApp();
  const[sel,setSel]=useState(null);const[search,setSearch]=useState("");
  const[editMode,setEditMode]=useState(false);
  const[editData,setEditData]=useState({});
  const[custHistory,setCustHistory]=useState([]);const[loadingHist,setLoadingHist]=useState(false);
  const[newCustModal,setNewCustModal]=useState(false);
  const[nc,setNc]=useState({firstName:"",lastName:"",email:"",phone:"",city:"",notes:""});
  const[confirmDel,setConfirmDel]=useState(false);
  const[csvModal,setCsvModal]=useState(false);const[csvStep,setCsvStep]=useState(0);const[csvData,setCsvData]=useState([]);const[csvHeaders,setCsvHeaders]=useState([]);
  const[csvMapping,setCsvMapping]=useState({});const[csvPreview,setCsvPreview]=useState([]);
  const custFields=["firstName","lastName","email","phone","city","notes"];
  const custSynonyms={firstName:["prenom","prénom","first_name","firstname","prenom_client"],lastName:["nom","last_name","lastname","nom_client","nom_famille"],
    email:["email","mail","e-mail","courriel"],phone:["phone","telephone","téléphone","tel","portable","mobile"],city:["city","ville","localite","localité"],notes:["notes","note","commentaire","remarque"]};
  const autoMapCustHeaders=(headers)=>{const map={};headers.forEach(h=>{const hl=h.toLowerCase().trim();
    custFields.forEach(f=>{if(hl===f.toLowerCase()||custSynonyms[f]?.some(s=>hl===s))map[h]=f;});});return map;};
  const handleCustCSV=(e)=>{const file=e.target.files[0];if(!file)return;
    Papa.parse(file,{header:true,skipEmptyLines:true,complete:(r)=>{if(!r.data.length)return;
      setCsvHeaders(r.meta.fields||[]);setCsvData(r.data);const map=autoMapCustHeaders(r.meta.fields||[]);setCsvMapping(map);setCsvStep(1);}});};
  const buildCustPreview=()=>{const rows=csvData.map(row=>{const c={};custFields.forEach(f=>{const h=Object.entries(csvMapping).find(([k,v])=>v===f);
    c[f]=h?row[h[0]]?.trim()||"":"";});c._dup=c.email&&customers.some(ex=>ex.email?.toLowerCase()===c.email.toLowerCase());return c;});setCsvPreview(rows);setCsvStep(2);};
  const importCustCSV=()=>{let added=0;csvPreview.forEach(c=>{if(!c.firstName&&!c.lastName)return;if(c._dup)return;
    setCustomers(p=>[...p,{id:crypto.randomUUID?crypto.randomUUID():"c"+Date.now()+Math.random().toString(36).slice(2,8),firstName:c.firstName,lastName:c.lastName,email:c.email,phone:c.phone,city:c.city,notes:c.notes,points:0,totalSpent:0}]);added++;});
    notify(`${added} client(s) importé(s)`,"success");setCsvModal(false);setCsvStep(0);setCsvData([]);};
  useEffect(()=>{if(!sel)return;setLoadingHist(true);setCustHistory([]);
    API.customers.history(sel.id).then(data=>{setCustHistory(Array.isArray(data)?data:data.sales||[]);}).catch(()=>{
      // Fallback: filter local tickets
      setCustHistory(tickets.filter(t=>t.customerId===sel.id));
    }).finally(()=>setLoadingHist(false));},[sel?.id]);
  const filtered=customers.filter(c=>!search||`${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  const custTickets=custHistory.length?custHistory:(sel?tickets.filter(t=>t.customerId===sel.id):[]);
  const custAvg=custTickets.length?custTickets.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0)/custTickets.length:0;

  const startEdit=()=>{setEditData({firstName:sel.firstName,lastName:sel.lastName,email:sel.email,phone:sel.phone,city:sel.city||""});setEditMode(true);};
  const saveEdit=()=>{updateCustomer(sel.id,editData);setSel(s=>({...s,...editData}));setEditMode(false);};

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>Clients & Fidélité ({customers.length})</h2>
      <div style={{display:"flex",gap:6}}>
        <Btn variant="outline" onClick={()=>{setCsvModal(true);setCsvStep(0);setCsvData([]);}} style={{fontSize:11}}><Upload size={12}/> Import CSV</Btn>
        <Btn onClick={()=>setNewCustModal(true)} style={{fontSize:11,background:C.primary}}><Plus size={12}/> Nouveau client</Btn></div></div>
    <div style={{display:"flex",gap:10}}>
      <div style={{flex:sel?`0 0 280px`:"1",transition:"flex 0.3s ease",maxHeight:"calc(100vh - 140px)",overflowY:"auto"}}>
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher nom, email, téléphone…" style={{marginBottom:10,height:36}}/>
        <div style={{display:sel?"flex":"grid",flexDirection:"column",gridTemplateColumns:sel?"1fr":"repeat(auto-fill,minmax(260px,1fr))",gap:sel?4:8}}>
        {filtered.map(c=>{const tier=getLoyaltyTier(c.points);return(
          <div key={c.id} onClick={()=>{setSel(c);setEditMode(false);}} style={{display:"flex",alignItems:"center",gap:8,padding:sel?8:12,borderRadius:sel?8:12,
            background:sel?.id===c.id?C.primaryLight:C.surface,border:`1.5px solid ${sel?.id===c.id?C.primary:C.border}`,cursor:"pointer",transition:"all 0.15s"}}
            onMouseEnter={e=>{if(sel?.id!==c.id)e.currentTarget.style.borderColor=C.primary+"66";}} onMouseLeave={e=>{if(sel?.id!==c.id)e.currentTarget.style.borderColor=C.border;}}>
            <div style={{width:sel?30:36,height:sel?30:36,borderRadius:sel?15:18,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:sel?10:12}}>{c.firstName?.[0]}{c.lastName?.[0]}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:sel?11:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.firstName} {c.lastName}</div>
              <div style={{fontSize:sel?9:10,color:C.textMuted}}>{tier.name} — {c.points}pts — {c.totalSpent.toFixed(0)}€</div>
              {!sel&&c.phone&&<div style={{fontSize:9,color:C.textLight,marginTop:1}}>{c.phone}{c.email?` — ${c.email}`:""}</div>}</div>
          </div>);})}</div>
      </div>
      {sel&&<div style={{flex:1,minWidth:0}}>
        <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10}}>
            {!editMode?<div><div style={{fontSize:18,fontWeight:700}}>{sel.firstName} {sel.lastName}</div>
              <div style={{fontSize:12,color:C.textMuted}}>{sel.email||"Pas d'email"} — {sel.phone||"Pas de tél."}{sel.city?` — ${sel.city}`:""}</div></div>
            :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,flex:1,marginRight:10}}>
              <div><label style={{fontSize:9,color:C.textMuted}}>PRÉNOM</label><Input value={editData.firstName||""} onChange={e=>setEditData(p=>({...p,firstName:e.target.value}))}/></div>
              <div><label style={{fontSize:9,color:C.textMuted}}>NOM</label><Input value={editData.lastName||""} onChange={e=>setEditData(p=>({...p,lastName:e.target.value}))}/></div>
              <div><label style={{fontSize:9,color:C.textMuted}}>EMAIL</label><Input value={editData.email||""} onChange={e=>setEditData(p=>({...p,email:e.target.value}))}/></div>
              <div><label style={{fontSize:9,color:C.textMuted}}>TÉLÉPHONE</label><Input value={editData.phone||""} onChange={e=>setEditData(p=>({...p,phone:e.target.value}))}/></div>
              <div><label style={{fontSize:9,color:C.textMuted}}>VILLE</label><Input value={editData.city||""} onChange={e=>setEditData(p=>({...p,city:e.target.value}))}/></div>
            </div>}
            <div style={{display:"flex",gap:4}}>
              {!editMode?<>
                <Btn variant="outline" onClick={startEdit} style={{fontSize:10,padding:"4px 10px"}}><Edit size={11}/> Modifier</Btn>
                <Btn variant="outline" onClick={()=>exportCustomerRGPD(sel.id)} style={{fontSize:10,padding:"4px 10px"}}><Download size={11}/> RGPD</Btn>
                <Btn variant="ghost" onClick={()=>setConfirmDel(true)} style={{color:C.danger,padding:"4px 8px"}}><Trash2 size={11}/></Btn>
              </>:<>
                <Btn variant="success" onClick={saveEdit} style={{fontSize:10,padding:"4px 10px"}}><Save size={11}/> Sauver</Btn>
                <Btn variant="outline" onClick={()=>setEditMode(false)} style={{fontSize:10,padding:"4px 10px"}}>Annuler</Btn>
              </>}
            </div></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
            <SC icon={Star} label="Points" value={sel.points} color={C.accent}/>
            <SC icon={DollarSign} label="Dépensé" value={`${sel.totalSpent.toFixed(0)}€`} color={C.primary}/>
            <SC icon={Heart} label="Niveau" value={getLoyaltyTier(sel.points).name} color={C.fiscal}/>
            <SC icon={Receipt} label="Panier moy." value={`${custAvg.toFixed(1)}€`} color={C.info}/></div>
          <div style={{marginBottom:8}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>NOTES</label>
            <textarea value={sel.notes||""} onChange={e=>{const v=e.target.value;setCustomers(p=>p.map(c=>c.id===sel.id?{...c,notes:v}:c));setSel(s=>({...s,notes:v}));}}
              style={{width:"100%",height:50,padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit",resize:"vertical"}}
              placeholder="Préférences, taille habituelle, remarques…"/></div>
          <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Paliers de fidélité</div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {LOYALTY_TIERS.map(t=>(<Badge key={t.name} color={sel.points>=t.minPoints?C.primary:C.textLight}>{t.name} ({t.minPoints}pts) = -{t.discount}%</Badge>))}</div>
        </div>
        <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Historique d'achat ({custTickets.length})</div>
          {loadingHist&&<div style={{color:C.textLight,fontSize:11}}>Chargement…</div>}
          {!loadingHist&&custTickets.length===0&&<div style={{color:C.textLight,fontSize:11}}>Aucun achat</div>}
          {custTickets.slice(0,20).map(t=>(<div key={t.ticketNumber} style={{display:"flex",justifyContent:"space-between",padding:6,borderBottom:`1px solid ${C.border}`,fontSize:11}}>
            <span>{t.ticketNumber} — {new Date(t.date||t.createdAt||t.created_at).toLocaleDateString("fr-FR")} — {(t.items||[]).length} art.</span>
            <span style={{fontWeight:700,color:C.primary}}>{(t.totalTTC||parseFloat(t.total_ttc)||0).toFixed(2)}€</span></div>))}</div>
      </div>}
    </div>

    {/* New customer modal */}
    <Modal open={newCustModal} onClose={()=>setNewCustModal(false)} title="Nouveau client">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>PRÉNOM</label><Input value={nc.firstName} onChange={e=>setNc(p=>({...p,firstName:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>NOM</label><Input value={nc.lastName} onChange={e=>setNc(p=>({...p,lastName:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>EMAIL</label><Input value={nc.email} onChange={e=>setNc(p=>({...p,email:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>TÉLÉPHONE</label><Input value={nc.phone} onChange={e=>setNc(p=>({...p,phone:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>VILLE</label><Input value={nc.city} onChange={e=>setNc(p=>({...p,city:e.target.value}))}/></div></div>
      <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>NOTES</label>
        <textarea value={nc.notes} onChange={e=>setNc(p=>({...p,notes:e.target.value}))} style={{width:"100%",height:50,padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit",resize:"vertical"}} placeholder="Notes…"/></div>
      <Btn onClick={async()=>{if(nc.firstName&&nc.lastName){const c=await addCustomer(nc);if(c){setSel(c);setNewCustModal(false);
        setNc({firstName:"",lastName:"",email:"",phone:"",city:"",notes:""});}}}}
        style={{width:"100%",height:40,background:C.primary}}>Créer le client</Btn></Modal>

    {/* CSV Import Modal */}
    <Modal open={csvModal} onClose={()=>setCsvModal(false)} title="Import CSV clients" wide>
      {csvStep===0&&<div style={{textAlign:"center",padding:20}}>
        <Upload size={32} color={C.primary} style={{marginBottom:10}}/>
        <p style={{fontSize:12,color:C.textMuted,marginBottom:12}}>Sélectionnez un fichier CSV avec les colonnes: prénom, nom, email, téléphone, ville, notes</p>
        <input type="file" accept=".csv,.txt" onChange={handleCustCSV} style={{fontSize:12}}/></div>}
      {csvStep===1&&<div>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Associer les colonnes ({csvHeaders.length} colonnes détectées)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
          {csvHeaders.map(h=>(<div key={h} style={{display:"flex",alignItems:"center",gap:6,padding:6,borderRadius:8,background:C.surfaceAlt}}>
            <span style={{fontSize:11,fontWeight:600,flex:1}}>{h}</span>
            <select value={csvMapping[h]||""} onChange={e=>{const v=e.target.value;setCsvMapping(p=>{const n={...p};if(!v)delete n[h];else n[h]=v;return n;});}}
              style={{padding:4,borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,fontFamily:"inherit"}}>
              <option value="">— ignorer —</option>{custFields.map(f=>(<option key={f} value={f}>{f}</option>))}</select></div>))}</div>
        <Btn onClick={buildCustPreview} style={{width:"100%",height:36}}><Search size={12}/> Prévisualiser</Btn></div>}
      {csvStep===2&&<div>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Aperçu ({csvPreview.length} lignes, {csvPreview.filter(c=>c._dup).length} doublons détectés)</div>
        <div style={{maxHeight:300,overflowY:"auto",marginBottom:12}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
            <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
              {["Prénom","Nom","Email","Tél","Ville","Statut"].map(h=>(<th key={h} style={{padding:4,textAlign:"left",fontSize:9,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>
            <tbody>{csvPreview.slice(0,50).map((c,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:c._dup?C.warnLight:"transparent"}}>
              <td style={{padding:4}}>{c.firstName}</td><td style={{padding:4}}>{c.lastName}</td><td style={{padding:4}}>{c.email}</td>
              <td style={{padding:4}}>{c.phone}</td><td style={{padding:4}}>{c.city}</td>
              <td style={{padding:4}}>{c._dup?<Badge color={C.warn}>Doublon</Badge>:<Badge color="#059669">Nouveau</Badge>}</td></tr>))}</tbody></table></div>
        <Btn onClick={importCustCSV} style={{width:"100%",height:40,background:C.primary}}><Upload size={14}/> Importer {csvPreview.filter(c=>!c._dup&&(c.firstName||c.lastName)).length} client(s)</Btn></div>}
    </Modal>

    {/* Delete confirmation */}
    <ConfirmDialog open={confirmDel} onClose={()=>setConfirmDel(false)} onConfirm={()=>{deleteCustomer(sel.id);setSel(null);}}
      title="Supprimer ce client ?" message={`Supprimer ${sel?.firstName} ${sel?.lastName} et toutes ses données ? Son historique d'achat sera conservé dans les tickets.`}/>
  </div>);
}

/* ══════════ FISCAL ══════════ */
function FiscalScreen(){
  const{gt,tSeq,lastHash,closures,exportArchive,exportFEC,perm:p,verifyChain,tvaSummary,currentStore,viewingStoreId,stores}=useApp();
  const storeName=viewingStoreId==="all"?"Tous les magasins":viewingStoreId?stores.find(s=>s.id===viewingStoreId)?.name:currentStore?.name||"";
  const[chainResult,setChainResult]=useState(null);
  if(!p().canExport)return<div style={{padding:40,textAlign:"center",color:C.textMuted}}>Accès réservé aux administrateurs</div>;
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><h2 style={{fontSize:22,fontWeight:800,margin:0}}>Conformité NF525</h2><Badge color={C.fiscal} bg={C.fiscalLight}>ISCA</Badge>
      {storeName&&<Badge color={C.primary}>{storeName}</Badge>}</div>
    <div style={{background:C.surface,borderRadius:14,padding:20,border:`1.5px solid ${C.fiscal}33`,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Shield size={20} color={C.fiscal}/><h3 style={{fontSize:16,fontWeight:700,color:C.fiscal,margin:0}}>Attestation de conformité</h3></div>
      <div style={{fontSize:12,lineHeight:1.8}}>
        <div><strong>Logiciel :</strong> {CO.sw} v{CO.ver}</div>
        <div><strong>N° certification :</strong> <span style={{fontFamily:"monospace",background:C.fiscalLight,padding:"2px 6px",borderRadius:4}}>En attente de certification</span></div>
        <div><strong>Organisme certificateur :</strong> À définir après audit</div>
        <div><strong>Catégorie :</strong> Système de caisse — Art. 286, I-3° bis du CGI</div>
        <div><strong>Date de mise en service :</strong> {new Date().getFullYear()}</div>
        <div style={{marginTop:6,fontSize:11,color:C.textMuted}}>Conforme aux conditions d'inaltérabilité, de sécurisation, de conservation et d'archivage (ISCA) prévues au 3° bis du I de l'article 286 du CGI.</div>
      </div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
      <SC icon={Receipt} label="Tickets" value={tSeq} color={C.fiscal}/>
      <SC icon={Lock} label="Clôtures Z" value={closures.length} color={C.fiscal}/>
      <SC icon={Database} label="GT" value={`${gt.toFixed(2)}€`} color={C.fiscal}/></div>
    <div style={{background:C.surface,borderRadius:12,padding:14,border:`1.5px solid ${C.border}`,marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>Chaîne SHA-256</div>
      <div style={{fontFamily:"monospace",fontSize:8,background:C.surfaceAlt,padding:8,borderRadius:6,wordBreak:"break-all"}}>{lastHash}</div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      <Btn variant="fiscal" onClick={exportArchive} style={{height:44}}><Archive size={14}/> Archive fiscale</Btn>
      <Btn variant="info" onClick={exportFEC} style={{height:44}}><FileText size={14}/> Export FEC</Btn></div>
    <Btn variant="outline" onClick={async()=>{const r=await verifyChain();setChainResult(r);}} style={{width:"100%",marginBottom:8,height:40}}>
      <Shield size={14}/> Vérifier l'intégrité de la chaîne</Btn>
    {chainResult&&<div style={{padding:10,borderRadius:10,marginBottom:14,background:chainResult.valid?C.primaryLight:C.dangerLight,
      display:"flex",alignItems:"center",gap:8}}>
      {chainResult.valid?<CheckCircle2 size={16} color={C.primary}/>:<AlertTriangle size={16} color={C.danger}/>}
      <span style={{fontSize:12,fontWeight:600,color:chainResult.valid?C.primary:C.danger}}>{chainResult.msg}</span></div>}
    {/* TVA Declaration */}
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
    </div></div>);
}

function AuditScreen(){
  const{audit:localAudit,jet:localJet,exportCSVReport,isOnline,currentStore,viewingStoreId,stores,effectiveStoreId}=useApp();
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
const CSV_TARGET_FIELDS=[
  {key:"name",label:"Nom produit",required:true},{key:"sku",label:"Référence / SKU",required:true},
  {key:"price",label:"Prix vente",required:true},{key:"costPrice",label:"Prix achat",required:false},
  {key:"taxRate",label:"TVA",required:false},{key:"category",label:"Catégorie",required:false},
  {key:"collection",label:"Collection",required:false},{key:"color",label:"Couleur",required:false},
  {key:"size",label:"Taille",required:false},{key:"ean",label:"Code EAN",required:false},
  {key:"stock",label:"Stock",required:false},{key:"stockAlert",label:"Seuil alerte",required:false},
];
const CSV_SYNONYMS={
  name:["name","nom","nom_produit","product_name","libelle","libellé","designation","désignation","description"],
  sku:["sku","ref","reference","référence","ref_produit","code_produit","product_ref","code"],
  price:["price","prix","prix_vente","prix_ttc","pv","selling_price","pvttc"],
  costPrice:["costprice","cost_price","prix_achat","pa","cost","cout","coût","prix_revient"],
  taxRate:["taxrate","tax_rate","tva","tax","vat","taux_tva"],
  category:["category","categorie","catégorie","cat","famille","type"],
  collection:["collection","saison","season"],
  color:["color","couleur","colour","coloris"],
  size:["size","taille","pointure","dim"],
  ean:["ean","ean13","barcode","code_barre","codebarre","gtin","code_ean","codeean"],
  stock:["stock","qty","quantity","quantite","quantité","qte"],
  stockAlert:["stockalert","stock_alert","seuil","seuil_alerte","alert","min_stock","stock_min"],
};
function csvAutoDetect(headers){const m={};const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
  headers.forEach(h=>{const nh=norm(h);for(const[f,syns]of Object.entries(CSV_SYNONYMS)){if(!m[f]&&syns.some(s=>norm(s)===nh)){m[f]=h;break;}}});return m;}
function csvParseTax(v){const n=parseFloat(v);if(isNaN(n))return 0.20;return n>1?n/100:n;}

function CSVImportWizard({open,onClose,existingProducts,onImportComplete}){
  const[step,setStep]=useState(0);
  const[rawData,setRawData]=useState([]);
  const[csvHeaders,setCsvHeaders]=useState([]);
  const[mapping,setMapping]=useState({});
  const[parentRefField,setParentRefField]=useState("sku");
  const[uniqueKeyField,setUniqueKeyField]=useState("ean");
  const[duplicateAction,setDuplicateAction]=useState("update");
  const[processed,setProcessed]=useState(null);
  const[importResult,setImportResult]=useState(null);
  const[importing,setImporting]=useState(false);
  const[fileName,setFileName]=useState("");
  const[mappingRestored,setMappingRestored]=useState(false);
  const fileRef=useRef();

  const reset=()=>{setStep(0);setRawData([]);setCsvHeaders([]);setMapping({});setParentRefField("sku");
    setUniqueKeyField("ean");setDuplicateAction("update");setProcessed(null);setImportResult(null);setImporting(false);setFileName("");};
  const handleClose=()=>{reset();onClose();};

  // Step 0: File upload — restore saved mapping if column names match
  const handleFile=(e)=>{const file=e.target.files?.[0];if(!file)return;setFileName(file.name);
    Papa.parse(file,{header:true,skipEmptyLines:true,complete:(r)=>{
      setRawData(r.data);setCsvHeaders(r.meta.fields||[]);
      // Try to restore saved mapping from last import
      let restoredMapping=null;
      try{const saved=localStorage.getItem("caissepro_csv_column_mapping");
        if(saved){const prev=JSON.parse(saved);
          // Check if saved mapping columns exist in current file headers
          const prevValues=Object.values(prev.mapping||{});
          const matchCount=prevValues.filter(v=>r.meta.fields.includes(v)).length;
          if(matchCount>=prevValues.length*0.7&&matchCount>=2){
            restoredMapping=prev.mapping;
            if(prev.parentRefField)setParentRefField(prev.parentRefField);
            if(prev.uniqueKeyField)setUniqueKeyField(prev.uniqueKeyField);
            if(prev.duplicateAction)setDuplicateAction(prev.duplicateAction);
          }}}catch(e){}
      if(restoredMapping){setMapping(restoredMapping);setMappingRestored(true);}
      else{setMappingRestored(false);const auto=csvAutoDetect(r.meta.fields||[]);setMapping(auto);
        if(auto.sku)setParentRefField("sku");else if(auto.name)setParentRefField("name");}
      setStep(1);}});};

  // Step 2→3: Process data — also save column mapping for future imports
  const processData=()=>{
    // Save mapping to localStorage for next import
    const csvConfig={mapping,parentRefField,uniqueKeyField,duplicateAction,savedAt:new Date().toISOString()};
    try{localStorage.setItem("caissepro_csv_column_mapping",JSON.stringify(csvConfig));}catch(e){}
    try{API.settings.update({csvColumnMapping:csvConfig}).catch(()=>{});}catch(e){}
    const errors=[];const grouped=new Map();
    // Map and validate rows
    rawData.forEach((row,idx)=>{
      const get=(f)=>row[mapping[f]]||"";
      const name=get("name");const sku=get("sku");const price=get("price");
      if(!name&&!sku)errors.push({row:idx+2,msg:"Nom ou référence manquant(e)"});
      if(price&&isNaN(parseFloat(price)))errors.push({row:idx+2,msg:`Prix invalide: "${price}"`});
      // Group by parent ref
      const ref=get(parentRefField)||`UNGROUPED-${idx}`;
      if(!grouped.has(ref))grouped.set(ref,{rows:[],indices:[]});
      grouped.get(ref).rows.push(row);grouped.get(ref).indices.push(idx);
    });
    // Build products from groups
    const newProducts=[];const updates=[];const skipped=[];
    grouped.forEach((group,ref)=>{
      const first=group.rows[0];const get=(f)=>first[mapping[f]]||"";
      const product={
        id:`imp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        name:get("name")||ref,sku:get("sku")||ref,
        price:parseFloat(get("price"))||0,costPrice:parseFloat(get("costPrice"))||0,
        taxRate:csvParseTax(get("taxRate")),category:get("category")||"Divers",collection:get("collection")||"",
        variants:group.rows.map((r,i)=>{const gv=(f)=>r[mapping[f]]||"";return{
          id:`iv-${Date.now()}-${i}-${Math.random().toString(36).slice(2,6)}`,
          color:gv("color")||"Défaut",size:gv("size")||"TU",ean:gv("ean")||"",
          stock:Math.max(0,parseInt(gv("stock"))||0),defective:0,stockAlert:Math.max(0,parseInt(gv("stockAlert"))||5),sortOrder:i};}),
        sourceRows:group.indices.map(i=>i+2),
      };
      // Check duplicates
      let isDuplicate=false;let existingMatch=null;
      if(uniqueKeyField==="ean"){
        for(const v of product.variants){if(!v.ean)continue;
          for(const ep of existingProducts){const ev=ep.variants.find(x=>x.ean===v.ean);
            if(ev){isDuplicate=true;existingMatch=ep;break;}}if(isDuplicate)break;}
      }else if(uniqueKeyField==="sku"){
        existingMatch=existingProducts.find(ep=>ep.sku===product.sku);isDuplicate=!!existingMatch;
      }else if(uniqueKeyField==="name"){
        existingMatch=existingProducts.find(ep=>ep.name.toLowerCase()===product.name.toLowerCase());isDuplicate=!!existingMatch;
      }
      if(isDuplicate){
        if(duplicateAction==="update"){
          // Separate new variants from existing ones that need updating
          const newVariants=[];const updatedVariants=[];
          product.variants.forEach(v=>{
            const match=existingMatch.variants.find(ev=>(ev.ean&&ev.ean===v.ean)||(ev.size===v.size&&ev.color===v.color));
            if(match)updatedVariants.push({...v,existingId:match.id,existingEan:match.ean});
            else newVariants.push(v);
          });
          updates.push({existing:existingMatch,incoming:product,newVariants,updatedVariants,mode:"update",
            fieldsChanged:{name:product.name,price:product.price,costPrice:product.costPrice,
              taxRate:product.taxRate,category:product.category,collection:product.collection}});
        }else if(duplicateAction==="addStock"){
          // Add CSV quantities to existing stock instead of replacing
          const newVariants=[];const updatedVariants=[];
          product.variants.forEach(v=>{
            const match=existingMatch.variants.find(ev=>(ev.ean&&ev.ean===v.ean)||(ev.size===v.size&&ev.color===v.color));
            if(match)updatedVariants.push({...v,existingId:match.id,existingEan:match.ean,addQty:v.stock,existingStock:match.stock||0});
            else newVariants.push(v);
          });
          updates.push({existing:existingMatch,incoming:product,newVariants,updatedVariants,mode:"addStock",
            fieldsChanged:{}});
        }else skipped.push({existing:existingMatch,incoming:product});
      }else{newProducts.push(product);}
    });
    setProcessed({newProducts,updates,skipped,errors,
      totalVariants:newProducts.reduce((s,p)=>s+p.variants.length,0)+updates.reduce((s,u)=>s+u.newVariants.length+u.updatedVariants.length,0)});
    setStep(3);
  };

  // Step 3→4: Execute import
  const executeImport=async()=>{
    if(!processed)return;setImporting(true);
    // Save variant display order per product — matches the CSV row order exactly
    for(const p of processed.newProducts){
      setProductVariantOrder(p.sku||p.name,p.variants);
    }
    for(const u of processed.updates){
      // Rebuild variant order: all variants from CSV in their file order
      const allVars=[...u.updatedVariants,...u.newVariants];
      setProductVariantOrder(u.existing.sku||u.existing.name,allVars);
    }
    const results={created:0,updated:0,skipped:processed.skipped.length,errors:[]};
    // Create new products
    for(const p of processed.newProducts){
      try{await API.products.create({name:p.name,sku:p.sku,price:p.price,costPrice:p.costPrice,taxRate:p.taxRate,
        category:p.category,collection:p.collection,variants:p.variants.map((v,i)=>({color:v.color,size:v.size,ean:v.ean,stock:v.stock,defective:0,stockAlert:v.stockAlert,sort_order:i}))});
        results.created++;}catch(e){results.errors.push({name:p.name,error:e.message});}
    }
    // Update existing products — 3 steps: product fields, variant stock, new variants
    for(const u of processed.updates){
      let anySuccess=false;

      // For addStock mode, skip product field updates — only adjust stock
      if(u.mode!=="addStock"){
        try{
          // Step 1: Update product core fields (price, name, category, etc.)
          const fc=u.fieldsChanged;
          await API.products.update(u.existing.id,{
            name:fc.name||u.existing.name,price:fc.price||u.existing.price,
            costPrice:fc.costPrice||u.existing.costPrice,taxRate:fc.taxRate??u.existing.taxRate,
            category:fc.category||u.existing.category,collection:fc.collection||u.existing.collection
          });
          anySuccess=true;
        }catch(e){console.warn(`CSV update: product fields failed for ${u.existing.name}:`,e.message);}
      }

      // Step 2: Update stock for existing variants via stock.adjust
      for(const uv of u.updatedVariants){
        try{
          if(u.mode==="addStock"){
            // addStock mode: add CSV quantity to existing stock
            const addQty=uv.addQty||uv.stock||0;
            if(addQty>0)await API.stock.adjust({productId:u.existing.id,variantId:uv.existingId,quantity:addQty,reason:"Import CSV - ajout quantité au stock existant"});
            anySuccess=true;
          }else{
            const existingVariant=u.existing.variants.find(ev=>ev.id===uv.existingId);
            if(existingVariant&&uv.stock!==existingVariant.stock){
              const diff=uv.stock-(existingVariant.stock||0);
              if(diff!==0)await API.stock.adjust({productId:u.existing.id,variantId:uv.existingId,quantity:diff,reason:"Import CSV - mise à jour stock"});
              anySuccess=true;
            }
          }
        }catch(e){console.warn(`CSV update: stock adjust failed for variant ${uv.size}/${uv.color}:`,e.message);}
      }

      // Step 3: Add new variants
      for(const v of u.newVariants){
        try{const sortIdx=u.updatedVariants.length+u.newVariants.indexOf(v);
          await API.products.addVariant(u.existing.id,{color:v.color,size:v.size,ean:v.ean,stock:v.stock,defective:0,stockAlert:v.stockAlert,sort_order:sortIdx});
          anySuccess=true;}catch(e){console.warn(`CSV update: addVariant failed for ${v.size}/${v.color}:`,e.message);}
      }

      if(anySuccess)results.updated++;else results.errors.push({name:u.existing.name,error:"Échec de la mise à jour via l'API"});
    }
    // Fallback: if API fails for all, do local import (both new + updates)
    if(results.created===0&&results.updated===0&&(processed.newProducts.length>0||processed.updates.length>0)){
      const localUpdates=processed.updates.map(u=>({...u.existing,...u.fieldsChanged,
        variants:[...u.existing.variants.map(ev=>{const m=u.updatedVariants.find(uv=>uv.existingId===ev.id);return m?{...ev,stock:m.stock,ean:m.ean||ev.ean}:ev;}),...u.newVariants]}));
      onImportComplete(null,processed.newProducts,localUpdates);setImportResult(results);setImporting(false);setStep(4);return;
    }
    // Refresh from API
    try{const prods=await API.products.list();onImportComplete(prods,null);}catch(e){onImportComplete(null,processed.newProducts);}
    setImportResult(results);setImporting(false);setStep(4);
  };

  const STEPS=[{l:"Fichier",i:Upload},{l:"Colonnes",i:Grid},{l:"Regroupement",i:Box},{l:"Aperçu",i:FileText},{l:"Résultat",i:CheckCircle2}];
  const canNext=step===1?CSV_TARGET_FIELDS.filter(f=>f.required).every(f=>mapping[f.key]):step===2?!!parentRefField:step===3?processed&&processed.errors.filter(e=>!e.msg.includes("manquant")).length<processed.errors.length||processed.errors.length===0:false;

  if(!open)return null;
  return(<Modal open={open} onClose={handleClose} title="Import CSV" sub={fileName?`Fichier: ${fileName}`:""} wide>
    {/* Stepper */}
    <div style={{display:"flex",gap:4,marginBottom:18,padding:"0 0 14px",borderBottom:`1.5px solid ${C.border}`}}>
      {STEPS.map((s,i)=>{const done=i<step;const active=i===step;const Ic=s.i;return(
        <div key={i} style={{flex:1,display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:10,
          background:active?C.primaryLight:done?`${C.primary}08`:"transparent",transition:"all 0.15s"}}>
          <div style={{width:26,height:26,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
            background:active?C.primary:done?"#059669":C.surfaceAlt,color:active||done?"#fff":C.textMuted,fontSize:10,fontWeight:700}}>
            {done?<CheckCircle2 size={13}/>:<Ic size={12}/>}</div>
          <span style={{fontSize:10,fontWeight:active?700:500,color:active?C.primary:done?"#059669":C.textMuted,whiteSpace:"nowrap"}}>{s.l}</span>
        </div>);})}</div>

    {/* Step 0: File upload */}
    {step===0&&<div style={{textAlign:"center",padding:"30px 0"}}>
      <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" style={{display:"none"}} onChange={handleFile}/>
      <div onClick={()=>fileRef.current?.click()} style={{border:`2.5px dashed ${C.border}`,borderRadius:20,padding:"40px 30px",cursor:"pointer",
        background:C.surfaceAlt,transition:"all 0.15s"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.background=C.primaryLight;}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.surfaceAlt;}}>
        <div style={{width:56,height:56,borderRadius:16,background:`${C.primary}12`,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
          <Upload size={26} color={C.primary}/></div>
        <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>Glissez ou cliquez pour importer</div>
        <div style={{fontSize:12,color:C.textMuted}}>Fichier CSV avec en-têtes de colonnes</div>
        <div style={{fontSize:10,color:C.textLight,marginTop:8}}>Formats supportés: .csv, .txt, .tsv</div>
      </div>
    </div>}

    {/* Step 1: Column mapping */}
    {step===1&&<div>
      {mappingRestored&&<div style={{background:C.primaryLight,borderRadius:10,padding:10,marginBottom:12,border:`1.5px solid ${C.primary}33`,display:"flex",alignItems:"center",gap:8}}>
        <CheckCircle2 size={14} color={C.primary}/><span style={{fontSize:11,color:C.primary,fontWeight:600}}>Mapping restauré depuis votre dernier import. Vérifiez et ajustez si nécessaire.</span></div>}
      <div style={{fontSize:12,color:C.textMuted,marginBottom:12}}>
        <strong>{rawData.length}</strong> lignes détectées avec <strong>{csvHeaders.length}</strong> colonnes. Associez chaque colonne du CSV au champ correspondant.
      </div>
      <div style={{maxHeight:320,overflowY:"auto",marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr style={{background:C.surfaceAlt,position:"sticky",top:0,zIndex:1}}>
            <th style={{padding:"8px 10px",textAlign:"left",fontWeight:700,color:C.textMuted,fontSize:9,borderBottom:`2px solid ${C.border}`}}>CHAMP CIBLE</th>
            <th style={{padding:"8px 10px",textAlign:"left",fontWeight:700,color:C.textMuted,fontSize:9,borderBottom:`2px solid ${C.border}`}}>COLONNE CSV</th>
            <th style={{padding:"8px 10px",textAlign:"left",fontWeight:700,color:C.textMuted,fontSize:9,borderBottom:`2px solid ${C.border}`}}>APERÇU (ligne 1)</th>
          </tr></thead>
          <tbody>{CSV_TARGET_FIELDS.map(f=>{const val=mapping[f.key]&&rawData[0]?rawData[0][mapping[f.key]]:"";return(
            <tr key={f.key} style={{borderBottom:`1px solid ${C.border}`,background:f.required&&!mapping[f.key]?C.dangerLight+"40":"transparent"}}>
              <td style={{padding:"6px 10px",fontWeight:600}}>{f.label}{f.required&&<span style={{color:C.danger,marginLeft:3}}>*</span>}</td>
              <td style={{padding:"6px 10px"}}><select value={mapping[f.key]||""} onChange={e=>{const v=e.target.value;setMapping(m=>({...m,[f.key]:v||undefined}));}}
                style={{width:"100%",padding:"6px 8px",borderRadius:8,border:`1.5px solid ${mapping[f.key]?C.primary:C.border}`,fontSize:11,fontFamily:"inherit",
                  background:mapping[f.key]?`${C.primary}06`:C.surface,color:mapping[f.key]?C.text:C.textMuted}}>
                <option value="">— Non mappé —</option>
                {csvHeaders.map(h=>(<option key={h} value={h}>{h}</option>))}
              </select></td>
              <td style={{padding:"6px 10px",color:C.textMuted,fontFamily:"monospace",fontSize:10,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{val||"—"}</td>
            </tr>);})}</tbody></table>
      </div>
      {/* Preview raw data */}
      <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:4}}>APERÇU DES DONNÉES BRUTES ({Math.min(3,rawData.length)} premières lignes)</div>
      <div style={{overflowX:"auto",borderRadius:8,border:`1px solid ${C.border}`,marginBottom:8}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:9,whiteSpace:"nowrap"}}>
          <thead><tr style={{background:C.surfaceAlt}}>{csvHeaders.map(h=>(
            <th key={h} style={{padding:"4px 8px",textAlign:"left",fontWeight:700,color:C.textMuted,borderBottom:`1px solid ${C.border}`}}>{h}</th>))}</tr></thead>
          <tbody>{rawData.slice(0,3).map((row,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
            {csvHeaders.map(h=>(<td key={h} style={{padding:"3px 8px",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis"}}>{row[h]||""}</td>))}</tr>))}</tbody></table>
      </div>
    </div>}

    {/* Step 2: Grouping & duplicate config */}
    {step===2&&<div>
      <div style={{background:C.surfaceAlt,borderRadius:14,padding:16,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Box size={16} color={C.primary}/>
          <h3 style={{fontSize:14,fontWeight:700,margin:0}}>Regroupement par référence parent</h3></div>
        <p style={{fontSize:11,color:C.textMuted,marginBottom:10,lineHeight:1.5}}>
          Chaque ligne du CSV représente une <strong>variante</strong> (couleur/taille). Choisissez la colonne qui identifie le <strong>produit parent</strong>.
          Les lignes partageant la même référence seront regroupées en un seul produit avec plusieurs variantes.</p>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
          <label style={{fontSize:10,fontWeight:600,color:C.textMuted,whiteSpace:"nowrap"}}>COLONNE DE REGROUPEMENT</label>
          <select value={parentRefField} onChange={e=>setParentRefField(e.target.value)}
            style={{flex:1,padding:"8px 10px",borderRadius:10,border:`2px solid ${C.primary}`,fontSize:12,fontFamily:"inherit",background:`${C.primary}06`}}>
            {CSV_TARGET_FIELDS.filter(f=>mapping[f.key]).map(f=>(<option key={f.key} value={f.key}>{f.label} ({mapping[f.key]})</option>))}
          </select></div>
        {(()=>{const groups=new Map();rawData.forEach((row,idx)=>{const ref=row[mapping[parentRefField]]||`UNGROUPED-${idx}`;
          if(!groups.has(ref))groups.set(ref,0);groups.set(ref,groups.get(ref)+1);});
          return(<div style={{display:"flex",gap:10,marginTop:8}}>
            <div style={{flex:1,padding:10,borderRadius:10,background:C.primaryLight,textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:C.primary}}>{groups.size}</div>
              <div style={{fontSize:10,color:C.primaryDark,fontWeight:600}}>Produits</div></div>
            <div style={{flex:1,padding:10,borderRadius:10,background:C.infoLight,textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:C.info}}>{rawData.length}</div>
              <div style={{fontSize:10,color:C.info,fontWeight:600}}>Variantes</div></div>
            <div style={{flex:1,padding:10,borderRadius:10,background:C.accentLight,textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:C.accent}}>{Math.round(rawData.length/Math.max(1,groups.size)*10)/10}</div>
              <div style={{fontSize:10,color:C.accent,fontWeight:600}}>Moy. var./produit</div></div>
          </div>);})()}
      </div>

      <div style={{background:C.surfaceAlt,borderRadius:14,padding:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Shield size={16} color={C.fiscal}/>
          <h3 style={{fontSize:14,fontWeight:700,margin:0}}>Détection des doublons</h3></div>
        <p style={{fontSize:11,color:C.textMuted,marginBottom:10,lineHeight:1.5}}>
          Choisissez le champ utilisé pour détecter si un produit/variante existe déjà dans votre catalogue.</p>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:600,color:C.textMuted,whiteSpace:"nowrap"}}>CLÉ UNIQUE</label>
          <select value={uniqueKeyField} onChange={e=>setUniqueKeyField(e.target.value)}
            style={{padding:"8px 10px",borderRadius:10,border:`2px solid ${C.fiscal}`,fontSize:12,fontFamily:"inherit",background:`${C.fiscal}06`}}>
            <option value="ean">Code EAN (recommandé)</option>
            <option value="sku">Référence / SKU</option>
            <option value="name">Nom du produit</option>
          </select></div>
        <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:6}}>EN CAS DE DOUBLON</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{id:"skip",l:"Ignorer la ligne",d:"Les doublons ne seront pas importés",i:XCircle,c:C.warn},
            {id:"update",l:"Mettre à jour",d:"Mettre à jour prix, stock, variantes du produit existant",i:Upload,c:C.primary},
            {id:"addStock",l:"Ajouter quantité",d:"Ajouter la quantité CSV au stock existant (réception)",i:Plus,c:"#059669"}].map(o=>(
            <button key={o.id} onClick={()=>setDuplicateAction(o.id)} style={{padding:12,borderRadius:12,
              border:`2px solid ${duplicateAction===o.id?o.c:C.border}`,background:duplicateAction===o.id?`${o.c}08`:"transparent",
              cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <o.i size={14} color={duplicateAction===o.id?o.c:C.textMuted}/>
                <span style={{fontSize:12,fontWeight:700,color:duplicateAction===o.id?o.c:C.text}}>{o.l}</span></div>
              <div style={{fontSize:10,color:C.textMuted}}>{o.d}</div></button>))}
        </div>
      </div>
    </div>}

    {/* Step 3: Preview & validation */}
    {step===3&&processed&&<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        <div style={{padding:10,borderRadius:10,background:C.primaryLight,textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:C.primary}}>{processed.newProducts.length}</div>
          <div style={{fontSize:9,color:C.primaryDark,fontWeight:600}}>Nouveaux</div></div>
        <div style={{padding:10,borderRadius:10,background:C.infoLight,textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:C.info}}>{processed.totalVariants}</div>
          <div style={{fontSize:9,color:C.info,fontWeight:600}}>Variantes</div></div>
        <div style={{padding:10,borderRadius:10,background:C.warnLight,textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:C.warn}}>{processed.updates.length+processed.skipped.length}</div>
          <div style={{fontSize:9,color:C.warn,fontWeight:600}}>Doublons</div></div>
        <div style={{padding:10,borderRadius:10,background:processed.errors.length?C.dangerLight:C.primaryLight,textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:processed.errors.length?C.danger:"#059669"}}>{processed.errors.length}</div>
          <div style={{fontSize:9,color:processed.errors.length?C.danger:"#059669",fontWeight:600}}>Erreurs</div></div>
      </div>

      {processed.errors.length>0&&<div style={{background:C.dangerLight,borderRadius:10,padding:10,marginBottom:12,maxHeight:100,overflowY:"auto",
        border:`1.5px solid ${C.danger}33`}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><AlertTriangle size={13} color={C.danger}/>
          <span style={{fontSize:11,fontWeight:700,color:C.danger}}>Avertissements ({processed.errors.length})</span></div>
        {processed.errors.slice(0,10).map((e,i)=>(<div key={i} style={{fontSize:10,color:C.danger,padding:"2px 0"}}>Ligne {e.row}: {e.msg}</div>))}
        {processed.errors.length>10&&<div style={{fontSize:10,color:C.danger,fontStyle:"italic"}}>… et {processed.errors.length-10} autres</div>}
      </div>}

      {processed.updates.length>0&&<div style={{background:C.infoLight,borderRadius:10,padding:10,marginBottom:12,border:`1.5px solid ${C.info}33`}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><Upload size={13} color={C.info}/>
          <span style={{fontSize:11,fontWeight:700,color:C.info}}>Mises à jour ({processed.updates.length})</span></div>
        {processed.updates.map((u,i)=>(<div key={i} style={{fontSize:10,color:C.info,padding:"2px 0"}}>
          "{u.existing.name}" ({u.existing.sku}) — {u.updatedVariants.length} variante(s) mise(s) à jour{u.newVariants.length>0?`, +${u.newVariants.length} nouvelle(s)`:""}</div>))}
      </div>}

      {processed.skipped.length>0&&<div style={{background:C.warnLight,borderRadius:10,padding:10,marginBottom:12,border:`1.5px solid ${C.warn}33`}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><XCircle size={13} color={C.warn}/>
          <span style={{fontSize:11,fontWeight:700,color:C.warn}}>Ignorés ({processed.skipped.length})</span></div>
        {processed.skipped.map((s,i)=>(<div key={i} style={{fontSize:10,color:"#92720E",padding:"2px 0"}}>
          "{s.incoming.name}" — doublon de "{s.existing.name}"</div>))}
      </div>}

      <div style={{fontSize:11,fontWeight:700,marginBottom:6}}>Aperçu des produits à importer ({processed.newProducts.length})</div>
      <div style={{maxHeight:180,overflowY:"auto",borderRadius:10,border:`1px solid ${C.border}`}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
          <thead><tr style={{background:C.surfaceAlt,position:"sticky",top:0}}>
            {["Nom","Réf","Prix","Catégorie","Variantes"].map(h=>(
              <th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:700,color:C.textMuted,fontSize:9,borderBottom:`2px solid ${C.border}`}}>{h}</th>))}</tr></thead>
          <tbody>{processed.newProducts.slice(0,30).map((p,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
            <td style={{padding:"5px 8px",fontWeight:600}}>{p.name}</td>
            <td style={{padding:"5px 8px",fontFamily:"monospace",color:C.textMuted}}>{p.sku}</td>
            <td style={{padding:"5px 8px",fontWeight:700,color:C.primary}}>{p.price.toFixed(2)}€</td>
            <td style={{padding:"5px 8px"}}><Badge color={C.info}>{p.category}</Badge></td>
            <td style={{padding:"5px 8px"}}><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
              {p.variants.map((v,vi)=>(<span key={vi} style={{fontSize:8,background:C.surfaceAlt,padding:"1px 5px",borderRadius:4}}>{v.color}/{v.size}{v.ean?` (${v.ean.slice(-4)})`:""}</span>))}
            </div></td></tr>))}</tbody></table>
        {processed.newProducts.length>30&&<div style={{padding:6,textAlign:"center",fontSize:10,color:C.textMuted}}>… et {processed.newProducts.length-30} autres produits</div>}
      </div>
    </div>}

    {/* Step 4: Result */}
    {step===4&&importResult&&<div style={{textAlign:"center",padding:"20px 0"}}>
      <div style={{width:64,height:64,borderRadius:32,background:"#059669",display:"inline-flex",alignItems:"center",justifyContent:"center",
        marginBottom:12,boxShadow:"0 8px 24px rgba(47,158,85,0.3)"}}><CheckCircle2 size={32} color="#fff"/></div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Import terminé !</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        <div style={{padding:12,borderRadius:10,background:C.primaryLight}}>
          <div style={{fontSize:22,fontWeight:800,color:C.primary}}>{importResult.created}</div>
          <div style={{fontSize:10,fontWeight:600,color:C.primaryDark}}>Créé(s)</div></div>
        <div style={{padding:12,borderRadius:10,background:C.infoLight}}>
          <div style={{fontSize:22,fontWeight:800,color:C.info}}>{importResult.updated}</div>
          <div style={{fontSize:10,fontWeight:600,color:C.info}}>Mis à jour</div></div>
        <div style={{padding:12,borderRadius:10,background:C.warnLight}}>
          <div style={{fontSize:22,fontWeight:800,color:C.warn}}>{importResult.skipped}</div>
          <div style={{fontSize:10,fontWeight:600,color:C.warn}}>Ignoré(s)</div></div>
      </div>
      {importResult.errors.length>0&&<div style={{background:C.dangerLight,borderRadius:10,padding:10,marginBottom:12,textAlign:"left",border:`1.5px solid ${C.danger}33`}}>
        <div style={{fontSize:11,fontWeight:700,color:C.danger,marginBottom:4}}>Erreurs lors de l'import ({importResult.errors.length})</div>
        {importResult.errors.map((e,i)=>(<div key={i} style={{fontSize:10,color:C.danger}}>{e.name}: {e.error}</div>))}
      </div>}
    </div>}

    {/* Navigation buttons */}
    <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"space-between"}}>
      {step>0&&step<4?<Btn variant="outline" onClick={()=>setStep(s=>s-1)} style={{borderRadius:12}}>Retour</Btn>:<div/>}
      {step===1&&<Btn onClick={()=>setStep(2)} disabled={!CSV_TARGET_FIELDS.filter(f=>f.required).every(f=>mapping[f.key])}
        style={{borderRadius:12,background:C.primary}}>Suivant — Regroupement</Btn>}
      {step===2&&<Btn onClick={processData} style={{borderRadius:12,background:C.primary}}>Suivant — Aperçu</Btn>}
      {step===3&&processed&&<Btn onClick={executeImport} disabled={importing||processed.newProducts.length+processed.updates.length===0}
        style={{borderRadius:12,background:C.primary}}>
        {importing?<><span className="spin-loader"/> Import en cours…</>:<><Upload size={14}/> Importer {processed.newProducts.length+processed.updates.length} produit(s)</>}</Btn>}
      {step===4&&<Btn onClick={handleClose} style={{borderRadius:12,background:C.primary}}>
        <CheckCircle2 size={14}/> Fermer</Btn>}
    </div>
  </Modal>);
}

/* ══════════ PRODUCTS MANAGEMENT ══════════ */
function ProductsScreen(){
  const{products,setProducts,refreshProducts,addProduct,addAudit,notify,perm:p,exportCatalog,duplicateProduct,
    updateProduct,deleteProduct,addVariantToProduct,deleteVariant,updateProductPrice,settings,tvaRates}=useApp();
  const pm=settings.pricingMode||"TTC";
  const[search,setSearch]=useState("");const[importWizardOpen,setImportWizardOpen]=useState(false);
  const[createModal,setCreateModal]=useState(false);
  const[editModal,setEditModal]=useState(null);
  const[addVarModal,setAddVarModal]=useState(null);
  const[confirmDel,setConfirmDel]=useState(null);
  const[np,setNp]=useState({name:"",sku:"",price:"",costPrice:"",taxRate:"0.20",category:"T-shirts",collection:"PE-2026"});
  const[nv,setNv]=useState({color:"",size:"",ean:"",stock:"",stockAlert:"5"});
  const[ep,setEp]=useState({});
  const[newVar,setNewVar]=useState({color:"",size:"",ean:"",stock:"0",stockAlert:"5"});
  const filtered=products.filter(q=>!search||q.name.toLowerCase().includes(search.toLowerCase())||q.sku.toLowerCase().includes(search.toLowerCase()));

  const openEdit=(prod)=>{setEp({name:prod.name,sku:prod.sku,price:String(prod.price),costPrice:String(prod.costPrice||""),
    taxRate:String(prod.taxRate),category:prod.category,collection:prod.collection||""});setEditModal(prod);};

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>Produits ({products.length})</h2>
      <div style={{display:"flex",gap:6}}>
        <Btn variant="outline" onClick={()=>setImportWizardOpen(true)} style={{fontSize:11}}><Upload size={12}/> CSV</Btn>
        <Btn variant="outline" onClick={exportCatalog} style={{fontSize:11}}><Download size={12}/> Export</Btn>
        {p().canCreateProduct&&<Btn onClick={()=>setCreateModal(true)} style={{fontSize:11,background:C.primary}}><Plus size={12}/> Nouveau</Btn>}</div></div>
    <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher par nom ou SKU…" style={{marginBottom:12,height:36,maxWidth:300}}/>
    <div style={{background:C.surface,borderRadius:14,border:`1.5px solid ${C.border}`,overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{background:C.surfaceAlt}}>
          {["Produit","SKU","Collection",`Prix ${pm}`,"Coût","Marge","TVA","Stock","Var.","Actions"].map(h=>(
            <th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:700,color:C.textMuted,fontSize:9,borderBottom:`2px solid ${C.border}`}}>{h}</th>))}</tr></thead>
        <tbody>{filtered.map(q=>{const ts=q.variants.reduce((s,v)=>s+v.stock,0);const mg=q.costPrice?((q.price-q.costPrice)/q.price*100):0;
          return(<tr key={q.id} style={{borderBottom:`1px solid ${C.border}`,cursor:"pointer"}} onClick={()=>openEdit(q)}>
            <td style={{padding:"6px 10px",fontWeight:600}}>{q.name}</td>
            <td style={{padding:"6px 10px",fontFamily:"monospace",color:C.textMuted}}>{q.sku}</td>
            <td style={{padding:"6px 10px"}}><Badge color={C.info}>{q.collection||"—"}</Badge></td>
            <td style={{padding:"6px 10px",fontWeight:700,color:C.primary}}>{q.price.toFixed(2)}€</td>
            <td style={{padding:"6px 10px",color:C.textMuted}}>{q.costPrice?.toFixed(2)||"—"}€</td>
            <td style={{padding:"6px 10px"}}><Badge color={mg>50?"#059669":mg>30?C.accent:C.danger}>{mg.toFixed(0)}%</Badge></td>
            <td style={{padding:"6px 10px"}}>{(q.taxRate*100).toFixed(0)}%</td>
            <td style={{padding:"6px 10px",fontWeight:700,color:ts<=5?C.danger:C.text}}>{ts}</td>
            <td style={{padding:"6px 10px"}}>{q.variants.length}</td>
            <td style={{padding:"6px 10px"}} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>openEdit(q)} style={{background:"none",border:"none",cursor:"pointer",color:C.primary,fontSize:10,fontWeight:600}}>Modifier</button>
                <button onClick={()=>duplicateProduct(q.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.info,fontSize:10,fontWeight:600}}>Dupliquer</button>
                <button onClick={()=>setConfirmDel(q)} style={{background:"none",border:"none",cursor:"pointer",color:C.danger,fontSize:10,fontWeight:600}}>Suppr.</button>
              </div></td></tr>);})}</tbody></table></div>

    {/* Edit product modal */}
    <Modal open={!!editModal} onClose={()=>setEditModal(null)} title={`Modifier — ${editModal?.name}`} wide>
      {editModal&&<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>NOM</label><Input value={ep.name||""} onChange={e=>setEp(p=>({...p,name:e.target.value}))}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>SKU</label><Input value={ep.sku||""} onChange={e=>setEp(p=>({...p,sku:e.target.value}))}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>PRIX VENTE {pm} (€)</label><Input type="number" step="0.01" value={ep.price||""} onChange={e=>setEp(p=>({...p,price:e.target.value}))}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>PRIX ACHAT (€)</label><Input type="number" step="0.01" value={ep.costPrice||""} onChange={e=>setEp(p=>({...p,costPrice:e.target.value}))}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>TVA</label>
            <select value={ep.taxRate||"0.20"} onChange={e=>setEp(p=>({...p,taxRate:e.target.value}))} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
              {(tvaRates||DEFAULT_TVA_RATES).map(t=>(<option key={t.id} value={t.rate}>{t.label}</option>))}</select></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>CATÉGORIE</label>
            <select value={ep.category||""} onChange={e=>setEp(p=>({...p,category:e.target.value}))} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
              {categories.filter(c=>c!=="Tous").map(c=>(<option key={c} value={c}>{c}</option>))}</select></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>COLLECTION</label><Input value={ep.collection||""} onChange={e=>setEp(p=>({...p,collection:e.target.value}))}/></div></div>

        {/* Variants list */}
        <div style={{fontSize:12,fontWeight:700,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>Variantes ({editModal.variants.length})</span>
          <Btn variant="outline" onClick={()=>{setAddVarModal(editModal.id);setNewVar({color:"",size:"",ean:"",stock:"0",stockAlert:"5"});}} style={{fontSize:10,padding:"4px 10px"}}><Plus size={11}/> Variante</Btn></div>
        <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:14}}>
          {editModal.variants.map(v=>(<div key={v.id} style={{display:"flex",alignItems:"center",gap:8,padding:6,borderRadius:8,border:`1px solid ${C.border}`,fontSize:11}}>
            <Badge color={C.primary}>{v.color}</Badge><Badge color={C.info}>{v.size}</Badge>
            <span style={{color:C.textMuted,fontFamily:"monospace",fontSize:9}}>{v.ean||"—"}</span>
            <span style={{marginLeft:"auto",fontWeight:700,color:v.stock<=0?C.danger:v.stock<=(v.stockAlert||5)?C.warn:C.primary}}>Stock: {v.stock}</span>
            <button onClick={()=>{if(deleteVariant(editModal.id,v.id)){
              setEditModal(prev=>prev?{...prev,variants:prev.variants.filter(x=>x.id!==v.id)}:null);}}}
              style={{background:"none",border:"none",cursor:"pointer",color:C.danger,fontSize:9}}>
              <Trash2 size={11}/></button>
          </div>))}</div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <Btn variant="success" onClick={()=>{
            const newPrice=parseFloat(ep.price);const oldPrice=editModal.price;
            updateProduct(editModal.id,{name:ep.name,sku:ep.sku,costPrice:parseFloat(ep.costPrice)||0,
              taxRate:parseFloat(ep.taxRate),category:ep.category,collection:ep.collection});
            if(newPrice&&newPrice!==oldPrice)updateProductPrice(editModal.id,newPrice);
            setEditModal(null);}} style={{height:40}}>
            <Save size={14}/> Enregistrer</Btn>
          <Btn variant="outline" onClick={()=>{printBarcodeLabels(editModal,settings);notify("Impression étiquettes lancée","success");}} style={{height:40,color:C.accent,borderColor:C.accent+"44"}}>
            <ScanLine size={14}/> Étiquettes</Btn>
          <Btn variant="danger" onClick={()=>{setEditModal(null);setConfirmDel(editModal);}} style={{height:40}}>
            <Trash2 size={14}/> Supprimer</Btn></div>
      </>}
    </Modal>

    {/* Add variant modal */}
    <Modal open={!!addVarModal} onClose={()=>setAddVarModal(null)} title="Ajouter une variante">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>COULEUR</label><Input value={newVar.color} onChange={e=>setNewVar(v=>({...v,color:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>TAILLE</label><Input value={newVar.size} onChange={e=>setNewVar(v=>({...v,size:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>EAN</label><Input value={newVar.ean} onChange={e=>setNewVar(v=>({...v,ean:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>STOCK INITIAL</label><Input type="number" value={newVar.stock} onChange={e=>setNewVar(v=>({...v,stock:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>SEUIL ALERTE</label><Input type="number" value={newVar.stockAlert} onChange={e=>setNewVar(v=>({...v,stockAlert:e.target.value}))}/></div></div>
      <Btn onClick={()=>{if(newVar.color&&newVar.size){
        addVariantToProduct(addVarModal,{color:newVar.color,size:newVar.size,ean:newVar.ean||"",stock:parseInt(newVar.stock)||0,stockAlert:parseInt(newVar.stockAlert)||5});
        setAddVarModal(null);}}} style={{width:"100%",height:40,background:C.primary}}>Ajouter la variante</Btn></Modal>

    {/* Delete confirmation */}
    <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={()=>{if(confirmDel)deleteProduct(confirmDel.id);}}
      title="Supprimer ce produit ?" message={`Êtes-vous sûr de supprimer "${confirmDel?.name}" (${confirmDel?.sku}) ? Cette action est irréversible. Le stock doit être à 0.`}/>

    {/* Create product modal */}
    <Modal open={createModal} onClose={()=>setCreateModal(false)} title="Nouveau produit" wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>NOM</label><Input value={np.name} onChange={e=>setNp(p=>({...p,name:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>SKU</label><Input value={np.sku} onChange={e=>setNp(p=>({...p,sku:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>PRIX VENTE {pm} (€)</label><Input type="number" step="0.01" value={np.price} onChange={e=>setNp(p=>({...p,price:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>PRIX ACHAT (€)</label><Input type="number" step="0.01" value={np.costPrice} onChange={e=>setNp(p=>({...p,costPrice:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>TVA</label>
          <select value={np.taxRate} onChange={e=>setNp(p=>({...p,taxRate:e.target.value}))} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
            {(tvaRates||DEFAULT_TVA_RATES).map(t=>(<option key={t.id} value={t.rate}>{t.label}</option>))}</select></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>CATÉGORIE</label>
          <select value={np.category} onChange={e=>setNp(p=>({...p,category:e.target.value}))} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
            {categories.filter(c=>c!=="Tous").map(c=>(<option key={c} value={c}>{c}</option>))}</select></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>COLLECTION</label><Input value={np.collection} onChange={e=>setNp(p=>({...p,collection:e.target.value}))}/></div></div>
      <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Première variante</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:6,marginBottom:14}}>
        <div><label style={{fontSize:9,color:C.textMuted}}>COULEUR</label><Input value={nv.color} onChange={e=>setNv(v=>({...v,color:e.target.value}))}/></div>
        <div><label style={{fontSize:9,color:C.textMuted}}>TAILLE</label><Input value={nv.size} onChange={e=>setNv(v=>({...v,size:e.target.value}))}/></div>
        <div><label style={{fontSize:9,color:C.textMuted}}>EAN</label><Input value={nv.ean} onChange={e=>setNv(v=>({...v,ean:e.target.value}))}/></div>
        <div><label style={{fontSize:9,color:C.textMuted}}>STOCK</label><Input type="number" value={nv.stock} onChange={e=>setNv(v=>({...v,stock:e.target.value}))}/></div>
        <div><label style={{fontSize:9,color:C.textMuted}}>ALERTE</label><Input type="number" value={nv.stockAlert} onChange={e=>setNv(v=>({...v,stockAlert:e.target.value}))}/></div></div>
      <Btn onClick={()=>{if(np.name&&np.sku&&np.price){
        addProduct({name:np.name,sku:np.sku,price:parseFloat(np.price),costPrice:parseFloat(np.costPrice)||0,
          taxRate:parseFloat(np.taxRate),category:np.category,collection:np.collection,
          variants:[{id:`v${Date.now()}`,color:nv.color||"Défaut",size:nv.size||"TU",ean:nv.ean||"",
            stock:parseInt(nv.stock)||0,defective:0,stockAlert:parseInt(nv.stockAlert)||5}]});
        setCreateModal(false);setNp({name:"",sku:"",price:"",costPrice:"",taxRate:"0.20",category:"T-shirts",collection:"PE-2026"});
        setNv({color:"",size:"",ean:"",stock:"",stockAlert:"5"});}}}
        style={{width:"100%",height:44,background:C.primary}}>Créer le produit</Btn></Modal>

    {/* CSV Import Wizard */}
    <CSVImportWizard open={importWizardOpen} onClose={()=>setImportWizardOpen(false)} existingProducts={products}
      onImportComplete={(apiProds,localProds,localUpdates)=>{
        if(apiProds){setProducts(norm.products(apiProds));}
        else{
          setProducts(p=>{let updated=[...p];
            // Apply local updates to existing products
            if(localUpdates){localUpdates.forEach(lu=>{const idx=updated.findIndex(x=>x.id===lu.id);if(idx>=0)updated[idx]=norm.product(lu);});}
            // Add new products
            if(localProds)updated=[...updated,...localProds.map(norm.product)];
            return updated;
          });
        }
        setImportWizardOpen(false);addAudit("IMPORT","Import CSV terminé");notify("Import CSV terminé","success");
      }}/>
  </div>);
}

/* ══════════ SETTINGS ══════════ */
function ReturnsHistoryScreen(){
  const{avoirs,tickets,notify,settings,setSettings,saveSettingsToAPI,addAudit}=useApp();
  const[filter,setFilter]=useState("all");const[search,setSearch]=useState("");
  const[tab,setTab]=useState(avoirs.length>0?"history":"settings");
  const sorted=[...avoirs].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const filtered=sorted.filter(a=>{
    if(filter==="avoir"&&a.refundMethod!=="avoir")return false;
    if(filter==="cash"&&a.refundMethod!=="cash")return false;
    if(filter==="card"&&a.refundMethod!=="card")return false;
    if(filter==="exchange"&&a.refundMethod!=="exchange")return false;
    if(search){const s=search.toLowerCase();return(a.code||"").toLowerCase().includes(s)||(a.reason||"").toLowerCase().includes(s)||(a.items||[]).some(it=>(it.name||"").toLowerCase().includes(s));}
    return true;
  });
  const totalReturns=avoirs.length;
  const totalValue=avoirs.reduce((s,a)=>s+(a.amount||0),0);
  const totalItems=avoirs.reduce((s,a)=>s+(a.items||[]).reduce((ss,it)=>ss+(it.qty||1),0),0);
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
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MONTANT MAX SANS APPROBATION (€)</label>
            <Input type="number" value={settings.returnPolicy?.maxNoApproval||100} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,maxNoApproval:parseFloat(e.target.value)||100}}))}/></div></div>
        <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>CONDITIONS DE RETOUR</label>
          <textarea value={settings.returnPolicy?.conditions||""} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,conditions:e.target.value}}))}
            style={{width:"100%",height:60,padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit",resize:"vertical"}}
            placeholder="Article non porté, étiquette présente…"/></div>
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
      {filtered.map(a=>(<div key={a.id||a.code} style={{padding:12,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:40,height:40,borderRadius:10,background:C.dangerLight,display:"flex",alignItems:"center",justifyContent:"center"}}><RotateCcw size={16} color={C.danger}/></div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:13,fontWeight:700}}>{a.code||"RET-"+String(a.id).slice(-6)}</span>
            <Badge color={a.refundMethod==="avoir"?C.primary:a.refundMethod==="cash"?C.accent:a.refundMethod==="card"?C.info:"#8B5CF6"}>
              {a.refundMethod==="avoir"?"Avoir":a.refundMethod==="cash"?"Espèces":a.refundMethod==="card"?"Carte":"Échange"}</Badge>
            {a.originalTicket&&<span style={{fontSize:10,color:C.textMuted}}>Ticket: {a.originalTicket}</span>}</div>
          <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>
            {(a.items||[]).map(it=>`${it.name}${it.variant?" ("+it.variant+")":""}${it.qty>1?" x"+it.qty:""}`).join(", ")}
            {a.reason&&<span> — {a.reason}</span>}</div></div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:14,fontWeight:800,color:C.danger}}>{(a.amount||0).toFixed(2)}€</div>
          <div style={{fontSize:10,color:C.textMuted}}>{new Date(a.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
        </div>
      </div>))}
    </div>
    </>}
  </div>);
}

function SizeSettingsTab({notify}){
  const[newSizeInput,setNewSizeInput]=useState("");
  const ranking=getSizeRanking();
  const entries=Object.entries(ranking).sort((a,b)=>a[1]-b[1]);
  const csvMap=getVariantOrderMap();
  const csvProductCount=Object.keys(csvMap).length;

  const updateRank=(size,newRank)=>{const r={...ranking,[size]:parseFloat(newRank)||0};saveSizeRanking(r);notify("Ranking sauvegardé","success");};
  const removeSize=(size)=>{const r={...ranking};delete r[size];saveSizeRanking(r);notify("Taille supprimée","success");};
  const addSize=()=>{if(!newSizeInput.trim())return;
    const key=newSizeInput.toUpperCase().trim();if(ranking[key]!=null){notify("Cette taille existe déjà","error");return;}
    const maxR=entries.length?Math.max(...entries.map(e=>e[1]))+1:1;
    const r={...ranking,[key]:maxR};saveSizeRanking(r);setNewSizeInput("");notify("Taille ajoutée","success");};
  const resetToDefault=()=>{saveSizeRanking({...DEFAULT_SIZE_RANKING});notify("Ranking réinitialisé aux valeurs par défaut","info");};

  return(<div style={{maxWidth:650}}>
    <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <Grid size={20} color={C.primary}/>
        <div><h3 style={{fontSize:16,fontWeight:800,margin:0}}>Ranking des tailles</h3>
          <p style={{fontSize:11,color:C.textMuted,margin:0}}>Ordre par défaut des tailles (S=3, M=4, L=5...). Utilisé quand un produit n'a pas d'ordre CSV spécifique.</p></div></div></div>

    <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <h4 style={{fontSize:13,fontWeight:700,margin:0}}>Tailles et positions ({entries.length})</h4>
        <div style={{display:"flex",gap:6}}>
          <Input value={newSizeInput} onChange={e=>setNewSizeInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSize()} placeholder="Ex: 3XL" style={{width:80,height:28,fontSize:10,padding:"2px 6px"}}/>
          <Btn variant="outline" onClick={addSize} style={{fontSize:10,padding:"4px 10px"}}><Plus size={11}/> Ajouter</Btn>
          <Btn variant="outline" onClick={resetToDefault} style={{fontSize:10,padding:"4px 10px",borderColor:C.danger+"44",color:C.danger}}><RotateCcw size={11}/> Défaut</Btn></div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:6}}>
        {entries.map(([size,rank])=>(
          <div key={size} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:10,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
            <span style={{fontSize:13,fontWeight:700,minWidth:40}}>{size}</span>
            <span style={{fontSize:10,color:C.textMuted}}>=</span>
            <input type="number" value={rank} onChange={e=>updateRank(size,e.target.value)}
              style={{width:45,padding:"3px 5px",borderRadius:6,border:`1.5px solid ${C.border}`,fontSize:12,fontWeight:600,textAlign:"center",fontFamily:"inherit"}}/>
            <button onClick={()=>removeSize(size)} style={{width:20,height:20,borderRadius:5,border:"none",background:C.dangerLight,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><X size={10} color={C.danger}/></button>
          </div>))}
      </div>
    </div>

    {csvProductCount>0&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div><h4 style={{fontSize:13,fontWeight:700,margin:0}}>Ordre CSV par produit</h4>
          <p style={{fontSize:10,color:C.textMuted,margin:0}}>{csvProductCount} produit(s) avec un ordre CSV spécifique (prioritaire sur le ranking)</p></div>
        <Btn variant="outline" onClick={()=>{saveVariantOrderMap({});notify("Ordres CSV réinitialisés","info");}} style={{fontSize:10,padding:"4px 10px",borderColor:C.danger+"44",color:C.danger}}><RotateCcw size={11}/> Effacer CSV</Btn></div>
      <div style={{maxHeight:150,overflowY:"auto"}}>
        {Object.entries(csvMap).slice(0,20).map(([sku,order])=>(
          <div key={sku} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:`1px solid ${C.border}`,fontSize:11}}>
            <span style={{fontWeight:700,minWidth:100}}>{sku}</span>
            <span style={{color:C.textMuted,flex:1}}>{order.map(k=>k.includes("|")?k.split("|")[1]:k).join(" → ")}</span>
          </div>))}
        {csvProductCount>20&&<div style={{fontSize:10,color:C.textMuted,padding:6}}>… et {csvProductCount-20} autres</div>}
      </div>
    </div>}

    <div style={{background:C.warnLight,borderRadius:12,padding:14,border:`1px solid ${C.warn}33`,display:"flex",gap:10,alignItems:"start"}}>
      <AlertTriangle size={16} color={C.warn} style={{flexShrink:0,marginTop:2}}/>
      <div style={{fontSize:11,color:"#92400E",lineHeight:1.5}}>
        <strong>Priorité :</strong> L'import CSV définit l'ordre pour chaque produit importé (prioritaire). Pour les produits sans import CSV, le ranking ci-dessus est utilisé (S avant M avant L, etc.).
        Tout est synchronisé avec le backend.</div></div>
  </div>);
}

/* ══════════ DEBUG PANEL — Full diagnostic suite for Sunmi T2s ══════════ */
function DebugPanel(){
  const{tickets,printerConnected,hwId,paymentId,paymentConfig,settings,avoirs,closures}=useApp();
  const[logs,setLogs]=useState([]);
  const[running,setRunning]=useState(false);
  const[debugTab,setDebugTab]=useState("general");
  const[tpeIp,setTpeIp]=useState(paymentConfig?.tpeHost||"");
  const[tpePort,setTpePort]=useState(paymentConfig?.tpePort||"8888");
  const[tpeAmount,setTpeAmount]=useState("1.00");
  const logRef=React.useRef(null);

  const addLog=(msg,type="info")=>{
    const ts=new Date().toLocaleTimeString("fr-FR");
    setLogs(prev=>[...prev,{ts,msg,type}].slice(-200));
    setTimeout(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},50);
  };
  const clearLogs=()=>setLogs([]);

  // ══════════════════════════════════════════════
  // GENERAL DIAGNOSTIC
  // ══════════════════════════════════════════════
  const runDiag=async()=>{
    setRunning(true);clearLogs();
    addLog("=== DIAGNOSTIC COMPLET ===","title");
    addLog(`Hardware ID: ${hwId}`);
    addLog(`User Agent: ${navigator.userAgent.substring(0,100)}`);
    addLog(`Capacitor: ${!!window.Capacitor} | Native: ${!!window.Capacitor?.isNativePlatform?.()}`);
    addLog(`Plugins: ${Object.keys(window.Capacitor?.Plugins||{}).join(", ")||"AUCUN"}`);
    addLog(`Mode paiement: ${paymentId} | Config: ${JSON.stringify(paymentConfig||{})}`);
    addLog(`Tickets: ${tickets?.length||0} | Avoirs: ${avoirs?.length||0} | Clotures: ${closures?.length||0}`);

    try{
      const hm=(await import("./hardware.js")).default;
      addLog("--- Hardware Manager ---","title");
      addLog(`Printer: ${hm.printer?.constructor?.name} | connected: ${hm.printer?.connected} | isCapacitor: ${hm.printer?._isCapacitor}`);
      addLog(`Payment: ${hm.payment?.constructor?.name} | paymentId: ${hm.paymentId}`);
      addLog(`Scanner: ${hm.scanner?"OUI":"NON"} | Drawer: ${hm.cashDrawer?"OUI":"NON"}`);
    }catch(e){addLog(`HM error: ${e.message}`,"error");}

    addLog("--- Erreurs JS en memoire ---","title");
    const errs=window.__CAISSEPRO_ERRORS||[];
    addLog(`${errs.length} erreur(s) capturee(s)`,errs.length>0?"error":"success");
    errs.slice(-5).forEach(e=>addLog(`  ${e.msg}`,"error"));

    addLog("=== FIN ===","title");
    setRunning(false);
  };

  // ══════════════════════════════════════════════
  // PRINTER TESTS
  // ══════════════════════════════════════════════
  const testPrinterStatus=async()=>{
    setRunning(true);clearLogs();
    addLog("=== DIAGNOSTIC IMPRIMANTE ===","title");
    const sp=window.Capacitor?.Plugins?.SunmiPrinter;
    if(!sp){addLog("Plugin SunmiPrinter ABSENT","error");setRunning(false);return;}
    addLog(`Methods: ${Object.keys(sp).filter(k=>typeof sp[k]==="function").join(", ")}`);
    try{
      const st=await sp.getStatus();
      addLog(`Status complet: ${JSON.stringify(st,null,1)}`);
      const stateColors={1:"success",2:"error",3:"error",4:"error",5:"error"};
      addLog(`Etat: ${st.printerState} = ${st.printerStateLabel}`,stateColors[st.printerState]||"info");
      if(st.printerState===2){
        addLog("PREPARING = imprimante pas prete.","error");
        addLog("Tentative d attente (10s max)...","info");
        try{
          const wr=await sp.waitForReady({timeout:10000});
          if(wr.ready)addLog(`Prete apres ${wr.waitedMs}ms!`,"success");
          else addLog(`Toujours pas prete apres ${wr.waitedMs}ms (state=${wr.state})`,"error");
        }catch(e){addLog(`waitForReady erreur: ${e.message}`,"error");}
      }
      if(st.printerState===1)addLog("NORMAL = imprimante prete!","success");
    }catch(e){addLog(`Erreur: ${e.message}`,"error");}
    setRunning(false);
  };

  const testSelfCheck=async()=>{
    setRunning(true);clearLogs();
    addLog("=== SELF-CHECK HARDWARE ===","title");
    addLog("Ceci lance la page de test interne de l imprimante Sunmi.","info");
    addLog("Si RIEN ne sort: le papier est a l envers!","warn");
    addLog("Si une page sort: le hardware marche, probleme logiciel.","info");
    const sp=window.Capacitor?.Plugins?.SunmiPrinter;
    if(!sp){addLog("Plugin SunmiPrinter ABSENT","error");setRunning(false);return;}
    try{
      const r=await sp.selfCheck();
      addLog(`Resultat: ${JSON.stringify(r)}`,"success");
      addLog("Regardez l imprimante...","title");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}
    setRunning(false);
  };

  const testPrinterPrint=async()=>{
    setRunning(true);clearLogs();
    addLog("=== TEST IMPRESSION (5 methodes) ===","title");
    const sp=window.Capacitor?.Plugins?.SunmiPrinter;
    if(!sp){addLog("Plugin absent","error");setRunning(false);return;}

    // Check state first
    try{const st=await sp.getStatus();addLog(`Etat: ${st.printerState} (${st.printerStateLabel})`);}catch(e){}

    // Method 1: testPrint natif
    addLog("--- Methode 1: testPrint() natif ---","title");
    try{const r=await sp.testPrint({});addLog(`Resultat: ${JSON.stringify(r)}`,"success");}
    catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Method 2: printBatch
    addLog("--- Methode 2: printBatch() ---","title");
    try{const r=await sp.printBatch({commands:[
      {cmd:"text",text:"=== PRINTBATCH TEST ===\n"},{cmd:"text",text:`Date: ${new Date().toLocaleString("fr-FR")}\n`},
      {cmd:"text",text:"Si ce texte sort, printBatch marche!\n"},{cmd:"feed",lines:4},{cmd:"cut"}
    ]});addLog(`Resultat: ${JSON.stringify(r)}`,"success");}
    catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Method 3: printText simple
    addLog("--- Methode 3: printText() simple ---","title");
    try{await sp.printerInit({});await sp.printText({text:"TEST PRINTTEXT SIMPLE\n"});await sp.lineWrap({lines:4});addLog("OK (pas d'erreur)","success");}
    catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Method 4: sendRAWData ESC/POS brut
    addLog("--- Methode 4: sendRAWData() ESC/POS brut ---","title");
    try{
      // Build raw ESC/POS: init + text + feed
      const text="TEST ESC/POS RAW - Texte brut!\n";
      const bytes=[];
      bytes.push(0x1B,0x40); // ESC @ init
      for(let i=0;i<text.length;i++)bytes.push(text.charCodeAt(i));
      bytes.push(0x1B,0x64,0x04); // ESC d 4 = feed 4 lines
      const b64=btoa(String.fromCharCode(...bytes));
      await sp.sendRAWData({data:b64});
      addLog("OK (pas d'erreur)","success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Method 5: reconnect then print
    addLog("--- Methode 5: reconnect + printBatch ---","title");
    try{
      addLog("Reconnexion...");
      await sp.reconnect();
      await new Promise(r=>setTimeout(r,3000));
      const st=await sp.getStatus();
      addLog(`Etat apres reconnect: ${st.printerState} (${st.printerStateLabel})`);
      const r=await sp.printBatch({commands:[
        {cmd:"text",text:"=== APRES RECONNECT ===\n"},{cmd:"text",text:"Impression post-reconnexion\n"},{cmd:"feed",lines:4}
      ]});addLog(`Resultat: ${JSON.stringify(r)}`,"success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    addLog("--- VERDICT ---","title");
    addLog("Si AUCUN texte n'est sorti malgre tous les 'success':","error");
    addLog("1. RETOURNEZ LE PAPIER dans l'imprimante","error");
    addLog("2. Grattez le papier avec l'ongle: le cote qui noircit = face vers le haut","error");
    addLog("3. Ouvrez/fermez le couvercle","error");
    addLog("4. Redemarrez completement la Sunmi T2s","error");
    setRunning(false);
  };

  // ══════════════════════════════════════════════
  // TPE / CONCERT PROTOCOL TESTS
  // ══════════════════════════════════════════════
  const testTpePlugin=async()=>{
    setRunning(true);clearLogs();
    addLog("=== DIAGNOSTIC TPE ===","title");

    // 1. Check plugins
    addLog("--- Plugins disponibles ---","title");
    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    const pt=window.Capacitor?.Plugins?.PaymentTerminal;
    addLog(`ConcertProtocol: ${cp?"OUI":"NON"}`);
    addLog(`PaymentTerminal: ${pt?"OUI":"NON"}`);
    if(cp)addLog(`Concert methods: ${Object.keys(cp).filter(k=>typeof cp[k]==="function").join(", ")}`);
    if(pt)addLog(`Payment methods: ${Object.keys(pt).filter(k=>typeof pt[k]==="function").join(", ")}`);

    // 2. Payment config
    addLog("--- Configuration paiement ---","title");
    addLog(`Mode actif: ${paymentId}`);
    addLog(`Config: ${JSON.stringify(paymentConfig||{})}`);
    addLog(`IP TPE: ${paymentConfig?.tpeHost||"NON CONFIGURE"}`);
    addLog(`Port TPE: ${paymentConfig?.tpePort||"8888 (defaut)"}`);

    // 3. Hardware detection
    if(pt){
      addLog("--- Detection hardware paiement ---","title");
      try{
        const hw=await pt.detectHardware();
        addLog(`Hardware: ${JSON.stringify(hw,null,1)}`,"success");
      }catch(e){addLog(`detectHardware erreur: ${e.message}`,"error");}
    }

    // 4. HardwareManager payment state
    addLog("--- Hardware Manager state ---","title");
    try{
      const hm=(await import("./hardware.js")).default;
      addLog(`Payment adapter: ${hm.payment?.constructor?.name}`);
      addLog(`Payment connected: ${hm.payment?.connected}`);
      addLog(`Payment config: ${JSON.stringify(hm.paymentConfig)}`);
    }catch(e){addLog(`HM error: ${e.message}`,"error");}

    setRunning(false);
  };

  const testTpePing=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    if(!host){addLog("Entrez l'adresse IP du TPE ci-dessus!","error");setRunning(false);return;}

    addLog(`=== PING TPE ${host}:${port} ===`,"title");
    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin ConcertProtocol ABSENT!","error");setRunning(false);return;}

    // Test 1: Ping TCP
    addLog("Test 1: Connexion TCP...");
    try{
      const r=await cp.ping({host,port});
      addLog(`Resultat: ${JSON.stringify(r)}`,r.success?"success":"error");
      if(r.success)addLog("Le TPE repond sur le reseau!","success");
      else addLog(`Echec: ${r.error}`,"error");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Test 2: Try different ports
    addLog("Test 2: Scan des ports courants...","title");
    const ports=[8888,9100,20000,23,4000,5000,6000,7000,9000,10000];
    for(const p of ports){
      try{
        const r=await cp.ping({host,port:p});
        addLog(`  Port ${p}: ${r.success?"OUVERT":"ferme"}`,r.success?"success":"info");
      }catch(e){addLog(`  Port ${p}: erreur (${e.message})`,"info");}
    }

    // Test 3: Try alternate IPs on same subnet
    addLog("Test 3: Scan reseau local...","title");
    const subnet=host.split(".").slice(0,3).join(".");
    const lastOctet=parseInt(host.split(".")[3])||100;
    const ipsToTry=[lastOctet-1,lastOctet+1,lastOctet-2,lastOctet+2,1,254].filter(x=>x>0&&x<255&&x!==lastOctet);
    for(const oct of ipsToTry.slice(0,4)){
      const ip=`${subnet}.${oct}`;
      try{
        const r=await cp.ping({host:ip,port});
        addLog(`  ${ip}:${port} = ${r.success?"REPOND":"pas de reponse"}`,r.success?"success":"info");
      }catch(e){addLog(`  ${ip}:${port} = timeout`,"info");}
    }

    setRunning(false);
  };

  const testTpeSale=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    const amount=Math.round(parseFloat(tpeAmount)*100)||100;
    if(!host){addLog("Entrez l'adresse IP du TPE!","error");setRunning(false);return;}

    addLog(`=== TEST TRANSACTION ${(amount/100).toFixed(2)} EUR ===`,"title");
    addLog(`TPE: ${host}:${port}`);
    addLog(`Montant: ${amount} centimes`);

    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin ConcertProtocol ABSENT!","error");setRunning(false);return;}

    // Step 1: Ping first
    addLog("Etape 1: Verification connexion...");
    try{
      const ping=await cp.ping({host,port});
      if(!ping.success){addLog(`TPE non joignable: ${ping.error}`,"error");setRunning(false);return;}
      addLog("Connexion OK","success");
    }catch(e){addLog(`Ping erreur: ${e.message}`,"error");setRunning(false);return;}

    // Step 2: Send sale (V3 by default)
    addLog("Etape 2: Envoi transaction sale() en Caisse-AP V3...","title");
    addLog("Format: TLV (Tag-Length-Value) sur TCP/IP — port 8888");
    addLog("En attente de reponse du TPE (jusqu'a 3 min)...");
    addLog("Presentez la carte sur le terminal...");
    try{
      const r=await cp.sale({host,port,amount,currency:"EUR",reference:`DBG-${Date.now()}`,protocol:"v3"});
      addLog(`Protocole: ${r.protocol||"?"}`);
      addLog(`REPONSE TPE:`,r.success?"success":"error");
      // Display all fields clearly
      if(r.success){
        addLog("TRANSACTION ACCEPTEE!","success");
        if(r.authCode)addLog(`Code autorisation: ${r.authCode}`,"success");
        if(r.amount)addLog(`Montant confirme: ${r.amount} centimes`,"success");
        if(r.maskedPan)addLog(`Carte: ${r.maskedPan}`,"success");
        if(r.paymentLabel)addLog(`Type paiement: ${r.paymentLabel}`,"success");
        if(r.contactless!==undefined)addLog(`Sans contact: ${r.contactless?"OUI":"NON"}`,"success");
        if(r.cardExpiry)addLog(`Expiration: ${r.cardExpiry}`);
        if(r.applicationId)addLog(`AID: ${r.applicationId}`);
        if(r.contractNumber)addLog(`Contrat: ${r.contractNumber}`);
      }else{
        addLog(`TRANSACTION ECHOUEE: ${r.error||r.errorLabel||r.status}`,"error");
        addLog(`Status: ${r.status} | Code: ${r.statusCode}`);
        if(r.errorCode)addLog(`Code erreur: ${r.errorCode} = ${r.errorLabel}`,"error");
      }
      if(r.rawResponse)addLog(`Reponse brute: ${r.rawResponse}`);
      if(r.privateData)addLog(`Donnees privees: ${r.privateData}`);
      // Show parsed tags if available
      if(r.tags){
        addLog("Tags TLV parses:","title");
        Object.entries(r.tags).forEach(([k,v])=>addLog(`  ${k} = ${v}`));
      }
      if(r.lrcValid!==undefined)addLog(`LRC valide: ${r.lrcValid}`,r.lrcValid?"success":"error");
    }catch(e){
      addLog(`ERREUR TRANSACTION: ${e.message}`,"error");
      addLog("Verifiez que le TPE est en mode attente (ecran principal)","info");
      addLog("Verifiez que 'Connexion Caisse' est Active sur le TPE","info");
      addLog("Verifiez que le port est bien 8888","info");
    }
    setRunning(false);
  };

  const testTpeRefund=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    const amount=Math.round(parseFloat(tpeAmount)*100)||100;
    if(!host){addLog("Entrez l'adresse IP du TPE!","error");setRunning(false);return;}

    addLog(`=== TEST REMBOURSEMENT ${(amount/100).toFixed(2)} EUR ===`,"title");
    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin absent","error");setRunning(false);return;}

    try{
      const r=await cp.refund({host,port,amount,currency:"EUR"});
      addLog(`REPONSE: ${JSON.stringify(r,null,1)}`);
      addLog(r.success?"REMBOURSEMENT ACCEPTE":"REMBOURSEMENT REFUSE",r.success?"success":"error");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}
    setRunning(false);
  };

  const testTpeCancel=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    addLog(`=== ANNULATION TPE ===`,"title");
    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin absent","error");setRunning(false);return;}
    try{
      const r=await cp.cancel({host,port});
      addLog(`REPONSE: ${JSON.stringify(r,null,1)}`);
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}
    setRunning(false);
  };

  const testTpeRawV3=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    if(!host){addLog("Entrez l'IP du TPE!","error");setRunning(false);return;}

    addLog(`=== TEST CAISSE-AP V3 (TLV) ${host}:${port} ===`,"title");
    addLog("Protocole: Caisse-AP V3 / Concert V3 over TCP/IP");
    addLog("Format: TLV (Tag-Length-Value) — ASCII brut, pas de STX/ETX/LRC");

    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin absent","error");setRunning(false);return;}

    // Build V3 TLV message manually for display (matching what Java sends)
    // Reference: github.com/akretion/caisse-ap-ip (tested with Desk/5000)
    const amount=Math.round(parseFloat(tpeAmount)*100)||100;
    let amtStr=String(amount);
    if(amtStr.length<2)amtStr="0"+amtStr;
    const buildTag=(t,v)=>`${t}${String(v.length).padStart(3,"0")}${v}`;
    const tlv=buildTag("CZ","0300")+buildTag("CJ","012345678901")+buildTag("CA","01")
      +buildTag("CE","978")+buildTag("BA","0")+buildTag("CD","0")+buildTag("CB",amtStr);

    addLog(`Message TLV construit (${tlv.length} chars):`,"title");
    addLog(`  [${tlv}]`);
    addLog("");
    addLog("Decodage des tags (identique au code akretion/caisse-ap-ip):","title");
    addLog(`  CZ = 0300 (version protocole caisse — le TPE repond avec sa version 0301)`);
    addLog(`  CJ = 012345678901 (identifiant protocole Concert — OBLIGATOIRE)`);
    addLog(`  CA = 01 (numero de caisse)`);
    addLog(`  CE = 978 (devise: EUR)`);
    addLog(`  BA = 0 (mode reponse: attendre fin transaction)`);
    addLog(`  CD = 0 (action: 0=debit, 1=remboursement)`);
    addLog(`  CB = ${amtStr} (montant en centimes = ${(amount/100).toFixed(2)} EUR)`);
    addLog(`  (PAS de CF — le code de reference n'en envoie pas)`);

    // Also show what V2 would look like for comparison
    addLog("");
    addLog("=== Comparaison Concert V2 (ancien format) ===","title");
    const v2msg=`01${String(amount).padStart(8,"0")}110978          A010B010`;
    addLog(`V2 (34 octets): [${v2msg}]`);
    addLog("Le Desk/5000 en TCP/IP utilise V3 (TLV), PAS V2!");

    addLog("");
    addLog("=== Envoi test V3 via sale() ===","title");
    addLog("En attente de reponse du TPE (presentez la carte)...");
    try{
      const r=await cp.sale({host,port,amount,currency:"EUR",reference:`DBG-${Date.now()}`,protocol:"v3"});
      addLog(`Protocole utilise: ${r.protocol||"?"}`);
      addLog(`Reponse complete:`,"title");
      Object.entries(r).forEach(([k,v])=>{
        if(typeof v==="object"&&v!==null){
          addLog(`  ${k}:`);
          Object.entries(v).forEach(([k2,v2])=>addLog(`    ${k2}: ${v2}`));
        }else{
          addLog(`  ${k}: ${v}`,k==="success"?(v?"success":"error"):"info");
        }
      });
      if(r.success)addLog("TRANSACTION ACCEPTEE!","success");
      else addLog(`Transaction echouee: ${r.error||r.errorLabel||"?"}`,"error");
    }catch(e){
      addLog(`ERREUR: ${e.message}`,"error");
      addLog(`Stack: ${e.stack?.substring(0,300)}`,"error");
    }

    addLog("");
    addLog("=== Test envoi V3 brut (sendRawV3) ===","title");
    try{
      if(cp.sendRawV3){
        const r2=await cp.sendRawV3({host,port,message:tlv});
        addLog(`Reponse sendRawV3:`,r2.success?"success":"error");
        Object.entries(r2).forEach(([k,v])=>{
          if(typeof v==="object"&&v!==null){
            addLog(`  ${k}:`);
            Object.entries(v).forEach(([k2,v2])=>addLog(`    ${k2}: ${v2}`));
          }else addLog(`  ${k}: ${v}`);
        });
      }else addLog("sendRawV3 non disponible sur ce plugin","info");
    }catch(e){addLog(`sendRawV3 erreur: ${e.message}`,"error");}

    setRunning(false);
  };

  const testTpeRawV2=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    if(!host){addLog("Entrez l'IP du TPE!","error");setRunning(false);return;}

    addLog(`=== TEST CONCERT V2 (ancien format) ${host}:${port} ===`,"title");
    addLog("ATTENTION: Le Desk/5000 en TCP/IP utilise normalement V3, pas V2!");

    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin absent","error");setRunning(false);return;}

    const amount=Math.round(parseFloat(tpeAmount)*100)||100;
    addLog(`Envoi sale() en mode V2 (STX + 34 octets + ETX + LRC)...`);
    try{
      const r=await cp.sale({host,port,amount,currency:"EUR",reference:"V2TEST",protocol:"v2"});
      addLog(`Reponse:`,r.success?"success":"error");
      Object.entries(r).forEach(([k,v])=>addLog(`  ${k}: ${typeof v==="object"?JSON.stringify(v):v}`));
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}
    setRunning(false);
  };

  // ══════════════════════════════════════════════
  // TICKET MODAL TESTS
  // ══════════════════════════════════════════════
  const testTicketData=async()=>{
    setRunning(true);clearLogs();
    addLog("=== DIAGNOSTIC TICKETS ===","title");
    addLog(`Total tickets: ${tickets?.length||0}`);
    addLog(`Total avoirs: ${avoirs?.length||0}`);

    if(!tickets?.length){addLog("Aucun ticket!","error");setRunning(false);return;}

    // Test first 3 tickets
    const count=Math.min(3,tickets.length);
    for(let idx=0;idx<count;idx++){
      const t=tickets[idx];
      addLog(`--- Ticket ${idx+1}/${count} ---`,"title");
      const fields=[
        ["ticketNumber",t.ticketNumber],["ticket_number",t.ticket_number],
        ["totalTTC",t.totalTTC,"(type:"+typeof t.totalTTC+")"],["total_ttc",t.total_ttc,"(type:"+typeof t.total_ttc+")"],
        ["totalHT",t.totalHT],["totalTVA",t.totalTVA],
        ["userName",t.userName],["user_name",t.user_name],
        ["date",t.date],["created_at",t.created_at],
        ["items",Array.isArray(t.items)?t.items.length+" items":"MANQUANT"],
        ["payments",Array.isArray(t.payments)?t.payments.length+" paiements":"MANQUANT"],
        ["fingerprint",t.fingerprint],["paymentMethod",t.paymentMethod||t.payment_method],
      ];
      fields.forEach(([k,v,extra])=>addLog(`  ${k}: ${v===undefined?"UNDEFINED":v===null?"NULL":v} ${extra||""}`,
        v===undefined||v===null?"error":"success"));

      // Test modal rendering
      addLog("  -- Rendu modal --");
      try{
        const num=t.ticketNumber||t.ticket_number||"?";
        const date=new Date(t.date||t.createdAt||t.created_at).toLocaleString("fr-FR");
        const ttc=(t.totalTTC||parseFloat(t.total_ttc)||0).toFixed(2);
        const ht=(t.totalHT||parseFloat(t.total_ht)||0).toFixed(2);
        const pay=(t.payments||[]).map(p=>`${p.method} ${(p.amount||0).toFixed(2)}`).join(" + ")||t.paymentMethod||"?";
        addLog(`  Rendu OK: #${num} | ${date} | ${ttc}EUR | Paiement: ${pay}`,"success");
      }catch(e){addLog(`  CRASH RENDU: ${e.message}`,"error");}

      // Test items rendering
      if(t.items?.length>0){
        t.items.slice(0,2).forEach((item,i)=>{
          try{
            const name=item.product?.name||item.product_name||"?";
            const ltc=(item.lineTTC||item.line_ttc||(item.unit_price*item.quantity)||0);
            addLog(`  Item ${i}: ${name} x${item.quantity} = ${Number(ltc).toFixed(2)}`,"success");
          }catch(e){addLog(`  Item ${i} CRASH: ${e.message}`,"error");}
        });
      }
    }

    // Test avoirs too
    if(avoirs?.length>0){
      addLog("--- Premier avoir ---","title");
      const a=avoirs[0];
      addLog(`  avoirNumber: ${a.avoirNumber||a.avoir_number}`);
      addLog(`  totalTTC: ${a.totalTTC} (type: ${typeof a.totalTTC})`);
      addLog(`  items: ${Array.isArray(a.items)?a.items.length:"MANQUANT"}`,Array.isArray(a.items)?"success":"error");
      if(a.items?.length>0){
        try{
          const i=a.items[0];
          addLog(`  Item 0: ${i.product?.name||i.product_name||"?"} | lineTTC: ${i.lineTTC||i.line_ttc}`,"success");
        }catch(e){addLog(`  Item 0 CRASH: ${e.message}`,"error");}
      }
    }
    setRunning(false);
  };

  const testJsErrors=()=>{
    clearLogs();
    addLog("=== ERREURS JS CAPTUREES ===","title");
    const errs=window.__CAISSEPRO_ERRORS||[];
    addLog(`Total: ${errs.length} erreur(s)`);
    if(errs.length===0)addLog("Aucune erreur!","success");
    else errs.forEach(e=>{
      addLog(`[${e.ts}] ${e.msg}`,"error");
      if(e.stack)addLog(`  ${e.stack.substring(0,400)}`,"error");
    });
    addLog("--- INSTRUCTIONS ---","title");
    addLog("1. Allez dans l'historique des tickets","info");
    addLog("2. Cliquez sur un ticket pour ouvrir le detail","info");
    addLog("3. Revenez ici et cliquez 'Erreurs JS' a nouveau","info");
    addLog("L'erreur qui empeche l'ouverture sera capturee.","info");
  };

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════
  const colorMap={info:"#94A3B8",success:"#4ADE80",error:"#F87171",title:"#60A5FA",warn:"#FBBF24"};
  const tabStyle=(id)=>({padding:"6px 14px",borderRadius:8,border:`2px solid ${debugTab===id?"#fff":"#334155"}`,
    background:debugTab===id?"#1E293B":"transparent",color:debugTab===id?"#fff":"#94A3B8",
    fontSize:12,fontWeight:700,cursor:"pointer"});

  return(<div style={{maxWidth:750}}>
    <div style={{background:"linear-gradient(135deg,#DC2626,#991B1B)",borderRadius:16,padding:20,marginBottom:16}}>
      <h3 style={{fontSize:18,fontWeight:800,margin:"0 0 4px",color:"#fff"}}>Centre de Debug CaissePro</h3>
      <p style={{fontSize:11,color:"#FCA5A5",margin:0}}>Diagnostic complet — imprimante, TPE, tickets. Faites des screenshots des resultats.</p></div>

    {/* Debug sub-tabs */}
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[{id:"general",l:"General"},{id:"printer",l:"Imprimante"},{id:"tpe",l:"TPE / Concert"},{id:"tickets",l:"Tickets"},{id:"errors",l:`Erreurs (${(window.__CAISSEPRO_ERRORS||[]).length})`}].map(t=>
        <button key={t.id} onClick={()=>{setDebugTab(t.id);clearLogs();}} style={tabStyle(t.id)}>{t.l}</button>)}
    </div>

    {/* === GENERAL TAB === */}
    {debugTab==="general"&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <Btn onClick={runDiag} disabled={running} style={{height:44,background:"#2563EB",fontSize:12,fontWeight:700}}>
        <Activity size={14}/> Diagnostic complet</Btn>
    </div>}

    {/* === PRINTER TAB === */}
    {debugTab==="printer"&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <Btn onClick={testPrinterStatus} disabled={running} style={{height:44,background:"#2563EB",fontSize:12,fontWeight:700}}>
        <Activity size={14}/> Etat imprimante</Btn>
      <Btn onClick={testSelfCheck} disabled={running} style={{height:44,background:"#7C3AED",fontSize:12,fontWeight:700}}>
        <Zap size={14}/> Self-check hardware</Btn>
      <Btn onClick={testPrinterPrint} disabled={running} style={{height:44,background:"#059669",fontSize:12,fontWeight:700}}>
        <Printer size={14}/> Tester 5 methodes</Btn>
    </div>}

    {/* === TPE TAB === */}
    {debugTab==="tpe"&&<>
      <div style={{background:"#1E293B",borderRadius:12,padding:16,marginBottom:12,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"#fff"}}>Configuration TPE Concert</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:"#94A3B8",minWidth:60}}>IP TPE:</span>
          <Input value={tpeIp} onChange={e=>setTpeIp(e.target.value)} placeholder="192.168.1.100"
            style={{flex:1,background:"#0F172A",color:"#fff",border:"1px solid #334155",fontSize:13,fontFamily:"monospace"}}/>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:"#94A3B8",minWidth:60}}>Port:</span>
          <Input value={tpePort} onChange={e=>setTpePort(e.target.value)} placeholder="8888"
            style={{width:100,background:"#0F172A",color:"#fff",border:"1px solid #334155",fontSize:13,fontFamily:"monospace"}}/>
          <span style={{fontSize:11,color:"#94A3B8",minWidth:60}}>Montant:</span>
          <Input value={tpeAmount} onChange={e=>setTpeAmount(e.target.value)} placeholder="1.00"
            style={{width:100,background:"#0F172A",color:"#fff",border:"1px solid #334155",fontSize:13,fontFamily:"monospace"}}/>
          <span style={{fontSize:11,color:"#94A3B8"}}>EUR</span>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <Btn onClick={testTpePlugin} disabled={running} style={{height:44,background:"#2563EB",fontSize:12,fontWeight:700}}>
          <Activity size={14}/> Diagnostic TPE</Btn>
        <Btn onClick={testTpePing} disabled={running} style={{height:44,background:"#7C3AED",fontSize:12,fontWeight:700}}>
          <Wifi size={14}/> Ping + Scan ports</Btn>
        <Btn onClick={testTpeSale} disabled={running} style={{height:44,background:"#059669",fontSize:12,fontWeight:700}}>
          <CreditCard size={14}/> Test paiement</Btn>
        <Btn onClick={testTpeRefund} disabled={running} style={{height:44,background:"#D97706",fontSize:12,fontWeight:700}}>
          <RotateCcw size={14}/> Test remboursement</Btn>
        <Btn onClick={testTpeCancel} disabled={running} style={{height:44,background:"#DC2626",fontSize:12,fontWeight:700}}>
          <XCircle size={14}/> Annuler transaction</Btn>
        <Btn onClick={testTpeRawV3} disabled={running} style={{height:44,background:"#0F172A",border:"2px solid #7C3AED",fontSize:12,fontWeight:700}}>
          <Code size={14}/> Test V3 TLV (recommande)</Btn>
        <Btn onClick={testTpeRawV2} disabled={running} style={{height:44,background:"#0F172A",border:"2px solid #475569",fontSize:12,fontWeight:700}}>
          <Code size={14}/> Test V2 (ancien)</Btn>
      </div>
      <div style={{background:"#1E293B",borderRadius:10,padding:12,marginBottom:12,fontSize:10,color:"#94A3B8",lineHeight:1.6}}>
        <strong style={{color:"#4ADE80",fontSize:12}}>IMPORTANT: Protocole Caisse-AP V3 (Concert V3)</strong><br/>
        Le Desk/5000 en TCP/IP utilise le protocole <strong style={{color:"#fff"}}>Caisse-AP V3</strong> (format TLV), PAS Concert V2!<br/>
        <br/>
        <strong style={{color:"#fff"}}>Configuration Ingenico Desk/5000:</strong><br/>
        1. Appuyez sur le <strong>bouton rond blanc</strong> pour acceder au menu<br/>
        2. Allez dans <strong>PARAM</strong> (en bas a gauche)<br/>
        3. <strong>Panneau de controle</strong> &gt; <strong>Connexion Caisse</strong> &gt; mettre sur <strong>Active</strong><br/>
        4. Selectionnez <strong>IP/Eth</strong> (Ethernet)<br/>
        5. Notez l'adresse IP du terminal (Parametres &gt; Communication &gt; Ethernet)<br/>
        6. Port par defaut: <strong style={{color:"#FBBF24"}}>8888</strong><br/>
        7. Le TPE et la Sunmi T2s doivent etre sur le <strong>meme reseau local</strong><br/>
        8. Le TPE doit etre en <strong>ecran d'attente</strong> (pas dans un menu)<br/>
        <br/>
        <strong style={{color:"#FBBF24"}}>Astuce: Lancez d'abord "Ping + Scan ports" pour trouver le bon port!</strong><br/>
        <strong style={{color:"#60A5FA"}}>Ref: github.com/akretion/caisse-ap-ip (Odoo POS, teste avec Desk/5000)</strong>
      </div>
    </>}

    {/* === TICKETS TAB === */}
    {debugTab==="tickets"&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <Btn onClick={testTicketData} disabled={running} style={{height:44,background:"#D97706",fontSize:12,fontWeight:700}}>
        <Receipt size={14}/> Inspecter tickets</Btn>
      <Btn onClick={testJsErrors} disabled={running} style={{height:44,background:"#DC2626",fontSize:12,fontWeight:700}}>
        <AlertTriangle size={14}/> Erreurs JS</Btn>
    </div>}

    {/* === ERRORS TAB === */}
    {debugTab==="errors"&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <Btn onClick={testJsErrors} style={{height:44,background:"#DC2626",fontSize:12,fontWeight:700}}>
        <AlertTriangle size={14}/> Voir erreurs capturees</Btn>
      <Btn onClick={()=>{window.__CAISSEPRO_ERRORS=[];clearLogs();addLog("Erreurs effacees","success");}}
        style={{height:44,background:"#64748B",fontSize:12}}>Effacer erreurs</Btn>
    </div>}

    {/* === LOG OUTPUT === */}
    <div ref={logRef} style={{background:"#0F172A",borderRadius:12,padding:14,fontFamily:"'Courier New',monospace",fontSize:10,
      color:"#E2E8F0",minHeight:250,maxHeight:600,overflow:"auto",whiteSpace:"pre-wrap",border:"2px solid #1E293B"}}>
      {logs.length===0&&<span style={{color:"#475569"}}>Selectionnez un onglet et lancez un test...</span>}
      {logs.map((l,i)=><div key={i} style={{color:colorMap[l.type]||"#94A3B8",marginBottom:2,borderBottom:l.type==="title"?"1px solid #1E293B":"none",paddingBottom:l.type==="title"?3:0}}>
        <span style={{color:"#475569"}}>[{l.ts}]</span> {l.msg}
      </div>)}
    </div>
    <div style={{display:"flex",gap:8,marginTop:8}}>
      <Btn onClick={clearLogs} style={{height:36,background:"#334155",fontSize:11}}>Effacer logs</Btn>
      <Btn onClick={()=>{
        const text=logs.map(l=>`[${l.ts}] ${l.msg}`).join("\n");
        if(navigator.clipboard)navigator.clipboard.writeText(text).then(()=>addLog("Logs copies!","success"));
        else addLog("Clipboard non disponible","error");
      }} style={{height:36,background:"#334155",fontSize:11}}>Copier logs</Btn>
    </div>
  </div>);
}

function SettingsScreen(){
  const{settings,setSettings,saveSettingsToAPI,addAudit,theme,setTheme,clockEntries,priceHistory,printerConnected,printerType,connectPrinter,disconnectPrinter,thermalPrint,notify,users,hwId,hwProfile,switchHardware,hardwareProfiles,paymentId,paymentConfig,switchPayment,updatePaymentConfig,paymentProfiles}=useApp();
  const[tab,setTab]=useState("general");
  const[printerBaud,setPrinterBaud]=useState("9600");
  const[printerWidth,setPrinterWidth]=useState("48");
  const[connecting,setConnecting]=useState(false);
  const[printerDiag,setPrinterDiag]=useState(null);
  const[diagLoading,setDiagLoading]=useState(false);
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:14}}>Paramètres</h2>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[{id:"general",l:"Général"},{id:"retouche",l:"✂️ Retouches"},{id:"pricing",l:"💰 Prix HT/TTC"},{id:"commission",l:"Commission"},{id:"stores",l:"Magasins"},{id:"printer",l:"Imprimante"},{id:"tpe",l:"Terminal paiement"},{id:"receipt",l:"Ticket"},{id:"screen2",l:"📺 Écran 2"},{id:"caticons",l:"🏷️ Icônes catégories"},{id:"return",l:"Retours"},{id:"sizes",l:"📏 Ordre tailles"},{id:"theme",l:"Thème"},{id:"clock",l:"Pointages"},{id:"prices",l:"Historique prix"},{id:"debug",l:"DEBUG"}].map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${tab===t.id?C.primary:C.border}`,
          background:tab===t.id?C.primary:"transparent",color:tab===t.id?"#fff":C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>{t.l}</button>))}</div>

    {tab==="general"&&<div style={{maxWidth:500}}>
      {[{l:"Nom boutique",k:"name"},{l:"Adresse",k:"address"},{l:"Code postal",k:"postalCode"},{l:"Ville",k:"city"},{l:"SIRET",k:"siret"},{l:"N° TVA Intra",k:"tvaIntra"},{l:"Téléphone",k:"phone"},{l:"Message ticket",k:"footerMsg"}].map(f=>(
        <div key={f.k} style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>{f.l}</label>
          <Input value={settings[f.k]||""} onChange={e=>setSettings(s=>({...s,[f.k]:e.target.value}))}/></div>))}
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Paramètres mis à jour");notify("Paramètres sauvegardés","success");}} style={{width:"100%",height:40,marginTop:8,background:C.primary}}><Save size={14}/> Enregistrer</Btn></div>}

    {tab==="retouche"&&<div style={{maxWidth:650}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
          <Scissors size={20} color={C.primary}/>
          <div><h3 style={{fontSize:16,fontWeight:800,margin:0}}>Types de retouches</h3>
            <p style={{fontSize:11,color:C.textMuted,margin:0}}>Configurez les prestations de retouche proposées en caisse. Ces types apparaissent comme boutons rapides dans le bon de retouche.</p></div></div></div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <h4 style={{fontSize:13,fontWeight:700,margin:0}}>Prestations ({(settings.retoucheTypes||[]).length || "8 par défaut"})</h4>
          <Btn variant="outline" onClick={()=>{const types=[...(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}]),{n:"",p:""}];
            setSettings(s=>({...s,retoucheTypes:types}));}} style={{fontSize:10,padding:"4px 12px"}}><Plus size={11}/> Ajouter</Btn></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}]).map((rt,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:10,borderRadius:12,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
              <span style={{fontSize:12,fontWeight:700,color:C.primary,width:24,textAlign:"center"}}>{i+1}</span>
              <Input value={rt.n} onChange={e=>{const types=[...(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}])];types[i]={...types[i],n:e.target.value};setSettings(s=>({...s,retoucheTypes:types}));}}
                placeholder="Nom de la prestation" style={{flex:2,height:36}}/>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <Input type="number" step="0.5" value={rt.p} onChange={e=>{const types=[...(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}])];types[i]={...types[i],p:parseFloat(e.target.value)||0};setSettings(s=>({...s,retoucheTypes:types}));}}
                  style={{width:80,height:36,textAlign:"right"}}/>
                <span style={{fontSize:11,color:C.textMuted}}>€</span></div>
              <Btn variant="ghost" onClick={()=>{const types=[...(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}])];types.splice(i,1);setSettings(s=>({...s,retoucheTypes:types}));}}
                style={{padding:"4px 8px",color:C.danger}}><Trash2 size={14}/></Btn>
            </div>))}
        </div>
      </div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>Paramètres du bon de retouche</h4>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>TAUX DE TVA RETOUCHE (%)</label>
            <Input type="number" step="0.1" value={settings.retoucheTVA||20} onChange={e=>setSettings(s=>({...s,retoucheTVA:parseFloat(e.target.value)||20}))} style={{width:120}}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MESSAGE SUR LE BON</label>
            <Input value={settings.retoucheMsg||""} onChange={e=>setSettings(s=>({...s,retoucheMsg:e.target.value}))} placeholder="Ex: Retrait sous 5 jours ouvrés"/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>DÉLAI PAR DÉFAUT (jours)</label>
            <Input type="number" value={settings.retoucheDelay||5} onChange={e=>setSettings(s=>({...s,retoucheDelay:parseInt(e.target.value)||5}))} style={{width:120}}/></div>
        </div>
      </div>

      <div style={{background:C.warnLight,borderRadius:12,padding:14,border:`1px solid ${C.warn}33`,display:"flex",gap:10,alignItems:"start",marginBottom:14}}>
        <AlertTriangle size={16} color={C.warn} style={{flexShrink:0,marginTop:2}}/>
        <div style={{fontSize:11,color:"#92400E",lineHeight:1.5}}>
          <strong>Utilisation :</strong> En caisse, cliquez sur le bouton <strong>Retouche</strong> pour créer un bon. Les prestations configurées ici apparaissent comme boutons rapides. Le bon de retouche s'imprime au format ticket de caisse et les articles sont ajoutés au panier.</div></div>

      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Types de retouches mis à jour");notify("Paramètres retouches sauvegardés","success");}}
        style={{width:"100%",height:44,background:C.primary}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="pricing"&&<div style={{maxWidth:550}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <DollarSign size={20} color={C.primary}/>
          <div><h3 style={{fontSize:16,fontWeight:800,margin:0}}>Mode de tarification</h3>
            <p style={{fontSize:11,color:C.textMuted,margin:0}}>Définissez comment vos prix de vente sont saisis</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[{id:"TTC",l:"Prix TTC",d:"Les prix saisis incluent la TVA. Le HT est calculé en soustrayant la TVA.",ex:"Prix saisi: 29.90€ TTC → HT: 24.92€ (TVA 20%)"},
            {id:"HT",l:"Prix HT",d:"Les prix saisis sont hors taxes. La TVA est ajoutée au total.",ex:"Prix saisi: 29.90€ HT → TTC: 35.88€ (TVA 20%)"}].map(m=>(
            <button key={m.id} onClick={()=>setSettings(s=>({...s,pricingMode:m.id}))}
              style={{padding:16,borderRadius:14,border:`2.5px solid ${(settings.pricingMode||"TTC")===m.id?C.primary:C.border}`,
                background:(settings.pricingMode||"TTC")===m.id?`${C.primary}08`:"#fff",cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:18,height:18,borderRadius:9,border:`2px solid ${(settings.pricingMode||"TTC")===m.id?C.primary:C.border}`,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {(settings.pricingMode||"TTC")===m.id&&<div style={{width:10,height:10,borderRadius:5,background:C.primary}}/>}</div>
                <span style={{fontSize:14,fontWeight:700,color:(settings.pricingMode||"TTC")===m.id?C.primary:C.text}}>{m.l}</span></div>
              <p style={{fontSize:11,color:C.textMuted,margin:"0 0 6px 0",lineHeight:1.4}}>{m.d}</p>
              <div style={{fontSize:10,color:C.info,background:C.infoLight,borderRadius:8,padding:"4px 8px",fontWeight:600}}>{m.ex}</div>
            </button>))}
        </div>
      </div>
      <div style={{background:C.warnLight,borderRadius:12,padding:14,border:`1px solid ${C.warn}33`,display:"flex",gap:10,alignItems:"start"}}>
        <AlertTriangle size={16} color={C.warn} style={{flexShrink:0,marginTop:2}}/>
        <div style={{fontSize:11,color:"#92400E",lineHeight:1.5}}>
          <strong>Important :</strong> Ce réglage s'applique à tous vos produits. Si vous changez de TTC à HT (ou inversement),
          vérifiez que vos prix sont bien cohérents. Les prix existants ne sont pas recalculés automatiquement —
          seul le calcul de la TVA sur les tickets change.</div></div>
    </div>}

    {tab==="commission"&&<div style={{maxWidth:550}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>Taux de commission</h3>
        <p style={{fontSize:11,color:C.textMuted,margin:0}}>Configurez le taux de commission sur la marge pour chaque vendeur. Par défaut : {((settings.defaultCommissionRate||0.05)*100).toFixed(1)}%</p></div>
      <div style={{marginBottom:14}}>
        <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Taux par défaut (%)</label>
        <Input type="number" step="0.5" min="0" max="100" value={((settings.defaultCommissionRate||0.05)*100).toFixed(1)}
          onChange={e=>setSettings(s=>({...s,defaultCommissionRate:parseFloat(e.target.value)/100||0.05}))}
          style={{width:120}}/></div>
      <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Taux par vendeur</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {(users||[]).map(u=>(<div key={u.id||u.name} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
          <span style={{flex:1,fontSize:12,fontWeight:600}}>{u.name}</span>
          <Input type="number" step="0.5" min="0" max="100"
            value={settings.commissionRates?.[u.id||u.name]!=null?(settings.commissionRates[u.id||u.name]*100).toFixed(1):""}
            onChange={e=>{const val=e.target.value;const key=u.id||u.name;setSettings(s=>({...s,commissionRates:{...s.commissionRates,[key]:val?parseFloat(val)/100:undefined}}));}}
            placeholder={((settings.defaultCommissionRate||0.05)*100).toFixed(1)}
            style={{width:80,textAlign:"right"}}/><span style={{fontSize:11,color:C.textMuted}}>%</span></div>))}
      </div>
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Taux de commission mis à jour");notify("Taux de commission sauvegardés","success");}} style={{width:"100%",height:40,background:C.primary}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="stores"&&<div style={{maxWidth:600}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>Configuration multi-magasins</h3>
        <p style={{fontSize:11,color:C.textMuted,margin:0}}>Définissez les magasins de votre réseau. Utilisé pour les transferts de stock et les rapports consolidés.</p></div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {(settings.stores||[]).map((store,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:12,borderRadius:12,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
          <div style={{flex:1}}>
            <Input value={store.name} onChange={e=>{const stores=[...(settings.stores||[])];stores[i]={...stores[i],name:e.target.value};setSettings(s=>({...s,stores}));}}
              placeholder="Nom du magasin" style={{marginBottom:4,fontWeight:600}}/>
            <Input value={store.address||""} onChange={e=>{const stores=[...(settings.stores||[])];stores[i]={...stores[i],address:e.target.value};setSettings(s=>({...s,stores}));}}
              placeholder="Adresse" style={{fontSize:11}}/>
          </div>
          <Btn variant="outline" onClick={()=>{const stores=(settings.stores||[]).filter((_,j)=>j!==i);setSettings(s=>({...s,stores}));}}
            style={{height:36,width:36,padding:0,borderRadius:8,color:C.danger,borderColor:C.danger+"44"}}><Trash2 size={14}/></Btn>
        </div>))}
        {(settings.stores||[]).length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight,fontSize:12}}>Aucun magasin configuré</div>}
      </div>
      <Btn variant="outline" onClick={()=>{const stores=[...(settings.stores||[]),{name:"",address:"",id:`store-${Date.now()}`}];setSettings(s=>({...s,stores}));}}
        style={{width:"100%",height:36,marginBottom:12,borderRadius:10,fontSize:11}}><Plus size={12}/> Ajouter un magasin</Btn>
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Configuration magasins mise à jour");notify("Magasins sauvegardés","success");}}
        style={{width:"100%",height:40,background:C.primary}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="printer"&&<div style={{maxWidth:600}}>
      {/* Hardware selection */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.primary}22`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Monitor size={18} color={C.primary}/>
          <div><h3 style={{fontSize:14,fontWeight:700,margin:0}}>Type de caisse</h3>
            <p style={{fontSize:10,color:C.textMuted,margin:0}}>Selectionnez votre materiel pour activer les bons drivers (imprimante, ecran client, tiroir-caisse)</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {Object.entries(hardwareProfiles||{}).map(([id,p])=>(
            <button key={id} onClick={()=>switchHardware(id)} style={{padding:"12px 14px",borderRadius:12,textAlign:"left",cursor:"pointer",
              border:`2px solid ${hwId===id?C.primary:C.border}`,background:hwId===id?C.primaryLight:"transparent",transition:"all 0.15s"}}>
              <div style={{fontSize:12,fontWeight:700,color:hwId===id?C.primary:C.text,marginBottom:2}}>{p.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {p.hasPrinter&&<span style={{fontSize:9,background:C.primaryLight,color:C.primary,padding:"1px 6px",borderRadius:6,fontWeight:600}}>Imprimante</span>}
                {p.hasDualScreen&&<span style={{fontSize:9,background:"#DBEAFE",color:"#1D4ED8",padding:"1px 6px",borderRadius:6,fontWeight:600}}>Double ecran</span>}
                {p.hasCashDrawer&&<span style={{fontSize:9,background:"#FEF3C7",color:"#92400E",padding:"1px 6px",borderRadius:6,fontWeight:600}}>Tiroir</span>}
              </div>
            </button>))}
        </div>
        {hwProfile&&<div style={{marginTop:10,fontSize:11,color:C.textMuted,background:C.surfaceAlt,borderRadius:8,padding:10}}>
          Materiel actif: <strong style={{color:C.primary}}>{hwProfile.name}</strong>
          {hwProfile.hasPrinter?" — Imprimante integree ("+hwProfile.printerWidth+" car.)":""}
          {hwProfile.hasDualScreen?" — Ecran client integre":""}
        </div>}
      </div>

      {/* Printer status */}
      <div style={{background:printerConnected?C.primaryLight:C.surfaceAlt,borderRadius:14,padding:16,border:`1.5px solid ${printerConnected?C.primary+"44":C.border}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{width:12,height:12,borderRadius:6,background:printerConnected?"#059669":"#CCC",boxShadow:printerConnected?"0 0 8px #05966955":"none"}}/>
          <span style={{fontSize:14,fontWeight:700}}>{printerConnected?"Imprimante connectée":"Aucune imprimante"}</span>
          {printerConnected&&<Badge color={C.primary}>{printerType==="serial"?"Web Serial":"WebUSB"}</Badge>}</div>
        {printerConnected&&<div style={{fontSize:11,color:C.textMuted}}>L'impression ESC/POS est active. Les tickets seront envoyés directement a l'imprimante thermique.</div>}</div>

      {/* Diagnostic panel */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Activity size={18} color={C.info}/>
          <div><h3 style={{fontSize:14,fontWeight:700,margin:0}}>Diagnostic imprimante</h3>
            <p style={{fontSize:10,color:C.textMuted,margin:0}}>Verifiez la detection, connexion et fonctionnement</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          <Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              const diag=await hardwareManager.printer?.getDiagnostics?.();
              const cap=!!window.Capacitor?.isNativePlatform?.();
              const plugins=Object.keys(window.Capacitor?.Plugins||{});
              setPrinterDiag({...diag,capacitor:cap,plugins,hwId,timestamp:new Date().toLocaleTimeString('fr-FR')});
            }catch(e){setPrinterDiag({error:e.message});}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:C.info,fontSize:11}}>
            <Activity size={13}/> {diagLoading?"Analyse...":"Diagnostic"}</Btn>
          <Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              await hardwareManager.connectPrinter();
              const diag=await hardwareManager.printer?.getDiagnostics?.();
              setPrinterDiag(prev=>({...prev,...diag,action:"connectPrinter",timestamp:new Date().toLocaleTimeString('fr-FR')}));
              notify(hardwareManager.printer?.connected?"Imprimante connectee":"Connexion echouee",hardwareManager.printer?.connected?"success":"warn");
            }catch(e){setPrinterDiag(prev=>({...prev,connectError:e.message}));notify("Erreur: "+e.message,"error");}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:C.primary,fontSize:11}}>
            <Printer size={13}/> Connecter</Btn>
          <Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              if(window.Capacitor?.Plugins?.SunmiPrinter){
                const r=await window.Capacitor.Plugins.SunmiPrinter.testPrint();
                setPrinterDiag(prev=>({...prev,testResult:r,action:"testPrint",timestamp:new Date().toLocaleTimeString('fr-FR')}));
                notify("Test impression envoye","success");
              }else{
                await thermalPrint("test");
                notify("Test impression envoye","success");
              }
            }catch(e){setPrinterDiag(prev=>({...prev,testError:e.message}));notify("Erreur test: "+e.message,"error");}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:"#059669",fontSize:11}}>
            <Printer size={13}/> Test print</Btn>
        </div>
        {printerDiag&&<div style={{background:"#0F172A",borderRadius:10,padding:12,fontFamily:"monospace",fontSize:10,color:"#E2E8F0",maxHeight:300,overflow:"auto",whiteSpace:"pre-wrap"}}>
          {JSON.stringify(printerDiag,null,2)}
        </div>}
      </div>

      {/* Connect / Disconnect */}
      {!printerConnected?<>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Connexion imprimante thermique</h3>
        <p style={{fontSize:11,color:C.textMuted,marginBottom:12}}>
          Connectez une imprimante ticket thermique ESC/POS (Epson TM-T20, Star TSP, Bixolon, etc.) via USB ou port série.
          Nécessite un navigateur compatible (Chrome, Edge, Opera).</p>

        {/* Serial settings */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>VITESSE SÉRIE (BAUD)</label>
            <select value={printerBaud} onChange={e=>setPrinterBaud(e.target.value)} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
              {["9600","19200","38400","57600","115200"].map(b=>(<option key={b} value={b}>{b}</option>))}</select></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>LARGEUR PAPIER</label>
            <select value={printerWidth} onChange={e=>setPrinterWidth(e.target.value)} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
              <option value="48">80mm (48 car.)</option>
              <option value="32">58mm (32 car.)</option></select></div></div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {!!navigator.serial&&<Btn onClick={async()=>{setConnecting(true);await connectPrinter("serial",{baudRate:parseInt(printerBaud),paperWidth:parseInt(printerWidth)});setConnecting(false);}}
            disabled={connecting} style={{height:44,background:C.primary}}>
            <Printer size={14}/> {connecting?"Connexion…":"Connecter (Port série)"}</Btn>}
          {!!navigator.usb&&<Btn onClick={async()=>{setConnecting(true);await connectPrinter("usb");setConnecting(false);}}
            disabled={connecting} style={{height:44,background:C.info}}>
            <Printer size={14}/> {connecting?"Connexion…":"Connecter (USB)"}</Btn>}
        </div>

        {/* Native POS printer (Sunmi/PAX/iMin) */}
        {(hwId==="sunmi"||hwId==="pax"||hwId==="imin")&&<div style={{marginTop:10}}>
          <Btn onClick={async()=>{setConnecting(true);await connectPrinter(hwId);setConnecting(false);}}
            disabled={connecting} style={{width:"100%",height:44,background:"#059669"}}>
            <Printer size={14}/> {connecting?"Connexion...":"Connecter imprimante "+hwProfile?.name}</Btn>
          <p style={{fontSize:10,color:C.textMuted,marginTop:6}}>Connexion directe a l'imprimante integree via le bridge natif. Necessite l'app Capacitor.</p>
        </div>}

        {!navigator.serial&&!navigator.usb&&hwId==="desktop"&&<div style={{background:C.warnLight,borderRadius:10,padding:12,marginTop:10,fontSize:11,color:"#92400E",border:`1px solid ${C.warn}33`}}>
          Votre navigateur ne supporte ni Web Serial ni WebUSB. Utilisez <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong> ou <strong>Opera</strong> pour connecter une imprimante thermique.</div>}
      </>:<>
        {/* Connected actions */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
          <Btn variant="outline" onClick={()=>thermalPrint("test")} style={{height:44}}><Printer size={14}/> Test impression</Btn>
          <Btn variant="outline" onClick={()=>thermalPrint("drawer")} style={{height:44}}><Box size={14}/> Ouvrir tiroir</Btn>
          <Btn variant="danger" onClick={async()=>{await disconnectPrinter();}} style={{height:44}}><XCircle size={14}/> Déconnecter</Btn></div>
      </>}

      {/* Label printer section */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginTop:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <ScanLine size={18} color={C.accent}/>
          <div><h3 style={{fontSize:14,fontWeight:700,margin:0}}>Imprimante étiquettes / Code-barres</h3>
            <p style={{fontSize:10,color:C.textMuted,margin:0}}>Imprimez des étiquettes code-barres EAN pour vos produits</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>FORMAT ÉTIQUETTE</label>
            <select value={settings.labelFormat||"50x30"} onChange={e=>setSettings(s=>({...s,labelFormat:e.target.value}))}
              style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
              <option value="50x30">50×30 mm</option><option value="40x25">40×25 mm</option><option value="60x40">60×40 mm</option><option value="30x20">30×20 mm</option></select></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>CONTENU ÉTIQUETTE</label>
            <select value={settings.labelContent||"ean+price"} onChange={e=>setSettings(s=>({...s,labelContent:e.target.value}))}
              style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
              <option value="ean+price">Code-barres + Prix</option><option value="ean+name">Code-barres + Nom</option><option value="ean+name+price">Code-barres + Nom + Prix</option><option value="ean">Code-barres seul</option></select></div></div>
        <p style={{fontSize:10,color:C.textMuted,marginBottom:10,lineHeight:1.5}}>
          Pour imprimer des étiquettes, allez dans <strong>Produits</strong>, cliquez sur un produit puis sur <strong>🏷️ Imprimer étiquettes</strong>. Vous pouvez imprimer par variante (taille/couleur) avec le nombre d'exemplaires souhaité.</p>
        <Btn onClick={()=>{saveSettingsToAPI(settings);notify("Paramètres étiquettes sauvegardés","success");}}
          style={{width:"100%",height:40,background:C.accent}}><Save size={14}/> Enregistrer les paramètres étiquettes</Btn>
      </div>

      {/* Info box */}
      <div style={{background:C.surfaceAlt,borderRadius:12,padding:14,marginTop:14,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>ℹ️ Imprimantes compatibles</div>
        <div style={{fontSize:10,color:C.textMuted,lineHeight:1.6}}>
          <strong>Tickets (Port série/USB):</strong> Epson TM-T20II/III, TM-T88V/VI, Star TSP100/TSP650, Bixolon SRP-350<br/>
          <strong>Étiquettes:</strong> Zebra ZD220/ZD420, Dymo LabelWriter, Brother QL-800, Godex, TSC (impression via navigateur)<br/>
          <strong>Protocole tickets:</strong> ESC/POS standard<br/>
          <strong>Protocole étiquettes:</strong> Impression PDF via le navigateur (compatible toutes imprimantes)<br/>
          <strong>Tiroir-caisse:</strong> Ouverture automatique via signal RJ11</div></div>
    </div>}

    {tab==="return"&&<div style={{maxWidth:600}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <RotateCcw size={20} color={C.primary}/>
          <div><h3 style={{fontSize:16,fontWeight:800,margin:0}}>Politique de retour</h3>
            <p style={{fontSize:11,color:C.textMuted,margin:0}}>Configurez les règles de retour et d'échange</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>DÉLAI DE RETOUR (jours)</label>
            <Input type="number" value={settings.returnPolicy?.days||30} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,days:parseInt(e.target.value)||30}}))}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MONTANT MAX SANS APPROBATION (€)</label>
            <Input type="number" value={settings.returnPolicy?.maxNoApproval||100} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,maxNoApproval:parseFloat(e.target.value)||100}}))}/></div>
        </div>
        <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>CONDITIONS DE RETOUR</label>
          <textarea value={settings.returnPolicy?.conditions||""} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,conditions:e.target.value}}))}
            style={{width:"100%",height:70,padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit",resize:"vertical"}}
            placeholder="Article non porté, étiquette présente…"/></div>
        <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MESSAGE SUR LE TICKET D'AVOIR</label>
          <Input value={settings.returnPolicy?.avoirMsg||""} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,avoirMsg:e.target.value}}))} placeholder="Merci de votre confiance. Avoir valable 12 mois."/></div>
      </div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:12}}>Modes de remboursement autorisés</h4>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{k:"allowAvoir",l:"Avoir / Crédit magasin",d:"Émettre un bon d'avoir utilisable en magasin"},
            {k:"allowCashRefund",l:"Remboursement espèces",d:"Rembourser en espèces au client"},
            {k:"allowCardRefund",l:"Remboursement carte",d:"Rembourser sur la carte bancaire du client"},
            {k:"allowExchange",l:"Échange article",d:"Échanger contre un autre article"}].map(opt=>{
            const val=settings.returnPolicy?.[opt.k]!==false;
            return(<button key={opt.k} onClick={()=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,[opt.k]:!val}}))}
              style={{padding:12,borderRadius:12,border:`2px solid ${val?C.primary:C.border}`,background:val?`${C.primary}08`:"#fff",cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${val?C.primary:C.border}`,background:val?C.primary:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {val&&<Check size={10} color="#fff"/>}</div>
                <span style={{fontSize:12,fontWeight:600,color:val?C.primary:C.text}}>{opt.l}</span></div>
              <p style={{fontSize:10,color:C.textMuted,margin:0,paddingLeft:22}}>{opt.d}</p>
            </button>);})}
        </div>
      </div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:12}}>Options de retour</h4>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[{k:"autoRestock",l:"Remise en stock automatique",d:"Remettre automatiquement les articles retournés en stock"},
            {k:"requireReceipt",l:"Ticket obligatoire",d:"Exiger le ticket de caisse pour effectuer un retour (désactiver pour autoriser les retours libres)"},
            {k:"printAvoir",l:"Imprimer le ticket d'avoir",d:"Imprimer automatiquement un justificatif d'avoir"},
            {k:"requireReason",l:"Motif obligatoire",d:"Exiger un motif pour chaque retour"}].map(opt=>{
            const val=settings.returnPolicy?.[opt.k]!==false;
            return(<div key={opt.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:10,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
              <div><div style={{fontSize:12,fontWeight:600}}>{opt.l}</div>
                <div style={{fontSize:10,color:C.textMuted}}>{opt.d}</div></div>
              <button onClick={()=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,[opt.k]:!val}}))}
                style={{width:40,height:22,borderRadius:11,border:"none",cursor:"pointer",background:val?C.primary:C.border,position:"relative",transition:"all 0.2s"}}>
                <div style={{width:16,height:16,borderRadius:8,background:"#fff",position:"absolute",top:3,left:val?21:3,transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/></button>
            </div>);})}
        </div>
      </div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>Motifs de retour personnalisés</h4>
        <p style={{fontSize:10,color:C.textMuted,marginBottom:10}}>Ces motifs seront proposés dans la caisse lors d'un retour.</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {(settings.returnPolicy?.reasons||["Échange taille","Échange couleur","Défectueux","Ne convient pas","Erreur achat","Autre"]).map((r,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:8,background:C.surfaceAlt,border:`1px solid ${C.border}`,fontSize:11}}>
              {r}<button onClick={()=>{const reasons=[...(settings.returnPolicy?.reasons||["Échange taille","Échange couleur","Défectueux","Ne convient pas","Erreur achat","Autre"])];reasons.splice(i,1);setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,reasons}}));}}
                style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={12} color={C.textMuted}/></button></div>))}
          <input placeholder="Nouveau motif…" id="_newReason" onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){const r=e.target.value.trim();const reasons=[...(settings.returnPolicy?.reasons||["Échange taille","Échange couleur","Défectueux","Ne convient pas","Erreur achat","Autre"]),r];setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,reasons}}));e.target.value="";}}}
            style={{padding:"4px 10px",borderRadius:8,border:`1.5px dashed ${C.primary}`,background:"transparent",color:C.text,fontSize:11,width:140,outline:"none"}}/>
        </div>
      </div>

      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Politique de retour mise à jour");notify("Paramètres de retour sauvegardés","success");}} style={{width:"100%",height:44,background:C.primary}}><Save size={14}/> Enregistrer les paramètres de retour</Btn>
    </div>}

    {tab==="sizes"&&<SizeSettingsTab notify={notify}/>}

    {tab==="theme"&&<div style={{maxWidth:500}}>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>COULEUR PRINCIPALE</label>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><input type="color" value={theme.primaryColor} onChange={e=>setTheme(t=>({...t,primaryColor:e.target.value}))}
          style={{width:40,height:36,border:"none",cursor:"pointer",borderRadius:8}}/><span style={{fontSize:12}}>{theme.primaryColor}</span></div></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>COULEUR ACCENT</label>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><input type="color" value={theme.accentColor} onChange={e=>setTheme(t=>({...t,accentColor:e.target.value}))}
          style={{width:40,height:36,border:"none",cursor:"pointer",borderRadius:8}}/><span style={{fontSize:12}}>{theme.accentColor}</span></div></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>URL DU LOGO</label>
        <Input value={settings.logo||""} onChange={e=>setSettings(s=>({...s,logo:e.target.value}))} placeholder="https://…"/></div>
      <p style={{fontSize:10,color:C.textMuted}}>Les changements de thème seront appliqués au prochain rechargement.</p></div>}

    {tab==="clock"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Pointages récents</h3>
      {clockEntries.length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight}}>Aucun pointage</div>}
      {clockEntries.slice(0,30).map(e=>(<div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:6,borderBottom:`1px solid ${C.border}`,fontSize:11}}>
        <Badge color={e.type==="IN"?"#059669":C.danger}>{e.type}</Badge>
        <span style={{flex:1,fontWeight:600}}>{e.userName}</span>
        <span style={{color:C.textMuted}}>{new Date(e.date).toLocaleString("fr-FR")}</span></div>))}</div>}

    {tab==="prices"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Historique des changements de prix</h3>
      {priceHistory.length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight}}>Aucun changement</div>}
      {priceHistory.slice(0,30).map(e=>(<div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:6,borderBottom:`1px solid ${C.border}`,fontSize:11}}>
        <span style={{flex:1,fontWeight:600}}>{e.productName}</span>
        <span style={{color:C.danger,textDecoration:"line-through"}}>{e.oldPrice.toFixed(2)}€</span>
        <span>→</span>
        <span style={{color:"#059669",fontWeight:700}}>{e.newPrice.toFixed(2)}€</span>
        <span style={{color:C.textMuted,fontSize:9}}>{e.user} — {new Date(e.date).toLocaleDateString("fr-FR")}</span></div>))}</div>}

    {tab==="tpe"&&<div style={{maxWidth:600}}>
      {/* Payment terminal selection */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.primary}22`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <CreditCard size={18} color={C.primary}/>
          <div><h3 style={{fontSize:14,fontWeight:700,margin:0}}>Terminal de paiement (TPE)</h3>
            <p style={{fontSize:10,color:C.textMuted,margin:0}}>Selectionnez votre solution de paiement par carte. Le montant sera envoye automatiquement au TPE.</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {Object.entries(paymentProfiles||{}).map(([id,p])=>(
            <button key={id} onClick={()=>switchPayment(id)} style={{padding:"12px 14px",borderRadius:12,textAlign:"left",cursor:"pointer",
              border:`2px solid ${paymentId===id?C.primary:C.border}`,background:paymentId===id?C.primaryLight:"transparent",transition:"all 0.15s"}}>
              <div style={{fontSize:12,fontWeight:700,color:paymentId===id?C.primary:C.text,marginBottom:2}}>{p.name}</div>
              <div style={{fontSize:9,color:C.textMuted}}>{p.description}</div>
            </button>))}
        </div>
      </div>

      {/* TPE Configuration fields */}
      {paymentProfiles[paymentId]?.requiresConfig&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:10}}>Configuration {paymentProfiles[paymentId]?.name}</h4>
        {(paymentProfiles[paymentId]?.configFields||[]).map(f=>(
          <div key={f.key} style={{marginBottom:10}}>
            <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>{f.label}</label>
            {f.type==="select"?
              <select value={paymentConfig[f.key]||""} onChange={e=>updatePaymentConfig({[f.key]:e.target.value})}
                style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
                <option value="">-- Choisir --</option>
                {(f.options||[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            :<Input value={paymentConfig[f.key]||""} onChange={e=>updatePaymentConfig({[f.key]:e.target.value})}
                placeholder={f.placeholder||""} type={f.type||"text"}/>}
          </div>))}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Btn onClick={()=>{notify("Configuration TPE sauvegardee","success");}} style={{height:40,background:C.primary}}>
            <Save size={14}/> Sauvegarder</Btn>
          {paymentId==="concert"&&<Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              const adapter=hardwareManager.payment;
              if(adapter?.testConnection){
                const r=await adapter.testConnection();
                setPrinterDiag({tpe:true,concertTest:r,timestamp:new Date().toLocaleTimeString('fr-FR')});
                notify(r.success?"TPE accessible: "+r.message:"TPE injoignable: "+r.error,r.success?"success":"error");
              }else{
                notify("Adaptateur Concert non actif — sauvegardez d'abord la config","warn");
              }
            }catch(e){notify("Erreur: "+e.message,"error");}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:C.info}}>
            <Activity size={14}/> {diagLoading?"Test...":"Tester connexion TPE"}</Btn>}
        </div>
        {paymentId==="concert"&&<div style={{marginTop:10,background:C.infoLight,borderRadius:10,padding:12,border:`1px solid ${C.info}22`,fontSize:11,color:C.text,lineHeight:1.6}}>
          <strong>Configuration du Ingenico Desk/5000 :</strong><br/>
          1. Sur le TPE: Menu Technique &gt; Communication &gt; Ethernet &gt; notez l'adresse IP<br/>
          2. Entrez cette IP ci-dessus (ex: 192.168.1.50)<br/>
          3. Port par defaut: 8888 (varie selon config)<br/>
          4. Le TPE doit etre en <strong>mode caisse/ECR</strong> (demandez a votre prestataire monetique)<br/>
          5. Cliquez "Tester connexion" pour verifier
        </div>}
      </div>}

      {/* TPE Diagnostic */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Activity size={18} color={C.info}/>
          <div><h3 style={{fontSize:14,fontWeight:700,margin:0}}>Diagnostic TPE</h3>
            <p style={{fontSize:10,color:C.textMuted,margin:0}}>Verifiez la detection du terminal de paiement</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              const cap=!!window.Capacitor?.isNativePlatform?.();
              const plugins=Object.keys(window.Capacitor?.Plugins||{});
              const bridge=window.Capacitor?.Plugins?.PaymentTerminal;
              let hwInfo=null;
              if(bridge){try{hwInfo=await bridge.detectHardware();}catch(e){hwInfo={error:e.message};}}
              setPrinterDiag({tpe:true,capacitor:cap,plugins,hasPaymentPlugin:!!bridge,hwInfo,paymentId,timestamp:new Date().toLocaleTimeString('fr-FR')});
            }catch(e){setPrinterDiag({tpe:true,error:e.message});}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:C.info,fontSize:11}}>
            <Activity size={13}/> {diagLoading?"Analyse...":"Diagnostic TPE"}</Btn>
          <Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              const result=await hardwareManager.charge(0.01,{currency:'EUR',reference:'TEST-'+Date.now(),method:'card'});
              setPrinterDiag(prev=>({...prev,testCharge:result,timestamp:new Date().toLocaleTimeString('fr-FR')}));
              notify("Test TPE: "+(result?.success?"OK":"echec - "+(result?.error||result?.status)),"info");
            }catch(e){setPrinterDiag(prev=>({...prev,testChargeError:e.message}));notify("Erreur test: "+e.message,"error");}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:C.primary,fontSize:11}}>
            <CreditCard size={13}/> Test paiement (0.01 EUR)</Btn>
        </div>
        {printerDiag?.tpe&&<div style={{background:"#0F172A",borderRadius:10,padding:12,fontFamily:"monospace",fontSize:10,color:"#E2E8F0",maxHeight:300,overflow:"auto",whiteSpace:"pre-wrap"}}>
          {JSON.stringify(printerDiag,null,2)}
        </div>}
      </div>

      {/* Payment status info */}
      <div style={{background:C.surfaceAlt,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>Fonctionnement</h4>
        <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>
          {paymentId==="manual"&&<>Mode manuel: le caissier encaisse sur le TPE separement puis confirme le paiement dans CaissePro. Aucune connexion au TPE necessaire.</>}
          {paymentId==="concert"&&<>Le protocole Concert envoie automatiquement le montant au pinpad. Le client presente sa carte, et la reponse (accepte/refuse) revient dans CaissePro. Standard francais compatible Ingenico, Verifone, Worldline.</>}
          {paymentId==="sumup"&&<>CaissePro ouvre l'app SumUp avec le montant pre-rempli. Le paiement se fait sur le lecteur SumUp, puis le resultat revient dans CaissePro.</>}
          {paymentId==="stripe"&&<>Stripe Terminal se connecte au lecteur (BBPOS Chipper, Verifone P400) via Internet. Le paiement est traite par Stripe avec retour automatique dans CaissePro.</>}
          {paymentId==="zettle"&&<>CaissePro ouvre l'app Zettle avec le montant. Le paiement se fait sur le lecteur Zettle, compatible CB, Amex, Apple Pay.</>}
          {paymentId==="worldline"&&<>Connexion directe au TPE Worldline (VALINA, YOMANI, LANE) via le protocole NEXO ou l'API REST locale.</>}
          {paymentId==="pax_pay"&&<>Paiement integre sur le terminal PAX. Le montant est envoye directement au module de paiement interne.</>}
          {paymentId==="sunmi_pay"&&<>Paiement integre sur Sunmi P-series. Le module NFC/puce de la Sunmi traite le paiement directement.</>}
        </div>
      </div>
    </div>}

    {tab==="receipt"&&<div style={{maxWidth:550}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>Personnalisation du ticket</h3>
        <p style={{fontSize:11,color:C.textMuted,margin:0}}>Configurez l'apparence et les informations affichées sur vos tickets de caisse.</p></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>URL du logo</label>
        <Input value={settings.receiptLogo||""} onChange={e=>setSettings(s=>({...s,receiptLogo:e.target.value}))} placeholder="https://example.com/logo.png"/></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Message d'en-tête</label>
        <Input value={settings.receiptHeader||""} onChange={e=>setSettings(s=>({...s,receiptHeader:e.target.value}))} placeholder="Merci pour votre achat !"/></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Message de pied de page</label>
        <Input value={settings.footerMsg||""} onChange={e=>setSettings(s=>({...s,footerMsg:e.target.value}))} placeholder="Merci de votre visite !"/></div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Champs affichés sur le ticket</div>
        {[{k:"showShopName",l:"Nom de la boutique"},{k:"showAddress",l:"Adresse"},{k:"showSiret",l:"SIRET"},{k:"showPhone",l:"Téléphone"},{k:"showTvaDetails",l:"Détails TVA"},{k:"showSellerName",l:"Nom du vendeur"},{k:"showDateTime",l:"Date et heure"}].map(f=>{
          const rf=settings.receiptFields||{showShopName:true,showAddress:true,showSiret:true,showPhone:true,showTvaDetails:true,showSellerName:true,showDateTime:true};
          const checked=rf[f.k]!==false;
          return(<div key={f.k} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,background:C.surfaceAlt,marginBottom:4,cursor:"pointer"}}
            onClick={()=>setSettings(s=>({...s,receiptFields:{...(s.receiptFields||{showShopName:true,showAddress:true,showSiret:true,showPhone:true,showTvaDetails:true,showSellerName:true,showDateTime:true}),[f.k]:!checked}}))}>
            <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked?C.primary:C.border}`,background:checked?C.primary:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {checked&&<Check size={12} color="#fff"/>}</div>
            <span style={{fontSize:12,fontWeight:500}}>{f.l}</span></div>);})}</div>
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Paramètres ticket mis à jour");notify("Paramètres ticket sauvegardés","success");}} style={{width:"100%",height:40,background:C.primary}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="screen2"&&<div style={{maxWidth:600}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>Personnalisation Écran 2</h3>
        <p style={{fontSize:11,color:C.textMuted,margin:0}}>Configurez l'apparence de l'écran client (affichage secondaire).</p></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Couleur de fond</label>
          <div style={{display:"flex",gap:6,alignItems:"center"}}><input type="color" value={settings.screen2BgColor||"#1A2830"} onChange={e=>setSettings(s=>({...s,screen2BgColor:e.target.value}))} style={{width:36,height:36,border:"none",borderRadius:8,cursor:"pointer"}}/>
            <Input value={settings.screen2BgColor||"#1A2830"} onChange={e=>setSettings(s=>({...s,screen2BgColor:e.target.value}))} style={{flex:1}}/></div></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Couleur d'accent</label>
          <div style={{display:"flex",gap:6,alignItems:"center"}}><input type="color" value={settings.screen2AccentColor||C.primary} onChange={e=>setSettings(s=>({...s,screen2AccentColor:e.target.value}))} style={{width:36,height:36,border:"none",borderRadius:8,cursor:"pointer"}}/>
            <Input value={settings.screen2AccentColor||C.primary} onChange={e=>setSettings(s=>({...s,screen2AccentColor:e.target.value}))} style={{flex:1}}/></div></div></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>URL du logo</label>
        <Input value={settings.screen2Logo||""} onChange={e=>setSettings(s=>({...s,screen2Logo:e.target.value}))} placeholder="https://example.com/logo.png"/></div>
      <div style={{marginBottom:14}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Message d'accueil</label>
        <Input value={settings.screen2WelcomeMsg||""} onChange={e=>setSettings(s=>({...s,screen2WelcomeMsg:e.target.value}))} placeholder="Bienvenue"/></div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Aperçu</div>
        <div style={{width:"100%",height:180,borderRadius:14,background:settings.screen2BgColor||"#1A2830",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,border:`1.5px solid ${C.border}`}}>
          {settings.screen2Logo&&<img src={settings.screen2Logo} alt="logo" style={{maxHeight:40,maxWidth:120,objectFit:"contain"}}/>}
          <div style={{fontSize:20,fontWeight:800,color:settings.screen2AccentColor||C.primary}}>{settings.screen2WelcomeMsg||"Bienvenue"}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>Aperçu de l'écran client</div></div></div>
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Paramètres Écran 2 mis à jour");notify("Paramètres Écran 2 sauvegardés","success");}} style={{width:"100%",height:40,background:C.primary}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="caticons"&&(()=>{const cats=Object.keys({...DEFAULT_CAT_ICONS,...(settings.categoryIcons||{})});
      return(<div style={{maxWidth:550}}>
        <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
          <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>Icônes par catégorie</h3>
          <p style={{fontSize:11,color:C.textMuted,margin:0}}>Associez un emoji à chaque catégorie de produits. L'emoji s'affiche sur les cartes produit en caisse.</p></div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
          {cats.map(c=>{const val=(settings.categoryIcons||{})[c]||DEFAULT_CAT_ICONS[c]||"📦";
            return(<div key={c} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:10,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
              <span style={{fontSize:20}}>{val}</span>
              <span style={{flex:1,fontSize:12,fontWeight:600}}>{c}</span>
              <Input value={val} onChange={e=>setSettings(s=>({...s,categoryIcons:{...(s.categoryIcons||{}),[c]:e.target.value}}))} style={{width:60,textAlign:"center",fontSize:16}}/></div>);})}</div>
        <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Icônes catégories mis à jour");notify("Icônes sauvegardées","success");}} style={{width:"100%",height:40,background:C.primary}}><Save size={14}/> Enregistrer</Btn>
      </div>);})()}

    {tab==="debug"&&<DebugPanel/>}

  </div>);
}

/* ══════════ NAVIGATION ══════════ */
/* ══════════ GIFT CARDS ══════════ */
function GiftCardScreen(){
  const{giftCards,createGiftCard,checkGiftCard}=useApp();
  const[amount,setAmount]=useState("");const[custName,setCustName]=useState("");
  const[checkCode,setCheckCode]=useState("");const[checkResult,setCheckResult]=useState(null);
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:14}}>Cartes cadeaux</h2>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}><Gift size={16} style={{verticalAlign:"middle"}}/> Créer une carte</h3>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>MONTANT (€)</label>
            <Input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="50.00"/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>NOM DU BÉNÉFICIAIRE (optionnel)</label>
            <Input value={custName} onChange={e=>setCustName(e.target.value)} placeholder="Nom…"/></div>
          <div style={{display:"flex",gap:6}}>{[25,50,75,100].map(v=>(<Btn key={v} variant="outline" onClick={()=>setAmount(String(v))} style={{flex:1,fontSize:11}}>{v}€</Btn>))}</div></div>
        <Btn onClick={()=>{if(amount){createGiftCard(parseFloat(amount),custName);setAmount("");setCustName("");}}}
          disabled={!amount} style={{width:"100%",height:40,background:C.accent}}><Gift size={14}/> Créer la carte</Btn>
      </div>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}><Search size={16} style={{verticalAlign:"middle"}}/> Vérifier le solde</h3>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          <Input value={checkCode} onChange={e=>setCheckCode(e.target.value)} placeholder="Code carte (ex: GC-…)" style={{flex:1}}/>
          <Btn variant="info" onClick={()=>{const gc=checkGiftCard(checkCode);setCheckResult(gc?{found:true,gc}:{found:false});}} style={{height:42}}>Vérifier</Btn></div>
        {checkResult&&(checkResult.found?
          <div style={{padding:12,borderRadius:10,background:C.primaryLight,border:`1.5px solid ${C.primary}33`}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>Carte: {checkResult.gc.code}</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:11,color:C.textMuted}}>Montant initial</span><span style={{fontWeight:600}}>{checkResult.gc.initialAmount.toFixed(2)}€</span></div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:C.textMuted}}>Solde restant</span><span style={{fontSize:16,fontWeight:800,color:C.primary}}>{checkResult.gc.balance.toFixed(2)}€</span></div>
            {checkResult.gc.customerName&&<div style={{fontSize:10,color:C.textMuted,marginTop:4}}>Bénéficiaire: {checkResult.gc.customerName}</div>}
            <div style={{fontSize:9,color:C.textMuted,marginTop:2}}>Créée le {new Date(checkResult.gc.createdDate).toLocaleDateString("fr-FR")}</div>
          </div>:
          <div style={{padding:12,borderRadius:10,background:C.dangerLight,fontSize:12,fontWeight:600,color:C.danger}}>Carte introuvable</div>)}
      </div></div>
    <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Historique ({giftCards.length})</h3>
      {giftCards.length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight}}>Aucune carte cadeau créée</div>}
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {giftCards.map(gc=>(<div key={gc.id} style={{display:"flex",alignItems:"center",gap:10,padding:8,borderRadius:8,border:`1px solid ${C.border}`}}>
          <Gift size={14} color={gc.balance>0?C.accent:C.textLight}/>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,fontFamily:"monospace"}}>{gc.code}</div>
            <div style={{fontSize:9,color:C.textMuted}}>{gc.customerName||"Sans nom"} — {new Date(gc.createdDate).toLocaleDateString("fr-FR")}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:12,fontWeight:700,color:gc.balance>0?C.primary:C.textLight}}>{gc.balance.toFixed(2)}€</div>
            <div style={{fontSize:9,color:C.textMuted}}>sur {gc.initialAmount.toFixed(2)}€</div></div>
        </div>))}</div></div>
  </div>);
}

/* ══════════ PROMOS MANAGEMENT ══════════ */
function PromosScreen(){
  const{promos,setPromos,products,perm:p,addAudit,notify}=useApp();
  const[createModal,setCreateModal]=useState(false);
  const defaultNp={name:"",type:"category_discount",value:"",discountType:"percent",collection:"",minQty:"",code:"",startDate:"",endDate:"",targetType:"category",targetValue:"",description:"",stockThreshold:"5"};
  const[np,setNp]=useState(defaultNp);

  if(!p().canManagePromos)return<div style={{padding:40,textAlign:"center",color:C.textMuted}}>Accès réservé aux administrateurs</div>;

  const togglePromo=async(id)=>{
    try{const res=await API.settings.togglePromo(id);setPromos(p=>p.map(x=>x.id===id?{...x,active:res.active}:x));}
    catch(e){setPromos(p=>p.map(x=>x.id===id?{...x,active:!x.active}:x));}};
  const deletePromo=(id)=>{setPromos(p=>p.filter(x=>x.id!==id));addAudit("PROMO","Suppression promo");notify("Promo supprimée","warn");};

  // Extract unique categories, colors, SKUs from products
  const categories=[...new Set(products.map(p=>p.category).filter(Boolean))].sort();
  const colors=[...new Set(products.flatMap(p=>(p.variants||[]).map(v=>v.color)).filter(Boolean))].sort();
  const skuList=products.map(p=>({sku:p.sku,name:p.name})).filter(p=>p.sku).slice(0,200);

  const TYPES=[
    {id:"category_discount",label:"Remise par catégorie",targetType:"category",icon:"Tag",desc:"Applique une remise sur tous les produits d'une catégorie"},
    {id:"sku_discount",label:"Remise par référence",targetType:"sku",icon:"Package",desc:"Applique une remise sur un produit spécifique (SKU)"},
    {id:"color_discount",label:"Remise par couleur",targetType:"color",icon:"Palette",desc:"Applique une remise sur tous les produits d'une couleur"},
    {id:"collection_discount",label:"Remise sur collection",targetType:"collection",icon:"Layers",desc:"Applique une remise sur une collection entière"},
    {id:"low_stock_discount",label:"Remise fin de stock",targetType:"low_stock",icon:"TrendingDown",desc:"Remise auto sur les produits sous un seuil de stock"},
    {id:"qty_discount",label:"Remise sur quantité",targetType:"all",icon:"ShoppingCart",desc:"Remise quand le panier dépasse X articles"},
    {id:"code",label:"Code promo",targetType:"all",icon:"Ticket",desc:"Remise déclenchée par un code client"},
  ];

  const getTypeLabel=(t)=>TYPES.find(x=>x.id===t)?.label||t;
  const getTargetLabel=(pm)=>{
    const tt=pm.target_type||pm.targetType;const tv=pm.target_value||pm.targetValue;
    const mq=pm.min_qty||pm.minQty;const qtyStr=mq&&parseInt(mq)>0?` (dès ${mq} articles)`:"";
    if(tt==="category")return`Catégorie: ${tv||pm.collection||"—"}${qtyStr}`;
    if(tt==="sku")return`Réf: ${tv||"—"}${qtyStr}`;
    if(tt==="color")return`Couleur: ${tv||"—"}${qtyStr}`;
    if(tt==="collection")return`Collection: ${tv||pm.collection||"—"}${qtyStr}`;
    if(tt==="low_stock")return`Stock < ${tv||"5"} pièces`;
    if(pm.type==="qty_discount"||pm.promo_type==="qty_discount")return`Min. ${mq||3} articles au panier`;
    if(pm.type==="code"||pm.promo_type==="code")return`Code: ${pm.code||"—"}`;
    return"";};

  const createPromo=async()=>{
    if(!np.name||!np.value){notify("Nom et valeur requis","error");return;}
    const data={name:np.name,promoType:np.type,value:parseFloat(np.value),discountType:np.discountType,
      collection:np.type==="collection_discount"?np.targetValue:np.collection,
      minQty:np.type==="qty_discount"?parseInt(np.minQty)||3:null,
      code:np.type==="code"?np.code:null,
      active:true,startDate:np.startDate||null,endDate:np.endDate||null,
      targetType:TYPES.find(t=>t.id===np.type)?.targetType||"all",
      targetValue:np.type==="low_stock_discount"?np.stockThreshold:np.targetValue,
      description:np.description};
    try{
      const res=await API.settings.createPromo(data);
      setPromos(p=>[res,...p]);
      addAudit("PROMO",`Nouvelle promo: ${np.name}`);notify(`Promo "${np.name}" créée`,"success");
      setCreateModal(false);setNp(defaultNp);
    }catch(e){notify(e.message,"error");}};

  const selectStyle={width:"100%",padding:10,borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:12,fontFamily:"inherit",background:C.surface};

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div><h2 style={{fontSize:22,fontWeight:800,margin:0}}>Promotions</h2>
        <p style={{fontSize:12,color:C.textMuted,marginTop:2}}>{promos.filter(p=>p.active).length} active{promos.filter(p=>p.active).length>1?"s":""} sur {promos.length}</p></div>
      <Btn onClick={()=>setCreateModal(true)} style={{fontSize:11,background:C.warn}}><Plus size={12}/> Nouvelle promo</Btn></div>

    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {promos.map(pm=>{const t=pm.promo_type||pm.type;const dt=pm.discount_type||pm.discountType||"percent";
        return(<div key={pm.id} style={{display:"flex",alignItems:"center",gap:10,padding:12,borderRadius:12,background:C.surface,
          border:`1.5px solid ${pm.active?C.warn+"44":C.border}`,opacity:pm.active?1:0.6}}>
          <div style={{width:8,height:8,borderRadius:4,background:pm.active?"#059669":C.textLight}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>{pm.name}
              <Badge color={C.warn}>{dt==="amount"?`-${pm.value}€`:`-${pm.value}%`}</Badge>
              <Badge color={C.info}>{getTypeLabel(t)}</Badge></div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>
              {getTargetLabel(pm)}
              {(pm.start_date||pm.startDate)&&` — Du ${pm.start_date||pm.startDate}`}
              {(pm.end_date||pm.endDate)&&` au ${pm.end_date||pm.endDate}`}
              {pm.description&&` — ${pm.description}`}
            </div></div>
          <Btn variant={pm.active?"success":"outline"} onClick={()=>togglePromo(pm.id)} style={{fontSize:10,padding:"4px 12px"}}>
            {pm.active?"Active":"Inactive"}</Btn>
          <button onClick={()=>deletePromo(pm.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.danger}}><Trash2 size={14}/></button>
        </div>);})}
      {promos.length===0&&<div style={{textAlign:"center",padding:30,color:C.textLight}}>Aucune promotion configurée</div>}
    </div>

    <Modal open={createModal} onClose={()=>setCreateModal(false)} title="Nouvelle règle de promotion" wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{gridColumn:"span 2"}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>NOM DE LA PROMO</label>
          <Input value={np.name} onChange={e=>setNp(p=>({...p,name:e.target.value}))} placeholder="Ex: Soldes été -30% Robes"/></div>

        <div style={{gridColumn:"span 2"}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>TYPE DE RÈGLE</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:6,marginTop:4}}>
            {TYPES.map(t=>(<button key={t.id} onClick={()=>setNp(p=>({...p,type:t.id,targetType:t.targetType,targetValue:""}))}
              style={{padding:"10px 12px",borderRadius:10,border:`1.5px solid ${np.type===t.id?C.warn:C.border}`,
                background:np.type===t.id?C.warn+"12":"transparent",cursor:"pointer",textAlign:"left",fontFamily:"inherit",transition:"all 0.15s"}}>
              <div style={{fontSize:12,fontWeight:600,color:np.type===t.id?C.warn:C.text}}>{t.label}</div>
              <div style={{fontSize:9,color:C.textMuted,marginTop:2}}>{t.desc}</div></button>))}</div></div>

        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>VALEUR DE REMISE</label>
          <div style={{display:"flex",gap:6}}>
            <Input type="number" value={np.value} onChange={e=>setNp(p=>({...p,value:e.target.value}))} placeholder="30" style={{flex:1}}/>
            <select value={np.discountType} onChange={e=>setNp(p=>({...p,discountType:e.target.value}))} style={{...selectStyle,width:80}}>
              <option value="percent">%</option>
              <option value="amount">€</option></select></div></div>

        {/* Category target */}
        {np.type==="category_discount"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>CATÉGORIE</label>
          <select value={np.targetValue} onChange={e=>setNp(p=>({...p,targetValue:e.target.value}))} style={selectStyle}>
            <option value="">Choisir une catégorie...</option>
            {categories.map(c=>(<option key={c} value={c}>{c}</option>))}
          </select></div>}

        {/* SKU target */}
        {np.type==="sku_discount"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>RÉFÉRENCE PRODUIT</label>
          <select value={np.targetValue} onChange={e=>setNp(p=>({...p,targetValue:e.target.value}))} style={selectStyle}>
            <option value="">Choisir un produit...</option>
            {skuList.map(s=>(<option key={s.sku} value={s.sku}>{s.sku} — {s.name}</option>))}
          </select></div>}

        {/* Color target */}
        {np.type==="color_discount"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>COULEUR</label>
          <select value={np.targetValue} onChange={e=>setNp(p=>({...p,targetValue:e.target.value}))} style={selectStyle}>
            <option value="">Choisir une couleur...</option>
            {colors.map(c=>(<option key={c} value={c}>{c}</option>))}
          </select></div>}

        {/* Collection target */}
        {np.type==="collection_discount"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>COLLECTION</label>
          <Input value={np.targetValue} onChange={e=>setNp(p=>({...p,targetValue:e.target.value}))} placeholder="Ex: PE-2026"/></div>}

        {/* Low stock threshold */}
        {np.type==="low_stock_discount"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>SEUIL DE STOCK (pièces restantes)</label>
          <Input type="number" value={np.stockThreshold} onChange={e=>setNp(p=>({...p,stockThreshold:e.target.value}))} placeholder="5"/></div>}

        {/* Qty discount */}
        {np.type==="qty_discount"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>QUANTITÉ MIN. DANS LE PANIER</label>
          <Input type="number" value={np.minQty} onChange={e=>setNp(p=>({...p,minQty:e.target.value}))} placeholder="3"/></div>}

        {/* Code promo */}
        {np.type==="code"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>CODE PROMO</label>
          <Input value={np.code} onChange={e=>setNp(p=>({...p,code:e.target.value.toUpperCase()}))} placeholder="Ex: WELCOME10"/></div>}

        {/* Cross-rule: optional qty condition for target-based types */}
        {["category_discount","sku_discount","color_discount","collection_discount"].includes(np.type)&&
        <div style={{gridColumn:"span 2",background:C.surfaceAlt,borderRadius:10,padding:12,border:`1px dashed ${C.border}`}}>
          <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"flex",alignItems:"center",gap:4}}>
            CONDITION QUANTITÉ (optionnel — laisser vide = pas de minimum)</label>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
            <span style={{fontSize:12,color:C.text}}>Appliquer la remise à partir de</span>
            <Input type="number" min="1" value={np.minQty} onChange={e=>setNp(p=>({...p,minQty:e.target.value}))} placeholder="—" style={{width:70,textAlign:"center"}}/>
            <span style={{fontSize:12,color:C.text}}>article(s) correspondant(s) dans le panier</span></div>
          <div style={{fontSize:9,color:C.textMuted,marginTop:4}}>Ex: "2" = la remise ne s'applique que si le client achète au moins 2 articles de cette cible</div>
        </div>}

        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>DATE DÉBUT (optionnel)</label>
          <Input type="date" value={np.startDate} onChange={e=>setNp(p=>({...p,startDate:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>DATE FIN (optionnel)</label>
          <Input type="date" value={np.endDate} onChange={e=>setNp(p=>({...p,endDate:e.target.value}))}/></div>
        <div style={{gridColumn:"span 2"}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>DESCRIPTION (optionnel)</label>
          <Input value={np.description} onChange={e=>setNp(p=>({...p,description:e.target.value}))} placeholder="Remarque interne..."/></div>
      </div>
      <Btn onClick={createPromo} disabled={!np.name||!np.value}
        style={{width:"100%",height:44,background:C.warn}}>Créer la promotion</Btn></Modal>
  </div>);
}

/* ══════════ FOOTFALL COUNTER ══════════ */
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
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        {last7.length>0&&<thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
          {["Date","Entrées","Ventes","Conversion"].map(h=>(<th key={h} style={{padding:8,textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted}}>{h}</th>))}</tr></thead>}
        <tbody>{last7.map(f=>{const dayTickets=tickets.filter(t=>(t.date||t.createdAt||t.created_at||"").startsWith(f.date)).length;
          const conv=f.count>0?(dayTickets/f.count*100):0;
          return(<tr key={f.date} style={{borderBottom:`1px solid ${C.border}`}}>
            <td style={{padding:8,fontWeight:600}}>{new Date(f.date).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</td>
            <td style={{padding:8,fontWeight:700,color:C.primary}}>{f.count}</td>
            <td style={{padding:8}}>{dayTickets}</td>
            <td style={{padding:8,fontWeight:700,color:conv>=20?"#059669":conv>=10?C.warn:C.danger}}>{conv.toFixed(1)}%</td>
          </tr>);})}</tbody></table>
    </div>
  </div>);
}

function HelpCashierScreen(){
  const[openIdx,setOpenIdx]=useState(null);
  const sections=[
    {icon:"🛒",title:"Encaisser une vente",desc:"Ajouter des articles au panier et finaliser un paiement.",steps:[
      "Vous êtes sur l'écran « Vente » (1er bouton de la barre latérale gauche, icône caddie).",
      "L'écran est divisé en 2 colonnes : la grille des produits à droite, et le panier à gauche.",
      "Pour ajouter un article : tapez le nom, la référence SKU ou le code-barres dans la barre de recherche en haut de la grille produits.",
      "Cliquez sur la carte du produit dans la grille. Si le produit a des variantes (taille/couleur), une popup s'ouvre : cliquez sur la variante souhaitée. Le stock disponible est affiché pour chaque variante.",
      "L'article apparaît dans le panier (colonne de gauche). Pour modifier la quantité, cliquez sur les boutons « + » et « − » à côté de l'article.",
      "Pour supprimer un article du panier, cliquez sur l'icône corbeille rouge à droite de la ligne de l'article.",
      "En bas du panier se trouve le récapitulatif : sous-total HT, remises, TVA et total TTC.",
      "Pour payer, cliquez sur un des boutons de paiement :",
      "  • « Carte » (bleu) → Paiement carte bancaire. Le paiement est enregistré immédiatement.",
      "  • « Espèces » (vert) → Un pavé numérique s'ouvre. Saisissez le montant remis par le client. Le rendu de monnaie se calcule automatiquement. Des boutons rapides proposent le montant exact, 5€, 10€, 50€, 100€.",
      "  • « Cadeau » (doré) → Paiement par carte cadeau.",
      "  • « Chèque » (gris) → Paiement par chèque.",
      "  • « Fractionné » (violet) → Répartir entre plusieurs moyens de paiement (voir section dédiée).",
      "Après validation, le ticket s'affiche avec l'empreinte NF525. Cliquez « Imprimer » pour l'impression thermique, « Email » pour l'envoyer au client, ou « Terminé » pour revenir à l'écran de vente."
    ]},
    {icon:"🔍",title:"Filtrer les produits et favoris",desc:"Trouver rapidement un produit par catégorie ou favoris.",steps:[
      "Sur l'écran « Vente », sous la barre de recherche, vous voyez les onglets de catégories : « Tous », puis chaque catégorie de vos produits.",
      "Cliquez sur une catégorie pour afficher uniquement les produits de cette catégorie.",
      "Cliquez sur « Favoris » (icône étoile, tout à droite) pour afficher uniquement vos produits favoris.",
      "Pour ajouter un produit en favori : cliquez sur l'icône étoile (☆) en bas à droite de la carte du produit dans la grille. L'étoile se remplit (★).",
      "Pour retirer un favori : recliquez sur l'étoile pleine.",
      "Les favoris sont pratiques pour accéder rapidement aux produits les plus vendus sans chercher."
    ]},
    {icon:"📝",title:"Article divers / Services",desc:"Ajouter un article libre ou un service rapide au panier.",steps:[
      "Sur l'écran « Vente », cliquez sur l'icône crayon (✏️) en haut à droite, à côté du bouton pause.",
      "Une popup « Article divers / Services » s'ouvre.",
      "SERVICES RAPIDES : 4 boutons prédéfinis sont proposés — « Retouche bas de manches » (10€), « Retouche bas d'ourlet » (15€), « Retouche ajustement » (20€), « Emballage cadeau » (5€). Cliquez sur un bouton pour l'ajouter directement au panier.",
      "ARTICLE PERSONNALISÉ : en bas de la popup, saisissez une description (ex : « Retouche ceinture ») et un prix TTC, puis cliquez « Ajouter au panier ».",
      "L'article apparaît dans le panier avec la mention « (divers) » et l'icône 📝."
    ]},
    {icon:"💸",title:"Appliquer une remise",desc:"Remise sur un article ou sur tout le panier.",steps:[
      "REMISE sur UN article : dans le panier (colonne gauche), cliquez sur le bouton « Remise » à droite de l'article (il affiche « Remise » si aucune remise, ou « -10% » si une remise est déjà appliquée).",
      "Une popup s'ouvre. Choisissez le type : « % » (pourcentage) ou « € » (montant fixe en euros).",
      "Saisissez la valeur (ex : 10 pour 10% ou 5 pour 5€). Des boutons rapides sont proposés : 5%, 10%, 15%, 20% (ou 2€, 5€, 10€, 20€ en mode montant).",
      "Cliquez « Appliquer ». Le prix barré et le nouveau prix apparaissent sur la ligne de l'article.",
      "REMISE GLOBALE sur tout le panier : cliquez sur « Remise globale » (icône %) sous la liste des articles dans le panier, juste au-dessus des boutons de paiement.",
      "Choisissez % ou €, saisissez la valeur, puis « Appliquer ». Pour supprimer la remise globale, cliquez « Supprimer » dans la popup.",
      "⚠️ La remise maximale autorisée dépend de votre rôle. Si vous dépassez la limite, un message rouge apparaît et le bouton « Appliquer » est désactivé."
    ]},
    {icon:"🏷️",title:"Code promo et promotions",desc:"Saisir un code promo ou voir les promos actives.",steps:[
      "Sur l'écran « Vente », en haut du panier (colonne gauche), sous le bouton client, vous voyez le champ « Code promo… ».",
      "Saisissez le code promo donné par le client (ex : SOLDES20) et cliquez « OK ».",
      "Si le code est valide et actif, la remise s'applique automatiquement au panier. Le détail apparaît en vert dans le récapitulatif (ex : « ✓ Promo SOLDES20 »).",
      "Les promotions actives sont aussi affichées dans un bandeau jaune au-dessus de la grille produits (ex : « Promos actives: Soldes été »).",
      "Les promos de type « collection » ou « quantité » s'appliquent automatiquement sans code — elles sont calculées quand les conditions sont remplies.",
      "Pour voir toutes les promos disponibles : cliquez sur « Promos » dans la barre latérale gauche (9ème bouton, icône éclair)."
    ]},
    {icon:"💳",title:"Paiement fractionné (multi-moyens)",desc:"Payer une partie en CB, une partie en espèces, etc.",steps:[
      "Depuis l'écran « Vente », avec des articles dans le panier, cliquez sur le bouton violet « Fractionné » en bas du panier.",
      "La popup de paiement fractionné s'ouvre. Le montant total est affiché en haut.",
      "5 champs de paiement sont disponibles :",
      "  • CB/AMEX : deux boutons « CB » et « AMEX » permettent de choisir le type de carte. Saisissez le montant.",
      "  • Espèces : saisissez le montant payé en liquide.",
      "  • Carte cadeau : saisissez le montant à débiter de la carte cadeau.",
      "  • Chèque : saisissez le montant du chèque.",
      "  • Avoir client : saisissez le montant d'un avoir à utiliser.",
      "Le bouton « = Reste » à côté de chaque champ remplit automatiquement le montant restant à payer. Pratique pour le dernier moyen.",
      "Le bandeau « Reste à payer » en bas se met à jour en temps réel. Quand il affiche 0,00€ (fond vert), le bouton « Valider » devient actif.",
      "Cliquez « Valider » pour finaliser. Le ticket affichera le détail de chaque moyen utilisé (ex : « CB 30,00€ + ESP 15,50€ »)."
    ]},
    {icon:"👤",title:"Choisir un vendeur",desc:"Attribuer la vente à un autre vendeur.",steps:[
      "Sur l'écran « Vente », en bas du panier, juste au-dessus du bouton « Vider le panier », vous voyez un menu déroulant « Vendeur: [votre nom] (moi) ».",
      "Cliquez sur ce menu pour sélectionner un autre vendeur parmi la liste des utilisateurs actifs.",
      "La vente sera attribuée au vendeur sélectionné dans les statistiques et le ticket de caisse.",
      "À côté du menu vendeur, un champ « Note… » permet d'ajouter une note libre à la vente (ex : « Cadeau anniversaire »). Cette note apparaîtra sur le ticket."
    ]},
    {icon:"❌",title:"Annuler une vente / Vider le panier",desc:"Annuler le panier en cours avec un motif NF525.",steps:[
      "Pour vider le panier simplement : cliquez sur le bouton rouge « Vider le panier » tout en bas du panier, ou appuyez sur F8.",
      "Si le panier contient des articles, une popup de confirmation apparaît.",
      "Sélectionnez un motif d'annulation dans le menu déroulant (obligatoire NF525) : « Erreur de saisie », « Client annule l'achat », « Produit indisponible », « Erreur de prix », « Autre ».",
      "Cliquez « Confirmer l'annulation ». L'annulation est enregistrée dans le journal d'audit.",
      "Pour annuler une vente DÉJÀ validée : allez dans « Tickets » (6ème bouton), retrouvez le ticket, et cliquez « Annuler » dans le détail.",
      "⚠️ L'annulation de ventes est tracée de manière inaltérable (NF525). Un motif est toujours obligatoire."
    ]},
    {icon:"↩️",title:"Faire un retour / échange",desc:"Retourner un article et rembourser ou faire un avoir.",steps:[
      "Cliquez sur « Retours » dans la barre latérale gauche (2ème bouton, icône flèche).",
      "Recherchez le ticket d'origine : tapez le numéro de ticket, le nom du client ou la date dans la barre de recherche en haut.",
      "Cliquez sur le ticket trouvé pour l'ouvrir. La liste des articles du ticket s'affiche.",
      "Cochez les articles à retourner en cliquant sur la case à gauche de chaque article. Ajustez la quantité retournée si nécessaire.",
      "Sélectionnez le motif du retour dans le menu déroulant (taille incorrecte, défaut, changement d'avis, etc.).",
      "Choisissez le mode de remboursement en bas de l'écran :",
      "  • « Avoir » → Génère un bon d'avoir avec un code unique que le client pourra utiliser lors d'un prochain achat.",
      "  • « Espèces » → Remboursement en liquide directement.",
      "  • « Carte » → Remboursement sur la carte bancaire du client.",
      "  • « Échange » → Le montant retourné est crédité pour un nouvel achat immédiat.",
      "Cliquez sur « Valider le retour » pour confirmer. Un ticket de retour est généré et signé (NF525).",
      "⚠️ Le délai maximum de retour et les modes autorisés sont configurables dans Réglages → onglet « Retours »."
    ]},
    {icon:"📷",title:"Scanner un code-barres",desc:"Ajouter des articles en scannant leur code-barres.",steps:[
      "Branchez votre scanner USB ou connectez-le en Bluetooth via les paramètres de votre appareil.",
      "Depuis l'écran « Vente », la barre de recherche est déjà active. Il suffit de scanner — pas besoin de cliquer.",
      "Le scanner « tape » automatiquement le code EAN. Si un produit correspond, il est ajouté au panier.",
      "Si le produit a des variantes, la popup de sélection de variante apparaît : choisissez la taille/couleur.",
      "Si aucun produit ne correspond, un message orange « Aucun produit pour EAN: [code] » s'affiche.",
      "Pour résoudre : vérifiez dans Dashboard → Produits → fiche du produit → champ EAN de chaque variante que le code est bien renseigné.",
      "Compatible EAN-13, EAN-8 et codes internes. Le scanner doit envoyer un « Entrée » (Enter) après le code."
    ]},
    {icon:"❤️",title:"Associer un client (fidélité)",desc:"Lier un client à la vente pour cumuler ses points.",steps:[
      "Sur l'écran « Vente », en haut du panier, cliquez sur le bouton « Associer un client » (bordure pointillée avec icône personnes).",
      "La popup client s'ouvre avec la liste de tous les clients.",
      "Cliquez sur un client pour l'associer. Son nom, ses points et son tier (Bronze/Silver/Gold) apparaissent en haut du panier.",
      "Pour chercher un client : la liste est filtrable, scrollez pour trouver le bon.",
      "Pour créer un nouveau client : cliquez « + Nouveau client » dans la popup. Remplissez Prénom, Nom, Email, Téléphone puis « Créer et associer ».",
      "Pour retirer le client : rouvrez la popup et cliquez « Aucun client ».",
      "Les points de fidélité (+1 point par euro dépensé) sont ajoutés automatiquement après validation de la vente.",
      "Si le client a un historique, le « Prix précédent » est affiché en gris sous chaque article dans le panier."
    ]},
    {icon:"⏸️",title:"Mettre un panier en attente",desc:"Sauvegarder le panier pour le reprendre plus tard.",steps:[
      "Depuis l'écran « Vente », avec des articles dans le panier, cliquez sur l'icône pause (⏸) en haut du panier à côté du titre, ou appuyez sur F5.",
      "Le panier est sauvegardé avec la date, l'heure et le client associé. L'écran se vide pour un nouveau client.",
      "Un badge rouge apparaît sur l'icône pause en haut pour indiquer le nombre de paniers en attente.",
      "Pour reprendre : cliquez sur l'icône pause (le badge indique combien de paniers sont en attente).",
      "La popup liste tous les paniers : date, nombre d'articles, nom du client. Cliquez « Reprendre » pour restaurer un panier.",
      "Plusieurs paniers peuvent être en attente en même temps."
    ]},
    {icon:"🖨️",title:"Imprimer un ticket / étiquette",desc:"Impression thermique et étiquettes code-barres.",steps:[
      "TICKET après une vente : le ticket s'affiche automatiquement. 3 boutons en bas :",
      "  • « Email » → Ouvre votre messagerie avec un email pré-rempli contenant les infos du ticket. L'adresse du client est pré-remplie s'il est associé.",
      "  • « Ticket » (ou « Imprimer ») → Envoie le ticket à l'imprimante thermique connectée (ESC/POS). Si non connectée, ouvre le dialogue d'impression du navigateur.",
      "  • « Terminé » → Ferme le ticket et revient à l'écran de vente.",
      "CONFIGURER l'imprimante : « Réglages » (barre latérale) → onglet « 🖨️ Imprimante » → « Connecter l'imprimante ». Choisissez largeur 32 col. (58mm) ou 48 col. (80mm). Testez avec « Test impression ».",
      "ÉTIQUETTES code-barres : « Produits » (barre latérale) → cliquez sur un produit → bouton « Étiquettes ». Choisissez le format (50×30mm, 40×25mm, etc.) et les variantes à imprimer, puis cliquez « Imprimer les étiquettes ».",
      "PERSONNALISER le ticket : « Réglages » → onglet « 🧾 Ticket » → ajouter un logo (URL), modifier l'en-tête/pied de page, activer/désactiver l'affichage TVA détaillée, vendeur, etc.",
      "L'indicateur d'imprimante est visible en haut à droite de l'écran de vente : « ESC/POS » en vert si connectée, « — » sinon."
    ]},
    {icon:"✈️",title:"Vente en détaxe",desc:"Appliquer la détaxe pour un client hors UE.",steps:[
      "Depuis l'écran « Vente », avec des articles dans le panier (minimum 100,01€ TTC requis).",
      "Cliquez sur le bouton « Détaxe » juste au-dessus des boutons de paiement, à côté de « Remise globale ».",
      "Le bouton devient vert « ✓ Détaxe ». Un encadré vert apparaît : « Vente en détaxe — TVA à 0% — Réservé aux résidents hors UE ».",
      "La TVA passe à 0% sur tous les articles. Le total TTC = total HT.",
      "Finalisez le paiement normalement. Le ticket mentionne « VENTE EN DÉTAXE — TVA 0% — ART. 262 CGI ».",
      "Pour annuler la détaxe avant paiement : recliquez sur le bouton Détaxe pour le désactiver.",
      "⚠️ Vérifiez l'identité (passeport) et le bordereau PABLO. Réservé aux résidents hors Union Européenne."
    ]},
    {icon:"🔐",title:"Ouvrir et fermer la caisse",desc:"Fond de caisse à l'ouverture, clôture Z en fin de journée.",steps:[
      "OUVERTURE : au démarrage, l'écran d'ouverture de caisse apparaît automatiquement.",
      "Mode rapide : saisissez le montant total du fond de caisse dans le champ unique, puis cliquez « Ouvrir la caisse ».",
      "Mode détaillé : cliquez sur « Comptage par coupures » pour saisir le nombre de chaque billet (500€, 200€, 100€, 50€, 20€, 10€, 5€) et pièce (2€, 1€, 50c, 20c, 10c, 5c, 2c, 1c). Le total se calcule automatiquement.",
      "Pour ne pas ouvrir de caisse : cliquez « Passer » en haut de l'écran.",
      "CLÔTURE Z : cliquez sur « Clôture » dans la barre latérale gauche (10ème bouton, icône cadenas).",
      "L'écran affiche le récapitulatif de la journée : nombre de ventes, CA par moyen de paiement, total espèces théorique.",
      "Saisissez le montant réel compté en caisse. L'écart (positif ou négatif) s'affiche automatiquement.",
      "Cliquez « Valider la clôture Z » pour archiver. Le rapport est signé numériquement (NF525).",
      "⚠️ La clôture Z est obligatoire. Elle est inaltérable et constitue une pièce comptable officielle."
    ]},
    {icon:"📊",title:"Consulter les statistiques",desc:"Voir le CA, le panier moyen, les graphiques et les performances.",steps:[
      "Cliquez sur « Stats » dans la barre latérale gauche (3ème bouton, icône graphique).",
      "En haut : 5 indicateurs — CA TTC, Nombre de tickets, Panier moyen, Marge (€), Marge (%). Si une période est sélectionnée, un badge vert/rouge indique l'évolution vs la période précédente.",
      "FILTRES : sous les indicateurs, sélectionnez une période rapide (Aujourd'hui, Semaine, Ce mois, Mois dernier, Année, Tout) ou des dates précises avec les champs « du / au ». Filtrez aussi par catégorie.",
      "13 onglets sont disponibles pour détailler les statistiques :",
      "  • « Évolution CA » → Graphique en barres du CA jour par jour.",
      "  • « Comparaison » → Compare la période sélectionnée avec la période précédente.",
      "  • « CA par heure » → Graphique montrant les heures de pointe (utile pour le planning).",
      "  • « CA par jour » → CA par jour de la semaine (lundi, mardi…).",
      "  • « Best-sellers » → Classement des produits les plus vendus avec quantité et CA.",
      "  • « Détail variantes » → Ventes détaillées par produit et variante (taille/couleur).",
      "  • « Par vendeur » → CA par vendeur, commissions, et progression vs objectif.",
      "  • « Tailles/Couleurs » → Graphiques des tailles et couleurs les plus vendues.",
      "  • « Collections » → CA par collection, avec marge et quantité.",
      "  • « Clients » → Top clients par CA et fréquence d'achat.",
      "  • « Retours » → Statistiques des retours (taux, motifs, montants).",
      "  • « Paiements » → Répartition du CA par moyen de paiement (camembert).",
      "  • « Remises » → Total des remises accordées et détail.",
      "Bouton « Export CSV » en haut à droite pour télécharger les données au format tableur."
    ]},
    {icon:"📦",title:"Consulter le stock",desc:"Voir les niveaux de stock et les alertes.",steps:[
      "Cliquez sur « Stock » dans la barre latérale gauche (4ème bouton, icône grille).",
      "Un badge rouge sur l'icône Stock indique le nombre d'alertes de stock (rupture ou stock bas).",
      "L'écran affiche tous les produits avec le stock par variante (taille/couleur).",
      "Les variantes en rupture (stock = 0) sont en rouge. Les stocks bas sont en orange.",
      "Utilisez la barre de recherche pour trouver un produit spécifique.",
      "Pour ajuster un stock : cliquez sur le produit, modifiez la quantité de la variante et enregistrez.",
      "Les alertes de stock apparaissent aussi dans le bandeau vert « Aujourd'hui » en haut de l'écran de vente."
    ]},
    {icon:"📦",title:"Gérer les produits (mode caisse)",desc:"Voir, modifier et ajouter des produits depuis la caisse.",steps:[
      "Cliquez sur « Produits » dans la barre latérale gauche (5ème bouton, icône colis).",
      "La liste de tous les produits s'affiche avec nom, SKU, catégorie, prix, nombre de variantes et stock total.",
      "Cliquez sur un produit pour ouvrir sa fiche complète.",
      "Vous pouvez modifier le nom, le prix, la catégorie, la TVA, le coût d'achat, et les variantes.",
      "Pour chaque variante : modifiez la taille, la couleur, le code EAN et le stock.",
      "Cliquez « Enregistrer » pour sauvegarder. « Étiquettes » pour imprimer des étiquettes code-barres. « Supprimer » pour supprimer le produit.",
      "Bouton « + Nouveau produit » en haut pour créer un nouveau produit directement depuis la caisse.",
      "Bouton « Dupliquer » pour copier un produit existant."
    ]},
    {icon:"📜",title:"Historique des tickets",desc:"Retrouver, consulter et réimprimer un ancien ticket.",steps:[
      "Cliquez sur « Tickets » dans la barre latérale gauche (6ème bouton, icône ticket).",
      "La liste de tous les tickets s'affiche, du plus récent au plus ancien, avec la date, le numéro, le montant, le mode de paiement et le vendeur.",
      "Utilisez la barre de recherche en haut pour filtrer par numéro de ticket, nom de client ou date.",
      "Cliquez sur un ticket pour voir le détail complet : articles (avec taille/couleur/EAN), montants, TVA, mode de paiement, empreinte NF525.",
      "Depuis le détail du ticket :",
      "  • « Imprimer » → Réimprime le ticket sur l'imprimante thermique.",
      "  • « Email » → Envoie le ticket par email au client.",
      "  • « Annuler » → Annule la vente (nécessite un motif NF525). L'annulation est irréversible et tracée.",
      "Les tickets annulés sont barrés et marqués en rouge dans la liste."
    ]},
    {icon:"👥",title:"Gérer les clients",desc:"Ajouter, modifier ou consulter les fiches clients.",steps:[
      "Cliquez sur « Clients » dans la barre latérale gauche (7ème bouton, icône personnes).",
      "La liste de tous les clients s'affiche avec nom, email, téléphone, points de fidélité et tier (Bronze/Silver/Gold).",
      "Barre de recherche en haut pour filtrer par nom, email ou téléphone.",
      "« + Nouveau client » en haut à droite : remplissez Prénom, Nom, Email, Téléphone, Ville, Notes, puis « Créer ».",
      "Bouton « Modifier » (icône crayon) : ouvre la fiche pour modifier les informations.",
      "Bouton « Historique » : affiche toutes les ventes passées de ce client avec les dates et montants.",
      "Bouton « RGPD » : exporte ou supprime les données personnelles du client (conformité RGPD).",
      "Les points de fidélité sont attribués automatiquement (+1 point par euro dépensé). Les tiers sont : Bronze (0-199), Silver (200-499), Gold (500+)."
    ]},
    {icon:"🎁",title:"Cartes cadeaux",desc:"Créer, vendre et utiliser des cartes cadeaux.",steps:[
      "Cliquez sur « Cadeaux » dans la barre latérale gauche (8ème bouton, icône cadeau).",
      "La liste de toutes les cartes s'affiche : code, montant initial, solde restant, date de création, statut (active/épuisée).",
      "CRÉER : cliquez « + Nouvelle carte cadeau », saisissez le montant (ex : 50€), cliquez « Créer ». Un code unique est généré automatiquement.",
      "UTILISER lors d'un paiement : choisissez « Fractionné » dans les boutons de paiement, puis saisissez le montant dans le champ « Carte cadeau ».",
      "Le solde de la carte diminue du montant utilisé. Si le solde ne suffit pas, complétez avec un autre moyen de paiement."
    ]},
    {icon:"🏷️",title:"Consulter les promotions",desc:"Voir les promotions actives et les appliquer.",steps:[
      "Cliquez sur « Promos » dans la barre latérale gauche (9ème bouton, icône éclair).",
      "Les promotions actives sont affichées avec un badge vert. Les inactives en gris.",
      "3 types de promos : « Collection » (s'applique à une catégorie entière), « Quantité » (ex : 3 pour le prix de 2), « Code promo » (le client donne un code).",
      "Les promos « Collection » et « Quantité » s'appliquent automatiquement lors de l'encaissement.",
      "Les promos « Code promo » nécessitent de saisir le code dans le champ « Code promo… » en haut du panier.",
      "Pour créer ou modifier des promotions, il faut passer en mode Dashboard → Promotions."
    ]},
    {icon:"🚶",title:"Compteur d'entrées (footfall)",desc:"Compter les visiteurs pour calculer le taux de conversion.",steps:[
      "Cliquez sur « Entrées » dans la barre latérale gauche (11ème bouton, icône activité).",
      "Le compteur du jour est affiché en gros. Cliquez sur le bouton « + Entrée » à chaque visiteur entrant dans le magasin.",
      "Le taux de conversion est calculé automatiquement : (nombre de tickets du jour ÷ nombre d'entrées) × 100.",
      "Un tableau en dessous affiche l'historique jour par jour : date, entrées, tickets, taux de conversion.",
      "Un bon taux de conversion en textile est entre 15% et 30%."
    ]},
    {icon:"📋",title:"Journal d'audit",desc:"Traçabilité complète de toutes les actions.",steps:[
      "Cliquez sur « Audit » dans la barre latérale gauche (12ème bouton, icône activité).",
      "2 onglets en haut : « Audit » (actions métier) et « JET (NF525) » (événements techniques).",
      "L'onglet Audit affiche : ventes, annulations, modifications de produits, modifications de prix, réceptions de stock, connexions, etc.",
      "L'onglet JET affiche : connexions, déconnexions, changements de paramètres, erreurs système.",
      "Filtrez par utilisateur avec le menu déroulant en haut à droite.",
      "Bouton « Export » pour télécharger le journal en CSV.",
      "Navigation par pages en bas si le journal est long.",
      "⚠️ Ce journal est inaltérable (NF525). Il constitue une preuve en cas de contrôle fiscal."
    ]},
    {icon:"🛡️",title:"Conformité NF525",desc:"Vérifier la chaîne fiscale, exporter FEC et archive.",steps:[
      "Cliquez sur « NF525 » dans la barre latérale gauche (13ème bouton, icône bouclier).",
      "En haut : l'attestation de conformité avec le numéro de certification, l'organisme (INFOCERT/LNE) et la catégorie.",
      "3 compteurs : Tickets (nombre total), Clôtures Z, GT (Grand Total cumulé).",
      "La chaîne SHA-256 : chaque vente est signée et chaînée à la précédente. Le dernier hash est affiché.",
      "Bouton « Archive fiscale » : télécharge un fichier JSON avec toutes les données fiscales.",
      "Bouton « Export FEC » : génère le Fichier des Écritures Comptables au format réglementaire pour l'administration fiscale ou votre comptable.",
      "Bouton « Vérifier l'intégrité de la chaîne » : lance un contrôle complet. Un résultat vert = tout est conforme, rouge = anomalie détectée.",
      "En bas : le tableau « Déclaration TVA assistée » avec la base HT et la TVA collectée par taux."
    ]},
    {icon:"⚙️",title:"Réglages complets",desc:"Tous les paramètres de la caisse et de la boutique.",steps:[
      "Cliquez sur « Réglages » dans la barre latérale gauche (14ème bouton, icône engrenage).",
      "13 onglets disponibles en haut de l'écran :",
      "  • « Général » → Nom boutique, adresse, code postal, ville, SIRET, N° TVA intra, téléphone, message de pied de ticket. Cliquez « Enregistrer » après modification.",
      "  • « 💰 Prix HT/TTC » → Choisissez si vous saisissez vos prix en HT ou TTC. Le système calcule automatiquement l'autre.",
      "  • « Commission » → Configurez le taux de commission des vendeurs (% sur marge ou CA).",
      "  • « Magasins » → Ajoutez plusieurs points de vente avec nom et adresse. Utile pour le multi-sites.",
      "  • « 🖨️ Imprimante » → Connecter/déconnecter l'imprimante thermique, choisir largeur (32/48 col.), test d'impression. En dessous : configuration des étiquettes (format, contenu).",
      "  • « 🧾 Ticket » → URL du logo, texte d'en-tête, texte de pied de page, cases à cocher pour afficher/masquer : TVA détaillée, vendeur, N° ticket, date, etc.",
      "  • « 📺 Écran 2 » → Couleur de fond (hex), couleur texte (hex), URL du logo, message d'accueil quand le panier est vide.",
      "  • « 🏷️ Icônes catégories » → Pour chaque catégorie, saisissez un emoji (ex : 👕 pour Hauts, 👖 pour Bas). Cet emoji apparaît sur les cartes produits dans la grille de vente.",
      "  • « Retours » → Délai max de retour (jours), motifs autorisés, modes de remboursement activés (avoir, espèces, carte, échange).",
      "  • « 📏 Ordre tailles » → Liste de toutes les tailles avec leur rang de tri. Modifiez le numéro pour réordonner (ex : XS=1, S=2, M=3, L=4, XL=5). Les tailles de vos produits sont importées automatiquement.",
      "  • « Thème » → Couleur principale et couleur d'accent de l'interface.",
      "  • « Pointages » → Historique des pointages IN/OUT de tous les utilisateurs.",
      "  • « Historique prix » → Journal de toutes les modifications de prix : ancien prix → nouveau prix, date, utilisateur.",
      "⚠️ Cliquez « Enregistrer » après chaque modification d'onglet."
    ]},
    {icon:"⌨️",title:"Raccourcis clavier",desc:"Aller plus vite avec le clavier.",steps:[
      "F2 → Paiement rapide par carte bancaire (valide et encaisse le panier en CB immédiatement).",
      "F3 → Paiement rapide en espèces (montant exact, pas de rendu de monnaie).",
      "F4 → Ouvre la popup de paiement fractionné.",
      "F5 → Met le panier actuel en attente.",
      "F8 → Annule / vide le panier en cours (demande un motif).",
      "Shift + ? → Affiche la popup récapitulative des raccourcis.",
      "Vous pouvez aussi voir les raccourcis en cliquant sur « ? Raccourcis » en haut à droite de l'écran de vente (dans le bandeau vert).",
      "⚠️ Les raccourcis fonctionnent uniquement quand le curseur n'est PAS dans un champ de saisie."
    ]},
    {icon:"🔒",title:"Pointage (arrivée / départ)",desc:"Pointer son entrée et sa sortie de poste.",steps:[
      "Dans la barre latérale gauche, en haut sous votre initiale (le rond avec votre première lettre), vous voyez deux petits boutons :",
      "  • « IN » (fond vert clair) → Cliquez pour pointer votre arrivée. L'heure est enregistrée.",
      "  • « OUT » (fond rouge clair) → Cliquez pour pointer votre départ.",
      "Un indicateur « Online » (vert) ou « Offline » (rouge) est affiché juste en dessous pour voir l'état de la connexion.",
      "L'historique des pointages est consultable dans Réglages → onglet « Pointages », ou dans Dashboard → Journal d'audit."
    ]},
    {icon:"📺",title:"Écran client (Écran 2)",desc:"Afficher le panier sur un 2ème écran orienté vers le client.",steps:[
      "Dans la barre latérale gauche, tout en bas (avant le bouton rouge « Sortir »), cliquez sur le bouton « Écran 2 ».",
      "Une nouvelle fenêtre s'ouvre. Faites-la glisser sur le 2ème écran (orienté vers le client).",
      "L'écran affiche en temps réel : les articles ajoutés au panier, les prix, les remises et le total TTC.",
      "Quand le panier est vide, un message d'accueil personnalisable s'affiche.",
      "Pour personnaliser : « Réglages » → onglet « 📺 Écran 2 » → modifiez les couleurs, le logo et le message d'accueil."
    ]},
    {icon:"📶",title:"Mode hors-ligne et synchronisation",desc:"Que se passe-t-il quand la connexion est perdue.",steps:[
      "Un indicateur « Online » (point vert) ou « Offline » (point rouge) est visible sous votre initiale dans la barre latérale.",
      "Si la connexion au serveur est perdue, un bandeau orange/rouge apparaît en haut de l'écran : « Mode hors-ligne — Données locales ».",
      "Vous pouvez continuer à encaisser normalement. Les ventes sont enregistrées localement.",
      "Si des synchronisations échouent, un badge « ⏳ X sync » apparaît sous l'indicateur. Cliquez dessus pour voir les détails ou purger la file d'attente.",
      "Quand la connexion revient, les données se synchronisent automatiquement avec le serveur."
    ]},
    {icon:"🚪",title:"Se déconnecter",desc:"Quitter la session et revenir à l'écran de connexion.",steps:[
      "Dans la barre latérale gauche, tout en bas, cliquez sur le bouton rouge « Sortir » (icône de déconnexion).",
      "Vous revenez à l'écran de connexion. Le panier en cours est conservé en mémoire.",
      "Sur l'écran de connexion, vous pouvez choisir un autre utilisateur ou basculer en mode Dashboard (admin uniquement)."
    ]}
  ];
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
      <div style={{width:44,height:44,borderRadius:14,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <HelpCircle size={22} color="#fff"/></div>
      <div><h2 style={{fontSize:22,fontWeight:800,margin:0}}>Aide Caissier</h2>
        <p style={{fontSize:12,color:C.textMuted,margin:0}}>Guide complet — cliquez sur une section pour voir les instructions détaillées</p></div></div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {sections.map((s,idx)=>(<div key={s.title} style={{background:C.surface,borderRadius:16,border:`1.5px solid ${openIdx===idx?C.primary:C.border}`,boxShadow:`0 1px 4px ${C.shadow}`,overflow:"hidden",transition:"all 0.2s"}}>
        <button onClick={()=>setOpenIdx(openIdx===idx?null:idx)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <span style={{fontSize:26}}>{s.icon}</span>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:C.text}}>{s.title}</div>
            <div style={{fontSize:11,color:C.textMuted}}>{s.desc}</div></div>
          <ChevronDown size={18} color={C.textMuted} style={{transform:openIdx===idx?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}/></button>
        {openIdx===idx&&<div style={{padding:"0 18px 16px 18px",borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:12}}>
            {s.steps.map((step,i)=>(<div key={i} style={{display:"flex",alignItems:"start",gap:10,fontSize:12,color:C.text,lineHeight:1.5}}>
              {!step.startsWith("  •")&&!step.startsWith("⚠️")?<span style={{minWidth:22,height:22,borderRadius:11,background:`${C.primary}15`,color:C.primary,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{step.startsWith("⚠️")?"":(i+1)}</span>
              :<span style={{minWidth:22}}/>}
              <span style={{fontWeight:step.startsWith("⚠️")?600:400,color:step.startsWith("⚠️")?C.warn:step.startsWith("  •")?C.textMuted:C.text}}>{step}</span></div>))}</div></div>}
      </div>))}</div></div>);
}

function HelpDashboardScreen(){
  const[openIdx,setOpenIdx]=useState(null);
  const sections=[
    {icon:"📊",title:"Tableau de bord (Dashboard)",desc:"Vue d'ensemble de l'activité du magasin.",steps:[
      "Cliquez sur « Dashboard » dans la barre latérale gauche (1er élément, icône tableau de bord). C'est la page d'accueil du mode gestion.",
      "En haut : le bandeau vert « Aujourd'hui » affiche en temps réel le nombre de ventes du jour, le CA du jour et le panier moyen.",
      "En dessous : 4 cartes récapitulatives — CA total (Grand Total), Marge totale (si autorisé), Nombre de tickets, Alertes de stock.",
      "Si des produits sont en rupture ou stock bas, un encadré orange « Alertes de stock » liste les variantes concernées.",
      "En bas : le classement « Top 5 produits » affiche les articles les plus vendus avec la quantité et le CA généré."
    ]},
    {icon:"📦",title:"Gestion des produits",desc:"Ajouter, modifier, dupliquer et supprimer des produits.",steps:[
      "Cliquez sur « Produits » dans la barre latérale gauche (2ème élément, icône colis).",
      "La liste de tous vos produits s'affiche avec le nom, la catégorie, le prix et le nombre de variantes.",
      "AJOUTER un produit : cliquez sur le bouton « + Nouveau produit » en haut à droite.",
      "  • Remplissez les champs : Nom, SKU (référence), Catégorie, Prix de vente TTC (ou HT selon votre réglage), Prix d'achat (coût), Taux de TVA.",
      "  • Pour ajouter une variante : dans la section « Variantes », cliquez « + Ajouter une variante ». Renseignez la taille, la couleur, le code EAN et le stock initial.",
      "  • Cliquez « Enregistrer » pour sauvegarder le produit.",
      "MODIFIER un produit : cliquez sur la ligne du produit dans la liste. La fiche s'ouvre. Modifiez les champs souhaités puis cliquez « Enregistrer ».",
      "DUPLIQUER un produit : dans la fiche produit, cliquez sur le bouton « Dupliquer ». Une copie est créée avec le suffixe « (copie) ».",
      "IMPRIMER DES ÉTIQUETTES : dans la fiche produit, cliquez sur le bouton « Étiquettes » (entre « Enregistrer » et « Supprimer »). Sélectionnez le format et les variantes à imprimer.",
      "SUPPRIMER un produit : dans la fiche produit, cliquez sur le bouton « Supprimer » (en rouge). Confirmez la suppression.",
      "⚠️ La suppression est définitive. Pour les produits ayant un historique de vente, préférez les désactiver plutôt que les supprimer."
    ]},
    {icon:"📄",title:"Import CSV de produits",desc:"Importer des produits en masse depuis un fichier Excel/CSV.",steps:[
      "Cliquez sur « Produits » dans la barre latérale gauche, puis sur le bouton « Importer CSV » en haut de l'écran.",
      "Cliquez sur « Choisir un fichier » et sélectionnez votre fichier .csv (séparateur virgule ou point-virgule).",
      "L'aperçu des colonnes détectées s'affiche. Pour chaque colonne de votre fichier, sélectionnez le champ CaissePro correspondant dans le menu déroulant :",
      "  • Colonnes disponibles : Nom, SKU, Prix de vente, Prix d'achat, Catégorie, TVA, Taille, Couleur, EAN, Stock.",
      "Si vos colonnes portent des noms standard (name, price, sku, etc.), le mapping est automatique.",
      "Vérifiez l'aperçu des premières lignes en bas de l'écran. Les données doivent correspondre aux bons champs.",
      "Cliquez « Importer » pour lancer l'import. Une barre de progression s'affiche.",
      "À la fin, un résumé indique le nombre de produits créés et les éventuelles erreurs."
    ]},
    {icon:"📈",title:"Statistiques de vente",desc:"Analyser le CA, les tendances, les graphiques et les performances.",steps:[
      "Cliquez sur « Statistiques » dans la barre latérale gauche (4ème élément, icône graphique).",
      "En haut : 5 indicateurs clés — CA TTC, Nombre de tickets, Panier moyen, Marge (€), Marge (%). Si une période est filtrée, un badge vert/rouge montre l'évolution par rapport à la période précédente.",
      "FILTRES DE PÉRIODE : sous les indicateurs, cliquez sur un bouton rapide (Tout, Aujourd'hui, Semaine, Ce mois, Mois dernier, Année) ou saisissez des dates précises dans les champs « du / au ». Vous pouvez aussi filtrer par catégorie de produit.",
      "13 onglets sont disponibles pour détailler les statistiques :",
      "  • « Évolution CA » → Graphique en barres du chiffre d'affaires jour par jour sur la période sélectionnée.",
      "  • « Comparaison » → Compare les performances de la période actuelle avec la période précédente (même durée).",
      "  • « CA par heure » → Graphique montrant les heures de pointe de votre magasin. Utile pour optimiser le planning des vendeurs.",
      "  • « CA par jour » → CA par jour de la semaine (lundi, mardi…). Identifiez vos meilleurs jours.",
      "  • « Best-sellers » → Classement des produits les plus vendus : nom, SKU, quantité vendue, CA généré, marge.",
      "  • « Détail variantes » → Ventes détaillées par produit et par variante (taille/couleur). Utile pour réassortir.",
      "  • « Par vendeur » → CA par vendeur, nombre de ventes, commission calculée, progression vers l'objectif de vente.",
      "  • « Tailles/Couleurs » → Deux graphiques : les tailles les plus vendues et les couleurs les plus vendues.",
      "  • « Collections » → CA par collection/marque avec quantité et marge.",
      "  • « Clients » → Top clients par CA dépensé et fréquence d'achat.",
      "  • « Retours » → Taux de retour, montants retournés, motifs les plus fréquents.",
      "  • « Paiements » → Répartition du CA par moyen de paiement : camembert (CB, Espèces, Chèque, Carte cadeau, etc.).",
      "  • « Remises » → Total des remises accordées sur la période, par article et globales.",
      "Bouton « Export CSV » en haut à droite : télécharge les données au format tableur (compatible Excel)."
    ]},
    {icon:"↩️",title:"Retours & Avoirs",desc:"Consulter l'historique des retours et des avoirs émis.",steps:[
      "Cliquez sur « Retours & Avoirs » dans la barre latérale gauche (5ème élément, icône flèche retour).",
      "Deux onglets sont disponibles en haut : « Tickets » (liste des ventes ayant fait l'objet d'un retour) et « Avoirs » (liste des avoirs générés).",
      "ONGLET TICKETS : chaque retour affiche la date, le numéro de ticket d'origine, les articles retournés, le motif et le mode de remboursement.",
      "ONGLET AVOIRS : chaque avoir affiche le code unique, le montant, la date de création et le statut (« Actif » si non utilisé, « Utilisé » si consommé).",
      "⚠️ Les retours sont tracés de manière inaltérable (NF525). Un retour ne peut pas être supprimé ni modifié après validation."
    ]},
    {icon:"👥",title:"Gestion des clients",desc:"Base de données clients et programme de fidélité.",steps:[
      "Cliquez sur « Clients » dans la barre latérale gauche (6ème élément, icône personnes).",
      "La liste de tous les clients s'affiche avec nom, email, téléphone, points de fidélité et tier (Bronze/Silver/Gold).",
      "AJOUTER un client : cliquez « + Nouveau client » en haut à droite. Renseignez le nom, l'email et le téléphone, puis « Créer ».",
      "MODIFIER un client : cliquez sur le bouton « Modifier » (icône crayon) à droite de la ligne du client.",
      "HISTORIQUE D'ACHATS : cliquez sur « Historique » à côté du client pour voir toutes ses ventes passées, les montants et les dates.",
      "RGPD : cliquez sur « RGPD » pour exporter ou supprimer les données personnelles du client (conformité RGPD).",
      "FIDÉLITÉ : les points sont attribués automatiquement à chaque achat. Les seuils des tiers sont configurables."
    ]},
    {icon:"👤",title:"Utilisateurs & rôles",desc:"Créer des comptes et gérer les permissions de l'équipe.",steps:[
      "Cliquez sur « Utilisateurs » dans la barre latérale gauche (7ème élément, icône personne).",
      "La liste de tous les utilisateurs s'affiche avec leur nom, rôle (Admin ou Caissier) et statut.",
      "CRÉER un utilisateur : cliquez « + Nouvel utilisateur » en haut à droite.",
      "  • Saisissez le nom, choisissez le rôle dans le menu déroulant (« Administrateur » ou « Caissier(e) »), et définissez un code PIN (mot de passe).",
      "  • Cliquez « Créer » pour enregistrer. Le compte est immédiatement disponible sur tous les appareils.",
      "MODIFIER un utilisateur : cliquez sur le bouton « Modifier » (icône engrenage) à droite de la ligne. Changez le nom, le rôle ou le PIN, puis « Enregistrer ».",
      "  • Pour changer le PIN : saisissez le nouveau PIN dans le champ « CODE PIN ». Laissez vide pour ne pas le modifier.",
      "SUPPRIMER un utilisateur : cliquez sur l'icône corbeille (🗑️) à droite. L'utilisateur est désactivé (pas supprimé, pour conserver l'historique).",
      "⚠️ Les rôles déterminent les permissions : un « Caissier » n'a pas accès au Dashboard, un « Admin » a tous les droits."
    ]},
    {icon:"💶",title:"Taux de TVA",desc:"Gérer les taux de TVA appliqués aux produits.",steps:[
      "Cliquez sur « Taux de TVA » dans la barre latérale gauche (8ème élément, icône pourcentage).",
      "La liste des taux actifs s'affiche : libellé et pourcentage (ex : « Normal 20% », « Réduit 5,5% »).",
      "MODIFIER un taux : cliquez « Modifier » à droite du taux. Changez le libellé ou le pourcentage, puis cliquez l'icône de sauvegarde (💾).",
      "AJOUTER un taux : en bas de l'écran, remplissez « Libellé » (ex : « Super réduit ») et « Taux % » (ex : 2.1), puis cliquez « + Ajouter ».",
      "SUPPRIMER un taux : cliquez l'icône corbeille à droite. Au moins un taux doit rester.",
      "ℹ️ En bas de page : un rappel des taux légaux en France (20%, 10%, 5,5%, 2,1%) avec leur usage.",
      "⚠️ Modifier un taux ne change pas la TVA des produits existants. Changez la TVA produit par produit dans leur fiche."
    ]},
    {icon:"🎁",title:"Cartes cadeaux",desc:"Créer et suivre les cartes cadeaux.",steps:[
      "Cliquez sur « Cartes cadeaux » dans la barre latérale gauche (9ème élément, icône cadeau).",
      "La liste de toutes les cartes s'affiche avec le code, le montant initial, le solde restant et le statut.",
      "CRÉER une carte : cliquez « + Nouvelle carte cadeau ». Saisissez le montant et cliquez « Créer ». Un code unique est généré automatiquement.",
      "UTILISER une carte : lors d'un paiement en mode caisse, choisissez « Fractionné », puis saisissez le code de la carte dans le champ dédié.",
      "Le solde de la carte diminue du montant utilisé. Quand le solde atteint 0€, la carte est marquée comme épuisée."
    ]},
    {icon:"🏷️",title:"Promotions",desc:"Créer, activer et gérer les promotions.",steps:[
      "Cliquez sur « Promotions » dans la barre latérale gauche (10ème élément, icône éclair).",
      "La liste des promotions s'affiche. Les promos actives ont un badge vert, les inactives un badge gris.",
      "CRÉER une promo : cliquez « + Nouvelle promotion » en haut à droite.",
      "  • Choisissez le type : « Collection » (s'applique à une catégorie), « Quantité » (ex : 3 pour le prix de 2), ou « Code promo » (le client doit saisir un code).",
      "  • Saisissez le nom, la valeur de la remise (en %), les dates de début et fin.",
      "  • Pour « Collection » : sélectionnez la catégorie concernée.",
      "  • Pour « Code promo » : définissez le code que le client devra donner (ex : SOLDES20).",
      "  • Cliquez « Créer » pour enregistrer.",
      "ACTIVER / DÉSACTIVER : cliquez sur le bouton toggle à droite de chaque promo pour l'activer ou la désactiver instantanément.",
      "Les promos actives s'appliquent automatiquement en caisse si les conditions sont remplies."
    ]},
    {icon:"🚶",title:"Compteur d'entrées (footfall)",desc:"Suivre la fréquentation et le taux de conversion.",steps:[
      "Cliquez sur « Entrées » dans la barre latérale gauche (11ème élément, icône activité).",
      "En haut : le compteur d'entrées du jour avec le bouton « + Entrée » pour ajouter un visiteur.",
      "En dessous : le taux de conversion du jour (nombre de tickets ÷ nombre d'entrées × 100).",
      "Le tableau en bas liste l'historique jour par jour : date, nombre d'entrées, nombre de tickets et taux de conversion.",
      "Le comptage peut aussi être fait depuis le mode caisse (même écran « Entrées »)."
    ]},
    {icon:"⚙️",title:"Paramètres complets",desc:"Configurer tous les aspects de la boutique.",steps:[
      "Cliquez sur « Paramètres » dans la barre latérale gauche (12ème élément, icône engrenage).",
      "Les onglets sont affichés en haut de l'écran. Cliquez sur un onglet pour accéder à sa section :",
      "ONGLET « Général » : informations de la boutique — Nom, Adresse, Code postal, Ville, SIRET, N° TVA intracommunautaire, Téléphone, Message ticket de caisse. Remplissez chaque champ puis cliquez « Enregistrer ».",
      "ONGLET « 💰 Prix HT/TTC » : choisissez si vous saisissez vos prix en HT ou en TTC. Le système calcule automatiquement l'autre valeur.",
      "ONGLET « Commission » : configurez les commissions vendeurs (pourcentage sur les ventes).",
      "ONGLET « Magasins » : si vous avez plusieurs points de vente, ajoutez-les ici avec leur nom et adresse.",
      "ONGLET « 🖨️ Imprimante » : connectez votre imprimante thermique (bouton « Connecter l'imprimante »), choisissez la largeur papier (32 ou 48 colonnes), testez l'impression. En dessous : configuration du format d'étiquettes code-barres (50×30mm, 40×25mm, etc.).",
      "ONGLET « 🧾 Ticket » : personnalisez le ticket de caisse — ajoutez un logo (collez l'URL de l'image), modifiez le texte d'en-tête et de pied de page, activez/désactivez l'affichage de la TVA détaillée, du vendeur, du numéro de ticket.",
      "ONGLET « 📺 Écran 2 » : personnalisez l'écran client — couleur de fond, couleur du texte, URL du logo, message d'accueil affiché quand le panier est vide.",
      "ONGLET « 🏷️ Icônes catégories » : pour chaque catégorie de produit, choisissez un emoji qui sera affiché sur les cartes produits dans la grille de vente en caisse. Cliquez sur le champ emoji à côté de la catégorie et saisissez l'emoji souhaité.",
      "ONGLET « Retours » : configurez la politique de retour — délai maximum (en jours), motifs autorisés, modes de remboursement disponibles (avoir, espèces, carte, échange).",
      "ONGLET « 📏 Ordre tailles » : réorganisez l'ordre d'affichage des tailles dans les fiches produits et dans la caisse. Modifiez le numéro de rang de chaque taille (les tailles sont triées par rang croissant : XS=1, S=2, M=3, etc.). Les nouvelles tailles de vos produits sont importées automatiquement.",
      "ONGLET « Thème » : choisissez les couleurs de l'interface (couleur principale, couleur d'accent).",
      "ONGLET « Pointages » : historique des pointages IN/OUT de tous les utilisateurs avec date et heure.",
      "ONGLET « Historique prix » : journal de toutes les modifications de prix sur vos produits (ancien prix → nouveau prix, date, utilisateur).",
      "⚠️ Après chaque modification, cliquez toujours sur « Enregistrer » pour sauvegarder."
    ]},
    {icon:"📦",title:"Gestion du stock",desc:"Suivre les niveaux de stock et gérer les alertes.",steps:[
      "Cliquez sur « Stock » dans la barre latérale gauche (3ème élément, icône grille).",
      "La liste de tous les produits s'affiche avec le stock actuel de chaque variante (taille/couleur).",
      "Les variantes en rupture (stock = 0) sont surlignées en rouge. Les variantes en stock bas sont en orange.",
      "AJUSTER un stock : cliquez sur le produit, modifiez la quantité de la variante et enregistrez.",
      "RÉCEPTION de marchandise : utilisez le bouton « Réception » pour ajouter du stock (livraison fournisseur).",
      "Les alertes de stock apparaissent aussi sur le Dashboard (encadré orange) et dans le badge rouge sur l'icône « Stock » en mode caisse."
    ]},
    {icon:"🛡️",title:"Fiscal NF525",desc:"Conformité fiscale, clôtures Z, exports FEC et archive.",steps:[
      "Cliquez sur « Fiscal NF525 » dans la barre latérale gauche (13ème élément, icône bouclier).",
      "En haut : l'attestation de conformité avec le numéro de certification (CERT-NF525-2026-001), l'organisme (INFOCERT/LNE), et les 4 conditions ISCA (Inaltérabilité, Sécurisation, Conservation, Archivage).",
      "3 compteurs récapitulatifs : Tickets (nombre total émis), Clôtures Z (nombre effectuées), GT (Grand Total cumulé en €).",
      "La chaîne SHA-256 : chaque vente est signée et chaînée à la précédente. Le dernier hash est affiché dans un encadré gris.",
      "2 boutons d'export :",
      "  • « Archive fiscale » (violet) → Télécharge un fichier JSON complet contenant toutes les données fiscales. À conserver en cas de contrôle.",
      "  • « Export FEC » (bleu) → Génère le Fichier des Écritures Comptables au format réglementaire (texte tabulé). Transmettez-le à votre comptable ou à l'administration fiscale.",
      "Bouton « Vérifier l'intégrité de la chaîne » : lance un contrôle complet de toutes les signatures. Résultat vert = conforme, rouge = anomalie détectée.",
      "En bas : le tableau « Déclaration TVA assistée » résume la TVA collectée par taux (20%, 10%, 5,5%, 2,1%) avec la base HT et le montant TVA. Utile pour préparer votre déclaration de TVA.",
      "⚠️ Toutes ces données sont inaltérables. Aucune modification n'est possible après signature. C'est la garantie NF525."
    ]},
    {icon:"📋",title:"Journal d'audit",desc:"Traçabilité complète de toutes les actions du système.",steps:[
      "Cliquez sur « Journal d'audit » dans la barre latérale gauche (14ème élément, icône activité).",
      "2 onglets en haut : « Audit » (actions métier) et « JET (NF525) » (Journal des Événements Techniques).",
      "ONGLET AUDIT : liste toutes les actions métier — ventes (VENTE), annulations (VOID_SALE, VOID_LINE), modifications de produits (PRODUCT), réceptions de stock (RECEPTION), modifications de prix (PRICE_CHANGE), clôtures (CLOTURE), exports (EXPORT, FEC), etc.",
      "ONGLET JET : événements techniques — connexions (LOGIN), déconnexions (LOGOUT), changements de paramètres, erreurs système, avoirs.",
      "Chaque entrée affiche : la date/heure, l'utilisateur, le type d'action (badge coloré), le détail et la référence.",
      "FILTRER : menu déroulant « Tous les utilisateurs » en haut à droite pour ne voir que les actions d'un utilisateur spécifique.",
      "Bouton « Export » en haut à droite : télécharge le journal en CSV pour archivage ou transmission.",
      "Navigation par pages en bas : 50 entrées par page. Cliquez sur les numéros pour naviguer.",
      "⚠️ Le journal d'audit est inaltérable (NF525). Aucune entrée ne peut être modifiée ou supprimée. Il constitue une preuve en cas de contrôle fiscal."
    ]},
    {icon:"🔄",title:"Basculer vers le mode Caisse",desc:"Passer du Dashboard au mode Caisse et inversement.",steps:[
      "Pour quitter le Dashboard et aller en mode Caisse : cliquez sur « Déconnexion » en bas de la barre latérale gauche (bouton rouge).",
      "Sur l'écran de connexion, sélectionnez votre profil et choisissez « Mode Caisse » ou « Mode Dashboard ».",
      "Le mode Caisse est destiné aux opérations quotidiennes (encaissements, retours, etc.).",
      "Le mode Dashboard est destiné à la gestion (produits, stats, paramètres, utilisateurs, fiscal).",
      "⚠️ Seuls les utilisateurs avec le rôle « Admin » peuvent accéder au mode Dashboard."
    ]}
  ];
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
      <div style={{width:44,height:44,borderRadius:14,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <HelpCircle size={22} color="#fff"/></div>
      <div><h2 style={{fontSize:22,fontWeight:800,margin:0}}>Aide Dashboard</h2>
        <p style={{fontSize:12,color:C.textMuted,margin:0}}>Guide complet — cliquez sur une section pour voir les instructions détaillées</p></div></div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {sections.map((s,idx)=>(<div key={s.title} style={{background:C.surface,borderRadius:16,border:`1.5px solid ${openIdx===idx?C.primary:C.border}`,boxShadow:`0 1px 4px ${C.shadow}`,overflow:"hidden",transition:"all 0.2s"}}>
        <button onClick={()=>setOpenIdx(openIdx===idx?null:idx)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <span style={{fontSize:26}}>{s.icon}</span>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:C.text}}>{s.title}</div>
            <div style={{fontSize:11,color:C.textMuted}}>{s.desc}</div></div>
          <ChevronDown size={18} color={C.textMuted} style={{transform:openIdx===idx?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}/></button>
        {openIdx===idx&&<div style={{padding:"0 18px 16px 18px",borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:12}}>
            {s.steps.map((step,i)=>(<div key={i} style={{display:"flex",alignItems:"start",gap:10,fontSize:12,color:C.text,lineHeight:1.5}}>
              {!step.startsWith("  •")&&!step.startsWith("⚠️")&&!step.startsWith("ℹ️")?<span style={{minWidth:22,height:22,borderRadius:11,background:`${C.primary}15`,color:C.primary,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</span>
              :<span style={{minWidth:22}}/>}
              <span style={{fontWeight:step.startsWith("⚠️")||step.startsWith("ℹ️")?600:step.startsWith("ONGLET")||step.startsWith("AJOUTER")||step.startsWith("MODIFIER")||step.startsWith("CRÉER")||step.startsWith("SUPPRIMER")||step.startsWith("DUPLIQUER")||step.startsWith("IMPRIMER")||step.startsWith("ACTIVER")||step.startsWith("HISTORIQUE")||step.startsWith("RGPD")||step.startsWith("FILTRER")||step.startsWith("RÉCEPTION")||step.startsWith("AJUSTER")||step.startsWith("UTILISER")?600:400,color:step.startsWith("⚠️")?C.warn:step.startsWith("ℹ️")?C.info:step.startsWith("  •")?C.textMuted:C.text}}>{step}</span></div>))}</div></div>}
      </div>))}</div></div>);
}



// Export all screen components
export { LoginScreen, CashRegControl, SalesScreen, StatsScreen, StockScreen, HistoryScreen, ReturnScreen, ClosureScreen, CustomersScreen, FiscalScreen, AuditScreen, CSVImportWizard, ProductsScreen, ReturnsHistoryScreen, SettingsScreen, GiftCardScreen, PromosScreen, FootfallScreen, HelpCashierScreen, HelpDashboardScreen };
