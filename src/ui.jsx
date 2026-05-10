import React, { Component } from "react";
import { X, CheckCircle2, AlertTriangle, Activity } from "lucide-react";
import { C } from "./constants.jsx";
import { useApp } from "./context.jsx";

export const Modal=({open,onClose,title,sub,children,wide})=>{if(!open)return null;return(
  <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.2s ease"}} onClick={onClose}>
    <div style={{position:"absolute",inset:0,background:"rgba(15,23,42,0.5)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}/>
    <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:C.surface,borderRadius:20,padding:0,
      width:wide?"820px":"480px",maxWidth:"94vw",maxHeight:"90vh",overflowY:"auto",
      boxShadow:"0 24px 80px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.8)",animation:"modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1)"}}>
      {title&&<div style={{padding:"24px 28px 0 28px",display:"flex",alignItems:"start",justifyContent:"space-between"}}>
        <div><h2 style={{fontSize:18,fontWeight:700,marginBottom:sub?4:0,letterSpacing:"-0.4px",color:C.text}}>{title}</h2>
          {sub&&<p style={{fontSize:12,color:C.textMuted,marginTop:2,lineHeight:1.4}}>{sub}</p>}</div>
        <button onClick={onClose} style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:12,transition:"all 0.15s"}}
          onMouseEnter={e=>{e.currentTarget.style.background=C.dangerLight;e.currentTarget.style.borderColor=C.danger+"33";}} onMouseLeave={e=>{e.currentTarget.style.background=C.surfaceAlt;e.currentTarget.style.borderColor=C.border;}}>
          <X size={14} color={C.textMuted}/></button></div>}
      <div style={{padding:title?"20px 28px 28px":"28px"}}>{children}</div></div></div>);};

export const Btn=({children,onClick,variant="primary",disabled,style:s,...r})=>{
  const b={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,border:"none",borderRadius:10,
    cursor:disabled?"not-allowed":"pointer",fontWeight:600,fontSize:13,padding:"10px 18px",opacity:disabled?0.5:1,fontFamily:"inherit",
    transition:"all 0.2s cubic-bezier(0.16,1,0.3,1)",letterSpacing:"-0.01em"};
  const V={primary:{...b,background:C.primary,color:"#fff",boxShadow:`0 1px 3px ${C.primary}40, 0 4px 12px ${C.primary}15`},
    accent:{...b,background:C.accent,color:"#fff",boxShadow:`0 1px 3px ${C.accent}40, 0 4px 12px ${C.accent}15`},
    danger:{...b,background:C.danger,color:"#fff",boxShadow:`0 1px 3px ${C.danger}40`},
    outline:{...b,background:C.surface,color:C.text,border:`1.5px solid ${C.border}`,boxShadow:`0 1px 2px ${C.shadow}`},
    ghost:{...b,background:"transparent",color:C.textMuted,padding:"6px 10px",boxShadow:"none"},
    success:{...b,background:"#059669",color:"#fff",boxShadow:"0 1px 3px rgba(5,150,105,0.4)"},
    info:{...b,background:C.info,color:"#fff",boxShadow:`0 1px 3px ${C.info}40`},
    fiscal:{...b,background:C.fiscal,color:"#fff",boxShadow:`0 1px 3px ${C.fiscal}40`},
    warn:{...b,background:C.warn,color:"#fff",boxShadow:`0 1px 3px ${C.warn}40`}};
  return<button onClick={disabled?undefined:onClick} style={{...V[variant],...s}} {...r}>{children}</button>;};

