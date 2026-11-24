import React, { useState } from "react";
import { ShoppingCart, Trash2, Plus, Package, Pencil } from "lucide-react";
import * as API from "../api.js";
import { categories, C } from "../constants.jsx";
import { Modal, Btn, Input, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";
import { articlesConcernes, categoriesPromo, modeCategories } from "../lib/promos.js";

function PromosScreen(){
  const{promos,setPromos,products,perm:p,addAudit,notify}=useApp();
  const[createModal,setCreateModal]=useState(false);
  // Par défaut : « Remise automatique » + filtre de catégories (21/11/2026) — la remise par
  // catégorie unique se fait désormais avec « Aucune catégorie sauf ».
  const defaultNp={name:"",type:"global_discount",value:"",discountType:"percent",collection:"",minQty:"",code:"",startDate:"",endDate:"",targetType:"all",targetValue:"",description:"",stockThreshold:"5",categoryMode:"all",categories:[]};
  const[np,setNp]=useState(defaultNp);
  const[editId,setEditId]=useState(null);   // promo modifiée (20/11/2026), null = création
  const fermer=()=>{setCreateModal(false);setEditId(null);setNp(defaultNp);};
  const jourDe=(...v)=>{const x=v.find(y=>y);return x?String(x).slice(0,10):"";};
  const modifier=(pm)=>{const t=pm.promo_type||pm.type||"category_discount";const tv=pm.target_value??pm.targetValue??"";const mq=pm.min_qty??pm.minQty;
    setNp({...defaultNp,name:pm.name||"",type:t,value:String(pm.value??""),discountType:pm.discount_type||pm.discountType||"percent",
      collection:pm.collection||"",minQty:mq!=null?String(mq):"",code:pm.code||"",
      startDate:jourDe(pm.start_day,pm.startDate,pm.start_date),endDate:jourDe(pm.end_day,pm.endDate,pm.end_date),
      targetType:pm.target_type||pm.targetType||"",targetValue:t==="low_stock_discount"?"":(tv||(t==="collection_discount"?pm.collection||"":"")),
      description:pm.description||"",stockThreshold:t==="low_stock_discount"?String(tv||"5"):"5",
      categoryMode:modeCategories(pm),categories:categoriesPromo(pm)});
    // Ancienne « Remise par catégorie » : reprise en remise automatique limitée à cette catégorie
    if(t==="category_discount"&&tv&&modeCategories(pm)==="all")setNp(n=>({...n,type:"global_discount",targetType:"all",targetValue:"",categoryMode:"only",categories:[tv]}));
    setEditId(pm.id);setCreateModal(true);};

  if(!p().canManagePromos)return<div style={{padding:40,textAlign:"center",color:C.textMuted}}>Accès réservé aux administrateurs</div>;

  const togglePromo=async(id)=>{
    try{const res=await API.settings.togglePromo(id);setPromos(p=>p.map(x=>x.id===id?{...x,active:res.active}:x));}
    catch(e){notify("Changement non enregistré : "+e.message,"error");}};
  // Suppression REELLE cote serveur : avant, la promo disparaissait de l'ecran mais restait
  // active en base et continuait de s'appliquer en caisse.
  const deletePromo=async(id)=>{
    try{await API.settings.deletePromo(id);setPromos(p=>p.filter(x=>x.id!==id));
      addAudit("PROMO","Suppression promo");notify("Promotion supprimée","success");}
    catch(e){notify("Suppression impossible : "+e.message,"error");}};

  // Extract unique categories, colors, SKUs from products
  const categories=[...new Set(products.map(p=>p.category).filter(Boolean))].sort();
  const colors=[...new Set(products.flatMap(p=>(p.variants||[]).map(v=>v.color)).filter(Boolean))].sort();
  // Toutes les références (avant : 200 premières seulement -> produit introuvable sur un gros catalogue)
  const skuList=products.map(p=>({sku:p.sku,name:p.name})).filter(p=>p.sku);

  const TYPES=[
    {id:"global_discount",label:"Remise automatique",targetType:"all",icon:"Tag",desc:"Remise sur tous les articles, à limiter par catégories ci-dessous"},
    {id:"sku_discount",label:"Remise par référence",targetType:"sku",icon:"Package",desc:"Applique une remise sur un produit spécifique (SKU)"},
    {id:"color_discount",label:"Remise par couleur",targetType:"color",icon:"Palette",desc:"Applique une remise sur tous les produits d'une couleur"},
    {id:"collection_discount",label:"Remise sur collection",targetType:"collection",icon:"Layers",desc:"Applique une remise sur une collection entière"},
    {id:"low_stock_discount",label:"Remise fin de stock",targetType:"low_stock",icon:"TrendingDown",desc:"Remise auto sur les produits sous un seuil de stock"},
    {id:"qty_discount",label:"Remise sur quantité",targetType:"all",icon:"ShoppingCart",desc:"Remise quand le panier dépasse X articles"},
    {id:"code",label:"Code promo",targetType:"all",icon:"Ticket",desc:"Remise déclenchée par un code client"},
  ];

  const getTypeLabel=(t)=>t==="category_discount"?"Remise par catégorie":TYPES.find(x=>x.id===t)?.label||t;
  const libelleFiltre=(pm)=>{const m=modeCategories(pm);const l=categoriesPromo(pm).join(", ");
    return m==="except"?`Toutes catégories sauf : ${l}`:m==="only"?`Seulement : ${l}`:"";};
  // Promo enregistrable ? (mêmes règles que le serveur) — une promo sans cible s'affichait
  // « active » en caisse sans jamais rien remettre.
  const erreurPromo=(n)=>{
    if(!n.name.trim())return"Donnez un nom à la promotion";
    const v=parseFloat(n.value);if(!(v>0))return"Indiquez la valeur de la remise";
    if(n.discountType==="percent"&&v>100)return"Une remise en % ne peut pas dépasser 100";
    if(["sku_discount","color_discount","collection_discount"].includes(n.type)&&!String(n.targetValue||"").trim())return"Choisissez la cible de la promotion";
    if(n.type==="code"&&!n.code.trim())return"Indiquez le code promo";
    if(n.categoryMode!=="all"&&!n.categories.length)return"Cochez au moins une catégorie (ou choisissez « Toutes les catégories »)";
    return null;};
  const apercu=(n)=>({promo_type:n.type,target_value:n.type==="low_stock_discount"?"":n.targetValue,collection:n.type==="collection_discount"?n.targetValue:"",category_mode:n.categoryMode,categories:n.categories});
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
    if(pm.type==="global_discount"||pm.promo_type==="global_discount")return"Tous les articles";
    return"";};

  const createPromo=async()=>{
    const err=erreurPromo(np);if(err){notify(err,"error");return;}
    const data={name:np.name,promoType:np.type,value:parseFloat(np.value),discountType:np.discountType,
      collection:np.type==="collection_discount"?np.targetValue:np.collection,
      // « À partir de N articles » : aussi pour les promos ciblées (catégorie, SKU, couleur, collection)
      minQty:np.type==="qty_discount"?parseInt(np.minQty)||3:(parseInt(np.minQty)||null),
      code:np.type==="code"?np.code:null,
      active:true,startDate:np.startDate||null,endDate:np.endDate||null,
      targetType:TYPES.find(t=>t.id===np.type)?.targetType||"all",
      targetValue:np.type==="low_stock_discount"?np.stockThreshold:np.targetValue,
      description:np.description,categoryMode:np.categoryMode,categories:np.categoryMode==="all"?[]:np.categories};
    try{
      if(editId){const{active,...sansActif}=data;
        const res=await API.settings.updatePromo(editId,sansActif);
        setPromos(p=>p.map(x=>x.id===editId?res:x));notify(`Promo "${np.name}" modifiée`,"success");}
      else{const res=await API.settings.createPromo(data);
        setPromos(p=>[res,...p]);
        addAudit("PROMO",`Nouvelle promo: ${np.name}`);notify(`Promo "${np.name}" créée`,"success");}
      fermer();
    }catch(e){notify(e.message,"error");}};

  const selectStyle={width:"100%",padding:10,borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:12,fontFamily:"inherit",background:C.surface};

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div><h2 style={{fontSize:22,fontWeight:800,margin:0}}>Promotions</h2>
        <p style={{fontSize:12,color:C.textMuted,marginTop:2}}>{promos.filter(p=>p.active).length} active{promos.filter(p=>p.active).length>1?"s":""} sur {promos.length}</p></div>
      <Btn onClick={()=>{setEditId(null);setNp(defaultNp);setCreateModal(true);}} style={{fontSize:11,background:C.warn}}><Plus size={12}/> Nouvelle promo</Btn></div>

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
              {getTargetLabel(pm)}{libelleFiltre(pm)&&` — ${libelleFiltre(pm)}`}
              {(pm.start_date||pm.startDate)&&` — Du ${pm.start_date||pm.startDate}`}
              {(pm.end_date||pm.endDate)&&` au ${pm.end_date||pm.endDate}`}
              {pm.description&&` — ${pm.description}`}
            </div>
            {pm.active&&products.length>0&&!["qty_discount","code","low_stock_discount"].includes(t)&&articlesConcernes(pm,products)===0&&
              <div data-testid={`promo-sans-effet-${pm.id}`} style={{fontSize:11,fontWeight:700,color:C.danger,marginTop:3}}>⚠ Aucun article du catalogue n'est concerné : cette promo ne fera aucune remise. Cliquez sur le crayon pour la corriger.</div>}</div>
          <Btn variant={pm.active?"success":"outline"} onClick={()=>togglePromo(pm.id)} style={{fontSize:10,padding:"4px 12px"}}>
            {pm.active?"Active":"Inactive"}</Btn>
          <button onClick={()=>modifier(pm)} title="Modifier" data-testid={`modifier-promo-${pm.id}`} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted}}><Pencil size={14}/></button>
          <button onClick={()=>deletePromo(pm.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.danger}}><Trash2 size={14}/></button>
        </div>);})}
      {promos.length===0&&<div style={{textAlign:"center",padding:30,color:C.textLight}}>Aucune promotion configurée</div>}
    </div>

    <Modal open={createModal} onClose={fermer} title={editId?"Modifier la promotion":"Nouvelle règle de promotion"} wide>
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
          {/* Saisie avec suggestions (référence ou nom) : la liste déroulante était limitée à 200 produits */}
          <Input list="promo-skus" value={np.targetValue} onChange={e=>setNp(p=>({...p,targetValue:e.target.value.split(" — ")[0]}))} placeholder="Tapez une référence ou un nom…"/>
          <datalist id="promo-skus">{skuList.map(s=>(<option key={s.sku} value={s.sku}>{s.sku} — {s.name}</option>))}</datalist>
          {np.targetValue&&!skuList.some(s=>s.sku.toLowerCase()===np.targetValue.trim().toLowerCase())&&
            <div style={{fontSize:10,color:C.danger,marginTop:3}}>Référence inconnue : la promo ne s'appliquera à aucun article</div>}</div>}

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

        {/* Filtre de catégories (21/11/2026) : toutes / toutes sauf / aucune sauf */}
        <div style={{gridColumn:"span 2",background:C.surfaceAlt,borderRadius:10,padding:12,border:`1px solid ${C.border}`}}>
          <label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>CATÉGORIES CONCERNÉES</label>
          <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
            {[["all","Toutes les catégories"],["except","Toutes les catégories sauf…"],["only","Aucune catégorie sauf…"]].map(([m,l])=>(
              <button key={m} data-testid={`filtre-${m}`} onClick={()=>setNp(p=>({...p,categoryMode:m}))}
                style={{padding:"8px 12px",borderRadius:8,border:`1.5px solid ${np.categoryMode===m?C.warn:C.border}`,background:np.categoryMode===m?C.warn+"14":C.surface,
                  cursor:"pointer",fontSize:12,fontWeight:600,color:np.categoryMode===m?C.warn:C.text,fontFamily:"inherit"}}>{l}</button>))}</div>
          {np.categoryMode!=="all"&&<><div style={{fontSize:11,color:C.textMuted,margin:"8px 0 4px"}}>
              {np.categoryMode==="except"?"Cochez les catégories EXCLUES de la promo :":"Cochez les SEULES catégories concernées :"}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {categories.map(c=>{const on=np.categories.includes(c);return(
                <button key={c} data-testid={`cat-${c}`} onClick={()=>setNp(p=>({...p,categories:on?p.categories.filter(x=>x!==c):[...p.categories,c]}))}
                  style={{padding:"6px 10px",borderRadius:16,border:`1.5px solid ${on?(np.categoryMode==="except"?C.danger:"#059669"):C.border}`,
                    background:on?(np.categoryMode==="except"?C.dangerLight:"#05966914"):C.surface,cursor:"pointer",fontSize:12,fontWeight:on?700:500,fontFamily:"inherit",
                    color:on?(np.categoryMode==="except"?C.danger:"#059669"):C.text,textDecoration:on&&np.categoryMode==="except"?"line-through":"none"}}>{c}</button>);})}
              {!categories.length&&<span style={{fontSize:11,color:C.textLight}}>Aucune catégorie dans le catalogue</span>}</div></>}
          {products.length>0&&!["qty_discount","code","low_stock_discount"].includes(np.type)&&(()=>{const n=articlesConcernes(apercu(np),products);
            return<div data-testid="promo-apercu" style={{fontSize:12,fontWeight:700,marginTop:8,color:n?"#059669":C.danger}}>
              {n?`✓ ${n} article${n>1?"s":""} du catalogue concerné${n>1?"s":""}`:"⚠ Aucun article concerné : la promo ne fera aucune remise"}</div>;})()}
          <div data-testid="promo-sans-retouches" style={{fontSize:10,color:C.textMuted,marginTop:6}}>Les retouches ne sont jamais remisées par une promo.</div>
        </div>

        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>DATE DÉBUT (optionnel)</label>
          <Input type="date" value={np.startDate} onChange={e=>setNp(p=>({...p,startDate:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>DATE FIN (optionnel)</label>
          <Input type="date" value={np.endDate} onChange={e=>setNp(p=>({...p,endDate:e.target.value}))}/></div>
        <div style={{gridColumn:"span 2"}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>DESCRIPTION (optionnel)</label>
          <Input value={np.description} onChange={e=>setNp(p=>({...p,description:e.target.value}))} placeholder="Remarque interne..."/></div>
      </div>
      <Btn onClick={createPromo} data-testid="enregistrer-promo" disabled={!np.name||!np.value}
        style={{width:"100%",height:44,background:C.warn}}>{editId?"Enregistrer les modifications":"Créer la promotion"}</Btn></Modal>
  </div>);
}

/* ══════════ FOOTFALL COUNTER ══════════ */

export default PromosScreen;
export { PromosScreen };
