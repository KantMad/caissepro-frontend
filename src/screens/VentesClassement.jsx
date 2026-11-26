import React, { useState, useEffect, useMemo, useRef } from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { Input } from "../ui.jsx";
import { useApp } from "../context.jsx";
import { dayKey, rangeToInstants } from "../lib/dates.js";
import { sortSizes } from "./_shared.js";

// Stock > Ventes (MCS 24/11/2026) : recap des produits vendus, filtrable par période, catégorie et
// sous-catégorie, du plus vendu au moins vendu (en quantité). Tableau produit x couleur, une
// colonne par taille. Calcul SERVEUR (/api/sales/stats/classement : toutes les ventes de la
// période, articles libres exclus) ; ici on range seulement les lignes en grille.

// Lignes serveur (une par variante) -> groupes produit, chacun avec ses couleurs et ses tailles.
// Produits classés par quantité vendue totale, couleurs par quantité dans le produit.
export function grilleVentes(rows, ordre = "desc") {
  const sens = ordre === "asc" ? 1 : -1;
  const produits = new Map();
  const tailles = new Set();
  for (const r of rows || []) {
    const qte = Number(r.sold) || 0;
    if (!qte) continue;
    const taille = r.size || "TU", couleur = r.color || "—";
    tailles.add(taille);
    let p = produits.get(r.product_id);
    if (!p) { p = { id: r.product_id, nom: r.product_name || "", sku: r.sku || "", total: 0, ca: 0, retours: 0, couleurs: new Map() }; produits.set(r.product_id, p); }
    let c = p.couleurs.get(couleur);
    if (!c) { c = { couleur, parTaille: {}, total: 0, ca: 0 }; p.couleurs.set(couleur, c); }
    c.parTaille[taille] = (c.parTaille[taille] || 0) + qte;
    c.total += qte; c.ca += Number(r.revenue_ttc) || 0;
    p.total += qte; p.ca += Number(r.revenue_ttc) || 0; p.retours += Number(r.returned) || 0;
  }
  const liste = [...produits.values()].map(p => ({ ...p,
    couleurs: [...p.couleurs.values()].sort((a, b) => sens * (a.total - b.total) || a.couleur.localeCompare(b.couleur, "fr")) }))
    .sort((a, b) => sens * (a.total - b.total) || a.nom.localeCompare(b.nom, "fr"));
  const tot = liste.reduce((a, p) => ({ qte: a.qte + p.total, ca: a.ca + p.ca, retours: a.retours + p.retours }), { qte: 0, ca: 0, retours: 0 });
  return { produits: liste, tailles: [...tailles].sort(sortSizes), total: tot };
}

