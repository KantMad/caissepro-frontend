// @vitest-environment jsdom
//
// Test d'INTÉGRATION du paiement (checkout) via le vrai provider.
// - Mode online : API.sales.checkout résout → on vérifie le payload envoyé + panier vidé.
// - Mode offline : API.sales.checkout rejette → fallback local, ticket recalculé
//   (c'est le chemin TTC-ancré corrigé pour l'arrondi).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
vi.mock("./api.js", () => ({
  setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
  setToken: () => {}, getToken: () => null, clearToken: () => {}, getStoreId: () => null,
  sales: { checkout: vi.fn(), list: () => Promise.resolve([]) },
  products: { list: () => Promise.resolve([]) },
  fiscal: { closure: vi.fn() },
}));

import * as API from "./api.js";
import AppProvider, { useApp } from "./context.jsx";

let ctx;
function Harness() { ctx = useApp(); return null; }
const mount = () => render(<AppProvider><Harness /></AppProvider>);
const prod = (over = {}) => ({ id: "p1", name: "Jean", sku: "SKU1", price: 209, costPrice: 80, taxRate: 0.20, category: "Jeans", ...over });
const variant = (id = "v1") => ({ id, color: "Bleu", size: "M", ean: "" });

beforeEach(() => { cleanup(); ctx = undefined; vi.clearAllMocks(); });

describe("Paiement — mode online (API OK)", () => {
  it("envoie le bon payload et vide le panier", async () => {
    API.sales.checkout.mockResolvedValue({
      seq: 1, hash: "abc", grandTotal: "418", ticket_number: "TK-1",
      totalHT: 348.33, totalTVA: 69.67, totalTTC: 418, createdAt: "2026-06-26", items: [], payments: [],
    });
    mount();
    act(() => { ctx.addToCart(prod(), variant()); });
    act(() => { ctx.addToCart(prod(), variant()); }); // quantité 2

    let ticket;
    await act(async () => { ticket = await ctx.checkout([{ method: "cash", amount: 418 }], "Vendeur"); });

    expect(API.sales.checkout).toHaveBeenCalledTimes(1);
    const payload = API.sales.checkout.mock.calls[0][0];
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].quantity).toBe(2);
    expect(payload.items[0].tax_rate).toBe(0.20);
    expect(payload.globalDiscount).toBe(0);
    expect(payload.items[0].cost_price).toBe(80);   // prix d'achat HT envoyé tel quel (plus /1,2)
    expect(ticket.totalTTC).toBe(418);
    expect(ctx.cart).toEqual([]); // panier vidé après succès
  });
});

describe("Paiement — mode offline (API échoue → fallback local)", () => {
  it("recalcule le ticket localement (TTC ancré) et le conserve", async () => {
    API.sales.checkout.mockRejectedValue(new TypeError("Failed to fetch"));
    mount();
    act(() => { ctx.addToCart(prod(), variant()); });
    act(() => { ctx.addToCart(prod(), variant()); });

    let ticket;
    await act(async () => { ticket = await ctx.checkout([{ method: "cash", amount: 418 }], "Vendeur"); });

    // Ticket recalculé localement : TTC = 418.00, HT+TVA cohérents au centime
    expect(ticket.totalTTC).toBe(418);
    expect(Math.round((ticket.totalHT + ticket.totalTVA) * 100) / 100).toBe(418);
    expect(ticket.barcode).toMatch(/^\d{13}$/); // EAN-13 hors-ligne généré
    expect(ticket.fingerprint).toHaveLength(16); // empreinte NF525
    // Marge HT = 418/1,2 - 2 x 80 (prix d'achat HT) = 188,33
    expect(Math.round(ticket.margin * 100) / 100).toBe(188.33);
    expect(ctx.cart).toEqual([]); // panier vidé
    expect(ctx.tickets[0].ticketNumber).toBe(ticket.ticketNumber); // ajouté à l'historique
    expect(ctx.pendingSync.length).toBeGreaterThan(0); // mis en file de synchro
    // La file garde l'heure réelle, le n° du ticket papier et le vendeur (rapprochement à la synchro)
    const enFile = ctx.pendingSync.find(x => x.type === "offlineSale").data;
    expect(enFile.offlineTicketNumber).toBe(ticket.ticketNumber);
    expect(new Date(enFile.offlineDate).toISOString()).toBe(enFile.offlineDate);
    expect(enFile.sellerName).toBe("Vendeur");
  });

  it("multi-taux offline reste cohérent (HT+TVA=TTC)", async () => {
    API.sales.checkout.mockRejectedValue(new TypeError("Failed to fetch"));
    mount();
    act(() => { ctx.addToCart(prod({ id: "p1", price: 209, taxRate: 0.20 }), variant("v1")); });
    act(() => { ctx.addToCart(prod({ id: "p2", price: 10, taxRate: 0.055 }), variant("v2")); });

    let ticket;
    await act(async () => { ticket = await ctx.checkout([{ method: "cash", amount: 219 }], "V"); });
    expect(ticket.totalTTC).toBe(219);
    expect(Math.round((ticket.totalHT + ticket.totalTVA) * 100) / 100).toBe(219);
  });
});

