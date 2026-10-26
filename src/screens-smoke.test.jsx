// @vitest-environment jsdom
//
// Test de FUMÉE des écrans : on les monte pour de vrai dans le provider.
// Objectif : attraper les plantages au rendu (variable non définie, import manquant)
// que `vite build` ne voit pas — ils n'apparaissaient qu'à l'écran, en production.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
// Simulacre d'API avec des donnees REALISTES, au format exact du serveur :
// snake_case, montants NUMERIC renvoyes en CHAINES par PostgreSQL, champs parfois nuls.
// C'est la forme qui fait planter un ecran, pas le tableau vide.
vi.mock("./api.js", () => {
  const STORE = "s1";
  const VENTE = {
    id: "sale1", ticket_number: "2026-000045", seq: 45, store_id: STORE,
    total_ht: "282.91", total_tva: "56.59", total_ttc: "339.50", margin: "155.59",
    global_discount: "10.00", grand_total: "8990.25", created_at: "2026-10-20T09:24:43.000Z",
    user_name: "Sophie", seller_name: "Sophie", customer_id: "c1", customer_name: "Inès Démo",
    payment_method: "card", sale_note: null, fingerprint: "DA2A575D393BC816", ticket_hash: "a".repeat(64),
    is_training: false,
    items: [{ id: "i1", product_id: "p1", variant_id: "v1", product_name: "Jean droit coupe mom",
      variant_color: "Bleu", variant_size: "38", quantity: 2, unit_price: "62.42", cost_price: "20.00",
      tax_rate: "0.2000", discount_percent: "10.00", line_ht: "112.35", line_tva: "22.47", line_ttc: "134.82",
      is_custom: false, sku: "DEMO-JN02", ean: "2996000000028", category: "Jeans", collection: "Femme", color_code: "001" },
      { id: "i2", product_id: null, variant_id: null, product_name: "Retouche: ourlet", variant_color: null,
        variant_size: null, quantity: 1, unit_price: "16.67", cost_price: "0", tax_rate: "0.2000",
        discount_percent: "0", line_ht: "16.67", line_tva: "3.33", line_ttc: "20.00", is_custom: true }],
    payments: [{ method: "card", amount: "339.50" }],
  };
  const AVOIR = { id: "a1", avoir_number: "AV-2026-000001", original_ticket: "2026-000045",
    amount: "59.90", total_ht: "49.92", total_tva: "9.98", total_ttc: "59.90", remaining: "59.90",
    refund_method: "avoir", reason: "Taille", user_name: "Sophie", customer_name: null,
    is_exchange: false, used_in_ticket: null, created_at: "2026-10-20T10:00:00.000Z", fingerprint: "ABCD1234",
    items: [{ product_id: "p1", variant_id: "v1", product_name: "Jean droit", variant_color: "Bleu",
      variant_size: "38", quantity: 1, unit_price: "59.90", line_ht: "49.92", line_tva: "9.98", line_ttc: "59.90",
      sku: "DEMO-JN02", ean: "2996000000028" }] };
  const PRODUIT = { id: "p1", name: "Jean droit coupe mom", sku: "DEMO-JN02", price: "74.90",
    cost_price: "30.00", tax_rate: "0.2000", category: "Jeans", collection: "Femme", active: true,
    store_id: STORE, created_at: "2026-09-01T00:00:00.000Z",
    variants: [{ id: "v1", color: "Bleu", color_code: "001", size: "38", ean: "2996000000028", stock: 4, stock_alert: 3 },
               { id: "v2", color: "Écru", color_code: "", size: "40", ean: null, stock: 0, stock_alert: 3 }] };
  const CLIENT = { id: "c1", first_name: "Inès", last_name: "Démo", email: "ines@example.com",
    phone: "0600000003", city: "Bordeaux", points: 310, total_spent: "806.09", notes: null };
  const CLOTURE = { id: "z1", closure_number: "Z-2026-000012", total_ht: "7491.88", total_tva: "1498.37",
    total_ttc: "8990.25", total_sales: 45, cash_expected: "1200.00", cash_counted: "1198.50",
    created_at: "2026-10-19T19:00:00.000Z", user_name: "Admin", grand_total: "8990.25", fingerprint: "ZZZ123" };
  const MOUVEMENT = { id: "m1", movement_number: "MV-2026-000003", kind: "in", direction: "in",
    amount: "150.00", reason: "Apport", user_name: "Admin", created_at: "2026-10-20T08:00:00.000Z" };
  const SESSION = { id: "r1", opened_at: "2026-10-20T08:00:00.000Z", closed_at: null,
    opening_amount: "200.00", closing_amount: null, user_name: "Sophie" };
  const liste = (v) => () => Promise.resolve(v);
  const ns = (fixes = {}, defaut = []) => new Proxy(fixes, {
    get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : () => Promise.resolve(defaut))),
  });
  const mod = {
    setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: () => {}, getToken: () => "t", clearToken: () => {}, getStoreId: () => STORE,
    sales: ns({ list: liste([VENTE]), stats: liste({ totalTTC: "339.50", count: 1 }) }),
    products: ns({ list: liste([PRODUIT]), exportCSV: () => "http://x" }),
    customers: ns({ list: liste([CLIENT]) }),
    returns: ns({ list: liste([AVOIR]), counter: liste({ seq: 1 }) }),
    fiscal: ns({ closures: liste([CLOTURE]), counter: liste({ grand_total: "8990.25", seq: 45 }),
      // Veille non cloturee (cas Fred) + une tres ancienne journee oubliee (cas du 12 mai).
      pendingClosures: liste((() => { const k = (n) => { const d = new Date(); d.setDate(d.getDate() - n);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
        return { today: k(0), timezone: "Europe/Paris", days: [
          { day: k(167), ticket_count: 13, total_ttc: "1240.00" },
          { day: k(1), ticket_count: 7, total_ttc: "555.60" }] }; })()) }),
    cashMovements: ns({ list: liste([MOUVEMENT]), exportUrl: () => "http://x" }),
    settings: ns({ get: liste({ name: "Boutique", pricingMode: "TTC", gestlogEnabled: true }) }),
    stores: ns({ list: liste([{ id: STORE, name: "Boutique" }]) }),
    exports: ns({ url: () => "http://x", salesDetailUrl: () => "http://x" }),
    integrations: ns({ gestlogDeliveries: liste([]), gestlogCatalogImports: liste([]) }),
    audit: ns({ list: liste([{ id: "au1", action: "VENTE", detail: "Ticket", user_name: "Sophie", created_at: "2026-10-20T09:00:00.000Z" }]) }),
  };
  for (const n of ["auth", "stock", "giftcards", "parked", "pricehistory", "favorites",
                   "footfall", "retouches", "tenues", "barcodes", "customerDisplay", "backup",
                   "productPhotos", "health"]) if (!mod[n]) mod[n] = ns();
  mod.settings = ns({ get: liste({ name: "Boutique", pricingMode: "TTC", gestlogEnabled: true }),
                      registerSessions: liste([SESSION]) });
  return mod;
});

