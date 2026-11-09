// @vitest-environment jsdom
//
// Attente TPE (MCS 09/11/2026 : TPE wifi muet, 3 min d'attente puis deplacement) : apres 20 s, le
// caissier peut declarer « le TPE ne repond pas » sans attendre la fin du delai de 3 min.
import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("./context.jsx", () => ({ default: ({ children }) => children }));
vi.mock("./nav.jsx", () => ({ AppContent: () => null }));
vi.mock("./ui.jsx", () => ({ ErrorBoundary: ({ children }) => children, ToastContainer: () => null }));
import { TpeWaitModal } from "./App.jsx";

describe("Fenetre d'attente TPE", () => {
  it("propose « Le TPE ne répond pas » après 20 s et rend la main au caissier", () => {
    vi.useFakeTimers();
    const abort = vi.fn();
    render(<TpeWaitModal/>);
    act(() => { window.dispatchEvent(new CustomEvent("caissepro:tpe-wait", { detail: { amount: 42.5, startedAt: Date.now(), abort } })); });
    expect(screen.getByText("42.50 EUR")).toBeTruthy();
    expect(screen.queryByText("Le TPE ne répond pas")).toBeNull();
    act(() => { vi.advanceTimersByTime(21000); });
    fireEvent.click(screen.getByText("Le TPE ne répond pas"));
    expect(abort).toHaveBeenCalledTimes(1);
    act(() => { window.dispatchEvent(new CustomEvent("caissepro:tpe-wait", { detail: null })); });
    expect(screen.queryByText("Paiement sur le TPE")).toBeNull();
    vi.useRealTimers();
  });
});
