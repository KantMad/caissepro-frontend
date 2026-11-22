import { describe, it, expect } from "vitest";
import { detailVariante, SANS_COULEUR } from "./lib/formatters.js";
import { estEpicerie, produitParDefaut, couleurVariante, tailleVariante, libelleTaille, venduAuPoids, prixPese, libellePrixPoids, affStock, sortieStock, quantiteValorisee, etatLot, joursRestants, repartirLots, lotDlcDepassee, libelleDate, coffretsPossibles, lireEtiquetteBalance, grammesEtiquette, csvBalance, cleEan13Valide, iconeEpicerie, CATEGORIES_EPICERIE } from "./metier.js";
import { C, appliquerMarque } from "./constants.jsx";
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
    expect(produitParDefaut(epi)).toMatchObject({ taxRate: "0.055", category: "Thés" });
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

describe("Lots et dates limites", () => {
  const L = (id, date, type, quantite, retire = 0) => ({ id, variant_id: "v1", date_limite: date, type_date: type, quantite, retire, created_at: "2026-11-01" });
  it("état : DLC passée interdite, DDM passée vendable, seuils 7 j / 30 j", () => {
    const auj = "2026-11-20";
    expect(joursRestants("2026-11-27", auj)).toBe(7);
    expect(etatLot(L("a", "2026-11-19", "DLC", 1), auj)).toBe("depassee");
    expect(etatLot(L("a", "2026-11-19", "DDM", 1), auj)).toBe("ddm_passee");
    expect(etatLot(L("a", "2026-11-27", "DLC", 1), auj)).toBe("proche");
    expect(etatLot(L("a", "2026-11-28", "DLC", 1), auj)).toBe("ok");
    expect(etatLot(L("a", "2026-12-20", "DDM", 1), auj)).toBe("proche");
    expect(libelleDate("2026-01-31")).toBe("31/01/2026");
  });
  it("répartition FEFO : le stock reste sur les lots les plus tardifs", () => {
    expect(repartirLots([L("b", "2027-01-01", "DDM", 4), L("a", "2026-12-01", "DLC", 5)], 6).map(l => [l.id, l.restant])).toEqual([["a", 2], ["b", 4]]);
  });
  it("alerte caisse seulement si le lot qui part en premier a une DLC passée et du stock", () => {
    const lots = [L("a", "2026-11-01", "DLC", 3), L("b", "2027-01-01", "DLC", 4)];
    expect(lotDlcDepassee(lots, { id: "v1", stock: 6 }, "2026-11-20")?.id).toBe("a");
    expect(lotDlcDepassee(lots, { id: "v1", stock: 4 }, "2026-11-20")).toBeNull();   // lot périmé déjà écoulé
    expect(lotDlcDepassee(lots, { id: "v2", stock: 6 }, "2026-11-20")).toBeNull();
  });
});

describe("Coffrets", () => {
  it("nombre de coffrets montables = l'article le plus limitant", () => {
    const stock = { the: 750, conf: 5, boite: 3 };
    const compo = [{ variant_id: "the", quantite: 100 }, { variant_id: "conf", quantite: 1 }, { variant_id: "boite", quantite: 1 }];
    expect(coffretsPossibles(compo, id => stock[id])).toBe(3);
    expect(coffretsPossibles(compo, id => (id === "the" ? 250 : stock[id]))).toBe(2);
    expect(coffretsPossibles([], () => 10)).toBe(0);
  });
});

describe("Balances étiquetteuses", () => {
  const epi = { metier: "epicerie", balancePrefixes: "27,28" };
  it("lit une étiquette poids (préfixe 27, article 123, 85 g) et refuse clé fausse, préfixe absent, textile", () => {
    expect(cleEan13Valide("2700123000854")).toBe(true);
    expect(lireEtiquetteBalance("2700123000854", epi)).toEqual({ codeArticle: "123", valeur: 85, mode: "poids" });
    expect(lireEtiquetteBalance("2700123000855", epi)).toBeNull();
    expect(lireEtiquetteBalance("2700123000854", { ...epi, balancePrefixes: "28" })).toBeNull();
    expect(lireEtiquetteBalance("2700123000854", { balancePrefixes: "27" })).toBeNull();
  });
  it("étiquette prix : grammes recalculés depuis le prix (6,80 € à 8 €/100 g = 85 g)", () => {
    const e = lireEtiquetteBalance("2800123006808", { ...epi, balanceMode: "prix" });
    expect(e).toEqual({ codeArticle: "123", valeur: 680, mode: "prix" });
    expect(grammesEtiquette(e, { price: 8, poidsRefG: 100 })).toBe(85);
  });
  it("fichier pour la balance : produits au poids avec code, prix au kilo", () => {
    const csv = csvBalance([{ name: "Earl Grey", codeBalance: "123", price: 8, poidsRefG: 100, taxRate: 0.055 },
      { name: "Sans code", codeBalance: "", price: 5, poidsRefG: 100, taxRate: 0.055 }, { name: "Pot", codeBalance: "9", price: 5, taxRate: 0.055 }]);
    expect(csv.split("\r\n")).toEqual(["code_article;libelle;prix_kg_ttc;tva", '123;"Earl Grey";80,00;5,5']);
  });
});

describe("Épicerie fine : catégories et icônes", () => {
  it("catégories d'épicerie fine, icône d'après le nom puis la catégorie", () => {
    expect(CATEGORIES_EPICERIE).toEqual(expect.arrayContaining(["Thés", "Cafés", "Confitures et miels", "Huiles et vinaigres", "Coffrets cadeaux"]));
    expect(iconeEpicerie("Earl Grey impérial", "Thés")).toBe("🍵");
    expect(iconeEpicerie("Confiture de figues", "Coffrets cadeaux")).toBe("🍯");
    expect(iconeEpicerie("Rillettes de canard", "")).toBe("🥫");
    expect(iconeEpicerie("Huile d'olive", "")).toBe("🫒");
    expect(iconeEpicerie("Produit X", "Cafés")).toBe("☕");
    expect(iconeEpicerie("Produit X", "")).toBe("🛍️");
  });
});

describe("Image de marque", () => {
  it("applique la couleur du client puis revient aux couleurs Tech in Cash", () => {
    const avant = C.primary;
    appliquerMarque("#15718E", "#80B0E1");
    expect(C.primary).toBe("#15718E");
    expect(C.accent).toBe("#80B0E1");
    expect(C.primaryLight).toMatch(/^#[0-9a-f]{6}$/);
    appliquerMarque("", "");
    expect(C.primary).toBe(avant);
  });
});
