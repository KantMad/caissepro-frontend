// Moyen de paiement « Virement » (MCS 17/11/2026) : recu hors caisse, la vente est marquee
// « transfer ». Libelle identique sur les 5 canaux d'impression (libellePaiementTicket partage),
// ventile dans les reglements du Z.
import { describe, it, expect } from "vitest";
import { libellePaiementTicket, getPaymentLabel, aggregatePaymentsByMethod, PAYMENT_METHODS } from "./lib/formatters.js";

describe("Paiement par virement", () => {
  it("libelles ticket et ecran", () => {
    expect(libellePaiementTicket("transfer")).toBe("VIREMENT");
    expect(getPaymentLabel("transfer")).toBe("Virement");
    expect(getPaymentLabel("transfer", "short")).toBe("VIR");
  });
  it("ventile dans les reglements (Z hors ligne, stats)", () => {
    expect(PAYMENT_METHODS).toContain("transfer");
    const r = aggregatePaymentsByMethod([{ payments: [{ method: "transfer", amount: 70 }, { method: "cash", amount: 30 }] }, { payments: [{ method: "transfer", amount: 100 }] }]);
    expect(r.transfer).toBe(170);
    expect(r.cash).toBe(30);
  });
});
