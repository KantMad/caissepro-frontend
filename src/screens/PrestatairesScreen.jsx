import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, FileText, Pencil, Trash2, Save, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { Btn, Input, Modal, ConfirmDialog } from "../ui.jsx";
import { useApp } from "../context.jsx";
import { dayKey } from "../lib/dates.js";
import { PERIODES, bornesPeriode } from "./VentesClassement.jsx";

// Prestataires (MCS 26/11/2026) : la boutique achete les retouches a des retoucheurs (et d'autres
// prestations : lavage de vitres...). Chaque bon de retouche cree la ligne due au prestataire
// (type de retouche des Reglages -> prestataire + prix d'achat HT). Ici le gerant :
//  - voit ce qui est du a chaque prestataire et emet le releve A4 numerote (PAS une facture),
//  - complete les travaux libres « a affecter », saisit les autres prestations a la main,
//  - consulte les statistiques sur une periode, gere les fiches prestataires.
// Tout est calcule et enregistre par le serveur (/api/prestataires).

const eur = (v) => (Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const date = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const qte = (q) => (Number(q) % 1 ? Number(q).toFixed(2) : String(Number(q)));
const ht = (l) => Math.round(Number(l.quantity) * Number(l.unit_cost_ht || 0) * 100) / 100;
const FICHE_VIDE = { name: "", contact: "", address: "", phone: "", email: "", vat_number: "", tva_rate: 20, notes: "", active: true };
const ONGLETS = [{ id: "du", l: "À émettre" }, { id: "releves", l: "Relevés" }, { id: "stats", l: "Statistiques" }, { id: "fiches", l: "Fiches prestataires" }];

const lab = { fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 3 };
const carte = { background: C.surface, borderRadius: 14, padding: 16, border: `1.5px solid ${C.border}`, marginBottom: 14 };
const th = { padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, whiteSpace: "nowrap", borderBottom: `1.5px solid ${C.border}`, textAlign: "left" };
const td = { padding: "7px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 12 };
const num = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const sel = { height: 36, padding: "0 10px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, fontFamily: "inherit", width: "100%" };

// Ouvre le releve A4 rendu par le serveur. Fenetre ouverte AU CLIC (avant l'appel reseau),
// sinon le navigateur la bloque.
async function ouvrirReleve(rid, notify, fenetre) {
  const w = fenetre || window.open("", "_blank", "width=880,height=1000");
  if (!w) { notify("Fenêtre bloquée : autorisez les fenêtres pour ce site", "warn"); return; }
  try { const html = await API.prestataires.releveHtml(rid); w.document.open(); w.document.write(html); w.document.close(); }
  catch (e) { w.close(); notify("Relevé non affiché : " + e.message, "error"); }
}

export default function PrestatairesScreen() {
  const { notify } = useApp();
  const [onglet, setOnglet] = useState("du");
  const [prestas, setPrestas] = useState(null);
  const [erreur, setErreur] = useState("");
  const [saisie, setSaisie] = useState(null);       // ligne a la main (nouvelle ou modifiee)

  const charger = useCallback(() => API.prestataires.list().then(l => { setPrestas(l || []); setErreur(""); })
    .catch(e => { setPrestas([]); setErreur(e.message || "Chargement impossible"); }), []);
  useEffect(() => { charger(); }, [charger]);
  const actifs = useMemo(() => (prestas || []).filter(p => p.active), [prestas]);

  return (<div data-testid="prestataires-ecran" style={{ maxWidth: 1100 }}>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
      {ONGLETS.map(o => (<button key={o.id} data-testid={`onglet-${o.id}`} onClick={() => setOnglet(o.id)}
        style={{ padding: "0 14px", minHeight: 36, borderRadius: 10, border: `1.5px solid ${onglet === o.id ? C.primary : C.border}`,
          background: onglet === o.id ? C.primary : C.surface, color: onglet === o.id ? "#fff" : C.text, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{o.l}</button>))}
      <div style={{ flex: 1 }} />
      <Btn data-testid="ajouter-prestation" onClick={() => setSaisie({ performed_at: dayKey(), label: "", prestataire_id: actifs[0]?.id || "", quantity: 1, unit_cost_ht: "", notes: "" })}
        disabled={!actifs.length} style={{ background: C.primary, height: 36, fontSize: 12 }}><Plus size={14} /> Ajouter une prestation</Btn>
    </div>
    {erreur && <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#FEF2F2", color: "#B91C1C", fontSize: 12, marginBottom: 12 }}>{erreur}</div>}
    {prestas && !prestas.length && !erreur && <div style={{ ...carte, fontSize: 12, color: C.textMuted }}>
      Aucun prestataire. Créez la fiche de votre retoucheur (onglet <b>Fiches prestataires</b>), puis reliez-le aux types de retouches dans <b>Paramètres &gt; Retouches</b> avec le prix d'achat HT.</div>}

    {onglet === "du" && <OngletDu prestas={prestas} actifs={actifs} notify={notify} recharger={charger} modifier={setSaisie} />}
    {onglet === "releves" && <OngletReleves prestas={prestas} notify={notify} />}
    {onglet === "stats" && <OngletStats />}
    {onglet === "fiches" && <OngletFiches prestas={prestas} notify={notify} recharger={charger} />}

    <SaisiePrestation ligne={saisie} actifs={actifs} onClose={() => setSaisie(null)} notify={notify}
      onSaved={() => { setSaisie(null); charger(); }} />
  </div>);
}

// ══ A emettre : par prestataire, lignes pas encore dans un releve ; travaux « a affecter » ══
function OngletDu({ prestas, actifs, notify, recharger, modifier }) {
  const [lignes, setLignes] = useState(null);
  const [aAffecter, setAAffecter] = useState([]);
  const [ouvert, setOuvert] = useState(null);
  const [confirme, setConfirme] = useState(null);
  const [retrait, setRetrait] = useState(null);
  const [version, setVersion] = useState(0);
  const rafraichir = () => { setVersion(v => v + 1); recharger(); };

  useEffect(() => {
    Promise.all([API.prestataires.prestations({ statut: "a_emettre" }), API.prestataires.prestations({ statut: "a_affecter" })])
      .then(([a, b]) => { setLignes(a || []); setAAffecter(b || []); })
      .catch(e => { setLignes([]); notify("Prestations non chargées : " + e.message, "error"); });
  }, [version]);   // eslint-disable-line react-hooks/exhaustive-deps

  const emettre = async (p) => {
    // Fenetre ouverte au clic (le navigateur bloque une fenetre ouverte apres un appel reseau)
    const w = window.open("", "_blank", "width=880,height=1000");
    try {
      const r = await API.prestataires.emettreReleve(p.id);
      notify(`Relevé ${r.releve_number} émis pour ${p.name} : ${eur(r.total_ttc)} TTC`, "success");
      if (w) await ouvrirReleve(r.id, notify, w);
      rafraichir();
    } catch (e) { if (w) w.close(); notify("Relevé non émis : " + e.message, "error"); }
  };

  const avecDu = (prestas || []).filter(p => p.a_emettre_count > 0 || p.active);
  return (<>
    {aAffecter.length > 0 && <div data-testid="a-affecter" style={{ ...carte, borderColor: `${C.warn}66`, background: C.warnLight }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800, marginBottom: 6, color: "#92400E" }}>
        <AlertTriangle size={16} /> {aAffecter.length} travail(x) à affecter</div>
      <div style={{ fontSize: 11, color: "#92400E", marginBottom: 10 }}>Retouches saisies en texte libre sur un bon (sans type paramétré) : choisissez le prestataire et le prix d'achat HT pour qu'elles entrent dans son prochain relevé.</div>
      {aAffecter.map(l => <LigneAAffecter key={l.id} l={l} actifs={actifs} notify={notify} onSaved={rafraichir} />)}
    </div>}

    {lignes === null && <div style={{ padding: 24, textAlign: "center", color: C.textMuted, fontSize: 12 }}>Chargement…</div>}
    {lignes && avecDu.map(p => {
      const siennes = lignes.filter(l => l.prestataire_id === p.id);
      const tot = siennes.reduce((a, l) => { const h = ht(l); return { ht: a.ht + h, ttc: a.ttc + h * (1 + Number(l.tva_rate || 0) / 100) }; }, { ht: 0, ttc: 0 });
      const deplie = ouvert === p.id;
      return (<div key={p.id} data-testid={`du-${p.name}`} style={carte}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => setOuvert(deplie ? null : p.id)} disabled={!siennes.length}
            style={{ border: "none", background: "transparent", cursor: siennes.length ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6, padding: 0, fontFamily: "inherit", color: C.text }}>
            {siennes.length ? (deplie ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span style={{ width: 16 }} />}
            <span style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</span></button>
          <span style={{ fontSize: 12, color: C.textMuted }}>{siennes.length} prestation(s) à émettre
            {p.dernier_releve && <> · dernier relevé le {date(p.dernier_releve)}</>}</span>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: "right" }}>
            <div data-testid={`du-total-${p.name}`} style={{ fontSize: 16, fontWeight: 900, color: C.primary }}>{eur(tot.ttc)} TTC</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{eur(tot.ht)} HT</div></div>
          <Btn data-testid={`emettre-${p.name}`} onClick={() => setConfirme({ p, n: siennes.length, ttc: tot.ttc })} disabled={!siennes.length}
            style={{ background: C.primary, height: 38, fontSize: 12 }}><FileText size={14} /> Générer le relevé</Btn>
        </div>
        {deplie && siennes.length > 0 && <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={th}>Date</th><th style={th}>Bon</th><th style={th}>Prestation</th><th style={{ ...th, textAlign: "right" }}>Qté</th>
              <th style={{ ...th, textAlign: "right" }}>P.U. HT</th><th style={{ ...th, textAlign: "right" }}>Total HT</th><th style={{ ...th, textAlign: "right" }} title="Prix payé par le client. En rouge : vendu moins cher que l'achat TTC">Vendu TTC</th><th style={th} /></tr></thead>
            <tbody>{siennes.map(l => (<tr key={l.id}>
              <td style={td}>{date(l.performed_at)}</td><td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{l.retouche_number || "saisie"}</td>
              <td style={td}>{l.label}{l.notes && <span style={{ color: C.textMuted }}> ({l.notes})</span>}</td>
              <td style={num}>{qte(l.quantity)}</td><td style={num}>{eur(l.unit_cost_ht)}</td><td style={num}>{eur(ht(l))}</td>
              <td style={{ ...num, color: l.sale_price_ttc != null && Number(l.sale_price_ttc) < ht(l) * (1 + Number(l.tva_rate || 0) / 100) ? C.danger : C.textMuted }}>{l.sale_price_ttc != null ? eur(l.sale_price_ttc) : "—"}</td>
              <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                <Btn variant="ghost" title="Modifier" onClick={() => modifier({ ...l, performed_at: dayKey(new Date(l.performed_at)) })} style={{ padding: "2px 6px" }}><Pencil size={13} /></Btn>
                <Btn variant="ghost" title="Retirer" onClick={() => setRetrait(l)} style={{ padding: "2px 6px", color: C.danger }}><Trash2 size={13} /></Btn></td>
            </tr>))}</tbody></table></div>}
      </div>);
    })}
    <ConfirmDialog open={!!confirme} onClose={() => setConfirme(null)} onConfirm={() => { const c = confirme; setConfirme(null); emettre(c.p); }}
      title={`Relevé pour ${confirme?.p.name}`}
      message={`${confirme?.n} prestation(s), ${eur(confirme?.ttc)} TTC. Le relevé reçoit un numéro et ces prestations n'apparaîtront plus dans le suivant.`} />
    <ConfirmDialog open={!!retrait} onClose={() => setRetrait(null)} title="Retirer cette prestation ?"
      message={`« ${retrait?.label} » ne sera plus due au prestataire. Pour une retouche, préférez annuler le bon.`}
      onConfirm={async () => { const l = retrait; setRetrait(null);
        try { await API.prestataires.retirerPrestation(l.id); notify("Prestation retirée", "warn"); rafraichir(); }
        catch (e) { notify(e.message, "error"); } }} />
  </>);
}

function LigneAAffecter({ l, actifs, notify, onSaved }) {
  const [pid, setPid] = useState(l.prestataire_id || "");
  const [cout, setCout] = useState(l.unit_cost_ht ?? "");
  const ok = pid && cout !== "" && Number(cout) >= 0;
  return (<div style={{ display: "grid", gridTemplateColumns: "90px 1fr 180px 110px auto", gap: 8, alignItems: "center", marginBottom: 6 }}>
    <span style={{ fontSize: 11 }}>{date(l.performed_at)}</span>
    <span style={{ fontSize: 12, fontWeight: 600 }}>{l.label} <span style={{ fontFamily: "monospace", fontSize: 10, color: C.textMuted }}>{l.retouche_number}</span>
      {l.sale_price_ttc != null && <span style={{ fontSize: 10, color: C.textMuted }}> · vendu {eur(l.sale_price_ttc)}</span>}</span>
    <select value={pid} onChange={e => setPid(e.target.value)} style={sel}><option value="">Prestataire…</option>
      {actifs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    <Input type="number" step="0.5" min="0" value={cout} onChange={e => setCout(e.target.value)} placeholder="Achat HT" style={{ height: 36, textAlign: "right" }} />
    <Btn disabled={!ok} onClick={async () => {
      try { await API.prestataires.modifierPrestation(l.id, { prestataire_id: pid, unit_cost_ht: cout }); notify("Prestation affectée", "success"); onSaved(); }
      catch (e) { notify(e.message, "error"); } }} style={{ background: C.primary, height: 36, fontSize: 12 }}><Save size={13} /> Affecter</Btn>
  </div>);
}

// Saisie a la main (lavage de vitres...) ou correction d'une ligne pas encore emise
function SaisiePrestation({ ligne, actifs, onClose, onSaved, notify }) {
  const [f, setF] = useState(ligne);
  useEffect(() => { setF(ligne); }, [ligne]);
  if (!ligne || !f) return null;
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));
  const total = Math.round((Number(String(f.quantity).replace(",", ".")) || 0) * (Number(String(f.unit_cost_ht).replace(",", ".")) || 0) * 100) / 100;
  const ok = f.label?.trim() && f.prestataire_id && f.unit_cost_ht !== "" && Number(f.quantity) > 0;
  const enregistrer = async () => {
    const corps = { label: f.label, prestataire_id: f.prestataire_id, quantity: f.quantity, unit_cost_ht: f.unit_cost_ht, performed_at: f.performed_at, notes: f.notes || "" };
    try {
      if (f.id) await API.prestataires.modifierPrestation(f.id, corps); else await API.prestataires.ajouterPrestation(corps);
      notify(f.id ? "Prestation modifiée" : "Prestation ajoutée : elle figurera dans le prochain relevé", "success"); onSaved();
    } catch (e) { notify(e.message, "error"); }
  };
  return (<Modal open onClose={onClose} title={f.id ? "Modifier la prestation" : "Ajouter une prestation"} sub="Due au prestataire, reprise dans son prochain relevé">
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
      <div><label style={lab}>DATE</label><Input type="date" value={f.performed_at || ""} onChange={set("performed_at")} /></div>
      <div><label style={lab}>PRESTATAIRE</label>
        <select data-testid="saisie-prestataire" value={f.prestataire_id || ""} onChange={set("prestataire_id")} style={{ ...sel, height: 40 }}>
          <option value="">Choisir…</option>{actifs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
    </div>
    <div style={{ marginBottom: 10 }}><label style={lab}>PRESTATION</label>
      <Input data-testid="saisie-libelle" value={f.label} onChange={set("label")} placeholder="Ex : Lavage de vitres" disabled={f.source === "retouche"} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
      <div><label style={lab}>QUANTITÉ</label><Input type="number" step="1" min="0" value={f.quantity} onChange={set("quantity")} /></div>
      <div><label style={lab}>PRIX UNITAIRE HT (€)</label><Input data-testid="saisie-prix" type="number" step="0.5" min="0" value={f.unit_cost_ht ?? ""} onChange={set("unit_cost_ht")} /></div>
    </div>
    <div style={{ marginBottom: 12 }}><label style={lab}>REMARQUE</label><Input value={f.notes || ""} onChange={set("notes")} placeholder="Facultatif" /></div>
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: C.primaryLight, marginBottom: 12, fontSize: 13, fontWeight: 700 }}>
      <span>Total HT</span><span style={{ color: C.primary }}>{eur(total)}</span></div>
    <Btn data-testid="saisie-enregistrer" onClick={enregistrer} disabled={!ok} style={{ width: "100%", height: 42, background: C.primary }}><Save size={14} /> Enregistrer</Btn>
  </Modal>);
}

// ══ Releves emis ══
function OngletReleves({ prestas, notify }) {
  const [pid, setPid] = useState("");
  const [liste, setListe] = useState(null);
  useEffect(() => {
    setListe(null);
    API.prestataires.releves(pid ? { prestataire_id: pid } : {}).then(l => setListe(l || [])).catch(e => { setListe([]); notify(e.message, "error"); });
  }, [pid]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (<div style={carte}>
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>Relevés émis</div>
      <select value={pid} onChange={e => setPid(e.target.value)} style={{ ...sel, width: 220 }}>
        <option value="">Tous les prestataires</option>{(prestas || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
    {liste === null ? <div style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 12 }}>Chargement…</div>
      : !liste.length ? <div style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 12 }}>Aucun relevé émis.</div>
      : <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr><th style={th}>N°</th><th style={th}>Généré le</th><th style={th}>Prestataire</th><th style={{ ...th, textAlign: "right" }}>Prestations</th>
          <th style={{ ...th, textAlign: "right" }}>Total HT</th><th style={{ ...th, textAlign: "right" }}>Total TTC</th><th style={th} /></tr></thead>
        <tbody>{liste.map(r => (<tr key={r.id} data-testid={`releve-${r.releve_number}`}>
          <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{r.releve_number}</td><td style={td}>{date(r.created_at)}</td>
          <td style={td}>{r.prestataire_name}</td><td style={num}>{r.line_count}</td><td style={num}>{eur(r.total_ht)}</td>
          <td style={{ ...num, fontWeight: 700 }}>{eur(r.total_ttc)}</td>
          <td style={{ ...td, textAlign: "right" }}><Btn variant="outline" onClick={() => ouvrirReleve(r.id, notify)} style={{ fontSize: 11, padding: "4px 10px" }}><FileText size={12} /> Ouvrir / PDF</Btn></td>
        </tr>))}</tbody></table></div>}
  </div>);
}

// ══ Statistiques : par prestataire et type, sur la periode ══
function OngletStats() {
  const [periode, setPeriode] = useState("mois");
  const [du, setDu] = useState(() => bornesPeriode("mois")[0]);
  const [au, setAu] = useState(() => bornesPeriode("mois")[1]);
  const [rows, setRows] = useState(null);
  const [erreur, setErreur] = useState("");
  const choisir = (id) => { setPeriode(id); const b = bornesPeriode(id); if (b) { setDu(b[0]); setAu(b[1]); } };
  useEffect(() => {
    setRows(null); setErreur("");
    API.prestataires.stats({ from: du, to: au }).then(r => setRows(r?.rows || [])).catch(e => { setRows([]); setErreur(e.message); });
  }, [du, au]);
  const groupes = useMemo(() => {
    const m = new Map();
    for (const r of rows || []) { const k = r.prestataire_name; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    return [...m.entries()];
  }, [rows]);
  const somme = (lst, k) => lst.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const puce = (a) => ({ padding: "0 12px", minHeight: 32, borderRadius: 8, border: `1.5px solid ${a ? C.primary : C.border}`, background: a ? C.primary : "transparent", color: a ? "#fff" : C.text, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });
  return (<div style={carte} data-testid="prestataires-stats">
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
      {PERIODES.map(p => <button key={p.id} onClick={() => choisir(p.id)} style={puce(periode === p.id)}>{p.l}</button>)}</div>
    {periode === "perso" && <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
      <label style={lab}>DU<Input type="date" value={du} max={au || undefined} onChange={e => setDu(e.target.value)} style={{ height: 34, marginTop: 3 }} /></label>
      <label style={lab}>AU<Input type="date" value={au} min={du || undefined} onChange={e => setAu(e.target.value)} style={{ height: 34, marginTop: 3 }} /></label></div>}
    {erreur && <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#FEF2F2", color: "#B91C1C", fontSize: 12 }}>{erreur}</div>}
    {rows === null ? <div style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 12 }}>Calcul…</div>
      : !rows.length ? <div style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 12 }}>Aucune prestation sur cette période.</div>
      : <>
        <div data-testid="stats-total" style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
          <b style={{ color: C.text }}>{somme(rows, "nombre")} prestation(s)</b> · {eur(somme(rows, "total_ht"))} HT · {eur(somme(rows, "total_ttc"))} TTC achetés
          {somme(rows, "vendu_ttc") > 0 && <> · retouches vendues {eur(somme(rows, "vendu_ttc"))} TTC</>}</div>
        <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={th}>Prestation</th><th style={{ ...th, textAlign: "right" }}>Nombre</th><th style={{ ...th, textAlign: "right" }}>P.U. HT</th>
            <th style={{ ...th, textAlign: "right" }}>Total HT</th><th style={{ ...th, textAlign: "right" }}>Total TTC</th><th style={{ ...th, textAlign: "right" }}>Vendu TTC</th></tr></thead>
          <tbody>{groupes.map(([nom, lst]) => (<React.Fragment key={nom}>
            <tr><td colSpan={6} style={{ ...td, fontWeight: 800, background: C.surfaceAlt }}>{nom}
              <span style={{ fontWeight: 600, color: C.textMuted }}> — {somme(lst, "nombre")} prestation(s), {eur(somme(lst, "total_ttc"))} TTC</span></td></tr>
            {lst.map(r => (<tr key={nom + r.label}>
              <td style={td}>{r.label}{r.a_affecter > 0 && <span style={{ color: C.warn, fontSize: 10 }}> ({r.a_affecter} sans prix)</span>}</td>
              <td style={num}>{qte(r.nombre)}</td><td style={num}>{r.prix_unitaire_ht != null ? eur(r.prix_unitaire_ht) : "—"}</td>
              <td style={num}>{eur(r.total_ht)}</td><td style={{ ...num, fontWeight: 700 }}>{eur(r.total_ttc)}</td>
              <td style={{ ...num, color: C.textMuted }}>{Number(r.vendu_ttc) ? eur(r.vendu_ttc) : "—"}</td></tr>))}
          </React.Fragment>))}</tbody></table></div>
      </>}
  </div>);
}

