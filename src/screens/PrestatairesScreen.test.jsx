// @vitest-environment jsdom
// Prestataires (MCS 26/11/2026) : sommes dues par prestataire, relevé numéroté, travaux à affecter,
// saisie à la main (lavage de vitres).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const P = {
  list: vi.fn(), prestations: vi.fn(), emettreReleve: vi.fn(), releveHtml: vi.fn(), modifierPrestation: vi.fn(),
  ajouterPrestation: vi.fn(), releves: vi.fn(), stats: vi.fn(), create: vi.fn(), update: vi.fn(), retirerPrestation: vi.fn(),
};
vi.mock("../api.js", () => ({ prestataires: new Proxy({}, { get: (_, k) => (...a) => P[k](...a) }) }));
const notify = vi.fn();
vi.mock("../context.jsx", () => ({ useApp: () => ({ notify }) }));
import PrestatairesScreen from "./PrestatairesScreen.jsx";

const COUTURE = { id: "c1", name: "Atelier Couture", active: true, tva_rate: "20.00", a_emettre_count: 2, a_emettre_ht: "30.50" };
const LIGNES = [
  { id: "l1", prestataire_id: "c1", label: "Ourlet pantalon", quantity: "1", unit_cost_ht: "18.00", tva_rate: "20", sale_price_ttc: "15.00", retouche_number: "RET-2026-000001", performed_at: "2026-11-25T10:00:00Z" },
  { id: "l2", prestataire_id: "c1", label: "Doublure", quantity: "1", unit_cost_ht: "12.50", tva_rate: "20", sale_price_ttc: "30.00", retouche_number: "RET-2026-000002", performed_at: "2026-11-25T11:00:00Z" },
];
const LIBRE = { id: "l3", prestataire_id: null, label: "Bouton special", quantity: "1", unit_cost_ht: null, sale_price_ttc: "5.00", retouche_number: "RET-2026-000003", performed_at: "2026-11-26T09:00:00Z" };

const preparer = () => {
  P.list.mockResolvedValue([COUTURE]);
  P.prestations.mockImplementation(({ statut }) => Promise.resolve(statut === "a_affecter" ? [LIBRE] : LIGNES));
};
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Écran Prestataires", () => {
  it("affiche le dû par prestataire (HT et TTC) et les travaux à affecter", async () => {
    preparer();
    const r = render(<PrestatairesScreen />);
    // 18 + 12,50 = 30,50 HT ; TVA 20 % -> 36,60 TTC
    await waitFor(() => expect(r.getByTestId("du-total-Atelier Couture").textContent).toMatch(/36,60/));
    expect(r.getByTestId("du-Atelier Couture").textContent).toMatch(/30,50/);
    expect(r.getByTestId("a-affecter").textContent).toMatch(/Bouton special/);
  });

  it("génère le relevé après confirmation et l'ouvre", async () => {
    preparer();
    const doc = { open: vi.fn(), write: vi.fn(), close: vi.fn() };
    const w = { document: doc, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(w);
    P.emettreReleve.mockResolvedValue({ id: "r1", releve_number: "RP-2026-0001", total_ttc: "36.60" });
    P.releveHtml.mockResolvedValue("<html>releve</html>");
    const r = render(<PrestatairesScreen />);
    await waitFor(() => r.getByTestId("emettre-Atelier Couture"));
    fireEvent.click(r.getByTestId("emettre-Atelier Couture"));
    fireEvent.click(r.getByText("Confirmer"));
    await waitFor(() => expect(P.emettreReleve).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(doc.write).toHaveBeenCalledWith("<html>releve</html>"));
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/RP-2026-0001/), "success");
  });

  it("saisie à la main : prestation envoyée au serveur", async () => {
    preparer();
    P.ajouterPrestation.mockResolvedValue({ id: "n1" });
    const r = render(<PrestatairesScreen />);
    await waitFor(() => expect(r.getByTestId("ajouter-prestation").disabled).toBe(false));
    fireEvent.click(r.getByTestId("ajouter-prestation"));
    fireEvent.change(r.getByTestId("saisie-libelle"), { target: { value: "Lavage de vitres" } });
    fireEvent.change(r.getByTestId("saisie-prix"), { target: { value: "60" } });
    fireEvent.click(r.getByTestId("saisie-enregistrer"));
    await waitFor(() => expect(P.ajouterPrestation).toHaveBeenCalledWith(expect.objectContaining({ label: "Lavage de vitres", prestataire_id: "c1", unit_cost_ht: "60" })));
  });
});
