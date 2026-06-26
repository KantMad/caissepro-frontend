import React, { useState, useMemo } from "react";
import { ArrowDownCircle, ArrowUpCircle, Wallet, Printer, FileText } from "lucide-react";
import { C, CO } from "../constants.jsx";
import { EAN13Svg } from "../utils.jsx";
import { Modal, Btn, Input, Badge, SC } from "../ui.jsx";
import { useApp } from "../context.jsx";

export default function TiroirCaisseScreen() {
  const { cashMovements, addCashMovement, reloadCashMovements, thermalPrint, settings, currentUser, currentStore, cashReg, notify } = useApp();
  const [modal, setModal] = useState(null);   // 'in' | 'out' | null
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastTicket, setLastTicket] = useState(null);

  const today = new Date().toISOString().split("T")[0];
  const todays = useMemo(() => (cashMovements || []).filter(m => (m.created_at || m.date || "").startsWith(today)), [cashMovements, today]);
  const totalIn = todays.filter(m => m.direction === "in").reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
  const totalOut = todays.filter(m => m.direction === "out").reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
  const fond = parseFloat(cashReg?.openingAmount || 0);

  const open = (dir) => { setModal(dir); setAmount(""); setReason(""); };

  const submit = async () => {
    const amt = parseFloat(String(amount).replace(",", ".")) || 0;
    if (!(amt > 0)) { notify("Montant invalide", "danger"); return; }
    if (!reason.trim()) { notify("Motif obligatoire (NF525)", "danger"); return; }
    setBusy(true);
    try {
      const saved = await addCashMovement(modal, amt, reason.trim());
      const ticket = { ...saved, direction: modal, amount: amt, reason: reason.trim(),
        userName: currentUser?.name, storeName: currentStore?.name || settings?.name,
        date: saved?.created_at || new Date().toISOString() };
      setLastTicket(ticket);
      try { await thermalPrint("cash-movement", ticket); } catch (e) { console.warn("Impression mouvement:", e.message); }
      notify(`${modal === "in" ? "Apport" : "Prélèvement"} de ${amt.toFixed(2)}€ enregistré`, "success");
      setModal(null); setAmount(""); setReason("");
    } catch (e) {
      notify(e.message || "Erreur", "danger");
    } finally { setBusy(false); }
  };

  const reprint = async (m) => {
    try { await thermalPrint("cash-movement", { ...m, userName: m.user_name || m.userName, storeName: currentStore?.name || settings?.name, date: m.created_at || m.date }); notify("Réimpression envoyée", "success"); }
    catch (e) { notify(e.message, "danger"); }
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Wallet size={22} color={C.primary} />
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Tiroir-caisse</h2>
        <Btn variant="outline" onClick={() => reloadCashMovements()} style={{ marginLeft: "auto", fontSize: 12 }}>Actualiser</Btn>
      </div>

      {/* Stats du jour */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 18 }}>
        <SC icon={Wallet} label="Fond de caisse" value={`${fond.toFixed(2)}€`} color={C.textMuted} />
        <SC icon={ArrowDownCircle} label="Apports (jour)" value={`+${totalIn.toFixed(2)}€`} color="#059669" />
        <SC icon={ArrowUpCircle} label="Prélèvements (jour)" value={`-${totalOut.toFixed(2)}€`} color={C.danger} />
        <SC icon={Wallet} label="Espèces théoriques" value={`${(fond + totalIn - totalOut).toFixed(2)}€`} sub="hors ventes" color={C.primary} />
      </div>

      {/* Boutons d'action */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
        <button onClick={() => open("in")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "22px 12px", borderRadius: 16, border: `2px solid #05966933`, background: "#05966910", cursor: "pointer", color: "#059669", fontWeight: 800, fontSize: 16 }}>
          <ArrowDownCircle size={32} /> Ajout de caisse
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>Apport d'espèces (monnaie, fond…)</span>
        </button>
        <button onClick={() => open("out")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "22px 12px", borderRadius: 16, border: `2px solid ${C.danger}33`, background: `${C.danger}10`, cursor: "pointer", color: C.danger, fontWeight: 800, fontSize: 16 }}>
          <ArrowUpCircle size={32} /> Sortie de caisse
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>Prélèvement (banque, dépense…)</span>
        </button>
      </div>

      {/* Historique */}
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Mouvements du jour</div>
      {todays.length === 0 ? (
        <div style={{ textAlign: "center", color: C.textMuted, padding: 24, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <FileText size={28} style={{ marginBottom: 6, opacity: 0.5 }} /><div style={{ fontSize: 13 }}>Aucun mouvement aujourd'hui</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {todays.map((m, i) => {
            const isIn = m.direction === "in";
            return (
              <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                {isIn ? <ArrowDownCircle size={20} color="#059669" /> : <ArrowUpCircle size={20} color={C.danger} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{m.reason}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{new Date(m.created_at || m.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {m.user_name || m.userName || "?"} · {m.movement_number || ""}</div>
                </div>
                <div style={{ fontWeight: 900, fontSize: 15, color: isIn ? "#059669" : C.danger, whiteSpace: "nowrap" }}>{isIn ? "+" : "-"}{(parseFloat(m.amount) || 0).toFixed(2)}€</div>
                <Btn variant="ghost" onClick={() => reprint(m)} style={{ padding: "4px 8px" }} title="Réimprimer le justificatif"><Printer size={14} /></Btn>
              </div>
            );
          })}
        </div>
      )}

      {/* Dernier justificatif (aperçu) */}
      {lastTicket && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 6 }}>Dernier justificatif</div>
          <div data-print-receipt style={{ fontFamily: "'Courier New',monospace", fontSize: 12, fontWeight: 500, background: "#FAFAF8", borderRadius: 10, padding: 16, border: `1px solid ${C.border}`, maxWidth: 320 }}>
            <div style={{ textAlign: "center", fontWeight: 800 }}>{lastTicket.storeName || CO.name}</div>
            <div style={{ textAlign: "center", fontWeight: 800, marginTop: 6 }}>{lastTicket.direction === "in" ? "APPORT DE CAISSE" : "PRÉLÈVEMENT DE CAISSE"}</div>
            <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>N°</span><span>{lastTicket.movement_number}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Date</span><span>{new Date(lastTicket.date).toLocaleString("fr-FR")}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Opérateur</span><span>{lastTicket.userName}</span></div>
            <div style={{ marginTop: 4 }}>Motif: {lastTicket.reason}</div>
            <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800 }}>
              <span>{lastTicket.direction === "in" ? "MONTANT +" : "MONTANT -"}</span>
              <span>{(lastTicket.amount || 0).toFixed(2)}€</span>
            </div>
            {lastTicket.barcode && <div style={{ textAlign: "center", marginTop: 8 }}><EAN13Svg code={lastTicket.barcode} width={180} height={50} /></div>}
            <div style={{ textAlign: "center", fontSize: 9, color: "#888", marginTop: 6 }}>Mouvement hors CA — Conforme NF525</div>
          </div>
        </div>
      )}

      {/* Modal saisie */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "in" ? "Ajout de caisse (apport)" : "Sortie de caisse (prélèvement)"} sub="Montant en espèces — motif obligatoire (NF525)">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>Montant (€)</label>
            <Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus style={{ fontSize: 18, fontWeight: 800 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>Motif <span style={{ color: C.danger }}>*</span></label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={modal === "in" ? "Ex: apport de monnaie" : "Ex: remise en banque, achat fournisseur"} />
          </div>
          <Btn variant="primary" onClick={submit} disabled={busy} style={{ height: 48, fontSize: 15, background: modal === "in" ? "#059669" : C.danger }}>
            {busy ? "Enregistrement…" : (modal === "in" ? "Valider l'apport" : "Valider le prélèvement")}
          </Btn>
          <div style={{ fontSize: 10, color: C.textMuted, textAlign: "center" }}>Mouvement inaltérable. Une erreur se corrige par un mouvement inverse.</div>
        </div>
      </Modal>
    </div>
  );
}
