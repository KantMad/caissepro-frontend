import React, { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { Btn, Input } from "../ui.jsx";
import { useApp } from "../context.jsx";
import { rangeToInstants } from "../lib/dates.js";

// Statistiques > « Ventes d'un produit » (MCS 16/11/2026) : saisir un nom, une référence ou un EAN
// (ou le scanner) pour voir les quantités vendues sur la période choisie, par taille/couleur.
// Calcul SERVEUR (/api/sales/stats/products) : toutes les ventes de la période, retours déduits.
export default function RechercheVentesProduit({ dateFrom, dateTo }) {
  const { setScanOverride, clearScanOverride } = useApp();
  const [q, setQ] = useState("");
  const [cherche, setCherche] = useState("");
  const [res, setRes] = useState(null);
  const [etat, setEtat] = useState("");   // "", "charge", "erreur"
  const [erreur, setErreur] = useState("");
  const dernier = useRef(0);

  const lancer = (texte) => {
    const t = String(texte ?? q).trim();
    if (t.length < 2) { setErreur("Saisissez au moins 2 caractères (nom, référence ou EAN)"); setEtat("erreur"); return; }
    setCherche(t);
  };
  // Recherche relancée quand la période change
  useEffect(() => {
    if (!cherche) return;
    const n = ++dernier.current;
    setEtat("charge"); setErreur("");
    API.sales.productSales({ q: cherche, ...rangeToInstants(dateFrom, dateTo) })
      .then(r => { if (n === dernier.current) { setRes(r || { rows: [] }); setEtat(""); } })
      .catch(e => { if (n === dernier.current) { setRes(null); setErreur(e.message || "Recherche impossible"); setEtat("erreur"); } });
  }, [cherche, dateFrom, dateTo]);
  // Scanner : pendant que le champ a le focus, un code-barres lance la recherche
  const surFocus = () => { setScanOverride?.(code => { setQ(code); lancer(code); }); };
  const surBlur = () => { clearScanOverride?.(); };
  useEffect(() => () => clearScanOverride?.(), []);   // eslint-disable-line react-hooks/exhaustive-deps

  const lignes = res?.rows || [];
  const tot = lignes.reduce((a, l) => ({ sold: a.sold + (l.sold || 0), returned: a.returned + (l.returned || 0), net: a.net + (l.net || 0),
    ca: a.ca + (Number(l.revenue_ttc) || 0) - (Number(l.refunded_ttc) || 0) }), { sold: 0, returned: 0, net: 0, ca: 0 });
  const j = (k) => String(k).slice(0, 10).split("-").reverse().join("/");   // jour LOCAL (pas de décalage UTC)
  const periode = dateFrom && dateTo ? (dateFrom === dateTo ? `le ${j(dateFrom)}` : `du ${j(dateFrom)} au ${j(dateTo)}`)
    : dateFrom ? `depuis le ${j(dateFrom)}` : dateTo ? `jusqu'au ${j(dateTo)}` : "depuis la mise en service";
  const th = { padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.textMuted, whiteSpace: "nowrap" };
  const num = { padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (<div data-testid="recherche-ventes-produit" style={{ background: C.surface, borderRadius: 14, padding: 14, border: `1.5px solid ${C.border}`, marginBottom: 16 }}>
    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Ventes d'un produit</div>
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 260px" }}>
        <Input value={q} onChange={e => setQ(e.target.value)} onFocus={surFocus} onBlur={surBlur}
          onKeyDown={e => { if (e.key === "Enter") lancer(); }}
          placeholder="Nom du produit, référence ou EAN (ou scannez)" style={{ height: 36, fontSize: 12, padding: "4px 30px 4px 10px", width: "100%" }} />
        {q && <button aria-label="Effacer" onClick={() => { setQ(""); setCherche(""); setRes(null); setEtat(""); setErreur(""); }}
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", padding: 4, color: C.textMuted }}><X size={14} /></button>}
      </div>
      <Btn onClick={() => lancer()} style={{ height: 36, fontSize: 12 }}><Search size={14} /> Rechercher</Btn>
    </div>
    {etat === "erreur" && <div style={{ fontSize: 11, color: C.danger, marginTop: 8 }}>{erreur}</div>}
    {etat === "charge" && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>Recherche…</div>}
    {res && etat !== "charge" && (lignes.length === 0
      ? <div style={{ fontSize: 12, color: C.textMuted, marginTop: 10 }}>Aucune vente pour « {cherche} » {periode}.</div>
      : <div style={{ marginTop: 10 }}>
        <div data-testid="ventes-produit-total" style={{ fontSize: 12, marginBottom: 8 }}>
          « {cherche} » {periode} : <b>{tot.sold} vendu(s)</b>{tot.returned ? <>, {tot.returned} retourné(s), <b>{tot.net} net</b></> : null} — {tot.ca.toFixed(2)}€ TTC
        </div>
        <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr style={{ borderBottom: `2px solid ${C.border}`, position: "sticky", top: 0, background: C.surface }}>
              <th style={th}>Produit</th><th style={th}>Réf.</th><th style={th}>EAN</th><th style={th}>Couleur / Taille</th>
              <th style={{ ...th, textAlign: "right" }}>Vendus</th><th style={{ ...th, textAlign: "right" }}>Retournés</th>
              <th style={{ ...th, textAlign: "right" }}>Net</th><th style={{ ...th, textAlign: "right" }}>CA TTC</th><th style={{ ...th, textAlign: "right" }}>Stock actuel</th></tr></thead>
            <tbody>{lignes.map((l, i) => (<tr key={`${l.variant_id || l.product_name}-${i}`} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "6px 8px", fontWeight: 600 }}>{l.product_name}</td>
              <td style={{ padding: "6px 8px" }}>{l.sku || "—"}</td>
              <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 10 }}>{l.ean || "—"}</td>
              <td style={{ padding: "6px 8px" }}>{[l.color, l.size].filter(Boolean).join(" / ") || "—"}</td>
              <td style={{ ...num, fontWeight: 700 }}>{l.sold}</td>
              <td style={{ ...num, color: l.returned ? C.danger : C.textMuted }}>{l.returned || "—"}</td>
              <td style={{ ...num, fontWeight: 700 }}>{l.net}</td>
              <td style={num}>{((Number(l.revenue_ttc) || 0) - (Number(l.refunded_ttc) || 0)).toFixed(2)}€</td>
              <td style={{ ...num, color: C.textMuted }}>{l.stock ?? "—"}</td></tr>))}</tbody>
          </table></div>
        {res.truncated && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 6 }}>Plus de 500 variantes trouvées : précisez la recherche.</div>}
      </div>)}
  </div>);
}
