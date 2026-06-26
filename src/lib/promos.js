// ════════════════════════════════════════════════════════════
//  Calcul des remises promotionnelles (logique métier pure)
//  Extrait de context.jsx pour être testable et réutilisable.
//  Renvoie { promoDisc (HT, plafonné au total HT), applied (libellés) }.
// ════════════════════════════════════════════════════════════

export function calcPromoDiscount(cartItems, activePromos, opts = {}) {
  const pm = opts.pricingMode || "TTC";
  const promoCode = opts.promoCode || "";
  const items = cartItems || [];
  const promos = activePromos || [];

  const getHT = (ci) => {
    const raw = ci.discountType === "amount"
      ? ci.product.price * ci.quantity - ((ci.discount || 0) * ci.quantity)
      : ci.product.price * ci.quantity * (1 - (ci.discount || 0) / 100);
    return pm === "TTC" ? raw / (1 + (ci.product.taxRate || 0.20)) : raw;
  };
  const applyDisc = (ht, p) => {
    const dt = p.discount_type || p.discountType || "percent";
    return dt === "amount" ? Math.min(parseFloat(p.value), ht) : ht * (parseFloat(p.value) / 100);
  };

  let promoDisc = 0;
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

  promos.forEach((p) => {
    const t = p.promo_type || p.type;
    const tt = p.target_type || p.targetType;
    const tv = (p.target_value || p.targetValue || "").toLowerCase();
    const col = (p.collection || "").toLowerCase();
    const minQ = parseInt(p.min_qty || p.minQty) || 0;

    if (["category_discount", "sku_discount", "color_discount", "collection_discount", "low_stock_discount"].includes(t) ||
        ["category", "sku", "color", "collection", "low_stock"].includes(tt)) {
      const matching = items.filter((ci) => matchItems(ci, t, tt, tv, col));
      const matchQty = matching.reduce((s, i) => s + i.quantity, 0);
      if (minQ > 0 && matchQty < minQ) return;
      matching.forEach((ci) => {
        const d = applyDisc(getHT(ci), p);
        promoDisc += d;
        const label = tt === "low_stock"
          ? `${p.name}: -${d.toFixed(2)}€ HT sur ${ci.product.name} (stock: ${ci.variant?.stock ?? ci.product.stock})`
          : tt === "color"
            ? `${p.name}: -${d.toFixed(2)}€ HT sur ${ci.product.name} (${ci.variant?.color})`
            : `${p.name}: -${d.toFixed(2)}€ HT sur ${ci.product.name}`;
        applied.push(label);
      });
    } else if (t === "qty_discount") {
      const qtyMin = minQ || 3;
      if (items.reduce((s, i) => s + i.quantity, 0) >= qtyMin) {
        const totalHT = items.reduce((s, i) => s + getHT(i), 0);
        const d = applyDisc(totalHT, p);
        promoDisc += d;
        applied.push(`${p.name}: -${d.toFixed(2)}€ HT`);
      }
    } else if (t === "code" && promoCode && p.code && promoCode.toUpperCase() === p.code.toUpperCase()) {
      const totalHT = items.reduce((s, i) => s + getHT(i), 0);
      const d = applyDisc(totalHT, p);
      promoDisc += d;
      applied.push(`Code ${p.code}: -${d.toFixed(2)}€ HT`);
    }
  });

  return { promoDisc: Math.min(promoDisc, items.reduce((s, i) => s + getHT(i), 0)), applied };
}
