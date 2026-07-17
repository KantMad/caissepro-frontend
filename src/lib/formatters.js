// ════════════════════════════════════════════════════════════
//  Helpers de formatage & normalisation (purs, testables)
//  Centralisent des patterns dupliqués dans context/screens/print.
// ════════════════════════════════════════════════════════════

// ── Montant ──
export const formatAmount = (v) => {
  const n = Number(v);
  return isNaN(n) ? "0.00" : n.toFixed(2);
};

// ── Libellés des méthodes de paiement ──
export const PAYMENT_LABELS = {
  short: { cash: "ESP", card: "CB", amex: "AMEX", giftcard: "CAD", cheque: "CHQ", avoir: "AVOIR", contactless: "SC" },
  full: { cash: "Espèces", card: "CB", amex: "American Express", contactless: "Sans-contact", giftcard: "Cadeau", cheque: "Chèque", avoir: "Avoir", MIXTE: "Mixte", exchange: "Échange" },
  refund: { cash: "Espèces", card: "Carte bancaire", avoir: "Avoir client", exchange: "Échange" },
};
export const getPaymentLabel = (method, variant = "full") =>
  (PAYMENT_LABELS[variant] || PAYMENT_LABELS.full)[method] || method;

// ── Avoirs : solde restant ──
// Solde courant d'un avoir : `remaining` si fourni, sinon le total.
export const getAvoirRemaining = (avoir) => {
  if (avoir == null) return 0;
  if (avoir.remaining != null) return Number(avoir.remaining) || 0;
  return Number(avoir.totalTTC ?? avoir.total_ttc ?? avoir.amount ?? 0) || 0;
};
// Vrai si l'avoir a été partiellement consommé (solde < total).
export const isAvoirPartiallyUsed = (avoir) => {
  if (avoir == null) return false;
  const total = Number(avoir.totalTTC ?? avoir.total_ttc ?? 0) || 0;
  const rem = getAvoirRemaining(avoir);
  return rem < total - 0.001;
};

// ── Dates ──
export const getTodayDate = () => new Date().toISOString().split("T")[0];
export const getDateField = (obj) => (obj && (obj.date || obj.createdAt || obj.created_at)) || "";
export const filterByToday = (items) => {
  const today = getTodayDate();
  return (items || []).filter((i) => getDateField(i).startsWith(today));
};

// ── Clôtures : normalisation snake_case (backend) → camelCase ──
// Le backend renvoie ticket_count/total_ttc/... ; les écrans et l'impression
// attendent du camelCase. Sans ça, le ticket de fermeture affiche 0 partout.
export const normClosure = (c) => {
  if (!c) return c;
  const num = (...vals) => { for (const v of vals) if (v != null) return Number(v) || 0; return 0; };
  return {
    ...c,
    type: c.type ?? c.closure_type,
    ticketCount: num(c.ticketCount, c.ticket_count),
    totalHT: num(c.totalHT, c.total_ht),
    totalTVA: num(c.totalTVA, c.total_tva),
    totalTTC: num(c.totalTTC, c.total_ttc),
    totalMargin: num(c.totalMargin, c.total_margin),
    grandTotal: num(c.grandTotal, c.grand_total),
    expectedCash: num(c.expectedCash, c.expected_cash),
    actualCash: c.actualCash ?? c.actual_cash ?? null,
    actualCard: c.actualCard ?? c.actual_card ?? null,
    cashIn: num(c.cashIn, c.cash_in),
    cashOut: num(c.cashOut, c.cash_out),
    byPayment: c.byPayment ?? {},
    date: c.date ?? c.created_at,
    userName: c.userName ?? c.user_name,
  };
};

// ── Agrégation des paiements par méthode (clôtures, stats) ──
export const PAYMENT_METHODS = ["cash", "card", "cheque", "giftcard", "amex", "avoir"];
export const aggregatePaymentsByMethod = (tickets) => {
  const out = {};
  for (const m of PAYMENT_METHODS) {
    out[m] = (tickets || []).reduce(
      (s, t) => s + ((t.payments || []).filter((p) => p.method === m).reduce((a, p) => a + (Number(p.amount) || 0), 0)),
      0
    );
  }
  return out;
};
