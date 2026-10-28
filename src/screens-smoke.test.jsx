// @vitest-environment jsdom
//
// Test de FUMÉE des écrans : on les monte pour de vrai dans le provider.
// Objectif : attraper les plantages au rendu (variable non définie, import manquant)
// que `vite build` ne voit pas — ils n'apparaissaient qu'à l'écran, en production.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  // impression navigateur : toute methode (printReceipt, printAvoir…) reussit
  BrowserPrintAdapter: class { constructor() { return new Proxy(this, { get: (t, k) => (k === "then" ? undefined : () => Promise.resolve(true)) }); } },
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
  // Colonnes REELLES de la table closures (RETURNING *) : NUMERIC en chaines
  const CLOTURE = { id: "z1", closure_type: "daily", period: "2026-10-19", ticket_count: 45,
    total_ht: "7491.88", total_tva: "1498.37", total_ttc: "8990.25", total_margin: "3100.00",
    grand_total: "8990.25", expected_cash: "1200.00", actual_cash: "1198.50", actual_card: "5230.40",
    cash_diff: "-1.50", fingerprint: "ZZZ123", hash: "f".repeat(64), store_id: STORE, user_id: "u1",
    complement_index: 0, covers_from: null, created_at: "2026-10-19T19:00:00.000Z", user_name: "Admin" };
  // Reponse de POST /api/fiscal/closure : la ligne + les details calcules
  const Z_CREE = { ...CLOTURE, id: "z9", period: "2026-10-27", cashIn: 0, cashOut: 0, openingFloat: 200,
    byPayment: { cash: 420.5, card: 1456.6 }, byPaymentCount: { cash: 3, card: 4 },
    tvaByRate: [{ rate: 0.2, ht: 1564.25, tva: 312.85, ttc: 1877.1 }], bySeller: { Sophie: 1877.1 },
    byCategory: [{ category: "Jeans", qty: 3, ttc: 600 }], discounts: { count: 1, amount: 10 },
    cancellations: { count: 0, amount: 0 }, returns: { count: 0, amount: 0 } };
  // Z de la VEILLE fait ce matin (fermeture le lendemain / Z tardif) : cree aujourd'hui, periode = hier.
  const hier = (() => { const d = new Date(); d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const Z_HIER = { id: "z2", closure_type: "daily", period: hier, total_ht: "100.00", total_tva: "20.00",
    total_ttc: "120.00", ticket_count: 2, created_at: new Date().toISOString(), grand_total: "9110.25", fingerprint: "ZH" };
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
    sales: ns({ list: liste([VENTE]), stats: liste({ totalTTC: "339.50", count: 1 }),
      period: liste({ sales: [VENTE], truncated: false }), lookup: liste([{ ...VENTE, id: "old1", ticket_number: "2025-000999", created_at: "2025-03-02T10:00:00.000Z" }]), lastSold: liste([{ product_id: "p1", last_sold_at: "2026-10-20T09:24:43.000Z" }]) }),
    products: ns({ list: liste([PRODUIT]), exportCSV: () => "http://x" }),
    customers: ns({ list: liste([CLIENT]) }),
    returns: ns({ list: liste([AVOIR]), counter: liste({ seq: 1 }) }),
    fiscal: ns({ closures: liste([Z_HIER, CLOTURE]), closure: liste(Z_CREE), tvaSummary: liste([{ rate: "20%", ventesHT: 100, ventesTVA: 20, avoirsHT: 10, avoirsTVA: 2, baseHT: 90, tva: 18 }]), counter: liste({ grand_total: "8990.25", seq: 45 }),
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

  it("Fiscal : l'onglet TVA charge la période depuis le serveur", async () => {
    const { getAllByText, findByText } = render(<AppProvider><FiscalScreen /></AppProvider>);
    const t = getAllByText("TVA"); fireEvent.click(t[t.length - 1]);
    expect(await findByText(/20%/)).toBeTruthy();
    expect(errors.join("\n")).not.toMatch(/is not defined|Cannot read|is not a function/);
  });

  it("Fiscal : l'onglet Formation renvoie vers la démo (plus de bouton mode formation)", () => {
    const { getAllByText, container } = render(<AppProvider><FiscalScreen /></AppProvider>);
    const t = getAllByText("Formation"); fireEvent.click(t[t.length - 1]);
    expect(container.textContent).toMatch(/demo\.techincash\.app/);
    expect(container.textContent).not.toMatch(/Mode production/);
  });

  it("Statistiques : best-sellers nets de la remise globale du panier (prorata HT)", async () => {
    // Jean 134,82 € TTC ; remise panier 10 € HT sur 129,02 € HT de lignes -> 124,37 € net
    const { getAllByText, findAllByText, container } = render(<AppProvider><StatsScreen /></AppProvider>);
    const b = getAllByText("Best-sellers"); fireEvent.click(b[b.length - 1]);
    await findAllByText(/124[.,]37/);
    expect(container.textContent).not.toMatch(/134[.,]82/);
  });

  it("Vente : un Z de la veille fait ce matin ne déclare pas la caisse clôturée", async () => {
    const { findAllByText, container } = render(<AppProvider><SalesScreen /></AppProvider>);
    await findAllByText(/./);
    await new Promise(r => setTimeout(r, 50));   // chargement des clotures
    expect(container.textContent).not.toMatch(/Z du jour déjà fait/);
  });

  it("Clôture : une très ancienne journée oubliée ne prend pas le Z du jour (cas 12 mai)", async () => {
    const { findByText, container } = render(<AppProvider><ClosureScreen /></AppProvider>);
    await findByText(/Anciennes journées jamais clôturées \(1\)/);
    expect(container.textContent).toMatch(/13 ticket\(s\), 1240\.00/);   // listée à part, en Z tardif
    expect(container.textContent).toMatch(/Z tardif/);
    expect(container.textContent).not.toMatch(/Journée non clôturée : [a-z]+ 12 mai/);
  });

  it("Clôture : Z du jour déjà fait puis ventes -> bouton Z complémentaire, sans comptage (cas 28/10/2026)", async () => {
    const API = await import("./api.js");
    const jour = new Date(); const k = `${jour.getFullYear()}-${String(jour.getMonth() + 1).padStart(2, "0")}-${String(jour.getDate()).padStart(2, "0")}`;
    const avant = { closures: API.fiscal.closures, pendingClosures: API.fiscal.pendingClosures, closure: API.fiscal.closure };
    const zDuJour = { id: "zj", closure_type: "daily", period: k, ticket_count: 5, total_ht: "100.00", total_tva: "20.00",
      total_ttc: "120.00", grand_total: "9000.00", complement_index: 0, created_at: new Date().toISOString(), fingerprint: "ZJ" };
    API.fiscal.closures = () => Promise.resolve([zDuJour]);
    API.fiscal.pendingClosures = () => Promise.resolve({ today: k, timezone: "Europe/Paris", days: [{ day: k, ticket_count: 2, total_ttc: "80.00" }] });
    const appel = vi.fn(() => Promise.resolve({ ...zDuJour, id: "zc", complement_index: 1, ticket_count: 2, total_ttc: "80.00" }));
    API.fiscal.closure = appel;
    const conf = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      const { findByText } = render(<AppProvider><ClosureScreen /></AppProvider>);
      fireEvent.click(await findByText(/Z complémentaire \(2 vente\(s\) après le Z\)/));
      await waitFor(() => expect(appel).toHaveBeenCalled());
      expect(conf.mock.calls[0][0]).toMatch(/Z COMPLÉMENTAIRE/);
      expect(appel.mock.calls[0][0]).toMatchObject({ type: "daily", date: k, actualCash: null, actualCard: null });
    } finally { Object.assign(API.fiscal, avant); conf.mockRestore(); }
  });

  it("Tickets : l'onglet Retouches s'ouvre (filtre jour local, CA hors bons annulés)", () => {
    const { getAllByText, container } = render(<AppProvider><HistoryScreen /></AppProvider>);
    const b = getAllByText(/^Retouches \(/); fireEvent.click(b[b.length - 1]);
    expect(errors.join("\n")).not.toMatch(/is not defined|Cannot read|is not a function/);
    expect(container.textContent).toMatch(/CA retouches/);
  });

  it("Retour : un ancien ticket (hors des 200 en mémoire) est trouvé via le serveur", async () => {
    const { getByPlaceholderText, findByText } = render(<AppProvider><ReturnScreen /></AppProvider>);
    fireEvent.change(getByPlaceholderText("N° ticket, nom client…"), { target: { value: "2025-000999" } });
    expect(await findByText(/2025-000999/, {}, { timeout: 2000 })).toBeTruthy();
  });

  it("Retour : caissier + ticket hors délai -> validation d'un gérant demandée (plus de blocage sec)", async () => {
    sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u2", name: "Caissier", role: "cashier" }));
    const { getByPlaceholderText, findByText } = render(<AppProvider><ReturnScreen /></AppProvider>);
    fireEvent.change(getByPlaceholderText("N° ticket, nom client…"), { target: { value: "2025-000999" } });
    fireEvent.click(await findByText(/2025-000999/, {}, { timeout: 2000 }));
    expect(await findByText(/Ticket de plus de 30 jours/)).toBeTruthy();
  });

  it("Stock : saisie d'un comptage d'inventaire sans erreur", async () => {
    const { getAllByText, container } = render(<AppProvider><StockScreen /></AppProvider>);
    const b = getAllByText("Inventaire"); fireEvent.click(b[b.length - 1]);
    let champ = null;
    await waitFor(() => { champ = container.querySelector('input[type="number"][min="0"]'); expect(champ).toBeTruthy(); });
    // une erreur levée dans un gestionnaire d'événement remonte à window, pas à console.error
    const pageErr = []; const h = (e) => { pageErr.push(String(e.error || e.message)); e.preventDefault(); };
    window.addEventListener("error", h);
    fireEvent.change(champ, { target: { value: "3" } });
    window.removeEventListener("error", h);
    expect(pageErr).toEqual([]);
    expect(errors.join("\n")).not.toMatch(/is not defined|Cannot read|is not a function/);
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

// ── EXPLORATEUR : chaque élément cliquable de chaque écran mène quelque part ──
// Pour chaque écran, on clique UN PAR UN sur tout ce qui réagit au clic (boutons, lignes de
// liste, onglets…), écran remonté à neuf entre deux clics, confirmations acceptées, API simulée
// au format du serveur. Un clic qui fait planter l'écran (« Erreur détectée ») échoue ici.
// Cas d'origine : Z validé, puis « w.actualCash.toFixed is not a function » (MCS, 28/10/2026).
const propsReact = (el) => { const k = Object.keys(el).find(c => c.startsWith("__reactProps$")); return k ? el[k] : null; };
const NE_PAS_CLIQUER = /Recharger la page|Déconnexion|Se déconnecter/i;
const cliquables = (root) => [...root.querySelectorAll("*")].filter(el => {
  const p = propsReact(el);
  return p && typeof p.onClick === "function" && !el.disabled && !NE_PAS_CLIQUER.test(el.textContent || "");
});
const PLANTAGE = /is not defined|Cannot read|is not a function|is not iterable|Invalid time value|Maximum update depth/;
const attendre = (ms) => new Promise(r => setTimeout(r, ms));

describe("Écrans — chaque clic mène quelque part (explorateur)", () => {
  const ECRANS = [
    ["Vente", SalesScreen], ["Statistiques", StatsScreen], ["Stock", StockScreen], ["Tickets", HistoryScreen],
    ["Retour", ReturnScreen], ["Clôture", ClosureScreen], ["Clients", CustomersScreen], ["Fiscal", FiscalScreen],
    ["Journal d'audit", AuditScreen], ["Produits", ProductsScreen], ["Étiquettes", LabelsScreen],
    ["Retours & avoirs", ReturnsHistoryScreen], ["Paramètres", SettingsScreen], ["Cartes cadeaux", GiftCardScreen],
    ["Promotions", PromosScreen], ["Entrées", FootfallScreen], ["Exports", ExportsScreen],
    ["Tiroir-caisse (caisse)", TiroirCaisseScreen], ["Tiroir-caisse (dashboard)", CashMovementsScreen],
    ["Ouv./Ferm. caisse", RegisterSessionsScreen],
    ["Ouverture de caisse", () => <CashRegControl onSkip={() => {}} onDone={() => {}} />],   // props passées par nav.jsx
    ["Utilisateurs", UsersScreen], ["Vue d'ensemble", DashOverview], ["Taux de TVA", TVAScreen],
  ];
  // Champs remplis comme un caissier (montant, texte, date…) : c'est en VALIDANT un formulaire
  // rempli que le rapport Z plantait, pas sur un formulaire vide.
  const remplir = (root) => {
    const jour = new Date().toISOString().slice(0, 10);
    for (const el of root.querySelectorAll("input, textarea, select")) {
      if (el.disabled || el.readOnly || ["checkbox", "radio", "file", "hidden"].includes(el.type)) continue;
      const v = el.tagName === "SELECT" ? (el.options[1] || el.options[0])?.value
        : el.type === "number" ? "12.5" : el.type === "date" ? jour : el.type === "email" ? "client@exemple.fr"
        : el.type === "tel" ? "0612345678" : el.type === "password" ? "1234" : /search|recherch|cherch/i.test(el.placeholder || el.type) ? "" : "Essai 12";
      if (v != null && el.value !== v) fireEvent.change(el, { target: { value: v } });
    }
  };
  for (const [nom, Ecran] of ECRANS) for (const avecSaisie of [false, true]) {
    it(`${nom} : aucun clic ne fait planter l'écran${avecSaisie ? " (champs remplis)" : ""}`, async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      vi.spyOn(window, "alert").mockImplementation(() => {});
      vi.spyOn(window, "prompt").mockReturnValue("");
      vi.spyOn(window, "open").mockReturnValue(null);
      const pageErr = []; const h = (e) => { pageErr.push(String(e.error?.message || e.message)); e.preventDefault(); };
      window.addEventListener("error", h);
      const pannes = [];
      try {
        // Parcours sur 2 niveaux : chaque clic de l'écran, puis chaque NOUVEL élément cliquable qu'il
        // fait apparaître (boutons d'un onglet, d'une fenêtre…). Écran remonté à neuf à chaque essai.
        const signature = (el) => `${el.tagName}|${(el.textContent || el.getAttribute("title") || "").trim().slice(0, 60)}`;
        const essayer = async (chemin) => {
          cleanup(); const { container } = render(<AppProvider><Ecran /></AppProvider>); await attendre(8);
          let libelle = "";
          for (const i of chemin) {
            const el = cliquables(container)[i];
            if (!el) return null;
            libelle += `${libelle ? " › " : ""}« ${(el.textContent || el.getAttribute("title") || el.tagName).trim().slice(0, 30)} »`;
            errors.length = 0; pageErr.length = 0;
            if (avecSaisie) { remplir(container); await attendre(5); }
            fireEvent.click(cliquables(container)[i] || el); await attendre(8);
            const casse = /Erreur détectée/.test(container.textContent) ? "écran « Erreur détectée »"
              : [...errors, ...pageErr].find(m => PLANTAGE.test(m));
            if (casse) { pannes.push(`clic ${libelle} : ${String(casse).slice(0, 160)}`); return null; }
          }
          return cliquables(container).map(signature);
        };
        const base = await essayer([]);
        let budget = 150;
        for (let i = 0; i < base.length && budget > 0; i++, budget--) {
          const apres = await essayer([i]);
          if (!apres) continue;
          for (let j = 0; j < apres.length && budget > 0; j++) {
            if (base.includes(apres[j])) continue;   // déjà testé au 1er niveau
            budget--; await essayer([i, j]);
          }
        }
      } finally { window.removeEventListener("error", h); }
      expect(pannes, nom).toEqual([]);
    }, 120000);
  }
});

