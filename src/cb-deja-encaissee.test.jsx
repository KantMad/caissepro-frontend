// @vitest-environment jsdom
//
// « CB déjà encaissée sur le TPE » (MCS 13/11/2026) : après une coupure, le paiement est passé au
// TPE mais la vente n'est pas enregistrée en caisse. On refait la vente SANS renvoyer le montant
// au terminal (sinon 2e débit). Responsable/admin seulement, n° d'autorisation obligatoire.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn(), refund: vi.fn() },
}));
vi.mock("./api.js", () => ({
  setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
  setToken: () => {}, getToken: () => null, clearToken: () => {}, getStoreId: () => null,
  sales: { checkout: vi.fn(), list: () => Promise.resolve([]) },
  products: { list: () => Promise.resolve([]) },
  fiscal: { closure: vi.fn() }, audit: { create: vi.fn(() => Promise.resolve()) },
}));

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
});
