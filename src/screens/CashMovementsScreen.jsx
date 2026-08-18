import React, { useState, useEffect } from "react";
import { Wallet, Download, ArrowDownCircle, ArrowUpCircle, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { Btn, Input, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";
import { formatDenominations } from "../lib/formatters.js";

export default function CashMovementsScreen() {
  const { notify } = useApp();
  const firstOfMonth = new Date(); firstOfMonth.setDate(1);
  const [from, setFrom] = useState(firstOfMonth.toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [kind, setKind] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 1000 };
      if (from) params.from = from + "T00:00:00";
      if (to) params.to = to + "T23:59:59";
      if (kind) params.kind = kind;
      const data = await API.cashMovements.list(params);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) { notify("Chargement échoué: " + e.message, "danger"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [from, to, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const kindLabel = (m) => m.kind === "transfer" ? "Transfert de fond" : (m.direction === "in" ? "Apport" : "Prélèvement");
  const denomStr = (m) => formatDenominations(m.denominations).map(d => `${d.count}×${d.label}`).join(" + ");
  const totalIn = rows.filter(r => r.direction === "in").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalOut = rows.filter(r => r.direction === "out").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const exportXLSX = () => {
    if (!rows.length) { notify("Aucun mouvement à exporter", "warn"); return; }
    const data = rows.map(m => ({
      "Date": new Date(m.created_at || m.date).toLocaleString("fr-FR"),
      "N°": m.movement_number || "",
      "Type": kindLabel(m),
      "Sens": m.direction === "in" ? "Entrée" : "Sortie",
      "Montant (€)": parseFloat(m.amount) || 0,
      "Motif": m.reason || "",
      "Détail monnaie": denomStr(m),
      "Opérateur": m.user_name || "",
      "Code-barres": m.barcode || "",
      "Empreinte NF525": m.hash ? m.hash.slice(0, 16).toUpperCase() : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 15 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mouvements caisse");
    XLSX.writeFile(wb, `tiroir-caisse_${from}_au_${to}.xlsx`);
    notify("Export Excel généré", "success");
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Wallet size={22} color={C.primary} />
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Tiroir-caisse — Mouvements & transferts de fond</h2>
        <Btn variant="primary" onClick={exportXLSX} style={{ marginLeft: "auto", gap: 6 }}><Download size={15} /> Export Excel</Btn>
        <Btn variant="outline" onClick={load} disabled={loading} style={{ gap: 6 }}><RefreshCw size={14} /> Actualiser</Btn>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div><label style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 3 }}>Du</label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 160 }} /></div>
        <div><label style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 3 }}>Au</label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 160 }} /></div>
        <div><label style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 3 }}>Type</label>
          <select value={kind} onChange={e => setKind(e.target.value)} style={{ height: 40, borderRadius: 10, border: `1.5px solid ${C.border}`, padding: "0 10px", fontFamily: "inherit", background: C.surface }}>
            <option value="">Tous</option><option value="transfer">Transferts de fond</option><option value="standard">Apports / prélèvements</option></select></div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 13 }}>
          <span style={{ color: "#059669", fontWeight: 700 }}>Entrées +{totalIn.toFixed(2)}€</span>
          <span style={{ color: C.danger, fontWeight: 700 }}>Sorties -{totalOut.toFixed(2)}€</span>
        </div>
      </div>

      <div style={{ background: C.surface, borderRadius: 14, padding: 12, border: `1.5px solid ${C.border}` }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", color: C.textMuted, padding: 30 }}>{loading ? "Chargement…" : "Aucun mouvement sur cette période"}</div>
        ) : (
          <table className="rtable" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {["Date", "N°", "Type", "Montant", "Motif", "Détail monnaie", "Opérateur", "Empreinte"].map(h => (
                <th key={h} style={{ padding: 8, textAlign: "left", fontSize: 10, fontWeight: 700, color: C.textMuted }}>{h}</th>))}</tr></thead>
            <tbody>{rows.map((m, i) => {
              const isIn = m.direction === "in"; const isTransfer = m.kind === "transfer";
              return (<tr key={m.id || i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td data-label="Date" style={{ padding: 8, whiteSpace: "nowrap" }}>{new Date(m.created_at || m.date).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td data-label="N°" style={{ padding: 8, fontFamily: "monospace", fontSize: 10 }}>{m.movement_number}</td>
                <td data-label="Type" style={{ padding: 8 }}>{isTransfer ? <Badge color={C.fiscal}>Transfert</Badge> : (isIn ? <Badge color="#059669">Apport</Badge> : <Badge color={C.danger}>Prélèvement</Badge>)}</td>
                <td data-label="Montant" style={{ padding: 8, fontWeight: 800, color: isIn ? "#059669" : C.danger, whiteSpace: "nowrap" }}>{isIn ? "+" : "-"}{(parseFloat(m.amount) || 0).toFixed(2)}€</td>
                <td data-label="Motif" style={{ padding: 8 }}>{m.reason}</td>
                <td data-label="Détail monnaie" style={{ padding: 8, fontSize: 10, color: C.textMuted }}>{denomStr(m) || "—"}</td>
                <td data-label="Opérateur" style={{ padding: 8 }}>{m.user_name || "?"}</td>
                <td data-label="Empreinte" style={{ padding: 8, fontFamily: "monospace", fontSize: 9, color: C.fiscal }}>{m.hash ? m.hash.slice(0, 16).toUpperCase() : "—"}</td>
              </tr>);
            })}</tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8 }}>Mouvements immuables (NF525). Les transferts de fond incluent le détail des coupures. Export Excel = période + filtre appliqués.</div>
    </div>
  );
}