// Piege du 09/10/2026 : le serveur refusait les ventes (400 « Période clôturée ») et la caisse
// les traitait comme une coupure reseau — ticket imprime, CA affiche, puis vente abandonnee.
describe("Paiement — refus du serveur (ce n'est PAS une coupure réseau)", () => {
  it("ne crée aucun ticket local, garde le panier et ne met rien en file", async () => {
    API.sales.checkout.mockRejectedValue(new Error("Période clôturée — impossible de créer une vente après la clôture du mois"));
    mount();
    act(() => { ctx.addToCart(prod(), variant()); });

    let ticket;
    await act(async () => { ticket = await ctx.checkout([{ method: "cash", amount: 209 }], "V"); });
    expect(ticket).toBeNull();
    expect(ctx.cart).toHaveLength(1);       // panier conservé
    expect(ctx.tickets).toHaveLength(0);    // aucun faux ticket dans l'historique / le CA
    expect(ctx.pendingSync.filter(a => a.type === "offlineSale")).toHaveLength(0);
  });
});

// Z mensuel d'octobre fait le 08/10/2026 : le serveur refuse un 2e Z mensuel mais signale
// qu'un Z COMPLEMENTAIRE est possible. La caisse doit le proposer, pas afficher une erreur.
describe("Clôture mensuelle — Z complémentaire", () => {
  it("refus « complément possible » remonté à l'écran, puis demande avec complement:true", async () => {
    API.fiscal.closure
      .mockRejectedValueOnce(Object.assign(new Error("Le mois 2026-10 est déjà clôturé, mais par un Z fait avant la fin de la période"),
        { status: 409, data: { complementPossible: true, previousAt: "2026-10-08T16:37:16Z", period: "2026-10" } }))
      .mockResolvedValueOnce({ id: "zc", closure_type: "monthly", period: "2026-10", complement_index: 1,
        covers_from: "2026-10-08T16:37:16Z", ticket_count: 40, total_ttc: "5200.00", grand_total: "1" });
    mount();
    let r1, r2;
    await act(async () => { r1 = await ctx.createClosure("monthly", null, null); });
    expect(r1).toMatchObject({ complementPossible: true, period: "2026-10" });
    await act(async () => { r2 = await ctx.createClosure("monthly", null, null, null, { complement: true }); });
    expect(API.fiscal.closure.mock.calls[1][0]).toMatchObject({ type: "monthly", complement: true });
    expect(r2.complementIndex).toBe(1);
    expect(ctx.closures[0].coversFrom).toBe("2026-10-08T16:37:16Z");
  });
});

// Échange : avoir de 100 € contre un article de 60 € -> seuls 60 € sont utilisés (40 € restent)
describe("Avoir en paiement — plafonné au panier", () => {
  it("avoir 100 € sur un panier de 60 € : 60 € utilisés, reste à payer 0", () => {
    mount();
    act(() => { ctx.addToCart(prod({ price: 60 }), variant()); });
    act(() => { ctx.setSelectedAvoir({ avoirNumber: "AV-2026-000009", totalTTC: 100, remaining: 100, applied: 100 }); });
    expect(ctx.avoirPayment).toBe(60);
    expect(ctx.cartTotals.tTTC).toBe(0);
  });
});

// L'avoir est débité par le serveur DANS la vente : la caisse ne fait plus de 2e appel,
// et une vente hors-ligne transmet l'avoir à débiter lors de la synchronisation.
describe("Avoir en paiement — débit atomique côté serveur", () => {
  it("hors-ligne : la vente mise en file porte l'avoir à débiter (plus de file consumeAvoir séparée)", async () => {
    API.sales.checkout.mockRejectedValue(new TypeError("Failed to fetch"));
    mount();
    act(() => { ctx.addToCart(prod({ price: 60 }), variant()); });
    act(() => { ctx.setSelectedAvoir({ avoirNumber: "AV-2026-000009", totalTTC: 100, remaining: 100, applied: 100 }); });
    await act(async () => { await ctx.checkout([{ method: "avoir", amount: 60 }], "V"); });
    const vente = ctx.pendingSync.find(x => x.type === "offlineSale");
    expect(vente.data.avoirUsed).toEqual({ avoirNumber: "AV-2026-000009", amount: 60 });
    expect(ctx.pendingSync.some(x => x.type === "consumeAvoir")).toBe(false);
  });
});

// Idempotence : le même identifiant de vente est envoyé en ligne et conservé dans la file hors-ligne
describe("Vente : identifiant unique (pas de doublon à la synchro)", () => {
  it("la vente mise en file hors-ligne porte un clientSaleId (UUID) et le vendeur", async () => {
    API.sales.checkout.mockRejectedValue(new TypeError("Failed to fetch"));
    mount();
    act(() => { ctx.addToCart(prod(), variant()); });
    await act(async () => { await ctx.checkout([{ method: "cash", amount: 209 }], "Vendeur"); });
    const envoi = API.sales.checkout.mock.calls[0][0];
    const file = ctx.pendingSync.find(x => x.type === "offlineSale").data;
    expect(envoi.clientSaleId).toMatch(/^[0-9a-f-]{36}$/);
    expect(file.clientSaleId).toBe(envoi.clientSaleId);
  });
});
