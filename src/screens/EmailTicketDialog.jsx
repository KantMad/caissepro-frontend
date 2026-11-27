// Envoi d'un ticket deja enregistre par e-mail, depuis l'Historique (MCS 27/11/2026 : « le client
// demande son ticket par mail apres coup »). Le serveur envoie le ticket au nom de la boutique
// (POST /api/sales/:id/email, adresse d'envoi commune, Reply-To = e-mail de la boutique).
import React, { useState, useEffect } from "react";
import { Mail } from "lucide-react";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { Modal, Btn, Input } from "../ui.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailTicketDialog({ ticket, emailInitial = "", onClose, notify }) {
  const [addr, setAddr] = useState(emailInitial);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => { setAddr(emailInitial || ""); }, [ticket, emailInitial]);
  if (!ticket) return null;
  const num = ticket.ticketNumber || ticket.ticket_number || "?";
  const saleId = ticket.id || ticket.saleId;
  const valide = EMAIL_RE.test(addr.trim());
  const envoyer = async () => {
    if (!valide || envoi) return;
    if (!saleId) { notify("Ticket pas encore synchronisé avec le serveur : réessayez une fois la caisse en ligne", "warn"); return; }
    setEnvoi(true);
    try {
      await API.sales.emailTicket(saleId, addr.trim());
      notify(`Ticket ${num} envoyé à ${addr.trim()}`, "success");
      onClose();
    } catch (e) {
      if (e.status === 503) notify("Envoi des e-mails non configuré sur le serveur", "warn");
      else if (e.status === 404) notify("Ticket introuvable sur le serveur (pas encore synchronisé ?)", "warn");
      else notify(`Erreur d'envoi : ${e.message}`, "error");
    } finally { setEnvoi(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Envoyer le ticket ${num} par e-mail`}>
      <label style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>ADRESSE E-MAIL DU CLIENT</label>
      <Input data-testid="email-ticket-adresse" autoFocus value={addr} onChange={e => setAddr(e.target.value)} type="email"
        placeholder="client@exemple.fr" style={{ height: 40, fontSize: 14 }} onKeyDown={e => { if (e.key === "Enter") envoyer(); }} />
      <Btn data-testid="email-ticket-envoyer" onClick={envoyer} disabled={!valide || envoi}
        style={{ width: "100%", height: 42, marginTop: 12, background: C.primary, fontSize: 14 }}>
        {envoi ? "Envoi en cours…" : <><Mail size={16} /> Envoyer</>}</Btn>
    </Modal>);
}
