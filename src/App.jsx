import React, { useState, useMemo, useEffect, useRef, createContext, useContext, useCallback, Component } from "react";
import {
  ShoppingCart, Search, Trash2, Percent, CreditCard, Banknote, Gift, Plus, Minus,
  Lock, User as UserIcon, Store, LayoutDashboard, LogOut, Wallet, XCircle,
  BarChart3, Package, Receipt, RotateCcw, Users, TrendingUp, DollarSign,
  Shield, Download, FileText, Settings, CheckCircle2, AlertTriangle, Save,
  Archive, Activity, Database, WifiOff, Pause, Play, Upload, Printer, Bell,
  Heart, Grid, Box, Star, Calendar, Zap, ScanLine, Split,
  Mail, XOctagon, Edit, BarChart2, Check
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar
} from "recharts";
import Papa from "papaparse";
import * as API from "./api.js";
import printer, { PAPER_48, PAPER_32 } from "./printer.js";

/* ══════════ FISCAL — Désormais côté serveur (VPS) ══════════ */

/* ══════════ COMPANY ══════════ */
const CO={name:"Ma Boutique Textile",address:"12 rue de la Mode",postalCode:"75001",city:"Paris",
  siret:"123 456 789 00012",tvaIntra:"FR 12 345678900",phone:"01 23 45 67 89",sw:"CaissePro",ver:"5.0.0",
  logo:"",footerMsg:"Merci de votre visite !",legalForm:"SARL",capital:"10 000 €"};

/* ══════════ TVA RATES ══════════ */
const DEFAULT_TVA_RATES=[{id:"normal",label:"Normal 20%",rate:0.20},{id:"inter",label:"Intermédiaire 10%",rate:0.10},{id:"reduit",label:"Réduit 5,5%",rate:0.055}];
let TVA_RATES=[...DEFAULT_TVA_RATES];

/* ══════════ PRICING MODE HELPERS ══════════ */
// pricingMode: "TTC" = prices stored are TTC, "HT" = prices stored are HT
// When TTC: HT = price / (1 + taxRate), TVA = price - HT
// When HT:  TVA = price * taxRate, TTC = price + TVA
const getPriceHT=(price,taxRate,mode)=>mode==="TTC"?price/(1+(taxRate||0.20)):price;
const getPriceTTC=(price,taxRate,mode)=>mode==="TTC"?price:price*(1+(taxRate||0.20));

/* ══════════ NF525 — SHA-256 Hash (Web Crypto API) ══════════ */
async function sha256(str){
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

/* ══════════ PERMISSIONS ══════════ */
const PERMS={
  admin:{maxDiscount:100,canVoid:true,canExport:true,canSettings:true,canCloseZ:true,canCreateProduct:true,canViewMargin:true,canManagePromos:true},
  cashier:{maxDiscount:20,canVoid:false,canExport:false,canSettings:false,canCloseZ:true,canCreateProduct:false,canViewMargin:false,canManagePromos:false},
};

/* ══════════ DATA ══════════ */
const initProducts=[
  {id:"1",name:"T-shirt Basique",sku:"TS-001",price:29.90,costPrice:12.00,taxRate:0.20,category:"T-shirts",collection:"PE-2026",
    variants:[{id:"v1",color:"Blanc",size:"S",ean:"3760123450011",stock:15,defective:0,stockAlert:5},
      {id:"v2",color:"Blanc",size:"M",ean:"3760123450012",stock:20,defective:0,stockAlert:5},
      {id:"v3",color:"Noir",size:"M",ean:"3760123450022",stock:18,defective:0,stockAlert:5},
      {id:"v4",color:"Noir",size:"L",ean:"3760123450023",stock:2,defective:0,stockAlert:5}]},
  {id:"2",name:"Jean Slim",sku:"JN-001",price:79.90,costPrice:32.00,taxRate:0.20,category:"Jeans",collection:"PE-2026",
    variants:[{id:"v7",color:"Bleu",size:"38",ean:"3760123460012",stock:12,defective:0,stockAlert:3},
      {id:"v9",color:"Bleu",size:"40",ean:"3760123460013",stock:1,defective:0,stockAlert:3},
      {id:"v10",color:"Noir",size:"38",ean:"3760123460022",stock:9,defective:0,stockAlert:3}]},
  {id:"3",name:"Robe Été",sku:"RB-001",price:59.90,costPrice:22.00,taxRate:0.20,category:"Robes",collection:"PE-2026",
    variants:[{id:"v13",color:"Fleurie",size:"S",ean:"3760123470011",stock:5,defective:0,stockAlert:3},
      {id:"v14",color:"Fleurie",size:"M",ean:"3760123470012",stock:8,defective:0,stockAlert:3}]},
  {id:"4",name:"Pull Mérinos",sku:"PL-001",price:49.90,costPrice:20.00,taxRate:0.20,category:"Pulls",collection:"AH-2025",
    variants:[{id:"v18",color:"Gris",size:"M",ean:"3760123480011",stock:10,defective:0,stockAlert:3},
      {id:"v20",color:"Beige",size:"M",ean:"3760123480021",stock:2,defective:0,stockAlert:3}]},
  {id:"5",name:"Chemise Lin",sku:"CH-001",price:69.90,costPrice:28.00,taxRate:0.10,category:"Chemises",collection:"PE-2026",
    variants:[{id:"v22",color:"Blanc",size:"M",ean:"3760123490012",stock:11,defective:0,stockAlert:3}]},
  {id:"6",name:"Veste Blazer",sku:"VT-001",price:129.90,costPrice:52.00,taxRate:0.20,category:"Vestes",collection:"AH-2025",
    variants:[{id:"v30",color:"Noir",size:"M",ean:"3760123510011",stock:4,defective:0,stockAlert:2}]},
];
const initUsers=[{id:"1",name:"Admin",password:"1234",role:"admin"},{id:"2",name:"Sophie",password:"1234",role:"cashier"},{id:"3",name:"Marc",password:"1234",role:"cashier"}];
const initCustomers=[
  {id:"1",firstName:"Marie",lastName:"Dupont",email:"marie.dupont@email.com",phone:"0612345678",city:"Paris",points:120,totalSpent:450,notes:"Préfère les couleurs claires, taille M"},
  {id:"2",firstName:"Jean",lastName:"Martin",email:"jean.martin@email.com",phone:"0623456789",city:"Lyon",points:85,totalSpent:320,notes:""},
  {id:"3",firstName:"Sophie",lastName:"Bernard",email:"sophie.bernard@email.com",phone:"0634567890",city:"Paris",points:200,totalSpent:780,notes:"Cliente VIP, achète chaque saison"},
];
const LOYALTY_TIERS=[{minPoints:0,name:"Bronze",discount:0},{minPoints:100,name:"Argent",discount:5},{minPoints:250,name:"Or",discount:10},{minPoints:500,name:"Platine",discount:15}];
const initPromos=[
  {id:"1",name:"Soldes été -30%",type:"collection_discount",value:30,collection:"PE-2026",active:true,startDate:"2026-06-25",endDate:"2026-08-05",code:""},
  {id:"2",name:"3 achetés = -20%",type:"qty_discount",minQty:3,value:20,active:false,code:"",collection:"",startDate:"",endDate:""},
  {id:"3",name:"Code WELCOME10",type:"code",value:10,code:"WELCOME10",active:true,collection:"",startDate:"",endDate:""},
];
const categories=["Tous","T-shirts","Jeans","Robes","Pulls","Chemises","Vestes"];

/* ══════════ DESIGN ══════════ */
const C={bg:"#F5F5F0",surface:"#FFFFFF",surfaceAlt:"#F0EFEB",surfaceHover:"#FAFAF8",text:"#1A1A1A",textMuted:"#7A7A7A",textLight:"#AEAEAE",
  primary:"#2B6E44",primaryLight:"#E4F2E9",primaryDark:"#1B4A2E",accent:"#C4956A",accentLight:"#F5EDE5",
  danger:"#D1453B",dangerLight:"#FDECEB",info:"#3D7BD9",infoLight:"#EBF2FD",border:"#E2E0DB",borderDark:"#CCC9C3",
  gradientB:"#4DA768",fiscal:"#6B4FA0",fiscalLight:"#F0EEFE",warn:"#E0A818",warnLight:"#FEF8E3",
  shadow:"rgba(0,0,0,0.06)",shadowMd:"rgba(0,0,0,0.10)",shadowLg:"rgba(0,0,0,0.14)"};
const CAT_COLORS={"T-shirts":"#3D7BD9","Jeans":"#2B6E44","Robes":"#C4956A","Pulls":"#8B6FC0","Chemises":"#E0A818","Vestes":"#D1453B","Divers":"#7A7A7A"};

/* ══════════ UI ══════════ */
const Modal=({open,onClose,title,sub,children,wide})=>{if(!open)return null;return(
  <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.18s ease"}} onClick={onClose}>
    <div style={{position:"absolute",inset:0,background:"rgba(10,10,10,0.45)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}/>
    <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:C.surface,borderRadius:24,padding:0,
      width:wide?"800px":"480px",maxWidth:"94vw",maxHeight:"90vh",overflowY:"auto",
      boxShadow:"0 32px 100px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)",animation:"modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1)"}}>
      {title&&<div style={{padding:"20px 28px 0 28px",display:"flex",alignItems:"start",justifyContent:"space-between"}}>
        <div><h2 style={{fontSize:19,fontWeight:800,marginBottom:sub?3:0,letterSpacing:"-0.3px"}}>{title}</h2>
          {sub&&<p style={{fontSize:12,color:C.textMuted,marginTop:2}}>{sub}</p>}</div>
        <button onClick={onClose} style={{background:C.surfaceAlt,border:"none",borderRadius:10,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:12,transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.background=C.dangerLight} onMouseLeave={e=>e.currentTarget.style.background=C.surfaceAlt}>
          <XCircle size={15} color={C.textMuted}/></button></div>}
      <div style={{padding:title?"16px 28px 28px":"28px"}}>{children}</div></div></div>);};
const Btn=({children,onClick,variant="primary",disabled,style:s,...r})=>{
  const b={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,border:"none",borderRadius:12,
    cursor:disabled?"not-allowed":"pointer",fontWeight:600,fontSize:13,padding:"10px 20px",opacity:disabled?0.45:1,fontFamily:"inherit",
    transition:"all 0.15s ease",letterSpacing:"0.01em"};
  const V={primary:{...b,background:C.primary,color:"#fff",boxShadow:`0 2px 8px ${C.primary}30`},
    accent:{...b,background:C.accent,color:"#fff",boxShadow:`0 2px 8px ${C.accent}30`},
    danger:{...b,background:C.danger,color:"#fff",boxShadow:`0 2px 8px ${C.danger}30`},
    outline:{...b,background:"transparent",color:C.text,border:`1.5px solid ${C.border}`},
    ghost:{...b,background:"transparent",color:C.textMuted,padding:"6px 10px",boxShadow:"none"},
    success:{...b,background:"#2F9E55",color:"#fff",boxShadow:"0 2px 8px rgba(47,158,85,0.3)"},
    info:{...b,background:C.info,color:"#fff",boxShadow:`0 2px 8px ${C.info}30`},
    fiscal:{...b,background:C.fiscal,color:"#fff",boxShadow:`0 2px 8px ${C.fiscal}30`},
    warn:{...b,background:C.warn,color:"#fff",boxShadow:`0 2px 8px ${C.warn}30`}};
  return<button onClick={disabled?undefined:onClick} style={{...V[variant],...s}} {...r}>{children}</button>;};
const Input=({style:s,...p})=>(<input {...p} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:`1.5px solid ${C.border}`,
  fontSize:13,background:C.surface,outline:"none",boxSizing:"border-box",fontFamily:"inherit",transition:"all 0.15s ease",...s}}
  onFocus={e=>{e.target.style.borderColor=C.primary;e.target.style.boxShadow=`0 0 0 3px ${C.primary}15`;}}
  onBlur={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow="none";}}/>);
const Badge=({children,color=C.primary,bg})=>(<span style={{display:"inline-flex",alignItems:"center",padding:"3px 9px",
  borderRadius:20,fontSize:10,fontWeight:600,color,background:bg||`${color}15`,letterSpacing:"0.02em"}}>{children}</span>);
