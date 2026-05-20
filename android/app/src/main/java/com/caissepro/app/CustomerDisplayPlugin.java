package com.caissepro.app;

import android.app.Presentation;
import android.content.Context;
import android.hardware.display.DisplayManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Display;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * CustomerDisplayPlugin — Affiche le panier client sur le second ecran Sunmi T2/D2.
 *
 * Architecture:
 * - L'ecran principal = WebView Capacitor avec la PWA CaissePro
 * - Le second ecran = Android Presentation avec une WebView chargeant customer-display.html
 * - Communication: JS appelle updateCart() → plugin injecte les donnees dans la WebView du 2nd ecran
 *
 * Pas besoin d'API serveur pour la sync — tout se passe en local dans la meme app.
 */
@CapacitorPlugin(name = "CustomerDisplay")
public class CustomerDisplayPlugin extends Plugin {

    private static final String TAG = "CustomerDisplay";
    private CustomerPresentation presentation;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private String pendingCartJson = null;
    private boolean webViewReady = false;

    @Override
    public void load() {
        super.load();
        // Auto-detect and connect second screen on plugin load
        mainHandler.postDelayed(this::autoConnect, 2000);

        // Listen for display changes
        DisplayManager dm = (DisplayManager) getContext().getSystemService(Context.DISPLAY_SERVICE);
        if (dm != null) {
            dm.registerDisplayListener(new DisplayManager.DisplayListener() {
                @Override
                public void onDisplayAdded(int displayId) {
                    mainHandler.postDelayed(() -> autoConnect(), 500);
                }
                @Override
                public void onDisplayRemoved(int displayId) {
                    mainHandler.post(() -> {
                        if (presentation != null) {
                            try { presentation.dismiss(); } catch (Exception e) {}
                            presentation = null;
                            webViewReady = false;
                        }
                        notifyListeners("displayChanged", new JSObject().put("connected", false));
                    });
                }
                @Override
                public void onDisplayChanged(int displayId) {}
            }, mainHandler);
        }
    }

    private void autoConnect() {
        if (presentation != null && presentation.isShowing()) return;
        Display secondDisplay = findSecondDisplay();
        if (secondDisplay != null) {
            showPresentation(secondDisplay);
        }
    }

    private Display findSecondDisplay() {
        DisplayManager dm = (DisplayManager) getContext().getSystemService(Context.DISPLAY_SERVICE);
        if (dm == null) return null;

        // Try presentation displays first
        Display[] displays = dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION);
        if (displays.length > 0) return displays[0];

        // Fallback: any secondary display
        Display[] allDisplays = dm.getDisplays();
        if (allDisplays.length > 1) return allDisplays[1];

        return null;
    }

    private void showPresentation(Display display) {
        if (presentation != null) {
            try { presentation.dismiss(); } catch (Exception e) {}
        }
        webViewReady = false;

        try {
            // Build URL from the app's server URL (Capacitor serves from localhost or file)
            String serverUrl = getBridge().getServerUrl();
            String displayUrl;
            if (serverUrl != null && serverUrl.startsWith("http")) {
                displayUrl = serverUrl + "/customer-display.html";
            } else {
                // File-based: use the asset path
                displayUrl = "file:///android_asset/public/customer-display.html";
            }

            presentation = new CustomerPresentation(getContext(), display, displayUrl, this);
            presentation.show();
            Log.i(TAG, "Second screen connected: " + display.getName() + " → " + displayUrl);
            notifyListeners("displayChanged", new JSObject().put("connected", true));
        } catch (WindowManager.InvalidDisplayException e) {
            Log.e(TAG, "Invalid display: " + e.getMessage());
            presentation = null;
        }
    }

    /**
     * Called from JavaScript: CustomerDisplay.updateCart({ items: [...], total: "..." })
     * Sends cart data to the second screen WebView.
     */
    @PluginMethod
    public void updateCart(PluginCall call) {
        JSObject data = call.getData();
        String json = data.toString();

        mainHandler.post(() -> {
            if (presentation != null && webViewReady) {
                injectCartData(json);
            } else {
                // Save for when WebView becomes ready
                pendingCartJson = json;
            }
        });

        call.resolve(new JSObject().put("success", true));
    }

    /**
     * Called from JavaScript: check if second screen is connected.
     */
    @PluginMethod
    public void isConnected(PluginCall call) {
        boolean connected = presentation != null && presentation.isShowing();
        Display secondDisplay = findSecondDisplay();
        JSObject result = new JSObject();
        result.put("connected", connected);
        result.put("displayAvailable", secondDisplay != null);
        result.put("displayName", secondDisplay != null ? secondDisplay.getName() : null);
        call.resolve(result);
    }

    /**
     * Manually trigger connection attempt.
     */
    @PluginMethod
    public void connect(PluginCall call) {
        mainHandler.post(() -> {
            Display display = findSecondDisplay();
            if (display != null) {
                showPresentation(display);
                call.resolve(new JSObject().put("connected", true));
            } else {
                call.resolve(new JSObject().put("connected", false).put("error", "Aucun second ecran detecte"));
            }
        });
    }

    private void injectCartData(String json) {
        if (presentation == null || presentation.webView == null) return;
        // Escape for JavaScript string
        String escaped = json.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
        String script = "if(window.updateCart){window.updateCart(JSON.parse('" + escaped + "'));}";
        presentation.webView.evaluateJavascript(script, null);
    }

    void onWebViewReady() {
        webViewReady = true;
        if (pendingCartJson != null) {
            injectCartData(pendingCartJson);
            pendingCartJson = null;
        }
    }

    /**
     * Full-screen WebView Presentation for the secondary display.
     */
    static class CustomerPresentation extends Presentation {
        private final String url;
        private final CustomerDisplayPlugin plugin;
        WebView webView;

        CustomerPresentation(Context context, Display display, String url, CustomerDisplayPlugin plugin) {
            super(context, display);
            this.url = url;
            this.plugin = plugin;
        }

        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);

            webView = new WebView(getContext());
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
            );
            webView.setLayoutParams(params);

            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(android.webkit.WebView view, String url) {
                    super.onPageFinished(view, url);
                    // WebView is ready to receive data
                    plugin.onWebViewReady();
                }

                @Override
                public void onReceivedError(android.webkit.WebView view, int errorCode,
                                            String description, String failingUrl) {
                    Log.w(TAG, "WebView error: " + description + " for " + failingUrl);
                    // Retry after 5 seconds
                    view.postDelayed(() -> view.reload(), 5000);
                }
            });

            webView.setWebChromeClient(new WebChromeClient());
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);
            webView.setBackgroundColor(0xFFF8FAF7);

            setContentView(webView);
            webView.loadUrl(url);
        }
    }
}
