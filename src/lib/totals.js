// ════════════════════════════════════════════════════════════
//  Calcul des totaux panier — NF525
//  TTC = référence (somme des prix réellement payés).
//  HT et TVA sont DÉRIVÉS du TTC par groupe de taux, ce qui garantit
//  HT + TVA = TTC au centime près (pas de dérive d'arrondi ligne par ligne).
//  Source unique utilisée par cartTotals (aperçu) ET _doCheckout (vente).
// ════════════════════════════════════════════════════════════

export const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * @param {Array} lines  - [{ price, quantity, taxRate, discount, discountType }]
 *   price = prix unitaire (TTC si pricingMode "TTC", sinon HT)
 *   discountType = "amount" (remise € par unité) | "percent"/autre (remise %)
 * @param {Object} opts  - { pricingMode, gDisc, gDiscType, promoDisc, avoirPayment }
 * @returns {{sHT:number, gd:number, tHT:number, tTVA:number, tTTC:number}}
 */
export function computeTotals(lines, opts = {}) {
  const pm = opts.pricingMode || "TTC";
  const gDisc = Number(opts.gDisc) || 0;
  const gDiscType = opts.gDiscType || "percentage";
  const promoDisc = Number(opts.promoDisc) || 0;
  const avoirPayment = Number(opts.avoirPayment) || 0;

  if (!lines || !lines.length) return { sHT: 0, gd: 0, tHT: 0, tTVA: 0, tTTC: 0 };

  // Ligne TTC réelle (prix payé) + taux
  const computed = lines.map((i) => {
    const rate = i.taxRate || 0.20;
    const qty = i.quantity || 0;
    const raw = i.discountType === "amount"
      ? i.price * qty - ((i.discount || 0) * qty)
      : i.price * qty * (1 - (i.discount || 0) / 100);
    const lineTTC = round2(pm === "TTC" ? raw : raw * (1 + rate));
    return { rate, lineTTC };
  });

  // Sous-total HT indicatif (avant remise globale)
  const sHT = round2(computed.reduce((s, l) => s + l.lineTTC / (1 + l.rate), 0));

  // Remise globale (HT) + promos
  let gd = gDiscType === "percentage" ? round2(sHT * (gDisc / 100)) : Math.min(gDisc, sHT);
  gd = round2(gd + promoDisc);
  gd = Math.min(gd, sHT);
  const discountRatio = sHT > 0 ? gd / sHT : 0;

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

  return { sHT, gd, tHT, tTVA, tTTC };
}
