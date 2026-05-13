package com.caissepro.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import android.os.RemoteException;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import woyou.aidlservice.jiuiv5.ICallback;
import woyou.aidlservice.jiuiv5.IWoyouService;

/**
 * CaissePro Sunmi Printer Plugin
 *
 * KEY INSIGHT: Sending many individual Capacitor calls from JS doesn't work reliably.
 * The async bridge causes commands to be lost or arrive out of order.
 *
 * Solution: printBatch() — JS sends ONE call with an array of print commands,
 * Java executes them ALL synchronously on a background thread.
 * This mirrors how testPrint() works (which has always been reliable).
 */
@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {
    private static final String TAG = "SunmiPrinter";
    private IWoyouService printerService = null;
    private boolean isBound = false;
    private boolean bindAttempted = false;
    private String bindError = null;

    private final ICallback defaultCallback = new ICallback.Stub() {
        @Override public void onRunResult(boolean isSuccess) {
            Log.d(TAG, "Callback onRunResult: " + isSuccess);
        }
        @Override public void onReturnString(String result) {
            Log.d(TAG, "Callback onReturnString: " + result);
        }
        @Override public void onRaiseException(int code, String msg) {
            Log.e(TAG, "Callback EXCEPTION code=" + code + " msg=" + msg);
        }
    };

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "Plugin loading — Device: " + Build.MANUFACTURER + " " + Build.MODEL);
        bindPrinterService();
    }

    private void bindPrinterService() {
        bindAttempted = true;
        try {
            Intent intent = new Intent();
            intent.setPackage("woyou.aidlservice.jiuiv5");
            intent.setAction("woyou.aidlservice.jiuiv5.IWoyouService");

            // IMPORTANT: startService BEFORE bindService (per Sunmi official demo)
            // This ensures the printer service is running before we try to bind
            try {
                getContext().startService(intent);
                Log.i(TAG, "startService called");
            } catch (Exception e) {
                Log.w(TAG, "startService failed (may be normal on newer Android): " + e.getMessage());
            }

            boolean bound = getContext().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
            Log.i(TAG, "bindService returned: " + bound);
            if (!bound) {
                bindError = "bindService returned false — service not found";
                Log.w(TAG, bindError);
            }
        } catch (Exception e) {
            bindError = "bindService exception: " + e.getMessage();
            Log.e(TAG, bindError);
        }
    }

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            printerService = IWoyouService.Stub.asInterface(service);
            isBound = true;
            bindError = null;
            Log.i(TAG, "=== SUNMI PRINTER SERVICE CONNECTED ===");
            try {
                int state = printerService.updatePrinterState();
                Log.i(TAG, "Printer state: " + state + " Serial: " + printerService.getPrinterSerialNo());
            } catch (RemoteException e) {
                Log.w(TAG, "Could not read printer info: " + e.getMessage());
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            printerService = null;
            isBound = false;
            Log.w(TAG, "Sunmi printer service DISCONNECTED");
        }
    };

    // ══════════════════════════════════════════════════════════════
    // DIAGNOSTIC
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("connected", isBound && printerService != null);
        ret.put("bindAttempted", bindAttempted);
        ret.put("isBound", isBound);
        ret.put("serviceAvailable", printerService != null);
        ret.put("manufacturer", Build.MANUFACTURER);
        ret.put("model", Build.MODEL);
        ret.put("isSunmi", Build.MANUFACTURER.toLowerCase().contains("sunmi"));

        if (bindError != null) ret.put("error", bindError);

        if (printerService != null) {
            try {
                ret.put("serial", printerService.getPrinterSerialNo());
                ret.put("printerVersion", printerService.getPrinterVersion());
                ret.put("serviceVersion", printerService.getServiceVersion());
                int state = printerService.updatePrinterState();
                ret.put("printerState", state);
                String stateLabel;
                switch (state) {
                    case 1: stateLabel = "NORMAL"; break;
                    case 2: stateLabel = "PREPARING"; break;
                    case 3: stateLabel = "ABNORMAL"; break;
                    case 4: stateLabel = "OVERHEATED"; break;
                    case 5: stateLabel = "NO_PAPER"; break;
                    case 6: stateLabel = "PAPER_JAM"; break;
                    case 7: stateLabel = "COVER_OPEN"; break;
                    case 505: stateLabel = "NO_PRINTER"; break;
                    case 507: stateLabel = "UPDATING_FIRMWARE"; break;
                    default: stateLabel = "UNKNOWN_" + state; break;
                }
                ret.put("printerStateLabel", stateLabel);
            } catch (RemoteException e) {
                ret.put("infoError", e.getMessage());
            }
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("connected", isBound && printerService != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void reconnect(PluginCall call) {
        Log.i(TAG, "Manual reconnect requested");
        if (isBound) {
            try { getContext().unbindService(serviceConnection); } catch (Exception e) {}
            printerService = null;
            isBound = false;
        }
        bindError = null;
        bindPrinterService();
        getActivity().getWindow().getDecorView().postDelayed(() -> {
            JSObject ret = new JSObject();
            ret.put("connected", isBound && printerService != null);
            ret.put("error", bindError);
            call.resolve(ret);
        }, 2000);
    }

    // ══════════════════════════════════════════════════════════════
    // SELF CHECK — Hardware test page (definitive print test)
    // If this prints, hardware is OK. If blank, paper is backwards.
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void selfCheck(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected");
            return;
        }
        new Thread(() -> {
            try {
                // printerSelfChecking prints the built-in hardware test page
                printerService.printerSelfChecking(null);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Self-check sent — if nothing prints, flip the paper!");
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (RemoteException e) {
                Log.e(TAG, "selfCheck failed: " + e.getMessage());
                getActivity().runOnUiThread(() -> call.reject("selfCheck failed: " + e.getMessage()));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // WAIT FOR READY — Poll printer state until NORMAL (state 1)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void waitForReady(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected");
            return;
        }
        int maxWaitMs = call.getInt("timeout", 10000);

        new Thread(() -> {
            long start = System.currentTimeMillis();
            int lastState = -1;
            while (System.currentTimeMillis() - start < maxWaitMs) {
                try {
                    lastState = printerService.updatePrinterState();
                    Log.d(TAG, "waitForReady: state=" + lastState);
                    if (lastState == 1) {
                        JSObject ret = new JSObject();
                        ret.put("ready", true);
                        ret.put("state", lastState);
                        ret.put("waitedMs", System.currentTimeMillis() - start);
                        getActivity().runOnUiThread(() -> call.resolve(ret));
                        return;
                    }
                } catch (RemoteException e) {
                    Log.w(TAG, "waitForReady state check error: " + e.getMessage());
                }
                try { Thread.sleep(500); } catch (InterruptedException e) { break; }
            }
            JSObject ret = new JSObject();
            ret.put("ready", false);
            ret.put("state", lastState);
            ret.put("waitedMs", System.currentTimeMillis() - start);
            ret.put("error", "Printer still not ready after " + maxWaitMs + "ms (state=" + lastState + ")");
            getActivity().runOnUiThread(() -> call.resolve(ret));
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // TEST PRINT — Simple, proven approach (no buffer tricks)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void resetPrinter(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected");
            return;
        }
        new Thread(() -> {
            try {
                Log.i(TAG, "resetPrinter: exiting buffer mode + printerInit");
                // Force exit buffer mode (may be stuck from a previous enterPrinterBuffer)
                try { printerService.exitPrinterBuffer(false); } catch (Exception e) {
                    Log.w(TAG, "exitPrinterBuffer: " + e.getMessage());
                }
                // Also try commitPrinterBuffer to flush anything stuck
                try { printerService.commitPrinterBuffer(); } catch (Exception e) {
                    Log.w(TAG, "commitPrinterBuffer: " + e.getMessage());
                }
                // Full re-init
                printerService.printerInit(defaultCallback);
                Thread.sleep(200);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Printer reset — buffer mode cleared");
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (Exception e) {
                Log.e(TAG, "resetPrinter error: " + e.getMessage());
                getActivity().runOnUiThread(() -> call.reject("resetPrinter failed: " + e.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void testPrint(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected. bindAttempted=" + bindAttempted + ", error=" + bindError);
            return;
        }
        new Thread(() -> {
            try {
                // Always exit buffer mode first in case it's stuck
                try { printerService.exitPrinterBuffer(false); } catch (Exception e) {}
                printerService.printerInit(defaultCallback);
                printerService.setAlignment(1, defaultCallback);
                printerService.setFontSize(28f, defaultCallback);
                printerService.printText("=== TEST CaissePro ===\n", defaultCallback);
                printerService.setFontSize(20f, defaultCallback);
                printerService.printText("Imprimante OK\n", defaultCallback);
                printerService.printText(Build.MANUFACTURER + " " + Build.MODEL + "\n", defaultCallback);
                printerService.printText(new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm:ss", java.util.Locale.FRANCE)
                    .format(new java.util.Date()) + "\n", defaultCallback);
                printerService.printText("================================\n", defaultCallback);
                printerService.printText("Ligne 1 - Test texte normal\n", defaultCallback);
                printerService.setFontSize(28f, defaultCallback);
                printerService.printText("Ligne 2 - Grand texte\n", defaultCallback);
                printerService.setFontSize(20f, defaultCallback);
                printerService.printText("Ligne 3 - Fin du test\n", defaultCallback);
                printerService.lineWrap(4, defaultCallback);
                try { printerService.cutPaper(defaultCallback); } catch (Exception e) {}

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Test OK — " + Build.MODEL);
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (RemoteException e) {
                Log.e(TAG, "testPrint failed: " + e.getMessage());
                getActivity().runOnUiThread(() -> call.reject("testPrint failed: " + e.getMessage()));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // PRINT BATCH — The core method for all receipt printing
    //
    // JS sends ONE Capacitor call with a JSON array of commands.
    // Java executes them ALL synchronously — no async gaps.
    //
    // Command format: { "cmd": "text|bold|size|align|line|cut|feed|raw", ...params }
    //
    // Examples:
    //   { "cmd": "text", "text": "Hello\n" }
    //   { "cmd": "bold", "enabled": true }
    //   { "cmd": "size", "value": 28 }
    //   { "cmd": "align", "value": 1 }       // 0=left, 1=center, 2=right
    //   { "cmd": "line" }                     // separator line
    //   { "cmd": "feed", "lines": 4 }
    //   { "cmd": "cut" }
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printBatch(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected");
            return;
        }

        JSArray commands = call.getArray("commands");
        if (commands == null || commands.length() == 0) {
            call.reject("No print commands provided");
            return;
        }

        Log.i(TAG, "printBatch: " + commands.length() + " commands");

        new Thread(() -> {
            try {
                // Always exit buffer mode first in case it's stuck
                try { printerService.exitPrinterBuffer(false); } catch (Exception e) {}
                printerService.printerInit(defaultCallback);

                // Track current font size so "bold" can bump it up slightly
                float currentSize = 20f;

                for (int i = 0; i < commands.length(); i++) {
                    JSONObject cmd;
                    try {
                        cmd = commands.getJSONObject(i);
                    } catch (JSONException e) {
                        Log.w(TAG, "Skip invalid command at index " + i);
                        continue;
                    }

                    String type = cmd.optString("cmd", "");
                    Log.d(TAG, "printBatch cmd[" + i + "]=" + type);
                    switch (type) {
                        case "text":
                            String text = cmd.optString("text", "");
                            if (!text.isEmpty()) {
                                printerService.printText(text, defaultCallback);
                            }
                            break;

                        case "bold":
                            boolean enabled = cmd.optBoolean("enabled", false);
                            if (enabled) {
                                printerService.setFontSize(currentSize + 2f, defaultCallback);
                            } else {
                                printerService.setFontSize(currentSize, defaultCallback);
                            }
                            break;

                        case "size":
                            float size = (float) cmd.optDouble("value", 20);
                            currentSize = size;
                            printerService.setFontSize(size, defaultCallback);
                            break;

                        case "align":
                            int align = cmd.optInt("value", 0);
                            printerService.setAlignment(align, defaultCallback);
                            break;

                        case "line":
                            String sep = cmd.optString("char", "-");
                            int len = cmd.optInt("len", 32);
                            StringBuilder sb = new StringBuilder();
                            for (int j = 0; j < len; j++) sb.append(sep);
                            sb.append("\n");
                            printerService.printText(sb.toString(), defaultCallback);
                            break;

                        case "feed":
                            int lines = cmd.optInt("lines", 3);
                            printerService.lineWrap(lines, defaultCallback);
                            break;

                        case "cut":
                            try { printerService.cutPaper(defaultCallback); } catch (Exception e) {}
                            break;

                        case "qr":
                            String qrContent = cmd.optString("text", "");
                            int qrSize = cmd.optInt("size", 6);
                            if (!qrContent.isEmpty()) {
                                printerService.printQRCode(qrContent, qrSize, 3, defaultCallback);
                            }
                            break;

                        case "barcode":
                            String bcContent = cmd.optString("text", "");
                            if (!bcContent.isEmpty()) {
                                printerService.printBarCode(bcContent, 8, 80, 2, 2, defaultCallback);
                            }
                            break;

                        default:
                            Log.w(TAG, "Unknown batch command: " + type);
                            break;
                    }
                }

                Log.i(TAG, "printBatch completed successfully");
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("commandCount", commands.length());
                getActivity().runOnUiThread(() -> call.resolve(ret));

            } catch (Exception e) {
                Log.e(TAG, "printBatch error: " + e.getMessage(), e);
                final String errMsg = e.getMessage();
                getActivity().runOnUiThread(() -> call.reject("printBatch failed: " + errMsg));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // ══════════════════════════════════════════════════════════════
    // PRINT MINIMAL — Ultimate diagnostic: try every AIDL method
    // No printerInit, no exitPrinterBuffer, just raw calls
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printMinimal(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected");
            return;
        }

        Log.i(TAG, "printMinimal — trying every possible print method");

        new Thread(() -> {
            JSObject ret = new JSObject();
            StringBuilder log = new StringBuilder();

            // Test 1: feedPaper — does the motor work at all?
            try {
                log.append("feedPaper(30mm): ");
                printerService.feedPaper(30, defaultCallback);
                log.append("OK\n");
            } catch (Exception e) {
                log.append("ERR: ").append(e.getMessage()).append("\n");
            }

            // Small pause
            try { Thread.sleep(500); } catch (Exception e) {}

            // Test 2: printText WITHOUT any printerInit
            try {
                log.append("printText (no init): ");
                printerService.printText("TEST MINIMAL printText\n", defaultCallback);
                log.append("OK\n");
            } catch (Exception e) {
                log.append("ERR: ").append(e.getMessage()).append("\n");
            }

            try { Thread.sleep(300); } catch (Exception e) {}

            // Test 3: printOriginalText — different code path
            try {
                log.append("printOriginalText: ");
                printerService.printOriginalText("TEST MINIMAL printOriginalText\n", defaultCallback);
                log.append("OK\n");
            } catch (Exception e) {
                log.append("ERR: ").append(e.getMessage()).append("\n");
            }

            try { Thread.sleep(300); } catch (Exception e) {}

            // Test 4: printTextWithFont — with explicit font
            try {
                log.append("printTextWithFont: ");
                printerService.printTextWithFont("TEST MINIMAL withFont\n", "", 24f, defaultCallback);
                log.append("OK\n");
            } catch (Exception e) {
                log.append("ERR: ").append(e.getMessage()).append("\n");
            }

            try { Thread.sleep(300); } catch (Exception e) {}

            // Test 5: sendRAWData — raw ESC/POS
            try {
                log.append("sendRAWData (ESC @, text, LF): ");
                String rawText = "TEST MINIMAL sendRAWData\n";
                byte[] rawBytes = new byte[2 + rawText.length()];
                rawBytes[0] = 0x1B; rawBytes[1] = 0x40; // ESC @
                System.arraycopy(rawText.getBytes("UTF-8"), 0, rawBytes, 2, rawText.length());
                printerService.sendRAWData(rawBytes, defaultCallback);
                log.append("OK\n");
            } catch (Exception e) {
                log.append("ERR: ").append(e.getMessage()).append("\n");
            }

            try { Thread.sleep(300); } catch (Exception e) {}

            // Test 6: lineWrap — feed lines
            try {
                log.append("lineWrap(5): ");
                printerService.lineWrap(5, defaultCallback);
                log.append("OK\n");
            } catch (Exception e) {
                log.append("ERR: ").append(e.getMessage()).append("\n");
            }

            try { Thread.sleep(300); } catch (Exception e) {}

            // Test 7: printerInit THEN printText
            try {
                log.append("printerInit + printText: ");
                printerService.printerInit(defaultCallback);
                Thread.sleep(200);
                printerService.printText("TEST APRES INIT\n", defaultCallback);
                printerService.lineWrap(4, defaultCallback);
                log.append("OK\n");
            } catch (Exception e) {
                log.append("ERR: ").append(e.getMessage()).append("\n");
            }

            // Check state
            try {
                int state = printerService.updatePrinterState();
                log.append("printerState: ").append(state).append("\n");
            } catch (Exception e) {
                log.append("state ERR: ").append(e.getMessage()).append("\n");
            }

            ret.put("success", true);
            ret.put("log", log.toString());
            getActivity().runOnUiThread(() -> call.resolve(ret));
        }).start();
    }

    // PRINT DIRECT — Bypass JSON parsing, hardcoded AIDL calls
    // Used to diagnose if printBatch JSON parsing is the problem
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printDirect(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected");
            return;
        }

        // Get mode: "simple" = text only, "formatted" = with align/size, "ticket" = full receipt
        String mode = call.getString("mode", "simple");
        Log.i(TAG, "printDirect mode=" + mode);

        new Thread(() -> {
            try {
                // Always exit buffer mode first in case it's stuck
                try { printerService.exitPrinterBuffer(false); } catch (Exception e) {}
                printerService.printerInit(defaultCallback);

                if ("simple".equals(mode)) {
                    printerService.printText("=== PRINT DIRECT SIMPLE ===\n", defaultCallback);
                    printerService.printText("Ce texte vient de printDirect\n", defaultCallback);
                    printerService.printText("Pas de JSON, pas de boucle\n", defaultCallback);
                    printerService.printText("================================\n", defaultCallback);
                    printerService.lineWrap(4, defaultCallback);
                    try { printerService.cutPaper(defaultCallback); } catch (Exception e) {}

                } else if ("formatted".equals(mode)) {
                    printerService.setAlignment(1, defaultCallback);
                    printerService.setFontSize(28f, defaultCallback);
                    printerService.printText("MA BOUTIQUE\n", defaultCallback);
                    printerService.setFontSize(20f, defaultCallback);
                    printerService.printText("123 Rue du Commerce\n", defaultCallback);
                    printerService.printText("75001 Paris\n", defaultCallback);
                    printerService.setAlignment(0, defaultCallback);
                    printerService.printText("================================\n", defaultCallback);
                    printerService.printText("N: TK-DIRECT  " + new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm", java.util.Locale.FRANCE).format(new java.util.Date()) + "\n", defaultCallback);
                    printerService.printText("Caissier: Admin\n", defaultCallback);
                    printerService.printText("--------------------------------\n", defaultCallback);
                    printerService.setFontSize(22f, defaultCallback);
                    printerService.printText("Jean Slim (Bleu/38)\n", defaultCallback);
                    printerService.setFontSize(20f, defaultCallback);
                    printerService.printText("  x1  59.90 EUR\n", defaultCallback);
                    printerService.printText("--------------------------------\n", defaultCallback);
                    printerService.setFontSize(28f, defaultCallback);
                    printerService.printText("TOTAL TTC    59.90 EUR\n", defaultCallback);
                    printerService.setFontSize(20f, defaultCallback);
                    printerService.printText("Paiement: CB 59.90 EUR\n", defaultCallback);
                    printerService.printText("================================\n", defaultCallback);
                    printerService.setAlignment(1, defaultCallback);
                    printerService.setFontSize(18f, defaultCallback);
                    printerService.printText("EMPREINTE NF525\n", defaultCallback);
                    printerService.printText("ABC123DEF456\n", defaultCallback);
                    printerService.lineWrap(4, defaultCallback);
                    try { printerService.cutPaper(defaultCallback); } catch (Exception e) {}

                } else if ("ticket".equals(mode)) {
                    String shopName = call.getString("shopName", "Ma Boutique");
                    String address = call.getString("address", "");
                    String ticketNum = call.getString("ticketNum", "?");
                    String total = call.getString("total", "0.00");
                    String payment = call.getString("payment", "CB");
                    String items = call.getString("items", "");

                    printerService.setAlignment(1, defaultCallback);
                    printerService.setFontSize(28f, defaultCallback);
                    printerService.printText(shopName + "\n", defaultCallback);
                    printerService.setFontSize(20f, defaultCallback);
                    if (!address.isEmpty()) printerService.printText(address + "\n", defaultCallback);
                    printerService.setAlignment(0, defaultCallback);
                    printerService.printText("================================\n", defaultCallback);
                    printerService.printText("N: " + ticketNum + "  " + new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm", java.util.Locale.FRANCE).format(new java.util.Date()) + "\n", defaultCallback);
                    printerService.printText("--------------------------------\n", defaultCallback);
                    if (!items.isEmpty()) {
                        for (String line : items.split("\\|")) {
                            printerService.printText(line + "\n", defaultCallback);
                        }
                    }
                    printerService.printText("--------------------------------\n", defaultCallback);
                    printerService.setFontSize(28f, defaultCallback);
                    printerService.printText("TOTAL TTC  " + total + " EUR\n", defaultCallback);
                    printerService.setFontSize(20f, defaultCallback);
                    printerService.printText("Paiement: " + payment + " " + total + " EUR\n", defaultCallback);
                    printerService.printText("================================\n", defaultCallback);
                    printerService.lineWrap(4, defaultCallback);
                    try { printerService.cutPaper(defaultCallback); } catch (Exception e) {}
                }

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("mode", mode);
                getActivity().runOnUiThread(() -> call.resolve(ret));

            } catch (Exception e) {
                Log.e(TAG, "printDirect error: " + e.getMessage(), e);
                final String errMsg = e.getMessage();
                getActivity().runOnUiThread(() -> call.reject("printDirect failed: " + errMsg));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // PRINT RAW ESC/POS — Bypass the AIDL pipeline entirely
    //
    // When printerState=2 (PREPARING), all AIDL calls (printText,
    // setFontSize, setAlignment) are silently dropped. But sendRAWData
    // still works because it bypasses the AIDL print queue.
    //
    // This method builds a complete ESC/POS byte stream from the same
    // JSON command array used by printBatch, then sends it as ONE
    // sendRAWData call.
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printRaw(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected");
            return;
        }

        JSArray commands = call.getArray("commands");
        if (commands == null || commands.length() == 0) {
            call.reject("No print commands provided");
            return;
        }

        Log.i(TAG, "printRaw: " + commands.length() + " commands → building ESC/POS bytes");

        new Thread(() -> {
            try {
                java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();

                // ESC @ — Initialize printer
                buf.write(new byte[]{0x1B, 0x40});

                for (int i = 0; i < commands.length(); i++) {
                    JSONObject cmd;
                    try {
                        cmd = commands.getJSONObject(i);
                    } catch (JSONException e) {
                        continue;
                    }

                    String type = cmd.optString("cmd", "");
                    switch (type) {
                        case "text":
                            String text = cmd.optString("text", "");
                            if (!text.isEmpty()) {
                                buf.write(text.getBytes("UTF-8"));
                            }
                            break;

                        case "bold":
                            boolean enabled = cmd.optBoolean("enabled", false);
                            buf.write(new byte[]{0x1B, 0x45, (byte)(enabled ? 1 : 0)});
                            break;

                        case "size":
                            int sizeVal = cmd.optInt("value", 20);
                            // ESC/POS GS ! n — character size multiplier
                            // Map our font sizes to ESC/POS size codes:
                            // <=18 = small (normal), 20-24 = normal, >=26 = double height+width
                            byte sizeCode;
                            if (sizeVal >= 26) {
                                sizeCode = 0x11; // double width + double height
                            } else if (sizeVal <= 18) {
                                sizeCode = 0x00; // normal
                            } else {
                                sizeCode = 0x00; // normal
                            }
                            buf.write(new byte[]{0x1D, 0x21, sizeCode});
                            break;

                        case "align":
                            int align = cmd.optInt("value", 0);
                            buf.write(new byte[]{0x1B, 0x61, (byte)align});
                            break;

                        case "line":
                            String sep = cmd.optString("char", "-");
                            int len = cmd.optInt("len", 32);
                            StringBuilder sb = new StringBuilder();
                            for (int j = 0; j < len; j++) sb.append(sep);
                            sb.append("\n");
                            buf.write(sb.toString().getBytes("UTF-8"));
                            break;

                        case "feed":
                            int lines = cmd.optInt("lines", 3);
                            buf.write(new byte[]{0x1B, 0x64, (byte)lines});
                            break;

                        case "cut":
                            buf.write(new byte[]{0x1D, 0x56, 0x00});
                            break;

                        default:
                            break;
                    }
                }

                byte[] rawData = buf.toByteArray();
                Log.i(TAG, "printRaw: sending " + rawData.length + " bytes via sendRAWData");
                printerService.sendRAWData(rawData, defaultCallback);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("commandCount", commands.length());
                ret.put("bytesSent", rawData.length);
                getActivity().runOnUiThread(() -> call.resolve(ret));

            } catch (Exception e) {
                Log.e(TAG, "printRaw error: " + e.getMessage(), e);
                final String errMsg = e.getMessage();
                getActivity().runOnUiThread(() -> call.reject("printRaw failed: " + errMsg));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // Legacy single-command methods (kept for compatibility)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printerInit(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try { printerService.printerInit(defaultCallback); call.resolve(); }
        catch (RemoteException e) { call.reject("printerInit failed: " + e.getMessage()); }
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try { printerService.printText(text, defaultCallback); call.resolve(); }
        catch (RemoteException e) { call.reject("printText failed: " + e.getMessage()); }
    }

    @PluginMethod
    public void setAlignment(PluginCall call) {
        int alignment = call.getInt("alignment", 0);
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try { printerService.setAlignment(alignment, defaultCallback); call.resolve(); }
        catch (RemoteException e) { call.reject("setAlignment failed: " + e.getMessage()); }
    }

    @PluginMethod
    public void setFontSize(PluginCall call) {
        float size = call.getFloat("size", 20f);
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try { printerService.setFontSize(size, defaultCallback); call.resolve(); }
        catch (RemoteException e) { call.reject("setFontSize failed: " + e.getMessage()); }
    }

    @PluginMethod
    public void setBold(PluginCall call) {
        boolean bold = call.getBoolean("bold", false);
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try {
            byte[] cmd = bold ? new byte[]{0x1B, 0x45, 0x01} : new byte[]{0x1B, 0x45, 0x00};
            printerService.sendRAWData(cmd, defaultCallback);
            call.resolve();
        } catch (RemoteException e) { call.reject("setBold failed: " + e.getMessage()); }
    }

    @PluginMethod
    public void lineWrap(PluginCall call) {
        int lines = call.getInt("lines", 3);
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try { printerService.lineWrap(lines, defaultCallback); call.resolve(); }
        catch (RemoteException e) { call.reject("lineWrap failed: " + e.getMessage()); }
    }

    @PluginMethod
    public void cutPaper(PluginCall call) {
        if (printerService == null) { call.resolve(); return; }
        try { printerService.cutPaper(defaultCallback); call.resolve(); }
        catch (RemoteException e) { call.resolve(); }
    }

    @PluginMethod
    public void openDrawer(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try {
            printerService.openDrawer(defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            try {
                byte[] cmd = new byte[]{0x1B, 0x70, 0x00, 0x19, (byte) 0xFA};
                printerService.sendRAWData(cmd, defaultCallback);
                call.resolve();
            } catch (RemoteException e2) { call.reject("openDrawer failed: " + e2.getMessage()); }
        }
    }

    @PluginMethod
    public void sendRAWData(PluginCall call) {
        String base64Data = call.getString("data", "");
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try {
            byte[] data = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
            printerService.sendRAWData(data, defaultCallback);
            call.resolve();
        } catch (Exception e) { call.reject("sendRAWData failed: " + e.getMessage()); }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (isBound) {
            try { getContext().unbindService(serviceConnection); } catch (Exception e) {}
        }
    }
}
