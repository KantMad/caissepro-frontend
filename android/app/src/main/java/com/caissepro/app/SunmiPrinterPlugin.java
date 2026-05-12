package com.caissepro.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import android.os.RemoteException;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import woyou.aidlservice.jiuiv5.ICallback;
import woyou.aidlservice.jiuiv5.IWoyouService;

/**
 * CaissePro Sunmi Printer Plugin
 * Bridges the Sunmi AIDL printer service to the Capacitor web layer.
 * Uses proper AIDL binding (not reflection) for reliable operation.
 */
@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {
    private static final String TAG = "SunmiPrinter";
    private IWoyouService printerService = null;
    private boolean isBound = false;
    private boolean bindAttempted = false;
    private String bindError = null;

    // Simple callback that logs errors
    private final ICallback defaultCallback = new ICallback.Stub() {
        @Override
        public void onRunResult(boolean isSuccess) {
            Log.d(TAG, "Print callback: " + (isSuccess ? "OK" : "FAIL"));
        }
        @Override
        public void onReturnString(String result) {
            Log.d(TAG, "Print result: " + result);
        }
        @Override
        public void onRaiseException(int code, String msg) {
            Log.e(TAG, "Print exception " + code + ": " + msg);
        }
    };

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "Plugin loading, attempting to bind Sunmi printer service...");
        Log.i(TAG, "Device: " + Build.MANUFACTURER + " " + Build.MODEL);
        bindPrinterService();
    }

    private void bindPrinterService() {
        bindAttempted = true;
        try {
            Intent intent = new Intent();
            intent.setPackage("woyou.aidlservice.jiuiv5");
            intent.setAction("woyou.aidlservice.jiuiv5.IWoyouService");

            boolean bound = getContext().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
            Log.i(TAG, "bindService returned: " + bound);
            if (!bound) {
                bindError = "bindService returned false — Sunmi printer service not found on this device";
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

            // Log printer info for diagnostics
            try {
                String serial = printerService.getPrinterSerialNo();
                String version = printerService.getPrinterVersion();
                int state = printerService.updatePrinterState();
                Log.i(TAG, "Serial: " + serial + ", Version: " + version + ", State: " + state);
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

    // ── Diagnostic method — call from JS to check everything ──
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("connected", isBound && printerService != null);
        ret.put("bindAttempted", bindAttempted);
        ret.put("isBound", isBound);
        ret.put("serviceAvailable", printerService != null);
        ret.put("manufacturer", Build.MANUFACTURER);
        ret.put("model", Build.MODEL);
        ret.put("device", Build.DEVICE);
        ret.put("isSunmi", Build.MANUFACTURER.toLowerCase().contains("sunmi"));

        if (bindError != null) {
            ret.put("error", bindError);
        }

        if (printerService != null) {
            try {
                ret.put("serial", printerService.getPrinterSerialNo());
                ret.put("printerVersion", printerService.getPrinterVersion());
                ret.put("serviceVersion", printerService.getServiceVersion());
                int state = printerService.updatePrinterState();
                ret.put("printerState", state);
                // State codes: 1=normal, 2=preparing, 3=abnormal, 4=overheated,
                // 5=no paper, 6=paper jam, 7=cover open, 505=no printer, 507=updating
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
                ret.put("printerPaper", printerService.getPrinterPaper());
            } catch (RemoteException e) {
                ret.put("infoError", e.getMessage());
            }
        }

        call.resolve(ret);
    }

    @PluginMethod
    public void printerInit(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected (service is null). bindAttempted=" + bindAttempted + ", error=" + bindError);
            return;
        }
        try {
            printerService.printerInit(defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            call.reject("printerInit failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        if (printerService == null) {
            call.reject("Printer not connected");
            return;
        }
        try {
            printerService.printText(text, defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            call.reject("printText failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printOriginalText(PluginCall call) {
        String text = call.getString("text", "");
        if (printerService == null) {
            call.reject("Printer not connected");
            return;
        }
        try {
            printerService.printOriginalText(text, defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            // Fallback
            try {
                printerService.printText(text, defaultCallback);
                call.resolve();
            } catch (RemoteException e2) {
                call.reject("printOriginalText failed: " + e2.getMessage());
            }
        }
    }

    @PluginMethod
    public void setAlignment(PluginCall call) {
        int alignment = call.getInt("alignment", 0);
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try {
            printerService.setAlignment(alignment, defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            call.reject("setAlignment failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setFontSize(PluginCall call) {
        float size = call.getFloat("size", 20f);
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try {
            printerService.setFontSize(size, defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            call.reject("setFontSize failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setBold(PluginCall call) {
        boolean bold = call.getBoolean("bold", false);
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try {
            // ESC E n — bold on/off
            byte[] cmd = bold ? new byte[]{0x1B, 0x45, 0x01} : new byte[]{0x1B, 0x45, 0x00};
            printerService.sendRAWData(cmd, defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            call.reject("setBold failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void lineWrap(PluginCall call) {
        int lines = call.getInt("lines", 3);
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try {
            printerService.lineWrap(lines, defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            call.reject("lineWrap failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cutPaper(PluginCall call) {
        if (printerService == null) { call.resolve(); return; }
        try {
            printerService.cutPaper(defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            // Not all models support cut — silent resolve
            call.resolve();
        }
    }

    @PluginMethod
    public void feedPaper(PluginCall call) {
        int mm = call.getInt("mm", 10);
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try {
            printerService.feedPaper(mm, defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            call.reject("feedPaper failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openDrawer(PluginCall call) {
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try {
            printerService.openDrawer(defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            // Fallback: ESC/POS drawer kick command
            try {
                byte[] cmd = new byte[]{0x1B, 0x70, 0x00, 0x19, (byte) 0xFA};
                printerService.sendRAWData(cmd, defaultCallback);
                call.resolve();
            } catch (RemoteException e2) {
                call.reject("openDrawer failed: " + e2.getMessage());
            }
        }
    }

    @PluginMethod
    public void printQRCode(PluginCall call) {
        String content = call.getString("content", "");
        int size = call.getInt("size", 6);
        int errorLevel = call.getInt("errorLevel", 3);
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try {
            printerService.printQRCode(content, size, errorLevel, defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            call.reject("printQRCode failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printBarCode(PluginCall call) {
        String content = call.getString("content", "");
        int symbology = call.getInt("symbology", 8);
        int height = call.getInt("height", 80);
        int width = call.getInt("width", 2);
        int textPosition = call.getInt("textPosition", 2);
        if (printerService == null) { call.reject("Printer not connected"); return; }
        try {
            printerService.printBarCode(content, symbology, height, width, textPosition, defaultCallback);
            call.resolve();
        } catch (RemoteException e) {
            call.reject("printBarCode failed: " + e.getMessage());
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
        } catch (Exception e) {
            call.reject("sendRAWData failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("connected", isBound && printerService != null);
        call.resolve(ret);
    }

    // ── Force reconnect (useful if service was slow to start) ──
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
        // Give it a moment then return status
        getActivity().getWindow().getDecorView().postDelayed(() -> {
            JSObject ret = new JSObject();
            ret.put("connected", isBound && printerService != null);
            ret.put("error", bindError);
            call.resolve(ret);
        }, 2000);
    }

    // ── Quick test print ──
    @PluginMethod
    public void testPrint(PluginCall call) {
        if (printerService == null) {
            call.reject("Printer not connected. Status: bindAttempted=" + bindAttempted
                + ", manufacturer=" + Build.MANUFACTURER + ", error=" + bindError);
            return;
        }
        try {
            printerService.printerInit(null);
            printerService.setAlignment(1, null);
            printerService.setFontSize(28f, null);
            printerService.printText("=== TEST CaissePro ===\n", null);
            printerService.setFontSize(20f, null);
            printerService.printText("Imprimante OK\n", null);
            printerService.printText(Build.MANUFACTURER + " " + Build.MODEL + "\n", null);
            printerService.printText(new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm:ss", java.util.Locale.FRANCE)
                .format(new java.util.Date()) + "\n", null);
            printerService.printText("================================\n", null);
            printerService.lineWrap(4, null);
            try { printerService.cutPaper(null); } catch (Exception e) {}

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (RemoteException e) {
            call.reject("testPrint failed: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (isBound) {
            try {
                getContext().unbindService(serviceConnection);
            } catch (Exception e) {
                Log.w(TAG, "Error unbinding service: " + e.getMessage());
            }
        }
    }
}
