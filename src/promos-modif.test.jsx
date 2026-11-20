// @vitest-environment jsdom
// Promotions (20/11/2026) : une promo existante se modifie (même fenêtre que la création, PUT).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import React, { useState } from "react";

const etat = { maj: [], promos: [] };
vi.mock("./api.js", () => ({ settings: {
  updatePromo: (id, d) => { etat.maj.push({ id, d }); return Promise.resolve({ id, name: d.name, promo_type: d.promoType, value: d.value, discount_type: d.discountType,
    target_type: d.targetType, target_value: d.targetValue, min_qty: d.minQty, start_day: d.startDate, end_day: d.endDate, active: true }); },
  createPromo: () => Promise.resolve({}), togglePromo: () => Promise.resolve({}), deletePromo: () => Promise.resolve({}),
} }));
const PROMO = { id: "p1", name: "Robes -20", promo_type: "category_discount", value: "20", discount_type: "percent", target_type: "category",
  target_value: "Robes", min_qty: null, start_day: "2026-11-20", end_day: "2026-11-20", active: true };
vi.mock("./context.jsx", () => ({ useApp: () => {
  const [promos, setPromos] = useState([PROMO]); etat.promos = promos;
  return { promos, setPromos, products: [{ id: "a", category: "Robes", sku: "R1", name: "Robe", variants: [] }], perm: () => ({ canManagePromos: true }),
    addAudit: () => {}, notify: () => {} };
} }));
import PromosScreen from "./screens/PromosScreen.jsx";

afterEach(() => { cleanup(); etat.maj.length = 0; });

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
    expect(etat.maj[0].d).toMatchObject({ name: "Robes -30", value: 30, promoType: "category_discount", targetValue: "Robes", startDate: "2026-11-20", endDate: "2026-11-20" });
    expect(etat.maj[0].d.active).toBeUndefined();   // l'état actif/inactif reste celui du bouton
    await waitFor(() => expect(r.container.textContent).toMatch(/Robes -30/));
    expect(etat.promos.length).toBe(1);
  });
});
