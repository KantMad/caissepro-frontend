import React, { useState, useEffect, useCallback } from "react";
import { RotateCcw, Save, Plus, Send, Search } from "lucide-react";
import * as API from "../api.js";
import { C } from "../constants.jsx";
import { Btn, Input, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";

// Paramètres > Tech in touch (17/11/2026) : liaison avec l'app de fidélité. La caisse calcule les
// points et ENVOIE solde, offres et profil client (file côté serveur, src/lib/tit.js de l'API).
// Onglet visible seulement si l'instance a TIT_API_URL + TIT_API_KEY (settings.titEnabled).
const OFFRE_VIDE = { titleFr: "", titleEn: "", descriptionFr: "", descriptionEn: "", costPoints: "", active: true };
const Lbl = ({ children }) => <label style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 3 }}>{children}</label>;
const bloc = { background: C.surface, borderRadius: 14, padding: 16, border: `1.5px solid ${C.border}`, marginBottom: 14 };

export default function TechInTouchPanel() {
  const { settings, setSettings, saveSettingsNotify, notify, perm, setCustomers } = useApp();
  const responsable = perm?.().canVoid;
  const admin = perm?.().canSettings;   // ID boutique = paramètre du magasin (admin) ; gérant : lecture seule
  // Clients Tech in touch (20/11/2026) : liste du magasin + correction des points
  const [membres, setMembres] = useState(null);
  const [cherche, setCherche] = useState("");
  const [corrige, setCorrige] = useState(null);   // { id, delta, motif }
  const [etat, setEtat] = useState(null);
  const [offres, setOffres] = useState([]);
  const [form, setForm] = useState(OFFRE_VIDE);
  const [edit, setEdit] = useState(null);   // id de l'offre modifiée, null = nouvelle
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    try { setOffres(await API.tit.offers() || []); } catch (e) { setOffres([]); }
    if (responsable) { try { setEtat(await API.tit.status()); } catch (e) { setEtat({ erreur: e.message }); } }
  }, [responsable]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    if (!responsable) return;
    let fini = false;
    const t = setTimeout(async () => {
      try { const r = await API.tit.members(cherche.trim()); if (!fini) setMembres(Array.isArray(r) ? r : []); }
      catch (e) { if (!fini) setMembres([]); }
    }, 300);
    return () => { fini = true; clearTimeout(t); };
  }, [cherche, responsable]);
  const corrigerPoints = async () => {
    const delta = parseInt(corrige?.delta, 10);
    if (!delta) { notify("Nombre de points : par ex. 50 ou -50", "error"); return; }
    if (!corrige.motif.trim()) { notify("Motif obligatoire", "error"); return; }
    if (busy) return; setBusy(true);
    try {
      const r = await API.customers.adjustPoints(corrige.id, delta, corrige.motif.trim());
      setMembres(l => (l || []).map(m => (m.id === r.id ? { ...m, points: r.points, sync_status: "pending" } : m)));
      setCustomers?.(l => l.map(c => (c.id === r.id ? { ...c, points: r.points } : c)));
      notify(`Points corrigés : nouveau solde ${r.points} pts`, "success"); setCorrige(null);
    } catch (e) { notify(e.message, "error"); } finally { setBusy(false); }
  };
  const etatEnvoi = (m) => m.sync_status === "sent" ? { t: `Envoyé${m.sync_sent_at ? ` le ${new Date(m.sync_sent_at).toLocaleDateString("fr-FR")}` : ""}`, c: "#059669" }
    : m.sync_status === "pending" ? { t: "En attente d'envoi", c: C.info }
    : m.sync_status ? { t: "Erreur d'envoi", c: C.danger } : { t: "Jamais envoyé", c: C.textMuted };

  const action = async (f, ok) => {
    if (busy) return; setBusy(true);
    try { const r = await f(); notify(ok(r), "success"); await charger(); }
    catch (e) { notify(e.message, "error"); } finally { setBusy(false); }
  };
  const enregistrerOffre = () => {
    const cout = parseInt(form.costPoints, 10);
    if (!form.titleFr.trim()) { notify("Titre (FR) requis", "error"); return; }
    if (!(cout >= 0)) { notify("Coût en points requis", "error"); return; }
    const corps = { ...form, costPoints: cout };
    action(() => edit ? API.tit.updateOffer(edit, corps) : API.tit.createOffer(corps),
      (r) => { setForm(OFFRE_VIDE); setEdit(null);
        return r?.envoiImmediat ? "Offre enregistrée et envoyée à Tech in touch" : "Offre enregistrée — elle partira avec le prochain envoi de points"; });
  };
  const ps = etat?.parStatut || {};

  return (<div style={{ maxWidth: 680 }}>
    <div style={bloc}>
      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Boutique Tech in touch</h4>
      <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>
        La caisse calcule les points (1 € = 1 point) et envoie à l'app : solde, niveau (VIP à partir du palier Or), offres et profil des clients
        qui ont une carte Tech in touch ou un email. Laissez l'ID vide pour ne pas relier ce magasin.</p>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}><Lbl>ID BOUTIQUE TECH IN TOUCH</Lbl>
          {admin ? <Input data-testid="tit-shop-id" value={settings.titShopId || ""} inputMode="numeric" placeholder="Ex. 12"
            onChange={e => setSettings(s => ({ ...s, titShopId: e.target.value.replace(/\s/g, "") }))} />
            : <div data-testid="tit-shop-id" style={{ fontSize: 13, fontWeight: 700, padding: "8px 0" }}>{settings.titShopId || "Non renseigné (à demander à l'administrateur)"}</div>}</div>
        {admin && <Btn onClick={() => saveSettingsNotify(settings, "Tech in touch")} style={{ height: 40 }}><Save size={14} /> Enregistrer</Btn>}
      </div>
    </div>

    {responsable && <div style={bloc} data-testid="tit-suivi">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, flex: 1 }}>Envois</h4>
        <Btn variant="outline" disabled={busy} onClick={() => action(API.tit.retry, r => `${r.relances} envoi(s) relancé(s)`)} style={{ fontSize: 11, padding: "4px 10px" }}><RotateCcw size={12} /> Relancer les erreurs</Btn>
        <Btn variant="outline" disabled={busy} onClick={() => action(API.tit.resync, r => `${r.clients} client(s) remis en file d'envoi`)} style={{ fontSize: 11, padding: "4px 10px" }}><Send size={12} /> Tout synchroniser</Btn>
      </div>
      {etat?.erreur ? <div style={{ fontSize: 11, color: C.danger }}>{etat.erreur}</div> : <>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <Badge color="#059669">{ps.sent || 0} envoyé(s)</Badge>
          <Badge color={C.info}>{ps.pending || 0} en attente</Badge>
          <Badge color={C.danger}>{(ps.rejected || 0) + (ps.failed || 0)} en erreur</Badge>
          {etat?.dernierEnvoi && <span style={{ fontSize: 10, color: C.textMuted, alignSelf: "center" }}>Dernier envoi : {new Date(etat.dernierEnvoi).toLocaleString("fr-FR")}</span>}
        </div>
        {!settings.titShopId && <div style={{ fontSize: 11, color: C.warn }}>Aucun ID boutique : rien n'est envoyé pour ce magasin.</div>}
        {(etat?.erreurs || []).map((e, i) => (<div key={i} style={{ fontSize: 11, padding: "6px 0", borderTop: `1px solid ${C.border}` }}>
          <b>{e.client || "Client"}</b> — {e.kind === "client" ? "profil" : "points"} — <span style={{ color: e.status === "pending" ? C.textMuted : C.danger }}>
            {e.status === "pending" ? `nouvel essai prévu (${e.attempts} échec(s))` : e.status === "rejected" ? "refusé" : "abandonné"}</span>
          {e.last_error && <span style={{ color: C.textMuted }}> : {e.last_error}</span>}</div>))}
      </>}
    </div>}

    {responsable && <div style={bloc} data-testid="tit-clients">
      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Clients Tech in touch {membres && <span style={{ color: C.textMuted, fontWeight: 600 }}>({membres.length}{membres.length >= 500 ? "+" : ""})</span>}</h4>
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={14} color={C.textMuted} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
        <Input data-testid="tit-clients-recherche" value={cherche} onChange={e => setCherche(e.target.value)} placeholder="Nom, carte TIT, téléphone, email…" style={{ paddingLeft: 32 }} /></div>
      {membres === null ? <div style={{ fontSize: 11, color: C.textMuted }}>Chargement…</div>
        : membres.length === 0 ? <div style={{ fontSize: 11, color: C.textMuted }}>{cherche.trim() ? `Aucun client pour « ${cherche.trim()} »` : "Aucun client n'a encore de carte Tech in touch. Associez-la dans la fiche client (champ « Carte Tech in touch »)."}</div>
        : <div style={{ maxHeight: 420, overflowY: "auto" }}>{membres.map(m => { const e = etatEnvoi(m); return (
          <div key={m.id} style={{ padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{`${m.first_name || ""} ${m.last_name || ""}`.trim() || "Client"}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>{[m.tit_barcode, m.phone, m.email].filter(Boolean).join(" — ")}</div></div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.primary }}>{m.points} pts</div>
                <div style={{ fontSize: 9, color: e.c }} title={m.sync_error || ""}>{m.tier === "vip" ? "VIP · " : ""}{e.t}</div></div>
              <Btn variant="outline" onClick={() => setCorrige(corrige?.id === m.id ? null : { id: m.id, delta: "", motif: "" })} style={{ fontSize: 10, padding: "4px 10px" }}>Points</Btn>
            </div>
            {corrige?.id === m.id && <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
              <Input data-testid="tit-points-delta" type="number" value={corrige.delta} onChange={ev => setCorrige(c => ({ ...c, delta: ev.target.value }))} placeholder="+50 / -50" style={{ width: 90 }} />
              <Input data-testid="tit-points-motif" value={corrige.motif} onChange={ev => setCorrige(c => ({ ...c, motif: ev.target.value }))} placeholder="Motif (obligatoire)" style={{ flex: 1 }} />
              <Btn disabled={busy} onClick={corrigerPoints} style={{ fontSize: 11, padding: "6px 12px" }}>Valider</Btn></div>}
          </div>); })}</div>}
    </div>}

    <div style={bloc}>
      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Offres de fidélité</h4>
      <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>Affichées aux clients dans l'app Tech in touch. Une offre désactivée n'est pas supprimée.</p>
      {offres.length === 0 && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>Aucune offre.</div>}
      {offres.map(o => (<div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${C.border}`, opacity: o.active ? 1 : 0.55 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{o.title_fr} <span style={{ color: C.primary }}>— {o.cost_points} pts</span></div>
          {o.description_fr && <div style={{ fontSize: 10, color: C.textMuted }}>{o.description_fr}</div>}</div>
        {!o.active && <Badge color={C.textMuted}>Désactivée</Badge>}
        <Badge color={o.envoyee ? "#059669" : C.warn}>{o.envoyee ? "Envoyée" : "À envoyer"}</Badge>
        {responsable && <Btn variant="outline" onClick={() => { setEdit(o.id); setForm({ titleFr: o.title_fr, titleEn: o.title_en || "", descriptionFr: o.description_fr || "",
          descriptionEn: o.description_en || "", costPoints: String(o.cost_points), active: o.active }); }} style={{ fontSize: 10, padding: "4px 10px" }}>Modifier</Btn>}
      </div>))}
      {responsable && <div data-testid="tit-offre-form" style={{ marginTop: 12, padding: 12, borderRadius: 10, background: C.surfaceAlt }}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{edit ? "Modifier l'offre" : "Nouvelle offre"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><Lbl>TITRE (FR) *</Lbl><Input value={form.titleFr} onChange={e => setForm(f => ({ ...f, titleFr: e.target.value }))} placeholder="Retouches offertes" /></div>
          <div><Lbl>TITRE (EN)</Lbl><Input value={form.titleEn} onChange={e => setForm(f => ({ ...f, titleEn: e.target.value }))} placeholder="Free alterations" /></div>
          <div><Lbl>DESCRIPTION (FR)</Lbl><Input value={form.descriptionFr} onChange={e => setForm(f => ({ ...f, descriptionFr: e.target.value }))} /></div>
          <div><Lbl>DESCRIPTION (EN)</Lbl><Input value={form.descriptionEn} onChange={e => setForm(f => ({ ...f, descriptionEn: e.target.value }))} /></div>
          <div><Lbl>COÛT EN POINTS *</Lbl><Input type="number" min="0" value={form.costPoints} onChange={e => setForm(f => ({ ...f, costPoints: e.target.value }))} placeholder="400" /></div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, alignSelf: "end", paddingBottom: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} /> Offre active</label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Btn disabled={busy} onClick={enregistrerOffre} style={{ fontSize: 12 }}>{edit ? <Save size={14} /> : <Plus size={14} />} {edit ? "Enregistrer l'offre" : "Ajouter l'offre"}</Btn>
          {edit && <Btn variant="outline" onClick={() => { setEdit(null); setForm(OFFRE_VIDE); }} style={{ fontSize: 12 }}>Annuler</Btn>}
        </div>
      </div>}
    </div>
  </div>);
}