export const Input=({style:s,...p})=>(<input {...p} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${C.border}`,
  fontSize:13,background:C.surface,outline:"none",boxSizing:"border-box",fontFamily:"inherit",transition:"all 0.2s cubic-bezier(0.16,1,0.3,1)",color:C.text,...s}}
  onFocus={e=>{e.target.style.borderColor=C.primary;e.target.style.boxShadow=`0 0 0 3px ${C.primary}12`;}}
  onBlur={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow="none";}}/>);

export const Badge=({children,color=C.primary,bg})=>(<span style={{display:"inline-flex",alignItems:"center",padding:"3px 8px",
  borderRadius:6,fontSize:10,fontWeight:600,color,background:bg||`${color}12`,letterSpacing:"-0.01em"}}>{children}</span>);

export const SC=({icon:I,label,value,color:c,sub})=>(<div style={{background:C.surface,borderRadius:14,padding:18,
  boxShadow:`0 1px 3px ${C.shadow}, 0 0 0 1px ${C.border}`,transition:"all 0.2s cubic-bezier(0.16,1,0.3,1)"}}
  onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 8px 24px ${C.shadowMd}, 0 0 0 1px ${C.border}`;e.currentTarget.style.transform="translateY(-2px)";}}
  onMouseLeave={e=>{e.currentTarget.style.boxShadow=`0 1px 3px ${C.shadow}, 0 0 0 1px ${C.border}`;e.currentTarget.style.transform="translateY(0)";}}>
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
    <div style={{width:32,height:32,borderRadius:10,background:`${c}10`,display:"flex",alignItems:"center",justifyContent:"center"}}><I size={16} color={c}/></div>
    <span style={{fontSize:11,fontWeight:500,color:C.textMuted,letterSpacing:"-0.01em"}}>{label}</span></div>
  <div style={{fontSize:24,fontWeight:700,letterSpacing:"-0.5px",color:C.text}}>{value}</div>
  {sub&&<div style={{fontSize:11,color:C.textMuted,marginTop:4}}>{sub}</div>}</div>);

