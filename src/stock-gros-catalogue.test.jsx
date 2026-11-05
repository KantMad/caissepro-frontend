// @vitest-environment jsdom
//
// Gros catalogue (import gestlog/TIO : ~50 000 variantes chez MCS) : l'ecran Stock figeait la
// tablette (Inventaire : 20 s a l'ouverture, 1,5 s par chiffre tape) car il affichait tout le
// catalogue dans des listes deroulantes et un tableau. Il ne doit afficher qu'un nombre borne de
// lignes, et la recherche doit toujours trouver un article au-dela de ces premieres lignes.
import { describe, it, expect, vi } from "vitest";
import { render, waitFor, fireEvent, act } from "@testing-library/react";
import React from "react";
vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
vi.mock("./api.js", () => {
  const ns = (fixes = {}) => new Proxy(fixes, { get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : () => Promise.resolve([]))) });
  const N = 2000;
  const P = Array.from({ length: N }, (_, i) => ({ id: "p" + i, name: "Article " + i, sku: "SKU" + i, price: "50.00", tax_rate: "0.2000", active: true,
    variants: ["XS","S","M","L","XL"].map((s, j) => ({ id: `v${i}_${j}`, color: "Noir", size: s, ean: String(3000000000000 + i * 10 + j), stock: i < 200 ? 10 : 0, stock_alert: 3, deja_stocke: true })) }));
  return {
    setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: () => {}, getToken: () => "t", clearToken: () => {}, getStoreId: () => "s1",
    products: ns({ list: () => Promise.resolve(P) }), sales: ns(), fiscal: ns(), audit: ns(), settings: ns(),
    customers: ns(), returns: ns(), giftcards: ns(), parked: ns(), stores: ns(), auth: ns(), favorites: ns(), stock: ns({ adjust: (d) => { (globalThis.__ajustements ||= []).push(d); return Promise.resolve({ ok: true }); } }), tenues: ns(), transfers: ns(), users: ns(), retouches: ns(), cashMovements: ns(), promos: ns(),
    health: () => Promise.resolve({ status: "ok" }),
  };
});
import AppProvider, { useApp } from "./context.jsx";
import { StockScreen } from "./screens/index.js";
if (typeof globalThis.ResizeObserver === "undefined") globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

describe("Stock : gros catalogue", () => {
  it("listes et inventaire bornes, recherche au-dela des premieres lignes", async () => {
    sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u1", name: "Admin", role: "admin" }));
    sessionStorage.setItem("caissepro_store", JSON.stringify({ id: "s1", name: "Boutique" }));
    sessionStorage.setItem("caissepro_mode", "dashboard");
    let ctx; const H = () => { ctx = useApp(); return null; };
    const r = render(<AppProvider><H /><StockScreen /></AppProvider>);
    await waitFor(() => expect(ctx.products.length).toBe(2000), { timeout: 30000 });
    const onglet = async (t) => { const b = r.getAllByText(t); await act(async () => { fireEvent.click(b[b.length - 1]); }); };
    // Matrice : 100 articles + « autres articles », pas 2 000 options
    expect(r.container.querySelectorAll("select option").length).toBeLessThanOrEqual(102);
    expect(r.container.textContent).toMatch(/1900 autre\(s\) article\(s\)/);
    await act(async () => { fireEvent.change(r.getByPlaceholderText("Rechercher produit (nom, SKU, EAN)..."), { target: { value: "SKU1999" } }); });
    expect([...r.container.querySelectorAll("select option")].map(o => o.textContent)).toContain("Article 1999 (SKU1999)");
    // Inventaire : 200 lignes au plus sur 10 000 variantes ; la recherche par EAN trouve le dernier article
    await onglet("Inventaire");
    await waitFor(() => expect(r.container.querySelectorAll('input[type="number"][min="0"]').length).toBe(200));
    expect(r.container.textContent).toMatch(/9800 autre\(s\) variante\(s\)/);
    await act(async () => { fireEvent.change(r.getAllByPlaceholderText("Rechercher produit (nom, SKU, EAN)...").at(-1), { target: { value: "3000000019994" } }); });
    expect(r.container.querySelectorAll('input[type="number"][min="0"]').length).toBe(5); // ses 5 tailles
    expect(r.container.textContent).toMatch(/Article 1999/);
    // Transferts et Défectueux : listes bornees, avec recherche
    for (const t of ["Transferts", "Défectueux"]) {
      await onglet(t);
      for (const s of r.container.querySelectorAll("select")) expect(s.options.length, t).toBeLessThanOrEqual(102);
    }
    // Import CSV stock : de nouveau accessible depuis Reception ; remplacement par EAN, index
    // (avant : chaque ligne reparcourait tout le catalogue), y compris une remise a 0
    await onglet("Réception");
    fireEvent.click(r.getByText("Import CSV stock"));
    fireEvent.click(r.getByText("Remplacer le stock"));
    const csv = new File(["EAN;Quantite;Article\n3000000019994;7;Article 1999\n3000000000000;0;Article 0\n1234;3;Inconnu\n"], "alignement.csv", { type: "text/csv" });
    fireEvent.change(r.getByText(/CSV avec colonnes/).parentElement.querySelector('input[type="file"]'), { target: { files: [csv] } });
    fireEvent.click(await r.findByText(/Analyser et previsualiser/));
    expect(r.getByText("2 trouves")).toBeTruthy();
    expect(r.getByText("1 non trouves")).toBeTruthy();
    await act(async () => { fireEvent.click(r.getByText(/Remplacer le stock — 2 ligne/)); });
    await waitFor(() => expect((globalThis.__ajustements || []).map(a => `${a.variantId}:${a.newStock}`)).toEqual(["v1999_4:7", "v0_0:0"]));
    fireEvent.click(r.container.ownerDocument.querySelector('[aria-label="Fermer"]') || r.getAllByText(/Fermer/).at(-1));
    // Alertes : 1 800 ruptures (articles 200 a 1 999 deja stockes puis a 0) -> 200 affichees
    await onglet("Alertes");
    expect(r.container.textContent).toMatch(/alertes — affichage des 200 premières/);
  }, 60000);
});
