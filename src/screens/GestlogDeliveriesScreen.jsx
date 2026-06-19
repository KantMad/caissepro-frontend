import React, { useState, useEffect } from "react";
import { Truck, AlertTriangle, CheckCircle2, RefreshCw, Clock } from "lucide-react";
import { C } from "../constants.jsx";
import { Btn, Badge } from "../ui.jsx";
import * as API from "../api.js";

function StatCard({ label, value, color }) {
  return (<div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: "-0.5px" }}>{value}</div>
  </div>);
}

function GestlogDeliveriesScreen() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const d = await API.integrations.gestlogDeliveries();
      setDeliveries(Array.isArray(d) ? d : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const totalPieces = deliveries.reduce((s, d) => s + (d.total_quantity || 0), 0);
  const withIssues = deliveries.filter(d => (d.unmatched_eans || []).length > 0).length;

  return (<div style={{ height: "100%", overflowY: "auto", padding: "var(--pad,24px)", background: C.bg }}>
    {/* Header */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center" }}><Truck size={22} color={C.primary} /></div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.4px" }}>Livraisons gestlog</h2>
          <p style={{ fontSize: 12, color: C.textMuted, margin: "2px 0 0" }}>Réceptions automatiques de stock depuis gestlog</p>
        </div>
      </div>
      <Btn variant="outline" onClick={load} disabled={loading}><RefreshCw size={14} /> Actualiser</Btn>
    </div>

    {/* Résumé */}
    {!loading && !error && deliveries.length > 0 && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 18 }}>
        <StatCard label="Livraisons reçues" value={deliveries.length} color={C.primary} />
        <StatCard label="Pièces entrées en stock" value={totalPieces} color={C.info} />
        <StatCard label="Avec EAN non reconnus" value={withIssues} color={withIssues > 0 ? C.warn : "#059669"} />
      </div>
    )}

    {/* États */}
    {loading && <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
      <span className="spin-loader" style={{ borderColor: `${C.primary}33`, borderTopColor: C.primary }} />
      <div style={{ marginTop: 10, fontSize: 13 }}>Chargement des livraisons…</div></div>}
    {error && <div style={{ padding: 16, borderRadius: 12, background: C.dangerLight, color: C.danger, fontSize: 13, fontWeight: 600 }}>Erreur : {error}</div>}
    {!loading && !error && deliveries.length === 0 && (
      <div style={{ textAlign: "center", padding: "60px 20px", color: C.textLight }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: C.surfaceAlt, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Truck size={28} style={{ opacity: 0.4 }} /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Aucune livraison reçue</div>
        <div style={{ fontSize: 12 }}>Les livraisons envoyées par gestlog apparaîtront ici automatiquement.</div>
      </div>
    )}

    {/* Liste des livraisons */}
    {!loading && !error && deliveries.length > 0 && (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {deliveries.map(d => {
          const issues = d.unmatched_eans || [];
          const ok = issues.length === 0;
          return (<div key={d.delivery_id} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, boxShadow: `0 1px 3px ${C.shadow}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: ok ? "#05966910" : C.warnLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {ok ? <CheckCircle2 size={18} color="#059669" /> : <AlertTriangle size={18} color={C.warn} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.delivery_id}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
                    <Clock size={10} />{d.received_at ? new Date(d.received_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    {d.supplier ? ` · ${d.supplier}` : ""}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Badge color={C.primary}>{d.matched_lines}/{d.total_lines} lignes</Badge>
                <Badge color={C.info}>{d.total_quantity} pièces</Badge>
                {ok ? <Badge color="#059669">OK</Badge> : <Badge color={C.warn}>{issues.length} à corriger</Badge>}
              </div>
            </div>

            {issues.length > 0 && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: C.warnLight, border: `1px solid ${C.warn}22` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 6 }}>EAN non appliqués (infos produit insuffisantes) :</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {issues.map((it, i) => (<div key={i} style={{ fontSize: 11, color: "#92400E", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{it.ean || "—"}</span>
                    <span style={{ color: C.textMuted }}>{it.reason}{it.missing && it.missing.length ? ` — manque : ${it.missing.join(", ")}` : ""}</span>
                  </div>))}
                </div>
              </div>
            )}
          </div>);
        })}
      </div>
    )}
  </div>);
}

export default GestlogDeliveriesScreen;
export { GestlogDeliveriesScreen };
