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
    // Détails du Z (backend) — défauts sûrs pour le chemin hors-ligne
    byPaymentCount: c.byPaymentCount ?? {},
    tvaByRate: c.tvaByRate ?? [],
    bySeller: c.bySeller ?? {},
    byCategory: c.byCategory ?? [],
    discounts: c.discounts ?? null,
    cancellations: c.cancellations ?? null,
    returns: c.returns ?? null,
    itemCount: num(c.itemCount),
    avgItemsPerSale: num(c.avgItemsPerSale),
    avgBasketHT: num(c.avgBasketHT),
    avgBasketTTC: num(c.avgBasketTTC),
    date: c.date ?? c.created_at,
    userName: c.userName ?? c.user_name,
  };
};

// ── Détail monnaie (coupures) → liste ordonnée pour l'affichage/impression ──
// denom = { "50": 2, "20": 3, ... } → [{ label:"50€", count:2, value:50, total:100 }, ...]
export const formatDenominations = (denom) => {
  if (!denom || typeof denom !== "object") return [];
  return Object.entries(denom)
    .filter(([, n]) => (parseInt(n) || 0) > 0)
    .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
    .map(([v, n]) => {
      const value = parseFloat(v), count = parseInt(n) || 0;
      return { value, count, total: Math.round(value * count * 100) / 100, label: value >= 5 ? `${v}€` : `${(value * 100).toFixed(0)}c` };
    });
};

// ── Commission vendeur (sur le HT) bornée par plancher/plafond ──
// raw = baseHT × taux ; commission = clamp(raw, plancher, plafond).
// cap=0 → pas de plafond. floor=0 → pas de plancher.
export const computeCommission = (baseHT, rate, floor = 0, cap = 0) => {
  const raw = (Number(baseHT) || 0) * (Number(rate) || 0);
  const f = Number(floor) || 0, c = Number(cap) || 0;
  let commission = raw;
  if (c > 0) commission = Math.min(commission, c);
  commission = Math.max(commission, f);
  const r2 = (v) => Math.round(v * 100) / 100;
  return { raw: r2(raw), commission: r2(commission), capped: c > 0 && raw > c, floored: raw < f };
};

// ── Indice de vente (UPT) : pièces vendues par ticket ──
// Pièces = quantités des articles catalogue ; les lignes « divers » (retouches,
// articles libres) ne sont pas des pièces et sont exclues.
export const ticketPieces = (t) =>
  ((t && t.items) || []).reduce((s, i) => (i.isCustom || i.is_custom) ? s : s + (parseInt(i.quantity) || 0), 0);
export const salesIndex = (tickets) => {
  const list = tickets || [];
  if (!list.length) return 0;
  return Math.round((list.reduce((s, t) => s + ticketPieces(t), 0) / list.length) * 100) / 100;
};

// ── Remise ligne en euros, pour l'affichage ticket ──
// Dérivée du brut (prix unitaire HT × (1+TVA) × qté) moins le net (lineTTC réellement payé).
// Marche pour remise en % ou en €, sur ticket live ET réimprimé (les données backend
// n'exposent pas le champ `discount`, seulement unit_price HT + line_ttc net).
export const lineDiscountEuro = (item) => {
  if (!item) return 0;
  const qty = Number(item.quantity) || 1;
  const tax = Number(item.tax_rate ?? item.taxRate ?? (item.product && item.product.taxRate) ?? 0.20);
  const unitHT = Number(item.unit_price ?? item.unitPrice ?? 0);
  const net = Number(item.lineTTC ?? item.line_ttc ?? 0);
  if (!unitHT || net <= 0) return 0; // données partielles → pas de fausse remise
  const gross = unitHT * (1 + tax) * qty;
  const d = Math.round((gross - net) * 100) / 100;
  // seuil : 1 centime par piece = arrondi du HT stocke, pas une remise
  return d > 0.011 * qty ? d : 0;
};

// Remise globale du ticket, exprimee en TTC (ce que le client a economise).
// En base, `global_discount` est un montant HT (create_sale la retire du HT) :
// l'afficher tel quel sur un ticket sous-evalue la remise. On la recalcule donc
// depuis les lignes brutes : somme des lignes - (HT + TVA) du ticket.
export const globalDiscountTTC = (ticket) => {
  if (!ticket) return 0;
  const items = ticket.items || [];
  const sum = items.reduce((s, i) => s + (Number(i.lineTTC ?? i.line_ttc) || 0), 0);
  const net = (Number(ticket.totalHT ?? ticket.total_ht) || 0) + (Number(ticket.totalTVA ?? ticket.total_tva) || 0);
  const d = Math.round((sum - net) * 100) / 100;
  if (sum > 0 && d > 0.011) return d;
  // Repli : pas de lignes disponibles -> valeur HT enregistree
  return Math.round((Number(ticket.globalDiscount ?? ticket.global_discount) || 0) * 100) / 100;
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