// ══ Fiches prestataires ══
function OngletFiches({ prestas, notify, recharger }) {
  const [fiche, setFiche] = useState(null);
  const set = (k) => (e) => setFiche(f => ({ ...f, [k]: e.target.value }));
  const enregistrer = async () => {
    const corps = { ...fiche }; delete corps.id;
    ["store_id", "created_at", "updated_at", "a_emettre_count", "a_emettre_ht", "dernier_releve"].forEach(k => delete corps[k]);
    try {
      if (fiche.id) await API.prestataires.update(fiche.id, corps); else await API.prestataires.create(corps);
      notify(`Prestataire ${fiche.name} enregistré`, "success"); setFiche(null); recharger();
    } catch (e) { notify(e.message, "error"); }
  };
  return (<div style={carte}>
    <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>Fiches prestataires</div>
      <Btn data-testid="nouveau-prestataire" onClick={() => setFiche({ ...FICHE_VIDE })} style={{ background: C.primary, height: 34, fontSize: 12 }}><Plus size={13} /> Nouveau prestataire</Btn></div>
    {!(prestas || []).length ? <div style={{ fontSize: 12, color: C.textMuted }}>Aucune fiche.</div>
      : <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr><th style={th}>Nom</th><th style={th}>Contact</th><th style={th}>Téléphone</th><th style={th}>N° TVA</th><th style={{ ...th, textAlign: "right" }}>TVA</th><th style={th} /></tr></thead>
        <tbody>{prestas.map(p => (<tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
          <td style={{ ...td, fontWeight: 700 }}>{p.name}{!p.active && " (retiré)"}</td><td style={td}>{p.contact || "—"}</td><td style={td}>{p.phone || "—"}</td>
          <td style={td}>{p.vat_number || "—"}</td><td style={num}>{Number(p.tva_rate)} %</td>
          <td style={{ ...td, textAlign: "right" }}><Btn variant="ghost" onClick={() => setFiche({ ...p, tva_rate: Number(p.tva_rate) })} style={{ padding: "2px 8px" }}><Pencil size={13} /></Btn></td>
        </tr>))}</tbody></table></div>}

    <Modal open={!!fiche} onClose={() => setFiche(null)} title={fiche?.id ? `Prestataire ${fiche?.name}` : "Nouveau prestataire"}>
      {fiche && <>
        <div style={{ marginBottom: 10 }}><label style={lab}>NOM / RAISON SOCIALE</label><Input data-testid="fiche-nom" value={fiche.name} onChange={set("name")} placeholder="Ex : Atelier de couture" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><label style={lab}>CONTACT</label><Input value={fiche.contact || ""} onChange={set("contact")} placeholder="Nom de la personne" /></div>
          <div><label style={lab}>TÉLÉPHONE</label><Input value={fiche.phone || ""} onChange={set("phone")} /></div></div>
        <div style={{ marginBottom: 10 }}><label style={lab}>ADRESSE</label>
          <textarea value={fiche.address || ""} onChange={set("address")} rows={2}
            style={{ width: "100%", padding: 8, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 12, fontFamily: "inherit", resize: "vertical" }} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><label style={lab}>E-MAIL</label><Input value={fiche.email || ""} onChange={set("email")} /></div>
          <div><label style={lab}>N° TVA INTRACOMMUNAUTAIRE</label><Input value={fiche.vat_number || ""} onChange={set("vat_number")} /></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><label style={lab}>TVA FACTURÉE PAR LE PRESTATAIRE (%)</label>
            <Input data-testid="fiche-tva" type="number" step="0.1" min="0" value={fiche.tva_rate} onChange={set("tva_rate")} />
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>0 % s'il n'est pas assujetti (auto-entrepreneur en franchise).</div></div>
          {fiche.id && <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 18 }}>
            <input type="checkbox" checked={fiche.active} onChange={e => setFiche(f => ({ ...f, active: e.target.checked }))} /> Prestataire actif</label>}
        </div>
        <div style={{ marginBottom: 12 }}><label style={lab}>NOTES</label><Input value={fiche.notes || ""} onChange={set("notes")} /></div>
        <Btn data-testid="fiche-enregistrer" onClick={enregistrer} disabled={!fiche.name?.trim()} style={{ width: "100%", height: 42, background: C.primary }}><Save size={14} /> Enregistrer</Btn>
      </>}
    </Modal>
  </div>);
}
