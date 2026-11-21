// ════════════════════════════════════════════════════════════
//  Calcul des remises promotionnelles (logique métier pure)
//  Extrait de context.jsx pour être testable et réutilisable.
//  Renvoie { promoDisc (HT, plafonné au total HT), applied (libellés), parLigne (HT par ligne) }.
// ════════════════════════════════════════════════════════════

import { lineNetTTC } from "./totals.js";

// Regles (corrigees le 27/10/2026, completees le 21/11/2026) :
//  - base = ce que le client doit REELLEMENT pour la ligne (remises de ligne % et EUR comprises,
//    via lineNetTTC) — avant, la remise EUR de ligne etait ignoree (promo calculee sur un prix trop haut) ;
//  - promo en EUR = montant applique UNE fois sur l'ensemble des articles concernes, TTC en mode
//    TTC (prix affiches) — avant, HT et par ligne (-10 EUR sur 3 articles = -36 EUR TTC) ;
//  - pas de cumul de promos en % sur un meme article : la meilleure s'applique ;
//  - promos panier (quantite, code) appliquees sur le reste apres les promos ciblees ;
//  - FILTRE DE CATEGORIES (21/11/2026) sur toute promo : categoryMode « all » (toutes),
//    « except » (toutes sauf `categories`), « only » (aucune sauf `categories`) ;
//  - « Remise automatique » (global_discount) : tous les articles retenus par le filtre ;
//  - parLigne : part HT de remise promo de chaque ligne (affichee sur la ligne du panier).
// La remise panier manuelle (% puis EUR) s'applique ENSUITE, sur le reste (lib/totals.js).

export const PROMO_TYPES_CIBLES = ["global_discount", "category_discount", "sku_discount", "color_discount", "collection_discount", "low_stock_discount"];
const CIBLES_TT = ["category", "sku", "color", "collection", "low_stock"];
const bas = (v) => String(v ?? "").trim().toLowerCase();

// Liste des categories d'une promo (tableau pg, JSON ou texte separe par des virgules)
export function categoriesPromo(p) {
  let c = p?.categories ?? p?.category_list ?? [];
  if (typeof c === "string") { try { c = JSON.parse(c); } catch { c = c.replace(/^\{|\}$/g, "").split(","); } }
  return (Array.isArray(c) ? c : []).map((x) => String(x).replace(/^"|"$/g, "").trim()).filter(Boolean);
}
export function modeCategories(p) {
  const m = p?.category_mode || p?.categoryMode || "all";
  return ["except", "only"].includes(m) && categoriesPromo(p).length ? m : "all";
}
// La ligne passe-t-elle le filtre de categories de la promo ?
export function categorieRetenue(p, categorie) {
  const mode = modeCategories(p);
  if (mode === "all") return true;
  const dedans = categoriesPromo(p).map(bas).includes(bas(categorie));
  return mode === "only" ? dedans : !dedans;
}

