import React, { useState, useEffect, useRef } from "react";
import { Tag, Search, Printer, Trash2, Plus, ScanLine, Package } from "lucide-react";
import { C } from "../constants.jsx";
import { Btn, Input, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";
import * as API from "../api.js";
import { LABEL_FORMATS, printLabels, isValidEAN13, EAN13Svg, labelSize } from "../utils.jsx";

// ════════════════════════════════════════════════════════════
//  Étiquettes code-barres — planche imprimée via le navigateur
//  (pilote de l'étiqueteuse : Zebra, Dymo, Brother, TSC…).
//  Le code-barres est un VRAI EAN-13, identique à celui des tickets.
//  La recherche passe par l'API : le catalogue complet n'est plus en mémoire.
// ════════════════════════════════════════════════════════════
function LabelsScreen() {
  const { settings, notify, findByEAN, addAudit, perm, saveSettingsToAPI, setSettings } = useApp();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(null);          // produit ouvert
  const [lines, setLines] = useState([]);        // [{key, productName, sku, color, colorCode, size, ean, price, qty}]
  // Reglages repris du magasin (chaque boutique a son etiqueteuse et ses rouleaux)
  const [format, setFormat] = useState(settings?.labelFormat || "40x30");
  const [dim, setDim] = useState({ w: settings?.labelWidth || 40, h: settings?.labelHeight || 30 });
  const [mode, setMode] = useState(settings?.labelMode || "roll");
  const [opts, setOpts] = useState(settings?.labelFields || { name: true, colorSize: true, sku: true, price: false });
  const scanRef = useRef(null);

  const canPrint = perm().canCreateProduct || perm().canExport;

  // Recherche produits (debounce) — même endpoint que la grille de vente
  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setBusy(true);
      try { setResults(await API.products.list({ search: q.trim(), limit: 40 }) || []); }
      catch (e) { notify("Recherche impossible : " + e.message, "error"); }
      finally { setBusy(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, notify]);

  const addLine = (p, v, qty = 1) => {
    if (!isValidEAN13(v.ean)) { notify(`${p.name} ${v.color}/${v.size} : pas de code-barres valide`, "warn"); return; }
    setLines(prev => {
      const key = v.id || v.ean;
      const hit = prev.find(l => l.key === key);
      if (hit) return prev.map(l => l.key === key ? { ...l, qty: l.qty + qty } : l);
      return [...prev, { key, productName: p.name, sku: p.sku, color: v.color,
        colorCode: v.colorCode || v.color_code, size: v.size, ean: v.ean, price: p.price, qty }];
    });
  };

  // Scan : ajoute directement la déclinaison scannée
  const onScan = async (code) => {
    const c = String(code || "").trim();
    if (!c) return;
    try {
      // mémoire d'abord, puis le serveur (le catalogue complet n'est plus chargé côté caisse)
      let hit = findByEAN(c);
      if (!hit) {
        // l'API renvoie le produit A PLAT avec les champs de la variante (variant_id, color, size…)
        const r = await API.products.findByEAN(c).catch(() => null);
        if (r?.ean) hit = { product: { name: r.name, sku: r.sku, price: Number(r.price) },
          variant: { id: r.variant_id, color: r.color, colorCode: r.color_code, size: r.size, ean: r.ean, stock: r.stock } };
      }
      if (hit) { addLine(hit.product, hit.variant); notify(`${hit.product.name} ajouté`, "success"); }
      else notify("Code-barres inconnu", "warn");
    } catch (e) { notify("Recherche impossible : " + e.message, "error"); }
  };

  const total = lines.reduce((s, l) => s + (l.qty || 0), 0);

  const printOpts = () => ({ format, width: dim.w, height: dim.h, mode, ...opts, pricingMode: settings?.pricingMode });

  const saveDefaults = async () => {
    const next = { ...settings, labelFormat: format, labelWidth: dim.w, labelHeight: dim.h, labelMode: mode, labelFields: opts };
    try { setSettings(next); await saveSettingsToAPI(next); notify("Réglages d'étiquettes enregistrés pour ce magasin", "success"); }
    catch (e) { notify("Enregistrement impossible : " + e.message, "error"); }
  };

  const doPrint = () => {
    const r = printLabels(lines, printOpts());
    if (r.popupBloque) { notify("Fenêtre bloquée — autorisez les popups pour imprimer", "error"); return; }
    if (!r.count) { notify("Aucune étiquette à imprimer", "warn"); return; }
    addAudit && addAudit("ETIQUETTES", `${r.count} étiquette(s) — ${labelSize({ format, width: dim.w, height: dim.h }).l} — ${mode === "roll" ? "rouleau" : "planche"}`);
    notify(`${r.count} étiquette(s) prêtes à imprimer`, "success");
  };

  if (!canPrint) return <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>Accès réservé aux responsables</div>;

  const box = { background: C.surface, borderRadius: 14, padding: 16, border: `1.5px solid ${C.border}` };

  return (<div style={{ height: "100%", overflowY: "auto", padding: 24, background: C.bg }}>
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.4px", display: "flex", alignItems: "center", gap: 8 }}>
        <Tag size={20} /> Étiquettes code-barres</h2>
      <p style={{ fontSize: 12, color: C.textMuted, margin: "4px 0 0" }}>
        Scannez ou cherchez des articles, choisissez les quantités, puis imprimez la planche avec votre étiqueteuse.</p>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
      {/* ── Colonne gauche : recherche / scan ── */}
      <div style={box}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <ScanLine size={14} style={{ position: "absolute", left: 10, top: 12, color: C.textMuted }} />
            <Input ref={scanRef} placeholder="Scanner un code-barres…" style={{ paddingLeft: 30, height: 38 }}
              onKeyDown={e => { if (e.key === "Enter") { onScan(e.target.value); e.target.value = ""; } }} />
          </div>
        </div>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: C.textMuted }} />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un article (nom ou référence)…"
            style={{ paddingLeft: 30, height: 38 }} />
        </div>

        {busy && <div style={{ fontSize: 11, color: C.textMuted }}>Recherche…</div>}
        {!busy && q && !results.length && <div style={{ fontSize: 11, color: C.textLight }}>Aucun article trouvé</div>}

        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          {results.map(p => (
            <button key={p.id} onClick={() => setSel(sel?.id === p.id ? null : p)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", borderRadius: 8,
                border: "none", background: sel?.id === p.id ? `${C.primary}10` : "transparent", cursor: "pointer",
                textAlign: "left", fontFamily: "inherit", borderBottom: `1px solid ${C.border}` }}>
              <Package size={13} color={C.textMuted} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: C.textMuted }}>{p.sku}</span>
              <Badge color={C.info}>{(p.variants || []).length} décl.</Badge>
            </button>))}
        </div>

        {sel && <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{sel.name}</div>
            <Btn variant="outline" style={{ height: 28, fontSize: 10 }}
              onClick={() => { (sel.variants || []).forEach(v => isValidEAN13(v.ean) && addLine(sel, v, 1)); }}>
              <Plus size={11} /> Tout à 1</Btn>
            <Btn variant="outline" style={{ height: 28, fontSize: 10 }}
              onClick={() => { (sel.variants || []).forEach(v => isValidEAN13(v.ean) && v.stock > 0 && addLine(sel, v, v.stock)); }}
              title="Une étiquette par pièce en stock">
              <Plus size={11} /> Selon le stock</Btn>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {(sel.variants || []).map(v => (
              <div key={v.id || v.ean} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 2px", fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ flex: 1, minWidth: 0 }}>{v.color} / <b>{v.size}</b></span>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: isValidEAN13(v.ean) ? C.textMuted : C.danger }}>
                  {v.ean || "sans code-barres"}</span>
                <span style={{ fontSize: 10, color: C.textLight }}>stock {v.stock}</span>
                <Btn variant="outline" style={{ height: 24, fontSize: 10, padding: "0 8px" }}
                  disabled={!isValidEAN13(v.ean)} onClick={() => addLine(sel, v, 1)}>+</Btn>
              </div>))}
          </div>
        </div>}
      </div>

      {/* ── Colonne droite : planche à imprimer ── */}
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>À imprimer — {total} étiquette{total > 1 ? "s" : ""}</div>
          {lines.length > 0 && <Btn variant="ghost" style={{ height: 26, fontSize: 10, color: C.danger }} onClick={() => setLines([])}>Tout retirer</Btn>}
        </div>

        {!lines.length && <div style={{ textAlign: "center", padding: "24px 0", color: C.textLight, fontSize: 12 }}>
          Scannez un article ou ajoutez-en depuis la recherche.</div>}

        <div style={{ maxHeight: 240, overflowY: "auto" }}>
          {lines.map(l => (
            <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 2px", fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.productName}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>{l.color} / {l.size} · {l.ean}</div>
              </div>
              <Input type="number" min="1" value={l.qty} style={{ width: 62, height: 30, fontSize: 11, textAlign: "center" }}
                onChange={e => { const n = Math.max(0, parseInt(e.target.value) || 0);
                  setLines(p => n === 0 ? p.filter(x => x.key !== l.key) : p.map(x => x.key === l.key ? { ...x, qty: n } : x)); }} />
              <Btn variant="ghost" style={{ height: 26, padding: "0 6px", color: C.danger }}
                onClick={() => setLines(p => p.filter(x => x.key !== l.key))}><Trash2 size={12} /></Btn>
            </div>))}
        </div>

        <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 4 }}>IMPRIMANTE</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            {[["roll", "Rouleau", "1 étiquette par page"], ["sheet", "Planche A4", "plusieurs par page"]].map(([id, l, sub]) => (
              <button key={id} onClick={() => setMode(id)} style={{ padding: "7px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                border: `1.5px solid ${mode === id ? C.primary : C.border}`, background: mode === id ? `${C.primary}08` : "transparent", textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: mode === id ? C.primary : C.text }}>{l}</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>{sub}</div></button>))}
          </div>

          <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 4 }}>FORMAT</label>
          <select value={format} onChange={e => setFormat(e.target.value)}
            style={{ width: "100%", height: 34, fontSize: 11, padding: "0 8px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "inherit", background: C.surface, color: C.text, marginBottom: format === "custom" ? 6 : 10 }}>
            {LABEL_FORMATS.map(f => <option key={f.id} value={f.id}>{f.l}</option>)}
            <option value="custom">Personnalisé…</option>
          </select>
          {format === "custom" && <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
            <Input type="number" min="10" max="210" value={dim.w} onChange={e => setDim(d => ({ ...d, w: e.target.value }))}
              style={{ height: 32, fontSize: 11 }} placeholder="largeur" />
            <span style={{ fontSize: 11, color: C.textMuted }}>×</span>
            <Input type="number" min="10" max="297" value={dim.h} onChange={e => setDim(d => ({ ...d, h: e.target.value }))}
              style={{ height: 32, fontSize: 11 }} placeholder="hauteur" />
            <span style={{ fontSize: 11, color: C.textMuted }}>mm</span>
          </div>}

          <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 4 }}>CONTENU</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            {[["name", "Nom"], ["colorSize", "Couleur / taille"], ["sku", "Référence"], ["price", "Prix"]].map(([k, l]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, cursor: "pointer" }}>
                <input type="checkbox" checked={opts[k]} onChange={e => setOpts(o => ({ ...o, [k]: e.target.checked }))} />{l}</label>))}
          </div>

          {lines[0] && <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: 10, textAlign: "center", background: "#fff" }}>
              <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 4 }}>Aperçu</div>
              {opts.name && <div style={{ fontSize: 10, fontWeight: 700 }}>{lines[0].productName}</div>}
              {opts.colorSize && <div style={{ fontSize: 9, color: "#333" }}>{lines[0].color} / {lines[0].size}</div>}
              {opts.sku && <div style={{ fontSize: 9, fontFamily: "monospace", color: "#555" }}>{lines[0].sku}</div>}
              <EAN13Svg code={lines[0].ean} width={140} height={40} />
              {opts.price && <div style={{ fontSize: 12, fontWeight: 800 }}>{Number(lines[0].price).toFixed(2)}€</div>}
            </div></div>}

          <Btn onClick={doPrint} disabled={!total} style={{ width: "100%", height: 44, background: C.primary, gap: 8 }}>
            <Printer size={16} /> Imprimer {total || ""} étiquette{total > 1 ? "s" : ""}</Btn>
          <Btn variant="outline" onClick={saveDefaults} style={{ width: "100%", height: 34, fontSize: 11, marginTop: 8 }}>
            Enregistrer ces réglages pour ce magasin</Btn>
          <div style={{ fontSize: 10, color: C.textLight, marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
            {mode === "roll"
              ? "Mode rouleau : la page fait la taille de l'étiquette. Dans la fenêtre d'impression, choisissez l'étiqueteuse, marges « aucune » et échelle 100 %."
              : "Mode planche : feuille A4 d'étiquettes à découper ou planches pré-découpées. Marges à zéro, échelle 100 %."}</div>
        </div>
      </div>
    </div>
  </div>);
}

export { LabelsScreen };
export default LabelsScreen;
