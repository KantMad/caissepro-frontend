// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { CameraScanner, cameraScanDisponible, nouveauCode, DELAI_MEME_CODE_MS } from "./CameraScanner.jsx";
import hardwareManager from "./hardware.js";

describe("Scan à l'appareil photo", () => {
  const stop = vi.fn();
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.BarcodeDetector; delete navigator.mediaDevices; stop.mockReset(); vi.useRealTimers(); });

  const installer = (lectures) => {
    let i = 0;
    window.BarcodeDetector = class {
      static async getSupportedFormats() { return ["ean_13", "qr_code"]; }
      async detect() { const c = lectures[Math.min(i++, lectures.length - 1)]; return c ? [{ rawValue: c }] : []; }
    };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) } });
  };

  it("anti-double lecture : le même code n'est repris qu'après le délai", () => {
    expect(nouveauCode(null, "A", 0)).toBe(true);
    expect(nouveauCode({ code: "A", t: 0 }, "A", DELAI_MEME_CODE_MS - 1)).toBe(false);
    expect(nouveauCode({ code: "A", t: 0 }, "A", DELAI_MEME_CODE_MS)).toBe(true);
    expect(nouveauCode({ code: "A", t: 0 }, "B", 10)).toBe(true);
  });

  it("indisponible sans BarcodeDetector : message clair, pas de caméra ouverte", async () => {
    expect(cameraScanDisponible()).toBe(false);
    render(<CameraScanner open onClose={() => {}} onCode={() => {}} />);
    expect(await screen.findByText(/ne sait pas lire les codes-barres/)).toBeTruthy();
  });

  it("lit les codes en continu, une seule fois par article, et coupe la caméra en fermant", async () => {
    installer(["3760000000017", "3760000000017", "3760000000017", "2700101000856"]);
    expect(cameraScanDisponible()).toBe(true);
    const onCode = vi.fn(); const onClose = vi.fn();
    const { rerender } = render(<CameraScanner open onClose={onClose} onCode={onCode} />);
    await waitFor(() => expect(onCode).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(onCode.mock.calls.map(c => c[0])).toEqual(["3760000000017", "2700101000856"]);
    expect(screen.getByText(/2 lus/)).toBeTruthy();
    fireEvent.click(screen.getByText("Terminer"));
    expect(onClose).toHaveBeenCalled();
    rerender(<CameraScanner open={false} onClose={onClose} onCode={onCode} />);
    expect(stop).toHaveBeenCalled();
  });

  it("accès refusé : message pour autoriser l'appareil photo", async () => {
    installer([]);
    navigator.mediaDevices.getUserMedia = vi.fn(async () => { throw Object.assign(new Error("x"), { name: "NotAllowedError" }); });
    render(<CameraScanner open onClose={() => {}} onCode={() => {}} />);
    expect(await screen.findByText(/Accès à l'appareil photo refusé/)).toBeTruthy();
  });

  it("un code lu à la caméra suit le même circuit qu'une douchette", async () => {
    const memoire = new Map();
    vi.stubGlobal("localStorage", { getItem: k => memoire.get(k) ?? null, setItem: (k, v) => memoire.set(k, String(v)), removeItem: k => memoire.delete(k) });
    vi.useFakeTimers();   // pas de connexion automatique imprimante / TPE pendant le test
    hardwareManager.init();
    const s = hardwareManager.scanner;
    expect(s).toBeTruthy();
    const recu = vi.fn(); const off = s.onScan(recu);
    s.emitScan("  3760000000017 "); s.emitScan("");
    off();
    expect(recu).toHaveBeenCalledTimes(1);
    expect(recu).toHaveBeenCalledWith("3760000000017");
  });
});