export function calcPromoDiscount(cartItems, activePromos, opts = {}) {
  const pm = opts.pricingMode || "TTC";
  const promoCode = bas(opts.promoCode);
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
    if (t === "global_discount") return true;
    if (t === "category_discount" || tt === "category") return bas(ci.product.category) === tv;
    if (t === "sku_discount" || tt === "sku") return bas(ci.product.sku) === tv;
    if (t === "color_discount" || tt === "color") return bas(ci.variant?.color) === tv;
    if (t === "collection_discount" || tt === "collection") return bas(ci.product.collection) === (col || tv);
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

  const ht = items.map(getHT);
  const reste = [...ht];   // HT encore du par ligne apres les promos deja appliquees
  // Repartit une remise HT sur des lignes au prorata de ce qu'il en reste
  const repartir = (idx, d) => {
    const base = idx.reduce((s, k) => s + reste[k], 0);
    if (!(base > 0) || !(d > 0)) return 0;
    const dd = Math.min(d, base);
    idx.forEach((k) => { reste[k] = Math.max(0, reste[k] - dd * reste[k] / base); });
    return dd;
  };

  // 1) Promos CIBLEES (dont remise automatique) : meilleure promo % par ligne, promos EUR une fois chacune
  const meilleure = new Map();   // index de ligne -> { d, label }
  const eur = [];
  promos.forEach((p) => {
    const t = p.promo_type || p.type;
    const tt = p.target_type || p.targetType;
    const tv = bas(p.target_value || p.targetValue);
    const col = bas(p.collection);
    const minQ = parseInt(p.min_qty || p.minQty) || 0;
    if (!(PROMO_TYPES_CIBLES.includes(t) || (!t && CIBLES_TT.includes(tt)))) return;
    const idx = items.map((ci, k) => (categorieRetenue(p, ci.product.category) && matchItems(ci, t, tt, tv, col) ? k : -1)).filter((k) => k >= 0);
    if (!idx.length) return;
    if (minQ > 0 && idx.reduce((s, k) => s + items[k].quantity, 0) < minQ) return;
    if (estMontant(p)) eur.push({ p, idx });
    else {
      idx.forEach((k) => {
        const d = ht[k] * ((parseFloat(p.value) || 0) / 100);
        const cur = meilleure.get(k);
        if (!cur || d > cur.d) meilleure.set(k, { d, label: libelleLigne(p, tt, items[k], d) });
      });
    }
  });
  meilleure.forEach((m, k) => { const d = Math.min(m.d, reste[k]); reste[k] -= d; applied.push(m.label); });
  eur.forEach(({ p, idx }) => {
    const d = repartir(idx, montantHT(p, idx.map((k) => items[k])));
    if (d > 0) applied.push(`${p.name}: -${d.toFixed(2)}€ HT`);
  });

  // 2) Promos PANIER (quantite, code) sur le reste des articles retenus par le filtre
  promos.forEach((p) => {
    const t = p.promo_type || p.type;
    if (t !== "qty_discount" && t !== "code") return;
    const minQ = parseInt(p.min_qty || p.minQty) || 0;
    const idx = items.map((ci, k) => (categorieRetenue(p, ci.product.category) ? k : -1)).filter((k) => k >= 0);
    if (!idx.length) return;
    const appliquer = (label) => {
      const base = idx.reduce((s, k) => s + reste[k], 0);
      const voulu = estMontant(p) ? montantHT(p, idx.map((k) => items[k])) : base * ((parseFloat(p.value) || 0) / 100);
      const d = repartir(idx, voulu);
      if (d > 0) applied.push(`${label}: -${d.toFixed(2)}€ HT`);
    };
    if (t === "qty_discount") {
      if (idx.reduce((s, k) => s + items[k].quantity, 0) >= (minQ || 3)) appliquer(p.name);
    } else if (promoCode && p.code && promoCode === bas(p.code)) {
      appliquer(`Code ${String(p.code).toUpperCase()}`);
    }
  });

  const parLigne = ht.map((h, k) => Math.max(0, h - reste[k]));
  const totalHT = ht.reduce((s, h) => s + h, 0);
  return { promoDisc: Math.min(parLigne.reduce((s, d) => s + d, 0), totalHT), applied, parLigne };
}

// Le code saisi correspond-il a une promo « code » active ? (retour visuel dans le panier)
export function codePromoConnu(activePromos, code) {
  const c = bas(code);
  return !!c && (activePromos || []).some((p) => (p.promo_type || p.type) === "code" && bas(p.code) === c);
}

// Nombre d'articles du catalogue concernes par une promo (aide a la saisie : 0 = promo sans effet)
export function articlesConcernes(promo, products) {
  const t = promo.promo_type || promo.type;
  const tv = bas(promo.target_value || promo.targetValue);
  return (products || []).filter((pr) => {
    if (!categorieRetenue(promo, pr.category)) return false;
    if (t === "category_discount") return bas(pr.category) === tv;
    if (t === "sku_discount") return bas(pr.sku) === tv;
    if (t === "collection_discount") return bas(pr.collection) === (bas(promo.collection) || tv);
    if (t === "color_discount") return (pr.variants || []).some((v) => bas(v.color) === tv);
    return true;
  }).length;
}
