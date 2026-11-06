// Facture d'un ticket : choix (ou creation) du client, emission par le serveur (numero continu,
// identite du client figee), puis impression A4 (PC) ou envoi par email (tablette : l'APK
// n'imprime pas en A4). Ouverte a tous les comptes depuis l'ecran Tickets (MCS, 06/11/2026) ;
// aussi utilisee par Exports & Factures.
import React, { useState, useEffect } from "react";
import { FileText, Printer, Mail, Plus, X, Building2 } from "lucide-react";
import * as API from "./api.js";
import { C } from "./constants.jsx";
import { Modal, Btn, Input } from "./ui.jsx";
import { useApp } from "./context.jsx";
import { ChampsClient, CLIENT_VIDE, erreurClient, corpsClient, nomClient, contactClient, estPro, texteRechercheClient } from "./clientPro.jsx";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const natif = () => !!(window.Capacitor?.isNativePlatform?.());

// Ouvre la facture A4 rendue par le serveur dans une fenetre a imprimer. La fenetre est ouverte
// AU CLIC (avant l'appel reseau), sinon le navigateur la bloque.
export async function imprimerFacture(invoiceId, notify) {
  const w = window.open("", "_blank", "width=880,height=1000");
  if (!w) { notify("Fenêtre d'impression bloquée : autorisez les fenêtres pour ce site", "warn"); return; }
  try { const html = await API.invoices.html(invoiceId); w.document.open(); w.document.write(html); w.document.close(); }
  catch (e) { w.close(); notify("Facture non affichée : " + e.message, "error"); }
}

