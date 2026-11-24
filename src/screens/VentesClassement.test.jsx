// @vitest-environment jsdom
// Stock > Ventes (MCS 24/11/2026) : produits vendus en grille produit x couleur / tailles,
// du plus vendu au moins vendu, filtres periode / categorie / sous-categorie.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const classement = vi.fn();
vi.mock("../api.js", () => ({ sales: { classement: (...a) => classement(...a) } }));
vi.mock("../context.jsx", () => ({ useApp: () => ({
  allCategories: ["Tous", "Pantalon", "Chemise"],
  products: [
    { id: "p1", category: "Pantalon", subcategory: "Chino" },
    { id: "p2", category: "Pantalon", subcategory: "5 poches" },
    { id: "p3", category: "Chemise", subcategory: "" },
  ] }) }));
import VentesClassement, { grilleVentes } from "./VentesClassement.jsx";

const ROWS = [
  { product_id: "p1", product_name: "Pantalon Chino", sku: "CH-1", color: "Noir", size: "L", sold: 3, returned: 1, revenue_ttc: "270.00" },
  { product_id: "p1", product_name: "Pantalon Chino", sku: "CH-1", color: "Noir", size: "M", sold: 2, returned: 0, revenue_ttc: "180.00" },
  { product_id: "p1", product_name: "Pantalon Chino", sku: "CH-1", color: "Beige", size: "S", sold: 1, returned: 0, revenue_ttc: "90.00" },
  { product_id: "p3", product_name: "Chemise Oxford", sku: "OX-1", color: "Blanc", size: "M", sold: 4, returned: 0, revenue_ttc: "280.00" },
  { product_id: "p2", product_name: "Pantalon 5 poches", sku: "CP-1", color: "Bleu", size: "M", sold: 1, returned: 0, revenue_ttc: "80.00" },
];

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("grilleVentes", () => {
  it("range par produit (total), puis couleur, une colonne par taille dans l'ordre des tailles", () => {
    const g = grilleVentes(ROWS);
    expect(g.produits.map(p => `${p.nom}:${p.total}`)).toEqual(["Pantalon Chino:6", "Chemise Oxford:4", "Pantalon 5 poches:1"]);
    expect(g.tailles).toEqual(["S", "M", "L"]);
    const [chino] = g.produits;
    expect(chino.couleurs.map(c => c.couleur)).toEqual(["Noir", "Beige"]);
    expect(chino.couleurs[0].parTaille).toEqual({ L: 3, M: 2 });
    expect(chino.retours).toBe(1);
    expect(g.total).toEqual({ qte: 11, ca: 900, retours: 1 });
  });
  it("ordre inverse : les moins vendus d'abord", () => {
    expect(grilleVentes(ROWS, "asc").produits.map(p => p.nom)).toEqual(["Pantalon 5 poches", "Chemise Oxford", "Pantalon Chino"]);
  });
});

describe("Onglet Ventes", () => {
  it("affiche la grille et relance le calcul avec la categorie et la sous-categorie", async () => {
    classement.mockResolvedValue({ rows: ROWS, truncated: false });
    const r = render(<VentesClassement />);
    await waitFor(() => expect(r.getByTestId("classement-produit-1").textContent).toMatch(/Pantalon Chino/));
    expect(r.getByTestId("classement-total").textContent).toMatch(/11 article\(s\) vendu\(s\)/);
    expect(classement.mock.calls[0][0]).toHaveProperty("from");
    // sous-categories proposees selon la categorie
    fireEvent.change(r.getByTestId("classement-categorie"), { target: { value: "Pantalon" } });
    const opts = [...r.getByTestId("classement-sous-categorie").querySelectorAll("option")].map(o => o.value);
    expect(opts).toEqual(["", "5 poches", "Chino"]);
    fireEvent.change(r.getByTestId("classement-sous-categorie"), { target: { value: "Chino" } });
    await waitFor(() => expect(classement).toHaveBeenLastCalledWith(expect.objectContaining({ category: "Pantalon", subcategory: "Chino" })));
    fireEvent.click(r.getByTestId("classement-ordre"));
    await waitFor(() => expect(r.getByTestId("classement-produit-1").textContent).toMatch(/5 poches/));
  });
  it("periode vide : message clair", async () => {
    classement.mockResolvedValue({ rows: [], truncated: false });
    const r = render(<VentesClassement />);
    await waitFor(() => expect(r.getByTestId("classement-vide")).toBeTruthy());
  });
});
