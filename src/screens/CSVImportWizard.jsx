import React, { useState, useRef } from "react";
import { Plus, XCircle, RotateCcw, Shield, FileText, CheckCircle2, AlertTriangle, Save, Upload, Grid, Box, Check } from "lucide-react";
import Papa from "papaparse";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { norm, setProductVariantOrder } from "../utils.jsx";
import { Modal, Btn, Badge } from "../ui.jsx";

const CSV_TARGET_FIELDS=[
  {key:"name",label:"Nom produit",required:true},{key:"sku",label:"Référence / SKU",required:true},
  {key:"price",label:"Prix vente",required:true},{key:"costPrice",label:"Prix achat",required:false},
  {key:"taxRate",label:"TVA",required:false},{key:"category",label:"Catégorie",required:false},
  {key:"collection",label:"Collection",required:false},{key:"color",label:"Couleur",required:false},
  {key:"colorCode",label:"Code couleur",required:false},
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
  color:["color","couleur","colour","coloris","libelle_couleur","libelle couleur"],
  colorCode:["colorcode","color_code","code_couleur","codecouleur","color code","code couleur","ref_couleur","refcouleur"],
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
  const[stockMode,setStockMode]=useState("replace");// "replace" = stock CSV remplace, "add" = stock CSV s'ajoute
  const[processed,setProcessed]=useState(null);
  const[importResult,setImportResult]=useState(null);
  const[importing,setImporting]=useState(false);
  const[fileName,setFileName]=useState("");
  const[mappingRestored,setMappingRestored]=useState(false);
  const fileRef=useRef();

  const reset=()=>{setStep(0);setRawData([]);setCsvHeaders([]);setMapping({});setParentRefField("sku");
    setUniqueKeyField("ean");setDuplicateAction("update");setStockMode("replace");setProcessed(null);setImportResult(null);setImporting(false);setFileName("");};
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
            if(prev.stockMode)setStockMode(prev.stockMode);
          }}}catch(e){}
      if(restoredMapping){setMapping(restoredMapping);setMappingRestored(true);}
      else{setMappingRestored(false);const auto=csvAutoDetect(r.meta.fields||[]);setMapping(auto);
        if(auto.sku)setParentRefField("sku");else if(auto.name)setParentRefField("name");}
      setStep(1);}});};

  // Step 2→3: Process data — also save column mapping for future imports
  const processData=()=>{
    // Save mapping to localStorage for next import
    const csvConfig={mapping,parentRefField,uniqueKeyField,duplicateAction,stockMode,savedAt:new Date().toISOString()};
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
          color:gv("color")||"Défaut",colorCode:gv("colorCode")||"",size:gv("size")||"TU",ean:gv("ean")||"",
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
            if(match){
              const existingStock=match.stock||0;
              const csvStock=v.stock||0;
              // stockMode: "replace" → stock CSV écrase, "add" → stock CSV s'ajoute
              const newStock=stockMode==="add"?existingStock+csvStock:csvStock;
              const diff=newStock-existingStock;
              updatedVariants.push({...v,existingId:match.id,existingEan:match.ean,
                existingStock,csvStock,newStock,diff,stockMode});
            } else newVariants.push(v);
          });
          updates.push({existing:existingMatch,incoming:product,newVariants,updatedVariants,mode:"update",stockMode,
            fieldsChanged:{name:product.name,price:product.price,costPrice:product.costPrice,
              taxRate:product.taxRate,category:product.category,collection:product.collection}});
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
        category:p.category,collection:p.collection,variants:p.variants.map((v,i)=>({color:v.color,colorCode:v.colorCode||"",size:v.size,ean:v.ean,stock:v.stock,defective:0,stockAlert:v.stockAlert,sort_order:i}))});
        results.created++;}catch(e){results.errors.push({name:p.name,error:e.message});}
    }
    // Update existing products — 3 steps: product fields, variant stock, new variants
    for(const u of processed.updates){
      let anySuccess=false;

      // Step 1: Update product core fields (price, name, category, etc.)
      try{
        const fc=u.fieldsChanged;
        await API.products.update(u.existing.id,{
          name:fc.name||u.existing.name,price:fc.price||u.existing.price,
          costPrice:fc.costPrice||u.existing.costPrice,taxRate:fc.taxRate??u.existing.taxRate,
          category:fc.category||u.existing.category,collection:fc.collection||u.existing.collection
        });
        anySuccess=true;
      }catch(e){console.warn(`CSV update: product fields failed for ${u.existing.name}:`,e.message);}

      // Step 2: Update stock for existing variants via stock.adjust
      for(const uv of u.updatedVariants){
        try{
          if(uv.diff!==0){
            await API.stock.adjust({productId:u.existing.id,variantId:uv.existingId,quantity:uv.diff,
              reason:uv.stockMode==="add"?"Import CSV - ajout au stock":"Import CSV - remplacement stock"});
            anySuccess=true;
          }
        }catch(e){console.warn(`CSV update: stock adjust failed for variant ${uv.size}/${uv.color}:`,e.message);}
      }

      // Step 3: Add new variants
      for(const v of u.newVariants){
        try{const sortIdx=u.updatedVariants.length+u.newVariants.indexOf(v);
          await API.products.addVariant(u.existing.id,{color:v.color,colorCode:v.colorCode||"",size:v.size,ean:v.ean,stock:v.stock,defective:0,stockAlert:v.stockAlert,sort_order:sortIdx});
          anySuccess=true;}catch(e){console.warn(`CSV update: addVariant failed for ${v.size}/${v.color}:`,e.message);}
      }

      if(anySuccess)results.updated++;else results.errors.push({name:u.existing.name,error:"Échec de la mise à jour via l'API"});
    }
    // Fallback: if API fails for all, do local import (both new + updates)
    if(results.created===0&&results.updated===0&&(processed.newProducts.length>0||processed.updates.length>0)){
      const localUpdates=processed.updates.map(u=>({...u.existing,...u.fieldsChanged,
        variants:[...u.existing.variants.map(ev=>{const m=u.updatedVariants.find(uv=>uv.existingId===ev.id);return m?{...ev,stock:m.newStock,ean:m.ean||ev.ean}:ev;}),...u.newVariants]}));
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
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          {[{id:"skip",l:"Ignorer",d:"Les doublons ne seront pas importes",i:XCircle,c:C.warn},
            {id:"update",l:"Mettre a jour",d:"Mettre a jour les infos du produit existant",i:Upload,c:C.primary}].map(o=>(
            <button key={o.id} onClick={()=>setDuplicateAction(o.id)} style={{padding:12,borderRadius:12,
              border:`2px solid ${duplicateAction===o.id?o.c:C.border}`,background:duplicateAction===o.id?`${o.c}08`:"transparent",
              cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <o.i size={14} color={duplicateAction===o.id?o.c:C.textMuted}/>
                <span style={{fontSize:12,fontWeight:700,color:duplicateAction===o.id?o.c:C.text}}>{o.l}</span></div>
              <div style={{fontSize:10,color:C.textMuted}}>{o.d}</div></button>))}
        </div>

        {duplicateAction==="update"&&<>
          <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:6}}>GESTION DU STOCK POUR LES DOUBLONS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <button onClick={()=>setStockMode("replace")} style={{padding:12,borderRadius:12,
              border:`2px solid ${stockMode==="replace"?"#D97706":C.border}`,background:stockMode==="replace"?"#FEF3C710":"transparent",
              cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <RotateCcw size={14} color={stockMode==="replace"?"#D97706":C.textMuted}/>
                <span style={{fontSize:12,fontWeight:700,color:stockMode==="replace"?"#D97706":C.text}}>Remplacer le stock</span></div>
              <div style={{fontSize:10,color:C.textMuted}}>Le stock du CSV ecrase le stock actuel</div></button>
            <button onClick={()=>setStockMode("add")} style={{padding:12,borderRadius:12,
              border:`2px solid ${stockMode==="add"?"#059669":C.border}`,background:stockMode==="add"?"#DCFCE710":"transparent",
              cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <Plus size={14} color={stockMode==="add"?"#059669":C.textMuted}/>
                <span style={{fontSize:12,fontWeight:700,color:stockMode==="add"?"#059669":C.text}}>Ajouter au stock</span></div>
              <div style={{fontSize:10,color:C.textMuted}}>La quantite du CSV s'ajoute au stock existant</div></button>
          </div>
        </>}
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
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><Upload size={13} color={C.info}/>
          <span style={{fontSize:11,fontWeight:700,color:C.info}}>Mises a jour ({processed.updates.length})</span>
          <Badge color={processed.updates[0]?.stockMode==="add"?"#059669":"#D97706"}>{processed.updates[0]?.stockMode==="add"?"Stock: ajout":"Stock: remplacement"}</Badge></div>
        {processed.updates.map((u,i)=>(<div key={i} style={{fontSize:10,color:C.text,padding:"3px 0",borderBottom:i<processed.updates.length-1?`1px solid ${C.info}22`:"none"}}>
          <span style={{fontWeight:600}}>"{u.existing.name}"</span> <span style={{color:C.textMuted}}>({u.existing.sku})</span>
          {u.updatedVariants.length>0&&<span style={{marginLeft:6}}> — {u.updatedVariants.map(uv=>{
            const arrow=uv.diff>0?`+${uv.diff}`:uv.diff<0?`${uv.diff}`:"=";
            const col=uv.diff>0?"#059669":uv.diff<0?C.danger:C.textMuted;
            return `${uv.color}/${uv.size}: ${uv.existingStock}→${uv.newStock} (${arrow})`;
          }).join(", ")}</span>}
          {u.newVariants.length>0&&<span style={{color:"#059669",marginLeft:6}}>+{u.newVariants.length} nouvelle(s)</span>}
        </div>))}
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

export default CSVImportWizard;
export { CSVImportWizard };
