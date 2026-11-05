// @vitest-environment jsdom
//
// Import CSV : un meme EAN ne doit donner qu'UNE variante, meme si la couleur est ecrite autrement
// (« 213 » / « Chocolat ») ou si les accents du fichier sont abimes (« Marron Ã©bÃ¨ne »).
// Avant : regroupement par couleur/taille seulement -> 32 EAN en double chez MCS (05/11/2026).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import React from "react";

const appels = vi.hoisted(() => ({ create: [], addVariant: [], update: [] }));
vi.mock("./api.js", () => ({
  products: {
    create: (d) => { appels.create.push(d); return Promise.resolve({ id: "np" }); },
    addVariant: (id, d) => { appels.addVariant.push(d); return Promise.resolve({ id: "nv" }); },
    update: (id, d) => { appels.update.push(d); return Promise.resolve({}); },
    adjustStock: () => Promise.resolve({}),
    list: () => Promise.resolve([]),
  },
  stock: { adjust: () => Promise.resolve({}) },
  settings: { update: () => Promise.resolve({}) },
}));
import { CSVImportWizard, reparerAccents } from "./screens/CSVImportWizard.jsx";

beforeEach(() => { cleanup(); appels.create.length = 0; appels.addVariant.length = 0; appels.update.length = 0; try { localStorage.removeItem("caissepro_csv_column_mapping"); } catch (e) {} });

const importer = async (csv, existingProducts = []) => {
  const r = render(<CSVImportWizard open onClose={() => {}} existingProducts={existingProducts} onImportComplete={() => {}} />);
  const fichier = new File([csv], "import.csv", { type: "text/csv" });
  fireEvent.change(r.container.querySelector('input[type="file"]'), { target: { files: [fichier] } });
  fireEvent.click(await r.findByText("Suivant — Regroupement"));
  fireEvent.click(await r.findByText("Suivant — Aperçu"));
  fireEvent.click(await r.findByText(/Importer \d+ produit/));
  await r.findByText("Fermer", {}, { timeout: 3000 }).catch(() => {});
  return r;
};

describe("Import CSV : un EAN = une variante", () => {
  it("répare les accents abîmés, laisse le reste intact", () => {
    expect(reparerAccents("Marron Ã©bÃ¨ne")).toBe("Marron ébène");
    expect(reparerAccents("Marron ébène")).toBe("Marron ébène");
    expect(reparerAccents("Ã")).toBe("Ã");
    expect(reparerAccents("Prix 10 €")).toBe("Prix 10 €");
  });

  it("nouvel article : deux lignes au même EAN (couleur abîmée) -> une seule variante, quantités additionnées", async () => {
    await importer("nom;ref;prix;couleur;taille;ean;stock\n" +
      "Blouson cuir velours;LMCUIR_P001;250;Marron ébène;XL;3665249306749;1\n" +
      "Blouson cuir velours;LMCUIR_P001;250;Marron Ã©bÃ¨ne;XL;3665249306749;1\n" +
      "Blouson cuir velours;LMCUIR_P001;250;Marron ébène;L;3665249306732;2\n");
    await waitFor(() => expect(appels.create.length).toBe(1));
    const v = appels.create[0].variants;
    expect(v.map(x => `${x.color}/${x.size}/${x.ean}/${x.stock}`)).toEqual(
      ["Marron ébène/XL/3665249306749/2", "Marron ébène/L/3665249306732/2"]);
  });

  it("article existant : EAN connu sous une autre couleur (« 213 ») -> mise à jour, pas de variante créée", async () => {
    const existant = { id: "p1", name: "Blouson aviateur en cuir", sku: "NMCUIR_P001", price: 300,
      variants: [{ id: "v1", color: "213", size: "M", ean: "3665249426003", stock: 2 }] };
    await importer("nom;ref;prix;couleur;taille;ean;stock\nBlouson aviateur en cuir;NMCUIR_P001;300;Chocolat;M;3665249426003;3\n", [existant]);
    await waitFor(() => expect(appels.update.length).toBeGreaterThan(0));
    expect(appels.addVariant).toEqual([]);
  });
});
