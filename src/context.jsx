import React, { useState, useMemo, useEffect, useRef, createContext, useContext, useCallback } from "react";
import * as API from "./api.js";
import { setOnAuthExpired, setStoreId, clearStoreId } from "./api.js";
import printer from "./printer.js";
import hardwareManager from "./hardware.js";
import { CO, DEFAULT_TVA_RATES, PERMS, initProducts, initUsers, initCustomers, LOYALTY_TIERS, initPromos, C, categories as defaultCategories } from "./constants.jsx";
import { hashPin, verifyPin, sha256, norm, loadVariantOrderFromSettings, autoImportSizesFromProducts, generateEAN13, DEFAULT_CAT_ICONS } from "./utils.jsx";
import Papa from "papaparse";

/* ══════════ CONTEXT ══════════ */
const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

// TVA_RATES mutable — keep module-level ref so context can update it
let TVA_RATES = [...DEFAULT_TVA_RATES];

function AppProvider({children}){
  const[currentUser,setCurrentUserRaw]=useState(()=>{try{const s=sessionStorage.getItem("caissepro_user");return s?JSON.parse(s):null;}catch(e){return null;}});
  const setCurrentUser=useCallback((u)=>{setCurrentUserRaw(u);try{if(u)sessionStorage.setItem("caissepro_user",JSON.stringify(u));else sessionStorage.removeItem("caissepro_user");}catch(e){}},[]);
  // ══ Multi-store ══
  const[stores,setStores]=useState([]);
  const[currentStore,setCurrentStoreRaw]=useState(()=>{try{const s=sessionStorage.getItem("caissepro_store");return s?JSON.parse(s):null;}catch(e){return null;}});
  const setCurrentStore=useCallback((s)=>{setCurrentStoreRaw(s);try{if(s){sessionStorage.setItem("caissepro_store",JSON.stringify(s));setStoreId(s.id);}else{sessionStorage.removeItem("caissepro_store");clearStoreId();}}catch(e){}},[]);
  // Dashboard: which store the admin is viewing (can differ from currentStore)
  const[viewingStoreId,setViewingStoreId]=useState(()=>{try{return sessionStorage.getItem("caissepro_viewing_store")||null;}catch(e){return null;}});
  useEffect(()=>{try{if(viewingStoreId)sessionStorage.setItem("caissepro_viewing_store",viewingStoreId);else sessionStorage.removeItem("caissepro_viewing_store");}catch(e){}},[viewingStoreId]);
  const[mode,setMode]=useState(()=>{try{return sessionStorage.getItem("caissepro_mode")||"cashier";}catch(e){return"cashier";}});
  useEffect(()=>{try{sessionStorage.setItem("caissepro_mode",mode);}catch(e){}},[mode]);
  // The effective store_id for API calls: in cashier mode, always currentStore; in dashboard, viewingStoreId or currentStore
  const effectiveStoreId=useMemo(()=>{if(mode==="cashier")return currentStore?.id||null;return viewingStoreId||currentStore?.id||null;},[mode,currentStore,viewingStoreId]);
  // Update API header when effective store changes
  useEffect(()=>{if(effectiveStoreId)setStoreId(effectiveStoreId);else clearStoreId();},[effectiveStoreId]);
  const[products,setProducts]=useState([]);
  const[productPhotos,setProductPhotos]=useState([]);
  const productPhotosMapRef=useRef(new Map()); // Map<"skuBase-colorKey", [{url, sortOrder}]>
  const[customers,setCustomers]=useState([]);
  const[cart,setCart]=useState([]);
  const[gDisc,setGDisc]=useState(0);const[gDiscType,setGDiscType]=useState("percentage");
  const[promoCode,setPromoCode]=useState("");
  const[cashReg,setCashReg]=useState(()=>{try{const s=localStorage.getItem("caissepro_cashreg");return s?JSON.parse(s):null;}catch(e){return null;}});
  useEffect(()=>{try{if(cashReg)localStorage.setItem("caissepro_cashreg",JSON.stringify(cashReg));else localStorage.removeItem("caissepro_cashreg");}catch(e){}},[cashReg]);
  const[isOnline,setIsOnline]=useState(true);
  // H5/RGPD: tickets in localStorage contain customerName only (no email/phone/notes)
  // Full customer PII is server-side only, never cached locally
  // L3: localStorage capped at 500 tickets — server is source of truth for full history
  const[tickets,setTickets]=useState(()=>{try{const s=localStorage.getItem("caissepro_tickets");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_tickets",JSON.stringify(tickets.slice(0,500)));}catch(e){}},[tickets]);
  // ══ NF525 Fiscal chain — localStorage is CACHE only, server is source of truth ══
  // On login, these are always overwritten by server values (see login() and loadAllData())
  // In offline mode, a warning banner is shown to indicate fiscal chain is not tamper-proof
  const[tSeq,setTSeq]=useState(()=>{try{return parseInt(localStorage.getItem("caissepro_tseq"))||0;}catch(e){return 0;}});
  useEffect(()=>{try{localStorage.setItem("caissepro_tseq",String(tSeq));}catch(e){}},[tSeq]);
  const[lastHash,setLastHash]=useState(()=>{try{return localStorage.getItem("caissepro_lasthash")||"0".repeat(64);}catch(e){return "0".repeat(64);}});
  useEffect(()=>{try{localStorage.setItem("caissepro_lasthash",lastHash);}catch(e){}},[lastHash]);
  const[gt,setGt]=useState(()=>{try{return parseFloat(localStorage.getItem("caissepro_gt"))||0;}catch(e){return 0;}});
  useEffect(()=>{try{localStorage.setItem("caissepro_gt",String(gt));}catch(e){}},[gt]);
  const[fiscalWarning,setFiscalWarning]=useState(false);
  const[audit,setAudit]=useState(()=>{try{const s=localStorage.getItem("caissepro_audit");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_audit",JSON.stringify(audit.slice(0,1000)));}catch(e){}},[audit]);
  const[jet,setJet]=useState(()=>{try{const s=localStorage.getItem("caissepro_jet");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_jet",JSON.stringify(jet.slice(0,1000)));}catch(e){}},[jet]);
  const[closures,setClosures]=useState(()=>{try{const s=localStorage.getItem("caissepro_closures");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_closures",JSON.stringify(closures));}catch(e){}},[closures]);
  const[avoirs,setAvoirs]=useState(()=>{try{const s=localStorage.getItem("caissepro_avoirs");return s?norm.avoirs(JSON.parse(s)):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_avoirs",JSON.stringify(avoirs));}catch(e){}},[avoirs]);
  const[promos,setPromos]=useState(initPromos);
  const[parked,setParked]=useState(()=>{try{const s=localStorage.getItem("caissepro_parked");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_parked",JSON.stringify(parked));}catch(e){}},[parked]);
  const[retoucheBons,setRetoucheBons]=useState(()=>{try{const s=localStorage.getItem("caissepro_retouches");return s?JSON.parse(s):[];}catch(e){return[];}});
  const[tenues,setTenues]=useState(()=>{try{const s=localStorage.getItem("caissepro_tenues");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_retouches",JSON.stringify(retoucheBons.slice(0,500)));}catch(e){}},[retoucheBons]);
  const[selCust,setSelCust]=useState(null);
  const[stockMoves,setStockMoves]=useState(()=>{try{const s=localStorage.getItem("caissepro_stockmoves");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_stockmoves",JSON.stringify(stockMoves.slice(0,500)));}catch(e){}},[stockMoves]);
  const[settings,setSettings]=useState(()=>{try{const s=localStorage.getItem("caissepro_settings");return s?{...CO,loyaltyTiers:LOYALTY_TIERS,returnPolicy:{days:30,conditions:"Article non porté, étiquette présente"},pricingMode:"TTC",...JSON.parse(s)}:{...CO,loyaltyTiers:LOYALTY_TIERS,returnPolicy:{days:30,conditions:"Article non porté, étiquette présente"},pricingMode:"TTC"};}catch(e){return{...CO,loyaltyTiers:LOYALTY_TIERS,returnPolicy:{days:30,conditions:"Article non porté, étiquette présente"},pricingMode:"TTC"};}});
  useEffect(()=>{try{localStorage.setItem("caissepro_settings",JSON.stringify(settings));}catch(e){}},[settings]);
  const saveSettingsToAPI_base=useCallback(async(newSettings)=>{
    setSettings(s=>({...s,...newSettings}));
    try{await API.settings.update(newSettings);}catch(e){console.warn("Settings sauvés localement uniquement:",e.message);}
  },[]);
  const[saleNote,setSaleNote]=useState("");
  const[clockEntries,setClockEntries]=useState(()=>{try{const s=localStorage.getItem("caissepro_clock");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_clock",JSON.stringify(clockEntries.slice(0,500)));}catch(e){}},[clockEntries]);
  const[priceHistory,setPriceHistory]=useState(()=>{try{const s=localStorage.getItem("caissepro_pricehistory");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_pricehistory",JSON.stringify(priceHistory.slice(0,500)));}catch(e){}},[priceHistory]);
  const[favorites,setFavoritesRaw]=useState(()=>{try{const s=localStorage.getItem("caissepro_favorites");return s?JSON.parse(s):[];}catch(e){return[];}});
  const setFavorites=useCallback((v)=>{setFavoritesRaw(prev=>{const next=typeof v==="function"?v(prev):v;try{localStorage.setItem("caissepro_favorites",JSON.stringify(next));}catch(e){}
    API.favorites.save(next).catch(()=>{});return next;});},[]);
  const[notifications,setNotifications]=useState([]);
  const[printerConnected,setPrinterConnected]=useState(false);
  const[printerType,setPrinterType]=useState(null);
  // Hardware Abstraction Layer
  const[hwId,setHwId]=useState(()=>hardwareManager.init());
  const hwProfile=useMemo(()=>hardwareManager.currentProfile,[hwId]);
  const switchHardware=useCallback((id)=>{hardwareManager.setHardware(id);setHwId(id);},[]);
  const[paymentId,setPaymentId]=useState(()=>hardwareManager.paymentId);
  const[paymentConfig,setPaymentConfigState]=useState(()=>hardwareManager.paymentConfig);
  const switchPayment=useCallback((id,config)=>{hardwareManager.setPayment(id,config||paymentConfig);setPaymentId(id);},[paymentConfig]);
  const updatePaymentConfig=useCallback((cfg)=>{hardwareManager.updatePaymentConfig(cfg);setPaymentConfigState(hardwareManager.paymentConfig);},[]);
  const chargePayment=useCallback(async(amount,opts)=>hardwareManager.charge(amount,opts),[]);
  const refundPayment=useCallback(async(amount,opts)=>hardwareManager.refund(amount,opts),[]);
  // Listen for HAL auto-connect events (printer, payment)
  useEffect(()=>{
    const unsub=hardwareManager.on((event,data)=>{
      if(event==='printer-status'&&data.connected){setPrinterConnected(true);setPrinterType(hwId);}
      if(event==='payment-status')console.log('[HAL] Payment status:',data);
    });
    return unsub;
  },[hwId]);
  // Barcode scanner auto-start (moved after findByEAN/addToCart declarations)
  // SEC-04: Removed hardcoded PIN hash and default users. Offline login uses only cached credentials from last successful online session.
  const[users,setUsersRaw]=useState(()=>{try{const s=localStorage.getItem("caissepro_users");return s?JSON.parse(s):[];}catch(e){return[];}});
  const setUsers=useCallback((v)=>{setUsersRaw(prev=>{const next=typeof v==="function"?v(prev):v;try{localStorage.setItem("caissepro_users",JSON.stringify(next));}catch(e){}return next;});},[]);
  // ══ Pending sync queue — retry offline user/settings changes when back online ══
  const[pendingSync,setPendingSync]=useState(()=>{try{const s=localStorage.getItem("caissepro_pendingSync");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_pendingSync",JSON.stringify(pendingSync));}catch(e){}},[pendingSync]);
  const addPendingSync=useCallback((action)=>{setPendingSync(p=>[...p,{...action,ts:Date.now()}]);},[]);
  const addRetoucheBon=useCallback(async(bon)=>{
    try{
      const saved=await API.retouches.create({client:bon.client||"",phone:bon.phone||"",seller:bon.seller||"",items:(bon.items||[]).filter(i=>i.desc).map(i=>({desc:i.desc||i.description||"",price:parseFloat(i.price)||0})),dateRetrait:bon.dateRetrait||null,notes:bon.notes||"",total:parseFloat(bon.total)||0});
      const mapped={num:saved.retouche_number||saved.num,shortCode:saved.short_code||(saved.retouche_number||"").slice(-4)||"",client:saved.client||bon.client,phone:saved.phone||bon.phone,seller:saved.seller||bon.seller,items:(saved.items||[]).map(i=>({desc:i.description||i.desc||"",price:i.price})).concat(saved.items?[]:(bon.items||[]).filter(i=>i.desc)),dateRetrait:saved.date_retrait||bon.dateRetrait,total:parseFloat(saved.total_ttc)||bon.total,barcode:saved.barcode||bon.barcode,date:saved.created_at||bon.date,id:saved.id,status:saved.status||"pending"};
      setRetoucheBons(prev=>{const next=[mapped,...prev].slice(0,500);try{localStorage.setItem("caissepro_retouches",JSON.stringify(next));}catch(e){}return next;});
      return mapped;
    }catch(e){
      console.warn("Retouche API failed, saving locally:",e.message);
      setRetoucheBons(prev=>{const next=[bon,...prev].slice(0,500);try{localStorage.setItem("caissepro_retouches",JSON.stringify(next));}catch(e){}return next;});
      addPendingSync({type:"createRetouche",data:bon});
      return bon;
    }
  },[addPendingSync]);
  const updateRetoucheStatus=useCallback(async(id,status)=>{
    try{await API.retouches.updateStatus(id,status);setRetoucheBons(prev=>prev.map(b=>b.id===id?{...b,status}:b));return true;}catch(e){console.warn("Retouche status update failed:",e.message);return false;}
  },[]);
  // ══ Tenues employé : normalisation backend(snake/camel)→front ══
  const _mapTenue=(t)=>({id:t.id,num:t.tenue_number||t.num,barcode:t.barcode||"",employee:t.employee||"",
    totalQty:t.total_qty??t.totalQty??0,totalValue:parseFloat(t.total_value??t.totalValue??0)||0,
    notes:t.notes||"",date:t.created_at||t.date,userName:t.user_name||t.userName||"",
    items:(t.items||[]).map(i=>({productName:i.productName||i.product_name||"",variantColor:i.variantColor||i.variant_color||"",
      variantSize:i.variantSize||i.variant_size||"",ean:i.ean||"",quantity:i.quantity||i.qty||1,
      unitCost:parseFloat(i.unitCost??i.unit_cost??0)||0,sku:i.sku||""}))});
  const addTenue=useCallback(async(employee,items,notes)=>{
    const saved=await API.tenues.create({employee,items,notes:notes||""});
    const mapped=_mapTenue(saved);
    setTenues(prev=>{const next=[mapped,...prev].slice(0,500);try{localStorage.setItem("caissepro_tenues",JSON.stringify(next));}catch(e){}return next;});
    return mapped;
  },[]);
  const reloadTenues=useCallback(async(q)=>{
    try{const data=await API.tenues.list(q?{q}:{});const mapped=(data||[]).map(_mapTenue);
      if(!q){setTenues(mapped.slice(0,500));try{localStorage.setItem("caissepro_tenues",JSON.stringify(mapped.slice(0,500)));}catch(e){}}
      return mapped;
    }catch(e){console.warn("Chargement tenues échoué:",e.message);return[];}
  },[]);
  const[tvaRates,setTvaRates]=useState([...DEFAULT_TVA_RATES]);
  useEffect(()=>{TVA_RATES=tvaRates;},[tvaRates]);

  const notify=useCallback((msg,type="info")=>{const id=Date.now();
    setNotifications(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setNotifications(p=>p.filter(n=>n.id!==id)),3500);},[]);

  // Printer event listener
  useEffect(()=>{
    const unsub=printer.on((event,data)=>{
      if(event==='connected'){setPrinterConnected(true);setPrinterType(data.type);}
      if(event==='disconnected'){setPrinterConnected(false);setPrinterType(null);}
    });
    return unsub;
  },[]);

  useEffect(()=>{
    const API_BASE=import.meta.env.VITE_API_URL||'https://api.techincash.app';
    // Robust online check — try multiple methods for Capacitor WebView compatibility
    const checkReal=async()=>{
      const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),10000);
      try{
        // Method 1: normal cors fetch to our health endpoint
        const r=await fetch(API_BASE+'/api/health',{method:'GET',cache:'no-store',signal:ctrl.signal});
        clearTimeout(t);
        if(r.ok){setIsOnline(true);console.log('[Online] API reachable (status '+r.status+')');return;}
      }catch(e){clearTimeout(t);console.warn('[Online] Method 1 failed:',e.message);}
      const ctrl2=new AbortController();const t2=setTimeout(()=>ctrl2.abort(),8000);
      try{
        // Method 2: no-cors (opaque response = status 0, but proves connectivity)
        await fetch(API_BASE+'/api/health',{method:'HEAD',mode:'no-cors',cache:'no-store',signal:ctrl2.signal});
        clearTimeout(t2);setIsOnline(true);console.log('[Online] API reachable (no-cors)');return;
      }catch(e){clearTimeout(t2);console.warn('[Online] Method 2 failed:',e.message);}
      const ctrl3=new AbortController();const t3=setTimeout(()=>ctrl3.abort(),5000);
      try{
        // Method 3: Google connectivity check (like Android captive portal detection)
        await fetch('https://clients3.google.com/generate_204',{method:'HEAD',mode:'no-cors',cache:'no-store',signal:ctrl3.signal});
        clearTimeout(t3);
        // Internet works but our API doesn't — still mark as online so app is usable
        setIsOnline(true);console.log('[Online] Internet OK (Google), API may have CORS issue');return;
      }catch(e){clearTimeout(t3);console.warn('[Online] Method 3 failed:',e.message);}
      console.warn('[Online] All checks failed — marking offline. navigator.onLine=',navigator.onLine);
      setIsOnline(false);
    };
    // Don't rely on browser online/offline events on Capacitor — they're unreliable
    const on=()=>checkReal();const off=()=>checkReal();
    window.addEventListener("online",on);window.addEventListener("offline",off);
    // Check immediately, at 3s, 10s, 20s, then every 30s
    checkReal();setTimeout(checkReal,3000);setTimeout(checkReal,10000);setTimeout(checkReal,20000);
    const iv=setInterval(checkReal,30000);
    return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);clearInterval(iv);};},[]);

  // ══ Auto-reconnect on page refresh if token exists ══
  const loadAllData=useCallback(async()=>{
    try{
      const[prods,custs,prms,setts,apiUsers]=await Promise.all([
        API.products.list(),API.customers.list(),API.settings.promos(),API.settings.get(),API.auth.users().catch(()=>null)]);
      // Load settings + variant order BEFORE normalizing products (so sort order is correct)
      loadVariantOrderFromSettings(setts);
      // Auto-import sizes from products into size ranking
      autoImportSizesFromProducts(prods);
      setProducts(norm.products(prods));setCustomers(norm.customers(custs));setPromos(prms);setSettings(s=>({...s,...setts}));
      // Load product photos
      try{const photos=await API.productPhotos.list();setProductPhotos(photos||[]);
        const m=new Map();for(const p of (photos||[])){const k=`${p.skuBase}-${p.colorKey}`;if(!m.has(k))m.set(k,[]);m.get(k).push({url:`${API.productPhotos.apiUrl}/uploads/products/${p.filename}`,sortOrder:p.sortOrder,id:p.id});}
        m.forEach(v=>v.sort((a,b)=>a.sortOrder-b.sortOrder));productPhotosMapRef.current=m;
      }catch(e){console.warn("Chargement photos produits echoue:",e.message);}
      // H4 fix: use callback form to avoid stale closure on users
      if(apiUsers?.length){const merged=[...apiUsers.map(u=>({id:u.id,name:u.name,role:u.role,pin:"****",apiSynced:true}))];
        setUsers(prev=>{const localOnly=prev.filter(lu=>!apiUsers.find(au=>au.name===lu.name));return[...merged,...localOnly];});}
      // Load tickets and closures from backend
      try{const salesData=await API.sales.list({limit:200});if(salesData?.length)setTickets(salesData.map(s=>({...s,ticketNumber:s.ticket_number,totalHT:parseFloat(s.total_ht),totalTVA:parseFloat(s.total_tva),totalTTC:parseFloat(s.total_ttc),date:s.created_at,userName:s.user_name,paymentMethod:s.payment_method,customerName:s.customer_name,fingerprint:s.fingerprint})));}catch(e){console.warn("Chargement ventes échoué:",e.message);}
      try{const closData=await API.fiscal.closures();if(closData?.length)setClosures(closData.map(c=>({...c,type:c.closure_type,totalHT:parseFloat(c.total_ht),totalTVA:parseFloat(c.total_tva),totalTTC:parseFloat(c.total_ttc),totalMargin:parseFloat(c.total_margin||0),date:c.created_at,userName:c.user_name})));}catch(e){console.warn("Chargement clôtures échoué:",e.message);}
      // Load avoirs from server
      try{const avoirsData=await API.returns.list({limit:500});if(avoirsData?.length)setAvoirs(norm.avoirs(avoirsData));}catch(e){/* keep localStorage avoirs */}
      try{const ctr=await API.returns.counter();if(ctr?.seq)setAvoirSeq(ctr.seq);}catch(e){console.warn("Chargement compteur avoirs échoué:",e.message);}
      // LS-04/05/06/07: reload audit, JET, stock movements, clock from API
      try{const auditData=await API.audit.list({limit:1000});if(auditData?.length)setAudit(auditData);}catch(e){/* keep localStorage audit */}
      try{const jetData=await API.audit.jet();if(jetData?.length)setJet(jetData);}catch(e){/* keep localStorage jet */}
      try{const movesData=await API.stock.movements({limit:500});if(movesData?.length)setStockMoves(movesData);}catch(e){/* keep localStorage stockMoves */}
      try{const clockData=await API.audit.clock();if(clockData?.length)setClockEntries(clockData);}catch(e){/* keep localStorage clock */}
      try{const phData=await API.pricehistory.list({limit:500});if(phData?.length)setPriceHistory(phData);}catch(e){/* keep localStorage */}
      try{const retData=await API.retouches.list();if(retData?.length)setRetoucheBons(retData.map(r=>({id:r.id,num:r.retouche_number,shortCode:r.short_code||(r.retouche_number||"").slice(-4)||"",client:r.client||"",phone:r.phone||"",seller:r.seller||"",items:(r.items||[]).map(i=>({desc:i.description||i.desc||"",price:i.price})),dateRetrait:r.date_retrait,total:parseFloat(r.total_ttc)||0,barcode:r.barcode,date:r.created_at,status:r.status})));}catch(e){/* keep localStorage retouches */}
      try{await reloadTenues();}catch(e){/* keep localStorage tenues */}
    }catch(e){
      console.warn("Chargement données échoué:",e.message);
      if(e.message?.includes("401")||e.message?.includes("Unauthorized")){setCurrentUser(null);API.clearToken();}
    }
  },[]);
  useEffect(()=>{
    const token=API.getToken();if(!token||!currentUser)return;
    // Multi-store: reload stores list on reconnect
    API.stores.list().then(s=>{if(s?.length)setStores(s);}).catch(()=>{});
    loadAllData();
  },[currentUser]);

  // ══ Retry pending sync when back online ══
  const clearPendingSync=useCallback(()=>{setPendingSync([]);notify("File de synchronisation vidée","info");},[notify]);
  useEffect(()=>{if(!isOnline||!pendingSync.length||!API.getToken())return;
    // Debounce — ne pas retenter en boucle
    const timer=setTimeout(async()=>{const failed=[];let synced=0;
      for(const action of pendingSync){
        try{
          if(action.type==="updateUser")await API.auth.updateUser(action.userId,action.data);
          else if(action.type==="createUser")await API.auth.createUser(action.data);
          else if(action.type==="deleteUser")await API.auth.deleteUser(action.userId);
          else if(action.type==="updateSettings")await API.settings.update(action.data);
          else if(action.type==="openRegister")await API.settings.openRegister(action.data.openingAmount);
          else if(action.type==="closeRegister")await API.settings.closeRegister(action.data.registerId,{closedAt:new Date().toISOString()});
          else if(action.type==="offlineSale")await API.sales.checkout(action.data);
          else if(action.type==="offlineClosure")await API.fiscal.closure(action.data);
          else if(action.type==="offlineAvoir"){await API.returns.create(action.data);/* FE-08: backend handles restock — no local increment here */}
          else if(action.type==="consumeAvoir")await API.returns.consume(action.data.avoirNumber,action.data.amount);
          else if(action.type==="createGiftCard")await API.giftcards.create(action.data);
          else if(action.type==="useGiftCard")await API.giftcards.use(action.data.code,action.data.amount);
          else if(action.type==="parkCart")await API.parked.save(action.data);
          else if(action.type==="priceChange")await API.pricehistory.create(action.data);
          else if(action.type==="createRetouche")await API.retouches.create(action.data);
          else if(action.type==="audit")await API.audit.create(action.data.action,action.data.detail,action.data.reference);
          else if(action.type==="jet")await API.audit.createJet(action.data.eventType,action.data.detail);
          else{failed.push({...action,retries:(action.retries||0)+1,lastError:"Type inconnu"});continue;}
          synced++;
        }catch(e){
          const retries=(action.retries||0)+1;
          // Abandon après 3 tentatives — l'action est probablement invalide (ex: password ****)
          if(retries>=3){console.warn(`Sync abandonné après ${retries} tentatives:`,action.type,e.message);
          }else{failed.push({...action,retries,lastError:e.message});}
        }
      }
      setPendingSync(failed);
      if(synced>0){
        notify(`${synced} modification(s) synchronisée(s) avec le serveur`,"success");
        // Rafraichir les produits (stock) apres sync d'avoirs ou ventes
        try{const prods=await API.products.list();setProducts(norm.products(prods));}catch(e){console.warn("Rafraîchissement produits échoué:",e.message);}
      }
      if(failed.length>0&&failed.some(f=>f.retries<3))notify(`${failed.length} synchro(s) en attente — nouvelle tentative prochainement`,"warn");
    },2000);// 2s debounce
    return()=>clearTimeout(timer);
  },[isOnline,pendingSync.length]);// eslint-disable-line react-hooks/exhaustive-deps

  // NF525: JET — Journal des Événements Techniques conforme
  // Champs requis: ID, ID_SOC, ID_CAISSE, NUMERO_JET, CODE_JET, DESCRIPTIF, CODE_UTIL, TYPE_JET, DATETIME, INFO, SIGNATURE
  const jetSeqRef=useRef(()=>{try{return parseInt(localStorage.getItem("caissepro_jetseq"))||0;}catch(e){return 0;}});
  const lastJetHashRef=useRef(()=>{try{return localStorage.getItem("caissepro_lastjethash")||"0".repeat(64);}catch(e){return"0".repeat(64);}});
  // NF525 JET event codes mapping
  const JET_CODES={SYS_START:80,SYS_STOP:81,LOGIN:100,LOGOUT:101,VENTE:200,VOID_LINE:210,VOID_SALE:220,AVOIR:230,
    PARAM_CHANGE:410,PRICE_CHANGE:411,EXPORT:20,ARCHIVE:30,CLOTURE:50,CLOTURE_ANNUELLE:60,
    INTEGRITY_FAIL:90,SEQ_BREAK:95,VERSION_CHANGE:250,FISCAL_CONTROL:280,COMPANY_CHANGE:410,
    DUPLICATA:300,FACTURE:310,RETOUCHE:320,IMPORT:330,CAISSE:340,CLOCK_IN:350,CLOCK_OUT:351,
    LOGIN_OFFLINE:102,ERROR:900};
  const addJET=useCallback(async(t,d)=>{
    const seqVal=typeof jetSeqRef.current==="function"?jetSeqRef.current():jetSeqRef.current;
    const lastH=typeof lastJetHashRef.current==="function"?lastJetHashRef.current():lastJetHashRef.current;
    const seq=seqVal+1;
    const dt=new Date().toISOString();
    const codeJet=JET_CODES[t]||999;
    const socId=settings.siret||CO.siret||"000000000";
    const caisseId=currentStore?.id||cashReg?.id||"CAISSE-01";
    const userId=currentUser?.id||currentUser?.name||"SYS";
    // NF525: signature SHA-256 chaînée pour le JET
    const hashInput=`${lastH}|${seq}|${codeJet}|${t}|${dt}|${d}|${userId}`;
    const hash=await sha256(hashInput);
    const fingerprint=hash.slice(0,16).toUpperCase();
    jetSeqRef.current=seq;lastJetHashRef.current=hash;
    try{localStorage.setItem("caissepro_jetseq",String(seq));localStorage.setItem("caissepro_lastjethash",hash);}catch(e){}
    const entry={id:Date.now(),seq,date:dt,type:t,codeJet,detail:d,
      user:userId,userName:currentUser?.name||"Sys",
      socId,caisseId,hash,fingerprint};
    setJet(p=>[entry,...p]);
    if(API.getToken())API.audit.createJet(t,d).catch(()=>{addPendingSync({type:"jet",data:{eventType:t,detail:d}});});
  },[currentUser,currentStore,cashReg,settings.siret,addPendingSync]);
  const addAudit=useCallback((a,d,r)=>{
    setAudit(p=>[{id:Date.now(),date:new Date().toISOString(),action:a,detail:d,ref:r,user:currentUser?.name||"—"},...p]);
    if(API.getToken())API.audit.create(a,d,r).catch(()=>{addPendingSync({type:"audit",data:{action:a,detail:d,reference:r}});});
  },[currentUser,addPendingSync]);
  const perm=useCallback(()=>currentUser?PERMS[currentUser.role]||PERMS.cashier:PERMS.cashier,[currentUser]);
  // NF525: JET — événement de démarrage système + vérification séquence
  useEffect(()=>{
    addJET("SYS_START",`Démarrage CaissePro v${CO.ver}`);
    // NF525: Vérification intégrité séquence tickets au démarrage (code 95)
    if(tickets.length>1){
      const sorted=[...tickets].sort((a,b)=>(a.seq||0)-(b.seq||0)).filter(t=>t.seq);
      for(let i=1;i<sorted.length;i++){
        if(sorted[i].seq-sorted[i-1].seq>1){
          addJET("SEQ_BREAK",`Rupture séquence détectée: ticket seq ${sorted[i-1].seq} → ${sorted[i].seq} (manque ${sorted[i].seq-sorted[i-1].seq-1} entrée(s))`);
          break;// Log une seule fois au démarrage
        }
      }
    }
    // NF525: Détection changement de version logicielle (code 250)
    try{const lastVer=localStorage.getItem("caissepro_last_version");
      if(lastVer&&lastVer!==CO.ver)addJET("VERSION_CHANGE",`Version ${lastVer} → ${CO.ver}`);
      localStorage.setItem("caissepro_last_version",CO.ver);}catch(e){}
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  // saveSettingsToAPI with JET logging (addJET must be declared first)
  const saveSettingsToAPI=useCallback(async(newSettings)=>{
    // NF525: détecter les modifications de données société (code 410)
    const companyFields=["name","address","postalCode","city","siret","tvaIntra","phone","legalForm","capital"];
    const changed=companyFields.filter(f=>newSettings[f]!==undefined&&newSettings[f]!==settings[f]);
    if(changed.length>0)addJET("COMPANY_CHANGE",`Modification données société: ${changed.map(f=>`${f}: ${settings[f]||"(vide)"} → ${newSettings[f]}`).join(", ")}`);
    else addJET("PARAM_CHANGE",`Modification paramètres: ${Object.keys(newSettings).join(", ")}`);
    return saveSettingsToAPI_base(newSettings);
  },[addJET,saveSettingsToAPI_base,settings]);

  const[offlineMode,setOfflineMode]=useState(false);
  // NF525: Mode formation/test — les données sont marquées FACTICE
  const[trainingMode,setTrainingMode]=useState(false);

  // ══ Load store data after selecting a store ══
  const loadStoreData=useCallback(async()=>{
    try{
      const[prods,custs,prms,setts,apiUsers,apiSales,apiCounter]=await Promise.all([API.products.list(),API.customers.list(),API.settings.promos(),API.settings.get(),API.auth.users().catch(()=>null),API.sales.list({limit:200}).catch(()=>null),API.fiscal.counter().catch(()=>null)]);
      loadVariantOrderFromSettings(setts);
      if(setts?.csvColumnMapping){try{localStorage.setItem("caissepro_csv_column_mapping",JSON.stringify(setts.csvColumnMapping));}catch(e){}}
      autoImportSizesFromProducts(prods);
      setProducts(norm.products(prods));setCustomers(norm.customers(custs));setPromos(prms);setSettings(s=>({...s,...setts}));
      // MED-13: Use functional state updates to avoid stale closure on tickets/users
      if(apiSales&&Array.isArray(apiSales)){const mapped=apiSales.map(s=>({...s,ticketNumber:s.ticketNumber||s.ticket_number,totalHT:parseFloat(s.total_ht||s.totalHT)||0,totalTVA:parseFloat(s.total_tva||s.totalTVA)||0,totalTTC:parseFloat(s.total_ttc||s.totalTTC)||0,date:s.date||s.created_at,userName:s.userName||s.user_name,paymentMethod:s.paymentMethod||s.payment_method,customerName:s.customerName||s.customer_name,fingerprint:s.fingerprint}));
        setTickets(prev=>{const localOnly=prev.filter(lt=>lt.hash==="LOCAL"||!mapped.find(as=>as.ticketNumber===lt.ticketNumber));return[...localOnly,...mapped].sort((a,b)=>new Date(b.date||b.createdAt||0)-new Date(a.date||a.createdAt||0)).slice(0,500);});}
      if(apiCounter&&!Array.isArray(apiCounter)){const seq=apiCounter.ticket_seq??apiCounter.seq??0;setTSeq(seq);if(apiCounter.last_hash||apiCounter.lastHash)setLastHash(apiCounter.last_hash||apiCounter.lastHash);if(apiCounter.grand_total!=null||apiCounter.grandTotal!=null)setGt(parseFloat(apiCounter.grand_total??apiCounter.grandTotal));}
      if(apiUsers&&apiUsers.length){const merged=[...apiUsers.map(u=>({id:u.id,name:u.name,role:u.role,pin:"****",apiSynced:true}))];
        setUsers(prev=>{const localOnly=prev.filter(lu=>!apiUsers.find(au=>au.name===lu.name));return[...merged,...localOnly];});}
      // Charger gift cards, paniers suspendus, favoris et footfall depuis le backend
      try{const gcs=await API.giftcards.list();if(gcs&&Array.isArray(gcs))setGiftCards(gcs.map(g=>({id:g.id,code:g.code,initialAmount:parseFloat(g.initial_amount||0),balance:parseFloat(g.remaining||0),createdDate:g.created_at,customerName:g.customer_name||"",barcode:g.barcode||null,transactions:g.transactions||[]})));}catch(e){console.warn("Chargement cartes cadeaux échoué:",e.message);}
      try{const pks=await API.parked.list();if(pks&&Array.isArray(pks))setParked(pks.map(p=>({id:p.id,date:p.created_at,items:p.items||[],customer:null,gDisc:0,gDiscType:"percentage",name:p.name})));}catch(e){console.warn("Chargement paniers suspendus échoué:",e.message);}
      // LOW-4: Load favorites and footfall from API
      try{const favs=await API.favorites.list();if(Array.isArray(favs))setFavorites(favs);}catch(e){console.warn("Chargement favoris échoué:",e.message);}
      try{const ff=await API.footfall.list();if(Array.isArray(ff))setFootfall(ff);}catch(e){console.warn("Chargement footfall échoué:",e.message);}
    }catch(e){console.warn("Chargement données magasin échoué:",e.message);}
  },[]);

  // ══ Select a store (called after login or from dashboard store switcher) ══
  const selectStore=useCallback(async(store)=>{
    setCurrentStore(store);
    setViewingStoreId(store.id);
    await loadStoreData();
    notify(`Magasin: ${store.name}`,"success");
  },[setCurrentStore,loadStoreData,notify]);

  // ══ Dashboard: switch viewed store (reloads data for that store) ══
  const switchViewingStore=useCallback(async(storeId)=>{
    setViewingStoreId(storeId);
    setStoreId(storeId==="all"?null:storeId);
    // Reload ALL data for the new store context
    try{
      const[prods,apiSales,setts,closData,apiCounter,stockAl]=await Promise.all([
        API.products.list(),
        API.sales.list({limit:200}).catch(()=>null),
        API.settings.get().catch(()=>null),
        API.fiscal.closures().catch(()=>null),
        API.fiscal.counter().catch(()=>null),
        API.stock.alerts().catch(()=>null),
      ]);
      if(prods)setProducts(norm.products(prods));
      if(apiSales&&Array.isArray(apiSales))setTickets(apiSales.map(s=>({...s,ticketNumber:s.ticketNumber||s.ticket_number,totalHT:parseFloat(s.total_ht||s.totalHT)||0,totalTVA:parseFloat(s.total_tva||s.totalTVA)||0,totalTTC:parseFloat(s.total_ttc||s.totalTTC)||0,date:s.date||s.created_at,userName:s.userName||s.user_name,paymentMethod:s.paymentMethod||s.payment_method,customerName:s.customerName||s.customer_name,fingerprint:s.fingerprint})).sort((a,b)=>new Date(b.date||b.createdAt||0)-new Date(a.date||a.createdAt||0)).slice(0,500));
      if(setts)setSettings(s=>({...s,...setts}));
      if(closData?.length)setClosures(closData.map(c=>({...c,type:c.closure_type,totalHT:parseFloat(c.total_ht),totalTVA:parseFloat(c.total_tva),totalTTC:parseFloat(c.total_ttc),totalMargin:parseFloat(c.total_margin||0),date:c.created_at,userName:c.user_name})));
      else setClosures([]);
      if(apiCounter&&!Array.isArray(apiCounter)){const seq=apiCounter.ticket_seq??apiCounter.seq??0;setTSeq(seq);if(apiCounter.last_hash||apiCounter.lastHash)setLastHash(apiCounter.last_hash||apiCounter.lastHash);if(apiCounter.grand_total!=null||apiCounter.grandTotal!=null)setGt(parseFloat(apiCounter.grand_total??apiCounter.grandTotal));}
      else{setTSeq(0);setLastHash("0".repeat(64));setGt(0);}
      if(stockAl)setStockAlerts(stockAl);else setStockAlerts([]);
    }catch(e){console.warn("Erreur chargement magasin:",e.message);}
    const storeName=storeId==="all"?"Tous les magasins":stores.find(s=>s.id===storeId)?.name||"";
    notify(`Vue: ${storeName}`,"info");
  },[stores,notify]);

  const login=async(n,pw)=>{
    // Essai API d'abord
    try{const res=await API.auth.login(n,pw);API.setToken(res.token);setCurrentUser(res.user);
      // Multi-store: récupérer les magasins de l'utilisateur
      const userStores=res.stores||[];
      setStores(userStores);
      // Si un seul magasin, le sélectionner automatiquement
      if(userStores.length===1){
        setCurrentStore(userStores[0]);setViewingStoreId(userStores[0].id);
        setStoreId(userStores[0].id);
        await loadStoreData();
      } else if(userStores.length>1){
        // Sélectionner le magasin principal par défaut
        const primary=userStores.find(s=>s.isPrimary)||userStores[0];
        setCurrentStore(primary);setViewingStoreId(primary.id);
        setStoreId(primary.id);
        await loadStoreData();
      } else {
        // Pas de magasins assignés — charger les données sans filtre (rétrocompatibilité)
        await loadStoreData();
      }
      setOfflineMode(false);setFiscalWarning(false);addJET("LOGIN",n);notify("Connecté au serveur","success");return{ok:true,stores:userStores};
    }catch(e){
      console.warn("API indisponible, tentative login hors-ligne:",e.message);
      // SEC-04: Offline login uses ONLY cached credentials from last successful online session (no hardcoded passwords)
      if(users.length===0){notify("Connexion impossible en mode hors ligne — connectez-vous d'abord en ligne","error");return{ok:false};}
      let localUser=null;
      for(const u of users){if(u.name===n&&u.pin&&u.pin!=="****"&&await verifyPin(pw,u.pin)){localUser=u;break;}}
      if(localUser){setCurrentUser({id:localUser.id,name:localUser.name,role:localUser.role});
        setProducts(initProducts);setCustomers(initCustomers);setPromos(initPromos);
        setOfflineMode(true);setFiscalWarning(true);addJET("LOGIN_OFFLINE",n);
        notify("Mode hors-ligne — chaîne fiscale non sécurisée, synchronisez dès que possible","warn");return{ok:true,stores:[]};}
      return{ok:false};}};
  const logout=()=>{API.clearToken();addJET("LOGOUT",currentUser?.name);setCurrentUser(null);setCurrentStore(null);setStores([]);setViewingStoreId(null);setCart([]);setGDisc(0);setSelCust(null);setOfflineMode(false);};

  // H1/H2 fix: Auto-logout on token expiration
  useEffect(()=>{setOnAuthExpired(()=>{notify("Session expirée — veuillez vous reconnecter","error");logout();});return()=>setOnAuthExpired(null);},[]);

  // Cart
  const addToCart=(p,v)=>setCart(prev=>{const i=prev.findIndex(c=>c.product.id===p.id&&c.variant?.id===v?.id);
    if(i>=0){const n=[...prev];n[i]={...n[i],quantity:n[i].quantity+1};return n;}return[...prev,{product:p,variant:v,quantity:1,discount:0,isCustom:false}];});
  const addCustomItem=(name,price,taxRate)=>setCart(p=>[...p,{product:{id:`custom-${Date.now()}`,name,sku:"DIVERS",price,costPrice:0,taxRate,category:"Divers"},variant:{id:`cv-${Date.now()}`,color:"—",size:"—",ean:""},quantity:1,discount:0,isCustom:true}]);
  const removeFromCart=(pid,vid,reason)=>{addAudit("VOID_LINE",`Suppression: ${pid}${reason?` — Motif: ${reason}`:""}`,pid);addJET("VOID_LINE",`Suppression ligne produit ${pid}${reason?` — ${reason}`:""}`);setCart(p=>p.filter(c=>!(c.product.id===pid&&(c.variant?.id===vid||!vid))));};
  const voidSale=(reason)=>{if(cart.length){addAudit("VOID_SALE",`Annulation panier: ${cart.length} articles — Motif: ${reason||"Non spécifié"}`);addJET("VOID_SALE",`Annulation panier ${cart.length} art. — ${reason||"Non spécifié"}`);setCart([]);setGDisc(0);setSelCust(null);setSelectedAvoir(null);setPromoCode("");setSaleNote("");}};
  const updateQty=(pid,vid,q)=>{if(q<1)return removeFromCart(pid,vid);setCart(p=>p.map(c=>c.product.id===pid&&c.variant?.id===vid?{...c,quantity:q}:c));};
  const updateItemDisc=(pid,vid,d,dt)=>setCart(p=>p.map(c=>c.product.id===pid&&c.variant?.id===vid?{...c,discount:d,discountType:dt||"percent"}:c));
  const clearCart=()=>{setCart([]);setGDisc(0);setSelCust(null);setPromoCode("");setSelectedAvoir(null);setSaleNote("");};
  const setCartGD=(v,t)=>{setGDisc(v);setGDiscType(t);};

  // Park — backend-first avec cache localStorage
  const parkCart=useCallback(async()=>{if(!cart.length)return;
    const parkedData={name:`Panier ${new Date().toLocaleString("fr-FR")}`,items:cart.map(i=>({productId:i.product?.id,variantId:i.variant?.id,productName:i.product?.name,variantColor:i.variant?.color,variantSize:i.variant?.size,quantity:i.quantity,price:i.product?.price,discount:i.discount,discountType:i.discountType})),customerId:selCust?.id||null};
    let newParked;
    try{const saved=await API.parked.save(parkedData);newParked={id:saved.id,date:saved.created_at||new Date().toISOString(),items:[...cart],customer:selCust,gDisc,gDiscType};}
    catch(e){newParked={id:Date.now(),date:new Date().toISOString(),items:[...cart],customer:selCust,gDisc,gDiscType};addPendingSync({type:"parkCart",data:parkedData});}
    setParked(p=>[...p,newParked]);setCart([]);setGDisc(0);setSelCust(null);addAudit("PARK","Panier mis en attente");
  },[cart,selCust,gDisc,gDiscType,addAudit,addPendingSync]);
  const restoreCart=useCallback(async(id)=>{const pk=parked.find(p=>p.id===id);if(!pk)return;if(cart.length)await parkCart();
    setCart(pk.items);setGDisc(pk.gDisc||0);setGDiscType(pk.gDiscType||"percentage");setSelCust(pk.customer);
    setParked(p=>p.filter(x=>x.id!==id));
    try{await API.parked.remove(id);}catch(e){/* Le panier etait peut-etre local seulement */}
    addAudit("RESTORE","Panier restaure");},[parked,cart,parkCart,addAudit]);
  const removeParked=useCallback(async(id)=>{setParked(p=>p.filter(x=>x.id!==id));try{await API.parked.remove(id);}catch(e){console.warn("Suppression panier suspendu échouée:",e.message);}addAudit("PARK_DELETE","Panier en attente supprime");},[addAudit]);

  // ══ PROMO ENGINE ══
  const activePromos=useMemo(()=>{const now=new Date().toISOString().split("T")[0];
    return promos.filter(p=>p.active&&(!p.startDate||p.startDate<=now)&&(!p.endDate||p.endDate>=now));},[promos]);

  const calcPromoDiscount=useCallback((cartItems)=>{
    const pm=settings.pricingMode||"TTC";
    const getHT=(ci)=>{const raw=ci.discountType==="amount"?ci.product.price*ci.quantity-((ci.discount||0)*ci.quantity):ci.product.price*ci.quantity*(1-(ci.discount||0)/100);
      return pm==="TTC"?raw/(1+(ci.product.taxRate||0.20)):raw;};
    const applyDisc=(ht,p)=>{const dt=p.discount_type||p.discountType||"percent";return dt==="amount"?Math.min(parseFloat(p.value),ht):ht*(parseFloat(p.value)/100);};
    let promoDisc=0;const applied=[];
    // Helper: filter cart items matching a promo target
    const matchItems=(ci,t,tt,tv,col)=>{
      if(t==="category_discount"||tt==="category")return(ci.product.category||"").toLowerCase()===tv;
      if(t==="sku_discount"||tt==="sku")return(ci.product.sku||"").toLowerCase()===tv;
      if(t==="color_discount"||tt==="color")return(ci.variant?.color||"").toLowerCase()===tv;
      if(t==="collection_discount"||tt==="collection")return(ci.product.collection||"").toLowerCase()===(col||tv);
      if(t==="low_stock_discount"||tt==="low_stock"){const stock=ci.variant?.stock??ci.product.stock??999;return stock<=(parseInt(tv)||5)&&stock>0;}
      return false;};

    activePromos.forEach(p=>{
      const t=p.promo_type||p.type;const tt=p.target_type||p.targetType;const tv=(p.target_value||p.targetValue||"").toLowerCase();
      const col=(p.collection||"").toLowerCase();const minQ=parseInt(p.min_qty||p.minQty)||0;

      if(["category_discount","sku_discount","color_discount","collection_discount","low_stock_discount"].includes(t)||
         ["category","sku","color","collection","low_stock"].includes(tt)){
        const matching=cartItems.filter(ci=>matchItems(ci,t,tt,tv,col));
        const matchQty=matching.reduce((s,i)=>s+i.quantity,0);
        // Cross-rule: if minQty is set, check quantity of matching items
        if(minQ>0&&matchQty<minQ)return;
        matching.forEach(ci=>{
          const d=applyDisc(getHT(ci),p);promoDisc+=d;
          const label=tt==="low_stock"?`${p.name}: -${d.toFixed(2)}€ HT sur ${ci.product.name} (stock: ${ci.variant?.stock??ci.product.stock})`
            :tt==="color"?`${p.name}: -${d.toFixed(2)}€ HT sur ${ci.product.name} (${ci.variant?.color})`
            :`${p.name}: -${d.toFixed(2)}€ HT sur ${ci.product.name}`;
          applied.push(label);});}

      else if(t==="qty_discount"){
        const qtyMin=minQ||3;
        if(cartItems.reduce((s,i)=>s+i.quantity,0)>=qtyMin){
          const totalHT=cartItems.reduce((s,i)=>s+getHT(i),0);
          const d=applyDisc(totalHT,p);promoDisc+=d;applied.push(`${p.name}: -${d.toFixed(2)}€ HT`);}}

      else if(t==="code"&&promoCode&&p.code&&promoCode.toUpperCase()===p.code.toUpperCase()){
        const totalHT=cartItems.reduce((s,i)=>s+getHT(i),0);
        const d=applyDisc(totalHT,p);promoDisc+=d;applied.push(`Code ${p.code}: -${d.toFixed(2)}€ HT`);}
    });
    return{promoDisc:Math.min(promoDisc,cartItems.reduce((s,i)=>s+getHT(i),0)),applied};
  },[activePromos,promoCode,settings.pricingMode]);

  // ══ AVOIR AS PAYMENT ══
  // selectedAvoir: { avoirNumber, totalTTC, remaining, applied } or null
  const[selectedAvoir,setSelectedAvoir]=useState(null);
  const avoirPayment=selectedAvoir?.applied||0;

  // Stock movements (déclaré avant checkout pour éviter use-before-declaration)
  const addStockMove=useCallback((type,product,variant,qty,ref)=>{
    setStockMoves(p=>[{id:Date.now(),date:new Date().toISOString(),type,productName:product.name,productSku:product.sku,
      variantColor:variant?.color,variantSize:variant?.size,qty,ref,user:currentUser?.name||"Sys"},...p]);
  },[currentUser]);

  // ══ CONSUME AVOIR (deduct amount when used as payment) ══
  const consumeAvoir=useCallback(async(avoirNumber,amount)=>{
    setAvoirs(p=>p.map(a=>{if(a.avoirNumber!==avoirNumber)return a;
      const rem=Math.max(0,(a.remaining??a.totalTTC)-amount);
      return{...a,remaining:rem,used:rem<=0};}));
    addAudit("AVOIR_USE",`Avoir ${avoirNumber} utilise: ${amount.toFixed(2)}EUR`);
    // Sync consumption to server
    try{await API.returns.consume(avoirNumber,amount);}
    catch(e){addPendingSync({type:"consumeAvoir",data:{avoirNumber,amount}});}
  },[addAudit,addPendingSync]);

  // ══ FE-05: Single source of truth for cart totals (used by both context and screens) ══
  const cartTotals=useMemo(()=>{
    if(!cart.length)return{sHT:0,gd:0,promoDisc:0,applied:[],tHT:0,tTVA:0,tTTC:0};
    const pm=settings.pricingMode||"TTC";
    const sHT=Math.round(cart.reduce((s,i)=>{const raw=i.discountType==="amount"?i.product.price*i.quantity-((i.discount||0)*i.quantity):i.product.price*i.quantity*(1-i.discount/100);
      return s+(pm==="TTC"?raw/(1+(i.product.taxRate||0.20)):raw);},0)*100)/100;
    let gd=gDiscType==="percentage"?Math.round(sHT*(gDisc/100)*100)/100:Math.min(gDisc,sHT);
    const{promoDisc,applied}=calcPromoDiscount(cart);
    gd=Math.round((gd+promoDisc)*100)/100;gd=Math.min(gd,sHT);
    const tHT=Math.round((sHT-gd)*100)/100;
    const discountRatio=sHT>0?(gd/sHT):0;
    let tTVA=0;
    cart.forEach(i=>{
      const raw=i.discountType==="amount"?i.product.price*i.quantity-((i.discount||0)*i.quantity):i.product.price*i.quantity*(1-i.discount/100);
      const lHT=pm==="TTC"?raw/(1+(i.product.taxRate||0.20)):raw;
      const adjHT=lHT*(1-discountRatio);
      tTVA+=Math.round(adjHT*(i.product.taxRate||0.20)*100)/100;
    });
    tTVA=Math.round(tTVA*100)/100;
    const tTTC=Math.max(0,Math.round((tHT+tTVA-avoirPayment)*100)/100);
    return{sHT,gd,promoDisc,applied,tHT,tTVA,tTTC};
  },[cart,gDisc,gDiscType,calcPromoDiscount,avoirPayment,settings.pricingMode]);

  // ══ CHECKOUT — API ou fallback local ══
  // H3 fix: mutex to prevent race conditions in offline checkout
  const checkoutLock=useRef(false);
  const _doCheckoutRef=useRef(null);
  const checkout=useCallback(async(payments,sellerName)=>{
    if(!cart.length)return null;
    if(checkoutLock.current){notify("Vente en cours de traitement...","warn");return null;}
    checkoutLock.current=true;
    try{return await _doCheckoutRef.current(payments,sellerName);}finally{checkoutLock.current=false;}
  },[cart,notify]);
  const _doCheckout=useCallback(async(payments,sellerName)=>{
    if(!cart.length)return null;
    const pm=settings.pricingMode||"TTC";
    const items=cart.map(i=>{
      const rawPrice=i.discountType==="amount"?i.product.price*i.quantity-((i.discount||0)*i.quantity):i.product.price*i.quantity*(1-i.discount/100);
      const lineHT=pm==="TTC"?rawPrice/(1+(i.product.taxRate||0.20)):rawPrice;
      const lineTVA=lineHT*(i.product.taxRate||0.20);
      const lineTTC=lineHT+lineTVA;
      return{
      product_id:i.isCustom?null:i.product.id,variant_id:i.isCustom?null:i.variant?.id,
      product_name:i.product.name,variant_color:i.variant?.color||"—",variant_size:i.variant?.size||"—",
      quantity:i.quantity,unit_price:pm==="TTC"?i.product.price/(1+(i.product.taxRate||0.20)):i.product.price,cost_price:pm==="TTC"?(i.product.costPrice||0)/(1+(i.product.taxRate||0.20)):i.product.costPrice||0,
      tax_rate:i.product.taxRate||0.20,discount_percent:i.discountType==="amount"?0:i.discount||0,discount_amount:i.discountType==="amount"?(i.discount||0)*i.quantity:0,is_custom:i.isCustom||false,
      lineHT,lineTVA,lineTTC,
      product:{id:i.product.id,name:i.product.name,sku:i.product.sku,price:i.product.price,costPrice:i.product.costPrice,taxRate:i.product.taxRate,collection:i.product.collection,category:i.product.category},
      variant:i.variant?{id:i.variant.id,color:i.variant.color,size:i.variant.size}:null,
      discount:i.discount||0
    };});
    const sHT=items.reduce((s,i)=>s+i.lineHT,0);
    let gd=gDiscType==="percentage"?sHT*(gDisc/100):Math.min(gDisc,sHT);
    const{promoDisc,applied}=calcPromoDiscount(cart);
    gd+=promoDisc;gd=Math.min(gd,sHT);
    const tHT=sHT-gd;
    // NF525: distribuer la remise globale proportionnellement par taux de TVA
    const discountRatio=sHT>0?(gd/sHT):0;
    // M4 fix: round TVA per line to avoid cumulative rounding errors (NF525)
    let tTVA=0;
    items.forEach(i=>{
      const adjHT=i.lineHT*(1-discountRatio);
      tTVA+=Math.round(adjHT*(i.tax_rate||i.product?.taxRate||0.20)*100)/100;
    });
    const tTTC=Math.max(0,Math.round((tHT+tTVA-avoirPayment)*100)/100);

    // ── TPE: charge card payments via hardware terminal BEFORE finalizing ──
    const cardMethods=['card','amex','contactless'];
    for(const p of payments){
      if(cardMethods.includes(p.method)&&p.amount>0){
        try{
          const ref=`CP-${Date.now()}`;
          // Race between charge and a 3-min safety timeout
          const result=await Promise.race([
            hardwareManager.charge(p.amount,{currency:'EUR',reference:ref,method:p.method}),
            new Promise(r=>setTimeout(()=>r({success:false,status:'cancelled',error:'Timeout TPE (3min)'}),180000))
          ]);
          if(result&&result.success){
            p.authCode=result.authCode||'';p.transactionId=result.transactionId||'';
            p.cardType=result.cardType||p.method;p.maskedPan=result.maskedPan||'';
          }else{
            // Payment failed, cancelled or timed out
            const errMsg=result?.error||(result?.status==='cancelled'?'Paiement annule':'Paiement refuse');
            notify(errMsg,"warn");return null;
          }
        }catch(e){
          console.error('[Payment] TPE charge error:',e);
          notify("Erreur TPE: "+e.message,"danger");return null;
        }
      }
    }

    // ── Avoir: compute remaining but consume AFTER API success ──
    let avoirRemainingAfterSale=null;
    if(selectedAvoir&&selectedAvoir.applied>0){
      avoirRemainingAfterSale=Math.max(0,(selectedAvoir.remaining||0)-selectedAvoir.applied);
    }

    // Essai API d'abord
    try{
      const ticket=await API.sales.checkout({
        items:items.map(({product,variant,...rest})=>rest),payments,customerId:selCust?.id||null,
        globalDiscount:gd,saleNote:saleNote||null,
        promosApplied:applied,sessionId:cashReg?.id||null,
        sellerName:sellerName||null,
        trainingMode:trainingMode||false,
        avoirUsed:selectedAvoir?{avoirNumber:selectedAvoir.avoirNumber,amount:selectedAvoir.applied,remainingAfter:avoirRemainingAfterSale}:null
      });
      // ── Vente CRÉÉE en backend — les appels suivants ne doivent PAS déclencher le fallback offline ──
      // Consume avoir (non-bloquant — échec ne doit pas invalider la vente)
      try{if(selectedAvoir&&selectedAvoir.applied>0){await consumeAvoir(selectedAvoir.avoirNumber,selectedAvoir.applied);}}
      catch(avoirErr){console.warn("Avoir consume failed (sale OK):",avoirErr.message);}
      // Rafraîchir les produits (stock) — non-bloquant
      try{const prods=await API.products.list();setProducts(norm.products(prods));}
      catch(prodErr){console.warn("Products refresh failed (sale OK):",prodErr.message);}
      // FE-12: use Math.round for consistency between add (checkout) and deduct (return)
      if(selCust){setCustomers(prev=>prev.map(c=>c.id===selCust.id?{...c,points:(c.points||0)+Math.round(parseFloat(ticket.totalTTC)),totalSpent:(c.totalSpent||0)+parseFloat(ticket.totalTTC)}:c));}
      setCart([]);setGDisc(0);setSelCust(null);setPromoCode("");setSelectedAvoir(null);setSaleNote("");
      setTSeq(ticket.seq);setLastHash(ticket.hash);setGt(parseFloat(ticket.grandTotal));
      const fullTicket={...ticket,items:ticket.items||items,payments:ticket.payments||payments,
        date:ticket.createdAt||ticket.date,userName:currentUser?.name,
        storeName:currentStore?.name||null,storeId:currentStore?.id||null,
        totalHT:ticket.totalHT||parseFloat(ticket.total_ht)||tHT,totalTVA:ticket.totalTVA||parseFloat(ticket.total_tva)||tTVA,
        totalTTC:ticket.totalTTC||parseFloat(ticket.total_ttc)||tTTC,paymentMethod:ticket.paymentMethod||(payments.length===1?payments[0].method:"MIXTE"),
        customerName:selCust?`${selCust.firstName||selCust.first_name} ${selCust.lastName||selCust.last_name}`:null,
        avoirUsed:selectedAvoir?{avoirNumber:selectedAvoir.avoirNumber,amount:selectedAvoir.applied,remainingAfter:avoirRemainingAfterSale}:null};
      setTickets(prev=>[fullTicket,...prev]);
      notify("Vente enregistrée","success");return fullTicket;
    }catch(e){
      // Fallback local
      console.warn("Checkout API échoué, mode local:",e.message);
      const seq=tSeq+1;const date=new Date().toISOString();
      const ticketNumber=`TK-${new Date().getFullYear()}-${String(seq).padStart(6,"0")}`;
      const paymentMethod=payments.length===1?payments[0].method:"MIXTE";
      const margin=cart.reduce((s,i)=>{const netRevenue=i.discountType==="amount"?i.product.price*i.quantity-((i.discount||0)*i.quantity):i.product.price*i.quantity*(1-i.discount/100);return s+(netRevenue-i.product.costPrice*i.quantity);},0)*(tHT/sHT||0);
      // Décrémenter stock local (autorise négatif)
      setProducts(prev=>prev.map(p=>{const ci=cart.find(c=>c.product.id===p.id);if(!ci)return p;
        return{...p,variants:p.variants.map(v=>{const cv=cart.find(c=>c.product.id===p.id&&c.variant?.id===v.id);
          return cv?{...v,stock:v.stock-cv.quantity}:v;})};}));
      // Fidélité
      // FE-12: use Math.round for consistency between add (checkout) and deduct (return)
      if(selCust){setCustomers(prev=>prev.map(c=>c.id===selCust.id?{...c,points:(c.points||0)+Math.round(tTTC),totalSpent:(c.totalSpent||0)+tTTC}:c));}
      // NF525: SHA-256 hash chain conforme — inclut ID caisse, type entrée, N° séquence
      const caisseId=currentStore?.id||cashReg?.id||"CAISSE-01";
      const hashInput=`${lastHash}|${seq}|VENTE|${caisseId}|${ticketNumber}|${date}|${tTTC.toFixed(2)}|${(gt+tTTC).toFixed(2)}`;
      const hash=await sha256(hashInput);
      const fingerprint=hash.slice(0,16).toUpperCase();
      const offlineBarcode=generateEAN13("200",Date.now()%1000000000);
      const ticket={ticketNumber,seq,date,items,payments,paymentMethod,barcode:offlineBarcode,
        totalHT:tHT,totalTVA:tTVA,totalTTC:tTTC,globalDiscount:gd,margin,
        hash,fingerprint,grandTotal:gt+tTTC,promosApplied:applied,
        saleNote:saleNote||null,userName:currentUser?.name,sellerName:sellerName||currentUser?.name,
        storeName:currentStore?.name||null,storeId:currentStore?.id||null,
        customerId:selCust?.id,customerName:selCust?`${selCust.firstName} ${selCust.lastName}`:null,
        avoirUsed:selectedAvoir?{avoirNumber:selectedAvoir.avoirNumber,amount:selectedAvoir.applied,remainingAfter:avoirRemainingAfterSale}:null,
        // NF525: marqueur mode formation
        ...(trainingMode?{trainingMode:true,ticketNumber:`FACTICE-${ticketNumber}`}:{})};
      setTSeq(seq);setLastHash(hash);
      // NF525: ne PAS incrémenter le GT en mode formation
      if(!trainingMode)setGt(g=>g+tTTC);
      setTickets(prev=>[ticket,...prev]);
      setCart([]);setGDisc(0);setSelCust(null);setPromoCode("");setSelectedAvoir(null);setSaleNote("");
      // FE-10: per-article stock movements instead of 1 global entry
      cart.forEach(i=>{if(!i.isCustom)addStockMove("VENTE",{name:i.product.name,sku:i.product.sku||"—"},{color:i.variant?.color||"—",size:i.variant?.size||"—"},-i.quantity,ticket.ticketNumber);});
      // Queue offline sale for sync when back online
      addPendingSync({type:"offlineSale",data:{
        items:items.map(({product,variant,...rest})=>rest),payments,customerId:selCust?.id||null,
        globalDiscount:gd,saleNote:saleNote||null,promosApplied:applied,sessionId:cashReg?.id||null,
        offlineTicketNumber:ticketNumber,offlineDate:date
      }});
      // Consume avoir locally + queue for sync (avoir not consumed yet in offline mode)
      if(selectedAvoir&&selectedAvoir.applied>0){await consumeAvoir(selectedAvoir.avoirNumber,selectedAvoir.applied);}
      notify("Vente enregistrée (hors-ligne) — synchro en attente","warn");return ticket;
    }
  },[cart,gDisc,gDiscType,currentUser,selCust,calcPromoDiscount,promoCode,saleNote,cashReg,tSeq,gt,lastHash,avoirPayment,selectedAvoir,consumeAvoir,addStockMove,notify,settings.pricingMode,addPendingSync,trainingMode,currentStore,hardwareManager]);
  _doCheckoutRef.current=_doCheckout;

  // Stock receipt - via API
  const receiveStock=useCallback(async(productId,variantId,qty,supplier)=>{
    try{await API.stock.receive({productId,variantId,quantity:qty,supplier});
      const prods=await API.products.list();
      setProducts(norm.products(prods));
      addAudit("RECEPTION",`+${qty} — ${supplier}`);}catch(e){notify("Erreur: "+e.message,"error");}
  },[addAudit]);

  // Stock batch receipt - via API
  const receiveBatchStock=useCallback(async(items,supplier)=>{
    try{const res=await API.stock.receiveBatch({items,supplier});
      const prods=await API.products.list();
      setProducts(norm.products(prods));
      const totalQty=items.reduce((s,i)=>s+i.quantity,0);
      addAudit("RECEPTION_BATCH",`Réassort: ${items.length} réf, ${totalQty} pièces — ${supplier||"N/A"}`);
      return res;}catch(e){notify("Erreur: "+e.message,"error");throw e;}
  },[addAudit,notify]);

  // ══ P2: Clock in/out — via API ══
  const clockIn=useCallback(async()=>{try{await API.auth.clock("IN");addAudit("CLOCK_IN",`${currentUser?.name} a pointé`);}catch(e){console.error(e);}},[currentUser,addAudit]);
  const clockOut=useCallback(async()=>{try{await API.auth.clock("OUT");addAudit("CLOCK_OUT",`${currentUser?.name} a pointé`);}catch(e){console.error(e);}},[currentUser,addAudit]);

  // ══ P2: Verify hash chain — via API ══
  const verifyChain=useCallback(async()=>{
    try{return await API.fiscal.verifyChain();}catch(e){
      // Fallback local: vérifier la chaîne en mémoire
      const sorted=[...tickets].filter(t=>t.seq&&t.hash).sort((a,b)=>(a.seq||0)-(b.seq||0));
      if(!sorted.length)return{valid:true,message:"Aucun ticket à vérifier (hors-ligne)",count:0};
      for(let i=1;i<sorted.length;i++){
        const prev=sorted[i-1];const cur=sorted[i];
        if(cur.previousHash&&prev.hash&&cur.previousHash!==prev.hash){
          return{valid:false,message:`Rupture de chaîne au ticket ${cur.ticketNumber} (seq ${cur.seq}) — vérification locale`,brokenAt:i};
        }
      }
      return{valid:true,message:`Chaîne intègre (locale) — ${sorted.length} tickets vérifiés`,count:sorted.length};
    }
  },[tickets]);

  const exportCSVReport=useCallback((data,filename)=>{
    const csv=Papa.unparse(data);const b=new Blob([csv],{type:"text/csv"});const u=URL.createObjectURL(b);
    const a=document.createElement("a");a.href=u;a.download=filename;a.click();
  },[]);

  // ══ P2: Export product catalog — via API ══
  const exportCatalog=useCallback(async()=>{
    const rows=[];products.forEach(p=>(p.variants||[]).forEach(v=>{
      rows.push({name:p.name,sku:p.sku,price:p.price,costPrice:p.costPrice,taxRate:p.taxRate,
        category:p.category,collection:p.collection,color:v.color,size:v.size,ean:v.ean,stock:v.stock});}));
    exportCSVReport(rows,`catalogue-${new Date().toISOString().split("T")[0]}.csv`);
  },[products,exportCSVReport]);

  // ══ P2: Update product price with history ══
  const updateProductPrice=useCallback(async(productId,newPrice)=>{
    const p=products.find(x=>x.id===productId);if(!p)return;
    const entry={productId,productName:p.name,oldPrice:p.price,newPrice,user:currentUser?.name};
    // Persister en backend d'abord
    try{await API.pricehistory.create({productId,oldPrice:p.price,newPrice,reason:`Changement manuel par ${currentUser?.name||"?"}`});}
    catch(e){addPendingSync({type:"priceChange",data:{productId,oldPrice:p.price,newPrice,reason:`Changement manuel par ${currentUser?.name||"?"}`}});}
    setPriceHistory(prev=>[{id:Date.now(),date:new Date().toISOString(),...entry},...prev]);
    setProducts(prev=>prev.map(x=>x.id===productId?{...x,price:newPrice}:x));
    addAudit("PRICE_CHANGE",`${p.name}: ${p.price.toFixed(2)}EUR -> ${newPrice.toFixed(2)}EUR`);
  },[products,currentUser,addAudit,addPendingSync]);

  // ══ P2: Reorder suggestions ══
  const reorderSuggestions=useMemo(()=>{const suggestions=[];
    products.forEach(p=>p.variants.forEach(v=>{
      if(v.stock<=(v.stockAlert||5)){suggestions.push({product:p,variant:v,currentStock:v.stock,suggestedQty:Math.max(10,(v.stockAlert||5)*3-v.stock)});}}));
    return suggestions;},[products]);

  // ══ P2: Toggle favorite ══
  const toggleFavorite=useCallback((productId)=>{setFavorites(p=>p.includes(productId)?p.filter(x=>x!==productId):[...p,productId]);},[]);

  // ══ P2: TVA summary — utilise les montants pré-calculés si disponibles ══
  const tvaSummary=useMemo(()=>{const byRate={};
    tickets.forEach(t=>{
      const gd=t.globalDiscount||0;const tHT=t.totalHT||0;const rawHT=(t.items||[]).reduce((s,i)=>s+(i.lineHT||i.line_ht||0),0);
      const discRatio=rawHT>0?gd/rawHT:0;
      (t.items||[]).forEach(i=>{
        const taxR=i.product?.taxRate||i.tax_rate||0.20;const r=(taxR*100).toFixed(1)+"%";
        if(!byRate[r])byRate[r]={rate:r,baseHT:0,tva:0};
        // Utiliser lineHT pré-calculé (déjà correct pour TTC/HT) puis appliquer la remise globale proportionnellement
        const lHT=(i.lineHT||i.line_ht||0)*(1-discRatio);
        byRate[r].baseHT+=lHT;byRate[r].tva+=lHT*taxR;});});
    return Object.values(byRate);},[tickets]);

  // ══ P2: Stock aging ══
  const stockAging=useMemo(()=>{
    return products.map(p=>{const totalStock=p.variants.reduce((s,v)=>s+v.stock,0);
      const totalValue=totalStock*p.costPrice;const lastSale=tickets.find(t=>(t.items||[]).some(i=>(i.product?.id||i.product_id)===p.id));
      const daysSinceLastSale=lastSale?Math.floor((Date.now()-new Date(lastSale.date||lastSale.createdAt||lastSale.created_at).getTime())/(1000*60*60*24)):999;
      return{...p,totalStock,totalValue,daysSinceLastSale};}).filter(p=>p.totalStock>0).sort((a,b)=>b.daysSinceLastSale-a.daysSinceLastSale);
  },[products,tickets]);

  // ══ P3: Duplicate product — via API ══
  const duplicateProduct=useCallback(async(productId)=>{
    try{await API.products.duplicate(productId);
      const prods=await API.products.list();setProducts(norm.products(prods));}catch(e){notify("Erreur: "+e.message,"error");}
  },[]);

  // ══ P3: Sales goals by seller ══
  const[salesGoals,setSalesGoals]=useState({});
  const setSellerGoal=useCallback((userName,goal)=>{setSalesGoals(p=>({...p,[userName]:goal}));},[]);

  // Best sellers
  const bestSellers=useMemo(()=>{const m={};tickets.forEach(t=>(t.items||[]).forEach(i=>{
    const k=i.product?.sku||i.product_name;if(!m[k])m[k]={name:i.product?.name||i.product_name,sku:k,qty:0,revenue:0,margin:0};
    m[k].qty+=i.quantity;m[k].revenue+=(i.lineTTC||i.line_ttc||0);m[k].margin+=((i.lineHT||i.line_ht||0)-(i.product?.costPrice||i.cost_price||0)*i.quantity);}));
    return Object.values(m).sort((a,b)=>b.qty-a.qty);},[tickets]);

  // Sales by seller
  const salesBySeller=useMemo(()=>{const m={};tickets.forEach(t=>{
    const n=t.sellerName||t.seller_name||t.userName||t.user_name||"?";if(!m[n])m[n]={name:n,count:0,revenue:0,margin:0,totalItems:0,customers:new Set()};
    m[n].count++;m[n].revenue+=(t.totalTTC||parseFloat(t.total_ttc)||0);m[n].margin+=(parseFloat(t.margin)||0);
    m[n].totalItems+=(t.items||[]).reduce((s,i)=>s+i.quantity,0);
    if(t.customerId||t.customer_id)m[n].customers.add(t.customerId||t.customer_id);});
    return Object.values(m).map(s=>({...s,avgBasket:s.count?s.revenue/s.count:0,avgItems:s.count?s.totalItems/s.count:0,
      uniqueCustomers:s.customers.size,itemsPerCustomer:s.customers.size?s.totalItems/s.customers.size:0}))
      .sort((a,b)=>b.revenue-a.revenue);},[tickets]);

  // Sales by size/color
  const salesByVariant=useMemo(()=>{const bySize={},byColor={};tickets.forEach(t=>(t.items||[]).forEach(i=>{
    const s=i.variant?.size||i.variant_size||"?";const c=i.variant?.color||i.variant_color||"?";
    bySize[s]=(bySize[s]||0)+i.quantity;byColor[c]=(byColor[c]||0)+i.quantity;}));
    return{bySize:Object.entries(bySize).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({name:k,qty:v})),
      byColor:Object.entries(byColor).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({name:k,qty:v}))};
  },[tickets]);

  // CA evolution (by day)
  const caEvolution=useMemo(()=>{const m={};tickets.forEach(t=>{
    const d=new Date(t.date||t.createdAt||t.created_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"});
    m[d]=(m[d]||0)+(t.totalTTC||parseFloat(t.total_ttc)||0);});
    return Object.entries(m).reverse().map(([d,v])=>({date:d,ca:Math.round(v*100)/100}));},[tickets]);

  // Sales by collection
  const salesByCollection=useMemo(()=>{const m={};tickets.forEach(t=>(t.items||[]).forEach(i=>{
    const col=i.product?.collection||"Sans collection";if(!m[col])m[col]={name:col,qty:0,revenue:0,margin:0};
    m[col].qty+=i.quantity;m[col].revenue+=(i.lineTTC||i.line_ttc||0);m[col].margin+=((i.lineHT||i.line_ht||0)-(i.product?.costPrice||i.cost_price||0)*i.quantity);}));
    return Object.values(m).sort((a,b)=>b.revenue-a.revenue);},[tickets]);

  // ══ P3: Commission calculation (5% of margin) ══
  const commissions=useMemo(()=>{
    return salesBySeller.map(s=>{const commRate=settings.commissionRates?.[s.name]||settings.defaultCommissionRate||0.05;
      return{...s,commissionRate:commRate,commission:s.margin*commRate,goal:salesGoals[s.name]||0,
      goalProgress:salesGoals[s.name]?(s.revenue/salesGoals[s.name]*100):0};});
  },[salesBySeller,salesGoals,settings]);

  // ══ P3: Last price paid by customer ══
  const getLastPriceForCustomer=useCallback((customerId,productId)=>{
    const t=tickets.find(t=>t.customerId===customerId&&(t.items||[]).some(i=>(i.product?.id||i.product_id)===productId));
    if(!t)return null;const item=(t.items||[]).find(i=>(i.product?.id||i.product_id)===productId);
    return item?(item.lineTTC||item.line_ttc||0)/item.quantity:null;
  },[tickets]);

  // ══ P3: Theme customization ══
  const[theme,setTheme]=useState({primaryColor:C.primary,accentColor:C.accent});

  // Closures — via API
  const createClosure=useCallback(async(type,aCash,aCard)=>{
    try{const cl=await API.fiscal.closure({type,actualCash:aCash,actualCard:aCard});
      if(!cl||cl.error){throw new Error(cl?.error||"Réponse invalide du serveur");}
      setClosures(p=>[cl,...p]);
      if(cl.grandTotal)setGt(parseFloat(cl.grandTotal));
      addAudit("CLOTURE",`Z ${type}`);notify("Clôture enregistrée","success");return cl;}catch(e){
      // Fallback local
      console.warn("Closure API failed, local fallback:",e.message);
      const today=new Date().toISOString().split("T")[0];
      const pt=tickets.filter(t=>(t.date||t.createdAt||t.created_at||"").startsWith(today));
      const cash=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="cash").reduce((a,p)=>a+p.amount,0)||0),0);
      const card=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="card").reduce((a,p)=>a+p.amount,0)||0),0);
      const totalTTC=pt.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0);
      const totalHT=pt.reduce((s,t)=>s+(t.totalHT||parseFloat(t.total_ht)||0),0);
      const totalTVA=pt.reduce((s,t)=>s+(t.totalTVA||parseFloat(t.total_tva)||0),0);
      const totalMargin=pt.reduce((s,t)=>s+(parseFloat(t.margin)||0),0);
      const newGt=gt+totalTTC;
      // NF525: SHA-256 hash chain pour clôtures
      const lastClosureHash=closures.length>0?(closures[0].hash||closures[0].fingerprint||""):"0".repeat(64);
      const clDate=new Date().toISOString();
      const hashInput=`${lastClosureHash}|Z-${type}|${today}|${totalTTC.toFixed(2)}|${newGt.toFixed(2)}|${pt.length}`;
      const clHash=await sha256(hashInput);
      const clFingerprint=clHash.slice(0,16).toUpperCase();
      // Paiements par méthode
      const chequeLocal=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="cheque").reduce((a,p)=>a+p.amount,0)||0),0);
      const giftcardLocal=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="giftcard").reduce((a,p)=>a+p.amount,0)||0),0);
      const amexLocal=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="amex").reduce((a,p)=>a+p.amount,0)||0),0);
      const avoirLocal=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="avoir").reduce((a,p)=>a+p.amount,0)||0),0);
      const cl={id:`cl-${Date.now()}`,type,period:today,date:clDate,
        ticketCount:pt.length,totalHT,totalTVA,totalTTC,totalMargin,
        expectedCash:(cashReg?.openingAmount||0)+cash,actualCash:aCash,actualCard:aCard,
        grandTotal:newGt,userName:currentUser?.name,
        hash:clHash,fingerprint:clFingerprint,
        byPayment:{cash,card,cheque:chequeLocal,giftcard:giftcardLocal,amex:amexLocal,avoir:avoirLocal},
        bySeller:pt.reduce((m,t)=>{const n=t.userName||"?";m[n]=(m[n]||0)+(t.totalTTC||0);return m;},{})};
      setClosures(p=>[cl,...p]);setGt(newGt);addAudit("CLOTURE",`Z ${type} (local)`);
      addPendingSync({type:"offlineClosure",data:{type,actualCash:aCash,actualCard:aCard,offlineId:cl.id,offlineDate:clDate}});
      notify("Clôture enregistrée (hors-ligne) — synchro en attente","warn");return cl;
    }
  },[addAudit,tickets,closures,gt,cashReg,currentUser,notify,addPendingSync]);

  // Exports — via API
  const exportFEC=useCallback(async()=>{try{await API.fiscal.fec();addJET("EXPORT","Export FEC");addAudit("FEC","Export fichier FEC");}catch(e){notify("Erreur: "+e.message,"error");}},[notify,addJET,addAudit]);

  const exportArchive=useCallback(async()=>{
    // Tenter l'export via API d'abord
    try{await API.fiscal.archive();addJET("ARCHIVE","Export archive fiscale NF525 (serveur)");addAudit("EXPORT","Export archive fiscale NF525");return;}catch(e){console.warn("Archive API échoué, export local NF525:",e.message);}
    // Fallback: archive locale NF525 conforme — 10 fichiers CSV dans un ZIP
    const socId=(settings.siret||CO.siret||"").replace(/\s/g,"");
    const caisseId=currentStore?.id||cashReg?.id||"01";
    const today=new Date().toISOString().split("T")[0].replace(/-/g,"");
    const period="J";// Journalier
    const prefix=`Archive_NF525_${socId}_${caisseId}_${period}_${today}`;
    // 1. Entete (ticket headers)
    const entete=tickets.map(t=>({
      NUM_TICKET:t.ticketNumber||t.ticket_number,SEQ:t.seq,DATE:t.date||t.createdAt,
      TYPE:"VENTE",ID_CAISSE:caisseId,ID_SOC:socId,
      TOTAL_HT:(t.totalHT||parseFloat(t.total_ht)||0).toFixed(2),
      TOTAL_TVA:(t.totalTVA||parseFloat(t.total_tva)||0).toFixed(2),
      TOTAL_TTC:(t.totalTTC||parseFloat(t.total_ttc)||0).toFixed(2),
      REMISE_GLOBALE:(t.globalDiscount||0).toFixed(2),
      MODE_PAIEMENT:t.paymentMethod||"",VENDEUR:t.sellerName||t.seller_name||t.userName||"",
      CLIENT:t.customerName||"",CLIENT_ID:t.customerId||"",
      NOTE:t.saleNote||"",HASH:t.hash||"",EMPREINTE:t.fingerprint||"",GT:(t.grandTotal||0).toFixed(2)}));
    // 2. Lignes (line items)
    const lignes=[];tickets.forEach(t=>(t.items||[]).forEach((i,idx)=>{
      lignes.push({NUM_TICKET:t.ticketNumber||t.ticket_number,LIGNE:idx+1,
        PRODUIT:i.product?.name||i.product_name||"",SKU:i.product?.sku||i.product_sku||"",
        VARIANTE_COULEUR:i.variant?.color||i.variant_color||"",VARIANTE_TAILLE:i.variant?.size||i.variant_size||"",
        EAN:i.variant?.ean||"",QUANTITE:i.quantity,
        PU_HT:((i.lineHT||i.line_ht||0)/i.quantity).toFixed(4),TAUX_TVA:((i.tax_rate||i.product?.taxRate||0.20)*100).toFixed(2),
        REMISE_LIGNE:(i.discount_amount||0).toFixed(2),REMISE_PCT:(i.discount_percent||0).toFixed(2),
        TOTAL_HT:(i.lineHT||i.line_ht||0).toFixed(2),TOTAL_TVA:(i.lineTVA||i.line_tva||0).toFixed(2),
        TOTAL_TTC:(i.lineTTC||i.line_ttc||0).toFixed(2)});}));
    // 3. TVA (breakdown par taux)
    const tvaRows=[];tickets.forEach(t=>{const byRate={};(t.items||[]).forEach(i=>{
      const r=((i.tax_rate||i.product?.taxRate||0.20)*100).toFixed(1);
      if(!byRate[r])byRate[r]={ht:0,tva:0};byRate[r].ht+=(i.lineHT||i.line_ht||0);byRate[r].tva+=(i.lineTVA||i.line_tva||0);});
      Object.entries(byRate).forEach(([rate,v])=>{tvaRows.push({NUM_TICKET:t.ticketNumber||t.ticket_number,TAUX:rate,BASE_HT:v.ht.toFixed(2),MONTANT_TVA:v.tva.toFixed(2)});});});
    // 4. Pied (ticket footers/totals)
    const pieds=tickets.map(t=>({
      NUM_TICKET:t.ticketNumber||t.ticket_number,TOTAL_HT:(t.totalHT||0).toFixed(2),TOTAL_TVA:(t.totalTVA||0).toFixed(2),
      TOTAL_TTC:(t.totalTTC||0).toFixed(2),REMISE:(t.globalDiscount||0).toFixed(2),
      NB_ARTICLES:(t.items||[]).reduce((s,i)=>s+i.quantity,0),GT:(t.grandTotal||0).toFixed(2),
      HASH:t.hash||"",EMPREINTE:t.fingerprint||""}));
    // 5. Clients
    const clientRows=customers.map(c=>({ID:c.id,NOM:`${c.firstName||""} ${c.lastName||""}`.trim(),
      EMAIL:c.email||"",TELEPHONE:c.phone||"",VILLE:c.city||"",POINTS:c.points||0,TOTAL_DEPENSE:(c.totalSpent||0).toFixed(2)}));
    // 6. Règlements (payments)
    const reglements=[];tickets.forEach(t=>(t.payments||[]).forEach((p,idx)=>{
      reglements.push({NUM_TICKET:t.ticketNumber||t.ticket_number,LIGNE:idx+1,MODE:p.method,MONTANT:p.amount.toFixed(2),
        CODE_AUTH:p.authCode||"",REF_TRANSACTION:p.transactionId||"",TYPE_CARTE:p.cardType||"",PAN_MASQUE:p.maskedPan||""});}));
    // 7. Duplicata (reprints)
    const duplicata=audit.filter(a=>a.action==="DUPLICATA").map(a=>({DATE:a.date,DETAIL:a.detail,UTILISATEUR:a.user}));
    // 8. JET
    const jetRows=jet.map(j=>({ID:j.id,SEQ:j.seq||"",DATE:j.date,CODE_JET:j.codeJet||"",TYPE:j.type,
      DESCRIPTIF:j.detail,UTILISATEUR:j.userName||j.user||"",ID_SOC:j.socId||socId,ID_CAISSE:j.caisseId||caisseId,
      HASH:j.hash||"",EMPREINTE:j.fingerprint||""}));
    // 9. GTT (grand ticket totals — cumul par ticket)
    const gttRows=tickets.map(t=>({NUM_TICKET:t.ticketNumber||t.ticket_number,SEQ:t.seq,DATE:t.date||t.createdAt,
      TOTAL_TTC:(t.totalTTC||0).toFixed(2),GT_CUMULE:(t.grandTotal||0).toFixed(2)}));
    // 10. GTJ (grand total journalier)
    const byDay={};tickets.forEach(t=>{const d=(t.date||t.createdAt||"").slice(0,10);if(!byDay[d])byDay[d]={ttc:0,count:0};
      byDay[d].ttc+=(t.totalTTC||parseFloat(t.total_ttc)||0);byDay[d].count++;});
    const gtjRows=Object.entries(byDay).sort().map(([d,v])=>({DATE:d,NB_TICKETS:v.count,TOTAL_TTC:v.ttc.toFixed(2)}));

    // Générer les CSVs et empaqueter
    const files=[
      {name:`Entete_${period}_${today}.csv`,data:entete},
      {name:`Lignes_${period}_${today}.csv`,data:lignes},
      {name:`TVA_${period}_${today}.csv`,data:tvaRows},
      {name:`Pied_${period}_${today}.csv`,data:pieds},
      {name:`Client_${period}_${today}.csv`,data:clientRows},
      {name:`Reglements_${period}_${today}.csv`,data:reglements},
      {name:`Duplicata_${period}_${today}.csv`,data:duplicata},
      {name:`JET_${period}_${today}.csv`,data:jetRows},
      {name:`GTT_${period}_${today}.csv`,data:gttRows},
      {name:`GTJ_${period}_${today}.csv`,data:gtjRows},
    ];
    // NF-D3: Archive ZIP avec intégrité SHA-256 + HMAC
    const JSZip=(await import("jszip")).default;
    const zip=new JSZip();
    const csvFolder=zip.folder("data");
    files.forEach(f=>{csvFolder.file(f.name,Papa.unparse(f.data));});
    // Métadonnées
    const meta={format:"NF525_ARCHIVE",version:CO.ver,socId,caisseId,period,date:today,
      generatedAt:new Date().toISOString(),ticketCount:tickets.length,gt:gt.toFixed(2),
      files:files.map(f=>f.name)};
    zip.file("meta.json",JSON.stringify(meta,null,2));
    // Intégrité: SHA-256 du contenu sérialisé
    const archiveContent=JSON.stringify({meta,files:Object.fromEntries(files.map(f=>[f.name,Papa.unparse(f.data)]))});
    const integrityHash=await sha256(archiveContent);
    zip.file("integrity.json",JSON.stringify({sha256:integrityHash,algorithm:"SHA-256",generatedAt:meta.generatedAt},null,2));
    const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=url;a.download=`${prefix}.zip`;a.click();
    addJET("ARCHIVE",`Archive NF525 locale — ${tickets.length} tickets — GT: ${gt.toFixed(2)}€`);
    addAudit("EXPORT","Export archive NF525 locale");
    notify(`Archive NF525 exportée (${tickets.length} tickets)`,"success");
  },[tickets,customers,audit,jet,closures,gt,settings,currentStore,cashReg,notify,addJET,addAudit]);

  // Customer RGPD export — via API
  const exportCustomerRGPD=useCallback(async(custId)=>{
    try{const data=await API.customers.rgpd(custId);
      const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);
      const a=document.createElement("a");a.href=u;a.download=`rgpd-export.json`;a.click();}catch(e){notify("Erreur: "+e.message,"error");}
  },[notify]);

  // Loyalty tier for customer
  const getLoyaltyTier=useCallback((points)=>{
    const tiers=settings.loyaltyTiers||LOYALTY_TIERS;
    let tier=tiers[0];tiers.forEach(t=>{if(points>=t.minPoints)tier=t;});return tier;
  },[settings]);

  // Alerts
  const stockAlerts=useMemo(()=>{const a=[];products.forEach(p=>p.variants.forEach(v=>{
    if(v.stock<=0)a.push({product:p,variant:v,level:"rupture"});
    else if(v.stock<=(v.stockAlert||5))a.push({product:p,variant:v,level:"bas"});}));return a;},[products]);

  // Dynamic categories: merge defaults + custom from settings + from products
  const allCategories=useMemo(()=>{
    const customCats=(settings.customCategories||[]).map(c=>c.name);
    const productCats=[...new Set(products.map(p=>p.category).filter(Boolean))];
    const base=defaultCategories.filter(c=>c!=="Tous");
    const merged=["Tous",...new Set([...base,...customCats,...productCats])];
    return merged;
  },[settings.customCategories,products]);

  // Find by EAN
  const findByEAN=useCallback((ean)=>{for(const p of products)for(const v of p.variants)if(v.ean===ean)return{product:p,variant:v};return null;},[products]);

  // Barcode scanner auto-start — use refs to avoid re-subscribing on every cart change
  const addToCartRef=useRef(addToCart);addToCartRef.current=addToCart;
  const findByEANRef=useRef(findByEAN);findByEANRef.current=findByEAN;
  const notifyRef=useRef(notify);notifyRef.current=notify;
  const ticketsRef=useRef(tickets);ticketsRef.current=tickets;
  const retoucheBonsRef=useRef(retoucheBons);retoucheBonsRef.current=retoucheBons;
  const avoirsRef=useRef(avoirs);avoirsRef.current=avoirs;
  const tenuesRef=useRef(tenues);tenuesRef.current=tenues;
  const[scanBarcode,setScanBarcode]=useState(null);
  // ══ Scan override: screens can register a callback to intercept barcode scans ══
  const scanOverrideRef=useRef(null);
  const setScanOverride=useCallback((fn)=>{scanOverrideRef.current=fn;},[]);
  const clearScanOverride=useCallback(()=>{scanOverrideRef.current=null;},[]);
  useEffect(()=>{const s=hardwareManager.scanner;if(!s)return;s.start();
    const off=s.onScan(code=>{
      // 0. If a screen has registered a scan override, delegate to it
      if(scanOverrideRef.current){scanOverrideRef.current(code);return;}
      // 1. Try product EAN
      const found=findByEANRef.current(code);
      if(found){addToCartRef.current(found.product,found.variant);notifyRef.current(found.product.name+" ajouté ("+code+")");return;}
      // 2. Try ticket/avoir/retouche barcode (EAN-13 starting with "200"/"201"/"203")
      // Only navigate to history if we're NOT on the sales screen (don't interrupt cart)
      const currentMode=sessionStorage.getItem("caissepro_mode")||"cashier";
      const tk=ticketsRef.current.find(t=>t.barcode===code);
      if(tk){
        if(currentMode==="cashier"){notifyRef.current(`Ticket ${tk.ticketNumber} — allez dans Historique pour le consulter`,"info");}
        else{setScanBarcode(code);notifyRef.current(`Ticket ${tk.ticketNumber} trouvé`,"info");setMode("history");}
        return;}
      const av=avoirsRef.current.find(a=>a.barcode===code);
      if(av){notifyRef.current(`Avoir ${av.avoirNumber||av.code} trouvé (${(av.remaining||av.totalTTC||0).toFixed(2)}€) — utilisez le bouton Avoir pour l'appliquer`,"info");return;}
      const rb=retoucheBonsRef.current.find(b=>b.barcode===code);
      if(rb){
        if(currentMode==="cashier"){notifyRef.current(`Bon retouche ${rb.num} — allez dans Historique pour le consulter`,"info");}
        else{setScanBarcode(code);notifyRef.current(`Bon retouche ${rb.num} trouvé`,"info");setMode("history");}
        return;}
      const tn=tenuesRef.current.find(t=>t.barcode===code);
      if(tn){setScanBarcode(code);notifyRef.current(`Bon tenue ${tn.num} — ${tn.employee}`,"info");return;}
      notifyRef.current("Code-barres inconnu: "+code,"error");
    });
    return()=>{s.stop();off();};},[]); // eslint-disable-line react-hooks/exhaustive-deps

  // ══ THERMAL PRINTER ══
  // Detect Sunmi device
  const isSunmi=useMemo(()=>{
    const ua=navigator.userAgent||"";
    return ua.includes("Sunmi")||typeof window.SunmiPOS!=="undefined"||typeof window.PrintService!=="undefined";
  },[]);
  const isAndroid=useMemo(()=>/Android/i.test(navigator.userAgent),[]);

  const printReceiptOnly=useCallback(()=>{
    const el=document.querySelector("[data-print-receipt]");
    if(!el){window.print();return;}
    // Use hidden iframe instead of popup (works on Android/Sunmi)
    let iframe=document.getElementById("__print_iframe");
    if(!iframe){iframe=document.createElement("iframe");iframe.id="__print_iframe";
      iframe.style.cssText="position:fixed;top:-9999px;left:-9999px;width:80mm;height:0;border:none;visibility:hidden;";
      document.body.appendChild(iframe);}
    const doc=iframe.contentDocument||iframe.contentWindow.document;
    doc.open();
    doc.write(`<html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;font-size:11px;padding:4px;width:72mm;max-width:72mm;color:#000}
      table{width:100%;border-collapse:collapse}td{padding:1px 0}
      .sep{border-top:1px dashed #000;margin:4px 0}
      @media print{@page{size:72mm auto;margin:2mm}body{padding:0}}
    </style></head><body>${el.innerHTML}</body></html>`);
    doc.close();
    setTimeout(()=>{try{iframe.contentWindow.focus();iframe.contentWindow.print();}catch(e){window.print();}},200);
  },[]);

  const thermalPrint=useCallback(async(type,data)=>{
    // NF525: tracer les duplicata (réimpressions de tickets validés)
    if(type==="receipt"&&data?.ticketNumber){
      addAudit("DUPLICATA",`Réimpression ticket ${data.ticketNumber}`,data.ticketNumber);
      addJET("DUPLICATA",`Duplicata ticket ${data.ticketNumber} — ${(data.totalTTC||0).toFixed(2)}€`);
    }
    const halPrinter=hardwareManager.printer;
    if(halPrinter&&!halPrinter.connected){
      try{await halPrinter.connect();if(halPrinter.connected){setPrinterConnected(true);setPrinterType(hwId);}}catch(e){console.warn('[HAL] printer auto-connect:',e);}
    }
    // Try HAL native printer first (Sunmi/PAX/iMin) — only for methods the HAL supports
    if(halPrinter&&halPrinter.connected){
      const halMethod=type==="receipt"?"printReceipt":type==="avoir"?"printAvoir":type==="giftcard"?"printGiftCard":type==="retouche"?"printRetouche":type==="tenue"?"printTenue":type==="register-open"?"printRegisterOpen":type==="register-close"?"printRegisterClose":type==="closure"?"printClosure":type==="test"?"testPrint":type==="drawer"?"openDrawer":null;
      if(halMethod&&typeof halPrinter[halMethod]==="function"){
        try{
          await halPrinter[halMethod](data,settings,CO);
          notify("Impression envoyee","success");return true;
        }catch(e){console.error("[HAL] print failed, falling back:",e.message||e);}
      }
    }
    // Try ESC/POS Web Serial/USB printer
    if(printer.connected){
      try{
        if(type==="receipt")await printer.printReceipt(data,settings,CO);
        else if(type==="avoir")await printer.printAvoir(data,settings,CO);
        else if(type==="giftcard")await printer.printGiftCard(data,settings,CO);
        else if(type==="retouche")await printer.printRetouche(data,settings,CO);
        else if(type==="tenue")await printer.printTenue(data,settings,CO);
        else if(type==="register-open")await printer.printRegisterOpen(data,settings,CO);
        else if(type==="register-close")await printer.printRegisterClose(data,settings,CO);
        else if(type==="closure")await printer.printClosure(data,settings,CO);
        else if(type==="test")await printer.testPrint();
        else if(type==="drawer")await printer.openDrawer();
        notify("Impression envoyee","success");return true;
      }catch(e){notify(e.message,"danger");}
    }
    // Fallback: browser print
    if(type==="receipt"){printReceiptOnly();return false;}
    if(type==="register-open"||type==="register-close"){
      // Generate HTML and print via popup — same approach as receipt tickets
      const d=data||{};const co=settings||{};
      const isOpen=type==="register-open";
      const title=isOpen?"OUVERTURE DE CAISSE":"FERMETURE DE CAISSE";
      let denomHtml="";
      if(isOpen&&d.denominations){
        const entries=Object.entries(d.denominations).filter(([,n])=>n>0).sort(([a],[b])=>parseFloat(b)-parseFloat(a));
        if(entries.length){denomHtml=`<div class="sep"></div><div style="font-weight:700;margin-bottom:3px;">DETAIL DES COUPURES</div>`+
          entries.map(([v,n])=>{const pv=parseFloat(v);const label=pv>=1?`${pv.toFixed(0)} EUR`:`${(pv*100).toFixed(0)} cts`;
            return`<div style="display:flex;justify-content:space-between;"><span>${label} x ${n}</span><span>${(pv*n).toFixed(2)} EUR</span></div>`;}).join("");}
      }
      let closeHtml="";
      if(!isOpen&&d){
        closeHtml=`<div class="sep"></div>`+
          (d.openingAmount!=null?`<div style="display:flex;justify-content:space-between;"><span>Fond de caisse</span><span>${parseFloat(d.openingAmount||0).toFixed(2)} EUR</span></div>`:"")+
          (d.totalCash!=null?`<div style="display:flex;justify-content:space-between;"><span>Especes encaissees</span><span>${parseFloat(d.totalCash||0).toFixed(2)} EUR</span></div>`:"")+
          (d.totalCard!=null?`<div style="display:flex;justify-content:space-between;"><span>CB encaissees</span><span>${parseFloat(d.totalCard||0).toFixed(2)} EUR</span></div>`:"")+
          (d.totalSales!=null?`<div style="display:flex;justify-content:space-between;font-weight:700;margin-top:4px;"><span>CA total</span><span>${parseFloat(d.totalSales||0).toFixed(2)} EUR</span></div>`:"")+
          (d.ticketCount!=null?`<div style="display:flex;justify-content:space-between;"><span>Nb tickets</span><span>${d.ticketCount}</span></div>`:"")+
          (d.actualCash!=null?`<div class="sep"></div><div style="display:flex;justify-content:space-between;font-weight:700;"><span>Especes en caisse</span><span>${parseFloat(d.actualCash||0).toFixed(2)} EUR</span></div>`:"")+
          (d.difference!=null?`<div style="display:flex;justify-content:space-between;color:${parseFloat(d.difference||0)===0?"#059669":"#dc2626"};font-weight:700;"><span>Ecart</span><span>${parseFloat(d.difference||0).toFixed(2)} EUR</span></div>`:"");
      }
      const html=`<!DOCTYPE html><html><head><title>${title}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;padding:6px;width:72mm;max-width:72mm;color:#000}
        .sep{border-top:1px dashed #000;margin:6px 0}.center{text-align:center}
        h2{font-size:14px;margin:2px 0}h3{font-size:16px;margin:4px 0}
        @media print{@page{size:72mm auto;margin:2mm}body{padding:0}.no-print{display:none}}</style></head><body>
        <div class="center"><h2>${co.name||"Ma Boutique"}</h2>
        ${co.address?`<div>${co.address}</div>`:""}${co.postalCode||co.city?`<div>${co.postalCode||""} ${co.city||""}</div>`:""}
        ${co.phone?`<div>Tel: ${co.phone}</div>`:""}${co.siret?`<div style="font-size:9px;">SIRET: ${co.siret}</div>`:""}</div>
        <div class="sep" style="border-top-style:double;"></div>
        <div class="center"><h3>${title}</h3></div>
        <div class="sep" style="border-top-style:double;"></div>
        <div style="display:flex;justify-content:space-between;"><span>Date</span><span>${new Date(d.openDate||d.closeDate||"").toLocaleString("fr-FR")}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Caissier</span><span>${d.userName||"?"}</span></div>
        ${d.storeName?`<div style="display:flex;justify-content:space-between;"><span>Magasin</span><span>${d.storeName}</span></div>`:""}
        ${isOpen?`<div class="sep"></div><div class="center"><div style="font-weight:700;">FOND DE CAISSE</div><div style="font-size:18px;font-weight:900;">${parseFloat(d.openingAmount||0).toFixed(2)} EUR</div></div>${denomHtml}`:closeHtml}
        <div class="sep" style="border-top-style:double;"></div>
        <div class="center" style="font-size:9px;">CaissePro — Document obligatoire</div>
        <div class="no-print center" style="margin-top:12px;"><button onclick="window.print()" style="padding:8px 20px;background:#047857;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">Imprimer</button></div>
        </body></html>`;
      const w=window.open("","_blank","width=350,height=500");
      if(w){w.document.write(html);w.document.close();setTimeout(()=>{try{w.focus();w.print();}catch(e){}},300);}
      return false;
    }
    return false;
  },[settings,notify,printReceiptOnly]);

  const connectPrinter=useCallback(async(method,options={})=>{
    try{
      // Try HAL native first
      if(method==="sunmi"||method==="pax"||method==="imin"){
        const ok=await hardwareManager.connectPrinter();
        if(ok){setPrinterConnected(true);setPrinterType(method);notify("Imprimante "+method+" connectee","success");return true;}
      }
      if(method==="serial")await printer.connectSerial(options);
      else if(method==="usb")await printer.connectUSB();
      else if(method==="bluetooth")await printer.connectBluetooth();
      setPrinterConnected(true);setPrinterType(method);
      notify("Imprimante connectee ("+method+")","success");return true;
    }catch(e){notify(e.message,"danger");return false;}
  },[notify]);

  const disconnectPrinter=useCallback(async()=>{
    await printer.disconnect();notify("Imprimante déconnectée","warn");
  },[notify]);

  // Refresh products from API
  const refreshProducts=useCallback(async()=>{try{const prods=await API.products.list();setProducts(norm.products(prods));}catch(e){console.error("refreshProducts:",e);}},[]);

  // Add product — via API
  const addProduct=useCallback(async(p)=>{try{await API.products.create(p);
    const prods=await API.products.list();setProducts(norm.products(prods));}catch(e){notify("Erreur: "+e.message,"error");}},[notify]);
  // Add customer — via API with offline fallback
  const addCustomer=useCallback(async(c)=>{
    try{const nc=await API.customers.create(c);const mapped=norm.customer(nc);setCustomers(p=>[...p,mapped]);notify("Client créé","success");return mapped;}
    catch(e){
      // Fallback local si API indisponible — pas d'erreur, juste création locale
      const nc={id:`c-${Date.now()}`,firstName:c.firstName||"",lastName:c.lastName||"",email:c.email||"",phone:c.phone||"",
        city:c.city||"",notes:c.notes||"",points:0,totalSpent:0,createdAt:new Date().toISOString()};
      setCustomers(p=>[...p,nc]);notify("Client créé","success");return nc;
    }},[notify]);

  const openReg=async(a,denominations)=>{
    const reg={openingAmount:a,openDate:new Date().toISOString(),denominations:denominations||null};
    setCashReg(reg);addAudit("CAISSE","Ouverture "+a+"€");
    try{const res=await API.settings.openRegister(a);if(res?.id)setCashReg(prev=>({...prev,id:res.id}));
    }catch(e){addPendingSync({type:"openRegister",data:{openingAmount:a}});console.warn("Ouverture caisse locale:",e.message);}
    // Print opening ticket
    try{await thermalPrint("register-open",{openingAmount:a,openDate:reg.openDate,userName:currentUser?.name,storeName:currentStore?.name,denominations:denominations||null});}catch(e){console.warn("Impression ouverture:",e.message);}
  };
  const closeReg=async(closingCash,closingCard,closeData)=>{
    if(cashReg?.id){try{await API.settings.closeRegister(cashReg.id,{closingCash:closingCash||null,closingCard:closingCard||null});
    }catch(e){addPendingSync({type:"closeRegister",data:{registerId:cashReg.id}});console.warn("Fermeture caisse locale:",e.message);}}
    // Print closing ticket
    if(closeData){try{await thermalPrint("register-close",{...closeData,openDate:cashReg?.openDate,closeDate:new Date().toISOString(),openingAmount:cashReg?.openingAmount||0,userName:currentUser?.name,storeName:currentStore?.name,actualCash:closingCash,actualCard:closingCard});}catch(e){console.warn("Impression fermeture:",e.message);}}
    setCashReg(null);
  };

  // ══ GIFT CARDS ══
  // ══ Gift Cards — backend-first avec cache localStorage ══
  const[giftCards,setGiftCards]=useState(()=>{try{const s=localStorage.getItem("caissepro_giftcards");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_giftcards",JSON.stringify(giftCards));}catch(e){}},[giftCards]);
  const giftcardLock=useRef(false);
  const createGiftCard=useCallback(async(amount,customerName)=>{
    if(giftcardLock.current)return null;
    giftcardLock.current=true;
    const code=`GC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    try{
      const gc=await API.giftcards.create({code,initialAmount:amount,customerName:customerName||""});
      const mapped={id:gc.id,code:gc.code,initialAmount:parseFloat(gc.initial_amount||gc.initialAmount||amount),
        balance:parseFloat(gc.remaining||gc.balance||amount),createdDate:gc.created_at||new Date().toISOString(),
        customerName:customerName||"",barcode:gc.barcode||null,transactions:[]};
      setGiftCards(p=>[mapped,...p]);
      addAudit("GIFT_CARD",`Carte cadeau ${code} creee: ${amount.toFixed(2)}EUR`);
      notify(`Carte cadeau creee: ${code}`,"success");return mapped;
    }catch(e){
      // Fallback local si API indisponible
      const gc={id:Date.now(),code,initialAmount:amount,balance:amount,createdDate:new Date().toISOString(),
        customerName:customerName||"",transactions:[]};
      setGiftCards(p=>[gc,...p]);addAudit("GIFT_CARD",`Carte cadeau ${code} creee (offline): ${amount.toFixed(2)}EUR`);
      addPendingSync({type:"createGiftCard",data:{code,initialAmount:amount,customerName:customerName||""}});
      notify(`Carte cadeau creee (offline): ${code}`,"warn");return gc;
    }finally{giftcardLock.current=false;}
  },[addAudit,notify,addPendingSync]);
  const useGiftcardLock=useRef(false);
  const useGiftCard=useCallback(async(code,amount)=>{
    if(useGiftcardLock.current)return{ok:false,msg:"Opération en cours..."};
    useGiftcardLock.current=true;
    try{
      const result=await API.giftcards.use(code,amount);
      setGiftCards(p=>p.map(g=>g.code.toUpperCase()===code.toUpperCase()?{...g,balance:parseFloat(result.remaining||0),
        transactions:[...(g.transactions||[]),{date:new Date().toISOString(),amount:-amount,type:"DEBIT"}]}:g));
      return{ok:true,remaining:parseFloat(result.remaining||0)};
    }catch(e){
      // Fallback local
      const gc=giftCards.find(g=>g.code.toUpperCase()===code.toUpperCase());
      if(!gc)return{ok:false,msg:"Carte introuvable"};
      if(gc.balance<amount)return{ok:false,msg:`Solde insuffisant: ${gc.balance.toFixed(2)}EUR`};
      setGiftCards(p=>p.map(g=>g.id===gc.id?{...g,balance:g.balance-amount,
        transactions:[...(g.transactions||[]),{date:new Date().toISOString(),amount:-amount,type:"DEBIT"}]}:g));
      addPendingSync({type:"useGiftCard",data:{code,amount}});
      return{ok:true,remaining:gc.balance-amount};
    }finally{useGiftcardLock.current=false;}
  },[giftCards,addPendingSync]);
  const checkGiftCard=useCallback(async(code)=>{
    try{const gc=await API.giftcards.get(code);return gc||null;}
    catch(e){return giftCards.find(g=>g.code.toUpperCase()===code.toUpperCase())||null;}
  },[giftCards]);

  // ══ RETURNS / AVOIRS ══
  const[avoirSeq,setAvoirSeq]=useState(0);
  const returnLock=useRef(false); // FE-06: prevent double-click on processReturn
  const _processReturnRef=useRef(null);
  const processReturn=useCallback(async(ticket,returnItems,reason,refundMethod,doRestock,defective=false)=>{
    if(!returnItems.length)return null;
    if(returnLock.current){notify("Retour en cours, veuillez patienter...","warn");return null;}
    returnLock.current=true;
    try{return await _processReturnRef.current(ticket,returnItems,reason,refundMethod,doRestock,defective);
    }finally{returnLock.current=false;}},[notify]);
  const _processReturnInner=async(ticket,returnItems,reason,refundMethod,doRestock,defective=false)=>{
    if(!returnItems.length)return null;
    const rp=settings.returnPolicy||{};
    if(rp.requireReason===true&&!reason?.trim()){notify("Motif de retour obligatoire","error");return null;}

    // Calcul des montants — TTC = reference (prix paye par le client)
    // On part du TTC et on derive HT/TVA pour que le montant de l'avoir = montant du ticket
    let totalTTC=0,totalHT=0,totalTVA=0;
    const items=returnItems.map(ri=>{
      const origItem=ticket.items?.find(i=>(i.product?.id||i.product_id)===ri.productId&&(i.variant?.id||i.variant_id)===ri.variantId);
      const taxRate=origItem?.tax_rate||origItem?.product?.taxRate||ri.taxRate||0.20;
      let lTTC;
      if(origItem){
        // Depuis le ticket original: prix TTC unitaire = lineTTC / quantity
        const origTTC=Number(origItem.lineTTC||origItem.line_ttc)||0;
        const unitTTC=origTTC/(origItem.quantity||1);
        lTTC=Math.round(unitTTC*ri.qty*100)/100;
      }else{
        // Retour libre: unitPrice est deja TTC
        lTTC=Math.round((ri.unitPrice||0)*ri.qty*100)/100;
      }
      // Deriver HT et TVA depuis le TTC
      const lHT=Math.round(lTTC/(1+taxRate)*100)/100;
      const lTVA=Math.round((lTTC-lHT)*100)/100;
      totalTTC+=lTTC;totalHT+=lHT;totalTVA+=lTVA;
      return{product_id:ri.productId,variant_id:ri.variantId,
        product_name:origItem?.product_name||origItem?.product?.name||ri.productName||"Article",
        variant_color:origItem?.variant_color||origItem?.variant?.color||ri.variantColor||"",
        variant_size:origItem?.variant_size||origItem?.variant?.size||ri.variantSize||"",
        quantity:ri.qty,lineHT:lHT,lineTVA:lTVA,lineTTC:lTTC,
        taxRate};
    });
    totalTTC=Math.round(totalTTC*100)/100;
    totalHT=Math.round(totalHT*100)/100;
    totalTVA=Math.round(totalTVA*100)/100;

    if(totalTTC<=0){notify("Montant de retour invalide (0 EUR)","error");return null;}
    if(rp.maxNoApproval&&totalTTC>rp.maxNoApproval&&currentUser?.role!=="admin"){
      notify(`Montant > ${rp.maxNoApproval}EUR -- approbation manager requise`,"error");return null;}

    // Envoi API (le backend gere doublons, stock, hash, sequence)
    const apiPayload={
      originalTicket:ticket.ticketNumber||ticket.id||null,
      reason,refundMethod,
      items:items.map(i=>({productId:i.product_id,variantId:i.variant_id,
        productName:i.product_name,variantColor:i.variant_color,variantSize:i.variant_size,
        qty:i.quantity,lineHT:i.lineHT,lineTVA:i.lineTVA,lineTTC:i.lineTTC,taxRate:i.taxRate})),
      totalHT,totalTVA,totalTTC,
      restock:doRestock!==undefined?doRestock:(rp.autoRestock!==false),defective};

    let avoir;
    try{
      const apiResult=await API.returns.create(apiPayload);
      // Enrich items with product/variant detail for printing (sku, ean, colorCode)
      const enrichedItemsForAvoir=items.map(i=>{
        const prod=products.find(p=>p.id===i.product_id);
        const vari=prod?.variants?.find(v=>v.id===i.variant_id);
        return{...i,product:{id:i.product_id,name:i.product_name,sku:prod?.sku||""},
          variant:{id:i.variant_id,color:i.variant_color,size:i.variant_size,ean:vari?.ean||"",colorCode:vari?.colorCode||""}};
      });
      avoir={
        avoirNumber:apiResult.avoirNumber,seq:apiResult.seq,date:apiResult.date||new Date().toISOString(),
        originalTicket:ticket.ticketNumber,originalDate:ticket.date,
        items:enrichedItemsForAvoir,totalHT:apiResult.totalHT||totalHT,totalTVA:apiResult.totalTVA||totalTVA,
        totalTTC:apiResult.totalTTC||totalTTC,remaining:apiResult.remaining||totalTTC,
        used:false,reason:reason||"",refundMethod,
        userId:currentUser?.id,userName:currentUser?.name,
        customerId:ticket.customerId,customerName:ticket.customerName,
        hash:apiResult.hash||"",fingerprint:apiResult.fingerprint||"",
        barcode:apiResult.barcode||""};
      if(apiResult.seq)setAvoirSeq(apiResult.seq);
    }catch(e){
      // Erreur 409 = doublon ou depassement quantite détecté par le backend
      if(e.message?.includes("déjà")||e.message?.includes("deja")||e.message?.includes("dépasse")||e.message?.includes("depasse")){
        notify(e.message,"error");return null;}
      // Fallback offline
      console.error("Avoir API echoue, mode offline:",e.message,e);
      notify("Erreur backend avoir: "+e.message+" — sauvegarde locale","warn");
      const seq=avoirSeq+1;const avoirNumber=`AV-${new Date().getFullYear()}-${String(seq).padStart(6,"0")}`;
      const date=new Date().toISOString();
      const caisseId=currentStore?.id||cashReg?.id||"CAISSE-01";
      const lastAvoirHash=avoirs.length>0?(avoirs[0].hash||""):lastHash;
      const hash=await sha256(`${lastAvoirHash}|${seq}|AVOIR|${caisseId}|${avoirNumber}|${date}|${totalTTC.toFixed(2)}|${ticket.ticketNumber}`);
      // Enrich items for offline avoir too
      const offlineEnrichedItems=items.map(i=>{
        const prod=products.find(p=>p.id===i.product_id);
        const vari=prod?.variants?.find(v=>v.id===i.variant_id);
        return{...i,product:{id:i.product_id,name:i.product_name,sku:prod?.sku||""},
          variant:{id:i.variant_id,color:i.variant_color,size:i.variant_size,ean:vari?.ean||"",colorCode:vari?.colorCode||""}};
      });
      avoir={avoirNumber,seq,date,originalTicket:ticket.ticketNumber,originalDate:ticket.date,
        items:offlineEnrichedItems,totalHT,totalTVA,totalTTC,remaining:totalTTC,used:false,reason:reason||"",refundMethod,
        userId:currentUser?.id,userName:currentUser?.name,
        customerId:ticket.customerId,customerName:ticket.customerName,
        hash,fingerprint:hash.slice(0,16).toUpperCase(),barcode:""};
      setAvoirSeq(seq);
      addPendingSync({type:"offlineAvoir",data:{...apiPayload,saleId:ticket.ticketNumber||ticket.id}});
      // Restock local en attendant la synchro backend
      if(apiPayload.restock!==false){
        setProducts(prev=>prev.map(p=>{
          const matchItems=returnItems.filter(ri=>ri.productId===p.id);
          if(!matchItems.length)return p;
          return{...p,variants:(p.variants||[]).map(v=>{
            const mi=matchItems.find(ri=>ri.variantId===v.id);
            return mi?{...v,stock:(v.stock||0)+mi.qty}:v;})};
        }));
      }
    }

    setAvoirs(p=>[avoir,...p]);

    // Rafraichir le stock depuis le backend (le restock est fait cote serveur)
    try{const prods=await API.products.list();setProducts(norm.products(prods));}catch(e){console.warn("Refresh stock apres retour echoue:",e.message);}

    // Auto-print avoir si configuré
    if(rp.printAvoir===true&&printerConnected){
      try{await thermalPrint("avoir",avoir);}catch(e){console.warn("Auto-print avoir echoue:",e);}
    }

    // FE-12: use Math.round (same as checkout) for consistent loyalty points
    if(ticket.customerId){const pts=Math.round(totalTTC);
      setCustomers(prev=>prev.map(c=>c.id===ticket.customerId?{...c,points:Math.max(0,c.points-pts),totalSpent:Math.max(0,c.totalSpent-totalTTC)}:c));}
    addAudit("AVOIR",`${avoir.avoirNumber} -- Ref: ${ticket.ticketNumber} -- ${totalTTC.toFixed(2)}EUR -- ${refundMethod}`,avoir.avoirNumber);
    addJET("AVOIR",`Avoir ${avoir.avoirNumber} emis pour ${totalTTC.toFixed(2)}EUR`);
    notify(`Avoir ${avoir.avoirNumber} -- ${totalTTC.toFixed(2)}EUR`,"success");
    return avoir;
  };
  _processReturnRef.current=_processReturnInner;

  // Avoir expiry check
  const isAvoirExpired=useCallback((avoir)=>{
    const expiryMonths=settings.returnPolicy?.avoirExpiryMonths||12;
    const created=new Date(avoir.date);const expiry=new Date(created);
    expiry.setMonth(expiry.getMonth()+expiryMonths);
    return new Date()>expiry;
  },[settings.returnPolicy?.avoirExpiryMonths]);

  // ══ FOOTFALL COUNTER — LOW-4: backend-first ══
  const[footfall,setFootfall]=useState(()=>{try{const s=localStorage.getItem("caissepro_footfall");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_footfall",JSON.stringify(footfall));}catch(e){}},[footfall]);
  const addFootfall=useCallback((count,date)=>{
    const d=date||new Date().toISOString().split("T")[0];
    setFootfall(prev=>{const existing=prev.find(f=>f.date===d);
      if(existing)return prev.map(f=>f.date===d?{...f,count}:f);
      return[...prev,{date:d,count}].sort((a,b)=>b.date.localeCompare(a.date));});
    // LOW-4: Persist to backend
    API.footfall.save(d,count).catch(()=>{});
  },[]);

  // ══ PRODUCT EDIT — via API ══
  const updateProduct=useCallback(async(productId,updates)=>{
    try{await API.products.update(productId,updates);
      const prods=await API.products.list();setProducts(norm.products(prods));
      addAudit("PRODUCT",`Modification: ${updates.name||""}`);
    }catch(e){notify("Erreur: "+e.message,"error");}
  },[addAudit]);

  const deleteProduct=useCallback(async(productId)=>{
    const p=products.find(x=>x.id===productId);if(!p)return false;
    const ts=p.variants.reduce((s,v)=>s+v.stock,0);
    if(ts>0){notify("Impossible: stock restant > 0","error");return false;}
    try{await API.products.remove(productId);
      setProducts(prev=>prev.filter(x=>x.id!==productId));
      addAudit("PRODUCT",`Suppression: ${p.name} (${p.sku})`);
      notify(`Produit ${p.name} supprimé`,"warn");return true;
    }catch(e){notify("Erreur: "+e.message,"error");return false;}
  },[products,addAudit,notify]);

  const addVariantToProduct=useCallback(async(productId,variant)=>{
    try{await API.products.addVariant(productId,variant);
      const prods=await API.products.list();setProducts(norm.products(prods));
      addAudit("PRODUCT",`Variante ajoutée: ${variant.color}/${variant.size}`);
    }catch(e){notify("Erreur: "+e.message,"error");}
  },[addAudit]);

  const deleteVariant=useCallback(async(productId,variantId)=>{
    const p=products.find(x=>x.id===productId);const v=p?.variants.find(x=>x.id===variantId);
    if(v&&v.stock>0){notify("Impossible: stock restant > 0","error");return false;}
    try{await API.products.removeVariant(productId,variantId);
      setProducts(prev=>prev.map(x=>x.id===productId?{...x,variants:x.variants.filter(vr=>vr.id!==variantId)}:x));
      addAudit("PRODUCT",`Variante supprimée: ${v?.color}/${v?.size}`);return true;
    }catch(e){notify("Erreur: "+e.message,"error");return false;}
  },[products,addAudit,notify]);

  const reorderVariants=useCallback(async(productId,variantIds)=>{
    try{const updated=await API.products.reorderVariants(productId,variantIds);
      if(updated){setProducts(prev=>prev.map(x=>x.id===productId?norm.product(updated):x));}
      notify("Ordre des tailles mis à jour","success");return true;
    }catch(e){notify("Erreur: "+e.message,"error");return false;}
  },[notify]);

  // ══ CUSTOMER EDIT — via API ══
  const updateCustomer=useCallback(async(customerId,updates)=>{
    try{await API.customers.update(customerId,updates);
      setCustomers(prev=>prev.map(c=>c.id===customerId?{...c,...updates}:c));
      addAudit("CLIENT",`Client modifié: ${updates.firstName||""} ${updates.lastName||""}`);
    }catch(e){notify("Erreur: "+e.message,"error");}
  },[addAudit]);

  const deleteCustomer=useCallback(async(customerId)=>{
    const c=customers.find(x=>x.id===customerId);if(!c)return;
    try{await API.customers.remove(customerId);
      setCustomers(prev=>prev.filter(x=>x.id!==customerId));
      addAudit("CLIENT",`Client supprimé: ${c.firstName} ${c.lastName}`);
      notify(`Client ${c.firstName} ${c.lastName} supprimé`,"warn");
    }catch(e){notify("Erreur: "+e.message,"error");}
  },[customers,addAudit,notify]);

  // ══ STOCK ADJUSTMENT ══
  const adjustStock=useCallback(async(productId,variantId,newStock,reason)=>{
    const p=products.find(x=>x.id===productId);const v=p?.variants.find(x=>x.id===variantId);
    if(!p||!v)return;
    try{await API.stock.adjust({productId,variantId,newStock,reason});
      const prods=await API.products.list();setProducts(norm.products(prods));
      addAudit("STOCK",`${p.name} ${v.color}/${v.size}: ${v.stock} → ${newStock} (${reason||"Ajustement"})`);
      notify(`Stock ajusté: ${p.name} ${v.color}/${v.size}`,"info");
    }catch(e){notify("Erreur: "+e.message,"error");}
  },[products,addAudit,notify]);

  // ══ DEFECTIVE STOCK ══
  const[defectiveStock,setDefectiveStock]=useState([]);
  const loadDefectiveStock=useCallback(async()=>{
    try{const data=await API.stock.defective();setDefectiveStock(data||[]);}catch(e){console.warn("Erreur chargement défectueux:",e.message);}
  },[]);
  const receiveDefectiveStock=useCallback(async(productId,variantId,qty,reason)=>{
    const p=products.find(x=>x.id===productId);const v=p?.variants.find(x=>x.id===variantId);
    if(!p||!v)return;
    try{await API.stock.receiveDefective({productId,variantId,quantity:qty,reason});
      await loadDefectiveStock();
      addAudit("DEFECTUEUX",`Réception défectueux: +${qty} ${p.name} ${v.color}/${v.size}`);
      notify(`Défectueux reçu: +${qty} ${p.name} ${v.color}/${v.size}`,"info");
    }catch(e){notify("Erreur: "+e.message,"error");}
  },[products,addAudit,notify,loadDefectiveStock]);
  const adjustDefectiveStock=useCallback(async(productId,variantId,newDefective,reason)=>{
    const p=products.find(x=>x.id===productId);const v=p?.variants.find(x=>x.id===variantId);
    if(!p||!v)return;
    try{await API.stock.adjustDefective({productId,variantId,newDefective,reason});
      await loadDefectiveStock();
      addAudit("INVENTAIRE_DEFECTUEUX",`${p.name} ${v.color}/${v.size}: ${v.defective||0} → ${newDefective}`);
      notify(`Défectueux ajusté: ${p.name} ${v.color}/${v.size}`,"info");
    }catch(e){notify("Erreur: "+e.message,"error");}
  },[products,addAudit,notify,loadDefectiveStock]);

  // ══ CUSTOMER DISPLAY (dual screen) ══
  // On Capacitor/Sunmi: uses native CustomerDisplay plugin (Presentation API)
  // On PC/browser: window.open + BroadcastChannel + localStorage
  const customerDisplayRef=useRef(null);
  const customerDisplayPluginRef=useRef(null);
  // Check if Capacitor native plugin is available
  useEffect(()=>{
    const plugin=window.Capacitor?.Plugins?.CustomerDisplay;
    if(plugin){
      customerDisplayPluginRef.current=plugin;
      plugin.isConnected().then(r=>{
        if(r.connected)notify("Ecran client Sunmi connecte automatiquement","success");
        else if(r.displayAvailable)plugin.connect().then(r2=>{if(r2.connected)notify("Ecran client Sunmi connecte","success");});
      }).catch(()=>{});
      // Listen for display changes
      try{plugin.addListener("displayChanged",e=>{
        if(e.connected)notify("Second ecran Sunmi connecte","success");
        else notify("Second ecran Sunmi deconnecte","warn");
      });}catch(e){}
    }
  },[]);

  const openCustomerDisplay=useCallback(()=>{
    // Capacitor native — already auto-connected
    if(customerDisplayPluginRef.current){
      customerDisplayPluginRef.current.isConnected().then(r=>{
        if(r.connected)notify("Ecran client deja actif sur le second ecran","info");
        else if(r.displayAvailable)customerDisplayPluginRef.current.connect().then(r2=>{
          if(r2.connected)notify("Ecran client connecte","success");
          else notify("Erreur connexion second ecran","error");
        });
        else notify("Aucun second ecran detecte","warn");
      }).catch(()=>notify("Erreur plugin CustomerDisplay","error"));
      return;
    }
    // Browser fallback: window.open
    if(customerDisplayRef.current&&!customerDisplayRef.current.closed){customerDisplayRef.current.focus();return;}
    const displayUrl=window.location.origin+"/customer-display.html";
    const w=window.open(displayUrl,"CaisseProClient","width=800,height=600,menubar=no,toolbar=no,location=no,status=no");
    if(w){
      customerDisplayRef.current=w;
      notify("Ecran client ouvert — glissez-le sur le 2e moniteur","success");
    }else{
      notify("Impossible d'ouvrir l'ecran client. Autorisez les popups.","warn");
    }
  },[notify]);

  // Sync cart to customer display
  useEffect(()=>{
    try{
      const promoResult=calcPromoDiscount(cart);
      const rawTotal=cart.reduce((s,i)=>s+i.product.price*i.quantity,0);
      const totalAfterPromo=Math.max(0,rawTotal-promoResult.promoDisc).toFixed(2)+"EUR";
      const data={
        storeName:settings.name||CO.name,
        customer:selCust?{name:`${selCust.firstName||""} ${selCust.lastName||selCust.name||""}`.trim(),loyalty:getLoyaltyTier(selCust.points||0)?.name||""}:null,
        promos:activePromos.map(p=>p.name).filter(Boolean),
        appliedPromos:promoResult.applied,
        items:cart.map(i=>({name:i.product.name+(i.variant?` (${i.variant.color}/${i.variant.size})`:""),qty:i.quantity,
          price:(i.product.price*i.quantity).toFixed(2)+"EUR"})),
        total:cart.length>0?totalAfterPromo:"0.00EUR",
        _ts:Date.now()
      };
      // Channel 1: Capacitor native plugin (Sunmi second screen — direct, instant)
      if(customerDisplayPluginRef.current){
        try{customerDisplayPluginRef.current.updateCart(data);}catch(e){}
      }
      // Channel 2: localStorage — browser fallback
      try{localStorage.setItem("caissepro_customer_cart",JSON.stringify(data));}catch(e){}
      // Channel 3: BroadcastChannel — same browser context
      try{const bc=new BroadcastChannel("caissepro_customer_display");bc.postMessage(data);bc.close();}catch(e){}
      // Channel 4: window.open direct (PC)
      if(customerDisplayRef.current&&!customerDisplayRef.current.closed&&customerDisplayRef.current.updateCart){
        try{customerDisplayRef.current.updateCart(data);}catch(e){}
      }
      // Channel 5: API push (SEC-02: for remote second screens)
      if(effectiveStoreId&&isOnline){
        try{API.customerDisplay.push(data);}catch(e){console.warn("Push écran client échoué:",e.message);}
      }
    }catch(e){console.warn("Sync écran client échoué:",e.message);}
  },[cart,settings.name,selCust,activePromos,calcPromoDiscount,getLoyaltyTier,effectiveStoreId,isOnline]);

  // ══ PRODUCT PHOTOS — lookup helper ══
  // Extract color key from variant EAN: "QMCHML_C001-752-S" → "752"
  const getVariantPhotos=useCallback((product,variant)=>{
    if(!product||!variant)return[];
    const sku=product.sku||"";
    const ean=variant.ean||"";
    let colorKey="";
    // Strategy 1: parse EAN if it follows {sku}-{colorKey}-{size} pattern
    if(ean.startsWith(sku+"-")){
      const rest=ean.slice(sku.length+1);
      const parts=rest.split("-");
      if(parts.length>=2)colorKey=parts[0];
    }
    // Strategy 2: try EAN with underscore separator
    if(!colorKey&&ean.includes("_")){
      const parts=ean.split("-");
      if(parts.length>=3)colorKey=parts[parts.length-2]; // second-to-last = color
    }
    // Strategy 3: extract from sku-like reference patterns
    if(!colorKey){
      // Try any EAN that has at least 2 dashes: take the penultimate segment
      const parts=ean.split("-");
      if(parts.length>=3)colorKey=parts[parts.length-2];
    }
    if(!colorKey)return[];
    const key=`${sku}-${colorKey}`;
    return productPhotosMapRef.current.get(key)||[];
  },[]);

  const reloadProductPhotos=useCallback(async()=>{
    try{const photos=await API.productPhotos.list();setProductPhotos(photos||[]);
      const m=new Map();for(const p of (photos||[])){const k=`${p.skuBase}-${p.colorKey}`;if(!m.has(k))m.set(k,[]);m.get(k).push({url:`${API.productPhotos.apiUrl}/uploads/products/${p.filename}`,sortOrder:p.sortOrder,id:p.id});}
      m.forEach(v=>v.sort((a,b)=>a.sortOrder-b.sortOrder));productPhotosMapRef.current=m;
    }catch(e){console.warn("Reload photos echoue:",e.message);}
  },[]);

  return<AppCtx.Provider value={{currentUser,login,logout,mode,setMode,offlineMode,
    stores,setStores,currentStore,setCurrentStore,selectStore,viewingStoreId,switchViewingStore,effectiveStoreId,
    products,setProducts,addProduct,customers,setCustomers,addCustomer,openCustomerDisplay,footfall,addFootfall,
    cart,addToCart,addCustomItem,removeFromCart,voidSale,updateQty,updateItemDisc,clearCart,gDisc,gDiscType,setCartGD,
    promoCode,setPromoCode,calcPromoDiscount,
    cashReg,openReg,closeReg,isOnline,tickets,setTickets,tSeq,lastHash,gt,audit,jet,closures,avoirs,consumeAvoir,isAvoirExpired,
    checkout,createClosure,exportArchive,exportFEC,exportCSVReport,exportCustomerRGPD,addAudit,addJET,
    promos,setPromos,activePromos,parked,parkCart,restoreCart,removeParked,retoucheBons,addRetoucheBon,updateRetoucheStatus,tenues,addTenue,reloadTenues,selCust,setSelCust,
    stockAlerts,stockMoves,addStockMove,receiveStock,receiveBatchStock,
    refreshProducts,findByEAN,perm,settings,setSettings,saveSettingsToAPI,getLoyaltyTier,avoirPayment,selectedAvoir,setSelectedAvoir,
    bestSellers,salesBySeller,salesByVariant,caEvolution,salesByCollection,
    saleNote,setSaleNote,clockIn,clockOut,clockEntries,verifyChain,exportCatalog,
    updateProductPrice,priceHistory,reorderSuggestions,toggleFavorite,favorites,tvaSummary,stockAging,
    duplicateProduct,salesGoals,setSellerGoal,commissions,getLastPriceForCustomer,theme,setTheme,
    notifications,notify,
    processReturn,giftCards,createGiftCard,useGiftCard,checkGiftCard,
    updateProduct,deleteProduct,addVariantToProduct,deleteVariant,reorderVariants,
    updateCustomer,deleteCustomer,adjustStock,
    defectiveStock,loadDefectiveStock,receiveDefectiveStock,adjustDefectiveStock,
    printerConnected,printerType,thermalPrint,connectPrinter,disconnectPrinter,isSunmi,isAndroid,
    hwId,hwProfile,switchHardware,hardwareProfiles:hardwareManager.profiles,
    paymentId,paymentConfig,switchPayment,updatePaymentConfig,chargePayment,refundPayment,
    paymentProfiles:hardwareManager.paymentProfiles,
    users,setUsers,tvaRates,setTvaRates,addPendingSync,pendingSync,clearPendingSync,
    trainingMode,setTrainingMode,
    cartTotals,allCategories,
    scanBarcode,setScanBarcode,
    setScanOverride,clearScanOverride,
    productPhotos,getVariantPhotos,reloadProductPhotos,
  }}>{children}</AppCtx.Provider>;
}

export default AppProvider;
export { AppCtx };