export default function FactureDialog({ ticket, onClose }) {
  const { customers, addCustomer, updateCustomer, notify, addJET } = useApp();
  const [client, setClient] = useState(null);
  const [q, setQ] = useState("");
  const [nouveau, setNouveau] = useState(null);       // formulaire de creation / completion de fiche
  const [notes, setNotes] = useState("");
  const [inv, setInv] = useState(null);               // facture emise
  const [email, setEmail] = useState("");
  const [enCours, setEnCours] = useState(false);

  const tkNum = ticket?.ticketNumber || ticket?.ticket_number || "";
  const tkTTC = Number(ticket?.totalTTC ?? ticket?.total_ttc) || 0;
  useEffect(() => {
    if (!ticket) return;
    const c = customers.find(x => x.id === (ticket.customerId || ticket.customer_id)) || null;
    setClient(c); setQ(""); setNouveau(null); setNotes(""); setInv(null); setEmail(c?.email || ""); setEnCours(false);
  }, [ticket?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const enregistrerFiche = async () => {
    const err = erreurClient(nouveau); if (err) { notify(err, "error"); return; }
    setEnCours(true);
    const r = nouveau.id ? await updateCustomer(nouveau.id, corpsClient(nouveau)) : await addCustomer(corpsClient(nouveau));
    setEnCours(false);
    if (!r) return;
    const fiche = nouveau.id ? { ...nouveau, ...r } : r;
    if (!nouveau.id && (fiche.local || !UUID_RE.test(String(fiche.id)))) { notify("Fiche non enregistrée sur le serveur : facture impossible hors connexion", "error"); return; }
    setClient(fiche); setEmail(fiche.email || email); setNouveau(null);
  };

  const emettre = async () => {
    if (!UUID_RE.test(String(ticket?.id || ""))) { notify("Ticket pas encore enregistré sur le serveur : facture impossible pour l'instant", "error"); return; }
    setEnCours(true);
    try {
      const r = await API.invoices.create({ saleId: ticket.id, customerId: client?.id || null,
        clientName: client ? nomClient(client) : "", clientEmail: client?.email || "", notes: notes.trim() || null });
      setInv(r);
      addJET?.("FACTURE", `${r.reprint ? "Réimpression" : "Émission"} facture ${r.invoice_number}`);
      notify(r.reprint ? `Facture ${r.invoice_number} déjà émise pour ce ticket : même numéro` : `Facture ${r.invoice_number} émise`, "success");
    } catch (e) { notify("Facture non émise : " + e.message, "error"); }
    setEnCours(false);
  };

  const envoyer = async () => {
    setEnCours(true);
    try { await API.invoices.email(inv.id, email.trim()); notify(`Facture ${inv.invoice_number} envoyée à ${email.trim()}`, "success"); }
    catch (e) { notify("Email non envoyé : " + e.message, "error"); }
    setEnCours(false);
  };

  const liste = customers.filter(c => { const s = q.trim().toLowerCase(); return !s || texteRechercheClient(c).includes(s); }).slice(0, 30);
  const pro = inv ? !!inv.client_company : estPro(client);
  // Fiche choisie mais incomplete pour une facture pro (adresse manquante) : proposer de la completer
  const incomplet = client && estPro(client) && !client.address;

  return (<Modal open={!!ticket} onClose={onClose} title={inv ? `Facture ${inv.invoice_number}` : "Facture"} sub={`Ticket ${tkNum} — ${tkTTC.toFixed(2)} €`}>
    {ticket && !inv && !nouveau && <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4}}>FACTURER À</label>
        {client ? <div style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,background:C.primaryLight,border:`1.5px solid ${C.primary}44`}}>
            {estPro(client) && <Building2 size={18} color={C.primary}/>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700}}>{nomClient(client)}</div>
              <div style={{fontSize:10,color:C.textMuted}}>{[contactClient(client), client.siren && `SIREN ${client.siren}`, [client.address, client.postalCode, client.city].filter(Boolean).join(" ")].filter(Boolean).join(" — ") || client.email || client.phone || ""}</div></div>
            <Btn variant="ghost" onClick={() => setNouveau({ ...CLIENT_VIDE, ...client })} style={{fontSize:10,padding:"4px 8px"}}>Compléter</Btn>
            <button onClick={() => setClient(null)} title="Changer de client" style={{background:"none",border:"none",cursor:"pointer"}}><X size={15} color={C.textMuted}/></button></div>
          : <div>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher : société, nom, SIREN, téléphone…" style={{flex:1}}/>
              <Btn variant="outline" onClick={() => setNouveau({ ...CLIENT_VIDE, customerType: "pro" })} style={{gap:4,whiteSpace:"nowrap"}}><Plus size={14}/> Nouveau</Btn></div>
            <div style={{maxHeight:220,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:10}}>
              {liste.map(c => <button key={c.id} onClick={() => { setClient(c); setEmail(c.email || ""); }}
                style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 10px",background:"transparent",border:"none",borderBottom:`1px solid ${C.surfaceAlt}`,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                {estPro(c) ? <Building2 size={14} color={C.primary}/> : <span style={{width:14}}/>}
                <span style={{fontSize:12,fontWeight:600,flex:1}}>{nomClient(c)}{contactClient(c) && <span style={{fontWeight:400,color:C.textMuted}}> — {contactClient(c)}</span>}</span>
                <span style={{fontSize:10,color:C.textMuted}}>{c.phone || c.email || ""}</span></button>)}
              {!liste.length && <div style={{padding:12,fontSize:11,color:C.textMuted}}>Aucun client trouvé — « Nouveau » pour créer la fiche.</div>}
            </div></div>}
      </div>
      {incomplet && <div style={{fontSize:11,color:C.warn}}>Adresse de la société manquante : « Compléter » pour l'ajouter avant d'émettre la facture.</div>}
      <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4}}>MENTION SUR LA FACTURE (optionnel)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Bon de commande n°…, référence chantier…"
          style={{width:"100%",height:54,padding:8,borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:12,fontFamily:"inherit",resize:"vertical"}}/></div>
      <div style={{fontSize:10,color:C.textMuted}}>Une seule facture par ticket : son numéro est définitif. La redemander redonne la même facture.</div>
      <Btn onClick={emettre} disabled={enCours || !client} style={{height:46,background:C.primary,gap:6}}><FileText size={15}/> Émettre la facture</Btn>
      {!client && <div style={{fontSize:10,color:C.textMuted,textAlign:"center",marginTop:-6}}>Choisissez ou créez le client à facturer.</div>}
    </div>}

    {ticket && !inv && nouveau && <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <ChampsClient v={nouveau} set={setNouveau}/>
      <div style={{display:"flex",gap:8}}>
        <Btn variant="outline" onClick={() => setNouveau(null)} style={{flex:1}}>Annuler</Btn>
        <Btn onClick={enregistrerFiche} disabled={enCours} style={{flex:2,background:C.primary}}>{nouveau.id ? "Enregistrer la fiche" : "Créer la fiche client"}</Btn></div>
    </div>}

    {inv && <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{padding:12,borderRadius:10,background:C.primaryLight,border:`1.5px solid ${C.primary}44`}}>
        <div style={{fontSize:16,fontWeight:800,color:C.primary}}>{inv.invoice_number}</div>
        <div style={{fontSize:12,fontWeight:600,marginTop:2}}>{pro ? inv.client_company : (inv.client_name || "Client")}</div>
        <div style={{fontSize:11,color:C.textMuted}}>{Number(inv.total_ttc).toFixed(2)} € TTC{inv.reprint ? " — facture déjà émise, même numéro" : ""}</div></div>
      {!natif() && <Btn onClick={() => imprimerFacture(inv.id, notify)} style={{height:44,background:C.primary,gap:6}}><Printer size={15}/> Imprimer / PDF</Btn>}
      <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:4}}>ENVOYER PAR EMAIL</label>
        <div style={{display:"flex",gap:6}}>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="compta@societe.fr" style={{flex:1}}/>
          <Btn variant={natif() ? "primary" : "outline"} onClick={envoyer} disabled={enCours || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} style={{gap:4}}><Mail size={14}/> Envoyer</Btn></div></div>
      <Btn variant="outline" onClick={onClose}>Fermer</Btn>
    </div>}
  </Modal>);
}
