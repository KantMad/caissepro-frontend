import React, { useState, useEffect } from "react";
import { Wallet, RefreshCw, Printer, LockOpen, Lock } from "lucide-react";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { Btn, Input, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";

export default function RegisterSessionsScreen() {
  const { notify, thermalPrint, settings, currentStore } = useApp();
  const firstOfMonth = new Date(); firstOfMonth.setDate(1);
  const [from, setFrom] = useState(firstOfMonth.toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 500 };
      if (from) params.from = from + "T00:00:00";
      if (to) params.to = to + "T23:59:59";
      if (status) params.status = status;
      const data = await API.settings.registerSessions(params);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) { notify("Chargement échoué: " + e.message, "danger"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [from, to, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtDT = (d) => d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
  const num = (v) => v == null ? null : parseFloat(v);
  const storeName = (s) => s.store_name || currentStore?.name || settings?.name;

  const printOpen = async (s) => {
    try { await thermalPrint("register-open", { openingAmount: num(s.opening_amount) || 0, openDate: s.opened_at, userName: s.user_name, storeName: storeName(s) }); notify("Ticket d'ouverture envoyé", "success"); }
    catch (e) { notify(e.message, "danger"); }
  };
  const printClose = async (s) => {
    if (s.status !== "closed") { notify("Session encore ouverte", "warn"); return; }
    try {
      await thermalPrint("register-close", {
        openDate: s.opened_at, closeDate: s.closed_at, openingAmount: num(s.opening_amount) || 0,
        actualCash: num(s.closing_cash), actualCard: num(s.closing_card), userName: s.user_name, storeName: storeName(s),
      });
      notify("Ticket de fermeture envoyé", "success");
    } catch (e) { notify(e.message, "danger"); }
  };

  const openCount = rows.filter(r => r.status === "open").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Wallet size={22} color={C.primary} />
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Ouvertures &amp; fermetures de caisse</h2>
        <Btn variant="outline" onClick={load} disabled={loading} style={{ marginLeft: "auto", gap: 6 }}><RefreshCw size={14} /> Actualiser</Btn>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div><label style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 3 }}>Du</label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 160 }} /></div>
        <div><label style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 3 }}>Au</label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 160 }} /></div>
        <div><label style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 3 }}>Statut</label>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ height: 40, borderRadius: 10, border: `1.5px solid ${C.border}`, padding: "0 10px", fontFamily: "inherit", background: C.surface }}>
            <option value="">Tous</option><option value="open">Ouvertes</option><option value="closed">Fermées</option></select></div>
        {openCount > 0 && <div style={{ marginLeft: "auto" }}><Badge color="#059669">{openCount} caisse(s) ouverte(s)</Badge></div>}
      </div>

      <div style={{ background: C.surface, borderRadius: 14, padding: 12, border: `1.5px solid ${C.border}` }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", color: C.textMuted, padding: 30 }}>{loading ? "Chargement…" : "Aucune session sur cette période"}</div>
        ) : (
          <table className="rtable" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {["Ouverture", "Caissier", "Fond", "Fermeture", "Espèces comptées", "CB comptées", "Statut", ""].map(h => (
                <th key={h} style={{ padding: 8, textAlign: "left", fontSize: 10, fontWeight: 700, color: C.textMuted }}>{h}</th>))}</tr></thead>
            <tbody>{rows.map((s, i) => {
              const closed = s.status === "closed";
              return (<tr key={s.id || i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td data-label="Ouverture" style={{ padding: 8, whiteSpace: "nowrap" }}>{fmtDT(s.opened_at)}</td>
                <td data-label="Caissier" style={{ padding: 8 }}>{s.user_name || "?"}</td>
                <td data-label="Fond" style={{ padding: 8, fontWeight: 700 }}>{(num(s.opening_amount) || 0).toFixed(2)}€</td>
                <td data-label="Fermeture" style={{ padding: 8, whiteSpace: "nowrap" }}>{closed ? fmtDT(s.closed_at) : <span style={{ color: "#059669", fontWeight: 700 }}>Ouverte</span>}</td>
                <td data-label="Espèces comptées" style={{ padding: 8 }}>{s.closing_cash != null ? `${num(s.closing_cash).toFixed(2)}€` : "—"}</td>
                <td data-label="CB comptées" style={{ padding: 8 }}>{s.closing_card != null ? `${num(s.closing_card).toFixed(2)}€` : "—"}</td>
                <td data-label="Statut" style={{ padding: 8 }}>{closed ? <Badge color={C.textMuted}>Fermée</Badge> : <Badge color="#059669">Ouverte</Badge>}</td>
                <td data-label="" style={{ padding: 8, whiteSpace: "nowrap" }}>
                  <Btn variant="ghost" onClick={() => printOpen(s)} style={{ padding: "4px 6px" }} title="Réimprimer le ticket d'ouverture"><LockOpen size={13} /></Btn>
                  {closed && <Btn variant="ghost" onClick={() => printClose(s)} style={{ padding: "4px 6px" }} title="Réimprimer le ticket de fermeture"><Lock size={13} /></Btn>}
                </td>
              </tr>);
            })}</tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8 }}>Les icônes <LockOpen size={10} style={{ verticalAlign: "middle" }} />/<Lock size={10} style={{ verticalAlign: "middle" }} /> réimpriment le ticket d'ouverture / de fermeture. Le ticket de fermeture affiche le contrôle de caisse (fond, espèces comptées) ; le détail des ventes est sur le ticket de clôture Z.</div>
    </div>
  );
}
