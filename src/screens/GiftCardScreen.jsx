import React, { useState } from "react";
import { Search, Gift, Plus, Printer } from "lucide-react";
import printer from "../printer.js";
import { CO, C } from "../constants.jsx";
import { ean13SvgHtml } from "../utils.jsx";
import { Btn, Input } from "../ui.jsx";
import { useApp } from "../context.jsx";

function GiftCardScreen(){
  const{giftCards,createGiftCard,checkGiftCard,settings,notify,perm}=useApp();
  if(!perm().canCreateProduct) return <div style={{padding:40,textAlign:"center",color:C.textMuted,fontSize:16,fontWeight:600}}>Accès refusé</div>;
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
        <div style={{display:"flex",gap:6}}>
        <Btn onClick={async()=>{if(amount){const gc=await createGiftCard(parseFloat(amount),custName);setAmount("");setCustName("");
          if(gc){const w=window.open("","_blank","width=400,height=400");if(w){w.document.write(`<html><head><title>Étiquette carte cadeau</title><style>body{font-family:'Courier New',monospace;font-size:12px;padding:10px;max-width:280px;margin:0 auto;text-align:center;}h2{font-size:16px;margin:8px 0;}h3{font-size:22px;margin:6px 0;}.code{font-size:18px;font-weight:bold;letter-spacing:2px;padding:8px;border:2px dashed #333;margin:8px 0;display:inline-block;}hr{border:none;border-top:1px dashed #333;margin:8px 0;}</style></head><body>`+
            `<h2>CARTE CADEAU</h2><div class="code">${gc.code}</div><hr>`+
            `<h3>${parseFloat(amount).toFixed(2)} EUR</h3>`+
            (custName?`<div>Bénéficiaire: ${custName}</div>`:"")+
            `<div style="font-size:10px;margin-top:6px;">Valide 1 an — ${settings.name||CO.name}</div><hr>`+
            `<div style="font-size:9px;">${settings.address||""} ${settings.postalCode||""} ${settings.city||""}<br/>SIRET: ${settings.siret||""}</div>`+
            (gc.barcode?ean13SvgHtml(gc.barcode,160,45):"")+
            `</body></html>`);w.document.close();setTimeout(()=>w.print(),300);}}
          }}}
          disabled={!amount} style={{flex:1,height:40,background:C.accent}}><Gift size={14}/> Créer + Étiquette</Btn>
        <Btn variant="outline" onClick={async()=>{if(amount){await createGiftCard(parseFloat(amount),custName);setAmount("");setCustName("");}}}
          disabled={!amount} style={{height:40}}><Plus size={14}/> Sans impression</Btn>
        </div>
      </div>
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}><Search size={16} style={{verticalAlign:"middle"}}/> Vérifier le solde</h3>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          <Input value={checkCode} onChange={e=>setCheckCode(e.target.value)} placeholder="Code carte (ex: GC-…)" style={{flex:1}}/>
          <Btn variant="info" onClick={async()=>{const gc=await checkGiftCard(checkCode);setCheckResult(gc?{found:true,gc}:{found:false});}} style={{height:42}}>Vérifier</Btn></div>
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
          <button onClick={(e)=>{e.stopPropagation();const w=window.open("","_blank","width=400,height=400");if(w){w.document.write(`<html><head><title>Étiquette carte cadeau</title><style>body{font-family:'Courier New',monospace;font-size:12px;padding:10px;max-width:280px;margin:0 auto;text-align:center;}h2{font-size:16px;margin:8px 0;}h3{font-size:22px;margin:6px 0;}.code{font-size:18px;font-weight:bold;letter-spacing:2px;padding:8px;border:2px dashed #333;margin:8px 0;display:inline-block;}hr{border:none;border-top:1px dashed #333;margin:8px 0;}</style></head><body>`+
            `<h2>CARTE CADEAU</h2><div class="code">${gc.code}</div><hr><h3>${gc.initialAmount.toFixed(2)} EUR</h3>`+
            (gc.customerName?`<div>Bénéficiaire: ${gc.customerName}</div>`:"")+
            `<div style="font-size:10px;margin-top:6px;">Solde: ${gc.balance.toFixed(2)} EUR</div><hr>`+
            (gc.barcode?ean13SvgHtml(gc.barcode,160,45):"")+
            `<div style="font-size:9px;">${settings.name||""}</div></body></html>`);w.document.close();setTimeout(()=>w.print(),300);}}}
            style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:9,fontWeight:600,color:C.textMuted}} title="Imprimer étiquette"><Printer size={12}/></button>
          {printerConnected&&<button onClick={(e)=>{e.stopPropagation();thermalPrint("giftcard",{code:gc.code,initial_amount:gc.initialAmount,remaining:gc.balance,customer_name:gc.customerName,created_at:gc.createdDate,barcode:gc.barcode});}}
            style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${C.accent}`,background:"transparent",cursor:"pointer",fontSize:9,fontWeight:600,color:C.accent}} title="Impression thermique"><Printer size={12}/></button>}
        </div>))}</div></div>
  </div>);
}

/* ══════════ PROMOS MANAGEMENT ══════════ */

export default GiftCardScreen;
export { GiftCardScreen };
