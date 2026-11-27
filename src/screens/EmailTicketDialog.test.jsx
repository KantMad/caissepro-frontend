// @vitest-environment jsdom
// Historique : envoi d'un ticket par e-mail apres coup (MCS 27/11/2026).
import { it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import React from "react";

const emailTicket = vi.fn();
vi.mock("../api.js", () => ({ sales: { emailTicket: (...a) => emailTicket(...a) } }));
import EmailTicketDialog from "./EmailTicketDialog.jsx";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const TK = { id: "s1", ticketNumber: "T-000042" };

it("envoie le ticket par le serveur à l'adresse du client pré-remplie", async () => {
  emailTicket.mockResolvedValue({ ok: true });
  const notify = vi.fn(), onClose = vi.fn();
  const r = render(<EmailTicketDialog ticket={TK} emailInitial="cliente@exemple.fr" notify={notify} onClose={onClose} />);
  expect(r.getByTestId("email-ticket-adresse").value).toBe("cliente@exemple.fr");
  fireEvent.click(r.getByTestId("email-ticket-envoyer"));
  await waitFor(() => expect(emailTicket).toHaveBeenCalledWith("s1", "cliente@exemple.fr"));
  expect(notify).toHaveBeenCalledWith(expect.stringMatching(/T-000042/), "success");
  expect(onClose).toHaveBeenCalled();
});

it("adresse vide : rien n'est envoyé ; serveur non configuré : message clair", async () => {
  emailTicket.mockRejectedValue(Object.assign(new Error("Email non configure"), { status: 503 }));
  const notify = vi.fn();
  const r = render(<EmailTicketDialog ticket={TK} notify={notify} onClose={() => {}} />);
  fireEvent.click(r.getByTestId("email-ticket-envoyer"));
  expect(emailTicket).not.toHaveBeenCalled();
  fireEvent.change(r.getByTestId("email-ticket-adresse"), { target: { value: "a@b.fr" } });
  fireEvent.click(r.getByTestId("email-ticket-envoyer"));
  await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringMatching(/non configuré/), "warn"));
});
