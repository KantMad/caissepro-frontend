// @vitest-environment jsdom
//
// Retour libre (MCS 16/11/2026) :
//  1. scanner un EAN n'affiche QUE la variante scannée (avant : toutes les tailles/couleurs) ;
//  2. motif OBLIGATOIRE choisi dans une liste dédiée (« Retour site internet », « Retour autre
//     boutique » + ceux ajoutés dans Paramètres > Retours).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: {} }));
vi.mock("./api.js", () => ({ sales: { lookup: () => Promise.resolve([]) } }));

const produits = [
  { id: "p1", name: "Robe portefeuille", sku: "RB-100", price: 120, taxRate: 0.2, variants: [
    { id: "v1", color: "Noir", size: "S", ean: "2000000993001" },
    { id: "v2", color: "Noir", size: "M", ean: "2000000993002" },
    { id: "v3", color: "Rouge", size: "L", ean: "2000000993003" } ] },
  { id: "p2", name: "Chemise lin", sku: "CH-200", price: 80, taxRate: 0.2, variants: [
    { id: "v4", color: "Blanc", size: "M", ean: "2000000994001" } ] },
];
const etat = { scan: null, processReturn: vi.fn(async () => null), notify: vi.fn(), settings: { returnPolicy: {} } };
vi.mock("./context.jsx", () => ({ useApp: () => ({
  tickets: [], products: produits, avoirs: [], users: [], currentUser: { role: "manager" }, settings: etat.settings,
  processReturn: etat.processReturn, notify: etat.notify, addAudit: () => {}, isAvoirExpired: () => false,
  findByEAN: (code) => { for (const p of produits) { const v = p.variants.find(x => x.ean === code); if (v) return { product: p, variant: v }; } return null; },
  setScanOverride: (f) => { etat.scan = f; }, clearScanOverride: () => {}, thermalPrint: () => {}, setSelectedAvoir: () => {}, setMode: () => {},
}) }));
import ReturnScreen from "./screens/ReturnScreen.jsx";

afterEach(() => { cleanup(); etat.processReturn.mockClear(); etat.notify.mockClear(); etat.settings = { returnPolicy: {} }; });

const ouvrirLibre = () => { const r = render(<ReturnScreen />); fireEvent.click(r.getByText("Retour libre (sans ticket)")); return r; };

describe("Retour libre", () => {
  it("un EAN scanné n'affiche que la variante concernée", async () => {
    const r = ouvrirLibre();
    await act(async () => { etat.scan("2000000993002"); });
    const champ = r.getByPlaceholderText("Nom, SKU ou scanner…");
    expect(champ.value).toBe("2000000993002");
    expect(r.queryAllByText("Noir/M").length).toBeGreaterThan(0);
    expect(r.queryByText("Noir/S")).toBeNull();
    expect(r.queryByText("Rouge/L")).toBeNull();
    // Recherche par nom : toutes les variantes restent proposées
    fireEvent.change(champ, { target: { value: "robe" } });
    expect(r.queryByText("Noir/S")).toBeTruthy();
    expect(r.queryByText("Rouge/L")).toBeTruthy();
  });

  it("motif obligatoire dans la liste du retour libre, transmis tel quel", async () => {
    etat.settings = { returnPolicy: { freeReasons: ["Retour site internet", "Retour autre boutique", "Retour Vinted"] } };
    const r = ouvrirLibre();
    await act(async () => { etat.scan("2000000994001"); });
    const liste = r.getByTestId("motif-retour-libre");
    expect([...liste.options].map(o => o.textContent)).toEqual(["— Choisir le motif —", "Retour site internet", "Retour autre boutique", "Retour Vinted"]);
    await act(async () => { fireEvent.click(r.getByText(/Valider le retour/)); });
    expect(etat.processReturn).not.toHaveBeenCalled();
    expect(etat.notify).toHaveBeenCalledWith("Choisissez le motif du retour libre", "error");
    fireEvent.change(liste, { target: { value: "Retour autre boutique" } });
    await act(async () => { fireEvent.click(r.getByText(/Valider le retour/)); });
    expect(etat.processReturn).toHaveBeenCalledTimes(1);
    expect(etat.processReturn.mock.calls[0][2]).toBe("Retour autre boutique");
  });

  it("liste par défaut : site internet et autre boutique", () => {
    const r = ouvrirLibre();
    fireEvent.change(r.getByPlaceholderText("Nom, SKU ou scanner…"), { target: { value: "chemise" } });
    fireEvent.click(r.getByText("Blanc/M"));
    expect([...r.getByTestId("motif-retour-libre").options].map(o => o.textContent)).toEqual(["— Choisir le motif —", "Retour site internet", "Retour autre boutique"]);
  });
});
