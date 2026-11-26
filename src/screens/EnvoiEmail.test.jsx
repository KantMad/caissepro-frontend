// @vitest-environment jsdom
// Parametres > Général : etat de l'envoi des tickets par e-mail et mail d'essai.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const S = { emailStatus: vi.fn(), emailTest: vi.fn() };
vi.mock("../api.js", () => ({ settings: new Proxy({}, { get: (_, k) => (...a) => (S[k] ? S[k](...a) : Promise.resolve(null)) }) }));
vi.mock("../context.jsx", () => ({ useApp: () => ({}) }));
import { EnvoiEmail } from "./SettingsScreen.jsx";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("EnvoiEmail", () => {
  it("configuré : affiche l'expéditeur et envoie un mail d'essai", async () => {
    S.emailStatus.mockResolvedValue({ configured: true, from: "tickets@techincash.app" });
    S.emailTest.mockResolvedValue({ ok: true });
    const r = render(<EnvoiEmail />);
    await waitFor(() => expect(r.getByTestId("envoi-email").textContent).toMatch(/tickets@techincash.app/));
    fireEvent.change(r.getByTestId("email-essai"), { target: { value: "moi@exemple.fr" } });
    fireEvent.click(r.getByText("Tester l'envoi"));
    await waitFor(() => expect(S.emailTest).toHaveBeenCalledWith("moi@exemple.fr"));
    await waitFor(() => expect(r.getByTestId("envoi-email").textContent).toMatch(/Mail d'essai envoyé/));
  });
  it("non configuré : le dit, sans champ d'essai", async () => {
    S.emailStatus.mockResolvedValue({ configured: false, error: "x" });
    const r = render(<EnvoiEmail />);
    await waitFor(() => expect(r.getByTestId("envoi-email").textContent).toMatch(/Pas encore activé/));
    expect(r.queryByTestId("email-essai")).toBeNull();
  });
  it("compte non admin (refus) : rien n'est affiché", async () => {
    S.emailStatus.mockRejectedValue(new Error("403"));
    const r = render(<EnvoiEmail />);
    await new Promise(res => setTimeout(res, 10));
    expect(r.queryByTestId("envoi-email")).toBeNull();
  });
});
