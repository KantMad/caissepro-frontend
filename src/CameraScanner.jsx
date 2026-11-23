// Scan des codes-barres avec l'appareil photo du telephone (vente sur un marche, 23/11/2026).
//
// Lecture par l'API BarcodeDetector du navigateur (Chrome / WebView Android) : aucune dependance.
// Chaque code lu est envoye au MEME circuit qu'une douchette (hardwareManager.scanner), donc tout
// ce que sait le scan s'applique : produit, etiquette de balance, ticket, avoir, carte cadeau...
// La fenetre reste ouverte pour enchainer les articles ; le meme code n'est pas relu avant 1,5 s.
import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];
export const DELAI_MEME_CODE_MS = 1500;

// Le telephone sait-il lire un code-barres a la camera ?
export const cameraScanDisponible = () =>
  typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

// Anti-double lecture : renvoie true si le code doit etre pris en compte
export function nouveauCode(dernier, code, maintenant) {
  return !(dernier && dernier.code === code && maintenant - dernier.t < DELAI_MEME_CODE_MS);
}

export function CameraScanner({ open, onClose, onCode }) {
  const video = useRef(null);
  const dernier = useRef(null);
  const [erreur, setErreur] = useState("");
  const [lus, setLus] = useState(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let flux = null, fini = false, minuteur = null;
    setErreur(""); setLus(0); dernier.current = null;
    (async () => {
      if (!cameraScanDisponible()) { setErreur("Ce téléphone ne sait pas lire les codes-barres avec l'appareil photo. Utilisez Chrome sur Android, ou l'application Tech in Cash."); return; }
      let detecteur;
      try {
        const dispo = (await window.BarcodeDetector.getSupportedFormats?.()) || FORMATS;
        detecteur = new window.BarcodeDetector({ formats: FORMATS.filter(f => dispo.includes(f)) });
      } catch (e) { setErreur("Lecture des codes-barres indisponible sur ce téléphone."); return; }
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        setErreur(e?.name === "NotAllowedError"
          ? "Accès à l'appareil photo refusé. Autorisez-le dans les réglages du téléphone, puis réessayez."
          : "Impossible d'ouvrir l'appareil photo.");
        return;
      }
      if (fini) { flux.getTracks().forEach(t => t.stop()); return; }
      const v = video.current;
      v.srcObject = flux;
      try { await v.play(); } catch (e) { /* lecture auto refusee : la video reste utilisable */ }
      const lire = async () => {
        if (fini) return;
        try {
          if (v.readyState >= 2) {
            const codes = await detecteur.detect(v);
            const code = codes?.[0]?.rawValue?.trim();
            const t = Date.now();
            if (code && nouveauCode(dernier.current, code, t)) {
              dernier.current = { code, t };
              navigator.vibrate?.(80);
              setFlash(true); setTimeout(() => setFlash(false), 250);
              setLus(n => n + 1);
              onCode(code);
            }
          }
        } catch (e) { /* image illisible : on continue */ }
        minuteur = setTimeout(lire, 150);
      };
      lire();
    })();
    return () => { fini = true; clearTimeout(minuteur); flux?.getTracks().forEach(t => t.stop()); };
  }, [open, onCode]);

  if (!open) return null;
  return (
    <div data-testid="scan-camera" style={{ position: "fixed", inset: 0, zIndex: 400, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", color: "#fff" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Scanner{lus > 0 ? ` · ${lus} lu${lus > 1 ? "s" : ""}` : ""}</div>
        <button onClick={onClose} aria-label="Fermer le scan" style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "inherit" }}>
          <X size={16} /> Terminer</button>
      </div>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <video ref={video} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {!erreur && <div style={{ position: "absolute", left: "10%", right: "10%", top: "35%", height: "30%", borderRadius: 16,
          border: `3px solid ${flash ? "#22c55e" : "rgba(255,255,255,0.85)"}`, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)", transition: "border-color 0.15s" }} />}
        {erreur && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <p style={{ color: "#fff", fontSize: 15, textAlign: "center", lineHeight: 1.5, margin: 0 }}>{erreur}</p></div>}
      </div>
      {!erreur && <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, textAlign: "center", margin: 0, padding: "12px 16px 20px" }}>
        Placez le code-barres dans le cadre. Les articles s'ajoutent au panier à chaque lecture.</p>}
    </div>
  );
}

export default CameraScanner;
