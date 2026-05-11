import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// Register Service Worker with update prompt
const updateSW = registerSW({
  onNeedRefresh() {
    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.innerHTML = `
      <div style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;
        background:#1e293b;color:#fff;padding:14px 24px;border-radius:14px;
        display:flex;align-items:center;gap:16px;font-family:system-ui,sans-serif;
        box-shadow:0 8px 32px rgba(0,0,0,0.25);font-size:14px;max-width:420px;">
        <span style="flex:1">Nouvelle version disponible</span>
        <button onclick="document.getElementById('pwa-update-banner').remove();window.__pwaUpdate()"
          style="background:#2D5A3D;color:#fff;border:none;padding:8px 18px;border-radius:8px;
          cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap;">
          Mettre a jour
        </button>
        <button onclick="document.getElementById('pwa-update-banner').remove()"
          style="background:transparent;color:#94a3b8;border:none;cursor:pointer;font-size:18px;padding:4px;">
          &times;
        </button>
      </div>`;
    document.body.appendChild(banner);
    window.__pwaUpdate = () => updateSW(true);
  },
  onOfflineReady() {
    console.log('[CaissePro] App disponible hors-ligne');
  },
});
