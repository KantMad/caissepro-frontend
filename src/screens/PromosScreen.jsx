import React, { useState } from "react";
import { ShoppingCart, Trash2, Plus, Package } from "lucide-react";
import * as API from "../api.js";
import { categories, C } from "../constants.jsx";
import { Modal, Btn, Input, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";

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

export default PromosScreen;
export { PromosScreen };