export const Numpad=({value,onChange,onEnter,label})=>{
  const press=(k)=>{if(k==="C")onChange("");else if(k==="⌫")onChange(value.slice(0,-1));
    else if(k==="."&&value.includes("."))return;else onChange(value+k);};
  return(<div style={{background:C.surfaceAlt,borderRadius:14,padding:14,border:`1px solid ${C.border}`}}>
    {label&&<div style={{fontSize:11,fontWeight:500,color:C.textMuted,marginBottom:8,letterSpacing:"-0.01em"}}>{label}</div>}
    <div style={{background:C.surface,borderRadius:10,padding:"10px 14px",marginBottom:10,textAlign:"right",fontSize:24,fontWeight:700,
      minHeight:40,display:"flex",alignItems:"center",justifyContent:"flex-end",border:`1.5px solid ${C.border}`,letterSpacing:"-0.5px",color:C.text}}>{value||"0"}<span style={{fontSize:14,color:C.textLight,marginLeft:3,fontWeight:500}}>€</span></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>
      {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map(k=>(
        <button key={k} onClick={()=>press(k)} style={{height:42,borderRadius:10,border:`1px solid ${k==="⌫"?C.danger+"22":C.border}`,background:k==="⌫"?C.dangerLight:C.surface,
          cursor:"pointer",fontSize:k==="⌫"?13:16,fontWeight:600,fontFamily:"inherit",color:k==="⌫"?C.danger:C.text,
          transition:"all 0.15s cubic-bezier(0.16,1,0.3,1)"}}
          onMouseDown={e=>e.currentTarget.style.transform="scale(0.94)"} onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}>{k}</button>))}
    </div>
    <div style={{display:"grid",gridTemplateColumns:onEnter?"1fr 1fr":"1fr",gap:5,marginTop:5}}>
      <button onClick={()=>press("C")} style={{height:38,borderRadius:10,border:`1px solid ${C.warn}22`,background:C.warnLight,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit",color:C.warn}}>Effacer</button>
      {onEnter&&<button onClick={onEnter} style={{height:38,borderRadius:10,border:"none",background:C.primary,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit",color:"#fff"}}>Valider</button>}
    </div></div>);};

export class ErrorBoundary extends Component{
  constructor(p){super(p);this.state={hasError:false,error:null,info:null};}
  static getDerivedStateFromError(e){return{hasError:true,error:e};}
  componentDidCatch(e,info){console.error("BOUNDARY_CATCH:",e.message,e.stack);this.setState({info});}
  render(){if(this.state.hasError)return(<div style={{padding:40,background:"#FFF0F0",margin:20,borderRadius:16,border:"2px solid #DC2626"}}>
    <h2 style={{color:"#DC2626",margin:"0 0 10px"}}>Erreur détectée</h2>
    <pre style={{fontSize:12,whiteSpace:"pre-wrap",color:"#333",background:"#fff",padding:12,borderRadius:8,maxHeight:200,overflowY:"auto"}}>{this.state.error?.message}</pre>
    <div style={{display:"flex",gap:10,marginTop:14}}>
      <button onClick={()=>this.setState({hasError:false,error:null})} style={{padding:"10px 20px",background:"#047857",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"inherit"}}>
        ← Retour</button>
      <button onClick={()=>{this.setState({hasError:false,error:null});window.location.reload();}} style={{padding:"10px 20px",background:"#DC2626",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"inherit"}}>
        Recharger la page</button></div>
  </div>);return this.props.children;}
}

export const ToastContainer=()=>{const{notifications}=useApp();
  if(!notifications?.length)return null;
  const icons={success:CheckCircle2,error:AlertTriangle,warn:AlertTriangle,info:Activity};
  const colors={success:{bg:"#ECFDF5",border:"#059669",text:"#065F46",icon:"#059669"},
    error:{bg:"#FEF2F2",border:"#DC2626",text:"#991B1B",icon:"#DC2626"},
    warn:{bg:"#FFFBEB",border:"#D97706",text:"#92400E",icon:"#D97706"},
    info:{bg:"#F0F9FF",border:"#0369A1",text:"#0C4A6E",icon:"#0369A1"}};
  return(<div style={{position:"fixed",top:16,right:16,zIndex:99999,display:"flex",flexDirection:"column",gap:8}}>
    {notifications.map(n=>{const Ic=icons[n.type]||Activity;const cl=colors[n.type]||colors.info;return(
      <div key={n.id} style={{padding:"12px 16px",borderRadius:12,fontSize:13,fontWeight:500,
        boxShadow:"0 8px 32px rgba(15,23,42,0.12), 0 0 0 1px "+cl.border+"22",animation:"slideIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        background:cl.bg,color:cl.text,display:"flex",alignItems:"center",gap:10,borderLeft:`3px solid ${cl.border}`,
        maxWidth:380}}>
        <Ic size={15} color={cl.icon} style={{flexShrink:0}}/>
        <span style={{lineHeight:1.4}}>{n.msg}</span></div>);})}</div>);};

export const ConfirmDialog=({open,onClose,onConfirm,title,message})=>{if(!open)return null;return(
  <div style={{position:"fixed",inset:0,zIndex:99998,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
    <div style={{position:"absolute",inset:0,background:"rgba(15,23,42,0.5)",backdropFilter:"blur(8px)"}}/>
    <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:C.surface,borderRadius:16,padding:28,width:380,boxShadow:"0 24px 80px rgba(15,23,42,0.16), 0 0 0 1px rgba(15,23,42,0.05)"}}>
      <div style={{width:40,height:40,borderRadius:12,background:C.dangerLight,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>
        <AlertTriangle size={20} color={C.danger}/></div>
      <h3 style={{fontSize:16,fontWeight:700,margin:"0 0 6px",color:C.text}}>{title}</h3>
      <p style={{fontSize:13,color:C.textMuted,marginBottom:20,lineHeight:1.5}}>{message}</p>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        <Btn variant="danger" onClick={()=>{onConfirm();onClose();}}>Confirmer</Btn></div></div></div>);};
