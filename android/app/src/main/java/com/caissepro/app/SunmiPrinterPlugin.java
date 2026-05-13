package com.caissepro.app;

import android.os.Build;
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

import com.sunmi.peripheral.printer.InnerPrinterCallback;
import com.sunmi.peripheral.printer.InnerPrinterException;
import com.sunmi.peripheral.printer.InnerPrinterManager;
import com.sunmi.peripheral.printer.InnerResultCallback;
import com.sunmi.peripheral.printer.SunmiPrinterService;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.text.Normalizer;

/**
 * CaissePro Sunmi Printer Plugin - official Sunmi SDK
 *
 * Uses SDK printText() for all text (reliable on all Sunmi models).
 * Accented characters are normalized (e->e, c->c) because the T2s
 * firmware interprets UTF-8 multi-byte as Chinese/GBK.
 * A testCodepage method probes which ESC/POS codepages the device supports.
 */
@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {
    private static final String TAG = "SunmiPrinter";
    private SunmiPrinterService printerService = null;
    private boolean isBound = false;
    private boolean bindAttempted = false;
    private String bindError = null;

    private final InnerPrinterCallback printerCallback = new InnerPrinterCallback() {
        @Override
        protected void onConnected(SunmiPrinterService service) {
            printerService = service;
            isBound = true;
            bindError = null;
            Log.i(TAG, "=== SUNMI PRINTER SERVICE CONNECTED (SDK) ===");
            try {
                int state = printerService.updatePrinterState();
                Log.i(TAG, "Printer state: " + state);
                Log.i(TAG, "Serial: " + printerService.getPrinterSerialNo());
                Log.i(TAG, "Version: " + printerService.getPrinterVersion());
            } catch (RemoteException e) {
                Log.w(TAG, "Could not read printer info: " + e.getMessage());
            }
        }

        @Override
        protected void onDisconnected() {
            printerService = null;
            isBound = false;
            Log.w(TAG, "Sunmi printer service DISCONNECTED");
        }
    };

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "Plugin loading (SDK mode) - Device: " + Build.MANUFACTURER + " " + Build.MODEL);
        bindPrinterService();
    }

    private void bindPrinterService() {
        bindAttempted = true;
        try {
            boolean ret = InnerPrinterManager.getInstance().bindService(getContext(), printerCallback);
            Log.i(TAG, "InnerPrinterManager.bindService returned: " + ret);
            if (!ret) {
                bindError = "No Sunmi printer service found on this device";
                Log.w(TAG, bindError);
            }
        } catch (InnerPrinterException e) {
            bindError = "InnerPrinterException: " + e.getMessage();
            Log.e(TAG, bindError);
        }
    }

    // ── Accent normalization ──
    // Strips diacritics: e->e, e->e, c->c, a->a, etc.
    // Preserves EUR symbol as "EUR"
    private static String normalize(String input) {
        if (input == null) return "";
        // Replace EUR sign before normalization
        String s = input.replace("€", "EUR");
        // NFD decomposition separates base char from combining diacritical marks
        s = Normalizer.normalize(s, Normalizer.Form.NFD);
        // Remove all combining diacritical marks (Unicode category M)
        s = s.replaceAll("\\p{M}", "");
        return s;
    }

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
        ret.put("sdkMode", true);

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
            try {
                InnerPrinterManager.getInstance().unBindService(getContext(), printerCallback);
            } catch (Exception e) {
                Log.w(TAG, "unbind error: " + e.getMessage());
            }
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
    // SELF CHECK
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void selfCheck(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        new Thread(() -> {
            try {
                printerService.printerSelfChecking(null);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Self-check sent");
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (RemoteException e) {
                getActivity().runOnUiThread(() -> call.reject("selfCheck failed: " + e.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void waitForReady(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        int timeout = call.getInt("timeout", 10000);
        new Thread(() -> {
            try {
                long start = System.currentTimeMillis();
                int state = -1;
                while (System.currentTimeMillis() - start < timeout) {
                    state = printerService.updatePrinterState();
                    if (state == 1) break;
                    Thread.sleep(500);
                }
                JSObject ret = new JSObject();
                ret.put("ready", state == 1);
                ret.put("printerState", state);
                ret.put("elapsed", System.currentTimeMillis() - start);
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (Exception e) {
                getActivity().runOnUiThread(() -> call.reject("waitForReady failed: " + e.getMessage()));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // RESET PRINTER
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void resetPrinter(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        new Thread(() -> {
            try {
                printerService.printerInit(null);
                Thread.sleep(200);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Printer reset");
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (Exception e) {
                getActivity().runOnUiThread(() -> call.reject("resetPrinter failed: " + e.getMessage()));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // TEST PRINT — SDK printText (proven to work on T2s)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void testPrint(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected. bindAttempted=" + bindAttempted + ", error=" + bindError);
            return;
        }
        new Thread(() -> {
            try {
                printerService.printerInit(null);
                printerService.setAlignment(1, null);
                printerService.setFontSize(28f, null);
                printerService.printText(normalize("=== TEST CaissePro ===\n"), null);
                printerService.setFontSize(20f, null);
                printerService.printText(normalize("SDK Mode - Imprimante OK\n"), null);
                printerService.printText(normalize(Build.MANUFACTURER + " " + Build.MODEL + "\n"), null);
                printerService.printText(normalize(new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm:ss", java.util.Locale.FRANCE)
                    .format(new java.util.Date()) + "\n"), null);
                printerService.printText("================================\n", null);
                printerService.setAlignment(0, null);
                printerService.printText("Ligne 1 - Test texte normal\n", null);
                printerService.printText(normalize("Accents normalises: ecauc (eecaucoie)\n"), null);
                printerService.printText(normalize("Prix: 29,90 EUR TTC\n"), null);
                printerService.setFontSize(28f, null);
                printerService.printText("Ligne 2 - Grand texte\n", null);
                printerService.setFontSize(20f, null);
                printerService.printText("Ligne 3 - Fin du test\n", null);
                printerService.lineWrap(4, null);
                // Cut via ESC/POS
                try { printerService.sendRAWData(new byte[]{0x1D, 0x56, 0x01}, null); } catch (Exception e) {}

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Test OK - " + Build.MODEL);
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (Exception e) {
                Log.e(TAG, "testPrint failed: " + e.getMessage());
                final String err = e.getMessage();
                getActivity().runOnUiThread(() -> call.reject("testPrint failed: " + err));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // TEST CODEPAGE — uses SDK printText with various accent approaches
    // No ESC/POS commands (sendRAWData with ESC t = blank on T2s)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void testCodepage(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        new Thread(() -> {
            try {
                printerService.printerInit(null);
                printerService.setAlignment(1, null);
                printerService.setFontSize(24f, null);
                printerService.printText("=== TEST ACCENTS ===\n", null);
                printerService.setFontSize(20f, null);
                printerService.setAlignment(0, null);
                printerService.printText("--------------------------------\n", null);

                // Test 1: printText with raw Unicode accents (shows Chinese on T2s)
                printerService.printText("1) printText Unicode:\n", null);
                printerService.printText("   éèàùçôîê\n", null);

                // Test 2: printText with normalized (no accents)
                printerService.printText("2) Normalise (sans accents):\n", null);
                printerService.printText("   " + normalize("éèàùçôîê") + "\n", null);

                // Test 3: sendRAWData with plain ASCII (no ESC commands)
                printerService.printText("3) sendRAWData ASCII:\n", null);
                printerService.sendRAWData("   Hello ASCII test OK\n".getBytes("US-ASCII"), null);

                // Test 4: sendRAWData with UTF-8 accents (no ESC commands)
                printerService.printText("4) sendRAWData UTF-8:\n", null);
                printerService.sendRAWData("   éèàùçôîê\n".getBytes("UTF-8"), null);

                // Test 5: sendRAWData with GBK encoding
                printerService.printText("5) sendRAWData GBK:\n", null);
                try {
                    printerService.sendRAWData("   éèàùçôîê\n".getBytes("GBK"), null);
                } catch (Exception e) {
                    printerService.printText("   GBK error: " + e.getMessage() + "\n", null);
                }

                // Test 6: sendRAWData with raw high bytes (0xE9 etc) no codepage cmd
                printerService.printText("6) sendRAWData raw 0xE9:\n", null);
                printerService.sendRAWData(new byte[]{
                    ' ', ' ', ' ',
                    (byte)0xE9, ' ', (byte)0xE8, ' ', (byte)0xE0, ' ',
                    (byte)0xF9, ' ', (byte)0xE7, ' ', (byte)0xF4, ' ',
                    (byte)0xEE, ' ', (byte)0xEA, '\n'
                }, null);

                // Test 7: sendRAWData with ISO-8859-1
                printerService.printText("7) sendRAWData ISO-8859-1:\n", null);
                printerService.sendRAWData("   éèàùçôîê\n".getBytes("ISO-8859-1"), null);

                // Test 8: sendRAWData with ISO-8859-15 (has EUR)
                printerService.printText("8) sendRAWData ISO-8859-15:\n", null);
                printerService.sendRAWData("   éèàùçôîê\n".getBytes("ISO-8859-15"), null);

                printerService.printText("--------------------------------\n", null);
                printerService.printText("Ligne correcte = bonne methode\n", null);
                printerService.lineWrap(4, null);
                try { printerService.sendRAWData(new byte[]{0x1D, 0x56, 0x01}, null); } catch (Exception e) {}

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Test accents imprime - verifiez le ticket");
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (Exception e) {
                final String err = e.getMessage();
                getActivity().runOnUiThread(() -> call.reject("testCodepage failed: " + err));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // PRINT MINIMAL - diagnostic (uses SDK printText, no codepage)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printMinimal(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        new Thread(() -> {
            JSObject ret = new JSObject();
            StringBuilder log = new StringBuilder();
            try {
                int state = printerService.updatePrinterState();
                log.append("printerState: ").append(state).append("\n");
            } catch (Exception e) {
                log.append("state ERR: ").append(e.getMessage()).append("\n");
            }
            try {
                log.append("lineWrap(3): ");
                printerService.lineWrap(3, null);
                log.append("OK\n");
            } catch (Exception e) { log.append("ERR: ").append(e.getMessage()).append("\n"); }
            try { Thread.sleep(300); } catch (Exception e) {}
            try {
                log.append("printText: ");
                printerService.printText("TEST SDK printText\n", null);
                log.append("OK\n");
            } catch (Exception e) { log.append("ERR: ").append(e.getMessage()).append("\n"); }
            try { Thread.sleep(300); } catch (Exception e) {}
            try {
                log.append("sendRAWData: ");
                printerService.sendRAWData("TEST SDK sendRAWData\n".getBytes("UTF-8"), null);
                log.append("OK\n");
            } catch (Exception e) { log.append("ERR: ").append(e.getMessage()).append("\n"); }
            try { Thread.sleep(300); } catch (Exception e) {}
            try {
                log.append("lineWrap(4): ");
                printerService.lineWrap(4, null);
                log.append("OK\n");
            } catch (Exception e) { log.append("ERR: ").append(e.getMessage()).append("\n"); }
            ret.put("success", true);
            ret.put("log", log.toString());
            getActivity().runOnUiThread(() -> call.resolve(ret));
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // PRINT BATCH - Core receipt printing (SDK printText + normalize)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printBatch(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        JSArray commands = call.getArray("commands");
        if (commands == null || commands.length() == 0) { call.reject("No commands"); return; }

        Log.i(TAG, "printBatch: " + commands.length() + " commands");

        new Thread(() -> {
            try {
                printerService.printerInit(null);
                float currentSize = 20f;

                for (int i = 0; i < commands.length(); i++) {
                    JSONObject cmd;
                    try { cmd = commands.getJSONObject(i); }
                    catch (JSONException e) { continue; }

                    String type = cmd.optString("cmd", "");
                    switch (type) {
                        case "text":
                            String text = cmd.optString("text", "");
                            if (!text.isEmpty()) printerService.printText(normalize(text), null);
                            break;
                        case "bold":
                            boolean enabled = cmd.optBoolean("enabled", false);
                            printerService.setFontSize(enabled ? currentSize + 2f : currentSize, null);
                            break;
                        case "size":
                            float size = (float) cmd.optDouble("value", 20);
                            currentSize = size;
                            printerService.setFontSize(size, null);
                            break;
                        case "align":
                            int align = cmd.optInt("value", 0);
                            printerService.setAlignment(align, null);
                            break;
                        case "line":
                            String sep = cmd.optString("char", "-");
                            int len = cmd.optInt("len", 32);
                            StringBuilder sb = new StringBuilder();
                            for (int j = 0; j < len; j++) sb.append(sep);
                            sb.append("\n");
                            printerService.printText(sb.toString(), null);
                            break;
                        case "feed":
                            int lines = cmd.optInt("lines", 3);
                            printerService.lineWrap(lines, null);
                            break;
                        case "cut":
                            try { printerService.sendRAWData(new byte[]{0x1D, 0x56, 0x01}, null); } catch (Exception e) {}
                            break;
                        case "qr":
                            String qr = cmd.optString("text", "");
                            int qrSz = cmd.optInt("size", 6);
                            if (!qr.isEmpty()) printerService.printQRCode(qr, qrSz, 3, null);
                            break;
                        case "barcode":
                            String bc = cmd.optString("text", "");
                            if (!bc.isEmpty()) printerService.printBarCode(bc, 8, 80, 2, 2, null);
                            break;
                    }
                }

                Log.i(TAG, "printBatch completed");
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("commandCount", commands.length());
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (Exception e) {
                Log.e(TAG, "printBatch error: " + e.getMessage(), e);
                final String err = e.getMessage();
                getActivity().runOnUiThread(() -> call.reject("printBatch failed: " + err));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // PRINT RAW ESC/POS (no codepage — UTF-8 + normalize)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printRaw(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        JSArray commands = call.getArray("commands");
        if (commands == null || commands.length() == 0) { call.reject("No commands"); return; }

        new Thread(() -> {
            try {
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                buf.write(new byte[]{0x1B, 0x40}); // ESC @ init

                for (int i = 0; i < commands.length(); i++) {
                    JSONObject cmd;
                    try { cmd = commands.getJSONObject(i); } catch (JSONException e) { continue; }
                    String type = cmd.optString("cmd", "");
                    switch (type) {
                        case "text":
                            String text = cmd.optString("text", "");
                            if (!text.isEmpty()) buf.write(normalize(text).getBytes("UTF-8"));
                            break;
                        case "bold":
                            buf.write(new byte[]{0x1B, 0x45, (byte)(cmd.optBoolean("enabled", false) ? 1 : 0)});
                            break;
                        case "size":
                            int sz = cmd.optInt("value", 20);
                            if (sz >= 26) buf.write(new byte[]{0x1D, 0x21, 0x11});
                            else if (sz >= 22) buf.write(new byte[]{0x1D, 0x21, 0x01});
                            else buf.write(new byte[]{0x1D, 0x21, 0x00});
                            break;
                        case "align":
                            buf.write(new byte[]{0x1B, 0x61, (byte)cmd.optInt("value", 0)});
                            break;
                        case "line":
                            String s = cmd.optString("char", "-");
                            int l = cmd.optInt("len", 32);
                            StringBuilder sb = new StringBuilder();
                            for (int j = 0; j < l; j++) sb.append(s);
                            sb.append("\n");
                            buf.write(sb.toString().getBytes("UTF-8"));
                            break;
                        case "feed":
                            buf.write(new byte[]{0x1B, 0x64, (byte)cmd.optInt("lines", 3)});
                            break;
                        case "cut":
                            buf.write(new byte[]{0x1D, 0x56, 0x01});
                            break;
                    }
                }

                byte[] rawData = buf.toByteArray();
                printerService.sendRAWData(rawData, null);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("commandCount", commands.length());
                ret.put("bytesSent", rawData.length);
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (Exception e) {
                final String err = e.getMessage();
                getActivity().runOnUiThread(() -> call.reject("printRaw failed: " + err));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // PRINT DIRECT - diagnostic (SDK printText)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printDirect(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        String mode = call.getString("mode", "simple");
        new Thread(() -> {
            try {
                printerService.printerInit(null);
                if ("simple".equals(mode)) {
                    printerService.printText("=== PRINT DIRECT (SDK) ===\n", null);
                    printerService.printText("Ce texte vient du SDK Sunmi\n", null);
                    printerService.printText(normalize("Accents normalises: e e a u c o\n"), null);
                    printerService.printText("================================\n", null);
                    printerService.lineWrap(4, null);
                } else if ("formatted".equals(mode)) {
                    printerService.setAlignment(1, null);
                    printerService.setFontSize(28f, null);
                    printerService.printText("MA BOUTIQUE\n", null);
                    printerService.setFontSize(20f, null);
                    printerService.printText(normalize("123 Rue du Commerce\n"), null);
                    printerService.setAlignment(0, null);
                    printerService.printText("================================\n", null);
                    printerService.printText("TOTAL TTC    59.90 EUR\n", null);
                    printerService.lineWrap(4, null);
                }
                // Cut
                try { printerService.sendRAWData(new byte[]{0x1D, 0x56, 0x01}, null); } catch (Exception e) {}

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("mode", mode);
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (Exception e) {
                final String err = e.getMessage();
                getActivity().runOnUiThread(() -> call.reject("printDirect failed: " + err));
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // Legacy single-command methods (kept for JS compatibility)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printerInit(PluginCall call) {
        if (printerService == null) { call.reject("Not connected"); return; }
        try { printerService.printerInit(null); call.resolve(); }
        catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void printText(PluginCall call) {
        if (printerService == null) { call.reject("Not connected"); return; }
        try { printerService.printText(call.getString("text", ""), null); call.resolve(); }
        catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void setAlignment(PluginCall call) {
        if (printerService == null) { call.reject("Not connected"); return; }
        try { printerService.setAlignment(call.getInt("alignment", 0), null); call.resolve(); }
        catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void setFontSize(PluginCall call) {
        if (printerService == null) { call.reject("Not connected"); return; }
        try { printerService.setFontSize(call.getFloat("size", 20f), null); call.resolve(); }
        catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void setBold(PluginCall call) {
        if (printerService == null) { call.reject("Not connected"); return; }
        try {
            boolean bold = call.getBoolean("bold", false);
            byte[] cmd = bold ? new byte[]{0x1B, 0x45, 0x01} : new byte[]{0x1B, 0x45, 0x00};
            printerService.sendRAWData(cmd, null);
            call.resolve();
        } catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void lineWrap(PluginCall call) {
        if (printerService == null) { call.reject("Not connected"); return; }
        try { printerService.lineWrap(call.getInt("lines", 3), null); call.resolve(); }
        catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void cutPaper(PluginCall call) {
        if (printerService == null) { call.reject("Not connected"); return; }
        try { printerService.sendRAWData(new byte[]{0x1D, 0x56, 0x01}, null); call.resolve(); }
        catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void openDrawer(PluginCall call) {
        if (printerService == null) { call.reject("Not connected"); return; }
        try { printerService.sendRAWData(new byte[]{0x1B, 0x70, 0x00, 0x19, (byte)0xFA}, null); call.resolve(); }
        catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void sendRAWData(PluginCall call) {
        if (printerService == null) { call.reject("Not connected"); return; }
        try {
            String b64 = call.getString("data", "");
            byte[] data = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            printerService.sendRAWData(data, null);
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }
}
