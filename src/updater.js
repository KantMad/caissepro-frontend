// ═══════════════════════════════════════════════════════
// CaissePro — Auto-Updater
// Checks GitHub Releases for new APK versions
// ═══════════════════════════════════════════════════════

const GITHUB_REPO = 'KantMad/caissepro-frontend';
const CURRENT_VERSION = __APP_VERSION__; // Injected at build time by Vite
const CHECK_INTERVAL = 30 * 60 * 1000; // Check every 30 minutes

let _updateCallback = null;
let _checking = false;

export function getAppVersion() {
  return CURRENT_VERSION;
}

export function onUpdateAvailable(callback) {
  _updateCallback = callback;
}

export async function checkForUpdate() {
  if (_checking) return null;
  _checking = true;

  try {
    const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      cache: 'no-store',
    });

    if (!resp.ok) { _checking = false; return null; }

    const release = await resp.json();
    const remoteVersion = release.tag_name?.replace('v', '').replace('latest-', '') || release.name || '';
    const buildDate = release.published_at;
    const apkAsset = release.assets?.find(a => a.name.endsWith('.apk'));

    if (!apkAsset) { _checking = false; return null; }

    // Compare build timestamps stored in localStorage
    const lastBuild = localStorage.getItem('caissepro_build_id');
    const remoteBuild = release.target_commitish || release.id?.toString();

    if (lastBuild && lastBuild === remoteBuild) {
      _checking = false;
      return null; // Already on latest
    }

    // New version available
    const updateInfo = {
      version: remoteVersion,
      buildDate,
      downloadUrl: apkAsset.browser_download_url,
      size: apkAsset.size,
      releaseNotes: release.body || '',
      buildId: remoteBuild,
    };

    if (_updateCallback) _updateCallback(updateInfo);
    _checking = false;
    return updateInfo;

  } catch (e) {
    console.warn('[Updater] Check failed:', e.message);
    _checking = false;
    return null;
  }
}

export function markAsUpdated(buildId) {
  localStorage.setItem('caissepro_build_id', buildId);
}

export async function downloadAndInstall(downloadUrl) {
  // On Android (Capacitor), use native AppInstaller plugin
  if (window.Capacitor?.isNativePlatform?.()) {
    const installer = window.Capacitor?.Plugins?.AppInstaller;
    if (installer) {
      try {
        console.log('[Updater] Using native AppInstaller plugin...');
        const result = await installer.downloadAndInstall({
          url: downloadUrl,
          filename: 'CaissePro.apk',
        });
        console.log('[Updater] Download result:', result);
        return true;
      } catch (e) {
        console.error('[Updater] Native download failed:', e);
        // Fallback: open in system browser via Intent
        try {
          await installer.openUrl({ url: downloadUrl });
          return true;
        } catch (e2) {
          console.error('[Updater] openUrl fallback failed:', e2);
        }
      }
    }
    // Last resort fallback: try Android Intent via Capacitor core
    try {
      const { Browser } = window.Capacitor?.Plugins || {};
      if (Browser?.open) {
        await Browser.open({ url: downloadUrl });
        return true;
      }
    } catch (e) {}
    // Final fallback: system browser
    try {
      const intent = new Intent('android.intent.action.VIEW');
      window.location.href = downloadUrl;
    } catch (e) {}
    return false;
  }

  // On desktop/PWA, just reload
  window.location.reload();
  return true;
}

// Auto-check on startup and periodically
export function startAutoCheck() {
  // Check after 10 seconds (let the app load first)
  setTimeout(() => checkForUpdate(), 10000);
  // Then every 30 minutes
  setInterval(() => checkForUpdate(), CHECK_INTERVAL);
}
