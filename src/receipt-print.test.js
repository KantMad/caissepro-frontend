// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { SunmiPrinterAdapter, BrowserPrintAdapter } from "./hardware.js";

const tk = {
  ticketNumber: "2026-000123", date: "2026-10-27T10:00:00Z", userName: "Fred", customerName: "Mme Dupont",
  totalHT: 91.4, totalTVA: 13.6, totalTTC: 105, barcode: "2000000001234", fingerprint: "ABCDEF0123456789",
  saleNote: "Retouche ourlet", payments: [{ method: "cash", amount: 105 }], cashGiven: 110, changeGiven: 5,
  items: [
    { product_name: "Veste", variant_color: "Noir", variant_size: "M", quantity: 2, unit_price: 25, tax_rate: 0.2, line_ttc: 60 },
    { product_name: "Livre", quantity: 1, unit_price: 52.13, tax_rate: 0.055, line_ttc: 55, is_custom: true },
  ],
};
const sunmiTexte = (t) => new SunmiPrinterAdapter()._buildReceiptBatch(t, { name: "MCS" }, {})
  .filter(c => c.cmd === "text").map(c => c.text).join("");
let html = "";
const navigateur = async (t) => { const b = new BrowserPrintAdapter(); b._printViaIframe = (h) => { html = h; }; await b.printReceipt(t, { name: "MCS" }, {}); return html; };

describe("ticket de vente — contenu imprime", () => {
  it("Sunmi : TVA par taux, prix unitaire, rendu, points arrondis comme le serveur", () => {
    const x = sunmiTexte(tk);
    expect(x).toMatch(/TVA 5\.5%/); expect(x).toMatch(/TVA 20%/);
    expect(x).toMatch(/2 x 30\.00/);
    expect(x).toMatch(/Rendu\s+5\.00/);
    expect(x).toMatch(/Fidelite: \+105pts/);
    expect(x).not.toMatch(/DUPLICATA/);
  });
  it("Sunmi : duplicata marque, ticket cadeau sans prix ni acheteur ni points", () => {
    expect(sunmiTexte({ ...tk, _duplicata: true })).toMatch(/DUPLICATA/);
    const g = sunmiTexte({ ...tk, _giftCard: true });
    expect(g).toMatch(/TICKET CADEAU/);
    expect(g).not.toMatch(/EUR|Dupont|Fidelite|DUPLICATA/);
  });
  it("Navigateur : genere depuis les donnees (cadeau sans prix, duplicata)", async () => {
    document.body.innerHTML = '<div data-print-receipt>APERCU COMPLET 105.00</div>';
    const g = await navigateur({ ...tk, _giftCard: true });
    expect(g).toMatch(/TICKET CADEAU/); expect(g).not.toMatch(/EUR|APERCU|Dupont/);
    const d = await navigateur({ ...tk, _duplicata: true });
    expect(d).toMatch(/DUPLICATA/); expect(d).toMatch(/TVA 5\.5%/); expect(d).toMatch(/Retouche ourlet/); expect(d).toMatch(/Rendu/);
  });
});

import { PAXPrinterAdapter } from "./hardware.js";
describe("ticket texte (PAX/iMin)", () => {
  const pax = async (t) => { let out = ""; const a = new PAXPrinterAdapter(); a.printText = async (x) => { out = x; }; await a.printReceipt(t, { name: "MCS" }, {}); return out; };
  it("cadeau sans prix ; vente avec TVA par taux, paiement, rendu, note", async () => {
    const g = await pax({ ...tk, _giftCard: true });
    expect(g).toMatch(/TICKET CADEAU/); expect(g).not.toMatch(/\d+\.\d\dE|Dupont|NF525/);
    const v = await pax({ ...tk, _duplicata: true, payments: [{ method: "contactless", amount: 105 }] });
    expect(v).toMatch(/DUPLICATA/); expect(v).toMatch(/TVA 20%/); expect(v).toMatch(/SANS CONTACT/); expect(v).toMatch(/Retouche ourlet/);
  });
});

import { ThermalPrinter } from "./printer.js";
describe("ticket ESC/POS", () => {
  const esc = async (t) => {
    const p = new ThermalPrinter(); let out = "";
    p.connected = true; p.send = async () => {}; p.barcode = async () => {};
    p.text = async (x) => { out += x; }; p.newline = async () => { out += "\n"; };
    p.line = async (l, r = "") => { out += `${l} ${r}\n`; };
    await p.printReceipt(t, { name: "MCS" }, {}); return out;
  };
  it("TVA par taux, duplicata, rendu (paiement mixte), note serveur ; cadeau sans prix", async () => {
    const v = await esc({ ...tk, _duplicata: true, saleNote: undefined, sale_note: "Note serveur",
      payments: [{ method: "card", amount: 50 }, { method: "cash", amount: 55 }] });
    expect(v).toMatch(/DUPLICATA/); expect(v).toMatch(/TVA 5\.5%/); expect(v).toMatch(/Rendu: 5\.00/); expect(v).toMatch(/Note serveur/);
    const g = await esc({ ...tk, _giftCard: true });
    expect(g).toMatch(/TICKET CADEAU/); expect(g).not.toMatch(/€|Dupont|Fidelite/);
  });
});
