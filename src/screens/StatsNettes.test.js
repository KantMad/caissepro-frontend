// Chiffres nets des statistiques (MCS 26/11/2026 : un echange d'une vente de mardi comptait
// une vente de plus et gonflait le CA).
import { describe, it, expect } from "vitest";
import { statsNettes } from "./StatsScreen.jsx";

describe("statsNettes", () => {
  it("echange a prix egal : CA = vente d'origine, ticket d'echange non recompte", () => {
    const s = statsNettes({ ticket_count: 2, total_ttc: "168.00", total_ht: "140.00", total_margin: "120.00", total_pieces: "2",
      returns_count: 1, returns_ttc: 84, exchange_count: 1, net_ttc: 84, net_ht: 70, net_margin: 60, net_ticket_count: 1, net_pieces: 1 });
    expect(s).toMatchObject({ tTTC: 84, tHT: 70, margin: 60, count: 1, pieces: 1, avg: 84, upt: 1, brutTTC: 168, retoursTTC: 84, echanges: 1 });
  });
  it("ancienne API sans champs nets : chiffres bruts", () => {
    const s = statsNettes({ ticket_count: 4, total_ttc: "200", total_ht: "166.67", total_margin: "50", total_pieces: "6" });
    expect(s).toMatchObject({ tTTC: 200, count: 4, avg: 50, upt: 1.5, retoursTTC: 0, echanges: 0 });
  });
});
