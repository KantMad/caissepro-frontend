import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart, Lock, User as UserIcon, Store, LayoutDashboard, LogOut, Wallet,
  BarChart3, Package, Receipt, RotateCcw, Users, TrendingUp, DollarSign,
  Shield, Download, FileText, Settings, CheckCircle2, AlertTriangle, Save,
  Archive, Activity, Bell, Plus, Trash2, HelpCircle
} from "lucide-react";
import * as API from "./api.js";
import { CO, PERMS, C, initUsers } from "./constants.jsx";
import { hashPin, verifyPin } from "./utils.jsx";
import { Modal, Btn, Input, Badge, SC, ErrorBoundary, ToastContainer, ConfirmDialog } from "./ui.jsx";
import { useApp } from "./context.jsx";
import {
  LoginScreen, CashRegControl, SalesScreen, StatsScreen, StockScreen,
  HistoryScreen, ReturnScreen, ClosureScreen, CustomersScreen, FiscalScreen,
  AuditScreen, CSVImportWizard, ProductsScreen, ReturnsHistoryScreen,
  SettingsScreen, GiftCardScreen, PromosScreen, FootfallScreen,
  HelpCashierScreen, HelpDashboardScreen
} from "./screens.jsx";

function CashierNav({active,onNav}){
  const{currentUser,logout,isOnline,stockAlerts,clockIn,clockOut,pendingSync,clearPendingSync,openCustomerDisplay}=useApp();
  const items=[{id:"sales",l:"Vente",i:ShoppingCart},{id:"returns",l:"Retours",i:RotateCcw},{id:"stats",l:"Stats",i:BarChart3},{id:"stock",l:"Stock",i:Grid},
    {id:"products",l:"Produits",i:Package},{id:"history",l:"Tickets",i:Receipt},{id:"customers",l:"Clients",i:Users},{id:"giftcards",l:"Cadeaux",i:Gift},
    {id:"promos",l:"Promos",i:Zap},{id:"closure",l:"Cloture",i:Lock},{id:"footfall",l:"Entrees",i:Activity},
    {id:"audit",l:"Audit",i:Activity},{id:"fiscal",l:"NF525",i:Shield},{id:"settings",l:"Reglages",i:Settings},{id:"help",l:"Aide",i:HelpCircle}];
  return(<div style={{width:72,background:"#0F172A",display:"flex",flexDirection:"column",alignItems:"center",padding:"14px 0",gap:2}}>
    <div style={{width:38,height:38,borderRadius:10,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center",
      color:"#fff",fontWeight:700,fontSize:14,marginBottom:6}}>{currentUser?.name?.[0]}</div>
    <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:4}}>
      <div style={{width:6,height:6,borderRadius:3,background:isOnline?"#34D399":"#F87171"}}/>
      <span style={{fontSize:8,color:"rgba(255,255,255,0.5)",fontWeight:500}}>{isOnline?"En ligne":"Offline"}</span></div>
    {pendingSync.length>0&&<div onClick={()=>clearPendingSync()}
      style={{fontSize:8,color:"#FBBF24",fontWeight:600,marginBottom:2,cursor:"pointer"}} title="Cliquer pour vider la file de synchro">{pendingSync.length} sync</div>}
    <div style={{display:"flex",gap:3,marginBottom:10}}>
      <button onClick={clockIn} title="Pointer entree" style={{width:26,height:22,borderRadius:6,border:"none",cursor:"pointer",background:"rgba(52,211,153,0.15)",color:"#34D399",fontSize:8,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>IN</button>
      <button onClick={clockOut} title="Pointer sortie" style={{width:26,height:22,borderRadius:6,border:"none",cursor:"pointer",background:"rgba(248,113,113,0.15)",color:"#F87171",fontSize:8,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>OUT</button></div>
    <div style={{flex:1,display:"flex",flexDirection:"column",gap:1,overflowY:"auto",width:"100%",padding:"0 8px"}}>
      {items.map(({id,l,i:I})=>(<button key={id} onClick={()=>onNav(id)} title={l} style={{width:"100%",height:46,borderRadius:10,border:"none",cursor:"pointer",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,
        background:active===id?"rgba(255,255,255,0.1)":"transparent",
        color:active===id?"#fff":"rgba(255,255,255,0.45)",position:"relative",
        transition:"all 0.2s cubic-bezier(0.16,1,0.3,1)",fontFamily:"inherit"}}
        onMouseEnter={e=>{if(active!==id)e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color="rgba(255,255,255,0.8)";}}
        onMouseLeave={e=>{if(active!==id)e.currentTarget.style.background="transparent";e.currentTarget.style.color=active===id?"#fff":"rgba(255,255,255,0.45)";}}>
        <I size={16}/><span style={{fontSize:8,fontWeight:active===id?600:500,lineHeight:1,letterSpacing:"-0.01em"}}>{l}</span>
        {id==="stock"&&stockAlerts.length>0&&<span style={{position:"absolute",top:4,right:6,width:14,height:14,borderRadius:7,
          background:C.danger,color:"#fff",fontSize:8,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{stockAlerts.length}</span>}
      </button>))}</div>
    <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:8,width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <button onClick={openCustomerDisplay} title="Ecran client" style={{width:"calc(100% - 16px)",height:34,borderRadius:8,border:"none",cursor:"pointer",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
        background:"rgba(56,189,248,0.08)",color:"#38BDF8",fontFamily:"inherit",transition:"all 0.15s",fontSize:8,fontWeight:500}}
        onMouseEnter={e=>e.currentTarget.style.background="rgba(56,189,248,0.15)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(56,189,248,0.08)"}>
        <LayoutDashboard size={13}/><span>Ecran 2</span></button>
      <button onClick={logout} title="Deconnexion" style={{width:"calc(100% - 16px)",height:40,borderRadius:8,border:"none",cursor:"pointer",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,
        background:"rgba(248,113,113,0.08)",color:"#F87171",fontFamily:"inherit",transition:"all 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background="rgba(248,113,113,0.15)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(248,113,113,0.08)"}>
        <LogOut size={14}/><span style={{fontSize:8,fontWeight:500}}>Sortir</span></button></div></div>);
}

function CashierInterface(){
  const{cashReg}=useApp();
  const[sr,setSr]=useState(()=>{try{return!localStorage.getItem("caissepro_cashreg");}catch(e){return true;}});
  const[sc,setScRaw]=useState(()=>{try{return sessionStorage.getItem("caissepro_screen")||"sales";}catch(e){return"sales";}});
  const setSc=useCallback((v)=>{setScRaw(v);try{sessionStorage.setItem("caissepro_screen",v);}catch(e){}},[]);
  if(sr&&!cashReg)return<CashRegControl onSkip={()=>setSr(false)} onDone={()=>setSr(false)}/>;
  const S={sales:SalesScreen,returns:ReturnScreen,stats:StatsScreen,stock:StockScreen,history:HistoryScreen,customers:CustomersScreen,
    giftcards:GiftCardScreen,promos:PromosScreen,products:ProductsScreen,closure:ClosureScreen,footfall:FootfallScreen,audit:AuditScreen,fiscal:FiscalScreen,settings:SettingsScreen,help:HelpCashierScreen};
  const Sc=S[sc]||SalesScreen;
  return(<div style={{display:"flex",height:"100vh",fontFamily:"'DM Sans',system-ui,sans-serif"}}><CashierNav active={sc} onNav={setSc}/><div style={{flex:1,overflow:"hidden"}}><ErrorBoundary><Sc/></ErrorBoundary></div></div>);
}

/* ══════════ USERS SCREEN ══════════ */
function UsersScreen(){
  const{users,setUsers,notify,isOnline,addPendingSync}=useApp();
  const[editUser,setEditUser]=useState(null);const[newModal,setNewModal]=useState(false);
  const[form,setForm]=useState({name:"",role:"cashier",pin:""});
  const[confirmDel,setConfirmDel]=useState(null);
  const openEdit=(u)=>{setForm({name:u.name,role:u.role,pin:""});setEditUser(u);};
  const saveUser=async()=>{
    if(!form.name){notify("Nom requis","error");return;}
    // Pour un nouvel utilisateur, le PIN est obligatoire. Pour une modification, il est optionnel.
    if(!editUser&&!form.pin){notify("Nom et PIN requis","error");return;}
    // Hash PIN before storing locally (server receives plaintext for its own hashing)
    const hashedPin=form.pin?await hashPin(form.pin):null;
    // Construire les données API — n'envoyer le password que s'il a été modifié
    const apiData={name:form.name,role:form.role};
    if(form.pin)apiData.password=form.pin;
    if(editUser){
      setUsers(p=>p.map(u=>u.id===editUser.id?{...u,name:form.name,role:form.role,...(hashedPin?{pin:hashedPin}:{})}:u));
      // Sync modification avec l'API
      try{await API.auth.updateUser(editUser.id,apiData);
        setEditUser(null);notify("Utilisateur modifié et synchronisé","success");
      }catch(e){
        console.error("updateUser error:",e.message,editUser.id,apiData);
        setEditUser(null);
        if(!isOnline||e.message?.includes("fetch")||e.message?.includes("network")||e.message?.includes("Failed")){
          addPendingSync({type:"updateUser",userId:editUser.id,data:apiData});
          notify("Hors ligne — synchro en attente","warn");
        }else{notify(`Erreur serveur: ${e.message}`,"error");}
      }
    }else{
      try{
        const apiUser=await API.auth.createUser(apiData);
        setUsers(p=>[...p,{id:apiUser.id||("u"+Date.now()),name:form.name,role:form.role,pin:hashedPin,apiSynced:true}]);
        setNewModal(false);notify("Utilisateur créé et synchronisé","success");
      }catch(e){
        console.error("createUser error:",e.message,apiData);
        if(!isOnline||e.message?.includes("fetch")||e.message?.includes("network")||e.message?.includes("Failed")){
          const localId="u"+Date.now();
          setUsers(p=>[...p,{id:localId,name:form.name,role:form.role,pin:hashedPin,pendingSync:true}]);
          addPendingSync({type:"createUser",data:apiData,localId});
          setNewModal(false);notify("Hors ligne — synchro en attente","warn");
        }else{setNewModal(false);notify(`Erreur serveur: ${e.message}`,"error");}
      }
    }
    setForm({name:"",role:"cashier",pin:""});};
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>Utilisateurs ({users.length})</h2>
      <Btn onClick={()=>{setForm({name:"",role:"cashier",pin:""});setNewModal(true);}} style={{fontSize:11,background:C.primary}}><Plus size={12}/> Nouvel utilisateur</Btn></div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {users.map(u=>(<div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:12,borderRadius:12,background:C.surface,border:`1.5px solid ${C.border}`}}>
        <div style={{width:36,height:36,borderRadius:18,background:u.role==="admin"?C.accent:C.primary,
          display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13}}>{u.name[0]}</div>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{u.name}</div>
          <div style={{fontSize:10,color:C.textMuted}}>{u.role==="admin"?"Administrateur":"Caissier(e)"} — PIN: ****</div></div>
        <Badge color={u.role==="admin"?C.accent:C.primary}>{u.role}</Badge>
        {u.pendingSync&&<Badge color={C.warn}>⏳ Synchro en attente</Badge>}
        <Btn variant="outline" onClick={()=>openEdit(u)} style={{fontSize:10,padding:"4px 10px"}}><Settings size={11}/> Modifier</Btn>
        <Btn variant="ghost" onClick={()=>setConfirmDel(u)} style={{color:C.danger,padding:"4px 8px"}}><Trash2 size={11}/></Btn>
      </div>))}</div>
    <Modal open={newModal||!!editUser} onClose={()=>{setNewModal(false);setEditUser(null);}} title={editUser?"Modifier l'utilisateur":"Nouvel utilisateur"}>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>NOM</label><Input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>RÔLE</label>
          <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
            <option value="admin">Administrateur</option><option value="cashier">Caissier(e)</option></select></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>CODE PIN {editUser?"(laisser vide pour ne pas changer)":""}</label><Input type="password" value={form.pin} onChange={e=>setForm(p=>({...p,pin:e.target.value}))} placeholder={editUser?"Nouveau PIN (optionnel)":"1234"}/></div></div>
      <Btn onClick={saveUser} style={{width:"100%",height:40,background:C.primary}}><Save size={14}/> {editUser?"Enregistrer":"Créer"}</Btn></Modal>
    <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={async()=>{
      setUsers(p=>p.filter(u=>u.id!==confirmDel.id));
      try{await API.auth.deleteUser(confirmDel.id);notify("Utilisateur supprimé et synchronisé","warn");
      }catch(e){addPendingSync({type:"deleteUser",userId:confirmDel.id});notify("Utilisateur supprimé localement — synchro en attente","warn");}}}
      title="Supprimer cet utilisateur ?" message={`Supprimer ${confirmDel?.name} ?`}/>
  </div>);
}

function DashboardNav({active,onNav}){
  const{logout,currentUser}=useApp();
  const sections=[
    {title:"",items:[{id:"overview",l:"Dashboard",i:LayoutDashboard}]},
    {title:"Commerce",items:[{id:"products",l:"Produits",i:Package},{id:"stock",l:"Stock",i:Grid},{id:"stats",l:"Statistiques",i:BarChart3},{id:"returns",l:"Retours & Avoirs",i:RotateCcw}]},
    {title:"Relations",items:[{id:"customers",l:"Clients",i:Users},{id:"users",l:"Utilisateurs",i:UserIcon},{id:"giftcards",l:"Cartes cadeaux",i:Gift},{id:"promos",l:"Promotions",i:Zap},{id:"footfall",l:"Entrees",i:Activity}]},
    {title:"Systeme",items:[{id:"tva",l:"Taux de TVA",i:Percent},{id:"settings",l:"Parametres",i:Settings},{id:"fiscal",l:"Fiscal NF525",i:Shield},{id:"audit",l:"Journal d'audit",i:Activity},{id:"help",l:"Aide",i:HelpCircle}]}];
  return(<div style={{width:240,background:"#0F172A",height:"100vh",display:"flex",flexDirection:"column"}}>
    <div style={{padding:"20px 20px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <div style={{width:34,height:34,borderRadius:9,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center"}}><Store size={17} color="#fff"/></div>
        <div><div style={{color:"#fff",fontSize:14,fontWeight:700,letterSpacing:"-0.3px"}}>CaissePro</div>
          <div style={{color:"rgba(255,255,255,0.4)",fontSize:10}}>v{CO.ver}</div></div></div>
      <div style={{padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:600}}>{currentUser?.name?.[0]}</div>
        <div><div style={{color:"#fff",fontSize:12,fontWeight:500}}>{currentUser?.name}</div>
          <div style={{color:"rgba(255,255,255,0.35)",fontSize:10}}>{currentUser?.role==="admin"?"Administrateur":"Caissier"}</div></div></div></div>
    <nav style={{flex:1,padding:"12px 12px",overflowY:"auto"}}>
      {sections.map((sec,si)=>(<div key={si} style={{marginBottom:sec.title?16:8}}>
        {sec.title&&<div style={{fontSize:10,fontWeight:500,color:"rgba(255,255,255,0.3)",padding:"0 10px",marginBottom:6,letterSpacing:"0.02em"}}>{sec.title}</div>}
        {sec.items.map(({id,l,i:I})=>(<button key={id} onClick={()=>onNav(id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,border:"none",cursor:"pointer",marginBottom:1,
      background:active===id?"rgba(255,255,255,0.08)":"transparent",color:active===id?"#fff":"rgba(255,255,255,0.5)",fontSize:12,fontWeight:active===id?500:400,textAlign:"left",
      transition:"all 0.15s",fontFamily:"inherit"}}
      onMouseEnter={e=>{if(active!==id){e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.color="rgba(255,255,255,0.8)";}}}
      onMouseLeave={e=>{if(active!==id){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.5)";}}}><I size={15}/>{l}</button>))}</div>))}</nav>
    <div style={{padding:"12px 12px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <button onClick={logout} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"none",cursor:"pointer",
        background:"rgba(248,113,113,0.06)",color:"#F87171",fontSize:12,fontWeight:500,textAlign:"left",fontFamily:"inherit",transition:"all 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background="rgba(248,113,113,0.12)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(248,113,113,0.06)"}>
        <LogOut size={14}/> Deconnexion</button></div></div>);
}

function DashOverview(){
  const{gt,tickets,closures,stockAlerts,bestSellers,perm:p}=useApp();
  const[apiStats,setApiStats]=useState(null);const[apiBest,setApiBest]=useState(null);
  useEffect(()=>{
    API.sales.stats().then(d=>setApiStats(d)).catch(()=>{});
    API.sales.bestSellers().then(d=>setApiBest(Array.isArray(d)?d:[])).catch(()=>{});
  },[]);
  // Use backend stats if available, fallback to local computation
  const margin=apiStats?parseFloat(apiStats.total_margin)||0:tickets.reduce((s,t)=>s+(parseFloat(t.margin)||0),0);
  const todayStr=new Date().toISOString().split("T")[0];
  const todayTk=tickets.filter(t=>(t.date||t.createdAt||t.created_at||"").startsWith(todayStr));
  const todayCA=todayTk.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0);
  const todayCount=todayTk.length;
  const todayAvg=todayCount?todayCA/todayCount:0;
  const totalTickets=apiStats?parseInt(apiStats.ticket_count)||tickets.length:tickets.length;
  const totalCA=apiStats?parseFloat(apiStats.grand_total)||parseFloat(gt)||0:parseFloat(gt)||0;
  const displayBest=apiBest&&apiBest.length?apiBest:bestSellers;
  return(<div style={{height:"100%",overflowY:"auto",padding:24,background:C.bg}}>
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:20,fontWeight:700,margin:"0 0 4px",letterSpacing:"-0.4px",color:C.text}}>Dashboard</h2>
      <p style={{fontSize:13,color:C.textMuted}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p></div>

    {/* Today's summary */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2,marginBottom:20,background:C.surface,borderRadius:14,overflow:"hidden",
      boxShadow:`0 1px 3px ${C.shadow}, 0 0 0 1px ${C.border}`}}>
      <div style={{padding:"18px 20px",borderRight:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,color:C.textMuted,marginBottom:4,fontWeight:500}}>Ventes aujourd'hui</div>
        <div style={{fontSize:26,fontWeight:700,letterSpacing:"-0.5px",color:C.text}}>{todayCount}</div></div>
      <div style={{padding:"18px 20px",borderRight:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,color:C.textMuted,marginBottom:4,fontWeight:500}}>CA du jour</div>
        <div style={{fontSize:26,fontWeight:700,letterSpacing:"-0.5px",color:C.primary}}>{todayCA.toFixed(0)}€</div></div>
      <div style={{padding:"18px 20px"}}>
        <div style={{fontSize:11,color:C.textMuted,marginBottom:4,fontWeight:500}}>Panier moyen</div>
        <div style={{fontSize:26,fontWeight:700,letterSpacing:"-0.5px",color:C.text}}>{todayAvg.toFixed(1)}€</div></div></div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
      <SC icon={DollarSign} label="CA total (GT)" value={`${totalCA.toFixed(0)}€`} color={C.primary}/>
      {p().canViewMargin&&<SC icon={TrendingUp} label="Marge" value={`${margin.toFixed(0)}€`} color="#059669"/>}
      <SC icon={Receipt} label="Tickets" value={totalTickets} color={C.info}/>
      <SC icon={AlertTriangle} label="Alertes stock" value={stockAlerts.length} color={stockAlerts.length>0?C.danger:C.textLight}/></div>
    {stockAlerts.length>0&&<div style={{background:C.surface,borderRadius:12,padding:14,marginBottom:16,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.warn}`}}>
      <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8,display:"flex",alignItems:"center",gap:6}}><Bell size={14} color={C.warn}/> Alertes de stock</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{stockAlerts.slice(0,8).map((a,i)=>(<Badge key={i} color={a.level==="rupture"?C.danger:C.warn}>{a.product.name} {a.variant.color}/{a.variant.size}: {a.variant.stock}</Badge>))}</div></div>}
    {displayBest.length>0&&<div style={{background:C.surface,borderRadius:14,padding:20,boxShadow:`0 1px 3px ${C.shadow}, 0 0 0 1px ${C.border}`}}>
      <div style={{fontSize:14,fontWeight:600,marginBottom:12,color:C.text}}>Meilleures ventes</div>
      {displayBest.slice(0,5).map((b,i)=>(<div key={b.sku||b.product_name||i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<4?`1px solid ${C.surfaceAlt}`:"none"}}>
        <span style={{fontSize:12,fontWeight:700,color:i<3?C.primary:C.textLight,width:22,height:22,borderRadius:6,background:i<3?C.primaryLight:C.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</span>
        <span style={{flex:1,fontSize:13,fontWeight:500,color:C.text}}>{b.name||b.product_name}</span>
        <span style={{fontSize:12,color:C.textMuted}}>{b.qty||b.total_qty} vendus</span>
        <span style={{fontSize:13,fontWeight:600,color:C.primary}}>{(parseFloat(b.revenue)||0).toFixed(0)}€</span></div>))}</div>}
  </div>);
}

/* ══════════ TVA MANAGEMENT ══════════ */
function TVAScreen(){
  const{tvaRates,setTvaRates,addAudit,notify}=useApp();
  const[newLabel,setNewLabel]=useState("");const[newRate,setNewRate]=useState("");
  const[editId,setEditId]=useState(null);const[editLabel,setEditLabel]=useState("");const[editRate,setEditRate]=useState("");
  const addRate=()=>{if(!newLabel||!newRate)return;const r=parseFloat(newRate);if(isNaN(r))return;
    const id=`tva-${Date.now()}`;setTvaRates(p=>[...p,{id,label:newLabel,rate:r>1?r/100:r}]);
    setNewLabel("");setNewRate("");addAudit("TVA",`Ajout taux: ${newLabel}`);notify("Taux TVA ajouté");};
  const saveEdit=()=>{if(!editLabel||!editRate)return;const r=parseFloat(editRate);if(isNaN(r))return;
    setTvaRates(p=>p.map(t=>t.id===editId?{...t,label:editLabel,rate:r>1?r/100:r}:t));
    setEditId(null);addAudit("TVA",`Modification taux: ${editLabel}`);notify("Taux TVA modifié");};
  const removeRate=(id)=>{if(tvaRates.length<=1){notify("Au moins un taux requis","warn");return;}
    setTvaRates(p=>p.filter(t=>t.id!==id));addAudit("TVA","Suppression taux TVA");notify("Taux supprimé","warn");};
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:16}}>Gestion des taux de TVA</h2>
    <div style={{maxWidth:600}}>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Taux de TVA actifs ({tvaRates.length})</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {tvaRates.map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:10,borderRadius:10,border:`1.5px solid ${C.border}`,background:editId===t.id?C.primaryLight:"transparent"}}>
              {editId===t.id?<>
                <Input value={editLabel} onChange={e=>setEditLabel(e.target.value)} style={{flex:1,height:34,fontSize:12}} placeholder="Libellé"/>
                <Input type="number" step="0.01" value={editRate} onChange={e=>setEditRate(e.target.value)} style={{width:80,height:34,fontSize:12,textAlign:"center"}} placeholder="%"/>
                <Btn variant="success" onClick={saveEdit} style={{height:34,fontSize:10,padding:"0 10px"}}><Save size={11}/></Btn>
                <Btn variant="outline" onClick={()=>setEditId(null)} style={{height:34,fontSize:10,padding:"0 10px"}}>✕</Btn>
              </>:<>
                <div style={{flex:1}}>
                  <span style={{fontSize:13,fontWeight:600}}>{t.label}</span>
                  <span style={{fontSize:11,color:C.textMuted,marginLeft:8}}>({(t.rate*100).toFixed(2)}%)</span></div>
                <Badge color={C.primary}>{(t.rate*100).toFixed(t.rate*100%1===0?0:1)}%</Badge>
                <button onClick={()=>{setEditId(t.id);setEditLabel(t.label);setEditRate(String(t.rate*100));}} style={{background:"none",border:"none",cursor:"pointer",color:C.primary,fontSize:10,fontWeight:600}}>Modifier</button>
                <button onClick={()=>removeRate(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.danger,fontSize:10,fontWeight:600}}><Trash2 size={12}/></button>
              </>}
            </div>))}</div></div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>Ajouter un taux</div>
        <div style={{display:"flex",gap:8,alignItems:"end"}}>
          <div style={{flex:1}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>LIBELLÉ</label>
            <Input value={newLabel} onChange={e=>setNewLabel(e.target.value)} placeholder="Ex: Super réduit 2,1%"/></div>
          <div style={{width:100}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>TAUX (%)</label>
            <Input type="number" step="0.01" value={newRate} onChange={e=>setNewRate(e.target.value)} placeholder="2.1"/></div>
          <Btn onClick={addRate} disabled={!newLabel||!newRate} style={{height:42,background:C.primary}}><Plus size={14}/> Ajouter</Btn>
        </div></div>

      <div style={{background:C.surfaceAlt,borderRadius:12,padding:14,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>ℹ️ Taux de TVA légaux en France</div>
        <div style={{fontSize:10,color:C.textMuted,lineHeight:1.6}}>
          <strong>20%</strong> — Taux normal (vêtements, accessoires, etc.)<br/>
          <strong>10%</strong> — Taux intermédiaire (restauration sur place, transports)<br/>
          <strong>5,5%</strong> — Taux réduit (alimentation, livres, énergie)<br/>
          <strong>2,1%</strong> — Taux super réduit (presse, médicaments remboursés)<br/>
          Les produits existants ne sont pas modifiés. Changez la TVA de chaque produit individuellement.</div></div>
    </div></div>);
}

function DashboardInterface(){
  const[sc,setScRaw]=useState(()=>{try{return sessionStorage.getItem("caissepro_dash_screen")||"overview";}catch(e){return"overview";}});
  const setSc=useCallback((v)=>{setScRaw(v);try{sessionStorage.setItem("caissepro_dash_screen",v);}catch(e){}},[]);
  const S={overview:DashOverview,products:ProductsScreen,stock:StockScreen,stats:StatsScreen,returns:ReturnsHistoryScreen,customers:CustomersScreen,
    users:UsersScreen,tva:TVAScreen,giftcards:GiftCardScreen,promos:PromosScreen,footfall:FootfallScreen,settings:SettingsScreen,fiscal:FiscalScreen,audit:AuditScreen,help:HelpDashboardScreen};
  const Sc=S[sc]||DashOverview;
  return(<div style={{display:"flex",height:"100vh",fontFamily:"'DM Sans',system-ui,sans-serif"}}><DashboardNav active={sc} onNav={setSc}/><div style={{flex:1,overflow:"hidden"}}><ErrorBoundary><Sc/></ErrorBoundary></div></div>);
}

function AppContent(){const{currentUser,mode}=useApp();if(!currentUser)return<LoginScreen/>;return mode==="cashier"?<CashierInterface/>:<DashboardInterface/>;}

export default function App(){
  return(<AppProvider><AppContent/><ToastContainer/>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}
      html,body,#root{height:100%;min-height:100vh;background:${C.bg}}
      body{font-family:'DM Sans',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:${C.text};font-size:14px;letter-spacing:-0.01em}
      ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.borderDark};border-radius:4px}::-webkit-scrollbar-thumb:hover{background:${C.textLight}}
      @keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}
      @keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}
      @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      @keyframes modalPop{from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @keyframes successPulse{0%{transform:scale(0.8);opacity:0}50%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
      @keyframes checkDraw{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}
      .spin-loader{display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite}
      button:active{transform:scale(0.97)!important}button{transition:all 0.2s cubic-bezier(0.16,1,0.3,1)}
      input:focus,select:focus,textarea:focus{outline:none;border-color:${C.primary}!important;box-shadow:0 0 0 3px ${C.primary}10!important}
      ::selection{background:${C.primary}15;color:${C.primaryDark}}
      select{cursor:pointer;font-family:inherit}
      @media print{body *{visibility:hidden!important}[data-print-receipt],[data-print-receipt] *{visibility:visible!important}
        [data-print-receipt]{position:absolute!important;left:0!important;top:0!important;width:72mm!important;padding:4mm!important;background:#fff!important;border:none!important;box-shadow:none!important;border-radius:0!important}
        @page{size:72mm auto;margin:2mm}}
      @media (max-width:1024px){.hide-md{display:none!important}}`}</style>
  </AppProvider>);
}

export { CashierNav, CashierInterface, UsersScreen, DashboardNav, DashOverview, TVAScreen, DashboardInterface, AppContent };
