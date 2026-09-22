import { describe, it, expect } from "vitest";
import { productKind, colorHex } from "./ProductIcon.jsx";

describe("productKind", () => {
  it("déduit la silhouette du nom ou de la catégorie", () => {
    expect(productKind("Basket en daim Beige", "Divers")).toBe("shoe");
    expect(productKind("Bemuda chino stretch", "Bermuda chino")).toBe("short");
    expect(productKind("Pantalon 5 poches gabardine uni", "Pantalon 5 poches")).toBe("pants");
    expect(productKind("Chemise 100% lin", "Chemises")).toBe("shirt");
    expect(productKind("Sweat à capuche molleton", "Sweats")).toBe("hoodie");
    expect(productKind("Veste blazer cintrée", "Vestes")).toBe("jacket");
    expect(productKind("T-shirt col rond", "T-shirt")).toBe("tshirt");
  });
  it("retombe sur l'étiquette si rien ne correspond", () => {
    expect(productKind("Accessoires divers MCS 1", "Divers")).toBe("tag");
  });
});

describe("colorHex", () => {
  it("traduit les noms de couleur FR", () => {
    expect(colorHex("Bleu marine")).toBe("#1F2A44");
    expect(colorHex("Gris chiné")).toBe("#9A9EA5");
    expect(colorHex("Noir")).toBe("#26272B");
    expect(colorHex("Écru")).toBe("#EFE8DA");
  });
  it("utilise le repli si la couleur est inconnue", () => {
    expect(colorHex("C001", "#123456")).toBe("#123456");
    expect(colorHex("#AABBCC")).toBe("#AABBCC");
  });
});
