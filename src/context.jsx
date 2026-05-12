import React, { useState, useMemo, useEffect, useRef, createContext, useContext, useCallback } from "react";
import * as API from "./api.js";
import { setOnAuthExpired, setStoreId, clearStoreId } from "./api.js";
import printer from "./printer.js";
import hardwareManager from "./hardware.js";
import { CO, DEFAULT_TVA_RATES, PERMS, initProducts, initUsers, initCustomers, LOYALTY_TIERS, initPromos, C } from "./constants.jsx";
import { hashPin, verifyPin, sha256, norm, loadVariantOrderFromSettings, autoImportSizesFromProducts } from "./utils.jsx";
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
  const[avoirs,setAvoirs]=useState(()=>{try{const s=localStorage.getItem("caissepro_avoirs");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_avoirs",JSON.stringify(avoirs));}catch(e){}},[avoirs]);
  const[promos,setPromos]=useState(initPromos);
  const[parked,setParked]=useState(()=>{try{const s=localStorage.getItem("caissepro_parked");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_parked",JSON.stringify(parked));}catch(e){}},[parked]);
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
  const[favorites,setFavorites]=useState(()=>{try{const s=localStorage.getItem("caissepro_favorites");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_favorites",JSON.stringify(favorites));}catch(e){}},[favorites]);
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
  // Barcode scanner auto-start (moved after findByEAN/addToCart declarations)
  // Default PINs are hashed on first load (SHA-256 + salt)
  const DEFAULT_PIN_HASH="3a24a2105c7a06376ff41e7e06a6cd2a3941c980d99e169c8fbb60d29b741395"; // hash of "1234"
  const defaultUsers=[{id:"u1",name:"Admin",role:"admin",pin:DEFAULT_PIN_HASH},{id:"u2",name:"Sophie",role:"cashier",pin:DEFAULT_PIN_HASH},{id:"u3",name:"Marc",role:"cashier",pin:DEFAULT_PIN_HASH}];
  const[users,setUsersRaw]=useState(()=>{try{const s=localStorage.getItem("caissepro_users");return s?JSON.parse(s):defaultUsers;}catch(e){return defaultUsers;}});
  const setUsers=useCallback((v)=>{setUsersRaw(prev=>{const next=typeof v==="function"?v(prev):v;try{localStorage.setItem("caissepro_users",JSON.stringify(next));}catch(e){}return next;});},[]);
  // ══ Pending sync queue — retry offline user/settings changes when back online ══
  const[pendingSync,setPendingSync]=useState(()=>{try{const s=localStorage.getItem("caissepro_pendingSync");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_pendingSync",JSON.stringify(pendingSync));}catch(e){}},[pendingSync]);
  const addPendingSync=useCallback((action)=>{setPendingSync(p=>[...p,{...action,ts:Date.now()}]);},[]);
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
    const on=()=>setIsOnline(true);const off=()=>setIsOnline(false);
    window.addEventListener("online",on);window.addEventListener("offline",off);
    // Capacitor WebView may report navigator.onLine incorrectly — verify with real fetch
    const checkReal=async()=>{try{const r=await fetch((import.meta.env.VITE_API_URL||'https://api.techincash.app')+'/api/health',{method:'HEAD',mode:'no-cors',cache:'no-store'});setIsOnline(true);}catch(e){if(navigator.onLine)setIsOnline(true);else setIsOnline(false);}};
    checkReal();const iv=setInterval(checkReal,30000);
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
      // H4 fix: use callback form to avoid stale closure on users
      if(apiUsers?.length){const merged=[...apiUsers.map(u=>({id:u.id,name:u.name,role:u.role,pin:"****",apiSynced:true}))];
        setUsers(prev=>{const localOnly=prev.filter(lu=>!apiUsers.find(au=>au.name===lu.name));return[...merged,...localOnly];});}
      // Load tickets and closures from backend
      try{const salesData=await API.sales.list({limit:200});if(salesData?.length)setTickets(salesData.map(s=>({...s,ticketNumber:s.ticket_number,totalHT:parseFloat(s.total_ht),totalTVA:parseFloat(s.total_tva),totalTTC:parseFloat(s.total_ttc),date:s.created_at,userName:s.user_name,paymentMethod:s.payment_method,customerName:s.customer_name,fingerprint:s.fingerprint})));}catch(e){}
      try{const closData=await API.fiscal.closures();if(closData?.length)setClosures(closData.map(c=>({...c,type:c.closure_type,totalHT:parseFloat(c.total_ht),totalTVA:parseFloat(c.total_tva),totalTTC:parseFloat(c.total_ttc),totalMargin:parseFloat(c.total_margin||0),date:c.created_at,userName:c.user_name})));}catch(e){}
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
          else if(action.type==="offlineAvoir")await API.sales.void(action.data.saleId,action.data.reason);
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
      if(synced>0)notify(`${synced} modification(s) synchronisée(s) avec le serveur`,"success");
      if(failed.length>0&&failed.some(f=>f.retries<3))notify(`${failed.length} synchro(s) en attente — nouvelle tentative prochainement`,"warn");
    },2000);// 2s debounce
    return()=>clearTimeout(timer);
  },[isOnline,pendingSync.length]);// eslint-disable-line react-hooks/exhaustive-deps

  const addJET=useCallback((t,d)=>{
    setJet(p=>[{id:Date.now(),date:new Date().toISOString(),type:t,detail:d,user:currentUser?.name||"Sys"},...p]);
    // Pousser au backend (fire & forget)
    if(API.getToken())API.audit.createJet(t,d).catch(()=>{});
  },[currentUser]);
  const addAudit=useCallback((a,d,r)=>{
    setAudit(p=>[{id:Date.now(),date:new Date().toISOString(),action:a,detail:d,ref:r,user:currentUser?.name||"—"},...p]);
    // Pousser au backend (fire & forget)
    if(API.getToken())API.audit.create(a,d,r).catch(()=>{});
  },[currentUser]);
  const perm=useCallback(()=>currentUser?PERMS[currentUser.role]||PERMS.cashier:PERMS.cashier,[currentUser]);
  // NF525: JET — événement de démarrage système
  useEffect(()=>{addJET("SYS_START",`Démarrage CaissePro v${CO.ver}`);},[]);// eslint-disable-line react-hooks/exhaustive-deps
  // saveSettingsToAPI with JET logging (addJET must be declared first)
  const saveSettingsToAPI=useCallback(async(newSettings)=>{
    addJET("PARAM_CHANGE",`Modification paramètres: ${Object.keys(newSettings).join(", ")}`);
    return saveSettingsToAPI_base(newSettings);
  },[addJET,saveSettingsToAPI_base]);

  const[offlineMode,setOfflineMode]=useState(false);

  // ══ Load store data after selecting a store ══
  const loadStoreData=useCallback(async()=>{
    try{
      const[prods,custs,prms,setts,apiUsers,apiSales,apiCounter]=await Promise.all([API.products.list(),API.customers.list(),API.settings.promos(),API.settings.get(),API.auth.users().catch(()=>null),API.sales.list({limit:200}).catch(()=>null),API.fiscal.counter().catch(()=>null)]);
      loadVariantOrderFromSettings(setts);
      if(setts?.csvColumnMapping){try{localStorage.setItem("caissepro_csv_column_mapping",JSON.stringify(setts.csvColumnMapping));}catch(e){}}
      autoImportSizesFromProducts(prods);
      setProducts(norm.products(prods));setCustomers(norm.customers(custs));setPromos(prms);setSettings(s=>({...s,...setts}));
      if(apiSales&&Array.isArray(apiSales)){const merged=[...apiSales];const localOnly=tickets.filter(lt=>lt.hash==="LOCAL"||!apiSales.find(as=>as.ticketNumber===lt.ticketNumber));
        setTickets([...localOnly,...merged].sort((a,b)=>new Date(b.date||b.createdAt||0)-new Date(a.date||a.createdAt||0)).slice(0,500));}
      if(apiCounter&&!Array.isArray(apiCounter)){const seq=apiCounter.ticket_seq??apiCounter.seq??0;setTSeq(seq);if(apiCounter.last_hash||apiCounter.lastHash)setLastHash(apiCounter.last_hash||apiCounter.lastHash);if(apiCounter.grand_total!=null||apiCounter.grandTotal!=null)setGt(parseFloat(apiCounter.grand_total??apiCounter.grandTotal));}
      if(apiUsers&&apiUsers.length){const merged=[...apiUsers.map(u=>({id:u.id,name:u.name,role:u.role,pin:"****",apiSynced:true}))];
        const localOnly=users.filter(lu=>!apiUsers.find(au=>au.name===lu.name));
        setUsers([...merged,...localOnly]);}
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
      if(apiSales&&Array.isArray(apiSales))setTickets(apiSales.sort((a,b)=>new Date(b.date||b.createdAt||0)-new Date(a.date||a.createdAt||0)).slice(0,500));
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
      let localUser=initUsers.find(u=>u.name===n&&u.password===pw);
      if(!localUser){for(const u of users){if(u.name===n&&u.pin!=="****"&&await verifyPin(pw,u.pin)){localUser=u;break;}}}
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
  const voidSale=(reason)=>{if(cart.length){addAudit("VOID_SALE",`Annulation panier: ${cart.length} articles — Motif: ${reason||"Non spécifié"}`);addJET("VOID_SALE",`Annulation panier ${cart.length} art. — ${reason||"Non spécifié"}`);setCart([]);setGDisc(0);setSelCust(null);}};
  const updateQty=(pid,vid,q)=>{if(q<1)return removeFromCart(pid,vid);setCart(p=>p.map(c=>c.product.id===pid&&c.variant?.id===vid?{...c,quantity:q}:c));};
  const updateItemDisc=(pid,vid,d,dt)=>setCart(p=>p.map(c=>c.product.id===pid&&c.variant?.id===vid?{...c,discount:d,discountType:dt||"percent"}:c));
  const clearCart=()=>{setCart([]);setGDisc(0);setSelCust(null);setPromoCode("");};
  const setCartGD=(v,t)=>{setGDisc(v);setGDiscType(t);};

  // Park
  const parkCart=useCallback(()=>{if(!cart.length)return;setParked(p=>[...p,{id:Date.now(),date:new Date().toISOString(),items:[...cart],customer:selCust,gDisc,gDiscType}]);
    setCart([]);setGDisc(0);setSelCust(null);addAudit("PARK","Panier mis en attente");},[cart,selCust,gDisc,gDiscType,addAudit]);
  const restoreCart=useCallback((id)=>{const pk=parked.find(p=>p.id===id);if(!pk)return;if(cart.length)parkCart();
    setCart(pk.items);setGDisc(pk.gDisc||0);setGDiscType(pk.gDiscType||"percentage");setSelCust(pk.customer);
    setParked(p=>p.filter(x=>x.id!==id));addAudit("RESTORE","Panier restauré");},[parked,cart,parkCart,addAudit]);

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
  const[avoirPayment,setAvoirPayment]=useState(0);

  // Stock movements (déclaré avant checkout pour éviter use-before-declaration)
  const addStockMove=useCallback((type,product,variant,qty,ref)=>{
    setStockMoves(p=>[{id:Date.now(),date:new Date().toISOString(),type,productName:product.name,productSku:product.sku,
      variantColor:variant?.color,variantSize:variant?.size,qty,ref,user:currentUser?.name||"Sys"},...p]);
  },[currentUser]);

  // ══ CHECKOUT — API ou fallback local ══
  // H3 fix: mutex to prevent race conditions in offline checkout
  const checkoutLock=useRef(false);
  const checkout=useCallback(async(payments,sellerName)=>{
    if(!cart.length)return null;
    if(checkoutLock.current){notify("Vente en cours de traitement...","warn");return null;}
    checkoutLock.current=true;
    try{return await _doCheckout(payments,sellerName);}finally{checkoutLock.current=false;}
  },[cart]);
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
    const tTTC=Math.max(0,tHT+tTVA-avoirPayment);

    // Essai API d'abord
    try{
      const ticket=await API.sales.checkout({
        items:items.map(({product,variant,...rest})=>rest),payments,customerId:selCust?.id||null,
        globalDiscount:gd,saleNote:saleNote||null,
        promosApplied:applied,sessionId:cashReg?.id||null,
        sellerName:sellerName||null
      });
      const prods=await API.products.list();setProducts(norm.products(prods));
      if(selCust){setCustomers(prev=>prev.map(c=>c.id===selCust.id?{...c,points:(c.points||0)+Math.floor(parseFloat(ticket.totalTTC)),totalSpent:(c.totalSpent||0)+parseFloat(ticket.totalTTC)}:c));}
      setCart([]);setGDisc(0);setSelCust(null);setPromoCode("");setAvoirPayment(0);setSaleNote("");
      setTSeq(ticket.seq);setLastHash(ticket.hash);setGt(parseFloat(ticket.grandTotal));
      const fullTicket={...ticket,items:ticket.items||items,payments:ticket.payments||payments,
        date:ticket.createdAt||ticket.date,userName:currentUser?.name,
        totalHT:ticket.totalHT||parseFloat(ticket.total_ht)||tHT,totalTVA:ticket.totalTVA||parseFloat(ticket.total_tva)||tTVA,
        totalTTC:ticket.totalTTC||parseFloat(ticket.total_ttc)||tTTC,paymentMethod:ticket.paymentMethod||(payments.length===1?payments[0].method:"MIXTE"),
        customerName:selCust?`${selCust.firstName||selCust.first_name} ${selCust.lastName||selCust.last_name}`:null};
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
      if(selCust){setCustomers(prev=>prev.map(c=>c.id===selCust.id?{...c,points:(c.points||0)+Math.floor(tTTC),totalSpent:(c.totalSpent||0)+tTTC}:c));}
      // NF525: SHA-256 hash chain (même en mode offline)
      const hashInput=`${lastHash}|${ticketNumber}|${date}|${tTTC.toFixed(2)}|${(gt+tTTC).toFixed(2)}`;
      const hash=await sha256(hashInput);
      const fingerprint=hash.slice(0,8).toUpperCase();
      const ticket={ticketNumber,seq,date,items,payments,paymentMethod,
        totalHT:tHT,totalTVA:tTVA,totalTTC:tTTC,globalDiscount:gd,margin,
        hash,fingerprint,grandTotal:gt+tTTC,promosApplied:applied,
        saleNote:saleNote||null,userName:currentUser?.name,sellerName:sellerName||currentUser?.name,
        customerId:selCust?.id,customerName:selCust?`${selCust.firstName} ${selCust.lastName}`:null};
      setTSeq(seq);setLastHash(hash);setGt(g=>g+tTTC);
      setTickets(prev=>[ticket,...prev]);
      setCart([]);setGDisc(0);setSelCust(null);setPromoCode("");setAvoirPayment(0);setSaleNote("");
      addStockMove("VENTE",{name:"Panier",sku:"—"},{color:"—",size:"—"},-cart.reduce((s,i)=>s+i.quantity,0),ticketNumber);
      // Queue offline sale for sync when back online
      addPendingSync({type:"offlineSale",data:{
        items:items.map(({product,variant,...rest})=>rest),payments,customerId:selCust?.id||null,
        globalDiscount:gd,saleNote:saleNote||null,promosApplied:applied,sessionId:cashReg?.id||null,
        offlineTicketNumber:ticketNumber,offlineDate:date
      }});
      notify("Vente enregistrée (hors-ligne) — synchro en attente","warn");return ticket;
    }
  },[cart,gDisc,gDiscType,currentUser,selCust,calcPromoDiscount,promoCode,saleNote,cashReg,tSeq,gt,avoirPayment,addStockMove,notify,settings.pricingMode,addPendingSync]);

  // Stock receipt - via API
  const receiveStock=useCallback(async(productId,variantId,qty,supplier)=>{
    try{await API.stock.receive({productId,variantId,quantity:qty,supplier});
      const prods=await API.products.list();
      setProducts(norm.products(prods));
      addAudit("RECEPTION",`+${qty} — ${supplier}`);}catch(e){notify("Erreur: "+e.message,"error");}
  },[addAudit]);

  // ══ P2: Clock in/out — via API ══
  const clockIn=useCallback(async()=>{try{await API.auth.clock("IN");addAudit("CLOCK_IN",`${currentUser?.name} a pointé`);}catch(e){console.error(e);}},[currentUser,addAudit]);
  const clockOut=useCallback(async()=>{try{await API.auth.clock("OUT");addAudit("CLOCK_OUT",`${currentUser?.name} a pointé`);}catch(e){console.error(e);}},[currentUser,addAudit]);

  // ══ P2: Verify hash chain — via API ══
  const verifyChain=useCallback(async()=>{try{return await API.fiscal.verifyChain();}catch(e){return{valid:false,msg:e.message};};},[]);

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
  const updateProductPrice=useCallback((productId,newPrice)=>{
    const p=products.find(x=>x.id===productId);if(!p)return;
    setPriceHistory(prev=>[{id:Date.now(),date:new Date().toISOString(),productId,productName:p.name,oldPrice:p.price,newPrice,user:currentUser?.name},...prev]);
    setProducts(prev=>prev.map(x=>x.id===productId?{...x,price:newPrice}:x));
    addAudit("PRICE_CHANGE",`${p.name}: ${p.price.toFixed(2)}€ → ${newPrice.toFixed(2)}€`);
  },[products,currentUser,addAudit]);

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
      const clFingerprint=clHash.slice(0,8).toUpperCase();
      // Paiements par méthode
      const chequeLocal=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="cheque").reduce((a,p)=>a+p.amount,0)||0),0);
      const giftcardLocal=pt.reduce((s,t)=>s+(t.payments?.filter(p=>p.method==="giftcard").reduce((a,p)=>a+p.amount,0)||0),0);
      const cl={id:`cl-${Date.now()}`,type,period:today,date:clDate,
        ticketCount:pt.length,totalHT,totalTVA,totalTTC,totalMargin,
        expectedCash:(cashReg?.openingAmount||0)+cash,actualCash:aCash,actualCard:aCard,
        grandTotal:newGt,userName:currentUser?.name,
        hash:clHash,fingerprint:clFingerprint,
        byPayment:{cash,card,cheque:chequeLocal,giftcard:giftcardLocal},
        bySeller:pt.reduce((m,t)=>{const n=t.userName||"?";m[n]=(m[n]||0)+(t.totalTTC||0);return m;},{})};
      setClosures(p=>[cl,...p]);setGt(newGt);addAudit("CLOTURE",`Z ${type} (local)`);
      addPendingSync({type:"offlineClosure",data:{type,actualCash:aCash,actualCard:aCard,offlineId:cl.id,offlineDate:clDate}});
      notify("Clôture enregistrée (hors-ligne) — synchro en attente","warn");return cl;
    }
  },[addAudit,tickets,closures,gt,cashReg,currentUser,notify,addPendingSync]);

  // Exports — via API
  const exportFEC=useCallback(async()=>{try{await API.fiscal.fec();addJET("EXPORT","Export FEC");addAudit("FEC","Export fichier FEC");}catch(e){notify("Erreur: "+e.message,"error");}},[notify,addJET,addAudit]);

  const exportArchive=useCallback(async()=>{try{await API.fiscal.archive();addJET("EXPORT","Export archive fiscale");addAudit("EXPORT","Export archive fiscale");}catch(e){notify("Erreur: "+e.message,"error");}},[notify,addJET,addAudit]);

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

  // Find by EAN
  const findByEAN=useCallback((ean)=>{for(const p of products)for(const v of p.variants)if(v.ean===ean)return{product:p,variant:v};return null;},[products]);

  // Barcode scanner auto-start
  useEffect(()=>{const s=hardwareManager.scanner;if(!s)return;s.start();const off=s.onScan(code=>{const found=findByEAN(code);if(found)addToCart(found.product,found.variant);else notify("Code-barres inconnu: "+code,"warn");});return()=>{s.stop();off();};},[findByEAN,addToCart,notify]);

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
    const halPrinter=hardwareManager.printer;
    // Try HAL native printer first (Sunmi/PAX/iMin)
    if(halPrinter&&halPrinter.connected){
      try{
        if(type==="receipt")await halPrinter.printReceipt(data,settings,CO);
        else if(type==="avoir")await halPrinter.printAvoir(data,settings,CO);
        else if(type==="closure")await halPrinter.printClosure(data,settings,CO);
        else if(type==="test")await halPrinter.testPrint();
        else if(type==="drawer")await halPrinter.openDrawer();
        notify("Impression envoyee","success");return true;
      }catch(e){console.warn("[HAL] print failed, falling back:",e);}
    }
    // Try ESC/POS Web Serial/USB printer
    if(printer.connected){
      try{
        if(type==="receipt")await printer.printReceipt(data,settings,CO);
        else if(type==="avoir")await printer.printAvoir(data,settings,CO);
        else if(type==="closure")await printer.printClosure(data,settings,CO);
        else if(type==="test")await printer.testPrint();
        else if(type==="drawer")await printer.openDrawer();
        notify("Impression envoyee","success");return true;
      }catch(e){notify(e.message,"danger");}
    }
    // Fallback: browser iframe print
    printReceiptOnly();return false;
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
    try{const nc=await API.customers.create(c);setCustomers(p=>[...p,nc]);notify("Client créé","success");return nc;}
    catch(e){
      // Fallback local si API indisponible — pas d'erreur, juste création locale
      const nc={id:`c-${Date.now()}`,firstName:c.firstName||"",lastName:c.lastName||"",email:c.email||"",phone:c.phone||"",
        city:c.city||"",notes:c.notes||"",points:0,totalSpent:0,createdAt:new Date().toISOString()};
      setCustomers(p=>[...p,nc]);notify("Client créé","success");return nc;
    }},[notify]);

  const openReg=async(a)=>{
    const reg={openingAmount:a,openDate:new Date().toISOString()};
    setCashReg(reg);addAudit("CAISSE","Ouverture "+a+"€");
    try{const res=await API.settings.openRegister(a);if(res?.id)setCashReg(prev=>({...prev,id:res.id}));
    }catch(e){addPendingSync({type:"openRegister",data:{openingAmount:a}});console.warn("Ouverture caisse locale:",e.message);}
  };
  const closeReg=async(closingCash,closingCard)=>{
    if(cashReg?.id){try{await API.settings.closeRegister(cashReg.id,{closingCash:closingCash||null,closingCard:closingCard||null});
    }catch(e){addPendingSync({type:"closeRegister",data:{registerId:cashReg.id}});console.warn("Fermeture caisse locale:",e.message);}}
    setCashReg(null);
  };

  // ══ GIFT CARDS ══
  const[giftCards,setGiftCards]=useState(()=>{try{const s=localStorage.getItem("caissepro_giftcards");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_giftcards",JSON.stringify(giftCards));}catch(e){}},[giftCards]);
  const createGiftCard=useCallback((amount,customerName)=>{
    const code=`GC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const gc={id:Date.now(),code,initialAmount:amount,balance:amount,createdDate:new Date().toISOString(),
      customerName:customerName||"",transactions:[]};
    setGiftCards(p=>[gc,...p]);addAudit("GIFT_CARD",`Carte cadeau ${code} créée: ${amount.toFixed(2)}€`);
    notify(`Carte cadeau créée: ${code}`,"success");return gc;
  },[addAudit,notify]);
  const useGiftCard=useCallback((code,amount)=>{
    const gc=giftCards.find(g=>g.code.toUpperCase()===code.toUpperCase());
    if(!gc)return{ok:false,msg:"Carte introuvable"};
    if(gc.balance<amount)return{ok:false,msg:`Solde insuffisant: ${gc.balance.toFixed(2)}€`};
    setGiftCards(p=>p.map(g=>g.id===gc.id?{...g,balance:g.balance-amount,
      transactions:[...g.transactions,{date:new Date().toISOString(),amount:-amount,type:"DEBIT"}]}:g));
    return{ok:true,remaining:gc.balance-amount};
  },[giftCards]);
  const checkGiftCard=useCallback((code)=>{
    return giftCards.find(g=>g.code.toUpperCase()===code.toUpperCase())||null;
  },[giftCards]);

  // ══ RETURNS / AVOIRS ══
  const[avoirSeq,setAvoirSeq]=useState(()=>{try{return parseInt(localStorage.getItem("caissepro_avoirseq"))||0;}catch(e){return 0;}});
  useEffect(()=>{try{localStorage.setItem("caissepro_avoirseq",String(avoirSeq));}catch(e){}},[avoirSeq]);
  const processReturn=useCallback(async(ticket,returnItems,reason,refundMethod,doRestock=true,defective=false)=>{
    if(!returnItems.length)return null;
    // Validation: empêcher double-retour (vérifier si articles déjà retournés)
    const existingReturns=avoirs.filter(a=>a.originalTicket===ticket.ticketNumber);
    const alreadyReturned={};existingReturns.forEach(a=>(a.items||[]).forEach(i=>{
      const k=`${i.product?.id||i.product_id}-${i.variant?.id||i.variant_id}`;alreadyReturned[k]=(alreadyReturned[k]||0)+i.quantity;}));
    for(const ri of returnItems){
      const k=`${ri.productId}-${ri.variantId}`;const returned=alreadyReturned[k]||0;
      const origItem=ticket.items?.find(i=>(i.product?.id||i.product_id)===ri.productId&&(i.variant?.id||i.variant_id)===ri.variantId);
      const maxAllowed=(origItem?.quantity||ri.qty)-returned;
      if(ri.qty>maxAllowed){notify(`Article déjà retourné (max: ${maxAllowed})`,"error");return null;}}

    const seq=avoirSeq+1;const avoirNumber=`AV-${new Date().getFullYear()}-${String(seq).padStart(6,"0")}`;
    const date=new Date().toISOString();
    let totalHT=0,totalTVA=0;
    const items=returnItems.map(ri=>{
      const origItem=ticket.items?.find(i=>(i.product?.id||i.product_id)===ri.productId&&(i.variant?.id||i.variant_id)===ri.variantId);
      if(!origItem)return null;
      const unitHT=origItem.lineHT/origItem.quantity;const unitTVA=origItem.lineTVA/origItem.quantity;
      const lHT=unitHT*ri.qty;const lTVA=unitTVA*ri.qty;
      totalHT+=lHT;totalTVA+=lTVA;
      return{...origItem,quantity:ri.qty,lineHT:lHT,lineTVA:lTVA,lineTTC:lHT+lTVA};
    }).filter(Boolean);
    const totalTTC=totalHT+totalTVA;

    // NF525: SHA-256 hash chain pour avoirs
    const lastAvoirHash=avoirs.length>0?(avoirs[0].hash||""):lastHash;
    const hashInput=`${lastAvoirHash}|${avoirNumber}|${date}|${totalTTC.toFixed(2)}|AVOIR`;
    const hash=await sha256(hashInput);
    const fingerprint=hash.slice(0,8).toUpperCase();

    const avoir={avoirNumber,seq,date,originalTicket:ticket.ticketNumber,originalDate:ticket.date,
      items,totalHT,totalTVA,totalTTC,remaining:totalTTC,used:false,reason:reason||"",refundMethod,
      userId:currentUser?.id,userName:currentUser?.name,
      customerId:ticket.customerId,customerName:ticket.customerName,
      hash,fingerprint};

    // Essai API pour persister l'avoir côté serveur
    try{
      const apiResult=await API.sales.void(ticket.ticketNumber||ticket.id,reason);
      if(apiResult?.seq)avoir.seq=apiResult.seq;
      if(apiResult?.hash)avoir.hash=apiResult.hash;
      if(apiResult?.fingerprint)avoir.fingerprint=apiResult.fingerprint;
    }catch(e){
      console.warn("Avoir API échoué, mode local:",e.message);
      addPendingSync({type:"offlineAvoir",data:{saleId:ticket.ticketNumber||ticket.id,reason,avoirNumber,items:items.map(i=>({productId:i.product_id||i.product?.id,variantId:i.variant_id||i.variant?.id,qty:i.quantity}))}});
    }

    setAvoirSeq(seq);setAvoirs(p=>[avoir,...p]);

    // Restock: remettre en stock les articles retournés
    if(doRestock){
      for(const ri of returnItems){
        try{await API.stock.adjust({productId:ri.productId,variantId:ri.variantId,quantity:ri.qty,reason:defective?`Retour défectueux ${avoirNumber}`:`Retour ${avoirNumber}`,defective});}
        catch(e){
          setProducts(prev=>prev.map(p=>{if(p.id!==ri.productId)return p;
            return{...p,variants:p.variants.map(v=>v.id===ri.variantId?{...v,stock:defective?v.stock:v.stock+ri.qty,defectiveStock:(v.defectiveStock||0)+(defective?ri.qty:0)}:v)};}));
        }
      }
      // Refresh stock from API
      try{const prods=await API.products.list();setProducts(norm.products(prods));}catch(e){console.error(e);}
    }

    if(ticket.customerId){const pts=Math.floor(totalTTC);
      setCustomers(prev=>prev.map(c=>c.id===ticket.customerId?{...c,points:Math.max(0,c.points-pts),totalSpent:Math.max(0,c.totalSpent-totalTTC)}:c));}
    addAudit("AVOIR",`${avoirNumber} — Réf: ${ticket.ticketNumber} — ${totalTTC.toFixed(2)}€ — ${refundMethod}`,avoirNumber);
    addJET("AVOIR",`Avoir ${avoirNumber} émis pour ${totalTTC.toFixed(2)}€`);
    notify(`Avoir ${avoirNumber} — ${totalTTC.toFixed(2)}€`,"success");
    return avoir;
  },[avoirSeq,avoirs,lastHash,currentUser,addAudit,addJET,notify,addPendingSync]);

  // ══ CONSUME AVOIR (deduct amount when used as payment) ══
  const consumeAvoir=useCallback((avoirNumber,amount)=>{
    setAvoirs(p=>p.map(a=>{if(a.avoirNumber!==avoirNumber)return a;
      const rem=Math.max(0,(a.remaining??a.totalTTC)-amount);
      return{...a,remaining:rem,used:rem<=0};}));
    addAudit("AVOIR_USE",`Avoir ${avoirNumber} utilisé: ${amount.toFixed(2)}€`);
  },[addAudit]);

  // ══ FOOTFALL COUNTER ══
  const[footfall,setFootfall]=useState(()=>{try{const s=localStorage.getItem("caissepro_footfall");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_footfall",JSON.stringify(footfall));}catch(e){}},[footfall]);
  const addFootfall=useCallback((count,date)=>{
    const d=date||new Date().toISOString().split("T")[0];
    setFootfall(prev=>{const existing=prev.find(f=>f.date===d);
      if(existing)return prev.map(f=>f.date===d?{...f,count}:f);
      return[...prev,{date:d,count}].sort((a,b)=>b.date.localeCompare(a.date));});
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

  // ══ CUSTOMER DISPLAY (dual screen) ══
  const customerDisplayRef=useRef(null);
  const openCustomerDisplay=useCallback(()=>{
    if(customerDisplayRef.current&&!customerDisplayRef.current.closed){customerDisplayRef.current.focus();return;}
    const w=window.open("","CaisseProClient","width=800,height=600,menubar=no,toolbar=no,location=no,status=no");
    if(!w){notify("Popups bloques sur cet appareil. Sur PC, autorisez les popups. Sur tablette Sunmi, utilisez le mode kiosque.","warn");return;}
    customerDisplayRef.current=w;
    w.document.write(`<!DOCTYPE html><html><head><title>Ecran Client</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',system-ui,sans-serif;background:#F8FAF7;overflow:hidden}
      #root{height:100vh;display:flex;flex-direction:column}
      .header{background:linear-gradient(135deg,#047857,#059669);color:#fff;padding:20px 30px;text-align:center}
      .header h1{font-size:24px;font-weight:800}.header .sub{font-size:13px;opacity:0.8;margin-top:4px}
      .customer-bar{background:#065F46;color:#fff;padding:10px 30px;display:flex;align-items:center;gap:12px}
      .customer-bar .avatar{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
      .customer-bar .info{flex:1}.customer-bar .name{font-weight:600;font-size:14px}.customer-bar .loyalty{font-size:11px;opacity:0.8}
      .promos-bar{background:#FFFBEB;border-bottom:1px solid #FDE68A;padding:10px 30px;display:flex;flex-wrap:wrap;gap:8px}
      .promo-tag{background:#FEF3C7;border:1px solid #F59E0B;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;color:#92400E}
      .items{flex:1;overflow-y:auto;padding:20px 30px}.item{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #E8ECE5;font-size:16px}
      .item .name{font-weight:600;flex:1}.item .qty{color:#666;margin:0 20px}.item .price{font-weight:800;color:#047857;min-width:80px;text-align:right}
      .discount-line{display:flex;justify-content:space-between;padding:8px 0;font-size:14px;color:#059669;font-style:italic}
      .discount-line .label{flex:1}.discount-line .amount{font-weight:700}
      .total-bar{background:#fff;border-top:3px solid #047857;padding:24px 30px;display:flex;justify-content:space-between;align-items:center}
      .total-bar .label{font-size:20px;font-weight:700;color:#333}.total-bar .amount{font-size:36px;font-weight:900;color:#047857}
      .screensaver{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#F8FAF7,#E8F0E3)}
      .screensaver .logo{width:120px;height:120px;border-radius:30px;background:linear-gradient(135deg,#047857,#059669);display:flex;align-items:center;justify-content:center;color:#fff;font-size:48px;font-weight:900;margin-bottom:20px;box-shadow:0 12px 40px rgba(43,110,68,0.3)}
      .screensaver h2{font-size:28px;font-weight:800;color:#333;margin-bottom:8px}.screensaver p{font-size:16px;color:#666}
      .screensaver .time{font-size:48px;font-weight:800;color:#047857;margin-top:20px}
    </style></head><body><div id="root"><div class="screensaver"><div class="logo">CP</div><h2></h2><p>Bienvenue</p><div class="time"></div></div></div>
    <script>
      function updateTime(){const t=document.querySelector('.time');if(t)t.textContent=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}
      setInterval(updateTime,1000);updateTime();
      window.updateCart=function(data){
        const root=document.getElementById('root');
        if(!data||!data.items||data.items.length===0){
          root.innerHTML='<div class="screensaver"><div class="logo">CP</div><h2></h2><p>'+(data&&data.customer?esc(data.customer.name)+', bienvenue !':'Bienvenue')+'</p><div class="time"></div></div>';
          var h2=root.querySelector('h2');if(h2)h2.textContent=data&&data.storeName||'';
          updateTime();return;}
        var esc=function(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
        var html='<div class="header"><h1>'+esc(data.storeName)+'</h1><div class="sub">Votre panier</div></div>';
        if(data.customer){html+='<div class="customer-bar"><div class="avatar">'+esc(data.customer.name.charAt(0))+'</div><div class="info"><div class="name">'+esc(data.customer.name)+'</div>';
          if(data.customer.loyalty){html+='<div class="loyalty">'+esc(data.customer.loyalty)+'</div>';}
          html+='</div></div>';}
        if(data.promos&&data.promos.length>0){html+='<div class="promos-bar">';
          data.promos.forEach(function(p){html+='<span class="promo-tag">'+esc(p)+'</span>';});
          html+='</div>';}
        html+='<div class="items">';
        data.items.forEach(function(i){html+='<div class="item"><span class="name">'+esc(i.name)+'</span><span class="qty">x'+esc(i.qty)+'</span><span class="price">'+esc(i.price)+'</span></div>';});
        if(data.appliedPromos&&data.appliedPromos.length>0){
          data.appliedPromos.forEach(function(a){html+='<div class="discount-line"><span class="label">'+esc(a)+'</span></div>';});}
        html+='</div>';
        html+='<div class="total-bar"><span class="label">Total TTC</span><span class="amount">'+esc(data.total)+'</span></div>';
        root.innerHTML=html;};
    <\/script></body></html>`);
    w.document.close();
    notify("Ecran client ouvert — glissez-le sur le 2e moniteur","success");
  },[notify]);

  // Sync cart to customer display
  useEffect(()=>{
    if(!customerDisplayRef.current||customerDisplayRef.current.closed)return;
    try{
      const promoResult=calcPromoDiscount(cart);
      const rawTotal=cart.reduce((s,i)=>s+i.product.price*i.quantity,0);
      const totalAfterPromo=Math.max(0,rawTotal-promoResult.promoDisc).toFixed(2)+"€";
      customerDisplayRef.current.updateCart({
        storeName:settings.name||CO.name,
        customer:selCust?{name:`${selCust.firstName||""} ${selCust.lastName||selCust.name||""}`.trim(),loyalty:getLoyaltyTier(selCust.points||0)?.name||""}:null,
        promos:activePromos.map(p=>p.name).filter(Boolean),
        appliedPromos:promoResult.applied,
        items:cart.map(i=>({name:i.product.name+(i.variant?` (${i.variant.color}/${i.variant.size})`:""),qty:i.quantity,
          price:(i.product.price*i.quantity).toFixed(2)+"€"})),
        total:cart.length>0?totalAfterPromo:"0.00€"
      });
    }catch(e){}
  },[cart,settings.name,selCust,activePromos,calcPromoDiscount,getLoyaltyTier]);

  return<AppCtx.Provider value={{currentUser,login,logout,mode,setMode,offlineMode,
    stores,setStores,currentStore,setCurrentStore,selectStore,viewingStoreId,switchViewingStore,effectiveStoreId,
    products,setProducts,addProduct,customers,setCustomers,addCustomer,openCustomerDisplay,footfall,addFootfall,
    cart,addToCart,addCustomItem,removeFromCart,voidSale,updateQty,updateItemDisc,clearCart,gDisc,gDiscType,setCartGD,
    promoCode,setPromoCode,calcPromoDiscount,
    cashReg,openReg,closeReg,isOnline,tickets,tSeq,lastHash,gt,audit,jet,closures,avoirs,consumeAvoir,
    checkout,createClosure,exportArchive,exportFEC,exportCSVReport,exportCustomerRGPD,addAudit,addJET,
    promos,setPromos,activePromos,parked,parkCart,restoreCart,selCust,setSelCust,
    stockAlerts,stockMoves,addStockMove,receiveStock,
    refreshProducts,findByEAN,perm,settings,setSettings,saveSettingsToAPI,getLoyaltyTier,avoirPayment,setAvoirPayment,
    bestSellers,salesBySeller,salesByVariant,caEvolution,salesByCollection,
    saleNote,setSaleNote,clockIn,clockOut,clockEntries,verifyChain,exportCatalog,
    updateProductPrice,priceHistory,reorderSuggestions,toggleFavorite,favorites,tvaSummary,stockAging,
    duplicateProduct,salesGoals,setSellerGoal,commissions,getLastPriceForCustomer,theme,setTheme,
    notifications,notify,
    processReturn,giftCards,createGiftCard,useGiftCard,checkGiftCard,
    updateProduct,deleteProduct,addVariantToProduct,deleteVariant,
    updateCustomer,deleteCustomer,adjustStock,
    printerConnected,printerType,thermalPrint,connectPrinter,disconnectPrinter,isSunmi,isAndroid,
    hwId,hwProfile,switchHardware,hardwareProfiles:hardwareManager.profiles,
    paymentId,paymentConfig,switchPayment,updatePaymentConfig,chargePayment,refundPayment,
    paymentProfiles:hardwareManager.paymentProfiles,
    users,setUsers,tvaRates,setTvaRates,addPendingSync,pendingSync,clearPendingSync,
  }}>{children}</AppCtx.Provider>;
}

export default AppProvider;
export { AppCtx };
