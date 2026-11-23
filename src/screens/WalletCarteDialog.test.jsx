// @vitest-environment jsdom
// Carte cadeau dans le téléphone (CAISSE-14) : QR code du lien signé + envoi par email.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const wallet = vi.fn(), walletEmail = vi.fn();
vi.mock("../api.js", () => ({ giftcards: { wallet: (...a) => wallet(...a), walletEmail: (...a) => walletEmail(...a) } }));
import { WalletCarteDialog } from "./WalletCarteDialog.jsx";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Carte cadeau dans le téléphone", () => {
  it("affiche le QR code du lien et envoie le lien par email", async () => {
    wallet.mockResolvedValue({ url: "https://api.exemple.fr/api/wallet/c/abc.def", google: true });
    walletEmail.mockResolvedValue({ ok: true });
    const notify = vi.fn(), onClose = vi.fn();
    const r = render(<WalletCarteDialog code="GC-TEST-1" onClose={onClose} notify={notify} />);
    await waitFor(() => expect(r.getByTestId("wallet-qr").getAttribute("src")).toMatch(/^data:image\/png/));
    expect(wallet).toHaveBeenCalledWith("GC-TEST-1");
    expect(r.container.ownerDocument.body.textContent).toMatch(/Google Wallet/);
    fireEvent.change(r.getByTestId("wallet-email"), { target: { value: "client@exemple.fr" } });
    fireEvent.click(r.getByText("Envoyer"));
    await waitFor(() => expect(walletEmail).toHaveBeenCalledWith("GC-TEST-1", "client@exemple.fr"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notify.mock.calls[0][1]).toBe("success");
  });
  it("montre l'erreur du serveur", async () => {
    wallet.mockRejectedValue(new Error("Wallet non activé"));
    const r = render(<WalletCarteDialog code="GC-X" onClose={() => {}} />);
    await waitFor(() => expect(r.baseElement.textContent).toMatch(/Wallet non activé/));
  });
  it("fermée : aucun appel", () => {
    render(<WalletCarteDialog code={null} onClose={() => {}} />);
    expect(wallet).not.toHaveBeenCalled();
  });
});