export const PERIODES = [
  { id: "jour", l: "Aujourd'hui" }, { id: "7j", l: "7 jours" }, { id: "mois", l: "Ce mois" },
  { id: "moisPrec", l: "Mois dernier" }, { id: "annee", l: "Cette année" }, { id: "perso", l: "Dates…" },
];
export function bornesPeriode(id) {
  const n = new Date();
  const k = (y, m, d) => dayKey(new Date(y, m, d));
  switch (id) {
    case "jour": return [dayKey(n), dayKey(n)];
    case "7j": return [k(n.getFullYear(), n.getMonth(), n.getDate() - 6), dayKey(n)];
    case "mois": return [k(n.getFullYear(), n.getMonth(), 1), dayKey(n)];
    case "moisPrec": return [k(n.getFullYear(), n.getMonth() - 1, 1), k(n.getFullYear(), n.getMonth(), 0)];
    case "annee": return [k(n.getFullYear(), 0, 1), dayKey(n)];
    default: return null;
  }
}
const eur = (v) => (Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export default function VentesClassement() {
  const { products, allCategories } = useApp();
  const [periode, setPeriode] = useState("mois");
  const [du, setDu] = useState(() => bornesPeriode("mois")[0]);
  const [au, setAu] = useState(() => bornesPeriode("mois")[1]);
  const [categorie, setCategorie] = useState("");
  const [sousCategorie, setSousCategorie] = useState("");
  const [ordre, setOrdre] = useState("desc");
  const [res, setRes] = useState(null);
  const [etat, setEtat] = useState("charge");
  const [erreur, setErreur] = useState("");
  const dernier = useRef(0);

  const choisirPeriode = (id) => { setPeriode(id); const b = bornesPeriode(id); if (b) { setDu(b[0]); setAu(b[1]); } };
  // Sous-catégories proposées : celles des produits de la catégorie choisie
  const sousCategories = useMemo(() => [...new Set((products || [])
    .filter(p => p.subcategory && (!categorie || p.category === categorie)).map(p => p.subcategory))]
    .sort((a, b) => a.localeCompare(b, "fr")), [products, categorie]);
  useEffect(() => { if (sousCategorie && !sousCategories.includes(sousCategorie)) setSousCategorie(""); }, [sousCategories, sousCategorie]);

  useEffect(() => {
    const n = ++dernier.current;
    setEtat("charge"); setErreur("");
    const params = { ...rangeToInstants(du, au) };
    if (categorie) params.category = categorie;
    if (sousCategorie) params.subcategory = sousCategorie;
    API.sales.classement(params)
      .then(r => { if (n === dernier.current) { setRes(r || { rows: [] }); setEtat(""); } })
      .catch(e => { if (n === dernier.current) { setRes(null); setErreur(e.message || "Chargement impossible"); setEtat("erreur"); } });
  }, [du, au, categorie, sousCategorie]);

  const g = useMemo(() => grilleVentes(res?.rows, ordre), [res, ordre]);
  const cats = (allCategories || []).filter(c => c && c !== "Tous");
  const sel = { height: 34, padding: "0 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, fontFamily: "inherit" };
  const puce = (actif) => ({ padding: "0 12px", minHeight: 32, borderRadius: 8, border: `1.5px solid ${actif ? C.primary : C.border}`,
    background: actif ? C.primary : "transparent", color: actif ? "#fff" : C.text, fontSize: 12, fontWeight: 600, cursor: "pointer" });
  const th = { padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, whiteSpace: "nowrap", borderBottom: `1.5px solid ${C.border}`, background: C.surface, position: "sticky", top: 0 };
  const num = { padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

  return (<div data-testid="ventes-classement" style={{ background: C.surface, borderRadius: 14, padding: 16, border: `1.5px solid ${C.border}` }}>
    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Produits vendus</div>

    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
      {PERIODES.map(p => (<button key={p.id} data-testid={`periode-${p.id}`} onClick={() => choisirPeriode(p.id)} style={puce(periode === p.id)}>{p.l}</button>))}
    </div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
      {periode === "perso" && <>
        <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted }}>DU<Input type="date" data-testid="classement-du" value={du} max={au || undefined} onChange={e => setDu(e.target.value)} style={{ height: 34, fontSize: 12, padding: "4px 8px", marginTop: 3 }} /></label>
        <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted }}>AU<Input type="date" data-testid="classement-au" value={au} min={du || undefined} onChange={e => setAu(e.target.value)} style={{ height: 34, fontSize: 12, padding: "4px 8px", marginTop: 3 }} /></label>
      </>}
      <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, display: "flex", flexDirection: "column", gap: 3 }}>CATÉGORIE
        <select data-testid="classement-categorie" value={categorie} onChange={e => { setCategorie(e.target.value); setSousCategorie(""); }} style={sel}>
          <option value="">Toutes</option>
          {cats.map(c => (<option key={c} value={c}>{c}</option>))}
        </select></label>
      <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, display: "flex", flexDirection: "column", gap: 3 }}>SOUS-CATÉGORIE
        <select data-testid="classement-sous-categorie" value={sousCategorie} onChange={e => setSousCategorie(e.target.value)} style={sel} disabled={!sousCategories.length}>
          <option value="">{sousCategories.length ? "Toutes" : "Aucune renseignée"}</option>
          {sousCategories.map(c => (<option key={c} value={c}>{c}</option>))}
        </select></label>
      <button data-testid="classement-ordre" onClick={() => setOrdre(o => o === "desc" ? "asc" : "desc")}
        style={{ ...puce(false), minHeight: 34, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {ordre === "desc" ? <ArrowDownWideNarrow size={15} /> : <ArrowUpNarrowWide size={15} />}
        {ordre === "desc" ? "Plus vendus d'abord" : "Moins vendus d'abord"}</button>
    </div>

    {etat === "charge" && <div style={{ padding: 24, textAlign: "center", color: C.textMuted, fontSize: 12 }}>Calcul des ventes…</div>}
    {etat === "erreur" && <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#FEF2F2", color: "#B91C1C", fontSize: 12 }}>{erreur}</div>}
    {etat === "" && !g.produits.length && <div data-testid="classement-vide" style={{ padding: 24, textAlign: "center", color: C.textMuted, fontSize: 12 }}>
      Aucun produit vendu sur cette période{categorie ? ` dans « ${categorie}${sousCategorie ? ` > ${sousCategorie}` : ""} »` : ""}.</div>}
    {etat === "" && g.produits.length > 0 && <>
      <div data-testid="classement-total" style={{ fontSize: 12, marginBottom: 8, color: C.textMuted }}>
        <b style={{ color: C.text }}>{g.total.qte} article(s) vendu(s)</b> · {g.produits.length} produit(s) · {eur(g.total.ca)} TTC
        {g.total.retours > 0 && <> · {g.total.retours} retourné(s) sur la période</>}
        {res?.truncated && <span style={{ color: C.warn || "#B45309", fontWeight: 600 }}> · liste limitée : resserrez la période ou choisissez une catégorie</span>}
      </div>
      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 330px)", border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", fontSize: 12 }}>
          <thead><tr>
            <th style={{ ...th, textAlign: "right", width: 34 }}>#</th>
            <th style={{ ...th, textAlign: "left", minWidth: 180 }}>Produit</th>
            <th style={{ ...th, textAlign: "left" }}>Couleur</th>
            {g.tailles.map(t => (<th key={t} style={{ ...th, textAlign: "right", minWidth: 38 }}>{t}</th>))}
            <th style={{ ...th, textAlign: "right" }}>Total</th>
            <th style={{ ...th, textAlign: "right" }}>CA TTC</th>
          </tr></thead>
          <tbody>
            {g.produits.map((p, i) => p.couleurs.map((c, j) => (
              <tr key={`${p.id}|${c.couleur}`} data-testid={j === 0 ? `classement-produit-${i + 1}` : undefined}>
                <td style={{ ...num, color: C.textMuted, borderTop: j === 0 && i > 0 ? `1px solid ${C.border}` : "none" }}>{j === 0 ? i + 1 : ""}</td>
                <td style={{ padding: "7px 10px", borderTop: j === 0 && i > 0 ? `1px solid ${C.border}` : "none" }}>
                  {j === 0 && <><div style={{ fontWeight: 700 }}>{p.nom}</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>{p.sku}{p.couleurs.length > 1 ? ` · ${p.total} vendu(s) en tout` : ""}</div></>}</td>
                <td style={{ padding: "7px 10px", borderTop: j === 0 && i > 0 ? `1px solid ${C.border}` : "none" }}>{c.couleur}</td>
                {g.tailles.map(t => (<td key={t} style={{ ...num, color: c.parTaille[t] ? C.text : C.border, borderTop: j === 0 && i > 0 ? `1px solid ${C.border}` : "none" }}>{c.parTaille[t] || "·"}</td>))}
                <td style={{ ...num, fontWeight: 800, borderTop: j === 0 && i > 0 ? `1px solid ${C.border}` : "none" }}>{c.total}</td>
                <td style={{ ...num, color: C.textMuted, borderTop: j === 0 && i > 0 ? `1px solid ${C.border}` : "none" }}>{eur(c.ca)}</td>
              </tr>)))}
          </tbody>
        </table>
      </div>
    </>}
  </div>);
}
