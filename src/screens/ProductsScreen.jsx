import React, { useState, useRef } from "react";
import { Trash2, Plus, Download, Save, Upload, Zap, ScanLine, Edit, X, Camera, Image } from "lucide-react";
import * as API from "../api.js";
import { DEFAULT_TVA_RATES, C } from "../constants.jsx";
import { norm, printBarcodeLabels } from "../utils.jsx";
import { Modal, Btn, Input, Badge, ConfirmDialog } from "../ui.jsx";
import { useApp } from "../context.jsx";
import { sortVariantsBySize } from "./_shared.js";
import CSVImportWizard from "./CSVImportWizard.jsx";

function ProductsScreen(){
  const{products,setProducts,refreshProducts,addProduct,addAudit,notify,perm:p,exportCatalog,duplicateProduct,
    updateProduct,deleteProduct,addVariantToProduct,deleteVariant,reorderVariants,updateProductPrice,settings,tvaRates,allCategories,productPhotos,reloadProductPhotos}=useApp();
  const categories=allCategories;
  const pm=settings.pricingMode||"TTC";
  const[search,setSearch]=useState("");const[importWizardOpen,setImportWizardOpen]=useState(false);
  const[photoModal,setPhotoModal]=useState(false);const[uploading,setUploading]=useState(false);const[uploadResult,setUploadResult]=useState(null);
  const photoFileRef=useRef(null);
  const[createModal,setCreateModal]=useState(false);
  const[editModal,setEditModal]=useState(null);
  const[addVarModal,setAddVarModal]=useState(null);
  const[confirmDel,setConfirmDel]=useState(null);
  const[np,setNp]=useState({name:"",sku:"",price:"",costPrice:"",taxRate:"0.20",category:"T-shirts",collection:"PE-2026"});
  const[nv,setNv]=useState({color:"",colorCode:"",size:"",ean:"",stock:"",stockAlert:"5"});
  const[ep,setEp]=useState({});
  const[newVar,setNewVar]=useState({color:"",colorCode:"",size:"",ean:"",stock:"0",stockAlert:"5"});
  const filtered=products.filter(q=>!search||q.name.toLowerCase().includes(search.toLowerCase())||q.sku.toLowerCase().includes(search.toLowerCase()));

  const openEdit=(prod)=>{setEp({name:prod.name,sku:prod.sku,price:String(prod.price),costPrice:String(prod.costPrice||""),
    taxRate:String(prod.taxRate),category:prod.category,collection:prod.collection||""});setEditModal(prod);};

  return(<div style={{height:"100%",overflowY:"auto",padding:"var(--pad,16px)",background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <h2 style={{fontSize:20,fontWeight:800,margin:0}}>Produits ({products.length})</h2>
      <div style={{display:"flex",gap:6}}>
        <Btn variant="outline" onClick={()=>setImportWizardOpen(true)} style={{fontSize:11}}><Upload size={12}/> CSV</Btn>
        <Btn variant="outline" onClick={()=>setPhotoModal(true)} style={{fontSize:11}}><Image size={12}/> Photos</Btn>
        <Btn variant="outline" onClick={exportCatalog} style={{fontSize:11}}><Download size={12}/> Export</Btn>
        {p().canCreateProduct&&<Btn variant="outline" onClick={async()=>{
          let count=0;for(const prod of products){
            if(prod.variants.length<2)continue;
            const sorted=sortVariantsBySize(prod.variants);
            const ids=sorted.map(v=>v.id);
            const changed=ids.some((id,i)=>id!==prod.variants[i]?.id);
            if(changed){await API.products.reorderVariants(prod.id,ids);count++;}
          }
          if(count>0){await refreshProducts();notify(`${count} produit(s) réordonné(s)`,"success");}
          else notify("Tous les produits sont déjà dans le bon ordre","info");
        }} style={{fontSize:11,color:C.info,borderColor:C.info+"44"}}><Zap size={12}/> Réordonner tailles</Btn>}
        {p().canCreateProduct&&<Btn onClick={()=>setCreateModal(true)} style={{fontSize:11,background:C.primary}}><Plus size={12}/> Nouveau</Btn>}</div></div>
    <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher par nom ou SKU…" style={{marginBottom:12,height:36,maxWidth:300}}/>
    <div style={{background:C.surface,borderRadius:14,border:`1.5px solid ${C.border}`,overflow:"hidden"}}>
      <table className="rtable" style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{background:C.surfaceAlt}}>
          {["Produit","SKU","Collection",`Prix ${pm}`,"Coût","Marge","TVA","Stock","Var.","Actions"].map(h=>(
            <th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:700,color:C.textMuted,fontSize:9,borderBottom:`2px solid ${C.border}`}}>{h}</th>))}</tr></thead>
        <tbody>{filtered.map(q=>{const ts=q.variants.reduce((s,v)=>s+v.stock,0);const mg=q.costPrice?((q.price-q.costPrice)/q.price*100):0;
          return(<tr key={q.id} style={{borderBottom:`1px solid ${C.border}`,cursor:"pointer"}} onClick={()=>openEdit(q)}>
            <td data-label="Produit" style={{padding:"6px 10px",fontWeight:600}}>{q.name}</td>
            <td data-label="SKU" style={{padding:"6px 10px",fontFamily:"monospace",color:C.textMuted}}>{q.sku}</td>
            <td data-label="Collection" style={{padding:"6px 10px"}}><Badge color={C.info}>{q.collection||"—"}</Badge></td>
            <td data-label={`Prix ${pm}`} style={{padding:"6px 10px",fontWeight:700,color:C.primary}}>{q.price.toFixed(2)}€</td>
            <td data-label="Coût" style={{padding:"6px 10px",color:C.textMuted}}>{q.costPrice?.toFixed(2)||"—"}€</td>
            <td data-label="Marge" style={{padding:"6px 10px"}}><Badge color={mg>50?"#059669":mg>30?C.accent:C.danger}>{mg.toFixed(0)}%</Badge></td>
            <td data-label="TVA" style={{padding:"6px 10px"}}>{(q.taxRate*100).toFixed(0)}%</td>
            <td data-label="Stock" style={{padding:"6px 10px",fontWeight:700,color:ts<=5?C.danger:C.text}}>{ts}</td>
            <td data-label="Variantes" style={{padding:"6px 10px"}}>{q.variants.length}</td>
            <td data-label="Actions" style={{padding:"6px 10px"}} onClick={e=>e.stopPropagation()}>
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
              {(tvaRates||DEFAULT_TVA_RATES).map(t=>(<option key={t.id} value={t.rate}>{t.label}</option>))}</select></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>CATÉGORIE</label>
            <select value={ep.category||""} onChange={e=>setEp(p=>({...p,category:e.target.value}))} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
              {categories.filter(c=>c!=="Tous").map(c=>(<option key={c} value={c}>{c}</option>))}</select></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>COLLECTION</label><Input value={ep.collection||""} onChange={e=>setEp(p=>({...p,collection:e.target.value}))}/></div></div>

        {/* Variants list */}
        <div style={{fontSize:12,fontWeight:700,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>Variantes ({editModal.variants.length})</span>
          <Btn variant="outline" onClick={()=>{setAddVarModal(editModal.id);setNewVar({color:"",colorCode:"",size:"",ean:"",stock:"0",stockAlert:"5"});}} style={{fontSize:10,padding:"4px 10px"}}><Plus size={11}/> Variante</Btn></div>
        <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:14}}>
          {editModal.variants.map(v=>(<div key={v.id} style={{display:"flex",alignItems:"center",gap:8,padding:6,borderRadius:8,border:`1px solid ${C.border}`,fontSize:11}}>
            <Badge color={C.primary}>{v.color}</Badge>{v.colorCode&&<span style={{fontSize:8,fontFamily:"monospace",color:C.accent,background:C.accentLight,padding:"1px 4px",borderRadius:4}}>{v.colorCode}</span>}<Badge color={C.info}>{v.size}</Badge>
            <span style={{color:C.textMuted,fontFamily:"monospace",fontSize:9}}>{v.ean||"—"}</span>
            <span style={{marginLeft:"auto",fontWeight:700,color:v.stock<=0?C.danger:v.stock<=(v.stockAlert||5)?C.warn:C.primary}}>Stock: {v.stock}</span>
            <button onClick={()=>{if(deleteVariant(editModal.id,v.id)){
              setEditModal(prev=>prev?{...prev,variants:prev.variants.filter(x=>x.id!==v.id)}:null);}}}
              style={{background:"none",border:"none",cursor:"pointer",color:C.danger,fontSize:9}}>
              <Trash2 size={11}/></button>
          </div>))}</div>

        {/* Bouton réordonner les tailles selon le ranking global */}
        <Btn variant="outline" onClick={async()=>{
          const sorted=sortVariantsBySize(editModal.variants);
          const ids=sorted.map(v=>v.id);
          const ok=await reorderVariants(editModal.id,ids);
          if(ok){setEditModal(prev=>prev?{...prev,variants:sorted.map((v,i)=>({...v,sort_order:i}))}:null);}
        }} style={{width:"100%",height:36,fontSize:11,marginBottom:10,color:C.info,borderColor:C.info+"44"}}>
          <Zap size={13}/> Réordonner les tailles (selon réglages)</Btn>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <Btn variant="success" onClick={()=>{
            const newPrice=parseFloat(ep.price);const oldPrice=editModal.price;
            updateProduct(editModal.id,{name:ep.name,sku:ep.sku,costPrice:parseFloat(ep.costPrice)||0,
              taxRate:parseFloat(ep.taxRate),category:ep.category,collection:ep.collection});
            if(newPrice&&newPrice!==oldPrice)updateProductPrice(editModal.id,newPrice);
            setEditModal(null);}} style={{height:40}}>
            <Save size={14}/> Enregistrer</Btn>
          <Btn variant="outline" onClick={()=>{printBarcodeLabels(editModal,settings);notify("Impression étiquettes lancée","success");}} style={{height:40,color:C.accent,borderColor:C.accent+"44"}}>
            <ScanLine size={14}/> Étiquettes</Btn>
          <Btn variant="danger" onClick={()=>{setEditModal(null);setConfirmDel(editModal);}} style={{height:40}}>
            <Trash2 size={14}/> Supprimer</Btn></div>
      </>}
    </Modal>

    {/* Add variant modal */}
    <Modal open={!!addVarModal} onClose={()=>setAddVarModal(null)} title="Ajouter une variante">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>COULEUR</label><Input value={newVar.color} onChange={e=>setNewVar(v=>({...v,color:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>CODE COULEUR</label><Input value={newVar.colorCode} onChange={e=>setNewVar(v=>({...v,colorCode:e.target.value}))} placeholder="ex: BLK, NVY, 001"/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>TAILLE</label><Input value={newVar.size} onChange={e=>setNewVar(v=>({...v,size:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>EAN</label><Input value={newVar.ean} onChange={e=>setNewVar(v=>({...v,ean:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>STOCK INITIAL</label><Input type="number" value={newVar.stock} onChange={e=>setNewVar(v=>({...v,stock:e.target.value}))}/></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>SEUIL ALERTE</label><Input type="number" value={newVar.stockAlert} onChange={e=>setNewVar(v=>({...v,stockAlert:e.target.value}))}/></div></div>
      <Btn onClick={()=>{if(newVar.color&&newVar.size){
        addVariantToProduct(addVarModal,{color:newVar.color,colorCode:newVar.colorCode||"",size:newVar.size,ean:newVar.ean||"",stock:parseInt(newVar.stock)||0,stockAlert:parseInt(newVar.stockAlert)||5});
        setAddVarModal(null);}}} style={{width:"100%",height:40,background:C.primary}}>Ajouter la variante</Btn></Modal>

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
            {(tvaRates||DEFAULT_TVA_RATES).map(t=>(<option key={t.id} value={t.rate}>{t.label}</option>))}</select></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>CATÉGORIE</label>
          <select value={np.category} onChange={e=>setNp(p=>({...p,category:e.target.value}))} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
            {categories.filter(c=>c!=="Tous").map(c=>(<option key={c} value={c}>{c}</option>))}</select></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted}}>COLLECTION</label><Input value={np.collection} onChange={e=>setNp(p=>({...p,collection:e.target.value}))}/></div></div>
      <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Première variante</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr",gap:6,marginBottom:14}}>
        <div><label style={{fontSize:9,color:C.textMuted}}>COULEUR</label><Input value={nv.color} onChange={e=>setNv(v=>({...v,color:e.target.value}))}/></div>
        <div><label style={{fontSize:9,color:C.textMuted}}>CODE COULEUR</label><Input value={nv.colorCode} onChange={e=>setNv(v=>({...v,colorCode:e.target.value}))} placeholder="BLK"/></div>
        <div><label style={{fontSize:9,color:C.textMuted}}>TAILLE</label><Input value={nv.size} onChange={e=>setNv(v=>({...v,size:e.target.value}))}/></div>
        <div><label style={{fontSize:9,color:C.textMuted}}>EAN</label><Input value={nv.ean} onChange={e=>setNv(v=>({...v,ean:e.target.value}))}/></div>
        <div><label style={{fontSize:9,color:C.textMuted}}>STOCK</label><Input type="number" value={nv.stock} onChange={e=>setNv(v=>({...v,stock:e.target.value}))}/></div>
        <div><label style={{fontSize:9,color:C.textMuted}}>ALERTE</label><Input type="number" value={nv.stockAlert} onChange={e=>setNv(v=>({...v,stockAlert:e.target.value}))}/></div></div>
      <Btn onClick={()=>{if(np.name&&np.sku&&np.price){
        addProduct({name:np.name,sku:np.sku,price:parseFloat(np.price),costPrice:parseFloat(np.costPrice)||0,
          taxRate:parseFloat(np.taxRate),category:np.category,collection:np.collection,
          variants:[{id:`v${Date.now()}`,color:nv.color||"Défaut",colorCode:nv.colorCode||"",size:nv.size||"TU",ean:nv.ean||"",
            stock:parseInt(nv.stock)||0,defective:0,stockAlert:parseInt(nv.stockAlert)||5}]});
        setCreateModal(false);setNp({name:"",sku:"",price:"",costPrice:"",taxRate:"0.20",category:"T-shirts",collection:"PE-2026"});
        setNv({color:"",colorCode:"",size:"",ean:"",stock:"",stockAlert:"5"});}}}
        style={{width:"100%",height:44,background:C.primary}}>Créer le produit</Btn></Modal>

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

    {/* Photos produits */}
    <Modal open={photoModal} onClose={()=>setPhotoModal(false)} title="Photos produits" wide>
      {(()=>{
        const grouped={};
        for(const p of (productPhotos||[])){const k=`${p.skuBase}|${p.colorKey}`;if(!grouped[k])grouped[k]={skuBase:p.skuBase,colorKey:p.colorKey,photos:[]};grouped[k].photos.push(p);}
        for(const k of Object.keys(grouped))grouped[k].photos.sort((a,b)=>a.sortOrder-b.sortOrder);
        const groups=Object.values(grouped).sort((a,b)=>a.skuBase.localeCompare(b.skuBase)||a.colorKey.localeCompare(b.colorKey));
        const totalPhotos=(productPhotos||[]).length;
        const totalProducts=new Set((productPhotos||[]).map(p=>p.skuBase)).size;
        const handleUpload=async()=>{
          const files=photoFileRef.current?.files;if(!files?.length){notify("Selectionnez des fichiers JPEG","warn");return;}
          setUploading(true);setUploadResult(null);
          try{const result=await API.productPhotos.upload(files);setUploadResult(result);
            notify(`${result.imported} photo(s) importee(s)${result.skipped?`, ${result.skipped} ignoree(s)`:""}`,"success");
            await reloadProductPhotos();
          }catch(e){notify("Erreur upload: "+e.message,"error");}
          setUploading(false);if(photoFileRef.current)photoFileRef.current.value="";
        };
        const handleDelete=async(id)=>{try{await API.productPhotos.remove(id);notify("Photo supprimee","success");await reloadProductPhotos();}catch(e){notify("Erreur: "+e.message,"error");}};
        const handleDeleteGroup=async(skuBase,colorKey)=>{try{await API.productPhotos.removeBulk(skuBase,colorKey);notify("Photos supprimees","success");await reloadProductPhotos();}catch(e){notify("Erreur: "+e.message,"error");}};
        return<div>
          <div style={{background:C.surfaceAlt,borderRadius:14,padding:16,border:`1.5px solid ${C.primary}22`,marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Import de photos produits</div>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:10,lineHeight:1.5}}>
              Nommez vos fichiers: <code style={{background:C.bg,padding:"2px 6px",borderRadius:4,fontWeight:600}}>SKU-COULEUR-NUMERO.jpg</code><br/>
              Exemple: <code style={{background:C.bg,padding:"2px 6px",borderRadius:4}}>QMCHML_C001-752-1.jpg</code> = produit QMCHML_C001, couleur 752, photo 1/6<br/>
              Format: JPEG, 1200x800px recommande, max 5 Mo/photo, max 6 photos par couleur
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <input ref={photoFileRef} type="file" accept=".jpg,.jpeg" multiple style={{fontSize:11,flex:1}}/>
              <Btn onClick={handleUpload} disabled={uploading} style={{height:36,background:C.primary,minWidth:120}}>
                {uploading?<span className="spin-loader"/>:<><Upload size={14}/> Importer</>}
              </Btn>
            </div>
            {uploadResult&&<div style={{marginTop:10,fontSize:11,padding:10,borderRadius:8,background:uploadResult.errors?.length?C.dangerLight:C.primaryLight,border:`1px solid ${uploadResult.errors?.length?C.danger+"33":C.primary+"33"}`}}>
              <div style={{fontWeight:700}}>{uploadResult.imported} importee(s), {uploadResult.skipped} ignoree(s)</div>
              {uploadResult.errors?.map((e,i)=><div key={i} style={{color:C.danger,marginTop:2}}>{e}</div>)}
            </div>}
          </div>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{totalPhotos} photo(s) pour {totalProducts} produit(s)</div>
          {groups.length===0&&<div style={{textAlign:"center",padding:40,color:C.textMuted,fontSize:13}}>Aucune photo importee. Selectionnez des fichiers JPEG ci-dessus.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {groups.map(g=>{
              const product=products.find(p=>p.sku===g.skuBase);
              return<div key={`${g.skuBase}-${g.colorKey}`} style={{background:C.surface,borderRadius:12,padding:12,border:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div>
                    <span style={{fontWeight:700,fontSize:12}}>{g.skuBase}</span>
                    <span style={{margin:"0 6px",color:C.textMuted}}>—</span>
                    <span style={{fontWeight:600,fontSize:12,color:C.primary}}>Couleur {g.colorKey}</span>
                    {product&&<span style={{fontSize:10,color:C.textMuted,marginLeft:8}}>{product.name}</span>}
                  </div>
                  <button onClick={()=>handleDeleteGroup(g.skuBase,g.colorKey)} style={{background:C.dangerLight,border:`1px solid ${C.danger}33`,color:C.danger,borderRadius:8,padding:"3px 8px",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                    <Trash2 size={11}/> Tout supprimer
                  </button>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {g.photos.map(p=>(
                    <div key={p.id} style={{position:"relative",width:100,height:67,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
                      <img src={`${API.productPhotos.apiUrl}/uploads/products/${p.filename}`} alt={p.originalName||""} loading="lazy"
                        style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      <button onClick={()=>handleDelete(p.id)} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:"50%",width:18,height:18,fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <X size={10}/>
                      </button>
                      <div style={{position:"absolute",bottom:2,left:2,background:"rgba(0,0,0,0.6)",color:"#fff",borderRadius:4,padding:"1px 4px",fontSize:8,fontWeight:700}}>{p.sortOrder}</div>
                    </div>
                  ))}
                </div>
              </div>;
            })}
          </div>
        </div>;
      })()}
    </Modal>
  </div>);
}

/* ══════════ SETTINGS ══════════ */

export default ProductsScreen;
export { ProductsScreen };
