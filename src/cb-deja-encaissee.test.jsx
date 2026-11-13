// @vitest-environment jsdom
//
// « CB déjà encaissée sur le TPE » (MCS 13/11/2026) : après une coupure, le paiement est passé au
// TPE mais la vente n'est pas enregistrée en caisse. On refait la vente SANS renvoyer le montant
// au terminal (sinon 2e débit). Responsable/admin seulement, n° d'autorisation obligatoire.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup, fireEvent } from "@testing-library/react";
import { SalesScreen } from "./screens/index.js";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn(), refund: vi.fn() },
}));
vi.mock("./api.js", () => {
  const ns = (fixes = {}) => new Proxy(fixes, { get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : () => Promise.resolve([]))) });
  return new Proxy({
    setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: () => {}, getToken: () => null, clearToken: () => {}, getStoreId: () => null,
    sales: ns({ checkout: vi.fn() }), audit: ns({ create: vi.fn(() => Promise.resolve()) }),
  }, { get: (t, k) => (k in t ? t[k] : (k === "then" || k === "__esModule" ? undefined : ns())) });
});

import * as API from "./api.js";
import hardwareManager from "./hardware.js";
import AppProvider, { useApp } from "./context.jsx";

let ctx;
function Harness() { ctx = useApp(); return null; }
const mount = (role) => {
  sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u1", name: "Fred", role }));
  return render(<AppProvider><Harness /></AppProvider>);
};
const prod = { id: "p1", name: "Robe", sku: "R1", price: 120, costPrice: 50, taxRate: 0.20, category: "Robes" };
const variant = { id: "v1", color: "Noir", size: "M", ean: "" };

beforeEach(() => { cleanup(); ctx = undefined; vi.clearAllMocks(); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("CB déjà encaissée sur le TPE", () => {
  it("responsable : vente enregistrée en CB sans appel au TPE, avec n° d'autorisation, journalisée", async () => {
    API.sales.checkout.mockResolvedValue({ seq: 1, hash: "h", grandTotal: "120", ticket_number: "TK-9", totalHT: 100, totalTVA: 20, totalTTC: 120, items: [], payments: [] });
    mount("manager");
    act(() => { ctx.addToCart(prod, variant); });
    let tk;
    await act(async () => { tk = await ctx.checkout([{ method: "card", amount: 120, alreadyCharged: true, authCode: " 123456 " }], "Fred"); });
    expect(tk).toBeTruthy();
    expect(hardwareManager.charge).not.toHaveBeenCalled();
    const pay = API.sales.checkout.mock.calls[0][0].payments[0];
    expect(pay).toMatchObject({ method: "card", amount: 120, authCode: "123456" });
    expect(ctx.audit.find(a => a.action === "TPE_DEJA_ENCAISSE")?.detail).toMatch(/120\.00€.*autorisation 123456.*TK-9.*Fred/);
  });

  it("caissier, ou sans n° d'autorisation : refusé, rien n'est enregistré", async () => {
    mount("cashier");
    act(() => { ctx.addToCart(prod, variant); });
    let tk;
    await act(async () => { tk = await ctx.checkout([{ method: "card", amount: 120, alreadyCharged: true, authCode: "123456" }], "X"); });
    expect(tk).toBeNull();
    cleanup(); mount("admin");
    act(() => { ctx.addToCart(prod, variant); });
    await act(async () => { tk = await ctx.checkout([{ method: "card", amount: 120, alreadyCharged: true, authCode: "  " }], "X"); });
    expect(tk).toBeNull();
    expect(API.sales.checkout).not.toHaveBeenCalled();
    expect(hardwareManager.charge).not.toHaveBeenCalled();
  });

  it("vente refusée par le serveur : pas de remboursement automatique au TPE", async () => {
    API.sales.checkout.mockRejectedValue(new Error("Journée clôturée"));
    mount("admin");
    act(() => { ctx.addToCart(prod, variant); });
    await act(async () => { await ctx.checkout([{ method: "card", amount: 120, alreadyCharged: true, authCode: "123456" }], "X"); });
    expect(hardwareManager.refund).not.toHaveBeenCalled();
  });

  it("écran : bouton dans « Règlement » pour un responsable, absent pour un caissier", async () => {
    API.sales.checkout.mockResolvedValue({ seq: 2, hash: "h", grandTotal: "120", ticket_number: "TK-10", totalHT: 100, totalTVA: 20, totalTTC: 120, items: [], payments: [] });
    sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u1", name: "Fred", role: "manager" }));
    const r = render(<AppProvider><Harness /><SalesScreen /></AppProvider>);
    act(() => { ctx.addToCart(prod, variant); });
    fireEvent.click(r.getByText(/Règlement — 120\.00€/));
    fireEvent.click(r.getByTestId("cb-deja-encaissee"));
    const caseCochee = r.getByLabelText(/CB déjà encaissée sur le TPE/);
    expect(caseCochee.checked).toBe(true);
    fireEvent.change(r.getByPlaceholderText("N° d'autorisation (ticket TPE)"), { target: { value: "654321" } });
    await act(async () => { fireEvent.click(r.getByText("Valider")); });
    expect(hardwareManager.charge).not.toHaveBeenCalled();
    expect(API.sales.checkout.mock.calls[0][0].payments[0]).toMatchObject({ method: "card", amount: 120, authCode: "654321" });
    cleanup(); sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u2", name: "Léa", role: "cashier" }));
    const r2 = render(<AppProvider><Harness /><SalesScreen /></AppProvider>);
    act(() => { ctx.addToCart(prod, variant); });
    fireEvent.click(r2.getByText(/Règlement — 120\.00€/));
    expect(r2.queryByTestId("cb-deja-encaissee")).toBeNull();
  });
});
