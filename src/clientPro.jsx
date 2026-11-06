// Fiche client particulier / professionnel (migration API 047) : formulaire partage par l'ecran
// Clients et la facture de l'ecran Tickets. Modele : ancienne caisse MCS (type, forme juridique,
// raison sociale, SIREN, adresse).
import React from "react";
import { C } from "./constants.jsx";
import { Input } from "./ui.jsx";

export const FORMES_JURIDIQUES = [
  "AE - Auto-entrepreneur / Micro-entreprise","EI - Entreprise Individuelle","EURL - Entreprise Unipersonnelle à Responsabilité Limitée",
  "SARL - Société à Responsabilité Limitée","SAS - Société par Actions Simplifiée","SASU - Société par Actions Simplifiée Unipersonnelle",
  "SA - Société Anonyme","SCA - Société en Commandite par Actions","SNC - Société en Nom Collectif","SCI - Société Civile Immobilière",
  "SCM - Société Civile de Moyens","SCP - Société Civile Professionnelle","SCOP - Société Coopérative de Production",
  "SCIC - Société Coopérative d'Intérêt Collectif","SELARL - Société d'Exercice Libéral à Responsabilité Limitée",
  "EARL - Entreprise Agricole à Responsabilité Limitée","GAEC - Groupement Agricole d'Exploitation en Commun","GIE - Groupement d'Intérêt Économique",
  "Association","Administration / Collectivité","Profession libérale","Autre",
];

export const CLIENT_VIDE = { customerType:"particulier", companyName:"", legalForm:"", siren:"", vatNumber:"",
  firstName:"", lastName:"", email:"", phone:"", address:"", postalCode:"", city:"", notes:"" };

export const estPro = (c) => c?.customerType === "pro" && !!c?.companyName;
// Nom affiche : raison sociale pour un pro, sinon prenom + nom
export const nomClient = (c) => !c ? "" : estPro(c) ? c.companyName : `${c.firstName||""} ${c.lastName||""}`.trim();
export const contactClient = (c) => estPro(c) ? `${c.firstName||""} ${c.lastName||""}`.trim() : "";
// Texte de recherche (nom, raison sociale, SIREN, email, telephone)
export const texteRechercheClient = (c) => `${c.firstName||""} ${c.lastName||""} ${c.lastName||""} ${c.firstName||""} ${c.companyName||""} ${c.siren||""} ${c.email||""} ${c.phone||""}`.toLowerCase();

// Champs manquants avant enregistrement (null si la fiche peut partir au serveur)
export function erreurClient(v) {
  if (v.customerType === "pro") return v.companyName?.trim() ? null : "Raison sociale requise";
  return v.firstName?.trim() && v.lastName?.trim() ? null : "Prénom et nom requis";
}
// Corps envoye a l'API : uniquement les champs de la fiche
export const corpsClient = (v) => Object.fromEntries(Object.keys(CLIENT_VIDE).map(k => [k, typeof v[k] === "string" ? v[k].trim() : v[k]]));

const Lbl = ({ children }) => <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:2}}>{children}</label>;

export function ChampsClient({ v, set, notes = false }) {
  const pro = v.customerType === "pro";
  const ch = (k) => (e) => { const x = e.target.value; set(p => ({ ...p, [k]: x })); };
  const champ = (k, label, props = {}) => <div><Lbl>{label}</Lbl><Input value={v[k] || ""} onChange={ch(k)} {...props}/></div>;
  return (<div style={{display:"flex",flexDirection:"column",gap:10}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,padding:4,background:C.surfaceAlt,borderRadius:10}}>
      {[["particulier","Particulier"],["pro","Professionnel"]].map(([t,l]) => (
        <button key={t} type="button" onClick={() => set(p => ({ ...p, customerType: t }))}
          style={{height:38,borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,
            background:v.customerType===t?C.primary:"transparent",color:v.customerType===t?"#fff":C.textMuted}}>{l}</button>))}
    </div>
    {pro && <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:10,borderRadius:10,border:`1.5px solid ${C.primary}33`,background:C.primaryLight}}>
      <div style={{gridColumn:"1 / -1"}}>{champ("companyName","RAISON SOCIALE *",{placeholder:"Nom de la société"})}</div>
      <div style={{gridColumn:"1 / -1"}}><Lbl>FORME JURIDIQUE</Lbl>
        <select value={v.legalForm || ""} onChange={ch("legalForm")}
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:13,fontFamily:"inherit",background:C.surface}}>
          <option value="">Forme juridique</option>
          {FORMES_JURIDIQUES.map(f => <option key={f} value={f}>{f}</option>)}
          {v.legalForm && !FORMES_JURIDIQUES.includes(v.legalForm) && <option value={v.legalForm}>{v.legalForm}</option>}
        </select></div>
      {champ("siren","SIREN / SIRET",{inputMode:"numeric",placeholder:"9 ou 14 chiffres"})}
      {champ("vatNumber","N° TVA INTRACOM.",{placeholder:"FR…"})}
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      {champ("firstName", pro ? "PRÉNOM DU CONTACT" : "PRÉNOM *")}
      {champ("lastName", pro ? "NOM DU CONTACT" : "NOM *")}
      {champ("email","EMAIL",{type:"email"})}
      {champ("phone","TÉLÉPHONE",{inputMode:"tel"})}
      <div style={{gridColumn:"1 / -1"}}>{champ("address","ADRESSE")}</div>
      {champ("postalCode","CODE POSTAL",{inputMode:"numeric"})}
      {champ("city","VILLE")}
    </div>
    {notes && <div><Lbl>NOTES</Lbl>
      <textarea value={v.notes || ""} onChange={ch("notes")} placeholder="Notes…"
        style={{width:"100%",height:50,padding:8,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,fontFamily:"inherit",resize:"vertical"}}/></div>}
  </div>);
}
