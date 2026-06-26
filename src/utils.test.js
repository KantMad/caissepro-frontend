import { describe, it, expect, beforeAll } from "vitest";

// localStorage minimal (norm.product / getSizeRank y accèdent)
beforeAll(() => {
  if (typeof globalThis.localStorage === "undefined") {
    const store = {};
    globalThis.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    };
  }
});

import {
  escapeHtml, getPriceHT, getPriceTTC, catIcon, variantKey,
  getSizeRank, generateEAN13, norm, hashPin, verifyPin,
} from "./utils.jsx";

describe("escapeHtml", () => {
  it("échappe les caractères dangereux", () => {
    expect(escapeHtml('<script>"x"&\'y\'</script>'))
      .toBe("&lt;script&gt;&quot;x&quot;&amp;&#039;y&#039;&lt;/script&gt;");
  });
  it("renvoie '' pour falsy", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("getPriceHT / getPriceTTC", () => {
  it("mode TTC : HT = prix / (1+taux)", () => {
    expect(getPriceHT(120, 0.20, "TTC")).toBeCloseTo(100, 5);
    expect(getPriceTTC(120, 0.20, "TTC")).toBe(120);
  });
  it("mode HT : prix inchangé en HT, TTC = prix × (1+taux)", () => {
    expect(getPriceHT(100, 0.20, "HT")).toBe(100);
    expect(getPriceTTC(100, 0.20, "HT")).toBeCloseTo(120, 5);
  });
  it("taux par défaut 20%", () => {
    expect(getPriceHT(120, undefined, "TTC")).toBeCloseTo(100, 5);
  });
});

describe("catIcon", () => {
  it("renvoie l'icône par défaut connue", () => {
    expect(catIcon("Jeans")).toBe("👖");
  });
  it("fallback 📦 si inconnue", () => {
    expect(catIcon("Inexistant")).toBe("📦");
  });
  it("surcharge par les réglages", () => {
    expect(catIcon("Jeans", { Jeans: "🧵" })).toBe("🧵");
  });
});

describe("variantKey", () => {
  it("clé normalisée couleur|taille en minuscule", () => {
    expect(variantKey({ color: "Bleu", size: "M" })).toBe("bleu|m");
  });
  it("valeurs par défaut si manquantes", () => {
    expect(variantKey({})).toBe("défaut|tu");
  });
});

describe("getSizeRank", () => {
  it("ordonne les tailles standard", () => {
    expect(getSizeRank("XS")).toBeLessThan(getSizeRank("M"));
    expect(getSizeRank("M")).toBeLessThan(getSizeRank("XL"));
    expect(getSizeRank("XL")).toBeLessThan(getSizeRank("3XL"));
  });
});

describe("generateEAN13", () => {
  const checkValid = (code) => {
    expect(code).toHaveLength(13);
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
    return sum % 10 === 0; // EAN-13 valide si la somme pondérée (clé incluse) ≡ 0 mod 10
  };
  it("produit un EAN-13 valide (clé de contrôle correcte)", () => {
    expect(checkValid(generateEAN13("204", 42))).toBe(true);
    expect(checkValid(generateEAN13("200", 1))).toBe(true);
    expect(checkValid(generateEAN13("203", 999999))).toBe(true);
  });
  it("commence par le préfixe et fait 13 chiffres", () => {
    const code = generateEAN13("204", 7);
    expect(code.startsWith("204")).toBe(true);
    expect(/^\d{13}$/.test(code)).toBe(true);
  });
});

describe("norm.customer", () => {
  it("mappe snake_case → camelCase + parse nombres", () => {
    const c = norm.customer({ first_name: "Jean", last_name: "Martin", total_spent: "150.5", points: "12" });
    expect(c.firstName).toBe("Jean");
    expect(c.lastName).toBe("Martin");
    expect(c.totalSpent).toBe(150.5);
    expect(c.points).toBe(12);
  });
});

describe("norm.avoir", () => {
  it("mappe barcode + items (sku/ean/colorCode)", () => {
    const a = norm.avoir({
      avoir_number: "AV-2026-000001", total_ttc: "95", barcode: "2010000000017",
      items: [{ product_id: "p1", product_name: "Chemise", variant_color: "Bleu", variant_size: "M", ean: "123", color_code: "752", line_ttc: "95", qty: 1 }],
    });
    expect(a.avoirNumber).toBe("AV-2026-000001");
    expect(a.totalTTC).toBe(95);
    expect(a.barcode).toBe("2010000000017");
    expect(a.items[0].variant.colorCode).toBe("752");
    expect(a.items[0].product.name).toBe("Chemise");
    expect(a.items[0].quantity).toBe(1);
  });
});

describe("norm.product", () => {
  it("parse price/cost/tax et conserve les variantes", () => {
    const p = norm.product({ sku: "SKU1", name: "T-shirt", price: "19.9", cost_price: "8", tax_rate: "0.055",
      variants: [{ id: "v1", color: "Noir", size: "M", stock: "5" }] });
    expect(p.price).toBe(19.9);
    expect(p.costPrice).toBe(8);
    expect(p.taxRate).toBe(0.055);
    expect(p.variants).toHaveLength(1);
    expect(p.variants[0].stock).toBe(5);
  });
});

describe("hashPin / verifyPin", () => {
  it("hash déterministe et vérifiable", async () => {
    const h = await hashPin("1234");
    expect(h).toHaveLength(64); // SHA-256 hex
    expect(await verifyPin("1234", h)).toBe(true);
    expect(await verifyPin("0000", h)).toBe(false);
  });
  it("rejette un hash vide ou ****", async () => {
    expect(await verifyPin("1234", "")).toBe(false);
    expect(await verifyPin("1234", "****")).toBe(false);
  });
});
