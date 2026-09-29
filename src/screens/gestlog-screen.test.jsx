// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const IMPORTS = [{ id: "1", batch_id: "CAT-2026-09-29", created_at: "2026-09-29T08:00:00Z",
  products_created: 1, products_updated: 1, variants_created: 2, variants_updated: 1, ignored: 1,
  price_gaps: [{ sku: "DEMO-TS01", name: "T-shirt col rond", prixCaisse: 19.9, prixConseille: 21.9 }],
  rejects: [{ ean: "123", sku: "ZZZ", reason: "EAN-13 invalide" }] }];

vi.mock("../api.js", () => ({ integrations: {
  gestlogDeliveries: () => Promise.resolve([]),
  gestlogCatalogImports: () => Promise.resolve(IMPORTS),
} }));

import GestlogDeliveriesScreen from "./GestlogDeliveriesScreen.jsx";

afterEach(cleanup);

describe("Écran gestlog — onglet Imports catalogue", () => {
  it("affiche l'historique, les écarts de prix et les lignes rejetées", async () => {
    const { getByText, container } = render(<GestlogDeliveriesScreen />);
    await waitFor(() => expect(container.textContent).toContain("Imports catalogue"));
    fireEvent.click(getByText(/Imports catalogue/));
    await waitFor(() => expect(container.textContent).toContain("CAT-2026-09-29"));
    expect(container.textContent).toContain("1 produit(s) créé(s)");
    expect(container.textContent).toContain("Prix conseillés différents");
    expect(container.textContent).toContain("19.90€");
    expect(container.textContent).toContain("EAN-13 invalide");
  });
});
