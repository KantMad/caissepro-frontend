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

/**
 * CaissePro Sunmi Printer Plugin - official Sunmi SDK
 *
 * ALL text printing uses sendRAWData with ESC/POS codepage WPC1252
 * to ensure French accented characters print correctly.
 * We never mix sendRAWData codepage commands with printText SDK calls.
 */
@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {
    private static final String TAG = "SunmiPrinter";
    private static final String CHARSET = "Windows-1252";
    private SunmiPrinterService printerService = null;
    private boolean isBound = false;
    private boolean bindAttempted = false;
    private String bindError = null;

    // ESC/POS constants
    private static final byte[] ESC_INIT = {0x1B, 0x40};
    private static final byte[] ESC_CODEPAGE_WPC1252 = {0x1B, 0x74, 0x10};
    private static final byte ESC = 0x1B;
    private static final byte GS = 0x1D;

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

    // ---- RAW HELPERS ----

    /** Start a raw ESC/POS buffer with init + codepage WPC1252 */
    private ByteArrayOutputStream rawBegin() throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        buf.write(ESC_INIT);
        buf.write(ESC_CODEPAGE_WPC1252);
        return buf;
    }

    /** Write text encoded in Windows-1252 */
    private void rawText(ByteArrayOutputStream buf, String text) throws IOException {
        if (text != null && !text.isEmpty()) {
            buf.write(text.getBytes(CHARSET));
        }
    }

    /** ESC a n - set alignment (0=left, 1=center, 2=right) */
    private void rawAlign(ByteArrayOutputStream buf, int align) throws IOException {
        buf.write(new byte[]{ESC, 0x61, (byte) align});
    }

    /** GS ! n - set character size (0x00=normal, 0x11=double, 0x01=double-height only) */
    private void rawSize(ByteArrayOutputStream buf, int n) throws IOException {
        buf.write(new byte[]{GS, 0x21, (byte) n});
    }

    /** ESC E n - bold on/off */
    private void rawBold(ByteArrayOutputStream buf, boolean on) throws IOException {
        buf.write(new byte[]{ESC, 0x45, (byte) (on ? 1 : 0)});
    }

    /** ESC d n - feed n lines */
    private void rawFeed(ByteArrayOutputStream buf, int lines) throws IOException {
        buf.write(new byte[]{ESC, 0x64, (byte) lines});
    }

    /** GS V 1 - partial cut */
    private void rawCut(ByteArrayOutputStream buf) throws IOException {
        buf.write(new byte[]{GS, 0x56, 0x01});
    }

    /** Send the buffer to the printer */
    private void rawSend(ByteArrayOutputStream buf) throws RemoteException {
        printerService.sendRAWData(buf.toByteArray(), null);
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
    // TEST PRINT — full raw ESC/POS, no SDK printText
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void testPrint(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected. bindAttempted=" + bindAttempted + ", error=" + bindError);
            return;
        }
        new Thread(() -> {
            try {
                ByteArrayOutputStream buf = rawBegin();

                // Header centered, double size
                rawAlign(buf, 1);
                rawSize(buf, 0x11);
                rawText(buf, "=== TEST CaissePro ===\n");

                // Normal size
                rawSize(buf, 0x00);
                rawText(buf, "SDK Mode - Imprimante OK\n");
                rawText(buf, Build.MANUFACTURER + " " + Build.MODEL + "\n");
                rawText(buf, new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm:ss", java.util.Locale.FRANCE)
                    .format(new java.util.Date()) + "\n");
                rawText(buf, "================================\n");

                // Left align for body
                rawAlign(buf, 0);
                rawText(buf, "Ligne 1 - Test texte normal\n");
                rawText(buf, "Accents: é è à ù ç ô î ê\n");
                rawText(buf, "Euro: 29,90 € TTC\n");

                // Double size
                rawSize(buf, 0x11);
                rawText(buf, "Ligne 2 - Grand texte\n");

                // Normal
                rawSize(buf, 0x00);
                rawText(buf, "Ligne 3 - Fin du test\n");

                rawFeed(buf, 4);
                rawCut(buf);

                rawSend(buf);

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
    // PRINT BATCH - Core receipt printing (full raw ESC/POS)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printBatch(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        JSArray commands = call.getArray("commands");
        if (commands == null || commands.length() == 0) { call.reject("No commands"); return; }

        Log.i(TAG, "printBatch: " + commands.length() + " commands");

        new Thread(() -> {
            try {
                ByteArrayOutputStream buf = rawBegin();

                for (int i = 0; i < commands.length(); i++) {
                    JSONObject cmd;
                    try { cmd = commands.getJSONObject(i); }
                    catch (JSONException e) { continue; }

                    String type = cmd.optString("cmd", "");
                    switch (type) {
                        case "text":
                            rawText(buf, cmd.optString("text", ""));
                            break;
                        case "bold":
                            rawBold(buf, cmd.optBoolean("enabled", false));
                            break;
                        case "size":
                            int sz = cmd.optInt("value", 20);
                            // Map font size values to ESC/POS size codes
                            // Normal=20, Large>=26 → double, Medium 22-25 → double-height only
                            if (sz >= 26) rawSize(buf, 0x11);       // double width+height
                            else if (sz >= 22) rawSize(buf, 0x01);  // double height only
                            else rawSize(buf, 0x00);                // normal
                            break;
                        case "align":
                            rawAlign(buf, cmd.optInt("value", 0));
                            break;
                        case "line":
                            String sep = cmd.optString("char", "-");
                            int len = cmd.optInt("len", 32);
                            StringBuilder sb = new StringBuilder();
                            for (int j = 0; j < len; j++) sb.append(sep);
                            sb.append("\n");
                            rawText(buf, sb.toString());
                            break;
                        case "feed":
                            rawFeed(buf, cmd.optInt("lines", 3));
                            break;
                        case "cut":
                            rawCut(buf);
                            break;
                        case "qr":
                            // Flush current raw buffer, then use SDK for QR
                            if (buf.size() > 0) {
                                rawSend(buf);
                                buf.reset();
                            }
                            String qr = cmd.optString("text", "");
                            int qrSz = cmd.optInt("size", 6);
                            if (!qr.isEmpty()) printerService.printQRCode(qr, qrSz, 3, null);
                            // Re-init codepage after SDK call
                            buf.write(ESC_CODEPAGE_WPC1252);
                            break;
                        case "barcode":
                            // Flush current raw buffer, then use SDK for barcode
                            if (buf.size() > 0) {
                                rawSend(buf);
                                buf.reset();
                            }
                            String bc = cmd.optString("text", "");
                            if (!bc.isEmpty()) printerService.printBarCode(bc, 8, 80, 2, 2, null);
                            // Re-init codepage after SDK call
                            buf.write(ESC_CODEPAGE_WPC1252);
                            break;
                    }
                }

                // Send remaining buffer
                if (buf.size() > 0) {
                    rawSend(buf);
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
    // PRINT RAW ESC/POS
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printRaw(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        JSArray commands = call.getArray("commands");
        if (commands == null || commands.length() == 0) { call.reject("No commands"); return; }

        new Thread(() -> {
            try {
                ByteArrayOutputStream buf = rawBegin();

                for (int i = 0; i < commands.length(); i++) {
                    JSONObject cmd;
                    try { cmd = commands.getJSONObject(i); } catch (JSONException e) { continue; }
                    String type = cmd.optString("cmd", "");
                    switch (type) {
                        case "text":
                            rawText(buf, cmd.optString("text", ""));
                            break;
                        case "bold":
                            rawBold(buf, cmd.optBoolean("enabled", false));
                            break;
                        case "size":
                            int sz = cmd.optInt("value", 20);
                            if (sz >= 26) rawSize(buf, 0x11);
                            else if (sz >= 22) rawSize(buf, 0x01);
                            else rawSize(buf, 0x00);
                            break;
                        case "align":
                            rawAlign(buf, cmd.optInt("value", 0));
                            break;
                        case "line":
                            String s = cmd.optString("char", "-");
                            int l = cmd.optInt("len", 32);
                            StringBuilder sb = new StringBuilder();
                            for (int j = 0; j < l; j++) sb.append(s);
                            sb.append("\n");
                            rawText(buf, sb.toString());
                            break;
                        case "feed":
                            rawFeed(buf, cmd.optInt("lines", 3));
                            break;
                        case "cut":
                            rawCut(buf);
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
    // PRINT DIRECT - diagnostic (full raw ESC/POS)
    // ══════════════════════════════════════════════════════════════

    @PluginMethod
    public void printDirect(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        String mode = call.getString("mode", "simple");
        new Thread(() -> {
            try {
                ByteArrayOutputStream buf = rawBegin();

                if ("simple".equals(mode)) {
                    rawText(buf, "=== PRINT DIRECT (SDK) ===\n");
                    rawText(buf, "Ce texte vient du SDK Sunmi\n");
                    rawText(buf, "Accents: é è à ù ç ô\n");
                    rawText(buf, "================================\n");
                    rawFeed(buf, 4);
                } else if ("formatted".equals(mode)) {
                    rawAlign(buf, 1);
                    rawSize(buf, 0x11);
                    rawText(buf, "MA BOUTIQUE\n");
                    rawSize(buf, 0x00);
                    rawText(buf, "123 Rue du Commerce\n");
                    rawAlign(buf, 0);
                    rawText(buf, "================================\n");
                    rawText(buf, "TOTAL TTC    59.90 EUR\n");
                    rawFeed(buf, 4);
                }

                rawSend(buf);

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