const SC=({icon:I,label,value,color:c,sub})=>(<div style={{background:C.surface,borderRadius:16,padding:16,border:`1px solid ${C.border}`,
  boxShadow:`0 1px 3px ${C.shadow}`,transition:"all 0.15s"}}
  onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 4px 12px ${C.shadowMd}`;e.currentTarget.style.transform="translateY(-1px)";}}
  onMouseLeave={e=>{e.currentTarget.style.boxShadow=`0 1px 3px ${C.shadow}`;e.currentTarget.style.transform="translateY(0)";}}>
  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
    <div style={{width:28,height:28,borderRadius:8,background:`${c}12`,display:"flex",alignItems:"center",justifyContent:"center"}}><I size={14} color={c}/></div>
    <span style={{fontSize:10,fontWeight:600,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</span></div>
  <div style={{fontSize:22,fontWeight:800,letterSpacing:"-0.5px"}}>{value}</div>
  {sub&&<div style={{fontSize:10,color:C.textMuted,marginTop:3}}>{sub}</div>}</div>);
/* ══════════ CATEGORY ICON ══════════ */
const catIcon=(cat)=>{const ic={"T-shirts":"👕","Jeans":"👖","Robes":"👗","Pulls":"🧶","Chemises":"👔","Vestes":"🧥","Divers":"📦"};return ic[cat]||"📦";};
/* ══════════ NUMPAD ══════════ */
const Numpad=({value,onChange,onEnter,label})=>{
  const press=(k)=>{if(k==="C")onChange("");else if(k==="⌫")onChange(value.slice(0,-1));
    else if(k==="."&&value.includes("."))return;else onChange(value+k);};
  return(<div style={{background:C.surfaceAlt,borderRadius:16,padding:12}}>
    {label&&<div style={{fontSize:10,fontWeight:600,color:C.textMuted,textTransform:"uppercase",marginBottom:6,letterSpacing:"0.5px"}}>{label}</div>}
    <div style={{background:C.surface,borderRadius:10,padding:"8px 12px",marginBottom:8,textAlign:"right",fontSize:22,fontWeight:800,
      minHeight:36,display:"flex",alignItems:"center",justifyContent:"flex-end",border:`1.5px solid ${C.border}`,letterSpacing:"-0.5px",color:C.primary}}>{value||"0"}<span style={{fontSize:13,color:C.textMuted,marginLeft:2}}>€</span></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>
      {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map(k=>(
        <button key={k} onClick={()=>press(k)} style={{height:40,borderRadius:10,border:"none",background:k==="⌫"?C.dangerLight:C.surface,
          cursor:"pointer",fontSize:k==="⌫"?12:16,fontWeight:700,fontFamily:"inherit",color:k==="⌫"?C.danger:C.text,
          boxShadow:`0 1px 2px ${C.shadow}`,transition:"all 0.1s"}}
          onMouseDown={e=>e.currentTarget.style.transform="scale(0.95)"} onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}>{k}</button>))}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginTop:4}}>
      <button onClick={()=>press("C")} style={{height:36,borderRadius:10,border:"none",background:C.warnLight,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",color:C.warn}}>Effacer</button>
      {onEnter&&<button onClick={onEnter} style={{height:36,borderRadius:10,border:"none",background:C.primary,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",color:"#fff",boxShadow:`0 2px 6px ${C.primary}30`}}>Valider</button>}
    </div></div>);};

/* ══════════ DATA NORMALIZERS ══════════ */
/*
 * Variant ordering — 2 layers:
 *  1) CSV import order per product (priority) — stored in variantOrderMap { sku: ["key1","key2",...] }
 *  2) Global size ranking fallback — stored in sizeRanking { "S":1, "M":2, "L":3, ... }
 *     Used when a product has NO CSV import order defined.
 *     Does NOT override the CSV import order.
 * Both are persisted in localStorage + backend settings.
 */

// ─── Per-product CSV import order ───
let _variantOrderMap=null;
function getVariantOrderMap(){
  if(_variantOrderMap)return _variantOrderMap;
  try{const s=localStorage.getItem("caissepro_variant_order");if(s){_variantOrderMap=JSON.parse(s);return _variantOrderMap;}}catch(e){}
  return{};
}
function saveVariantOrderMap(map){
  _variantOrderMap=map;
  try{localStorage.setItem("caissepro_variant_order",JSON.stringify(map));}catch(e){}
  try{API.settings.update({variantOrderMap:map}).catch(()=>{});}catch(e){}
}
function loadVariantOrderFromSettings(s){
  if(s?.variantOrderMap&&typeof s.variantOrderMap==="object"){
    _variantOrderMap=s.variantOrderMap;
    try{localStorage.setItem("caissepro_variant_order",JSON.stringify(_variantOrderMap));}catch(e){}
  }
  if(s?.sizeRanking&&typeof s.sizeRanking==="object"){
    _sizeRanking=s.sizeRanking;
    try{localStorage.setItem("caissepro_size_ranking",JSON.stringify(_sizeRanking));}catch(e){}
  }
}
function variantKey(v){return `${(v.color||"défaut").toLowerCase()}|${(v.size||"tu").toLowerCase()}`;}
function setProductVariantOrder(productSku,variants){
  const map={...getVariantOrderMap()};
  map[productSku]=variants.map(v=>variantKey(v));
  saveVariantOrderMap(map);
}

// ─── Global size ranking (fallback) ───
const DEFAULT_SIZE_RANKING={"XXS":1,"XS":2,"S":3,"M":4,"L":5,"XL":6,"XXL":7,"2XL":7,"3XL":8,"XXXL":8,"4XL":9,"5XL":10,"6XL":11,
  "TU":0,"U":0,"UNIQUE":0,"34":34,"36":36,"38":38,"40":40,"42":42,"44":44,"46":46,"48":48,"50":50,"52":52};
let _sizeRanking=null;
function getSizeRanking(){
  if(_sizeRanking)return _sizeRanking;
  try{const s=localStorage.getItem("caissepro_size_ranking");if(s){_sizeRanking=JSON.parse(s);return _sizeRanking;}}catch(e){}
  _sizeRanking={...DEFAULT_SIZE_RANKING};return _sizeRanking;
}
function saveSizeRanking(ranking){
  _sizeRanking=ranking;
  try{localStorage.setItem("caissepro_size_ranking",JSON.stringify(ranking));}catch(e){}
  try{API.settings.update({sizeRanking:ranking}).catch(()=>{});}catch(e){}
}
function getSizeRank(size){
  const r=getSizeRanking();const key=(size||"").toUpperCase().trim();
  if(r[key]!=null)return r[key];
  const num=parseFloat(key);if(!isNaN(num))return num;
  return 9999;
}

// ─── Normalizer ───
const norm={
  product(p){
    const sku=p.sku||p.id||"";
    const csvOrder=(getVariantOrderMap())[sku];// array of keys if CSV import exists for this product
    const variants=(p.variants||[]).map((v,i)=>({...v,stock:parseInt(v.stock||0),stockAlert:parseInt(v.stock_alert||v.stockAlert||5),
      defective:parseInt(v.defective||0)}))
      .sort((a,b)=>{
        if(csvOrder){
          // Priority 1: CSV import order for this product
          const ia=csvOrder.indexOf(variantKey(a));const ib=csvOrder.indexOf(variantKey(b));
          const sa=ia>=0?ia:9999;const sb=ib>=0?ib:9999;
          if(sa!==sb)return sa-sb;
        }
        // Priority 2: Global size ranking (fallback when no CSV order)
        const ra=getSizeRank(a.size);const rb=getSizeRank(b.size);
        if(ra!==rb)return ra-rb;
        // Priority 3: sort_order from DB
        if(a.sort_order!=null&&b.sort_order!=null)return a.sort_order-b.sort_order;
        return 0;
      });
    return{...p,price:parseFloat(p.price),costPrice:parseFloat(p.cost_price||p.costPrice||0),
    taxRate:parseFloat(p.tax_rate||p.taxRate||0.20),category:p.category||"",collection:p.collection||"",variants}},
  customer(c){return{...c,firstName:c.first_name||c.firstName,lastName:c.last_name||c.lastName,
    totalSpent:parseFloat(c.total_spent||c.totalSpent||0),points:parseInt(c.points||0)}},
  products(list){return(list||[]).map(norm.product)},
  customers(list){return(list||[]).map(norm.customer)},
};

/* ══════════ ERROR BOUNDARY ══════════ */
class ErrorBoundary extends Component{
  constructor(p){super(p);this.state={hasError:false,error:null,info:null};}
  static getDerivedStateFromError(e){return{hasError:true,error:e};}
  componentDidCatch(e,info){console.error("BOUNDARY_CATCH:",e.message,e.stack);this.setState({info});}
  render(){if(this.state.hasError)return(<div style={{padding:40,background:"#FFF0F0",margin:20,borderRadius:16,border:"2px solid #D1453B"}}>
    <h2 style={{color:"#D1453B",margin:"0 0 10px"}}>Erreur détectée</h2>
    <pre style={{fontSize:12,whiteSpace:"pre-wrap",color:"#333",background:"#fff",padding:12,borderRadius:8,maxHeight:200,overflowY:"auto"}}>{this.state.error?.message}</pre>
    <div style={{display:"flex",gap:10,marginTop:14}}>
      <button onClick={()=>this.setState({hasError:false,error:null})} style={{padding:"10px 20px",background:"#2B6E44",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"inherit"}}>
        ← Retour</button>
      <button onClick={()=>{this.setState({hasError:false,error:null});window.location.reload();}} style={{padding:"10px 20px",background:"#D1453B",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"inherit"}}>
        Recharger la page</button></div>
  </div>);return this.props.children;}
}

/* ══════════ TOAST NOTIFICATIONS ══════════ */
const ToastContainer=()=>{const{notifications}=useApp();
  if(!notifications?.length)return null;
  const icons={success:CheckCircle2,error:AlertTriangle,warn:AlertTriangle,info:Activity};
  const bgs={success:"linear-gradient(135deg,#2F9E55,#3ABB6A)",error:`linear-gradient(135deg,${C.danger},#E06060)`,
    warn:`linear-gradient(135deg,${C.warn},#F0C040)`,info:`linear-gradient(135deg,${C.info},#5A92E8)`};
  return(<div style={{position:"fixed",top:20,right:20,zIndex:99999,display:"flex",flexDirection:"column",gap:8}}>
    {notifications.map(n=>{const Ic=icons[n.type]||Activity;return(
      <div key={n.id} style={{padding:"12px 20px",borderRadius:14,fontSize:12,fontWeight:600,
        boxShadow:"0 12px 40px rgba(0,0,0,0.18)",animation:"slideIn 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        background:bgs[n.type]||bgs.info,color:"#fff",display:"flex",alignItems:"center",gap:8,backdropFilter:"blur(4px)",
        maxWidth:360}}>
        <div style={{width:24,height:24,borderRadius:8,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Ic size={13}/></div>
        <span style={{lineHeight:1.4}}>{n.msg}</span></div>);})}</div>);};

/* ══════════ CONFIRM DIALOG ══════════ */
const ConfirmDialog=({open,onClose,onConfirm,title,message})=>{if(!open)return null;return(
  <div style={{position:"fixed",inset:0,zIndex:99998,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)"}}/>
    <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:C.surface,borderRadius:16,padding:24,width:360,boxShadow:"0 24px 80px rgba(0,0,0,0.18)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><AlertTriangle size={20} color={C.danger}/>
        <h3 style={{fontSize:16,fontWeight:700,margin:0}}>{title}</h3></div>
      <p style={{fontSize:13,color:C.textMuted,marginBottom:16}}>{message}</p>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        <Btn variant="danger" onClick={()=>{onConfirm();onClose();}}>Confirmer</Btn></div></div></div>);};

/* ══════════ CONTEXT ══════════ */
const AppCtx=createContext(null);const useApp=()=>useContext(AppCtx);

function AppProvider({children}){
  const[currentUser,setCurrentUserRaw]=useState(()=>{try{const s=sessionStorage.getItem("caissepro_user");return s?JSON.parse(s):null;}catch(e){return null;}});
  const setCurrentUser=useCallback((u)=>{setCurrentUserRaw(u);try{if(u)sessionStorage.setItem("caissepro_user",JSON.stringify(u));else sessionStorage.removeItem("caissepro_user");}catch(e){}},[]);
  const[mode,setMode]=useState(()=>{try{return sessionStorage.getItem("caissepro_mode")||"cashier";}catch(e){return"cashier";}});
  useEffect(()=>{try{sessionStorage.setItem("caissepro_mode",mode);}catch(e){}},[mode]);
  const[products,setProducts]=useState([]);
  const[customers,setCustomers]=useState([]);
  const[cart,setCart]=useState([]);
  const[gDisc,setGDisc]=useState(0);const[gDiscType,setGDiscType]=useState("percentage");
  const[promoCode,setPromoCode]=useState("");
  const[cashReg,setCashReg]=useState(()=>{try{const s=localStorage.getItem("caissepro_cashreg");return s?JSON.parse(s):null;}catch(e){return null;}});
  useEffect(()=>{try{if(cashReg)localStorage.setItem("caissepro_cashreg",JSON.stringify(cashReg));else localStorage.removeItem("caissepro_cashreg");}catch(e){}},[cashReg]);
  const[isOnline,setIsOnline]=useState(true);
  const[tickets,setTickets]=useState(()=>{try{const s=localStorage.getItem("caissepro_tickets");return s?JSON.parse(s):[];}catch(e){return[];}});
  useEffect(()=>{try{localStorage.setItem("caissepro_tickets",JSON.stringify(tickets.slice(0,500)));}catch(e){}},[tickets]);
  const[tSeq,setTSeq]=useState(()=>{try{return parseInt(localStorage.getItem("caissepro_tseq"))||0;}catch(e){return 0;}});
  useEffect(()=>{try{localStorage.setItem("caissepro_tseq",String(tSeq));}catch(e){}},[tSeq]);
  const[lastHash,setLastHash]=useState(()=>{try{return localStorage.getItem("caissepro_lasthash")||"0".repeat(64);}catch(e){return "0".repeat(64);}});
  useEffect(()=>{try{localStorage.setItem("caissepro_lasthash",lastHash);}catch(e){}},[lastHash]);
  const[gt,setGt]=useState(()=>{try{return parseFloat(localStorage.getItem("caissepro_gt"))||0;}catch(e){return 0;}});
  useEffect(()=>{try{localStorage.setItem("caissepro_gt",String(gt));}catch(e){}},[gt]);
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
  const defaultUsers=[{id:"u1",name:"Admin",role:"admin",pin:"1234"},{id:"u2",name:"Sophie",role:"cashier",pin:"1234"},{id:"u3",name:"Marc",role:"cashier",pin:"1234"}];
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

  useEffect(()=>{const on=()=>setIsOnline(true);const off=()=>setIsOnline(false);
    window.addEventListener("online",on);window.addEventListener("offline",off);
    return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};},[]);

  // ══ Auto-reconnect on page refresh if token exists ══
  const loadAllData=useCallback(async()=>{
    try{
      const[prods,custs,prms,setts,apiUsers]=await Promise.all([
        API.products.list(),API.customers.list(),API.settings.promos(),API.settings.get(),API.auth.users().catch(()=>null)]);
      setProducts(norm.products(prods));setCustomers(norm.customers(custs));setPromos(prms);setSettings(s=>({...s,...setts}));
      if(apiUsers?.length){const merged=[...apiUsers.map(u=>({id:u.id,name:u.name,role:u.role,pin:"****",apiSynced:true}))];
        const localOnly=users.filter(lu=>!apiUsers.find(au=>au.name===lu.name));setUsers([...merged,...localOnly]);}
      loadVariantOrderFromSettings(setts);
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
  const login=async(n,pw)=>{
    // Essai API d'abord
    try{const res=await API.auth.login(n,pw);API.setToken(res.token);setCurrentUser(res.user);
      const[prods,custs,prms,setts,apiUsers,apiSales,apiCounter]=await Promise.all([API.products.list(),API.customers.list(),API.settings.promos(),API.settings.get(),API.auth.users().catch(()=>null),API.sales.list({limit:200}).catch(()=>null),API.fiscal.counter().catch(()=>null)]);
      setProducts(norm.products(prods));setCustomers(norm.customers(custs));setPromos(prms);setSettings(s=>({...s,...setts}));
      // Sync tickets from API
      if(apiSales&&Array.isArray(apiSales)){const merged=[...apiSales];const localOnly=tickets.filter(lt=>lt.hash==="LOCAL"||!apiSales.find(as=>as.ticketNumber===lt.ticketNumber));
        setTickets([...localOnly,...merged].sort((a,b)=>new Date(b.date||b.createdAt||0)-new Date(a.date||a.createdAt||0)).slice(0,500));}
      // Sync fiscal counters from API
      if(apiCounter){if(apiCounter.seq)setTSeq(apiCounter.seq);if(apiCounter.lastHash)setLastHash(apiCounter.lastHash);if(apiCounter.grandTotal!=null)setGt(parseFloat(apiCounter.grandTotal));}
      // Load variant order mapping from backend settings
      loadVariantOrderFromSettings(setts);
      // Load CSV column mapping from backend settings
      if(setts?.csvColumnMapping){try{localStorage.setItem("caissepro_csv_column_mapping",JSON.stringify(setts.csvColumnMapping));}catch(e){}}
      // Synchroniser la liste utilisateurs depuis l'API
      if(apiUsers&&apiUsers.length){const merged=[...apiUsers.map(u=>({id:u.id,name:u.name,role:u.role,pin:"****",apiSynced:true}))];
        const localOnly=users.filter(lu=>!apiUsers.find(au=>au.name===lu.name));
        setUsers([...merged,...localOnly]);}
      setOfflineMode(false);addJET("LOGIN",n);notify("Connecté au serveur","success");return true;
    }catch(e){
      console.warn("API indisponible, tentative login hors-ligne:",e.message);
      // Fallback local — vérifier les identifiants locaux
      const localUser=initUsers.find(u=>u.name===n&&u.password===pw)||users.find(u=>u.name===n&&u.pin!=="****"&&u.pin===pw);
      if(localUser){setCurrentUser({id:localUser.id,name:localUser.name,role:localUser.role});
        setProducts(initProducts);setCustomers(initCustomers);setPromos(initPromos);
        setOfflineMode(true);addJET("LOGIN_OFFLINE",n);
        notify("Mode hors-ligne — données locales","warn");return true;}
      return false;}};
  const logout=()=>{API.clearToken();addJET("LOGOUT",currentUser?.name);setCurrentUser(null);setCart([]);setGDisc(0);setSelCust(null);setOfflineMode(false);};

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
    // Calculer les montants HT pour les promos (cohérent avec le checkout)
    const getHT=(ci)=>{const raw=ci.discountType==="amount"?ci.product.price*ci.quantity-((ci.discount||0)*ci.quantity):ci.product.price*ci.quantity*(1-(ci.discount||0)/100);
      return pm==="TTC"?raw/(1+(ci.product.taxRate||0.20)):raw;};
    let promoDisc=0;const applied=[];
    activePromos.forEach(p=>{
      if(p.type==="collection_discount"){
        cartItems.forEach(ci=>{if(ci.product.collection===p.collection){
          const d=getHT(ci)*(p.value/100);promoDisc+=d;applied.push(`${p.name}: -${d.toFixed(2)}€ HT sur ${ci.product.name}`);}});}
      else if(p.type==="qty_discount"&&cartItems.reduce((s,i)=>s+i.quantity,0)>=p.minQty){
        const d=cartItems.reduce((s,i)=>s+getHT(i),0)*(p.value/100);promoDisc+=d;applied.push(`${p.name}: -${d.toFixed(2)}€ HT`);}
      else if(p.type==="code"&&promoCode.toUpperCase()===p.code.toUpperCase()){
        const d=cartItems.reduce((s,i)=>s+getHT(i),0)*(p.value/100);promoDisc+=d;applied.push(`Code ${p.code}: -${d.toFixed(2)}€ HT`);}
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
  const checkout=useCallback(async(payments,sellerName)=>{
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
    let tTVA=0;
    items.forEach(i=>{
      const adjHT=i.lineHT*(1-discountRatio);
      tTVA+=adjHT*(i.tax_rate||i.product?.taxRate||0.20);
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

  // ══ THERMAL PRINTER ══
  const printReceiptOnly=useCallback(()=>{
    const el=document.querySelector("[data-print-receipt]");
    if(!el){window.print();return;}
    const w=window.open("","_blank","width=320,height=600");
    w.document.write(`<html><head><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;padding:8px;width:72mm;max-width:72mm}
      .receipt-content{width:100%}@media print{@page{size:72mm auto;margin:2mm}}</style></head>
      <body><div class="receipt-content">${el.innerHTML}</div></body></html>`);
    w.document.close();w.focus();setTimeout(()=>{w.print();w.close();},300);
  },[]);

  const thermalPrint=useCallback(async(type,data)=>{
    if(!printer.connected){printReceiptOnly();return false;}
    try{
      if(type==="receipt")await printer.printReceipt(data,settings,CO);
      else if(type==="avoir")await printer.printAvoir(data,settings,CO);
      else if(type==="closure")await printer.printClosure(data,settings,CO);
      else if(type==="test")await printer.testPrint();
      else if(type==="drawer")await printer.openDrawer();
      notify("🖨️ Impression envoyée");return true;
    }catch(e){notify("❌ "+e.message,"danger");printReceiptOnly();return false;}
  },[settings,notify,printReceiptOnly]);

  const connectPrinter=useCallback(async(method,options={})=>{
    try{
      if(method==="serial")await printer.connectSerial(options);
      else if(method==="usb")await printer.connectUSB();
      notify("🖨️ Imprimante connectée ("+method+")");return true;
    }catch(e){notify("❌ "+e.message,"danger");return false;}
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
      items,totalHT,totalTVA,totalTTC,reason:reason||"",refundMethod,
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
    if(!w){notify("Impossible d'ouvrir l'écran client — autorisez les popups","error");return;}
    customerDisplayRef.current=w;
    w.document.write(`<!DOCTYPE html><html><head><title>Ecran Client</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',system-ui,sans-serif;background:#F8FAF7;overflow:hidden}
      #root{height:100vh;display:flex;flex-direction:column}
      .header{background:linear-gradient(135deg,#2B6E44,#4DA768);color:#fff;padding:20px 30px;text-align:center}
      .header h1{font-size:24px;font-weight:800}.header .sub{font-size:13px;opacity:0.8;margin-top:4px}
      .items{flex:1;overflow-y:auto;padding:20px 30px}.item{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #E8ECE5;font-size:16px}
      .item .name{font-weight:600;flex:1}.item .qty{color:#666;margin:0 20px}.item .price{font-weight:800;color:#2B6E44;min-width:80px;text-align:right}
      .total-bar{background:#fff;border-top:3px solid #2B6E44;padding:24px 30px;display:flex;justify-content:space-between;align-items:center}
      .total-bar .label{font-size:20px;font-weight:700;color:#333}.total-bar .amount{font-size:36px;font-weight:900;color:#2B6E44}
      .screensaver{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#F8FAF7,#E8F0E3)}
      .screensaver .logo{width:120px;height:120px;border-radius:30px;background:linear-gradient(135deg,#2B6E44,#4DA768);display:flex;align-items:center;justify-content:center;color:#fff;font-size:48px;font-weight:900;margin-bottom:20px;box-shadow:0 12px 40px rgba(43,110,68,0.3)}
      .screensaver h2{font-size:28px;font-weight:800;color:#333;margin-bottom:8px}.screensaver p{font-size:16px;color:#666}
      .screensaver .time{font-size:48px;font-weight:800;color:#2B6E44;margin-top:20px}
    </style></head><body><div id="root"><div class="screensaver"><div class="logo">CP</div><h2></h2><p>Bienvenue</p><div class="time"></div></div></div>
    <script>
      function updateTime(){const t=document.querySelector('.time');if(t)t.textContent=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}
      setInterval(updateTime,1000);updateTime();
      window.updateCart=function(data){
        const root=document.getElementById('root');
        if(!data||!data.items||data.items.length===0){
          root.innerHTML='<div class="screensaver"><div class="logo">CP</div><h2>'+data.storeName+'</h2><p>Bienvenue</p><div class="time"></div></div>';
          updateTime();return;}
        let html='<div class="header"><h1>'+data.storeName+'</h1><div class="sub">Votre panier</div></div>';
        html+='<div class="items">';
        data.items.forEach(function(i){html+='<div class="item"><span class="name">'+i.name+'</span><span class="qty">x'+i.qty+'</span><span class="price">'+i.price+'</span></div>';});
        html+='</div>';
        html+='<div class="total-bar"><span class="label">Total TTC</span><span class="amount">'+data.total+'</span></div>';
        root.innerHTML=html;};
    <\/script></body></html>`);
    w.document.close();
    notify("Ecran client ouvert — glissez-le sur le 2e moniteur","success");
  },[notify]);

  // Sync cart to customer display
  useEffect(()=>{
    if(!customerDisplayRef.current||customerDisplayRef.current.closed)return;
    try{customerDisplayRef.current.updateCart({
      storeName:settings.name||CO.name,
      items:cart.map(i=>({name:i.product.name+(i.variant?` (${i.variant.color}/${i.variant.size})`:""),qty:i.quantity,
        price:(i.product.price*i.quantity).toFixed(2)+"€"})),
      total:cart.length>0?cart.reduce((s,i)=>s+i.product.price*i.quantity,0).toFixed(2)+"€":"0.00€"
    });}catch(e){}
  },[cart,settings.name]);

  return<AppCtx.Provider value={{currentUser,login,logout,mode,setMode,offlineMode,products,setProducts,addProduct,customers,setCustomers,addCustomer,openCustomerDisplay,footfall,addFootfall,
    cart,addToCart,addCustomItem,removeFromCart,voidSale,updateQty,updateItemDisc,clearCart,gDisc,gDiscType,setCartGD,
    promoCode,setPromoCode,calcPromoDiscount,
    cashReg,openReg,closeReg,isOnline,tickets,tSeq,lastHash,gt,audit,jet,closures,avoirs,
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
    printerConnected,printerType,thermalPrint,connectPrinter,disconnectPrinter,
    users,setUsers,tvaRates,setTvaRates,addPendingSync,pendingSync,clearPendingSync,
  }}>{children}</AppCtx.Provider>;
}

/* ══════════ LOGIN ══════════ */
function LoginScreen(){
  const{login,setMode:setIM,users}=useApp();const[su,setSu]=useState("");const[pw,setPw]=useState("");const[err,setErr]=useState("");const[m,setM]=useState("cashier");const[loading,setLoading]=useState(false);
  const allUsers=users&&users.length?users:initUsers;
  const go=async()=>{if(!su){setErr("Sélectionnez un profil");return;}const u=allUsers.find(u=>u.id===su);if(!u){setErr("Profil introuvable");return;}
    setLoading(true);setErr("");try{const ok=await login(u.name,pw||u.pin);if(ok)setIM(m);else setErr("Code incorrect ou serveur indisponible");}catch(e){setErr("Erreur de connexion: "+e.message);}finally{setLoading(false);}};
  return(<div style={{minHeight:"100vh",background:`linear-gradient(160deg,#E4F2E9 0%,${C.bg} 40%,${C.accentLight} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:440,background:"rgba(255,255,255,0.95)",backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderRadius:32,padding:44,
      boxShadow:"0 32px 100px rgba(0,0,0,0.10), 0 0 0 1px rgba(255,255,255,0.6) inset",animation:"fadeIn 0.4s ease"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{width:76,height:76,borderRadius:20,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16,
          boxShadow:`0 12px 32px ${C.primary}30`}}><Store size={38} color="#fff"/></div>
        <h1 style={{fontSize:28,fontWeight:900,margin:"0 0 6px",letterSpacing:"-0.8px"}}>CaissePro</h1>
        <p style={{color:C.textMuted,fontSize:12,fontWeight:500}}>v{CO.ver} — Certifié NF525 — Logiciel de caisse textile</p></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
        {[{id:"cashier",i:Store,l:"Caisse",d:"Point de vente"},{id:"dashboard",i:LayoutDashboard,l:"Dashboard",d:"Gestion & stats"}].map(x=>(
          <button key={x.id} onClick={()=>setM(x.id)} style={{padding:14,borderRadius:14,border:`2px solid ${m===x.id?C.primary:C.border}`,background:m===x.id?C.primaryLight:"transparent",cursor:"pointer",transition:"all 0.15s"}}>
            <x.i size={24} color={m===x.id?C.primary:C.textMuted} style={{margin:"0 auto 6px",display:"block"}}/>
            <div style={{fontSize:12,fontWeight:700,color:m===x.id?C.primary:C.text}}>{x.l}</div>
            <div style={{fontSize:9,color:C.textMuted,marginTop:2}}>{x.d}</div></button>))}</div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
        {allUsers.map(u=>(<button key={u.id} onClick={()=>setSu(u.id)} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:12,
          border:`2px solid ${su===u.id?C.primary:C.border}`,background:su===u.id?C.primaryLight:"transparent",cursor:"pointer",transition:"all 0.15s"}}>
          <div style={{width:38,height:38,borderRadius:19,background:su===u.id?`linear-gradient(135deg,${C.primary},${C.gradientB})`:C.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
            <UserIcon size={18} color={su===u.id?"#fff":C.textMuted}/></div>
          <div style={{textAlign:"left",flex:1}}><div style={{fontSize:13,fontWeight:600}}>{u.name}</div><div style={{fontSize:10,color:C.textMuted,textTransform:"capitalize"}}>{u.role==="admin"?"Administrateur":"Caissier(e)"}</div></div>
          {su===u.id&&<CheckCircle2 size={16} color={C.primary}/>}</button>))}</div>
      <div style={{position:"relative",marginBottom:6}}>
        <Input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&go()} placeholder="Code PIN" style={{height:44,fontSize:14,paddingRight:36}}/>
        <Lock size={14} color={C.textLight} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)"}}/></div>
      <p style={{fontSize:9,color:C.textLight,marginBottom:12,textAlign:"center"}}>Code par défaut : 1234</p>
      {err&&<div style={{padding:10,background:C.dangerLight,borderRadius:10,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
        <AlertTriangle size={13} color={C.danger}/><p style={{fontSize:11,color:C.danger,margin:0,fontWeight:600}}>{err}</p></div>}
      <Btn onClick={go} disabled={loading||!su} style={{width:"100%",height:48,fontSize:14,borderRadius:14,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`,boxShadow:`0 4px 16px ${C.primary}33`}}>
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
  return(<div style={{minHeight:"100vh",background:`linear-gradient(145deg,#E8F0EB,${C.bg})`,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:denomMode?600:440,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(24px)",borderRadius:28,padding:36,boxShadow:"0 24px 80px rgba(0,0,0,0.08)",transition:"width 0.3s",maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{width:60,height:60,borderRadius:16,background:`linear-gradient(135deg,${C.accent},#D4A574)`,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:12,boxShadow:`0 8px 24px ${C.accent}33`}}><Wallet size={30} color="#fff"/></div>
        <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 4px"}}>Ouverture de caisse</h1>
        <p style={{color:C.textMuted,fontSize:12}}>Bienvenue {currentUser?.name} — {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</p></div>

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
        <div style={{background:`linear-gradient(135deg,${C.accentLight},#F5E6D8)`,borderRadius:14,padding:14,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${C.accent}22`}}>
          <span style={{fontSize:14,fontWeight:700,color:C.accent}}>Total fond de caisse</span>
          <span style={{fontSize:22,fontWeight:900,color:C.accent}}>{denomTotal.toFixed(2)}€</span></div>
      </>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Btn variant="outline" onClick={onSkip} style={{height:48,borderRadius:12}}><XCircle size={14}/> Passer</Btn>
        <Btn onClick={()=>{const amt=denomMode?denomTotal:parseFloat(a);if(amt){openReg(amt);onDone();}}} disabled={denomMode?denomTotal===0:!a}
          style={{height:48,borderRadius:12,background:`linear-gradient(135deg,${C.accent},#D4A574)`,boxShadow:(denomMode?denomTotal>0:a)?`0 4px 16px ${C.accent}33`:"none"}}><Wallet size={14}/> Ouvrir la caisse</Btn>
      </div></div></div>);
}

/* ══════════ SALES SCREEN ══════════ */
function SalesScreen(){
  const{products,cart,addToCart,addCustomItem,removeFromCart,voidSale,updateQty,updateItemDisc,clearCart,checkout,
    gDisc,gDiscType,setCartGD,promoCode,setPromoCode,calcPromoDiscount,isOnline,findByEAN,offlineMode,
    parked,parkCart,restoreCart,customers,addCustomer,selCust,setSelCust,perm,notify,
    stockAlerts,activePromos,avoirPayment,setAvoirPayment,getLoyaltyTier,tickets,saleNote,setSaleNote,favorites,toggleFavorite,getLastPriceForCustomer,settings,
    printerConnected,thermalPrint,pendingSync,clearPendingSync,users,currentUser}=useApp();
  const[search,setSearch]=useState("");const[cat,setCat]=useState("Tous");const[vm,setVm]=useState(null);const[selSeller,setSelSeller]=useState(null);const[detaxe,setDetaxe]=useState(false);
  const[dm,setDm]=useState(null);const[dv,setDv]=useState("");const[gm,setGm]=useState(false);const[gv,setGv]=useState("");const[gtp,setGtp]=useState("percentage");
  const[lastTk,setLastTk]=useState(null);const[tkModal,setTkModal]=useState(false);const[busy,setBusy]=useState(false);
  const[payModal,setPayModal]=useState(false);const[cashGiven,setCashGiven]=useState("");
  const[cashNumpadModal,setCashNumpadModal]=useState(false);const[numpadValue,setNumpadValue]=useState("");
  const[custModal,setCustModal]=useState(false);const[parkedModal,setParkedModal]=useState(false);
  const[customModal,setCustomModal]=useState(false);const[customName,setCustomName]=useState("");const[customPrice,setCustomPrice]=useState("");
  const[newCustModal,setNewCustModal]=useState(false);const[ncF,setNcF]=useState("");const[ncL,setNcL]=useState("");const[ncE,setNcE]=useState("");const[ncP,setNcP]=useState("");
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
    else if(e.key.length===1){barcodeBuffer.current+=e.key;clearTimeout(barcodeTimer.current);
      barcodeTimer.current=setTimeout(()=>{barcodeBuffer.current="";},150);}};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[findByEAN,addToCart,notify]);

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

  const[payCard,setPayCard]=useState("");const[payCash,setPayCash]=useState("");const[payGC,setPayGC]=useState("");const[payChq,setPayChq]=useState("");const[payAmex,setPayAmex]=useState("");
  const openPay=()=>{setPayCard("");setPayCash("");setPayGC("");setPayChq("");setPayAmex("");setCashGiven("");setPayModal(true);};
  const doSplitPay=async()=>{const payments=[];
    const c=parseFloat(payCard)||0;const ca=parseFloat(payCash)||0;const g=parseFloat(payGC)||0;const chq=parseFloat(payChq)||0;const amx=parseFloat(payAmex)||0;
    if(c>0)payments.push({method:"card",amount:c});if(amx>0)payments.push({method:"amex",amount:amx});if(ca>0)payments.push({method:"cash",amount:ca});
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
    {(offlineMode||!isOnline)&&<div style={{position:"absolute",top:0,left:74,right:0,zIndex:100,
      background:offlineMode?"linear-gradient(90deg,#FEF3C7,#FDF6E3)":"linear-gradient(90deg,#FCEAEA,#FFF0F0)",padding:"7px 18px",
      display:"flex",alignItems:"center",gap:8,fontSize:11,fontWeight:600,color:offlineMode?"#92400E":C.danger,
      borderBottom:`1px solid ${offlineMode?"#F5D08044":"#E5A0A044"}`,animation:"slideDown 0.3s ease"}}>
      <WifiOff size={13}/> {offlineMode?"Mode hors-ligne — Données locales (serveur indisponible)":"Connexion internet perdue"}
      {offlineMode&&<Badge color="#92400E">Local</Badge>}
      {pendingSync.length>0&&<span onClick={()=>{if(confirm(`${pendingSync.length} synchro(s) en attente.\nVoulez-vous vider la file ?`)){clearPendingSync();}}}
        style={{cursor:"pointer"}}><Badge color={C.warn}>⏳ {pendingSync.length} synchro(s) en attente — cliquer pour purger</Badge></span>}</div>}

    {/* Products */}
    <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Daily summary bar */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"10px 16px",
        background:`linear-gradient(135deg,${C.primaryLight},#DCF0E2)`,borderRadius:14,border:`1px solid ${C.primary}12`,
        boxShadow:`0 2px 8px ${C.primary}08`}}>
        <div style={{width:28,height:28,borderRadius:8,background:`${C.primary}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Activity size={14} color={C.primary}/></div>
        <div><span style={{fontSize:12,fontWeight:700,color:C.primaryDark}}>Aujourd'hui</span>
          <span style={{fontSize:10,color:C.primary,marginLeft:6}}>{new Date().toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</span></div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          <Badge color={C.primary}>{todayTickets.length} vente{todayTickets.length>1?"s":""}</Badge>
          <span style={{fontSize:16,fontWeight:800,color:C.primary,letterSpacing:"-0.5px"}}>{todayCA.toFixed(2)}€</span>
          {stockAlerts.length>0&&<Badge color={C.danger}>{stockAlerts.length} alerte{stockAlerts.length>1?"s":""}</Badge>}
          <span style={{fontSize:9,color:printerConnected?"#3B8C5A":C.textLight,display:"flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:6,
            background:printerConnected?"#3B8C5A10":C.surface,border:`1px solid ${printerConnected?"#3B8C5A33":"transparent"}`}}>
            <Printer size={10}/> {printerConnected?"ESC/POS":"—"}</span>
          <span style={{fontSize:9,color:C.textMuted,cursor:"pointer",display:"flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:6,background:C.surface}} onClick={()=>setShowShortcuts(true)}>
            <kbd style={{fontSize:9,fontWeight:700}}>?</kbd> Raccourcis</span></div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <div style={{position:"relative",flex:1}}>
          <Search size={15} color={C.textMuted} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}}/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher produit, SKU ou scanner…" style={{paddingLeft:38,height:42,fontSize:13,borderRadius:14}}/></div>
        <Btn variant="outline" onClick={()=>setParkedModal(true)} style={{height:42,padding:"0 14px",position:"relative",borderRadius:14}}>
          <Pause size={15}/>{parked.length>0&&<span style={{position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:9,
            background:C.danger,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 2px 6px rgba(209,69,59,0.4)"}}>{parked.length}</span>}</Btn>
        <Btn variant="outline" onClick={()=>setCustomModal(true)} style={{height:42,padding:"0 14px",borderRadius:14}} title="Article divers"><Edit size={15}/></Btn>
      </div>
      {activePromos.length>0&&<div style={{background:`linear-gradient(135deg,${C.warnLight},#FFFBE8)`,borderRadius:10,padding:"6px 12px",marginBottom:8,
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
          <div style={{aspectRatio:"1.1",background:`linear-gradient(155deg,${cc}08,${cc}04)`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:32,opacity:0.7,filter:"grayscale(0.2)"}}>{catIcon(p.category)}</span>
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
          <div style={{width:40,height:40,borderRadius:12,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`,display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:`0 4px 14px ${C.primary}25`}}><ShoppingCart size={19} color="#fff"/></div>
          <div style={{flex:1}}><div style={{fontSize:16,fontWeight:800,letterSpacing:"-0.3px"}}>Panier</div>
            <div style={{fontSize:10,color:C.textMuted}}>{cart.length} article{cart.length>1?"s":""} — {cart.reduce((s,i)=>s+i.quantity,0)} pièce{cart.reduce((s,i)=>s+i.quantity,0)>1?"s":""}</div></div>
          <Btn variant="ghost" onClick={parkCart} disabled={!cart.length} style={{padding:"6px 8px",borderRadius:8}} title="Mettre en attente"><Pause size={13}/></Btn>
          {perm().canVoid&&<Btn variant="ghost" onClick={()=>{if(cart.length)setConfirmVoid(true);}} disabled={!cart.length} style={{padding:"6px 8px",color:C.danger,borderRadius:8}} title="Annuler"><XOctagon size={13}/></Btn>}
        </div>

        {/* Customer */}
        <button onClick={()=>setCustModal(true)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:10,width:"100%",
          border:`1.5px dashed ${selCust?C.primary:C.border}`,background:selCust?`${C.primary}08`:"transparent",cursor:"pointer",marginBottom:6,
          fontSize:11,fontWeight:600,color:selCust?C.primary:C.textMuted,transition:"all 0.15s"}}
          onMouseEnter={e=>{if(!selCust)e.currentTarget.style.borderColor=C.primary+"66";}} onMouseLeave={e=>{if(!selCust)e.currentTarget.style.borderColor=C.border;}}>
          {selCust?<><div style={{width:24,height:24,borderRadius:12,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:700}}>{selCust.firstName[0]}{selCust.lastName[0]}</div>{selCust.firstName} {selCust.lastName} — {selCust.points}pts <Badge color={C.accent}>{custTier?.name}</Badge></>
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
                <span style={{fontSize:16}}>{i.isCustom?"📝":catIcon(i.product.category)}</span></div>
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
          {totals.gd>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#2F9E55",display:"flex",alignItems:"center",gap:3}}><Percent size={10}/> Remises & promos</span><span style={{fontWeight:700,color:"#2F9E55"}}>-{totals.gd.toFixed(2)}€</span></div>}
          {totals.applied?.length>0&&<div style={{background:`${C.warn}10`,borderRadius:8,padding:"4px 8px",marginBottom:4,border:`1px solid ${C.warn}15`}}>{totals.applied.map((a,i)=><div key={i} style={{fontSize:9,color:"#92720E",fontWeight:600}}>✓ {a}</div>)}</div>}
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.textMuted}}>TVA</span><span style={{fontWeight:600}}>{totals.tTVA.toFixed(2)}€</span></div>
          {avoirPayment>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.fiscal}}>Avoir appliqué</span><span style={{fontWeight:700,color:C.fiscal}}>-{avoirPayment.toFixed(2)}€</span></div>}
          <div style={{borderTop:`2px solid ${C.border}`,paddingTop:8,marginTop:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:16,fontWeight:800}}>Total TTC</span>
            <span style={{fontSize:24,fontWeight:900,color:C.primary,letterSpacing:"-0.8px"}}>{totals.tTTC.toFixed(2)}€</span></div></div>

        {cashGiven&&parseFloat(cashGiven)>0&&<div style={{background:`linear-gradient(135deg,${C.primaryLight},#D4F0DE)`,borderRadius:12,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",
          border:`1px solid ${C.primary}15`,boxShadow:`0 2px 8px ${C.primary}10`}}>
          <span style={{fontSize:13,fontWeight:700,color:C.primaryDark}}>Rendu monnaie</span>
          <span style={{fontSize:22,fontWeight:900,color:C.primary,letterSpacing:"-0.5px"}}>{change.toFixed(2)}€</span></div>}

        <div style={{display:"flex",gap:4,marginBottom:6}}>
          <Btn variant="outline" onClick={()=>{setGm(true);setGv(String(gDisc));setGtp(gDiscType);}} style={{flex:1,height:32,fontSize:10,padding:"0 6px",borderRadius:10}}><Percent size={11}/> Remise globale</Btn>
          <Btn variant={detaxe?"success":"outline"} onClick={()=>setDetaxe(!detaxe)} style={{height:32,fontSize:10,padding:"0 10px",borderRadius:10,background:detaxe?`linear-gradient(135deg,#2F9E55,${C.gradientB})`:"transparent"}}>{detaxe?"✓ Détaxe":"Détaxe"}</Btn></div>
        {detaxe&&<div style={{background:"#E8F5E9",borderRadius:8,padding:8,marginBottom:6,fontSize:10,color:"#2E7D32",border:"1px solid #A5D6A7"}}>
          Vente en détaxe — TVA à 0% — Réservé aux résidents hors UE (achat min. 100,01€)</div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:5}}>
          <Btn onClick={()=>quickPay("card")} disabled={!cart.length||busy} style={{height:46,borderRadius:12,background:`linear-gradient(135deg,${C.info},#5A92E8)`,padding:"0 10px",fontSize:12,gap:6,boxShadow:`0 3px 10px ${C.info}25`}}>
            {busy?<span className="spin-loader"/>:<><CreditCard size={16}/> Carte</>}</Btn>
          <Btn onClick={()=>{if(cart.length&&!busy){setNumpadValue("");setCashNumpadModal(true);}}} disabled={!cart.length||busy} style={{height:46,borderRadius:12,background:`linear-gradient(135deg,#2F9E55,${C.gradientB})`,padding:"0 10px",fontSize:12,gap:6,boxShadow:"0 3px 10px rgba(47,158,85,0.25)"}}>
            {busy?<span className="spin-loader"/>:<><Banknote size={16}/> Espèces</>}</Btn></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:5}}>
          <Btn onClick={()=>quickPay("giftcard")} disabled={!cart.length||busy} style={{height:38,borderRadius:10,background:`linear-gradient(135deg,${C.accent},#D4A574)`,padding:"0 6px",fontSize:10,gap:4}}><Gift size={13}/> Cadeau</Btn>
          <Btn onClick={()=>quickPay("cheque")} disabled={!cart.length||busy} style={{height:38,borderRadius:10,background:"linear-gradient(135deg,#7B8794,#9FAAB6)",padding:"0 6px",fontSize:10,gap:4}}><FileText size={13}/> Chèque</Btn>
          <Btn onClick={openPay} disabled={!cart.length||busy} style={{height:38,borderRadius:10,background:`linear-gradient(135deg,${C.fiscal},#8B6FC0)`,padding:"0 6px",fontSize:10,gap:4}}><Split size={13}/> Fractionné</Btn></div>
        <div style={{display:"flex",gap:4,marginBottom:5}}>
          <select value={selSeller||""} onChange={e=>setSelSeller(e.target.value||null)} style={{flex:1,height:30,fontSize:10,padding:"4px 8px",borderRadius:10,border:`1px solid ${C.border}`,fontFamily:"inherit",background:C.surface,color:selSeller?C.text:C.textMuted}}>
            <option value="">Vendeur: {currentUser?.name} (moi)</option>
            {users.filter(u=>u.name!==currentUser?.name&&u.role!=="admin").map(u=>(<option key={u.id} value={u.name}>{u.name}</option>))}
          </select>
          <Input value={saleNote} onChange={e=>setSaleNote(e.target.value)} placeholder="Note…" style={{flex:1,height:30,fontSize:10,padding:"4px 10px",borderRadius:10}}/>
        </div>
        <Btn variant="outline" onClick={clearCart} style={{width:"100%",borderColor:`${C.danger}20`,color:C.danger,height:30,fontSize:10,borderRadius:10}}><RotateCcw size={10}/> Vider le panier</Btn>
      </div>
    </div>

    {/* MODALS */}
    <Modal open={!!vm} onClose={()=>setVm(null)} title="Choisir une variante" sub={vm?`${vm.name} — ${vm.price.toFixed(2)}€`:""}>
      {vm&&<>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 12px",background:C.surfaceAlt,borderRadius:12}}>
          <span style={{fontSize:28}}>{catIcon(vm.category)}</span>
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
        disabled={dm?.discType!=="amount"&&parseInt(dv)>maxDisc} style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>Appliquer</Btn></Modal>

    <Modal open={gm} onClose={()=>setGm(false)} title="Remise globale">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
        <Btn variant={gtp==="percentage"?"primary":"outline"} onClick={()=>setGtp("percentage")}>%</Btn>
        <Btn variant={gtp==="amount"?"primary":"outline"} onClick={()=>setGtp("amount")}>€</Btn></div>
      <Input type="number" value={gv} onChange={e=>setGv(e.target.value)} style={{marginBottom:12,height:40}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <Btn variant="outline" onClick={()=>{setCartGD(0,"percentage");setGm(false);}}>Supprimer</Btn>
        <Btn variant="success" onClick={()=>{const d=parseFloat(gv);if(d>=0){setCartGD(d,gtp);setGm(false);}}}>Appliquer</Btn></div></Modal>

    <Modal open={payModal} onClose={()=>setPayModal(false)} title="Paiement fractionné" sub={`Total: ${totals.tTTC.toFixed(2)}€`}>
      {(()=>{const paid=(parseFloat(payCard)||0)+(parseFloat(payAmex)||0)+(parseFloat(payCash)||0)+(parseFloat(payGC)||0)+(parseFloat(payChq)||0)+(avoirPayment||0);
        const remaining=Math.max(0,totals.tTTC-paid);
        return(<>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
        {[{l:"CARTE",v:payCard,s:setPayCard,i:CreditCard,c:C.info},{l:"AMEX",v:payAmex,s:setPayAmex,i:CreditCard,c:"#006FCF"},{l:"ESPÈCES",v:payCash,s:setPayCash,i:Banknote,c:C.primary},{l:"CARTE CADEAU",v:payGC,s:setPayGC,i:Gift,c:C.accent},{l:"CHÈQUE",v:payChq||"",s:v=>setPayChq(v),i:FileText,c:"#7B8794"}].map(x=>(
          <div key={x.l}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"flex",alignItems:"center",gap:4,marginBottom:3}}><x.i size={11} color={x.c}/>{x.l}
            <button onClick={()=>x.s(String(remaining.toFixed(2)))} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:9,color:C.primary,fontWeight:600}}>= Reste</button></label>
            <Input type="number" step="0.01" value={x.v} onChange={e=>x.s(e.target.value)} placeholder="0.00"/></div>))}
        <div><label style={{fontSize:10,fontWeight:600,color:C.fiscal,display:"block",marginBottom:3}}>AVOIR CLIENT</label>
          <Input type="number" step="0.01" value={avoirPayment||""} onChange={e=>setAvoirPayment(parseFloat(e.target.value)||0)} placeholder="0.00"/></div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,background:remaining>0.01?C.warnLight:C.primaryLight,marginBottom:10}}>
        <span style={{fontSize:11,fontWeight:600,color:remaining>0.01?C.warn:C.primary}}>Reste à payer</span>
        <span style={{fontSize:13,fontWeight:800,color:remaining>0.01?C.warn:C.primary}}>{remaining.toFixed(2)}€</span></div>
      <Btn onClick={doSplitPay} disabled={busy||remaining>0.01} style={{width:"100%",height:44,background:`linear-gradient(135deg,${C.fiscal},#8B6FC0)`}}><Split size={16}/> Valider</Btn>
      </>);})()}</Modal>

    <Modal open={custModal} onClose={()=>setCustModal(false)} title="Client">
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        <Btn variant="outline" onClick={()=>{setSelCust(null);setCustModal(false);}} style={{borderColor:C.danger+"44",color:C.danger}}>Aucun client</Btn>
        <Btn variant="outline" onClick={()=>{setCustModal(false);setNewCustModal(true);}}><Plus size={14}/> Nouveau client</Btn>
        {customers.map(c=>{const tier=getLoyaltyTier(c.points);return(<button key={c.id} onClick={()=>{setSelCust(c);setCustModal(false);}} style={{display:"flex",alignItems:"center",gap:10,
          padding:10,borderRadius:10,border:`1.5px solid ${selCust?.id===c.id?C.primary:C.border}`,background:selCust?.id===c.id?C.primaryLight:"transparent",cursor:"pointer"}}>
          <div style={{width:32,height:32,borderRadius:16,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:11}}>{c.firstName[0]}{c.lastName[0]}</div>
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
        style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>Créer et associer</Btn></Modal>

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
        style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>Ajouter au panier</Btn></Modal>

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
          <div style={{width:72,height:72,borderRadius:36,background:"linear-gradient(135deg,#2F9E55,#4DA768)",display:"inline-flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 8px 32px rgba(47,158,85,0.35)",marginBottom:10,border:"3px solid rgba(47,158,85,0.2)"}}><CheckCircle2 size={36} color="#fff"/></div>
          <div style={{fontSize:11,fontWeight:600,color:"#3B8C5A",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Vente confirmée</div>
          <div style={{fontSize:28,fontWeight:900,color:"#2F9E55",letterSpacing:"-1px"}}>{(lastTk.totalTTC||0).toFixed(2)}€</div>
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
        {lastTk.promosApplied?.length>0&&lastTk.promosApplied.map((a,i)=><div key={i} style={{color:"#3B8C5A",fontSize:9}}>✓ {a}</div>)}
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Total HT</span><span>{(lastTk.totalHT||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>TVA</span><span>{(lastTk.totalTVA||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,marginTop:3}}><span>TOTAL TTC</span><span>{(lastTk.totalTTC||0).toFixed(2)}€</span></div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        <div>Paiement: {lastTk.payments?.map(p=>`${({cash:"ESP",card:"CB",amex:"AMEX",giftcard:"CAD",cheque:"CHQ",avoir:"AVOIR"})[p.method]||p.method} ${p.amount.toFixed(2)}€`).join(" + ")}</div>
        <div style={{textAlign:"center",background:C.fiscalLight,padding:6,borderRadius:6,margin:"4px 0"}}>
          <div style={{fontSize:8,color:C.fiscal,fontWeight:700}}>EMPREINTE NF525</div>
          <div style={{fontSize:11,fontWeight:700,color:C.fiscal,letterSpacing:2}}>{lastTk.fingerprint}</div></div>
        {lastTk.detaxe&&<div style={{textAlign:"center",background:"#E8F5E9",padding:6,borderRadius:6,margin:"4px 0",fontSize:9,color:"#2E7D32",fontWeight:700}}>VENTE EN DÉTAXE — TVA 0% — ART. 262 CGI</div>}
        <div style={{textAlign:"center",fontSize:8,color:C.textMuted}}>
          {CO.sw} v{CO.ver} — Certifié NF525<br/>N° CERT-NF525-2026-001 — INFOCERT/LNE<br/>{settings.footerMsg||CO.footerMsg}</div>
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
        {parseFloat(numpadValue)>0&&<div style={{background:`linear-gradient(135deg,${C.primaryLight},#D4F0DE)`,borderRadius:12,padding:14,marginTop:10,
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
        style={{width:"100%",height:50,fontSize:15,borderRadius:14,background:`linear-gradient(135deg,#2F9E55,${C.gradientB})`,boxShadow:"0 4px 16px rgba(47,158,85,0.3)"}}>
        <Banknote size={18}/> Encaisser {totals.tTTC.toFixed(2)}€</Btn>
    </Modal>
  </div>);
}

/* ══════════ STATS SCREEN ══════════ */
function StatsScreen(){
  const{tickets,products,avoirs,bestSellers:allBestSellers,salesBySeller,salesByVariant,caEvolution,salesByCollection,exportCSVReport,perm,commissions,salesGoals,setSellerGoal}=useApp();
  const[tab,setTab]=useState("ca");
  const[dateFrom,setDateFrom]=useState("");const[dateTo,setDateTo]=useState("");const[catFilter,setCatFilter]=useState("");
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
    return<Badge color={p>=0?"#3B8C5A":C.danger}>{p>=0?"+":""}{p.toFixed(1)}%</Badge>;};
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
      {perm().canViewMargin&&<SC icon={BarChart2} label="Marge" value={`${stats.margin.toFixed(0)}€`} color="#3B8C5A"/>}
      <SC icon={BarChart2} label="Marge %" value={stats.tHT>0?`${(stats.margin/stats.tHT*100).toFixed(1)}%`:"—"} color="#3B8C5A"/></div>

    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[{id:"ca",l:"Évolution CA"},{id:"compare",l:"Comparaison"},{id:"hour",l:"CA par heure"},{id:"dow",l:"CA par jour"},{id:"best",l:"Best-sellers"},{id:"variantDetail",l:"Détail variantes"},{id:"seller",l:"Par vendeur"},{id:"variant",l:"Tailles/Couleurs"},{id:"collection",l:"Collections"},{id:"customers",l:"Clients"},{id:"returns",l:"Retours"},{id:"pay",l:"Paiements"},{id:"discounts",l:"Remises"}].map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${tab===t.id?C.primary:C.border}`,
          background:tab===t.id?C.primary:"transparent",color:tab===t.id?"#fff":C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>{t.l}</button>))}</div>

    {tab==="ca"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <ResponsiveContainer width="100%" height={280}><LineChart data={fCAEvol}>
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
          {perm().canViewMargin&&<td style={{padding:8,color:"#3B8C5A",fontWeight:600}}>{p.margin.toFixed(2)}€</td>}
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
          {perm().canViewMargin&&<td style={{padding:8,color:"#3B8C5A"}}>{s.margin.toFixed(2)}€</td>}
          <td style={{padding:8,fontWeight:700,color:C.primary}}>{s.revenue.toFixed(2)}€</td>
          {perm().canViewMargin&&<td style={{padding:8,color:C.accent,fontWeight:600}}>{s.commission.toFixed(2)}€</td>}
          <td style={{padding:8}}><input type="number" value={s.goal||""} onChange={e=>setSellerGoal(s.name,parseFloat(e.target.value)||0)}
            style={{width:70,padding:"2px 6px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,fontFamily:"inherit"}} placeholder="€"/></td>
          <td style={{padding:8}}>{s.goal>0?<div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{flex:1,height:6,background:C.surfaceAlt,borderRadius:3,overflow:"hidden"}}>
              <div style={{width:`${Math.min(100,s.goalProgress)}%`,height:"100%",background:s.goalProgress>=100?"#3B8C5A":C.primary,borderRadius:3}}/></div>
            <span style={{fontSize:10,fontWeight:600,color:s.goalProgress>=100?"#3B8C5A":C.textMuted}}>{s.goalProgress.toFixed(0)}%</span></div>:"—"}</td>
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
          <td style={{padding:8,color:"#3B8C5A"}}>{s.margin.toFixed(2)}€</td></tr>))}</tbody></table></div>}

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
                {p!==null&&<div style={{fontSize:13,fontWeight:700,color:p>=0?"#3B8C5A":C.danger,marginTop:4}}>{p>=0?"▲":"▼"} {Math.abs(p).toFixed(1)}%</div>}
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
  const sizes=[...new Set(p?.variants.map(v=>v.size)||[])];const colors=[...new Set(p?.variants.map(v=>v.color)||[])];
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
          <td style={{padding:6}}><Badge color={m.qty>0?"#3B8C5A":C.danger}>{m.type}</Badge></td>
          <td style={{padding:6,fontWeight:600}}>{m.productName}</td>
          <td style={{padding:6,color:C.textMuted}}>{m.variantColor}/{m.variantSize}</td>
          <td style={{padding:6,fontWeight:700,color:m.qty>0?"#3B8C5A":C.danger}}>{m.qty>0?"+":""}{m.qty}</td>
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
          <td style={{padding:8}}><Badge color={p.daysSinceLastSale>60?C.danger:p.daysSinceLastSale>30?C.warn:"#3B8C5A"}>{p.daysSinceLastSale>60?"Critique":p.daysSinceLastSale>30?"À surveiller":"OK"}</Badge></td>
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
        disabled={!adjProd||!adjVar||adjQty===""} style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>
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
                <td style={{padding:6,fontWeight:700,color:diff===null||diff===0?C.textMuted:diff>0?"#3B8C5A":C.danger}}>
                  {diff!==null?(diff>0?`+${diff}`:diff):"—"}</td></tr>);})
          )}</tbody></table></div>
      <Btn onClick={()=>{let count=0;Object.entries(invCounts).forEach(([key,val])=>{if(val===""||val===undefined)return;
        const[pid,vid]=key.split("_");const pr=products.find(x=>x.id===pid);const vr=pr?.variants.find(x=>x.id===vid);
        if(pr&&vr&&parseInt(val)!==vr.stock){adjustStock(pid,vid,parseInt(val),"INVENTAIRE");count++;}});
        setInvCounts({});notify(`${count} ajustement(s) validé(s)`,"success");}}
        disabled={!Object.values(invCounts).some(v=>v!==""&&v!==undefined)}
        style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Save size={14}/> Valider l'inventaire</Btn>
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
        style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Upload size={14}/> Enregistrer la réception</Btn></Modal>

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
              <td style={{padding:4}}>{r.status==="found"?<Badge color="#3B8C5A">Trouvé</Badge>:<Badge color={C.danger}>Non trouvé</Badge>}</td></tr>))}</tbody></table></div>
        <Btn onClick={()=>{csvStPreview.filter(r=>r.status==="found"&&r.qty>0).forEach(r=>{
          receiveStock(r.match.product.id,r.match.variant.id,r.qty,r.supplier||"Import CSV");});
          setCsvStockModal(false);setCsvStStep(0);}}
          style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Upload size={14}/> Réceptionner {csvStPreview.filter(r=>r.status==="found"&&r.qty>0).length} ligne(s)</Btn></div>}
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
        style={{width:"100%",height:44,background:`linear-gradient(135deg,${C.accent},#D4A574)`}}>Sortir en tenue employé</Btn>
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
        const slip=`JUSTIFICATIF DE TRANSFERT\n${"═".repeat(40)}\nN°: ${transferNum}\nDate: ${new Date().toLocaleString("fr-FR")}\nOrigine: ${settings.name||"Magasin"}\nDestination: ${trDest}\n${"─".repeat(40)}\nProduit: ${prod.name}\nVariante: ${vari.color} / ${vari.size}\nSKU: ${prod.sku}\nQuantité: ${q}\nRéférence: ${trRef||"—"}\n${"─".repeat(40)}\nOpérateur: ${(users||[]).find(u=>u.name)?.name||"—"}\n\nSignature origine: ________________\nSignature destination: ________________`;
        const blob=new Blob([slip],{type:"text/plain"});const url=URL.createObjectURL(blob);
        const a=document.createElement("a");a.href=url;a.download=`transfert-${transferNum}.txt`;a.click();URL.revokeObjectURL(url);
        notify(`Transfert ${transferNum} — ${prod.name} x${q} → ${trDest} — Justificatif téléchargé`,"success");
        setTrProd("");setTrVar("");setTrQty("1");setTrDest("");setTrRef("");}}
        style={{width:"100%",height:44,background:`linear-gradient(135deg,${C.info},#5A92E8)`}}>Transférer et générer justificatif</Btn>
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
    setReturnItems((ticket.items||[]).map(i=>({productId:i.product?.id||i.product_id,variantId:i.variant?.id||i.variant_id,
      name:i.product?.name||i.product_name,sku:i.product?.sku||i.product_sku||"",ean:i.variant?.ean||i.variant_ean||"",color:i.variant?.color||i.variant_color,size:i.variant?.size||i.variant_size,
      maxQty:i.quantity,qty:0,unitTTC:(i.lineTTC||i.line_ttc||(i.unit_price*i.quantity))/i.quantity})));
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
      <Input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={{width:140,height:32,fontSize:11,padding:"4px 10px"}}/></div>

    {tab==="tickets"&&(<>{pagedTickets.length?pagedTickets.map((t,idx)=>(
      <div key={t.ticketNumber||t.id||idx} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:12,background:C.surface,border:`1.5px solid ${C.border}`,marginBottom:5,transition:"all 0.12s"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary+"44"} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
        <Receipt size={14} color={C.textMuted}/>
        <div style={{flex:1,cursor:"pointer"}} onClick={()=>setReprintTk(t)}>
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

    {/* Ticket detail/reprint modal */}
    <Modal open={!!reprintTk} onClose={()=>setReprintTk(null)} title={`Ticket ${reprintTk?.ticketNumber}`} wide>
      {reprintTk&&<div data-print-receipt style={{fontFamily:"'Courier New',monospace",fontSize:10,background:"#FAFAF8",borderRadius:10,padding:16,border:`1px solid ${C.border}`}}>
        <div style={{textAlign:"center",marginBottom:6}}><div style={{fontSize:12,fontWeight:700}}>{settings.name||CO.name}</div>
          <div>{settings.address}, {settings.postalCode} {settings.city}</div>
          <div>SIRET: {settings.siret||CO.siret} — TVA: {settings.tvaIntra||CO.tvaIntra}</div></div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>N° {reprintTk.ticketNumber}</span><span>{new Date(reprintTk.date||reprintTk.createdAt||"").toLocaleString("fr-FR")}</span></div>
        <div>Caissier: {reprintTk.userName}{reprintTk.customerName?` — Client: ${reprintTk.customerName}`:""}</div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        {(reprintTk.items||[]).map((i,k)=>{const sku=i.product?.sku||i.product_sku||"";const ean=i.variant?.ean||i.variant_ean||"";return(<div key={k}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}><span style={{flex:1,wordBreak:"break-word",lineHeight:1.3}}>{i.product?.name||i.product_name}{!(i.isCustom||i.is_custom)?` (${i.variant?.color||i.variant_color}/${i.variant?.size||i.variant_size})`:""} x{i.quantity}{i.discount>0?` -${i.discount}${i.discountType==="amount"?"€":"%"}`:""}</span>
          <span style={{whiteSpace:"nowrap",fontWeight:600}}>{(i.lineTTC||i.line_ttc||(i.unit_price*i.quantity)).toFixed(2)}€</span></div>
          {(sku||ean)&&<div style={{fontSize:8,color:"#999"}}>{sku?`Réf: ${sku}`:""}{sku&&ean?" — ":""}{ean?`EAN: ${ean}`:""}</div>}
        </div>);})}
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        {reprintTk.globalDiscount>0&&<div style={{display:"flex",justifyContent:"space-between",color:"#3B8C5A"}}><span>Remise</span><span>-{(reprintTk.globalDiscount||0).toFixed(2)}€</span></div>}
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Total HT</span><span>{(reprintTk.totalHT||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>TVA</span><span>{(reprintTk.totalTVA||0).toFixed(2)}€</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,marginTop:3}}><span>TOTAL TTC</span><span>{(reprintTk.totalTTC||0).toFixed(2)}€</span></div>
        <div style={{borderTop:"1px dashed #999",margin:"4px 0"}}/>
        <div>Paiement: {reprintTk.payments?.map(pm=>`${({cash:"ESP",card:"CB",amex:"AMEX",giftcard:"CAD",cheque:"CHQ",avoir:"AVOIR"})[pm.method]||pm.method} ${pm.amount.toFixed(2)}€`).join(" + ")}</div>
        <div style={{textAlign:"center",background:C.fiscalLight,padding:6,borderRadius:6,margin:"6px 0"}}>
          <div style={{fontSize:8,color:C.fiscal,fontWeight:700}}>EMPREINTE NF525</div>
          <div style={{fontSize:11,fontWeight:700,color:C.fiscal,letterSpacing:2}}>{reprintTk.fingerprint}</div></div>
        <div style={{textAlign:"center",fontSize:8,color:C.textMuted}}>{CO.sw} v{CO.ver} — Certifié NF525<br/>N° CERT-NF525-2026-001 — INFOCERT/LNE<br/>{settings.footerMsg||CO.footerMsg}</div>
      </div>}
      {reprintTk&&<div style={{display:"flex",gap:8,marginTop:10}}>
        <Btn variant="outline" onClick={()=>thermalPrint("receipt",reprintTk)} style={{flex:1}}><Printer size={14}/> {printerConnected?"Ticket":"Réimprimer"}</Btn>
        <Btn variant="outline" onClick={()=>{setReassignModal(reprintTk);setReassignCust(null);}} style={{flex:1}}><UserIcon size={14}/> Client</Btn>
        <Btn variant="outline" onClick={()=>{const s=encodeURIComponent(`Ticket ${reprintTk.ticketNumber} — ${settings.name||CO.name}`);
          const b=encodeURIComponent(`Bonjour,\n\nTicket N°${reprintTk.ticketNumber}\nDate: ${new Date(reprintTk.date||reprintTk.createdAt||"").toLocaleString("fr-FR")}\nTotal: ${(reprintTk.totalTTC||0).toFixed(2)}€\n\n${settings.name||CO.name}\nSIRET: ${settings.siret||CO.siret}`);
          window.open(`mailto:${reprintTk.customerName?"":""}?subject=${s}&body=${b}`);}} style={{flex:1}}><Mail size={14}/> Email</Btn>
        {p().canVoid&&<Btn variant="danger" onClick={()=>{setReprintTk(null);openReturn(reprintTk);}} style={{flex:1}}><RotateCcw size={14}/> Retour</Btn>}
      </div>}
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
    <Modal open={!!avoirDetail} onClose={()=>setAvoirDetail(null)} title={`Avoir ${avoirDetail?.avoirNumber}`} wide>
      {avoirDetail&&<div data-print-receipt style={{fontFamily:"'Courier New',monospace",fontSize:10,background:"#FFF5F5",borderRadius:10,padding:16,border:`1px solid ${C.danger}33`}}>
        <div style={{textAlign:"center",marginBottom:6,color:C.danger,fontWeight:700,fontSize:12}}>AVOIR / NOTE DE CRÉDIT</div>
        <div style={{textAlign:"center",marginBottom:6}}><div style={{fontSize:12,fontWeight:700}}>{settings.name||CO.name}</div>
          <div>SIRET: {settings.siret||CO.siret}</div></div>
        <div style={{borderTop:"1px dashed #C44B4B",margin:"4px 0"}}/>
        <div>N° {avoirDetail.avoirNumber}</div>
        <div>Ticket original: {avoirDetail.originalTicket} du {new Date(avoirDetail.originalDate).toLocaleDateString("fr-FR")}</div>
        <div>Date: {new Date(avoirDetail.date).toLocaleString("fr-FR")} — {avoirDetail.userName}</div>
        {avoirDetail.customerName&&<div>Client: {avoirDetail.customerName}</div>}
        <div>Motif: {avoirDetail.reason}</div>
        <div style={{borderTop:"1px dashed #C44B4B",margin:"4px 0"}}/>
        {avoirDetail.items.map((i,k)=>{const sku=i.product?.sku||"";const ean=i.variant?.ean||"";return(<div key={k}>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>{i.product.name}{i.variant?` (${i.variant.color}/${i.variant.size})`:""} x{i.quantity}</span>
          <span>-{i.lineTTC.toFixed(2)}€</span></div>
          {(sku||ean)&&<div style={{fontSize:8,color:"#C44B4B99"}}>{sku?`Réf: ${sku}`:""}{sku&&ean?" — ":""}{ean?`EAN: ${ean}`:""}</div>}
        </div>);})}
        <div style={{borderTop:"1px dashed #C44B4B",margin:"4px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,color:C.danger}}><span>TOTAL AVOIR</span><span>-{(avoirDetail.totalTTC||0).toFixed(2)}€</span></div>
        <div>Remboursement: {({cash:"Espèces",card:"Carte bancaire",avoir:"Avoir client"})[avoirDetail.refundMethod]||avoirDetail.refundMethod}</div>
        <div style={{textAlign:"center",background:"#F0E0E0",padding:6,borderRadius:6,margin:"6px 0"}}>
          <div style={{fontSize:8,color:C.danger,fontWeight:700}}>EMPREINTE NF525</div>
          <div style={{fontSize:11,fontWeight:700,color:C.danger,letterSpacing:2}}>{avoirDetail.fingerprint}</div></div>
      </div>}
      {avoirDetail&&<Btn variant="outline" onClick={()=>thermalPrint("avoir",avoirDetail)} style={{width:"100%",marginTop:10}}><Printer size={14}/> {printerConnected?"Ticket":"Imprimer"}</Btn>}
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
            if(reassignModal.id){try{await API.sales.update?.(reassignModal.id,{customerId:custId});}catch(e){}}
            notify(`Client ${custName||"retiré"} attribué au ticket ${reassignModal.ticketNumber}`,"success");
            setReassignModal(null);
          }catch(e){notify("Erreur: "+e.message,"error");}
        }} style={{width:"100%",height:40,marginTop:10,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>Attribuer</Btn>
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

  const toggleItem=(item,variant,maxQty)=>{const key=`${item.product?.id||item.productId}-${variant?.id||item.variantId}`;
    setReturnItems(prev=>{const existing=prev.find(r=>r.key===key);
      if(existing)return prev.filter(r=>r.key!==key);
      return[...prev,{key,productId:item.product?.id||item.productId,variantId:variant?.id||item.variantId,
        productName:item.product?.name||item.product_name,variantColor:variant?.color||item.variant_color,variantSize:variant?.size||item.variant_size,
        qty:1,maxQty:maxQty||item.quantity,unitPrice:item.lineTTC?item.lineTTC/item.quantity:(item.unit_price||0)}];});};
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
        <button key={m.id} onClick={()=>{setMode(m.id);setSelectedTk(null);setReturnItems([]);setFreeItem(null);}}
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

        {mode==="scan"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
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

        {mode==="free"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
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

        <Btn onClick={doReturn} style={{width:"100%",height:44,background:`linear-gradient(135deg,${C.fiscal},#8B6FC0)`,fontSize:13}}>
          <RotateCcw size={16}/> Valider le retour — {returnTotal.toFixed(2)}€</Btn>
      </div>}
    </div>

    {/* Avoir confirmation */}
    <Modal open={!!lastAvoir} onClose={()=>setLastAvoir(null)} title="Avoir émis">
      {lastAvoir&&<div style={{textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:32,background:`linear-gradient(135deg,${C.fiscal},#8B6FC0)`,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:10,
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
      <SC icon={TrendingUp} label="Marge" value={`${totalMargin.toFixed(0)}€`} color="#3B8C5A"/>
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
        <div style={{background:`linear-gradient(135deg,${C.accentLight},#F5E6D8)`,borderRadius:14,padding:14,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${C.accent}22`}}>
          <span style={{fontSize:14,fontWeight:700,color:C.accent}}>Total coupures</span>
          <span style={{fontSize:22,fontWeight:900,color:C.accent}}>{denomTotal.toFixed(2)}€</span></div>
        <div style={{fontSize:11,fontWeight:600,marginBottom:10,padding:"6px 10px",borderRadius:8,
          background:Math.abs(denomTotal-expected)<0.01?C.primaryLight:C.dangerLight,
          color:Math.abs(denomTotal-expected)<0.01?"#3B8C5A":C.danger}}>
          Écart vs attendu ({expected.toFixed(2)}€): {(denomTotal-expected)>=0?"+":""}{(denomTotal-expected).toFixed(2)}€ {Math.abs(denomTotal-expected)<0.01?"✓ OK":"⚠ Attention"}</div>
      </>:<>
        <div style={{marginBottom:10}}><label style={{fontSize:9,fontWeight:600,color:C.textMuted}}>ESPÈCES COMPTÉES (attendu: {expected.toFixed(2)}€)</label>
          <Input type="number" step="0.01" value={aCash} onChange={e=>setACash(e.target.value)} placeholder={expected.toFixed(2)}/>
          {cashDiff!==null&&<div style={{fontSize:10,fontWeight:600,marginTop:3,color:Math.abs(cashDiff)<0.01?"#3B8C5A":C.danger}}>
            Écart: {cashDiff>=0?"+":""}{cashDiff.toFixed(2)}€ {Math.abs(cashDiff)<0.01?"(OK)":"(attention)"}</div>}</div>
      </>}
      <div style={{marginBottom:12}}>
        <label style={{fontSize:9,fontWeight:600,color:C.textMuted}}>CARTE COMPTÉE (attendu: {card.toFixed(2)}€)</label>
        <Input type="number" step="0.01" value={aCard} onChange={e=>setACard(e.target.value)} placeholder={card.toFixed(2)}/>
        {cardDiff!==null&&<div style={{fontSize:10,fontWeight:600,marginTop:3,color:Math.abs(cardDiff)<0.01?"#3B8C5A":C.danger}}>
          Écart: {cardDiff>=0?"+":""}{cardDiff.toFixed(2)}€ {Math.abs(cardDiff)<0.01?"(OK)":"(attention)"}</div>}</div>
      <Btn variant="danger" onClick={async()=>{
        // Guard: empêcher double clôture journalière
        const todayStr=new Date().toISOString().split("T")[0];
        if(closures.some(c=>c.type==="daily"&&(c.period||c.date||"").startsWith(todayStr))){
          notify("Une clôture Z a déjà été faite aujourd'hui","error");return;}
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
        <div style={{display:"flex",justifyContent:"space-between",color:"#3B8C5A"}}><span>Marge brute</span><span>{(reportModal.totalMargin||0).toFixed(2)}€</span></div>
        <div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
        <div style={{fontWeight:700,marginBottom:4}}>VENTILATION PAIEMENTS</div>
        {reportModal.bySeller&&Object.entries(reportModal.bySeller).map(([name,amount])=>(
          <div key={name} style={{display:"flex",justifyContent:"space-between"}}><span>{name}</span><span>{amount.toFixed(2)}€</span></div>))}
        <div style={{borderTop:"1px dashed #999",margin:"6px 0"}}/>
        <div style={{fontWeight:700,marginBottom:4}}>CONTRÔLE CAISSE</div>
        {reportModal.expectedCash!=null&&<div style={{display:"flex",justifyContent:"space-between"}}><span>Espèces attendues</span><span>{reportModal.expectedCash.toFixed(2)}€</span></div>}
        {reportModal.actualCash!=null&&<div style={{display:"flex",justifyContent:"space-between"}}><span>Espèces comptées</span><span>{reportModal.actualCash.toFixed(2)}€</span></div>}
        {reportModal.actualCash!=null&&reportModal.expectedCash!=null&&<div style={{display:"flex",justifyContent:"space-between",color:Math.abs(reportModal.actualCash-reportModal.expectedCash)<0.01?"#3B8C5A":C.danger,fontWeight:700}}>
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
    setCustomers(p=>[...p,{id:"c"+Date.now()+Math.random().toString(36).slice(2,5),firstName:c.firstName,lastName:c.lastName,email:c.email,phone:c.phone,city:c.city,notes:c.notes,points:0,totalSpent:0}]);added++;});
    notify(`${added} client(s) importé(s)`,"success");setCsvModal(false);setCsvStep(0);setCsvData([]);};
  const filtered=customers.filter(c=>!search||`${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  const custTickets=sel?tickets.filter(t=>t.customerId===sel.id):[];
  const custAvg=custTickets.length?custTickets.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0)/custTickets.length:0;

  const startEdit=()=>{setEditData({firstName:sel.firstName,lastName:sel.lastName,email:sel.email,phone:sel.phone,city:sel.city||""});setEditMode(true);};
  const saveEdit=()=>{updateCustomer(sel.id,editData);setSel(s=>({...s,...editData}));setEditMode(false);};

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>Clients & Fidélité ({customers.length})</h2>
      <div style={{display:"flex",gap:6}}>
        <Btn variant="outline" onClick={()=>{setCsvModal(true);setCsvStep(0);setCsvData([]);}} style={{fontSize:11}}><Upload size={12}/> Import CSV</Btn>
        <Btn onClick={()=>setNewCustModal(true)} style={{fontSize:11,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Plus size={12}/> Nouveau client</Btn></div></div>
    <div style={{display:"flex",gap:10}}>
      <div style={{flex:sel?`0 0 280px`:"1",transition:"flex 0.3s ease",maxHeight:"calc(100vh - 140px)",overflowY:"auto"}}>
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher nom, email, téléphone…" style={{marginBottom:10,height:36}}/>
        <div style={{display:sel?"flex":"grid",flexDirection:"column",gridTemplateColumns:sel?"1fr":"repeat(auto-fill,minmax(260px,1fr))",gap:sel?4:8}}>
        {filtered.map(c=>{const tier=getLoyaltyTier(c.points);return(
          <div key={c.id} onClick={()=>{setSel(c);setEditMode(false);}} style={{display:"flex",alignItems:"center",gap:8,padding:sel?8:12,borderRadius:sel?8:12,
            background:sel?.id===c.id?C.primaryLight:C.surface,border:`1.5px solid ${sel?.id===c.id?C.primary:C.border}`,cursor:"pointer",transition:"all 0.15s"}}
            onMouseEnter={e=>{if(sel?.id!==c.id)e.currentTarget.style.borderColor=C.primary+"66";}} onMouseLeave={e=>{if(sel?.id!==c.id)e.currentTarget.style.borderColor=C.border;}}>
            <div style={{width:sel?30:36,height:sel?30:36,borderRadius:sel?15:18,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:sel?10:12}}>{c.firstName?.[0]}{c.lastName?.[0]}</div>
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
          {custTickets.length===0&&<div style={{color:C.textLight,fontSize:11}}>Aucun achat</div>}
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
        style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>Créer le client</Btn></Modal>

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
              <td style={{padding:4}}>{c._dup?<Badge color={C.warn}>Doublon</Badge>:<Badge color="#3B8C5A">Nouveau</Badge>}</td></tr>))}</tbody></table></div>
        <Btn onClick={importCustCSV} style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Upload size={14}/> Importer {csvPreview.filter(c=>!c._dup&&(c.firstName||c.lastName)).length} client(s)</Btn></div>}
    </Modal>

    {/* Delete confirmation */}
    <ConfirmDialog open={confirmDel} onClose={()=>setConfirmDel(false)} onConfirm={()=>{deleteCustomer(sel.id);setSel(null);}}
      title="Supprimer ce client ?" message={`Supprimer ${sel?.firstName} ${sel?.lastName} et toutes ses données ? Son historique d'achat sera conservé dans les tickets.`}/>
  </div>);
}

/* ══════════ FISCAL ══════════ */
function FiscalScreen(){
  const{gt,tSeq,lastHash,closures,exportArchive,exportFEC,perm:p,verifyChain,tvaSummary}=useApp();
  const[chainResult,setChainResult]=useState(null);
  if(!p().canExport)return<div style={{padding:40,textAlign:"center",color:C.textMuted}}>Accès réservé aux administrateurs</div>;
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><h2 style={{fontSize:22,fontWeight:800,margin:0}}>Conformité NF525</h2><Badge color={C.fiscal} bg={C.fiscalLight}>ISCA</Badge></div>
    <div style={{background:C.surface,borderRadius:14,padding:20,border:`1.5px solid ${C.fiscal}33`,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Shield size={20} color={C.fiscal}/><h3 style={{fontSize:16,fontWeight:700,color:C.fiscal,margin:0}}>Attestation de conformité</h3></div>
      <div style={{fontSize:12,lineHeight:1.8}}>
        <div><strong>Logiciel :</strong> {CO.sw} v{CO.ver}</div>
        <div><strong>N° certification :</strong> <span style={{fontFamily:"monospace",background:C.fiscalLight,padding:"2px 6px",borderRadius:4}}>CERT-NF525-2026-001</span></div>
        <div><strong>Organisme certificateur :</strong> INFOCERT / LNE</div>
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
  const{audit:localAudit,jet:localJet,exportCSVReport,isOnline}=useApp();
  const[filterUser,setFilterUser]=useState("");const[tab,setTab]=useState("audit");const[page,setPage]=useState(0);
  const[apiAudit,setApiAudit]=useState(null);const[apiJet,setApiJet]=useState(null);
  const PAGE_SIZE=50;
  // Charger depuis le backend au montage
  useEffect(()=>{
    if(!API.getToken())return;
    API.audit.list({limit:500}).then(rows=>setApiAudit(rows.map(r=>({id:r.id,date:r.created_at,action:r.action,detail:r.detail,ref:r.reference,user:r.user_name})))).catch(()=>{});
    API.audit.jet().then(rows=>setApiJet(rows.map(r=>({id:r.id,date:r.created_at,type:r.event_type,detail:r.detail,user:r.user_name})))).catch(()=>{});
  },[]);
  // Utiliser les données backend si dispo, sinon local
  const audit=apiAudit||localAudit;const jet=apiJet||localJet;
  const ac={VENTE:C.primary,VOID_LINE:C.warn,VOID_SALE:C.danger,CLOTURE:C.fiscal,CAISSE:C.accent,IMPORT:C.warn,PARK:"#888",PRODUCT:C.info,RECEPTION:"#3B8C5A",RGPD:C.fiscal,FEC:C.info,CLOCK_IN:"#3B8C5A",CLOCK_OUT:C.accent,PRICE_CHANGE:C.warn,EXPORT:C.info,AVOIR:C.fiscal};
  const jc={LOGIN:C.primary,LOGIN_OFFLINE:C.warn,LOGOUT:C.accent,AVOIR:C.fiscal,SYS_START:C.info,PARAM_CHANGE:C.warn,EXPORT:C.info,ERROR:C.danger,VOID_LINE:C.warn,VOID_SALE:C.danger};
  const users=[...new Set(audit.map(e=>e.user))];
  const filtered=filterUser?(tab==="audit"?audit:jet).filter(e=>e.user===filterUser):(tab==="audit"?audit:jet);
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);const pageData=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>{tab==="audit"?"Journal d'audit":"JET — Journal Événements Techniques"}</h2>
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
          stock:parseInt(gv("stock"))||0,defective:0,stockAlert:parseInt(gv("stockAlert"))||5,sortOrder:i};}),
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
            background:active?C.primary:done?"#3B8C5A":C.surfaceAlt,color:active||done?"#fff":C.textMuted,fontSize:10,fontWeight:700}}>
            {done?<CheckCircle2 size={13}/>:<Ic size={12}/>}</div>
          <span style={{fontSize:10,fontWeight:active?700:500,color:active?C.primary:done?"#3B8C5A":C.textMuted,whiteSpace:"nowrap"}}>{s.l}</span>
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
            {id:"addStock",l:"Ajouter quantité",d:"Ajouter la quantité CSV au stock existant (réception)",i:Plus,c:"#3B8C5A"}].map(o=>(
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
          <div style={{fontSize:18,fontWeight:800,color:processed.errors.length?C.danger:"#3B8C5A"}}>{processed.errors.length}</div>
          <div style={{fontSize:9,color:processed.errors.length?C.danger:"#3B8C5A",fontWeight:600}}>Erreurs</div></div>
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
      <div style={{width:64,height:64,borderRadius:32,background:"linear-gradient(135deg,#2F9E55,#4DA768)",display:"inline-flex",alignItems:"center",justifyContent:"center",
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
        style={{borderRadius:12,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>Suivant — Regroupement</Btn>}
      {step===2&&<Btn onClick={processData} style={{borderRadius:12,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>Suivant — Aperçu</Btn>}
      {step===3&&processed&&<Btn onClick={executeImport} disabled={importing||processed.newProducts.length+processed.updates.length===0}
        style={{borderRadius:12,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>
        {importing?<><span className="spin-loader"/> Import en cours…</>:<><Upload size={14}/> Importer {processed.newProducts.length+processed.updates.length} produit(s)</>}</Btn>}
      {step===4&&<Btn onClick={handleClose} style={{borderRadius:12,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>
        <CheckCircle2 size={14}/> Fermer</Btn>}
    </div>
  </Modal>);
}

/* ══════════ PRODUCTS MANAGEMENT ══════════ */
function ProductsScreen(){
  const{products,setProducts,refreshProducts,addProduct,addAudit,notify,perm:p,exportCatalog,duplicateProduct,
    updateProduct,deleteProduct,addVariantToProduct,deleteVariant,updateProductPrice,settings}=useApp();
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
        {p().canCreateProduct&&<Btn onClick={()=>setCreateModal(true)} style={{fontSize:11,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Plus size={12}/> Nouveau</Btn>}</div></div>
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
            <td style={{padding:"6px 10px"}}><Badge color={mg>50?"#3B8C5A":mg>30?C.accent:C.danger}>{mg.toFixed(0)}%</Badge></td>
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
              {TVA_RATES.map(t=>(<option key={t.id} value={t.rate}>{t.label}</option>))}</select></div>
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

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Btn variant="success" onClick={()=>{
            const newPrice=parseFloat(ep.price);const oldPrice=editModal.price;
            updateProduct(editModal.id,{name:ep.name,sku:ep.sku,costPrice:parseFloat(ep.costPrice)||0,
              taxRate:parseFloat(ep.taxRate),category:ep.category,collection:ep.collection});
            if(newPrice&&newPrice!==oldPrice)updateProductPrice(editModal.id,newPrice);
            setEditModal(null);}} style={{height:40}}>
            <Save size={14}/> Enregistrer</Btn>
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
        setAddVarModal(null);}}} style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>Ajouter la variante</Btn></Modal>

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
            {TVA_RATES.map(t=>(<option key={t.id} value={t.rate}>{t.label}</option>))}</select></div>
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
        style={{width:"100%",height:44,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>Créer le produit</Btn></Modal>

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
      <div style={{background:`linear-gradient(135deg,${C.primaryLight},#DCF0E2)`,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
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
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Politique de retour mise à jour");notify("Paramètres sauvegardés","success");}} style={{width:"100%",height:44,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Save size={14}/> Enregistrer</Btn>
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

function SettingsScreen(){
  const{settings,setSettings,saveSettingsToAPI,addAudit,theme,setTheme,clockEntries,priceHistory,printerConnected,printerType,connectPrinter,disconnectPrinter,thermalPrint,notify,users}=useApp();
  const[tab,setTab]=useState("general");
  const[printerBaud,setPrinterBaud]=useState("9600");
  const[printerWidth,setPrinterWidth]=useState("48");
  const[connecting,setConnecting]=useState(false);
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:14}}>Paramètres</h2>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[{id:"general",l:"Général"},{id:"pricing",l:"💰 Prix HT/TTC"},{id:"commission",l:"Commission"},{id:"stores",l:"Magasins"},{id:"printer",l:"🖨️ Imprimante"},{id:"return",l:"Retours"},{id:"sizes",l:"📏 Ordre tailles"},{id:"theme",l:"Thème"},{id:"clock",l:"Pointages"},{id:"prices",l:"Historique prix"}].map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${tab===t.id?C.primary:C.border}`,
          background:tab===t.id?C.primary:"transparent",color:tab===t.id?"#fff":C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>{t.l}</button>))}</div>

    {tab==="general"&&<div style={{maxWidth:500}}>
      {[{l:"Nom boutique",k:"name"},{l:"Adresse",k:"address"},{l:"Code postal",k:"postalCode"},{l:"Ville",k:"city"},{l:"SIRET",k:"siret"},{l:"N° TVA Intra",k:"tvaIntra"},{l:"Téléphone",k:"phone"},{l:"Message ticket",k:"footerMsg"}].map(f=>(
        <div key={f.k} style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>{f.l}</label>
          <Input value={settings[f.k]||""} onChange={e=>setSettings(s=>({...s,[f.k]:e.target.value}))}/></div>))}
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Paramètres mis à jour");notify("Paramètres sauvegardés","success");}} style={{width:"100%",height:40,marginTop:8,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Save size={14}/> Enregistrer</Btn></div>}

    {tab==="pricing"&&<div style={{maxWidth:550}}>
      <div style={{background:`linear-gradient(135deg,${C.primaryLight},#DCF0E2)`,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
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
      <div style={{background:`linear-gradient(135deg,${C.primaryLight},#DCF0E2)`,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
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
            value={settings.commissionRates?.[u.name]!=null?(settings.commissionRates[u.name]*100).toFixed(1):""}
            onChange={e=>{const val=e.target.value;setSettings(s=>({...s,commissionRates:{...s.commissionRates,[u.name]:val?parseFloat(val)/100:undefined}}));}}
            placeholder={((settings.defaultCommissionRate||0.05)*100).toFixed(1)}
            style={{width:80,textAlign:"right"}}/><span style={{fontSize:11,color:C.textMuted}}>%</span></div>))}
      </div>
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Taux de commission mis à jour");notify("Taux de commission sauvegardés","success");}} style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="stores"&&<div style={{maxWidth:600}}>
      <div style={{background:`linear-gradient(135deg,${C.primaryLight},#DCF0E2)`,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
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
        style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="printer"&&<div style={{maxWidth:600}}>
      {/* Printer status */}
      <div style={{background:printerConnected?C.primaryLight:C.surfaceAlt,borderRadius:14,padding:16,border:`1.5px solid ${printerConnected?C.primary+"44":C.border}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{width:12,height:12,borderRadius:6,background:printerConnected?"#3B8C5A":"#CCC",boxShadow:printerConnected?"0 0 8px #3B8C5A55":"none"}}/>
          <span style={{fontSize:14,fontWeight:700}}>{printerConnected?"Imprimante connectée":"Aucune imprimante"}</span>
          {printerConnected&&<Badge color={C.primary}>{printerType==="serial"?"Web Serial":"WebUSB"}</Badge>}</div>
        {printerConnected&&<div style={{fontSize:11,color:C.textMuted}}>L'impression ESC/POS est active. Les tickets seront envoyés directement à l'imprimante thermique.</div>}</div>

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
            disabled={connecting} style={{height:44,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>
            <Printer size={14}/> {connecting?"Connexion…":"Connecter (Port série)"}</Btn>}
          {!!navigator.usb&&<Btn onClick={async()=>{setConnecting(true);await connectPrinter("usb");setConnecting(false);}}
            disabled={connecting} style={{height:44,background:`linear-gradient(135deg,${C.info},#6BA3D6)`}}>
            <Printer size={14}/> {connecting?"Connexion…":"Connecter (USB)"}</Btn>}
        </div>

        {!navigator.serial&&!navigator.usb&&<div style={{background:C.warnLight,borderRadius:10,padding:12,marginTop:10,fontSize:11,color:"#92400E",border:`1px solid ${C.warn}33`}}>
          ⚠️ Votre navigateur ne supporte ni Web Serial ni WebUSB. Utilisez <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong> ou <strong>Opera</strong> pour connecter une imprimante thermique.</div>}
      </>:<>
        {/* Connected actions */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
          <Btn variant="outline" onClick={()=>thermalPrint("test")} style={{height:44}}><Printer size={14}/> Test impression</Btn>
          <Btn variant="outline" onClick={()=>thermalPrint("drawer")} style={{height:44}}><Box size={14}/> Ouvrir tiroir</Btn>
          <Btn variant="danger" onClick={async()=>{await disconnectPrinter();}} style={{height:44}}><XCircle size={14}/> Déconnecter</Btn></div>
      </>}

      {/* Info box */}
      <div style={{background:C.surfaceAlt,borderRadius:12,padding:14,marginTop:14,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>ℹ️ Imprimantes compatibles</div>
        <div style={{fontSize:10,color:C.textMuted,lineHeight:1.6}}>
          <strong>Port série (RS232/USB-Série):</strong> Epson TM-T20II/III, TM-T88V/VI, Star TSP100/TSP650, Bixolon SRP-350<br/>
          <strong>USB direct:</strong> Epson TM-T20, TM-m30, Star mC-Print3, Bixolon SRP-332II<br/>
          <strong>Protocole:</strong> ESC/POS standard — compatible avec la grande majorité des imprimantes thermiques<br/>
          <strong>Tiroir-caisse:</strong> Ouverture automatique via signal RJ11 (connecté à l'imprimante)</div></div>
    </div>}

    {tab==="return"&&<div style={{maxWidth:600}}>
      <div style={{background:`linear-gradient(135deg,${C.primaryLight},#DCF0E2)`,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
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
          <button onClick={()=>{const r=prompt("Nouveau motif de retour:");if(r){const reasons=[...(settings.returnPolicy?.reasons||["Échange taille","Échange couleur","Défectueux","Ne convient pas","Erreur achat","Autre"]),r];setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,reasons}}));}}}
            style={{padding:"4px 10px",borderRadius:8,border:`1.5px dashed ${C.primary}`,background:"transparent",color:C.primary,fontSize:11,fontWeight:600,cursor:"pointer"}}>+ Ajouter</button>
        </div>
      </div>

      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Politique de retour mise à jour");notify("Paramètres de retour sauvegardés","success");}} style={{width:"100%",height:44,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Save size={14}/> Enregistrer les paramètres de retour</Btn>
    </div>}

    {tab==="sizes"&&(()=>{
      const ranking=getSizeRanking();
      const entries=Object.entries(ranking).sort((a,b)=>a[1]-b[1]);
      const csvMap=getVariantOrderMap();
      const csvProductCount=Object.keys(csvMap).length;

      const updateRank=(size,newRank)=>{const r={...ranking,[size]:parseFloat(newRank)||0};saveSizeRanking(r);notify("Ranking sauvegardé","success");};
      const removeSize=(size)=>{const r={...ranking};delete r[size];saveSizeRanking(r);notify("Taille supprimée","success");};
      const addSize=()=>{const s=prompt("Nouvelle taille (ex: 3XL, 44, etc.):");if(!s)return;
        const key=s.toUpperCase().trim();if(ranking[key]!=null){notify("Cette taille existe déjà","error");return;}
        const maxR=entries.length?Math.max(...entries.map(e=>e[1]))+1:1;
        const r={...ranking,[key]:maxR};saveSizeRanking(r);notify("Taille ajoutée","success");};
      const resetToDefault=()=>{saveSizeRanking({...DEFAULT_SIZE_RANKING});notify("Ranking réinitialisé aux valeurs par défaut","info");};

      return(<div style={{maxWidth:650}}>
        {/* Section 1: Global size ranking */}
        <div style={{background:`linear-gradient(135deg,${C.primaryLight},#DCF0E2)`,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <Grid size={20} color={C.primary}/>
            <div><h3 style={{fontSize:16,fontWeight:800,margin:0}}>Ranking des tailles</h3>
              <p style={{fontSize:11,color:C.textMuted,margin:0}}>Ordre par défaut des tailles (S=3, M=4, L=5...). Utilisé quand un produit n'a pas d'ordre CSV spécifique.</p></div></div></div>

        <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <h4 style={{fontSize:13,fontWeight:700,margin:0}}>Tailles et positions ({entries.length})</h4>
            <div style={{display:"flex",gap:6}}>
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

        {/* Section 2: CSV product orders */}
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
      </div>);})()}

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
        <Badge color={e.type==="IN"?"#3B8C5A":C.danger}>{e.type}</Badge>
        <span style={{flex:1,fontWeight:600}}>{e.userName}</span>
        <span style={{color:C.textMuted}}>{new Date(e.date).toLocaleString("fr-FR")}</span></div>))}</div>}

    {tab==="prices"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Historique des changements de prix</h3>
      {priceHistory.length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight}}>Aucun changement</div>}
      {priceHistory.slice(0,30).map(e=>(<div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:6,borderBottom:`1px solid ${C.border}`,fontSize:11}}>
        <span style={{flex:1,fontWeight:600}}>{e.productName}</span>
        <span style={{color:C.danger,textDecoration:"line-through"}}>{e.oldPrice.toFixed(2)}€</span>
        <span>→</span>
        <span style={{color:"#3B8C5A",fontWeight:700}}>{e.newPrice.toFixed(2)}€</span>
        <span style={{color:C.textMuted,fontSize:9}}>{e.user} — {new Date(e.date).toLocaleDateString("fr-FR")}</span></div>))}</div>}
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
          disabled={!amount} style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.accent},#D4A574)`}}><Gift size={14}/> Créer la carte</Btn>
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
  const{promos,setPromos,perm:p,addAudit,notify}=useApp();
  const[createModal,setCreateModal]=useState(false);
  const[np,setNp]=useState({name:"",type:"collection_discount",value:"",collection:"",minQty:"3",code:"",startDate:"",endDate:""});

  if(!p().canManagePromos)return<div style={{padding:40,textAlign:"center",color:C.textMuted}}>Accès réservé aux administrateurs</div>;

  const togglePromo=(id)=>setPromos(p=>p.map(x=>x.id===id?{...x,active:!x.active}:x));
  const deletePromo=(id)=>{setPromos(p=>p.filter(x=>x.id!==id));addAudit("PROMO","Suppression promo");notify("Promo supprimée","warn");};

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>Promotions</h2>
      <Btn onClick={()=>setCreateModal(true)} style={{fontSize:11,background:`linear-gradient(135deg,${C.warn},#E8B930)`}}><Plus size={12}/> Nouvelle promo</Btn></div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {promos.map(pm=>(<div key={pm.id} style={{display:"flex",alignItems:"center",gap:10,padding:12,borderRadius:12,background:C.surface,
        border:`1.5px solid ${pm.active?C.warn+"44":C.border}`,opacity:pm.active?1:0.6}}>
        <div style={{width:8,height:8,borderRadius:4,background:pm.active?"#3B8C5A":C.textLight}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700}}>{pm.name} <Badge color={C.warn}>-{pm.value}%</Badge></div>
          <div style={{fontSize:10,color:C.textMuted}}>
            {pm.type==="collection_discount"&&`Collection: ${pm.collection}`}
            {pm.type==="qty_discount"&&`Min. ${pm.minQty} articles`}
            {pm.type==="code"&&`Code: ${pm.code}`}
            {pm.startDate&&` — Du ${pm.startDate}`}{pm.endDate&&` au ${pm.endDate}`}
          </div></div>
        <Btn variant={pm.active?"success":"outline"} onClick={()=>togglePromo(pm.id)} style={{fontSize:10,padding:"4px 12px"}}>
          {pm.active?"Active":"Inactive"}</Btn>
        <button onClick={()=>deletePromo(pm.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.danger}}><Trash2 size={14}/></button>
      </div>))}
      {promos.length===0&&<div style={{textAlign:"center",padding:30,color:C.textLight}}>Aucune promotion</div>}
    </div>

    <Modal open={createModal} onClose={()=>setCreateModal(false)} title="Nouvelle promotion" wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div style={{gridColumn:"span 2"}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>NOM</label>
          <Input value={np.name} onChange={e=>setNp(p=>({...p,name:e.target.value}))} placeholder="Ex: Soldes été -30%"/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>TYPE</label>
          <select value={np.type} onChange={e=>setNp(p=>({...p,type:e.target.value}))} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
            <option value="collection_discount">Remise sur collection</option>
            <option value="qty_discount">Remise sur quantité</option>
            <option value="code">Code promo</option></select></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>VALEUR (%)</label>
          <Input type="number" value={np.value} onChange={e=>setNp(p=>({...p,value:e.target.value}))} placeholder="Ex: 30"/></div>
        {np.type==="collection_discount"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>COLLECTION</label>
          <Input value={np.collection} onChange={e=>setNp(p=>({...p,collection:e.target.value}))} placeholder="Ex: PE-2026"/></div>}
        {np.type==="qty_discount"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>QUANTITÉ MIN.</label>
          <Input type="number" value={np.minQty} onChange={e=>setNp(p=>({...p,minQty:e.target.value}))} placeholder="3"/></div>}
        {np.type==="code"&&<div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>CODE</label>
          <Input value={np.code} onChange={e=>setNp(p=>({...p,code:e.target.value}))} placeholder="Ex: WELCOME10"/></div>}
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>DATE DÉBUT</label>
          <Input type="date" value={np.startDate} onChange={e=>setNp(p=>({...p,startDate:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>DATE FIN</label>
          <Input type="date" value={np.endDate} onChange={e=>setNp(p=>({...p,endDate:e.target.value}))}/></div></div>
      <Btn onClick={()=>{if(np.name&&np.value){
        setPromos(p=>[...p,{id:String(Date.now()),name:np.name,type:np.type,value:parseFloat(np.value),
          collection:np.collection,minQty:parseInt(np.minQty)||3,code:np.code,
          active:true,startDate:np.startDate,endDate:np.endDate}]);
        addAudit("PROMO",`Nouvelle promo: ${np.name}`);notify(`Promo "${np.name}" créée`,"success");
        setCreateModal(false);setNp({name:"",type:"collection_discount",value:"",collection:"",minQty:"3",code:"",startDate:"",endDate:""});}}}
        style={{width:"100%",height:44,background:`linear-gradient(135deg,${C.warn},#E8B930)`}}>Créer la promotion</Btn></Modal>
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
        <div style={{fontSize:32,fontWeight:900,color:conversionRate>=20?"#2F9E55":conversionRate>=10?C.warn:C.danger}}>{conversionRate.toFixed(1)}%</div></div>
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
          style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}>Enregistrer</Btn>
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
            <td style={{padding:8,fontWeight:700,color:conv>=20?"#2F9E55":conv>=10?C.warn:C.danger}}>{conv.toFixed(1)}%</td>
          </tr>);})}</tbody></table>
    </div>
  </div>);
}

function CashierNav({active,onNav}){
  const{currentUser,logout,isOnline,stockAlerts,clockIn,clockOut,pendingSync,clearPendingSync,openCustomerDisplay}=useApp();
  const items=[{id:"sales",l:"Vente",i:ShoppingCart},{id:"returns",l:"Retours",i:RotateCcw},{id:"stats",l:"Stats",i:BarChart3},{id:"stock",l:"Stock",i:Grid},
    {id:"products",l:"Produits",i:Package},{id:"history",l:"Tickets",i:Receipt},{id:"customers",l:"Clients",i:Users},{id:"giftcards",l:"Cadeaux",i:Gift},
    {id:"promos",l:"Promos",i:Zap},{id:"closure",l:"Clôture",i:Lock},{id:"footfall",l:"Entrées",i:Activity},
    {id:"audit",l:"Audit",i:Activity},{id:"fiscal",l:"NF525",i:Shield},{id:"settings",l:"Réglages",i:Settings}];
  return(<div style={{width:76,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",alignItems:"center",padding:"12px 0",gap:2,boxShadow:`2px 0 12px ${C.shadow}`}}>
    <div style={{width:42,height:42,borderRadius:13,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`,display:"flex",alignItems:"center",justifyContent:"center",
      color:"#fff",fontWeight:800,fontSize:15,marginBottom:4,boxShadow:`0 4px 14px ${C.primary}25`,letterSpacing:"-0.5px"}}>{currentUser?.name?.[0]}</div>
    <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:3}}>
      <div style={{width:7,height:7,borderRadius:4,background:isOnline?"#2F9E55":C.danger,boxShadow:isOnline?"0 0 6px #2F9E5555":"0 0 6px #D1453B55"}}/>
      <span style={{fontSize:8,color:C.textMuted,fontWeight:600}}>{isOnline?"Online":"Offline"}</span></div>
    {pendingSync.length>0&&<div onClick={()=>{if(confirm(`${pendingSync.length} synchro(s) en échec.\n\nVoulez-vous vider la file d'attente ?`))clearPendingSync();}}
      style={{fontSize:7,color:C.warn,fontWeight:700,marginBottom:2,cursor:"pointer"}} title="Cliquer pour vider la file de synchro">⏳ {pendingSync.length} sync</div>}
    <div style={{display:"flex",gap:3,marginBottom:8}}>
      <button onClick={clockIn} title="Pointer entrée" style={{width:28,height:24,borderRadius:8,border:"none",cursor:"pointer",background:C.primaryLight,color:C.primary,fontSize:8,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>IN</button>
      <button onClick={clockOut} title="Pointer sortie" style={{width:28,height:24,borderRadius:8,border:"none",cursor:"pointer",background:C.dangerLight,color:C.danger,fontSize:8,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>OUT</button></div>
    <div style={{flex:1,display:"flex",flexDirection:"column",gap:2,overflowY:"auto",width:"100%",padding:"0 6px"}}>
      {items.map(({id,l,i:I})=>(<button key={id} onClick={()=>onNav(id)} title={l} style={{width:"100%",height:48,borderRadius:12,border:"none",cursor:"pointer",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,
        background:active===id?`linear-gradient(135deg,${C.primary},${C.gradientB})`:"transparent",
        color:active===id?"#fff":C.textMuted,position:"relative",
        transition:"all 0.15s",fontFamily:"inherit",boxShadow:active===id?`0 3px 10px ${C.primary}25`:"none"}}
        onMouseEnter={e=>{if(active!==id)e.currentTarget.style.background=C.surfaceAlt;}}
        onMouseLeave={e=>{if(active!==id)e.currentTarget.style.background="transparent";}}>
        <I size={16}/><span style={{fontSize:8,fontWeight:active===id?700:600,lineHeight:1,letterSpacing:"0.02em"}}>{l}</span>
        {id==="stock"&&stockAlerts.length>0&&<span style={{position:"absolute",top:3,right:5,width:15,height:15,borderRadius:8,
          background:C.danger,color:"#fff",fontSize:8,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:`0 2px 6px ${C.danger}40`}}>{stockAlerts.length}</span>}
      </button>))}</div>
    <div style={{borderTop:`1px solid ${C.border}`,paddingTop:8,width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <button onClick={openCustomerDisplay} title="Écran client" style={{width:"calc(100% - 12px)",height:36,borderRadius:10,border:"none",cursor:"pointer",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
        background:`${C.info}08`,color:C.info,fontFamily:"inherit",transition:"all 0.15s",fontSize:8,fontWeight:600}}
        onMouseEnter={e=>e.currentTarget.style.background=`${C.info}15`} onMouseLeave={e=>e.currentTarget.style.background=`${C.info}08`}>
        <LayoutDashboard size={13}/><span>Écran 2</span></button>
      <button onClick={logout} title="Déconnexion" style={{width:"calc(100% - 12px)",height:44,borderRadius:12,border:"none",cursor:"pointer",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,
        background:`${C.danger}08`,color:C.danger,fontFamily:"inherit",transition:"all 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background=C.dangerLight} onMouseLeave={e=>e.currentTarget.style.background=`${C.danger}08`}>
        <LogOut size={15}/><span style={{fontSize:8,fontWeight:600}}>Sortir</span></button></div></div>);
}

function CashierInterface(){
  const[sr,setSr]=useState(true);const[sc,setSc]=useState("sales");
  if(sr)return<CashRegControl onSkip={()=>setSr(false)} onDone={()=>setSr(false)}/>;
  const S={sales:SalesScreen,returns:ReturnScreen,stats:StatsScreen,stock:StockScreen,history:HistoryScreen,customers:CustomersScreen,
    giftcards:GiftCardScreen,promos:PromosScreen,products:ProductsScreen,closure:ClosureScreen,footfall:FootfallScreen,audit:AuditScreen,fiscal:FiscalScreen,settings:SettingsScreen};
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
    // Construire les données API — n'envoyer le password que s'il a été modifié
    const apiData={name:form.name,role:form.role};
    if(form.pin)apiData.password=form.pin;
    if(editUser){
      setUsers(p=>p.map(u=>u.id===editUser.id?{...u,name:form.name,role:form.role,...(form.pin?{pin:form.pin}:{})}:u));
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
        setUsers(p=>[...p,{id:apiUser.id||("u"+Date.now()),name:form.name,role:form.role,pin:form.pin,apiSynced:true}]);
        setNewModal(false);notify("Utilisateur créé et synchronisé","success");
      }catch(e){
        console.error("createUser error:",e.message,apiData);
        if(!isOnline||e.message?.includes("fetch")||e.message?.includes("network")||e.message?.includes("Failed")){
          const localId="u"+Date.now();
          setUsers(p=>[...p,{id:localId,name:form.name,role:form.role,pin:form.pin,pendingSync:true}]);
          addPendingSync({type:"createUser",data:apiData,localId});
          setNewModal(false);notify("Hors ligne — synchro en attente","warn");
        }else{setNewModal(false);notify(`Erreur serveur: ${e.message}`,"error");}
      }
    }
    setForm({name:"",role:"cashier",pin:""});};
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>Utilisateurs ({users.length})</h2>
      <Btn onClick={()=>{setForm({name:"",role:"cashier",pin:""});setNewModal(true);}} style={{fontSize:11,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Plus size={12}/> Nouvel utilisateur</Btn></div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {users.map(u=>(<div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:12,borderRadius:12,background:C.surface,border:`1.5px solid ${C.border}`}}>
        <div style={{width:36,height:36,borderRadius:18,background:`linear-gradient(135deg,${u.role==="admin"?C.accent:C.primary},${u.role==="admin"?"#D4A574":C.gradientB})`,
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
      <Btn onClick={saveUser} style={{width:"100%",height:40,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Save size={14}/> {editUser?"Enregistrer":"Créer"}</Btn></Modal>
    <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={async()=>{
      setUsers(p=>p.filter(u=>u.id!==confirmDel.id));
      try{await API.auth.deleteUser(confirmDel.id);notify("Utilisateur supprimé et synchronisé","warn");
      }catch(e){addPendingSync({type:"deleteUser",userId:confirmDel.id});notify("Utilisateur supprimé localement — synchro en attente","warn");}}}
      title="Supprimer cet utilisateur ?" message={`Supprimer ${confirmDel?.name} ?`}/>
  </div>);
}

function DashboardNav({active,onNav}){
  const{logout,currentUser}=useApp();
  const items=[{id:"overview",l:"Dashboard",i:LayoutDashboard},{id:"products",l:"Produits",i:Package},{id:"stock",l:"Stock",i:Grid},
    {id:"stats",l:"Statistiques",i:BarChart3},{id:"returns",l:"Retours & Avoirs",i:RotateCcw},{id:"customers",l:"Clients",i:Users},{id:"users",l:"Utilisateurs",i:UserIcon},
    {id:"tva",l:"Taux de TVA",i:Percent},{id:"giftcards",l:"Cartes cadeaux",i:Gift},{id:"promos",l:"Promotions",i:Zap},{id:"footfall",l:"Entrées",i:Activity},{id:"settings",l:"Paramètres",i:Settings},{id:"fiscal",l:"Fiscal NF525",i:Shield},{id:"audit",l:"Journal d'audit",i:Activity}];
  return(<div style={{width:230,background:"linear-gradient(180deg,#1A2830,#1E3035)",height:"100vh",display:"flex",flexDirection:"column"}}>
    <div style={{padding:"20px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 12px ${C.primary}30`}}><Store size={18} color="#fff"/></div>
        <div><div style={{color:"#fff",fontSize:14,fontWeight:800,letterSpacing:"-0.3px"}}>CaissePro</div>
          <div style={{color:"rgba(255,255,255,0.45)",fontSize:9,fontWeight:500}}>v{CO.ver} — NF525</div></div></div>
      <div style={{marginTop:14,padding:"8px 10px",borderRadius:10,background:"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:28,height:28,borderRadius:9,background:`linear-gradient(135deg,${C.accent},#D4A574)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700}}>{currentUser?.name?.[0]}</div>
        <div><div style={{color:"#fff",fontSize:11,fontWeight:600}}>{currentUser?.name}</div>
          <div style={{color:"rgba(255,255,255,0.4)",fontSize:9}}>Admin</div></div></div></div>
    <nav style={{flex:1,padding:"8px 10px",overflowY:"auto"}}>{items.map(({id,l,i:I})=>(<button key={id} onClick={()=>onNav(id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderRadius:10,border:"none",cursor:"pointer",marginBottom:2,
      background:active===id?"rgba(255,255,255,0.1)":"transparent",color:active===id?"#fff":"rgba(255,255,255,0.55)",fontSize:12,fontWeight:active===id?600:400,textAlign:"left",
      transition:"all 0.15s",fontFamily:"inherit",boxShadow:active===id?"0 2px 8px rgba(0,0,0,0.2)":"none"}}
      onMouseEnter={e=>{if(active!==id)e.currentTarget.style.background="rgba(255,255,255,0.05)";}}
      onMouseLeave={e=>{if(active!==id)e.currentTarget.style.background="transparent";}}>
      <I size={15}/>{l}</button>))}</nav>
    <div style={{padding:"10px 10px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <button onClick={logout} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderRadius:10,border:"none",cursor:"pointer",
        background:"rgba(209,69,59,0.08)",color:"#E57373",fontSize:12,textAlign:"left",fontFamily:"inherit",transition:"all 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background="rgba(209,69,59,0.15)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(209,69,59,0.08)"}>
        <LogOut size={14}/> Déconnexion</button></div></div>);
}

function DashOverview(){
  const{gt,tickets,closures,stockAlerts,bestSellers,perm:p}=useApp();
  const margin=tickets.reduce((s,t)=>s+(parseFloat(t.margin)||0),0);
  const todayStr=new Date().toISOString().split("T")[0];
  const todayTk=tickets.filter(t=>(t.date||t.createdAt||t.created_at||"").startsWith(todayStr));
  const todayCA=todayTk.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0);
  const todayAvg=todayTk.length?todayCA/todayTk.length:0;
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:16}}>Dashboard</h2>

    {/* Today's summary */}
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"14px 18px",
      background:`linear-gradient(135deg,${C.primaryLight},#D4F0DE)`,borderRadius:16,border:`1px solid ${C.primary}15`,
      boxShadow:`0 2px 12px ${C.primary}08`}}>
      <div style={{width:40,height:40,borderRadius:12,background:`${C.primary}18`,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Activity size={20} color={C.primary}/></div>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:C.primaryDark}}>Aujourd'hui</div>
        <div style={{fontSize:10,color:C.primary}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div></div>
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:16}}>
        <div style={{textAlign:"center"}}><div style={{fontSize:10,color:C.primary,fontWeight:600}}>Ventes</div>
          <div style={{fontSize:20,fontWeight:900,color:C.primaryDark}}>{todayTk.length}</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:10,color:C.primary,fontWeight:600}}>CA</div>
          <div style={{fontSize:20,fontWeight:900,color:C.primaryDark}}>{todayCA.toFixed(0)}€</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:10,color:C.primary,fontWeight:600}}>Panier moy.</div>
          <div style={{fontSize:20,fontWeight:900,color:C.primaryDark}}>{todayAvg.toFixed(1)}€</div></div></div></div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      <SC icon={DollarSign} label="CA (GT)" value={`${(parseFloat(gt)||0).toFixed(0)}€`} color={C.primary}/>
      {p().canViewMargin&&<SC icon={TrendingUp} label="Marge" value={`${margin.toFixed(0)}€`} color="#3B8C5A"/>}
      <SC icon={Receipt} label="Tickets" value={tickets.length} color={C.info}/>
      <SC icon={AlertTriangle} label="Alertes stock" value={stockAlerts.length} color={C.warn}/></div>
    {stockAlerts.length>0&&<div style={{background:C.warnLight,borderRadius:10,padding:12,marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:C.warn,marginBottom:6}}><Bell size={14} style={{verticalAlign:"middle"}}/> Alertes de stock</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{stockAlerts.slice(0,8).map((a,i)=>(<Badge key={i} color={a.level==="rupture"?C.danger:C.warn}>{a.product.name} {a.variant.color}/{a.variant.size}: {a.variant.stock}</Badge>))}</div></div>}
    {bestSellers.length>0&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Top 5 produits</div>
      {bestSellers.slice(0,5).map((b,i)=>(<div key={b.sku} style={{display:"flex",alignItems:"center",gap:8,padding:6,borderBottom:`1px solid ${C.border}`}}>
        <span style={{fontSize:14,fontWeight:800,color:i<3?C.primary:C.textMuted,width:20}}>{i+1}</span>
        <span style={{flex:1,fontSize:12,fontWeight:600}}>{b.name}</span>
        <span style={{fontSize:12,fontWeight:700,color:C.primary}}>{b.qty} vendus — {b.revenue.toFixed(0)}€</span></div>))}</div>}
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
          <Btn onClick={addRate} disabled={!newLabel||!newRate} style={{height:42,background:`linear-gradient(135deg,${C.primary},${C.gradientB})`}}><Plus size={14}/> Ajouter</Btn>
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
  const[sc,setSc]=useState("overview");
  const S={overview:DashOverview,products:ProductsScreen,stock:StockScreen,stats:StatsScreen,returns:ReturnsHistoryScreen,customers:CustomersScreen,
    users:UsersScreen,tva:TVAScreen,giftcards:GiftCardScreen,promos:PromosScreen,footfall:FootfallScreen,settings:SettingsScreen,fiscal:FiscalScreen,audit:AuditScreen};
  const Sc=S[sc]||DashOverview;
  return(<div style={{display:"flex",height:"100vh",fontFamily:"'DM Sans',system-ui,sans-serif"}}><DashboardNav active={sc} onNav={setSc}/><div style={{flex:1,overflow:"hidden"}}><Sc/></div></div>);
}

function AppContent(){const{currentUser,mode}=useApp();if(!currentUser)return<LoginScreen/>;return mode==="cashier"?<CashierInterface/>:<DashboardInterface/>;}

export default function App(){
  return(<AppProvider><AppContent/><ToastContainer/>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}
      html,body,#root{height:100%;min-height:100vh;background:${C.bg}}
      body{font-family:'DM Sans',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
      ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.borderDark};border-radius:3px}::-webkit-scrollbar-thumb:hover{background:${C.textLight}}
      @keyframes slideIn{from{transform:translateX(80px);opacity:0}to{transform:translateX(0);opacity:1}}
      @keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}
      @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes modalPop{from{opacity:0;transform:scale(0.92) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @keyframes successPulse{0%{transform:scale(0.8);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
      @keyframes checkDraw{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}
      .spin-loader{display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite}
      button:active{transform:scale(0.96)!important}button{transition:all 0.15s ease}
      input:focus,select:focus,textarea:focus{outline:none;border-color:${C.primary}!important;box-shadow:0 0 0 3px ${C.primary}12!important}
      ::selection{background:${C.primary}20;color:${C.primaryDark}}
      select{cursor:pointer}
      @media print{body *{visibility:hidden!important}[data-print-receipt],[data-print-receipt] *{visibility:visible!important}
        [data-print-receipt]{position:absolute!important;left:0!important;top:0!important;width:72mm!important;padding:4mm!important;background:#fff!important;border:none!important;box-shadow:none!important;border-radius:0!important}
        @page{size:72mm auto;margin:2mm}}
      @media (max-width:1024px){.hide-md{display:none!important}}`}</style>
  </AppProvider>);
}
