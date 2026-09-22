import React, { useState, useMemo } from "react";
import { TrendingUp, ShoppingBag, Package, CreditCard, Users as UsersIcon } from "lucide-react";
import { useApp } from "../context.jsx";
import { C } from "../constants.jsx";
import { formatAmount, getPaymentLabel, getDateField, aggregatePaymentsByMethod, salesIndex, ticketPieces } from "../lib/formatters.js";

// ════════════════════════════════════════════════════════════
//  Résumé — vue stats simplifiée, pensée téléphone (gros chiffres).
//  Réutilise les tickets du contexte (mêmes totaux que Statistiques),
//  filtrés par période. Exclut le mode formation.
// ════════════════════════════════════════════════════════════
const ttcOf = (t) => t.totalTTC || parseFloat(t.total_ttc) || 0;
const isTraining = (t) => t.trainingMode || String(t.ticketNumber || t.ticket_number || "").match(/^(FACTICE|FORMATION)/);
const dayStr = (d) => d.toISOString().split("T")[0];

export default function MobileStatsScreen() {
  const { tickets, currentStore } = useApp();
  const [period, setPeriod] = useState("today");

  const fT = useMemo(() => {
    const now = new Date();
    const today = dayStr(now);
    const d7 = new Date(now); d7.setDate(d7.getDate() - 6); const from7 = dayStr(d7);
    const ym = today.slice(0, 7);
    return (tickets || []).filter((t) => {
      if (isTraining(t)) return false;
      const ds = getDateField(t).split("T")[0];
      if (!ds) return false;
      if (period === "today") return ds === today;
      if (period === "7d") return ds >= from7;
      return ds.slice(0, 7) === ym; // mois
    });
  }, [tickets, period]);

  const ca = useMemo(() => fT.reduce((s, t) => s + ttcOf(t), 0), [fT]);
  const nb = fT.length;
  const panier = nb ? ca / nb : 0;
  const articles = useMemo(() => fT.reduce((s, t) => s + ticketPieces(t), 0), [fT]);

  const pays = useMemo(() => {
    const agg = aggregatePaymentsByMethod(fT);
    return Object.entries(agg).filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]);
  }, [fT]);

  const topProd = useMemo(() => {
    const m = {};
    fT.forEach((t) => (t.items || []).forEach((i) => {
      const n = i.product?.name || i.product_name || "?";
      if (!m[n]) m[n] = { name: n, qty: 0, rev: 0 };
      m[n].qty += parseInt(i.quantity) || 0;
      m[n].rev += (i.lineTTC || i.line_ttc || 0);
    }));
    return Object.values(m).sort((a, b) => b.rev - a.rev).slice(0, 5);
  }, [fT]);

  const bySeller = useMemo(() => {
    const m = {};
    fT.forEach((t) => {
      const n = t.sellerName || t.seller_name || t.userName || t.user_name || "—";
      if (!m[n]) m[n] = { name: n, ca: 0, nb: 0 };
      m[n].ca += ttcOf(t); m[n].nb++;
    });
    return Object.values(m).sort((a, b) => b.ca - a.ca);
  }, [fT]);

  const periods = [{ id: "today", l: "Aujourd'hui" }, { id: "7d", l: "7 jours" }, { id: "month", l: "Ce mois" }];
  const kpi = (icon, label, value, sub) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.textMuted, fontSize: 11, fontWeight: 600 }}>{icon}{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginTop: 4, letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, WebkitOverflowScrolling: "touch" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 40px" }}>
        <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{currentStore?.name || "Résumé"}</div>

        {/* Sélecteur de période */}
        <div style={{ display: "flex", gap: 6, margin: "12px 0 16px", background: C.surfaceAlt, padding: 4, borderRadius: 12 }}>
          {periods.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{
              flex: 1, padding: "9px 6px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: 12, fontWeight: 700, transition: "all .15s",
              background: period === p.id ? C.primary : "transparent", color: period === p.id ? "#fff" : C.textMuted,
            }}>{p.l}</button>
          ))}
        </div>

        {/* CA en grand */}
        <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, borderRadius: 20, padding: 20, color: "#fff", boxShadow: `0 8px 24px -10px ${C.primary}` }}>
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><TrendingUp size={14} /> Chiffre d'affaires TTC</div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1.5px", marginTop: 4, lineHeight: 1 }}>{formatAmount(ca)}€</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>{nb} vente{nb > 1 ? "s" : ""} · panier moyen {formatAmount(panier)}€</div>
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          {kpi(<ShoppingBag size={13} />, "Ventes", nb, `${articles} pièce${articles > 1 ? "s" : ""}`)}
          {kpi(<Package size={13} />, "Indice de vente", salesIndex(fT).toFixed(2), "pièces par ticket")}
        </div>

        {/* Règlements */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><CreditCard size={15} /> Règlements</div>
          {pays.length === 0 ? <div style={{ fontSize: 12, color: C.textLight }}>Aucun encaissement sur la période.</div> :
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pays.map(([m, v]) => {
                const pct = ca > 0 ? Math.round((v / ca) * 100) : 0;
                return (
                  <div key={m} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{getPaymentLabel(m)}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{formatAmount(v)}€</span>
                    </div>
                    <div style={{ height: 6, background: C.surfaceAlt, borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: C.primary, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>}
        </div>

        {/* Top produits */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Package size={15} /> Top ventes</div>
          {topProd.length === 0 ? <div style={{ fontSize: 12, color: C.textLight }}>Aucune vente sur la période.</div> :
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              {topProd.map((p, idx) => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderTop: idx ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, background: C.primaryLight, color: C.primary, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{p.qty} vendu{p.qty > 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text, whiteSpace: "nowrap" }}>{formatAmount(p.rev)}€</div>
                </div>
              ))}
            </div>}
        </div>

        {/* Par vendeur */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><UsersIcon size={15} /> Par vendeur</div>
          {bySeller.length === 0 ? <div style={{ fontSize: 12, color: C.textLight }}>—</div> :
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              {bySeller.map((s, idx) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderTop: idx ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{s.nb} vente{s.nb > 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text, whiteSpace: "nowrap" }}>{formatAmount(s.ca)}€</div>
                </div>
              ))}
            </div>}
        </div>
      </div>
    </div>
  );
}