import AppProvider from "./context.jsx";
import {
  SalesScreen, StatsScreen, StockScreen, HistoryScreen, ReturnScreen, ClosureScreen,
  CustomersScreen, FiscalScreen, AuditScreen, ProductsScreen, LabelsScreen,
  ReturnsHistoryScreen, SettingsScreen, GiftCardScreen, PromosScreen, FootfallScreen,
  HelpCashierScreen, HelpDashboardScreen, ExportsScreen, GestlogDeliveriesScreen,
  TiroirCaisseScreen, CashMovementsScreen, RegisterSessionsScreen, MobileStatsScreen,
  CashRegControl, CSVImportWizard,
} from "./screens/index.js";
import { UsersScreen, DashOverview, TVAScreen } from "./nav.jsx";

// Un admin en session : sans cela les ecrans affichent « Acces reserve aux administrateurs »
const asAdmin = () => {
  sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u1", name: "Admin", role: "admin" }));
  sessionStorage.setItem("caissepro_store", JSON.stringify({ id: "s1", name: "Boutique" }));
  sessionStorage.setItem("caissepro_mode", "dashboard");
};

// recharts (graphiques des stats) exige ResizeObserver, absent de jsdom
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}

const errors = [];
beforeEach(() => {
  asAdmin(); errors.length = 0; vi.spyOn(console, "error").mockImplementation((...a) => errors.push(a.join(" "))); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Écrans — rendu sans plantage", () => {
  // Monte CHAQUE écran de l'application. Un écran qui plante au rendu
  // (variable oubliée, import manquant, champ absent) échoue ici.
  const ECRANS = [
    ["Vente", SalesScreen], ["Statistiques", StatsScreen], ["Résumé mobile", MobileStatsScreen],
    ["Stock", StockScreen], ["Tickets", HistoryScreen], ["Retour", ReturnScreen],
    ["Clôture", ClosureScreen], ["Clients", CustomersScreen], ["Fiscal", FiscalScreen],
    ["Journal d'audit", AuditScreen], ["Produits", ProductsScreen], ["Étiquettes", LabelsScreen],
    ["Retours & avoirs", ReturnsHistoryScreen], ["Paramètres", SettingsScreen],
    ["Cartes cadeaux", GiftCardScreen], ["Promotions", PromosScreen], ["Entrées", FootfallScreen],
    ["Aide caisse", HelpCashierScreen], ["Aide dashboard", HelpDashboardScreen],
    ["Exports", ExportsScreen], ["Livraisons gestlog", GestlogDeliveriesScreen],
    ["Tiroir-caisse (caisse)", TiroirCaisseScreen], ["Tiroir-caisse (dashboard)", CashMovementsScreen],
    ["Ouv./Ferm. caisse", RegisterSessionsScreen], ["Ouverture de caisse", CashRegControl],
    ["Utilisateurs", UsersScreen],
    ["Vue d'ensemble", DashOverview], ["Taux de TVA", TVAScreen],
  ];

  for (const [nom, Ecran] of ECRANS) {
    it(`${nom} se monte`, () => {
      const { container } = render(<AppProvider><Ecran /></AppProvider>);
      expect(errors.join("\n"), nom).not.toMatch(/is not defined|Cannot read|is not a function/);
      expect(container.textContent.length, nom).toBeGreaterThan(0);
    });
  }

  it("Import CSV se monte (modale ouverte)", () => {
    const { container } = render(<AppProvider>
      <CSVImportWizard open onClose={() => {}} existingProducts={[]} onImportComplete={() => {}} />
    </AppProvider>);
    expect(errors.join("\n")).not.toMatch(/is not defined|Cannot read|is not a function/);
    expect(container.textContent.length).toBeGreaterThan(0);
  });

  it("Clôture : annonce la journée NON clôturée de la veille (cas Fred, 09/10)", async () => {
    const { findByText, container } = render(<AppProvider><ClosureScreen /></AppProvider>);
    await findByText(/Journée non clôturée/);
    expect(container.textContent).toMatch(/555\.60/);
    expect(container.textContent).toMatch(/porte sur cette journée/);
  });

  it("Clôture : une très ancienne journée oubliée ne prend pas le Z du jour (cas 12 mai)", async () => {
    const { findByText, container } = render(<AppProvider><ClosureScreen /></AppProvider>);
    await findByText(/Anciennes journées jamais clôturées \(1\)/);
    expect(container.textContent).toMatch(/13 ticket\(s\), 1240\.00/);   // listée à part, en Z tardif
    expect(container.textContent).toMatch(/Z tardif/);
    expect(container.textContent).not.toMatch(/Journée non clôturée : [a-z]+ 12 mai/);
  });

  it("Stock : tous les onglets s'ouvrent", () => {
    // Le plantage « trPreview is not defined » n'apparaissait que sur l'onglet Tenues.
    const { getAllByText } = render(<AppProvider><StockScreen /></AppProvider>);
    for (const t of ["Matrice", "Réception", "Alertes", "Mouvements", "Inventaire",
                     "Ajustement", "Défectueux", "Tenues", "Transferts", "Vieillissement"]) {
      const b = getAllByText(t);
      fireEvent.click(b[b.length - 1]);
      expect(errors.join("\n"), `onglet ${t}`).not.toMatch(/is not defined|Cannot read|is not a function/);
    }
  });

  it("Statistiques : tous les onglets s'ouvrent", () => {
    const { getAllByText, container } = render(<AppProvider><StatsScreen /></AppProvider>);
    for (const t of ["Évolution CA", "Comparaison", "CA par heure", "CA par jour", "Best-sellers",
                     "Détail variantes", "Par vendeur", "Tailles/Couleurs", "Collections",
                     "Clients", "Retours", "Paiements", "Remises"]) {
      const b = getAllByText(t);
      fireEvent.click(b[b.length - 1]);
      expect(errors.join("\n"), `onglet ${t}`).not.toMatch(/is not defined|Cannot read|is not a function/);
    }
    expect(container.textContent).toMatch(/\d+\.\d{2}€/);   // montants au centime
  });
});
