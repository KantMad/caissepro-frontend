// ════════════════════════════════════════════════════════════
//  Calcul des totaux panier — NF525
//  TTC = référence (somme des prix réellement payés).
//  HT et TVA sont DÉRIVÉS du TTC par groupe de taux, ce qui garantit
//  HT + TVA = TTC au centime près (pas de dérive d'arrondi ligne par ligne).
//  Source unique utilisée par cartTotals (aperçu) ET _doCheckout (vente).
//
//  ATTENTION (avoir) : tHT/tTVA décrivent l'ASSIETTE TAXABLE des biens vendus
//  (= netTTC, avant avoir) — c'est la valeur fiscale de la vente (le backend
//  enregistre bien cette valeur pleine). tTTC, lui, est le MONTANT DÛ = netTTC
//  − avoirPayment (un avoir est un moyen de paiement, pas une réduction
//  d'assiette). Donc quand un avoir sert de paiement : tHT + tTVA = netTTC ≠ tTTC.
//  L'aperçu panier (SalesScreen, FE-03) réduit proportionnellement HT/TVA affichés
//  pour la cohérence visuelle ; la donnée fiscale reste la valeur pleine.
// ════════════════════════════════════════════════════════════

export const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// ── Remises cumulables (24/09/2026) ──
// Une ligne comme le panier acceptent MAINTENANT les deux à la fois :
//   1) le pourcentage s'applique d'abord,
//   2) la remise en euros s'applique sur ce qu'il reste.
// La remise en euros est exprimée en **TTC** (ce que le client économise réellement)
// et porte sur la LIGNE entière, pas sur chaque article.
// L'ancienne forme { discount, discountType:"amount"|"percent" } reste acceptée
// (paniers suspendus, promos, tickets déjà enregistrés).

/** Remises d'une ligne, quelle que soit la forme reçue → { pct, amtTTC } */
export function lineDiscounts(i = {}) {
  const pct = Number(i.discountPercent ?? (i.discountType === "amount" ? 0 : i.discount)) || 0;
  let amtTTC = Number(i.discountAmount) || 0;
  // Ancienne forme : "amount" = euros PAR ARTICLE
  if (!i.discountAmount && i.discountType === "amount") amtTTC = (Number(i.discount) || 0) * (i.quantity || 1);
  return { pct: Math.max(0, Math.min(100, pct)), amtTTC: Math.max(0, amtTTC) };
}

/** Total TTC réellement payé pour une ligne (remises cumulées appliquées) */
export function lineNetTTC(i, pricingMode = "TTC") {
  const rate = i.taxRate || 0.20;
  const qty = i.quantity || 0;
  const { pct, amtTTC } = lineDiscounts(i);
  const brut = (i.price || 0) * qty * (1 - pct / 100);
  const brutTTC = pricingMode === "TTC" ? brut : brut * (1 + rate);
  return round2(Math.max(0, brutTTC - amtTTC));
}

/**
 * @param {Array} lines  - [{ price, quantity, taxRate, discountPercent, discountAmount }]
 *   price = prix unitaire (TTC si pricingMode "TTC", sinon HT)
 *   discountAmount = euros TTC sur la ligne entière
 * @param {Object} opts  - { pricingMode, gDiscPct, gDiscAmt, promoDisc, avoirPayment }
 *   gDiscAmt = remise panier en euros TTC ; gDiscPct en % ; les deux se cumulent.
 *   (formes anciennes gDisc/gDiscType encore acceptées)
 * @returns {{sHT, gd, gdTTC, tHT, tTVA, tTTC}} — gd est la remise globale en **HT**
 *   (valeur attendue par create_sale), gdTTC est ce que le client économise.
 */
export function computeTotals(lines, opts = {}) {
  const pm = opts.pricingMode || "TTC";
  // Remise panier : nouvelle forme (gDiscPct + gDiscAmt) ou ancienne (gDisc + gDiscType)
  const legacyPct = opts.gDiscType === "amount" ? 0 : Number(opts.gDisc) || 0;
  const legacyAmt = opts.gDiscType === "amount" ? Number(opts.gDisc) || 0 : 0;
  const gPct = Math.max(0, Math.min(100, Number(opts.gDiscPct ?? legacyPct) || 0));
  const gAmt = Math.max(0, Number(opts.gDiscAmt ?? legacyAmt) || 0);
  const promoDisc = Number(opts.promoDisc) || 0;
  const avoirPayment = Number(opts.avoirPayment) || 0;

  if (!lines || !lines.length) return { sHT: 0, gd: 0, gdTTC: 0, tHT: 0, tTVA: 0, tTTC: 0 };

  // Ligne TTC réelle (prix payé, remises de ligne cumulées) + taux
  const computed = lines.map((i) => ({ rate: i.taxRate || 0.20, lineTTC: lineNetTTC(i, pm) }));

  // Sous-total (avant remise globale)
  const sHT = round2(computed.reduce((s, l) => s + l.lineTTC / (1 + l.rate), 0));
  const sTTC = round2(computed.reduce((s, l) => s + l.lineTTC, 0));

  // Remise globale : % d'abord, puis euros TTC sur le reste, puis promos (HT).
  const afterPct = round2(sTTC * (1 - gPct / 100));
  const netTTCBeforePromo = Math.max(0, round2(afterPct - gAmt));
  let gdTTC = round2(sTTC - netTTCBeforePromo);
  // Les promos sont calculées en HT : on les convertit au prorata du panier.
  const ttcPerHT = sHT > 0 ? sTTC / sHT : 1;
  gdTTC = Math.min(sTTC, round2(gdTTC + promoDisc * ttcPerHT));
  const discountRatio = sTTC > 0 ? gdTTC / sTTC : 0;
  const gd = round2(sHT * discountRatio);   // valeur HT enregistrée en base

  // HT/TVA dérivés du TTC, par groupe de taux → HT+TVA = TTC exact
  const groups = {};
  for (const l of computed) groups[l.rate] = round2((groups[l.rate] || 0) + l.lineTTC);
  let tHT = 0, tTVA = 0, netTTC = 0;
  for (const rk of Object.keys(groups)) {
    const rate = parseFloat(rk);
    const gNet = round2(groups[rk] * (1 - discountRatio));
    const gHT = round2(gNet / (1 + rate));
    tHT = round2(tHT + gHT);
    tTVA = round2(tTVA + (gNet - gHT));
    netTTC = round2(netTTC + gNet);
  }
  const tTTC = Math.max(0, round2(netTTC - avoirPayment));

  return { sHT, gd, gdTTC, tHT, tTVA, tTTC };
}
