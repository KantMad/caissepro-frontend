import { describe, it, expect } from "vitest";
import { detailVariante, SANS_COULEUR } from "./lib/formatters.js";
import { estEpicerie, produitParDefaut, couleurVariante, tailleVariante, libelleTaille } from "./metier.js";

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
    expect(produitParDefaut(epi)).toMatchObject({ taxRate: "0.055", category: "Café" });
    expect(couleurVariante(epi, "Rouge")).toBe(SANS_COULEUR);
    expect(tailleVariante(epi, " 250 g ")).toBe("250 g");
    expect(tailleVariante(epi, "")).toBe(SANS_COULEUR);
    expect(libelleTaille(epi)).toBe("CONTENANCE");
  });
});
