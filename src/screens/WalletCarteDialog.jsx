// Carte cadeau dans le téléphone (23/11/2026, CAISSE-14) : QR code à scanner par le client
// (page de la carte + bouton « Ajouter à Google Wallet ») ou lien envoyé par email.
// Le lien est fabriqué et signé par le serveur ; rien n'est gardé dans l'appareil.
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, Mail } from "lucide-react";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { Modal, Btn, Input } from "../ui.jsx";

export function WalletCarteDialog({ code, onClose, notify }) {
  const [lien, setLien] = useState(null);
  const [qr, setQr] = useState("");
  const [erreur, setErreur] = useState("");
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    if (!code) return;
    let fini = false;
    setLien(null); setQr(""); setErreur(""); setEmail("");
    API.giftcards.wallet(code)
      .then(async (r) => { if (fini) return; setLien(r); setQr(await QRCode.toDataURL(r.url, { width: 260, margin: 1 })); })
      .catch((e) => { if (!fini) setErreur(e.message); });
    return () => { fini = true; };
  }, [code]);
  const envoyer = async () => {
    setEnvoi(true);
    try { await API.giftcards.walletEmail(code, email.trim()); notify && notify(`Lien de la carte envoyé à ${email.trim()}`, "success"); onClose(); }
    catch (e) { notify && notify("Envoi impossible : " + e.message, "error"); }
    finally { setEnvoi(false); }
  };
  return (
    <Modal open={!!code} onClose={onClose} title="Carte cadeau dans le téléphone">
      {erreur ? <div style={{ color: C.danger, fontWeight: 600 }}>{erreur}</div>
        : !lien ? <div style={{ color: C.textMuted }}>Préparation du lien…</div>
        : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 13, textAlign: "center", color: C.text }}>
            <Smartphone size={14} style={{ verticalAlign: "middle" }} /> Le client scanne ce QR code avec l'appareil photo de son téléphone.
            {lien.google ? " Il pourra ajouter la carte à Google Wallet." : ""}</div>
          {qr && <img data-testid="wallet-qr" src={qr} alt="QR code de la carte cadeau" style={{ width: 220, height: 220, borderRadius: 8, border: `1px solid ${C.border}` }} />}
          <div style={{ width: "100%", marginTop: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: C.textMuted }}>OU ENVOYER LE LIEN PAR EMAIL</label>
            <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
              <Input data-testid="wallet-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@exemple.fr" style={{ flex: 1 }} />
              <Btn onClick={envoyer} disabled={envoi || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} style={{ height: 42 }}><Mail size={14} /> Envoyer</Btn></div></div>
          <div style={{ fontSize: 10, color: C.textMuted, textAlign: "center" }}>Ce lien donne accès à la carte : ne le montrez qu'au client.</div>
        </div>}
    </Modal>);
}
export default WalletCarteDialog;
