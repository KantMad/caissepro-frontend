import { describe, it, expect } from "vitest";
import { detailVariante, SANS_COULEUR } from "./lib/formatters.js";
import { estEpicerie, produitParDefaut, couleurVariante, tailleVariante, libelleTaille, venduAuPoids, prixPese, libellePrixPoids, affStock, sortieStock, quantiteValorisee } from "./metier.js";
import { ligneDepuisAttente } from "./context.jsx";

describe("detailVariante (tickets et apercus)", () => {
  it("textile : identique a avant (couleur/taille)", () => {
    expect(detailVariante("Noir", "M")).toBe("Noir/M");
    expect(detailVariante("Défaut", "TU")).toBe("Défaut/TU");
  });
  it("epicerie : la couleur placeholder n'est jamais imprimee", () => {
    expect(detailVariante(SANS_COULEUR, "250 g")).toBe("250 g");
    expect(detailVariante(SANS_COULEUR, SANS_COULEUR)).toBe("");
  });
  it("valeurs vides sautees, plus de « /250 g »", () => {
    expect(detailVariante("", "250 g")).toBe("250 g");
    expect(detailVariante(undefined, null)).toBe("");
    expect(detailVariante("Bleu", "L", " / ")).toBe("Bleu / L");
  });
});

describe("metier de l'instance", () => {
  const epi = { metier: "epicerie" };
  it("textile par defaut (MCS, instance sans reglage)", () => {
    expect(estEpicerie({})).toBe(false);
    expect(estEpicerie(undefined)).toBe(false);
    expect(produitParDefaut({}).taxRate).toBe("0.20");
    expect(couleurVariante({}, "")).toBe("Défaut");
    expect(tailleVariante({}, "")).toBe("TU");
    expect(libelleTaille({})).toBe("TAILLE");
  });
  it("epicerie : contenance, TVA 5,5 %, couleur masquee", () => {
    expect(estEpicerie(epi)).toBe(true);
    expect(produitParDefaut(epi)).toMatchObject({ taxRate: "0.055", category: "Thés natures" });
    expect(couleurVariante(epi, "Rouge")).toBe(SANS_COULEUR);
    expect(tailleVariante(epi, " 250 g ")).toBe("250 g");
    expect(tailleVariante(epi, "")).toBe(SANS_COULEUR);
    expect(libelleTaille(epi)).toBe("CONTENANCE");
  });
});

describe("vente au poids (thé en vrac)", () => {
  const cannelle = { id: "p1", name: "Cannelle", price: 8, poidsRefG: 100 };
  it("produit au poids seulement si poidsRefG > 0", () => {
    expect(venduAuPoids(cannelle)).toBe(true);
    expect(venduAuPoids({ price: 8 })).toBe(false);
    expect(venduAuPoids({ price: 8, poidsRefG: null })).toBe(false);
  });
  it("prix = prix catalogue x poids / poids de référence, arrondi au centime", () => {
    expect(prixPese(cannelle, 85)).toBe(6.8);
    expect(prixPese({ price: 9.5, poidsRefG: 100 }, 33)).toBe(3.14);   // 3,135 -> 3,14
    expect(prixPese({ price: 6.5, poidsRefG: 50 }, 120)).toBe(15.6);
    expect(prixPese({ price: 42, poidsRefG: 1000 }, 250)).toBe(10.5);
    expect(libellePrixPoids(cannelle)).toBe("8.00€ / 100 g");
  });
  it("panier en attente : la ligne pesée revient avec son poids et son prix", () => {
    const prod = { ...cannelle, variants: [{ id: "v1", color: SANS_COULEUR, size: "Vrac" }] };
    const l = ligneDepuisAttente({ productId: "p1", variantId: "v1", productName: "Cannelle", variantSize: "85 g", poidsG: 85, price: 6.8, quantity: 1 }, [prod]);
    expect(l.product.price).toBe(6.8);
    expect(l.variant).toMatchObject({ id: "v1", size: "85 g", poidsG: 85 });
  });
});

describe("stock du vrac en grammes (lot 2)", () => {
  const the = { price: 8, costPrice: 2.4, poidsRefG: 100 };
  const pot = { price: 12, costPrice: 6 };
  it("affichage : grammes, puis kilos au-delà de 1 000 g ; à l'unité inchangé", () => {
    expect(affStock(the, 850)).toBe("850 g");
    expect(affStock(the, 1250)).toBe("1,25 kg");
    expect(affStock(the, 0)).toBe("0 g");
    expect(affStock(pot, 7)).toBe("7");
  });
  it("une ligne pesée retire ses grammes, une ligne à l'unité sa quantité", () => {
    expect(sortieStock({ quantity: 1, variant: { poidsG: 85 } })).toBe(85);
    expect(sortieStock({ quantity: 3, variant: { size: "250 g" } })).toBe(3);
  });
  it("valorisation : 1 500 g à 2,40 € les 100 g = 15 quantités de référence", () => {
    expect(quantiteValorisee(the, 1500) * the.costPrice).toBeCloseTo(36, 5);
    expect(quantiteValorisee(pot, 4)).toBe(4);
  });
});
