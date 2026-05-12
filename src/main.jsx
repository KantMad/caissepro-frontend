import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';
import { startAutoCheck, onUpdateAvailable, downloadAndInstall, markAsUpdated } from './updater.js';

// ── Force-clear ALL old caches on new version ──
const CURRENT_BUILD = __BUILD_TIME__;
const LAST_BUILD = localStorage.getItem('caissepro_last_build');
if (LAST_BUILD !== CURRENT_BUILD) {
  console.log('[CaissePro] New build detected, clearing all caches...');
  // Unregister old service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
      console.log('[CaissePro] Unregistered', regs.length, 'old service workers');
    });
  }
  // Clear all caches
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
      console.log('[CaissePro] Deleted', names.length, 'caches');
    });
  }
  localStorage.setItem('caissepro_last_build', CURRENT_BUILD);
}

console.log(`[CaissePro] v${__APP_VERSION__} | Build: ${__BUILD_TIME__}`);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// ── PWA Service Worker — DISABLED on Capacitor (causes stale cache issues) ──
const isCapacitor = !!(window.Capacitor?.isNativePlatform?.());
if (!isCapacitor) {
  const updateSW = registerSW({
    onNeedRefresh() {
      showUpdateBanner('Nouvelle version disponible', () => updateSW(true));
    },
    onOfflineReady() {
      console.log('[CaissePro] App disponible hors-ligne');
    },
  });
} else {
  console.log('[CaissePro] Capacitor detected — Service Worker disabled');
  // Force unregister any existing SW on Capacitor
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(n => caches.delete(n)));
  }
}

// ── APK Auto-Updater (for Capacitor/Android) ──
if (isCapacitor) {
  onUpdateAvailable((info) => {
    console.log('[Updater] New version:', info);
    showUpdateBanner(
      `Mise a jour v${info.version} (${(info.size / 1024 / 1024).toFixed(1)} Mo)`,
      () => {
        markAsUpdated(info.buildId);
        downloadAndInstall(info.downloadUrl);
      }
    );
  });
  startAutoCheck();
}

// ── Shared update banner UI ──
function showUpdateBanner(message, onUpdate) {
  // Remove existing banner
  const existing = document.getElementById('pwa-update-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.innerHTML = `
    <div style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;
      background:#1e293b;color:#fff;padding:14px 24px;border-radius:14px;
      display:flex;align-items:center;gap:16px;font-family:system-ui,sans-serif;
      box-shadow:0 8px 32px rgba(0,0,0,0.25);font-size:14px;max-width:420px;">
      <span style="flex:1">${message}</span>
      <button id="pwa-update-btn"
        style="background:#2D5A3D;color:#fff;border:none;padding:8px 18px;border-radius:8px;
        cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap;">
        Mettre a jour
      </button>
      <button id="pwa-dismiss-btn"
        style="background:transparent;color:#94a3b8;border:none;cursor:pointer;font-size:18px;padding:4px;">
        &times;
      </button>
    </div>`;
  document.body.appendChild(banner);

  document.getElementById('pwa-update-btn').addEventListener('click', () => {
    banner.remove();
    onUpdate();
  });
  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    banner.remove();
  });
}
