import React, { useState, useEffect } from "react";
import { Lock, User as UserIcon, Store, LayoutDashboard, CheckCircle2, AlertTriangle } from "lucide-react";
import * as API from "../api.js";
import { CO, initUsers, C } from "../constants.jsx";
import { Btn, Input } from "../ui.jsx";
import { useApp } from "../context.jsx";

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

export default LoginScreen;
export { LoginScreen };
