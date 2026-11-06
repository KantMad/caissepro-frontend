// @vitest-environment jsdom
//
// Facture pour un client professionnel depuis l'ecran Tickets (MCS, 06/11/2026 : « on a oublie la
// possibilite de faire une facture pour les professionnels »). Une caissiere cree la fiche pro
// dans la fenetre Facture, puis emet : le serveur recoit l'identifiant du ticket et du client.
import { describe, it, expect, vi } from "vitest";
import { render, waitFor, fireEvent, screen } from "@testing-library/react";
import React from "react";
import { erreurClient, nomClient } from "./clientPro.jsx";

const TICKET_ID = "11111111-2222-4333-8444-555555555555";
const CLIENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
globalThis.__appels = [];

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
vi.mock("./api.js", () => {
  const ns = (fixes = {}) => new Proxy(fixes, { get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : () => Promise.resolve([]))) });
  return {
    setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: () => {}, getToken: () => "t", clearToken: () => {}, getStoreId: () => "s1",
    products: ns(), sales: ns(), fiscal: ns(), audit: ns(), settings: ns(), returns: ns(), giftcards: ns(), parked: ns(), stores: ns(), auth: ns(), favorites: ns(),
    customers: ns({ create: (d) => { globalThis.__appels.push(["client", d]);
      return Promise.resolve({ id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", first_name: d.firstName, last_name: d.lastName, customer_type: d.customerType,
        company_name: d.companyName, siren: "552100554", address: d.address, postal_code: d.postalCode, city: d.city, email: d.email, points: 0 }); } }),
    invoices: ns({ create: (d) => { globalThis.__appels.push(["facture", d]);
      return Promise.resolve({ id: "f1", invoice_number: "FA-2026-000001", client_company: "Atelier Ferrand", client_name: "Paul Ferrand", total_ttc: "240.00", reprint: false }); } }),
    health: () => Promise.resolve({ status: "ok" }),
  };
});

import AppProvider from "./context.jsx";
import FactureDialog from "./FactureDialog.jsx";

describe("Fiche client professionnel", () => {
  it("raison sociale obligatoire pour un pro ; prenom et nom pour un particulier", () => {
    expect(erreurClient({ customerType: "pro", companyName: " " })).toMatch(/Raison sociale/);
    expect(erreurClient({ customerType: "pro", companyName: "Atelier" })).toBe(null);
    expect(erreurClient({ customerType: "particulier", firstName: "Lea" })).toMatch(/Prénom et nom/);
    expect(nomClient({ customerType: "pro", companyName: "Atelier", firstName: "Paul", lastName: "F" })).toBe("Atelier");
    expect(nomClient({ customerType: "particulier", firstName: "Lea", lastName: "Morel" })).toBe("Lea Morel");
  });
});

describe("Facture depuis l'ecran Tickets", () => {
  it("cree la fiche pro puis emet la facture du ticket a son nom", async () => {
    sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u1", name: "Vendeuse", role: "cashier" }));
    sessionStorage.setItem("caissepro_store", JSON.stringify({ id: "s1", name: "Boutique" }));
    render(<AppProvider><FactureDialog ticket={{ id: TICKET_ID, ticketNumber: "T-000042", totalTTC: 240 }} onClose={() => {}}/></AppProvider>);

    fireEvent.click(await screen.findByText("Nouveau"));
    const champ = (label) => screen.getByText(label).parentElement.querySelector("input");
    fireEvent.change(champ("RAISON SOCIALE *"), { target: { value: "Atelier Ferrand" } });
    fireEvent.change(champ("PRÉNOM DU CONTACT"), { target: { value: "Paul" } });
    fireEvent.change(champ("ADRESSE"), { target: { value: "12 rue des Tanneurs" } });
    fireEvent.click(screen.getByText("Créer la fiche client"));
    await screen.findByText("Atelier Ferrand");

    fireEvent.click(screen.getByText("Émettre la facture"));
    await screen.findByText("FA-2026-000001");
    const [, client] = globalThis.__appels.find(([k]) => k === "client");
    expect(client).toMatchObject({ customerType: "pro", companyName: "Atelier Ferrand", firstName: "Paul", address: "12 rue des Tanneurs" });
    const [, facture] = globalThis.__appels.find(([k]) => k === "facture");
    expect(facture).toMatchObject({ saleId: TICKET_ID, customerId: CLIENT_ID });
    // Navigateur (pas la tablette) : impression A4 proposee, en plus de l'email
    expect(screen.getByText("Imprimer / PDF")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Envoyer")).toBeTruthy());
  });
});
