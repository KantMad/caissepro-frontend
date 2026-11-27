// @vitest-environment jsdom
// Connexion au Dashboard : l'ecran d'ouverture de caisse ne doit pas apparaitre (MCS 27/11/2026).
// Le mode choisi doit etre pose AVANT login(), qui affiche l'appli des qu'il connait l'utilisateur.
import { it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import React from "react";

const ordre = [];
const setMode = vi.fn((m) => ordre.push("mode:" + m));
const login = vi.fn(async () => { ordre.push("login"); return { ok: true }; });
vi.mock("../api.js", () => ({ auth: { profiles: () => Promise.resolve([]) } }));
vi.mock("../context.jsx", () => ({
  useApp: () => ({ login, setMode, users: [{ id: "u1", name: "Gerant", role: "admin", pin: "x" }], setUsers: () => {} }),
  fusionnerComptes: (a) => a,
}));
import LoginScreen from "./LoginScreen.jsx";
afterEach(() => { cleanup(); ordre.length = 0; });

it("Dashboard choisi : le mode est pose avant la connexion", async () => {
  const r = render(<LoginScreen />);
  fireEvent.click(r.getByText("Dashboard"));
  fireEvent.click(r.getByText("Gerant"));
  const btn = r.getByText("Connexion");
  fireEvent.click(btn);
  await waitFor(() => expect(login).toHaveBeenCalled());
  expect(ordre[0]).toBe("mode:dashboard");
  expect(ordre.indexOf("mode:dashboard")).toBeLessThan(ordre.indexOf("login"));
});
