import React, { useState, useMemo, useEffect } from "react";
import { ShoppingCart, Search, Trash2, Percent, CreditCard, Banknote, Gift, Plus, Minus, Wallet, Package, RotateCcw, Users, FileText, CheckCircle2, AlertTriangle, WifiOff, Pause, Play, Printer, Star, Zap, ScanLine, Split, Mail, XOctagon, Edit } from "lucide-react";
import printer from "../printer.js";
import { CO, categories, C, CAT_COLORS } from "../constants.jsx";
import { catIcon, EAN13Svg, ean13SvgHtml } from "../utils.jsx";
import { Modal, Btn, Input, Badge, Numpad } from "../ui.jsx";
import { useApp } from "../context.jsx";
import hardwareManager from "../hardware.js";

function SalesScreen(){
  const{products,cart,addToCart,addCustomItem,removeFromCart,voidSale,updateQty,updateItemDisc,clearCart,checkout,
    gDisc,gDiscType,setCartGD,promoCode,setPromoCode,calcPromoDiscount,isOnline,findByEAN,offlineMode,
    parked,parkCart,restoreCart,removeParked,customers,addCustomer,selCust,setSelCust,perm,notify,
    stockAlerts,activePromos,avoirPayment,selectedAvoir,setSelectedAvoir,getLoyaltyTier,tickets,saleNote,setSaleNote,favorites,toggleFavorite,getLastPriceForCustomer,settings,
    printerConnected,thermalPrint,pendingSync,clearPendingSync,users,currentUser,currentStore,avoirs,consumeAvoir,isAvoirExpired,addAudit,addJET,trainingMode,cartTotals,retoucheBons,addRetoucheBon,cashReg,closures}=useApp();
  const[search,setSearch]=useState("");const[cat,setCat]=useState("Tous");const[vm,setVm]=useState(null);const[selSeller,setSelSeller]=useState(null);
  const[dm,setDm]=useState(null);const[dv,setDv]=useState("");const[gm,setGm]=useState(false);const[gv,setGv]=useState("");const[gtp,setGtp]=useState("percentage");
  const[lastTk,setLastTk]=useState(null);const[tkModal,setTkModal]=useState(false);const[busy,setBusy]=useState(false);
  const[payModal,setPayModal]=useState(false);const[cashGiven,setCashGiven]=useState("");
  const[cashNumpadModal,setCashNumpadModal]=useState(false);const[numpadValue,setNumpadValue]=useState("");
  const[custModal,setCustModal]=useState(false);const[parkedModal,setParkedModal]=useState(false);
  const[payMethodModal,setPayMethodModal]=useState(false);const[avoirSelectModal,setAvoirSelectModal]=useState(false);
  const[retoucheModal,setRetoucheModal]=useState(false);const[retForm,setRetForm]=useState({client:"",phone:"",date:new Date().toISOString().split("T")[0],notes:"",items:[{desc:"",price:""}]});
  const[newCustModal,setNewCustModal]=useState(false);const[ncF,setNcF]=useState("");const[ncL,setNcL]=useState("");const[ncE,setNcE]=useState("");const[ncP,setNcP]=useState("");
  const[syncConfirm,setSyncConfirm]=useState(false);const[avoirSearch,setAvoirSearch]=useState("");
  const[clock,setClock]=useState(new Date());useEffect(()=>{const t=setInterval(()=>setClock(new Date()),30000);return()=>clearInterval(t);},[]);
  const[codeInput,setCodeInput]=useState("");
  const[confirmVoid,setConfirmVoid]=useState(false);const[voidReason,setVoidReason]=useState("");
  const[showShortcuts,setShowShortcuts]=useState(false);const[confirmClear,setConfirmClear]=useState(false);
  // Garde post-clôture: vérifier si une clôture journalière existe pour aujourd'hui
  const todayClosed=useMemo(()=>{const today=new Date().toISOString().split("T")[0];return closures?.some(c=>(c.type||c.closure_type)==="daily"&&(c.date||c.createdAt||c.created_at||"").startsWith(today));},[closures]);

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

  // Barcode scanning is handled centrally by hardwareManager.scanner in context.jsx
  // (removed duplicate keydown listener that caused double-scan issue)

  const filtered=useMemo(()=>products.filter(p=>{const q=search.toLowerCase();
    const matchSearch=!q||p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)||p.variants.some(v=>v.ean.includes(q)||v.color.toLowerCase().includes(q));
    const matchCat=cat==="Tous"||cat==="Favoris"?true:p.category===cat;
    const matchFav=cat==="Favoris"?favorites.includes(p.id):true;
    return matchSearch&&matchCat&&matchFav;}),[products,search,cat,favorites]);

  // FE-05: use single source of truth from context (cartTotals) — no local recalculation
  // FE-03: when avoirPayment > 0, proportionally reduce displayed HT and TVA so HT+TVA === TTC
  // FE-11: all intermediate values are pre-rounded in cartTotals
  const totals=useMemo(()=>{
    const{sHT,gd,promoDisc,applied,tHT,tTVA,tTTC}=cartTotals;
    if(avoirPayment>0&&(tHT+tTVA)>0){
      const grossTTC=Math.round((tHT+tTVA)*100)/100;
      const ratio=grossTTC>0?(tTTC/grossTTC):1;
      return{sHT,gd,promoDisc,applied,tHT:Math.round(tHT*ratio*100)/100,tTVA:Math.round(tTVA*ratio*100)/100,tTTC};
    }
    return cartTotals;
  },[cartTotals,avoirPayment]);

  const[payCard,setPayCard]=useState("");const[payCash,setPayCash]=useState("");const[payGC,setPayGC]=useState("");const[payChq,setPayChq]=useState("");const[payAmex,setPayAmex]=useState("");const[cardType,setCardType]=useState("card");
  const openPay=()=>{setPayCard("");setPayCash("");setPayGC("");setPayChq("");setPayAmex("");setCashGiven("");setCardType("card");setPayModal(true);};
  const doSplitPay=async()=>{const payments=[];
    const c=parseFloat(payCard)||0;const ca=parseFloat(payCash)||0;const g=parseFloat(payGC)||0;const chq=parseFloat(payChq)||0;
    if(c>0)payments.push({method:cardType,amount:c});if(ca>0)payments.push({method:"cash",amount:ca});
    if(g>0)payments.push({method:"giftcard",amount:g});if(chq>0)payments.push({method:"cheque",amount:chq});if(avoirPayment>0)payments.push({method:"avoir",amount:avoirPayment});
    if(!payments.length)return;setBusy(true);try{const t=await checkout(payments,selSeller);if(t){setLastTk({...t});setPayModal(false);setTkModal(true);setSelSeller(null);}}finally{setBusy(false);setCashGiven("");}};
  const quickPay=async(method)=>{if(!cart.length||busy)return;setBusy(true);
    const payments=[{method,amount:totals.tTTC}];if(avoirPayment>0)payments.push({method:"avoir",amount:avoirPayment});
    try{const t=await checkout(payments,selSeller);if(t){setLastTk({...t});setTkModal(true);setSelSeller(null);}}finally{setBusy(false);setCashGiven("");}};
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

    {/* NF525: Training mode banner */}
    {trainingMode&&<div style={{position:"absolute",top:offlineMode||!isOnline?40:0,left:72,right:0,zIndex:99,
      background:"#FEF3C7",padding:"6px 18px",display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,color:"#92400E",
      borderBottom:"2px dashed #D97706",animation:"slideDown 0.3s ease"}}>
      <AlertTriangle size={13}/> MODE FORMATION — Les tickets sont marqués FACTICE</div>}

    {/* NF525: Post-closure warning */}
    {todayClosed&&!trainingMode&&<div style={{position:"absolute",top:offlineMode||!isOnline?40:trainingMode?68:0,left:72,right:0,zIndex:98,
      background:"#FEE2E2",padding:"6px 18px",display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,color:"#991B1B",
      borderBottom:"2px solid #DC2626"}}>
      <AlertTriangle size={13}/> CAISSE CLOTUREE — Les nouvelles ventes seront refusées par le serveur</div>}

    {/* Products */}
    <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Daily summary bar */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,padding:"10px 16px",
        background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,
        boxShadow:`0 1px 3px ${C.shadow}`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:6,height:6,borderRadius:3,background:C.primary}}/>
          <span style={{fontSize:12,fontWeight:600,color:C.text}}>{new Date().toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</span>
          <span style={{fontSize:11,fontWeight:700,color:C.primary,fontVariantNumeric:"tabular-nums"}}>{clock.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span></div>
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
        <Btn variant="outline" onClick={()=>setParkedModal(true)} style={{height:42,padding:"0 14px",position:"relative",borderRadius:14}} title="Paniers en attente">
          <Pause size={15}/>{parked.length>0&&<span style={{position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:9,
            background:C.danger,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 2px 6px rgba(209,69,59,0.4)"}}>{parked.length}</span>}</Btn>
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
            <div style={{fontSize:12,color:C.text,fontWeight:800}}>{cart.reduce((s,i)=>s+i.quantity,0)} pièce{cart.reduce((s,i)=>s+i.quantity,0)>1?"s":""}</div></div>
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
          {selectedAvoir&&avoirPayment>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{color:C.fiscal,display:"flex",alignItems:"center",gap:4}}>
            <RotateCcw size={10}/> Avoir {selectedAvoir.avoirNumber}</span>
            <span style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontWeight:700,color:C.fiscal}}>-{avoirPayment.toFixed(2)}€</span>
              <button onClick={()=>setSelectedAvoir(null)} style={{background:"none",border:"none",cursor:"pointer",padding:2,color:C.danger,fontSize:10,fontWeight:700}} title="Annuler l'avoir">X</button>
            </span></div>}
          <div style={{borderTop:`2px solid ${C.border}`,paddingTop:8,marginTop:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:16,fontWeight:800}}>Total TTC</span>
            <span style={{fontSize:24,fontWeight:900,color:C.primary,letterSpacing:"-0.8px"}}>{totals.tTTC.toFixed(2)}€</span></div></div>

        {cashGiven&&parseFloat(cashGiven)>0&&<div style={{background:C.primaryLight,borderRadius:12,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",
          border:`1px solid ${C.primary}15`,boxShadow:`0 2px 8px ${C.primary}10`}}>
          <span style={{fontSize:13,fontWeight:700,color:C.primaryDark}}>Rendu monnaie</span>
          <span style={{fontSize:22,fontWeight:900,color:C.primary,letterSpacing:"-0.5px"}}>{change.toFixed(2)}€</span></div>}

        <div style={{display:"flex",gap:4,marginBottom:6}}>
          <Btn variant="outline" onClick={()=>{setGm(true);setGv(String(gDisc));setGtp(gDiscType);}} style={{flex:1,height:32,fontSize:10,padding:"0 6px",borderRadius:10}}><Percent size={11}/> Remise globale</Btn>
          </div>

        {selectedAvoir&&totals.tTTC<=0?
          <Btn onClick={async()=>await quickPay("avoir")} disabled={!cart.length||busy} style={{width:"100%",height:52,borderRadius:14,background:C.fiscal,fontSize:14,gap:8,boxShadow:`0 4px 16px ${C.fiscal}30`,marginBottom:6,letterSpacing:"-0.3px"}}>
            {busy?<span className="spin-loader"/>:<><CheckCircle2 size={18}/> Valider (avoir) — 0.00€</>}</Btn>
        :<Btn onClick={()=>setPayMethodModal(true)} disabled={!cart.length||busy} style={{width:"100%",height:52,borderRadius:14,background:C.primary,fontSize:14,gap:8,boxShadow:`0 4px 16px ${C.primary}30`,marginBottom:6,letterSpacing:"-0.3px"}}>
          {busy?<span className="spin-loader"/>:<><Wallet size={18}/> Règlement — {totals.tTTC.toFixed(2)}€</>}</Btn>}
        <div style={{display:"flex",gap:4}}>
          <Btn variant="outline" onClick={()=>setRetoucheModal(true)} style={{flex:1,height:30,fontSize:10,borderRadius:10,gap:4}}><Edit size={11}/> Retouche</Btn>
          <Btn variant="outline" onClick={()=>cart.length?setConfirmClear(true):null} style={{flex:1,borderColor:`${C.danger}20`,color:C.danger,height:30,fontSize:10,borderRadius:10}}><RotateCcw size={10}/> Vider</Btn>
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
          {vm.variants.map(v=>{const cc=CAT_COLORS[vm.category]||C.primary;return(
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

    <Modal open={confirmClear} onClose={()=>setConfirmClear(false)} title="Vider le panier">
      <div style={{textAlign:"center",padding:"10px 0"}}>
        <div style={{fontSize:13,color:C.text,marginBottom:14}}>Voulez-vous vraiment vider le panier ? ({cart.length} article{cart.length>1?"s":""})</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Btn variant="outline" onClick={()=>setConfirmClear(false)}>Annuler</Btn>
          <Btn variant="danger" onClick={()=>{clearCart();setConfirmClear(false);}}>Vider le panier</Btn></div>
      </div></Modal>

    <Modal open={payModal} onClose={()=>setPayModal(false)} title="Paiement fractionné" sub={`Total: ${totals.tTTC.toFixed(2)}€`}>
      {(()=>{const paid=(parseFloat(payCard)||0)+(parseFloat(payCash)||0)+(parseFloat(payGC)||0)+(parseFloat(payChq)||0)+(avoirPayment||0);
        const remaining=Math.max(0,totals.tTTC-paid);
        const overpaid=paid>totals.tTTC+0.01;
        // FE-04: helper to cap a payment field so total does not exceed tTTC
        const capPay=(val,setter,otherTotal)=>{const v=parseFloat(val)||0;const max=Math.max(0,Math.round((totals.tTTC-otherTotal)*100)/100);if(v>max){setter(String(max.toFixed(2)));}else{setter(val);}};
        const othersExceptCard=(parseFloat(payCash)||0)+(parseFloat(payGC)||0)+(parseFloat(payChq)||0)+(avoirPayment||0);
        const othersExceptCash=(parseFloat(payCard)||0)+(parseFloat(payGC)||0)+(parseFloat(payChq)||0)+(avoirPayment||0);
        const othersExceptGC=(parseFloat(payCard)||0)+(parseFloat(payCash)||0)+(parseFloat(payChq)||0)+(avoirPayment||0);
        const othersExceptChq=(parseFloat(payCard)||0)+(parseFloat(payCash)||0)+(parseFloat(payGC)||0)+(avoirPayment||0);
        return(<>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
          <CreditCard size={11} color={cardType==="amex"?"#006FCF":C.info}/>
          <span style={{display:"inline-flex",gap:2}}>
            <button onClick={()=>setCardType("card")} style={{padding:"1px 6px",borderRadius:4,border:`1px solid ${cardType==="card"?C.info:C.border}`,background:cardType==="card"?C.info:"transparent",color:cardType==="card"?"#fff":C.textMuted,fontSize:9,fontWeight:700,cursor:"pointer"}}>CB</button>
            <button onClick={()=>setCardType("amex")} style={{padding:"1px 6px",borderRadius:4,border:`1px solid ${cardType==="amex"?"#006FCF":C.border}`,background:cardType==="amex"?"#006FCF":"transparent",color:cardType==="amex"?"#fff":C.textMuted,fontSize:9,fontWeight:700,cursor:"pointer"}}>AMEX</button></span>
          <button onClick={()=>setPayCard(String(remaining.toFixed(2)))} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:9,color:C.primary,fontWeight:600}}>= Reste</button></label>
          <Input type="number" step="0.01" value={payCard} onChange={e=>capPay(e.target.value,setPayCard,othersExceptCard)} placeholder="0.00"/></div>
        {[{l:"ESPÈCES",v:payCash,s:setPayCash,i:Banknote,c:C.primary,oth:othersExceptCash},{l:"CARTE CADEAU",v:payGC,s:setPayGC,i:Gift,c:C.accent,oth:othersExceptGC},{l:"CHÈQUE",v:payChq||"",s:v=>setPayChq(v),i:FileText,c:"#7B8794",oth:othersExceptChq}].map(x=>(
          <div key={x.l}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"flex",alignItems:"center",gap:4,marginBottom:3}}><x.i size={11} color={x.c}/>{x.l}
            <button onClick={()=>x.s(String(remaining.toFixed(2)))} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:9,color:C.primary,fontWeight:600}}>= Reste</button></label>
            <Input type="number" step="0.01" value={x.v} onChange={e=>capPay(e.target.value,x.s,x.oth)} placeholder="0.00"/></div>))}
        {selectedAvoir&&avoirPayment>0&&<div><label style={{fontSize:10,fontWeight:600,color:C.fiscal,display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
          <RotateCcw size={11} color={C.fiscal}/> AVOIR {selectedAvoir.avoirNumber}</label>
          <Input type="number" step="0.01" value={avoirPayment} readOnly style={{background:C.surfaceAlt,opacity:0.7}} placeholder="0.00"/></div>}
      </div>
      {overpaid&&<div style={{padding:"6px 12px",borderRadius:8,background:C.dangerLight||"#fee",marginBottom:8,textAlign:"center"}}>
        <span style={{fontSize:11,fontWeight:600,color:C.danger}}>Le total des paiements depasse le montant du</span></div>}
      <div style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,background:remaining>0.01?C.warnLight:C.primaryLight,marginBottom:10}}>
        <span style={{fontSize:11,fontWeight:600,color:remaining>0.01?C.warn:C.primary}}>Reste à payer</span>
        <span style={{fontSize:13,fontWeight:800,color:remaining>0.01?C.warn:C.primary}}>{remaining.toFixed(2)}€</span></div>
      <Btn onClick={doSplitPay} disabled={busy||remaining>0.01||overpaid} style={{width:"100%",height:44,background:C.fiscal}}><Split size={16}/> Valider</Btn>
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

    {/* Parked */}
    <Modal open={parkedModal} onClose={()=>setParkedModal(false)} title="Paniers en attente">
      {!parked.length?<div style={{textAlign:"center",padding:24,color:C.textLight,fontSize:12}}>Aucun panier en attente</div>
      :parked.map(p=>(<div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,border:`1.5px solid ${C.border}`,marginBottom:6}}>
        <Pause size={14} color={C.textMuted}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{p.items.length} art.{p.customer?` — ${p.customer.firstName}`:""}</div>
          <div style={{fontSize:10,color:C.textMuted}}>{new Date(p.date).toLocaleTimeString("fr-FR")}</div></div>
        <Btn onClick={()=>{restoreCart(p.id);setParkedModal(false);}} style={{padding:"4px 10px",fontSize:11}}><Play size={12}/> Reprendre</Btn>
        <Btn variant="ghost" onClick={()=>{removeParked(p.id);notify("Panier supprime","info");}} style={{padding:"4px 8px",color:C.danger}}><Trash2 size={12}/></Btn></div>))}</Modal>

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
          {currentStore?.name&&<div style={{fontSize:11,fontWeight:600}}>Magasin: {currentStore.name}</div>}
          <div>{currentStore?.address||settings.address}, {currentStore?.postal_code||settings.postalCode} {currentStore?.city||settings.city}</div>
          <div>SIRET: {settings.siret} — TVA: {settings.tvaIntra}</div></div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>N° {lastTk.ticketNumber}</span><span>{new Date(lastTk.date||lastTk.createdAt||"").toLocaleString("fr-FR")}</span></div>
        <div>Caissier: {lastTk.userName}{lastTk.customerName?` — Client: ${lastTk.customerName}`:""}</div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        {(lastTk.items||[]).map((i,k)=>{const sku=i.product?.sku||i.product_sku||"";const ean=i.variant?.ean||i.variant_ean||"";return(<div key={k}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}><span style={{flex:1,wordBreak:"break-word",lineHeight:1.3}}>{i.product?.name||i.product_name}{i.isCustom||i.is_custom?"":`(${i.variant?.color||i.variant_color}/${i.variant?.size||i.variant_size})`} x{i.quantity}{i.discount>0?` -${i.discount}${i.discountType==="amount"?"€":"%"}`:""}</span><span style={{whiteSpace:"nowrap",fontWeight:600}}>{(i.lineTTC||i.line_ttc||((i.unit_price||0)*(i.quantity||1))||0).toFixed(2)}€</span></div>
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
        <div style={{textAlign:"center",fontSize:8,color:C.textMuted}}>
          {CO.sw} v{CO.ver} — Conforme NF525<br/>{settings.footerMsg||CO.footerMsg}</div>
        {lastTk.saleNote&&<div style={{textAlign:"center",fontSize:9,color:C.text,marginTop:3,fontStyle:"italic"}}>Note: {lastTk.saleNote}</div>}
        {lastTk.customerName&&<div style={{textAlign:"center",fontSize:9,color:C.accent,marginTop:3}}>Fidélité: +{Math.floor(lastTk.totalTTC||0)}pts</div>}
        {lastTk.barcode&&<div style={{marginTop:6,display:"flex",justifyContent:"center"}}><EAN13Svg code={lastTk.barcode} width={160} height={45}/></div>}
      </div>
      {/* Avoir remaining balance after sale */}
      {lastTk.avoirUsed&&lastTk.avoirUsed.remainingAfter>0&&(
        <div style={{background:C.fiscalLight||"#FFF7ED",border:`2px solid ${C.fiscal}`,borderRadius:12,padding:14,marginTop:12,textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:600,color:C.fiscal,marginBottom:4}}>Solde restant sur avoir {lastTk.avoirUsed.avoirNumber}</div>
          <div style={{fontSize:22,fontWeight:900,color:C.fiscal,letterSpacing:"-0.5px"}}>{lastTk.avoirUsed.remainingAfter.toFixed(2)}EUR</div>
          <Btn onClick={()=>{
            const av=lastTk.avoirUsed;
            const w=window.open("","_blank","width=400,height=400");if(!w)return;
            w.document.write(`<!DOCTYPE html><html><head><title>Avoir — Solde restant</title>
              <style>body{font-family:'Courier New',monospace;font-size:12px;padding:20px;max-width:300px;margin:0 auto;text-align:center;}
              h2{font-size:14px;margin:4px 0;}hr{border:none;border-top:1px dashed #333;margin:8px 0;}
              .big{font-size:28px;font-weight:900;margin:12px 0;}.no-print{margin-top:16px;}</style></head><body>
              <h2>${settings.name||"CaissePro"}</h2>
              <div>${settings.address||""}, ${settings.postalCode||""} ${settings.city||""}</div><hr>
              <h2>AVOIR — SOLDE RESTANT</h2>
              <div>N° ${av.avoirNumber}</div>
              <div class="big">${av.remainingAfter.toFixed(2)} EUR</div>
              <div>Montant utilise: ${av.amount.toFixed(2)} EUR</div>
              <div>Ticket: ${lastTk.ticketNumber}</div>
              <div>${new Date().toLocaleString("fr-FR")}</div><hr>
              <div style="font-size:10px;">Presentez ce bon lors de votre prochain achat.</div>
              ${av.barcode?ean13SvgHtml(av.barcode,160,45):""}
              <div class="no-print"><button onclick="window.print()" style="padding:8px 20px;background:#047857;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">Imprimer</button></div>
              </body></html>`);w.document.close();
          }} variant="outline" style={{marginTop:8,borderColor:C.fiscal,color:C.fiscal,borderRadius:10,fontSize:12}}>
            <Printer size={14}/> Imprimer le solde restant</Btn>
        </div>
      )}
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn variant="outline" onClick={()=>emailTicket(lastTk)} style={{flex:1,borderRadius:12}}><Mail size={14}/> Email</Btn>
        <Btn variant="outline" onClick={()=>thermalPrint("receipt",lastTk)} style={{flex:1,borderRadius:12}}><Printer size={14}/> {printerConnected?"Ticket":"Imprimer"}</Btn>
        <Btn variant="outline" onClick={async()=>{
          const giftTk={...lastTk,_giftCard:true,_returnDays:settings.returnPolicy?.days||30};
          const printed=await thermalPrint("receipt",giftTk);
          if(!printed){const w=window.open("","_blank","width=400,height=600");if(!w)return;
            w.document.write(`<html><head><title>Ticket cadeau</title><style>body{font-family:'Courier New',monospace;font-size:12px;padding:10px;max-width:300px;margin:0 auto;}h2{text-align:center;font-size:14px;margin:4px 0;}hr{border:none;border-top:1px dashed #333;margin:6px 0;}.center{text-align:center;}</style></head><body>`+
            `<h2>${settings.name||CO.name}</h2><div class="center">${settings.address||""}, ${settings.postalCode||""} ${settings.city||""}</div><hr>`+
            `<h2>TICKET CADEAU</h2><div class="center">N° ${lastTk.ticketNumber}</div><div class="center">${new Date(lastTk.date||lastTk.createdAt||"").toLocaleString("fr-FR")}</div><hr>`+
            (lastTk.items||[]).map(i=>`<div>${i.product?.name||i.product_name}${i.isCustom||i.is_custom?"":" ("+((i.variant?.color||i.variant_color)||"")+"/"+((i.variant?.size||i.variant_size)||"")+")"} x${i.quantity}</div>`).join("")+
            `<hr><div class="center" style="font-size:10px;">${settings.footerMsg||CO.footerMsg||""}</div>`+
            `<div class="center" style="font-size:10px;margin-top:4px;">Échange possible sous ${settings.returnPolicy?.days||30} jours sur présentation de ce ticket</div>`+
            (lastTk.barcode?ean13SvgHtml(lastTk.barcode,160,45):"")+
            `</body></html>`);w.document.close();setTimeout(()=>w.print(),300);}
        }} style={{flex:1,borderRadius:12}}><Gift size={14}/> Cadeau</Btn>
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
        <button onClick={async()=>{setPayMethodModal(false);await quickPay("card");}} style={{padding:16,borderRadius:14,border:`2px solid ${C.info}25`,background:`${C.info}06`,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.info} onMouseLeave={e=>e.currentTarget.style.borderColor=`${C.info}25`}>
          <CreditCard size={24} color={C.info} style={{marginBottom:6}}/><div style={{fontSize:13,fontWeight:700,color:C.text}}>Carte bancaire</div><div style={{fontSize:10,color:C.textMuted}}>CB / Visa / Mastercard</div></button>
        <button onClick={async()=>{setPayMethodModal(false);setCardType("amex");await quickPay("amex");}} style={{padding:16,borderRadius:14,border:`2px solid #006FCF25`,background:"#006FCF06",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#006FCF"} onMouseLeave={e=>e.currentTarget.style.borderColor="#006FCF25"}>
          <CreditCard size={24} color="#006FCF" style={{marginBottom:6}}/><div style={{fontSize:13,fontWeight:700,color:C.text}}>American Express</div><div style={{fontSize:10,color:C.textMuted}}>AMEX</div></button>
        <button onClick={()=>{setPayMethodModal(false);setNumpadValue("");setCashNumpadModal(true);}} style={{padding:16,borderRadius:14,border:`2px solid ${C.primary}25`,background:`${C.primary}06`,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary} onMouseLeave={e=>e.currentTarget.style.borderColor=`${C.primary}25`}>
          <Banknote size={24} color={C.primary} style={{marginBottom:6}}/><div style={{fontSize:13,fontWeight:700,color:C.text}}>Espèces</div><div style={{fontSize:10,color:C.textMuted}}>Avec rendu monnaie</div></button>
        <button onClick={async()=>{setPayMethodModal(false);await quickPay("cheque");}} style={{padding:16,borderRadius:14,border:`2px solid #7B879425`,background:"#7B879406",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#7B8794"} onMouseLeave={e=>e.currentTarget.style.borderColor="#7B879425"}>
          <FileText size={24} color="#7B8794" style={{marginBottom:6}}/><div style={{fontSize:13,fontWeight:700,color:C.text}}>Chèque</div><div style={{fontSize:10,color:C.textMuted}}>Paiement par chèque</div></button>
        <button onClick={()=>{setPayMethodModal(false);setPayGC(String(totals.tTTC.toFixed(2)));openPay();}} style={{padding:16,borderRadius:14,border:`2px solid ${C.accent}25`,background:`${C.accent}06`,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=`${C.accent}25`}>
          <Gift size={24} color={C.accent} style={{marginBottom:6}}/><div style={{fontSize:13,fontWeight:700,color:C.text}}>Carte cadeau</div><div style={{fontSize:10,color:C.textMuted}}>Saisir le montant manuellement</div></button>
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
    <Modal open={avoirSelectModal} onClose={()=>{setAvoirSelectModal(false);setAvoirSearch("");}} title="Paiement par avoir" sub={`Total: ${totals.tTTC.toFixed(2)}EUR`}>
      {(()=>{const available=avoirs.filter(a=>!a.used&&(a.remaining??a.totalTTC)>0&&!(isAvoirExpired?.(a)));
        const shown=avoirSearch?available.filter(a=>(a.avoirNumber||"").toLowerCase().includes(avoirSearch.toLowerCase())||
          (a.customerName||"").toLowerCase().includes(avoirSearch.toLowerCase())||(a.originalTicket||"").toLowerCase().includes(avoirSearch.toLowerCase())||(a.barcode||"").includes(avoirSearch)):available;
        return<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {available.length>0&&<div style={{position:"relative"}}><Search size={13} style={{position:"absolute",left:10,top:11,color:C.textMuted}}/>
            <Input value={avoirSearch} onChange={e=>setAvoirSearch(e.target.value)} placeholder="Rechercher par numero, client, ticket..." style={{paddingLeft:30,marginBottom:4}}/></div>}
          <div style={{fontSize:11,color:C.textMuted}}>{shown.length} avoir(s) disponible(s){available.length!==shown.length?` sur ${available.length}`:""}</div>
          {shown.length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight}}>
            <RotateCcw size={28} color={C.border} style={{marginBottom:8}}/>
            <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Aucun avoir{avoirSearch?" pour cette recherche":" disponible"}</div>
            <div style={{fontSize:11}}>Les avoirs sont generes lors des retours en caisse.</div></div>}
          {shown.map(a=>{const rem=a.remaining??a.totalTTC??0;const rawTotal=totals.tTTC+avoirPayment;const canApply=Math.min(rem,rawTotal);
            const expiryDate=new Date(new Date(a.date).setMonth(new Date(a.date).getMonth()+(settings.returnPolicy?.avoirExpiryMonths||12)));
            return(<div key={a.avoirNumber} style={{padding:14,borderRadius:14,border:`2px solid ${C.fiscal}25`,background:C.surfaceAlt,display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,fontFamily:"monospace"}}>{a.avoirNumber}</div>
                <div style={{fontSize:10,color:C.textMuted}}>Ticket: {a.originalTicket} -- {new Date(a.date).toLocaleDateString("fr-FR")}</div>
                {a.customerName&&<div style={{fontSize:10,color:C.accent}}>Client: {a.customerName}</div>}
                <div style={{fontSize:10,color:C.textLight}}>Expire: {expiryDate.toLocaleDateString("fr-FR")}</div>
                <div style={{fontSize:12,fontWeight:700,color:C.fiscal,marginTop:4}}>Solde: {rem.toFixed(2)}EUR</div></div>
              <Btn onClick={()=>{
                setSelectedAvoir({avoirNumber:a.avoirNumber,totalTTC:a.totalTTC||0,remaining:rem,applied:canApply});
                setAvoirSelectModal(false);setAvoirSearch("");
                notify(`Avoir ${a.avoirNumber}: ${canApply.toFixed(2)}EUR applique${canApply<rem?`. Solde restant: ${(rem-canApply).toFixed(2)}EUR`:""}${canApply>=totals.tTTC+avoirPayment?". Cliquez sur Valider pour finaliser.":`. Reste a payer: ${(totals.tTTC+avoirPayment-canApply).toFixed(2)}EUR`}`,"info");
                }}
                style={{background:C.fiscal,padding:"10px 16px",fontSize:12}}>
                Appliquer {canApply.toFixed(2)}EUR</Btn>
            </div>);})}
        </div>;})()}
    </Modal>

    {/* RETOUCHE MODAL */}
    <Modal open={retoucheModal} onClose={()=>setRetoucheModal(false)} title="Bon de retouche" wide>
      {/* Quick-pick retouche options */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:10,fontWeight:700,color:C.textMuted,display:"block",marginBottom:6}}>RETOUCHES COURANTES — cliquez pour ajouter</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}]).filter(sv=>sv.n).map(sv=>(
            <button key={sv.n} onClick={()=>setRetForm(f=>{const existing=f.items.filter(i=>(i.desc&&i.desc!==sv.n)||i.price);return{...f,items:[...existing,{desc:sv.n,price:String(sv.p)}]};})}
              style={{padding:"10px 6px",borderRadius:10,border:`1.5px solid ${C.border}`,background:C.surfaceAlt,cursor:"pointer",fontSize:10,fontWeight:600,textAlign:"center",transition:"all 0.12s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.background=C.primaryLight;e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.surfaceAlt;e.currentTarget.style.transform="translateY(0)";}}>
              {sv.n}<br/><span style={{color:C.primary,fontWeight:800,fontSize:12}}>{sv.p}€</span></button>))}</div>
      </div>
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
            <option value="">-- Sélectionner --</option>{customers.map(c=>(<option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>))}</select></div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>TRAVAUX DE RETOUCHE (champ libre)</label>
        {retForm.items.map((item,idx)=>(<div key={idx} style={{display:"flex",gap:6,marginBottom:6}}>
          <Input value={item.desc} onChange={e=>{const items=[...retForm.items];items[idx].desc=e.target.value;setRetForm(f=>({...f,items}));}} placeholder="Description (ex: Ourlet pantalon)" style={{flex:2}}/>
          <Input type="number" step="0.01" value={item.price} onChange={e=>{const items=[...retForm.items];items[idx].price=e.target.value;setRetForm(f=>({...f,items}));}} placeholder="Prix €" style={{flex:1}}/>
          {retForm.items.length>1&&<Btn variant="ghost" onClick={()=>{const items=retForm.items.filter((_,i)=>i!==idx);setRetForm(f=>({...f,items}));}} style={{padding:"4px 8px",color:C.danger}}><Trash2 size={12}/></Btn>}
        </div>))}
        <Btn variant="outline" onClick={()=>setRetForm(f=>({...f,items:[...f.items,{desc:"",price:""}]}))} style={{fontSize:10,padding:"4px 12px"}}><Plus size={11}/> Ajouter une ligne</Btn>
      </div>
      <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>NOTES</label>
        <textarea value={retForm.notes} onChange={e=>setRetForm(f=>({...f,notes:e.target.value}))} placeholder="Instructions particulières, couleur fil, remarques..."
          style={{width:"100%",minHeight:60,padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit",resize:"vertical"}}/></div>
      {(()=>{const retTotal=retForm.items.reduce((s,i)=>s+(parseFloat(i.price)||0),0);return retTotal>0&&
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,background:C.primaryLight,marginBottom:12}}>
          <span style={{fontSize:13,fontWeight:700}}>Total retouche</span>
          <span style={{fontSize:18,fontWeight:900,color:C.primary}}>{retTotal.toFixed(2)}€</span></div>;})()}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Btn variant="outline" onClick={()=>{
          const retTotal=retForm.items.reduce((s,i)=>s+(parseFloat(i.price)||0),0);
          const tva=(settings.retoucheTVA||20)/100;
          const pm=settings.pricingMode||"TTC";
          retForm.items.filter(i=>i.desc&&i.price).forEach(i=>{const p=parseFloat(i.price);addCustomItem(`Retouche: ${i.desc}`,pm==="TTC"?p:p/(1+tva),tva);});
          setRetoucheModal(false);notify(`Retouche ajoutée au panier (${retTotal.toFixed(2)}€)`);
        }} disabled={!retForm.items.some(i=>i.desc&&i.price)}>
          <ShoppingCart size={14}/> Ajouter au panier</Btn>
        <Btn onClick={async()=>{
          const retTotal=retForm.items.reduce((s,i)=>s+(parseFloat(i.price)||0),0);
          const bonDraft={client:retForm.client,phone:retForm.phone,dateRetrait:retForm.date,items:retForm.items.filter(i=>i.desc),notes:retForm.notes,total:retTotal,date:new Date().toISOString(),seller:selSeller||currentUser?.name};
          // 1. Create in backend first to get real number + shortCode
          const saved=await addRetoucheBon(bonDraft);
          const bonNum=saved.num||`RET-${Date.now().toString(36).toUpperCase()}`;
          const sc=saved.shortCode||(bonNum.slice(-4));
          const bon={...saved,...bonDraft,num:bonNum,shortCode:sc};
          // 2. Add items to cart
          const tva2=(settings.retoucheTVA||20)/100;
          const pm2=settings.pricingMode||"TTC";
          retForm.items.filter(i=>i.desc&&i.price).forEach(i=>{const p=parseFloat(i.price);addCustomItem(`Retouche: ${i.desc}`,pm2==="TTC"?p:p/(1+tva2),tva2);});
          // 3. Print with real number + shortCode bien visible
          const printed=await thermalPrint("retouche",bon);
          if(!printed){
            const w=window.open("","_blank","width=400,height=600");if(w){w.document.write(`<html><head><title>Bon de retouche ${bonNum}</title><style>body{font-family:'Courier New',monospace;font-size:12px;padding:10px;max-width:300px;margin:0 auto;}h2{text-align:center;font-size:14px;margin:4px 0;}hr{border:none;border-top:1px dashed #333;margin:6px 0;}.row{display:flex;justify-content:space-between;}.center{text-align:center;}.short-code{text-align:center;font-size:32px;font-weight:900;letter-spacing:6px;margin:8px 0;padding:8px;border:3px solid #000;}</style></head><body>`+
              `<h2>${settings.name||"CaissePro"}</h2><div class="center">${settings.address||""} ${settings.postalCode||""} ${settings.city||""}</div><hr>`+
              `<h2>BON DE RETOUCHE</h2><div class="short-code">${sc}</div><div class="center" style="font-size:10px;margin-bottom:6px;">Ref: ${bonNum}</div><hr>`+
              `<div class="row"><span>Client:</span><strong>${bon.client||"—"}</strong></div>`+
              `<div class="row"><span>Tel:</span><span>${bon.phone||"—"}</span></div>`+
              `<div class="row"><span>Date retrait:</span><span>${new Date(bon.dateRetrait).toLocaleDateString("fr-FR")}</span></div><hr>`+
              bon.items.filter(i=>i.desc).map(i=>`<div class="row"><span>${i.desc}</span><strong>${parseFloat(i.price||0).toFixed(2)}EUR</strong></div>`).join("")+
              `<hr><div class="row"><strong>TOTAL</strong><strong>${retTotal.toFixed(2)}EUR TTC</strong></div><hr>`+
              (bon.notes?`<div><strong>Notes:</strong> ${bon.notes}</div><hr>`:"")+
              `<div class="center" style="font-size:10px;">Vendeur: ${bon.seller}<br>${new Date().toLocaleString("fr-FR")}<br>${settings.name||"CaissePro"} — ${settings.siret||""}</div>`+
              `</body></html>`);w.document.close();setTimeout(()=>{w.print();},300);}}
          setRetoucheModal(false);setRetForm({client:"",phone:"",date:new Date().toISOString().split("T")[0],notes:"",items:[{desc:"",price:""}]});
          notify(`Bon de retouche #${sc} (${bonNum}) cree et ajoute au panier`);
          addAudit("RETOUCHE",`Bon ${bonNum} #${sc} — ${bon.client} — ${retTotal.toFixed(2)}EUR`);
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

export default SalesScreen;
export { SalesScreen };
