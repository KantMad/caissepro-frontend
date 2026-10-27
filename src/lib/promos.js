// ════════════════════════════════════════════════════════════
//  Calcul des remises promotionnelles (logique métier pure)
//  Extrait de context.jsx pour être testable et réutilisable.
//  Renvoie { promoDisc (HT, plafonné au total HT), applied (libellés) }.
// ════════════════════════════════════════════════════════════

import { lineNetTTC } from "./totals.js";

// Regles (corrigees le 27/10/2026) :
//  - base = ce que le client doit REELLEMENT pour la ligne (remises de ligne % et EUR comprises,
//    via lineNetTTC) — avant, la remise EUR de ligne etait ignoree (promo calculee sur un prix trop haut) ;
//  - promo en EUR = montant applique UNE fois sur l'ensemble des articles concernes, TTC en mode
//    TTC (prix affiches) — avant, HT et par ligne (-10 EUR sur 3 articles = -36 EUR TTC) ;
//  - pas de cumul de promos en % sur un meme article : la meilleure s'applique ;
//  - promos panier (quantite, code) appliquees sur le reste apres les promos ciblees.
// La remise panier manuelle (% puis EUR) s'applique ENSUITE, sur le reste (lib/totals.js).
export function calcPromoDiscount(cartItems, activePromos, opts = {}) {
  const pm = opts.pricingMode || "TTC";
  const promoCode = opts.promoCode || "";
  const items = cartItems || [];
  const promos = activePromos || [];

  const rate = (ci) => ci.product.taxRate ?? 0.20;
  const ligne = (ci) => ({ price: ci.product.price, quantity: ci.quantity, taxRate: ci.product.taxRate,
    discount: ci.discount, discountType: ci.discountType, discountPercent: ci.discountPercent, discountAmount: ci.discountAmount });
  const netTTC = (ci) => lineNetTTC(ligne(ci), pm);
  const getHT = (ci) => netTTC(ci) / (1 + rate(ci));
  const estMontant = (p) => (p.discount_type || p.discountType || "percent") === "amount";
  // Montant EUR saisi -> HT : TTC en mode TTC, au prorata des taux des articles concernes
  const montantHT = (p, lignes) => {
    const v = parseFloat(p.value) || 0;
    if (pm !== "TTC") return v;
    const ht = lignes.reduce((s, ci) => s + getHT(ci), 0), ttc = lignes.reduce((s, ci) => s + netTTC(ci), 0);
    return ttc > 0 ? v * ht / ttc : 0;
  };

  const applied = [];
  const matchItems = (ci, t, tt, tv, col) => {
    if (t === "category_discount" || tt === "category") return (ci.product.category || "").toLowerCase() === tv;
    if (t === "sku_discount" || tt === "sku") return (ci.product.sku || "").toLowerCase() === tv;
    if (t === "color_discount" || tt === "color") return (ci.variant?.color || "").toLowerCase() === tv;
    if (t === "collection_discount" || tt === "collection") return (ci.product.collection || "").toLowerCase() === (col || tv);
    if (t === "low_stock_discount" || tt === "low_stock") {
      const stock = ci.variant?.stock ?? ci.product.stock ?? 999;
      return stock <= (parseInt(tv) || 5) && stock > 0;
    }
    return false;
  };
  const libelleLigne = (p, tt, ci, d) => tt === "low_stock"
    ? `${p.name}: -${d.toFixed(2)}€ HT sur ${ci.product.name} (stock: ${ci.variant?.stock ?? ci.product.stock})`
    : tt === "color" ? `${p.name}: -${d.toFixed(2)}€ HT sur ${ci.product.name} (${ci.variant?.color})`
    : `${p.name}: -${d.toFixed(2)}€ HT sur ${ci.product.name}`;

  // 1) Promos CIBLEES : meilleure promo % par ligne, promos EUR une fois chacune
  const meilleure = new Map();   // index de ligne -> { d, label }
  let ciblesEUR = 0;
  promos.forEach((p) => {
    const t = p.promo_type || p.type;
    const tt = p.target_type || p.targetType;
    const tv = (p.target_value || p.targetValue || "").toLowerCase();
    const col = (p.collection || "").toLowerCase();
    const minQ = parseInt(p.min_qty || p.minQty) || 0;
    if (!(["category_discount", "sku_discount", "color_discount", "collection_discount", "low_stock_discount"].includes(t) ||
        ["category", "sku", "color", "collection", "low_stock"].includes(tt))) return;
    const idx = items.map((ci, k) => (matchItems(ci, t, tt, tv, col) ? k : -1)).filter((k) => k >= 0);
    if (!idx.length) return;
    if (minQ > 0 && idx.reduce((s, k) => s + items[k].quantity, 0) < minQ) return;
    if (estMontant(p)) {
      const lignes = idx.map((k) => items[k]);
      const d = Math.min(montantHT(p, lignes), lignes.reduce((s, ci) => s + getHT(ci), 0));
      if (d > 0) { ciblesEUR += d; applied.push(`${p.name}: -${d.toFixed(2)}€ HT`); }
    } else {
      idx.forEach((k) => {
        const d = getHT(items[k]) * ((parseFloat(p.value) || 0) / 100);
        const cur = meilleure.get(k);
        if (!cur || d > cur.d) meilleure.set(k, { d, label: libelleLigne(p, tt, items[k], d) });
      });
    }
  });
  meilleure.forEach((m) => applied.push(m.label));
  const totalHT = items.reduce((s, ci) => s + getHT(ci), 0);
  let promoDisc = Math.min(totalHT, [...meilleure.values()].reduce((s, m) => s + m.d, 0) + ciblesEUR);

  // 2) Promos PANIER (quantite, code) sur le reste
  promos.forEach((p) => {
    const t = p.promo_type || p.type;
    const minQ = parseInt(p.min_qty || p.minQty) || 0;
    const reste = Math.max(0, totalHT - promoDisc);
    const appliquer = (label) => {
      const d = estMontant(p) ? Math.min(montantHT(p, items), reste) : reste * ((parseFloat(p.value) || 0) / 100);
      if (d > 0) { promoDisc += d; applied.push(`${label}: -${d.toFixed(2)}€ HT`); }
    };
    if (t === "qty_discount") {
      if (items.reduce((s, i) => s + i.quantity, 0) >= (minQ || 3)) appliquer(p.name);
    } else if (t === "code" && promoCode && p.code && promoCode.toUpperCase() === p.code.toUpperCase()) {
      appliquer(`Code ${p.code}`);
    }
  });

  return { promoDisc: Math.min(promoDisc, totalHT), applied };
}
