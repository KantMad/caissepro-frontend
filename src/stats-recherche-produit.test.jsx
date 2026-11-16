// @vitest-environment jsdom
//
// Statistiques > « Ventes d'un produit » (MCS 16/11/2026) : nom, référence ou EAN -> quantités
// vendues sur la période choisie, calculées par le SERVEUR (toutes les ventes, retours déduits).
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";

const appels = [];
vi.mock("./api.js", () => ({
  sales: { productSales: (p) => { appels.push(p); return Promise.resolve({ truncated: false, rows: [
    { product_id: "p1", variant_id: "v1", product_name: "Robe portefeuille", sku: "RB-100", ean: "2000000993001", color: "Noir", size: "M", stock: 7, sold: 3, returned: 1, net: 2, revenue_ttc: "360.00", refunded_ttc: "120.00" },
    { product_id: "p1", variant_id: "v2", product_name: "Robe portefeuille", sku: "RB-100", ean: "2000000993002", color: "Noir", size: "L", stock: 2, sold: 1, returned: 0, net: 1, revenue_ttc: "120.00", refunded_ttc: "0.00" },
  ] }); } },
}));
const scan = { fn: null };
vi.mock("./context.jsx", () => ({ useApp: () => ({ setScanOverride: (f) => { scan.fn = f; }, clearScanOverride: () => { scan.fn = null; } }) }));
import RechercheVentesProduit from "./screens/RechercheVentesProduit.jsx";

describe("Statistiques : ventes d'un produit", () => {
  it("recherche par nom, total net, relance quand la période change, scan accepté", async () => {
    const r = render(<RechercheVentesProduit dateFrom="2026-11-01" dateTo="2026-11-16" />);
    const champ = r.getByPlaceholderText(/Nom du produit, référence ou EAN/);
    // 1 caractère : refusé sans appel
    fireEvent.change(champ, { target: { value: "r" } });
    fireEvent.keyDown(champ, { key: "Enter" });
    expect(r.container.textContent).toMatch(/au moins 2 caractères/);
    expect(appels).toHaveLength(0);
    fireEvent.change(champ, { target: { value: "robe" } });
    await act(async () => { fireEvent.keyDown(champ, { key: "Enter" }); });
    await waitFor(() => expect(r.getByTestId("ventes-produit-total").textContent).toMatch(/du 01\/11\/2026 au 16\/11\/2026 : 4 vendu\(s\), 1 retourné\(s\), 3 net — 360\.00€ TTC/));
    expect(appels[0].q).toBe("robe");
    expect(appels[0].from).toBeTruthy();
    expect(r.container.textContent).toMatch(/Noir \/ L/);
    // Période changée : même recherche relancée
    r.rerender(<RechercheVentesProduit dateFrom="2026-11-16" dateTo="2026-11-16" />);
    await waitFor(() => expect(appels).toHaveLength(2));
    // Scan d'un EAN pendant que le champ a le focus
    fireEvent.focus(champ);
    await act(async () => { scan.fn("2000000993001"); });
    await waitFor(() => expect(appels.at(-1).q).toBe("2000000993001"));
  });
});
