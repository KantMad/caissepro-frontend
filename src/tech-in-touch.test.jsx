// @vitest-environment jsdom
//
// Tech in touch (17/11/2026) : champs de la fiche client (carte scannée, naissance, civilité,
// taille) visibles seulement si la liaison est active ; panneau Paramètres (ID boutique, offres).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import React, { useState } from "react";

const etat = { settings: { titEnabled: true, titShopId: "12" }, scan: null, appels: [] };
vi.mock("./api.js", () => ({ tit: {
  offers: () => Promise.resolve([{ id: "o1", title_fr: "Retouches offertes", cost_points: 400, active: true, envoyee: true }]),
  status: () => Promise.resolve({ shopId: "12", parStatut: { sent: 5, rejected: 1 }, erreurs: [{ client: "Carte Inconnue", kind: "loyalty", status: "rejected", attempts: 1, last_error: "Unknown barcode (barcode_not_found)" }] }),
  createOffer: (d) => { etat.appels.push(d); return Promise.resolve({ id: "o2", envoiImmediat: true }); },
  updateOffer: () => Promise.resolve({}), retry: () => Promise.resolve({ relances: 1 }), resync: () => Promise.resolve({ clients: 3 }),
} }));
vi.mock("./context.jsx", () => ({ useApp: () => ({ settings: etat.settings, setSettings: () => {}, saveSettingsNotify: () => {}, notify: () => {},
  perm: () => ({ canVoid: true }), setScanOverride: (f) => { etat.scan = f; }, clearScanOverride: () => { etat.scan = null; } }) }));
import { ChampsClient, CLIENT_VIDE, corpsClient } from "./clientPro.jsx";
import TechInTouchPanel from "./screens/TechInTouchPanel.jsx";
import { norm } from "./utils.jsx";

afterEach(() => { cleanup(); etat.settings = { titEnabled: true, titShopId: "12" }; etat.appels.length = 0; });

function Fiche({ onV }) { const [v, set] = useState(CLIENT_VIDE); onV(v); return <ChampsClient v={v} set={set} />; }

describe("Tech in touch", () => {
  it("fiche client : carte scannée, infos envoyées à l'API", async () => {
    let v; const r = render(<Fiche onV={x => { v = x; }} />);
    const carte = r.getByPlaceholderText("TIT…");
    fireEvent.focus(carte);
    await act(async () => { etat.scan("tit0001234567"); });
    expect(v.titBarcode).toBe("TIT0001234567");
    fireEvent.change(r.container.querySelector('input[type="date"]'), { target: { value: "1990-04-12" } });
    fireEvent.change(r.container.querySelector("select"), { target: { value: "mme" } });
    const corps = corpsClient(v);
    expect(corps).toMatchObject({ titBarcode: "TIT0001234567", birthdate: "1990-04-12", gender: "mme", clothingSize: "" });
  });

  it("champs masqués si la liaison n'est pas active (instance sans Tech in touch)", () => {
    etat.settings = { titEnabled: false };
    const r = render(<Fiche onV={() => {}} />);
    expect(r.queryByTestId("champs-tit")).toBeNull();
  });

  it("fiche serveur normalisée (snake_case -> écran)", () => {
    const c = norm.customer({ id: "c1", first_name: "A", last_name: "B", tit_barcode: "TIT1", birthdate: "1990-04-12", gender: "mr", clothing_size: "L" });
    expect(c).toMatchObject({ titBarcode: "TIT1", birthdate: "1990-04-12", gender: "mr", clothingSize: "L" });
  });

  it("panneau : suivi des envois, offres, ajout d'une offre", async () => {
    const r = render(<TechInTouchPanel />);
    await waitFor(() => expect(r.container.textContent).toMatch(/Retouches offertes — 400 pts/));
    expect(r.getByTestId("tit-suivi").textContent).toMatch(/5 envoyé\(s\).*1 en erreur.*Carte Inconnue.*barcode_not_found/s);
    expect(r.getByTestId("tit-shop-id").value).toBe("12");
    fireEvent.change(r.getByPlaceholderText("Retouches offertes"), { target: { value: "Café offert" } });
    fireEvent.change(r.getByPlaceholderText("400"), { target: { value: "150" } });
    await act(async () => { fireEvent.click(r.getByText(/Ajouter l'offre/)); });
    expect(etat.appels[0]).toMatchObject({ titleFr: "Café offert", costPoints: 150, active: true });
  });
});
