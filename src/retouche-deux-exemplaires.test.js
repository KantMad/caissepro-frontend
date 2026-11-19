// @vitest-environment jsdom
// Bon de retouche (19/11/2026) : imprime en DEUX exemplaires (client puis boutique), marques sur tous les canaux.
import { describe, it, expect } from "vitest";
import { SunmiPrinterAdapter, BrowserPrintAdapter, PAXPrinterAdapter } from "./hardware.js";
import { ThermalPrinter } from "./printer.js";

const bon = { num: "RET-2026-0042", shortCode: "0042", client: "Ines Demo", phone: "0600000003", date: "2026-11-19T10:00:00Z",
  dateRetrait: "2026-11-24", items: [{ desc: "Ourlet pantalon", price: "15" }], total: 15, seller: "Fred" };
const S = { name: "MCS" };

describe("bon de retouche — mention de l'exemplaire", () => {
  it("Sunmi (lot de commandes)", () => {
    const t = (b) => new SunmiPrinterAdapter()._buildRetoucheBatch(b, S, {}).filter(c => c.cmd === "text").map(c => c.text).join("");
    expect(t({ ...bon, _exemplaire: "client" })).toMatch(/EXEMPLAIRE CLIENT/);
    expect(t({ ...bon, _exemplaire: "boutique" })).toMatch(/EXEMPLAIRE BOUTIQUE/);
    expect(t(bon)).not.toMatch(/EXEMPLAIRE/);
  });
  it("PAX / iMin (texte)", async () => {
    const p = new PAXPrinterAdapter(); let out = ""; p.printText = async (x) => { out += x; }; p._cap = async () => {};
    await p.printRetouche({ ...bon, _exemplaire: "boutique" }, S, {});
    expect(out).toMatch(/EXEMPLAIRE BOUTIQUE/);
  });
  it("Navigateur (iframe)", async () => {
    const b = new BrowserPrintAdapter(); let h = ""; b._printViaIframe = (x) => { h = x; };
    await b.printRetouche({ ...bon, _exemplaire: "client" }, S, {});
    expect(h).toMatch(/EXEMPLAIRE CLIENT/);
  });
  it("ESC/POS Web Serial", async () => {
    const p = new ThermalPrinter(); p.connected = true; let out = "";
    p.text = async (x) => { out += x; };
    await p.printRetouche({ ...bon, _exemplaire: "boutique" }, S, {});
    expect(out).toMatch(/EXEMPLAIRE BOUTIQUE/);
  });
});
