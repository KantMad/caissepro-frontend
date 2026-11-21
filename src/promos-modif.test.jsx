// @vitest-environment jsdom
// Promotions (20/11/2026) : une promo existante se modifie (même fenêtre que la création, PUT).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import React, { useState } from "react";

const etat = { maj: [], promos: [], crees: [], notes: [] };
vi.mock("./api.js", () => ({ settings: {
  updatePromo: (id, d) => { etat.maj.push({ id, d }); return Promise.resolve({ id, name: d.name, promo_type: d.promoType, value: d.value, discount_type: d.discountType,
    target_type: d.targetType, target_value: d.targetValue, min_qty: d.minQty, start_day: d.startDate, end_day: d.endDate, active: true }); },
  createPromo: (d) => { etat.crees.push(d); return Promise.resolve({ id: "n" + etat.crees.length, name: d.name, promo_type: d.promoType, value: d.value, active: true,
    category_mode: d.categoryMode, categories: d.categories }); }, togglePromo: () => Promise.resolve({}), deletePromo: () => Promise.resolve({}),
} }));
const PROMO = { id: "p1", name: "Robes -20", promo_type: "category_discount", value: "20", discount_type: "percent", target_type: "category",
  target_value: "Robes", min_qty: null, start_day: "2026-11-20", end_day: "2026-11-20", active: true };
vi.mock("./context.jsx", () => ({ useApp: () => {
  const [promos, setPromos] = useState([PROMO]); etat.promos = promos;
  return { promos, setPromos, products: [{ id: "a", category: "Robes", sku: "R1", name: "Robe", variants: [] }, { id: "b", category: "Accessoires", sku: "A1", name: "Sac", variants: [] }], perm: () => ({ canManagePromos: true }),
    addAudit: () => {}, notify: (m, t) => etat.notes.push([m, t]) };
} }));
import PromosScreen from "./screens/PromosScreen.jsx";

afterEach(() => { cleanup(); etat.maj.length = 0; etat.crees.length = 0; etat.notes.length = 0; });

describe("Promotions : modification", () => {
  it("le crayon ouvre la promo pré-remplie ; l'enregistrement envoie la modification", async () => {
    const r = render(<PromosScreen />);
    fireEvent.click(r.getByTestId("modifier-promo-p1"));
    expect(r.getByText("Modifier la promotion")).toBeTruthy();
    const nom = r.getByPlaceholderText("Ex: Soldes été -30% Robes");
    expect(nom.value).toBe("Robes -20");
    expect(r.getByPlaceholderText("30").value).toBe("20");
    fireEvent.change(nom, { target: { value: "Robes -30" } });
    fireEvent.change(r.getByPlaceholderText("30"), { target: { value: "30" } });
    await act(async () => { fireEvent.click(r.getByText("Enregistrer les modifications")); });
    expect(etat.maj[0].id).toBe("p1");
    // Ancienne remise par catégorie : reprise en remise automatique « aucune catégorie sauf Robes »
    expect(etat.maj[0].d).toMatchObject({ name: "Robes -30", value: 30, promoType: "global_discount", categoryMode: "only", categories: ["Robes"], startDate: "2026-11-20", endDate: "2026-11-20" });
    expect(etat.maj[0].d.active).toBeUndefined();   // l'état actif/inactif reste celui du bouton
    await waitFor(() => expect(r.container.textContent).toMatch(/Robes -30/));
    expect(etat.promos.length).toBe(1);
  });

  it("nouvelle remise automatique « toutes les catégories sauf Accessoires »", async () => {
    const r = render(<PromosScreen />);
    fireEvent.click(r.getByText("Nouvelle promo"));
    fireEvent.change(r.getByPlaceholderText("Ex: Soldes été -30% Robes"), { target: { value: "Tout -20" } });
    fireEvent.change(r.getByPlaceholderText("30"), { target: { value: "20" } });
    expect(r.getByTestId("promo-apercu").textContent).toMatch(/2 articles/);
    fireEvent.click(r.getByTestId("filtre-except"));
    fireEvent.click(r.getByTestId("cat-Accessoires"));
    expect(r.getByTestId("promo-apercu").textContent).toMatch(/1 article/);
    await act(async () => { fireEvent.click(r.getByTestId("enregistrer-promo")); });
    expect(etat.crees[0]).toMatchObject({ promoType: "global_discount", value: 20, categoryMode: "except", categories: ["Accessoires"] });
  });
  it("« aucune catégorie sauf » sans case cochée : refusé avec un message clair", async () => {
    const r = render(<PromosScreen />);
    fireEvent.click(r.getByText("Nouvelle promo"));
    fireEvent.change(r.getByPlaceholderText("Ex: Soldes été -30% Robes"), { target: { value: "X" } });
    fireEvent.change(r.getByPlaceholderText("30"), { target: { value: "10" } });
    fireEvent.click(r.getByTestId("filtre-only"));
    await act(async () => { fireEvent.click(r.getByTestId("enregistrer-promo")); });
    expect(etat.crees.length).toBe(0);
    expect(etat.notes.at(-1)[0]).toMatch(/Cochez au moins une catégorie/);
  });
});
