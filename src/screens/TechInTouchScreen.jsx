import React from "react";
import { C } from "../constants.jsx";
import { useApp } from "../context.jsx";
import TechInTouchPanel from "./TechInTouchPanel.jsx";

// Page « Tech in touch » (20/11/2026) : menu de la caisse et du tableau de bord, pour le gérant
// et l'admin (un gérant n'a pas accès aux Paramètres, où l'onglet était seul jusque-là).
export default function TechInTouchScreen() {
  const { settings, perm } = useApp();
  if (!settings.titEnabled) return <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>Liaison Tech in touch non activée sur cette caisse</div>;
  if (!perm?.().canVoid) return <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>Réservé au gérant ou à l'administrateur</div>;
  return (<div style={{ height: "100%", overflowY: "auto", padding: 20, background: C.bg }}>
    <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 14px" }}>Tech in touch</h2>
    <TechInTouchPanel />
  </div>);
}
export { TechInTouchScreen };
