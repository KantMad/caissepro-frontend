import React, { useState, useEffect } from "react";
import { Search, Trash2, Plus, Receipt, Euro, Download, Save, Upload, Heart, Star, Edit, ChevronDown, Package } from "lucide-react";
import Papa from "papaparse";
import * as API from "../api.js";
import { LOYALTY_TIERS, C } from "../constants.jsx";
import { Modal, Btn, Input, Badge, SC, ConfirmDialog } from "../ui.jsx";
import { useApp } from "../context.jsx";

function CustomersScreen(){
  const{customers,setCustomers,tickets,exportCustomerRGPD,getLoyaltyTier,updateCustomer,deleteCustomer,addCustomer,notify}=useApp();
  const[sel,setSel]=useState(null);const[search,setSearch]=useState("");
  const[editMode,setEditMode]=useState(false);
  const[editData,setEditData]=useState({});
  const[custHistory,setCustHistory]=useState([]);const[loadingHist,setLoadingHist]=useState(false);const[expandedTk,setExpandedTk]=useState(null);
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
    setCustomers(p=>[...p,{id:crypto.randomUUID?crypto.randomUUID():"c"+Date.now()+Math.random().toString(36).slice(2,8),firstName:c.firstName,lastName:c.lastName,email:c.email,phone:c.phone,city:c.city,notes:c.notes,points:0,totalSpent:0}]);added++;});
    notify(`${added} client(s) importé(s)`,"success");setCsvModal(false);setCsvStep(0);setCsvData([]);};
  useEffect(()=>{if(!sel)return;setLoadingHist(true);setCustHistory([]);setExpandedTk(null);
    API.customers.history(sel.id).then(data=>{setCustHistory(Array.isArray(data)?data:data.sales||[]);}).catch(()=>{
      // Fallback: filter local tickets
      setCustHistory(tickets.filter(t=>t.customerId===sel.id));
    }).finally(()=>setLoadingHist(false));},[sel?.id]);
  const filtered=customers.filter(c=>!search||`${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  const custTickets=custHistory.length?custHistory:(sel?tickets.filter(t=>t.customerId===sel.id):[]);
  const custAvg=custTickets.length?custTickets.reduce((s,t)=>s+(t.totalTTC||parseFloat(t.total_ttc)||0),0)/custTickets.length:0;

  const startEdit=()=>{setEditData({firstName:sel.firstName,lastName:sel.lastName,email:sel.email,phone:sel.phone,city:sel.city||""});setEditMode(true);};
  const saveEdit=()=>{updateCustomer(sel.id,editData);setSel(s=>({...s,...editData}));setEditMode(false);};

  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h2 style={{fontSize:22,fontWeight:800,margin:0}}>Clients & Fidélité ({customers.length})</h2>
      <div style={{display:"flex",gap:6}}>
        <Btn variant="outline" onClick={()=>{setCsvModal(true);setCsvStep(0);setCsvData([]);}} style={{fontSize:11}}><Upload size={12}/> Import CSV</Btn>
        <Btn onClick={()=>setNewCustModal(true)} style={{fontSize:11,background:C.primary}}><Plus size={12}/> Nouveau client</Btn></div></div>
    <div style={{display:"flex",gap:10}}>
      <div style={{flex:sel?`0 0 280px`:"1",transition:"flex 0.3s ease",maxHeight:"calc(100vh - 140px)",overflowY:"auto"}}>
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher nom, email, téléphone…" style={{marginBottom:10,height:36}}/>
        <div style={{display:sel?"flex":"grid",flexDirection:"column",gridTemplateColumns:sel?"1fr":"repeat(auto-fill,minmax(260px,1fr))",gap:sel?4:8}}>
        {filtered.map(c=>{const tier=getLoyaltyTier(c.points);return(
          <div key={c.id} onClick={()=>{setSel(c);setEditMode(false);}} style={{display:"flex",alignItems:"center",gap:8,padding:sel?8:12,borderRadius:sel?8:12,
            background:sel?.id===c.id?C.primaryLight:C.surface,border:`1.5px solid ${sel?.id===c.id?C.primary:C.border}`,cursor:"pointer",transition:"all 0.15s"}}
            onMouseEnter={e=>{if(sel?.id!==c.id)e.currentTarget.style.borderColor=C.primary+"66";}} onMouseLeave={e=>{if(sel?.id!==c.id)e.currentTarget.style.borderColor=C.border;}}>
            <div style={{width:sel?30:36,height:sel?30:36,borderRadius:sel?15:18,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:sel?10:12}}>{c.firstName?.[0]}{c.lastName?.[0]}</div>
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
            <SC icon={Euro} label="Dépensé" value={`${sel.totalSpent.toFixed(0)}€`} color={C.primary}/>
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
          {loadingHist&&<div style={{color:C.textLight,fontSize:11}}>Chargement…</div>}
          {!loadingHist&&custTickets.length===0&&<div style={{color:C.textLight,fontSize:11}}>Aucun achat</div>}
          <div style={{maxHeight:400,overflowY:"auto"}}>
          {custTickets.slice(0,50).map(t=>{const tk=t.ticketNumber||t.ticket_number;const items=t.items||[];const total=(t.totalTTC||parseFloat(t.total_ttc)||0);
            return(<div key={tk} style={{borderBottom:`1px solid ${C.border}`,marginBottom:2}}>
              <div onClick={()=>setExpandedTk(prev=>prev===tk?null:tk)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 6px",cursor:"pointer",borderRadius:6,transition:"background 0.1s"}}
                onMouseEnter={e=>e.currentTarget.style.background=C.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600}}>{tk}</div>
                  <div style={{fontSize:10,color:C.textMuted}}>{new Date(t.date||t.createdAt||t.created_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"})} — {items.length} article{items.length>1?"s":""}{t.user_name?` — ${t.user_name}`:""}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontWeight:700,color:C.primary,fontSize:13}}>{total.toFixed(2)}€</span>
                  <ChevronDown size={14} color={C.textLight} style={{transform:expandedTk===tk?"rotate(180deg)":"rotate(0)",transition:"transform 0.2s"}}/>
                </div>
              </div>
              {expandedTk===tk&&items.length>0&&(
                <div style={{padding:"0 6px 10px 16px"}}>
                  {items.map((it,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:i<items.length-1?`1px dashed ${C.border}`:"none"}}>
                      <div style={{flex:1}}>
                        <span style={{fontSize:11,fontWeight:600}}>{it.name||it.product_name||"Produit"}</span>
                        {(it.color||it.variant_color||it.size||it.variant_size)&&<span style={{fontSize:10,color:C.textMuted,marginLeft:6}}>
                          {it.color||it.variant_color||""}{(it.color||it.variant_color)&&(it.size||it.variant_size)?" / ":""}{it.size||it.variant_size||""}</span>}
                        {it.sku&&<span style={{fontSize:9,color:C.textLight,marginLeft:6}}>({it.sku})</span>}
                        {(it.qty||it.quantity)>1&&<span style={{fontSize:10,color:C.textMuted,marginLeft:6}}>x{it.qty||it.quantity}</span>}
                        {parseFloat(it.discount||it.discount_percent||0)>0&&<span style={{fontSize:10,color:C.accent,marginLeft:4}}>-{parseFloat(it.discount||it.discount_percent).toFixed(0)}%</span>}
                      </div>
                      <span style={{fontSize:11,fontWeight:600,color:C.text}}>{parseFloat(it.ttc||it.line_ttc||0).toFixed(2)}€</span>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:6,paddingTop:4,borderTop:`1.5px solid ${C.border}`}}>
                    <span style={{fontSize:10,fontWeight:600,color:C.textMuted}}>Mode: {t.payment_method||t.paymentMethod||"—"}</span>
                    <span style={{fontSize:12,fontWeight:800,color:C.primary}}>Total: {total.toFixed(2)}€</span>
                  </div>
                </div>
              )}
            </div>);})}</div></div>
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
        style={{width:"100%",height:40,background:C.primary}}>Créer le client</Btn></Modal>

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
              <td style={{padding:4}}>{c._dup?<Badge color={C.warn}>Doublon</Badge>:<Badge color="#059669">Nouveau</Badge>}</td></tr>))}</tbody></table></div>
        <Btn onClick={importCustCSV} style={{width:"100%",height:40,background:C.primary}}><Upload size={14}/> Importer {csvPreview.filter(c=>!c._dup&&(c.firstName||c.lastName)).length} client(s)</Btn></div>}
    </Modal>

    {/* Delete confirmation */}
    <ConfirmDialog open={confirmDel} onClose={()=>setConfirmDel(false)} onConfirm={()=>{deleteCustomer(sel.id);setSel(null);}}
      title="Supprimer ce client ?" message={`Supprimer ${sel?.firstName} ${sel?.lastName} et toutes ses données ? Son historique d'achat sera conservé dans les tickets.`}/>
  </div>);
}

/* ══════════ FISCAL ══════════ */

export default CustomersScreen;
export { CustomersScreen };
