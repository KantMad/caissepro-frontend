package com.caissepro.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.RemoteException;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * CaissePro Sunmi Printer Plugin
 * Bridges the Sunmi AIDL printer service to the Capacitor web layer.
 *
 * This plugin works on all Sunmi devices (T2s, T2, T3, V2, V2 Pro, etc.)
 * It uses reflection to call the Sunmi printer service without requiring
 * the AIDL files at compile time — making the APK compatible with non-Sunmi devices.
 */
@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {
    private static final String TAG = "SunmiPrinter";
    private Object printerService = null;
    private boolean isBound = false;

    @Override
    public void load() {
        super.load();
        bindPrinterService();
    }

    private void bindPrinterService() {
        try {
            Intent intent = new Intent();
            intent.setPackage("woyou.aidlservice.jiuiv5");
            intent.setAction("woyou.aidlservice.jiuiv5.IWoyouService");
            getContext().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
        } catch (Exception e) {
            Log.w(TAG, "Failed to bind Sunmi printer service: " + e.getMessage());
        }
    }

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            try {
                // Use reflection to get the Stub.asInterface method
                Class<?> stubClass = Class.forName("woyou.aidlservice.jiuiv5.IWoyouService$Stub");
                java.lang.reflect.Method asInterface = stubClass.getMethod("asInterface", IBinder.class);
                printerService = asInterface.invoke(null, service);
                isBound = true;
                Log.i(TAG, "Sunmi printer service connected");
            } catch (Exception e) {
                Log.w(TAG, "Reflection failed, trying direct AIDL: " + e.getMessage());
                // If reflection fails, try the newer Sunmi SDK
                try {
                    Class<?> stubClass = Class.forName("com.sunmi.peripheral.printer.InnerPrinterManager");
                    java.lang.reflect.Method getInstance = stubClass.getMethod("getInstance");
                    printerService = getInstance.invoke(null);
                    isBound = printerService != null;
                } catch (Exception e2) {
                    Log.e(TAG, "All binding methods failed: " + e2.getMessage());
                }
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            printerService = null;
            isBound = false;
            Log.i(TAG, "Sunmi printer service disconnected");
        }
    };

    private void callPrinter(String methodName, Object... args) throws Exception {
        if (printerService == null) throw new Exception("Printer service not available");

        Class<?>[] paramTypes = new Class[args.length];
        for (int i = 0; i < args.length; i++) {
            if (args[i] instanceof String) paramTypes[i] = String.class;
            else if (args[i] instanceof Integer) paramTypes[i] = int.class;
            else if (args[i] instanceof Float) paramTypes[i] = float.class;
            else if (args[i] instanceof Boolean) paramTypes[i] = boolean.class;
            else if (args[i] instanceof byte[]) paramTypes[i] = byte[].class;
            else paramTypes[i] = args[i].getClass();
        }

        // Most Sunmi AIDL methods have a callback as last param (can be null)
        try {
            // Try with callback parameter (ICallback)
            Class<?>[] withCallback = new Class[paramTypes.length + 1];
            System.arraycopy(paramTypes, 0, withCallback, 0, paramTypes.length);
            withCallback[paramTypes.length] = Class.forName("woyou.aidlservice.jiuiv5.ICallback");

            Object[] withNullCallback = new Object[args.length + 1];
            System.arraycopy(args, 0, withNullCallback, 0, args.length);
            withNullCallback[args.length] = null;

            java.lang.reflect.Method method = printerService.getClass().getMethod(methodName, withCallback);
            method.invoke(printerService, withNullCallback);
        } catch (NoSuchMethodException e) {
            // Try without callback
            java.lang.reflect.Method method = printerService.getClass().getMethod(methodName, paramTypes);
            method.invoke(printerService, args);
        }
    }

    @PluginMethod
    public void printerInit(PluginCall call) {
        try {
            callPrinter("printerInit");
            call.resolve();
        } catch (Exception e) {
            call.reject("printerInit failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        try {
            callPrinter("printText", text);
            call.resolve();
        } catch (Exception e) {
            call.reject("printText failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printOriginalText(PluginCall call) {
        String text = call.getString("text", "");
        try {
            callPrinter("printOriginalText", text);
            call.resolve();
        } catch (Exception e) {
            // Fallback to printText
            try {
                callPrinter("printText", text);
                call.resolve();
            } catch (Exception e2) {
                call.reject("printOriginalText failed: " + e2.getMessage());
            }
        }
    }

    @PluginMethod
    public void setAlignment(PluginCall call) {
        int alignment = call.getInt("alignment", 0);
        try {
            callPrinter("setAlignment", alignment);
            call.resolve();
        } catch (Exception e) {
            call.reject("setAlignment failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setFontSize(PluginCall call) {
        float size = call.getFloat("size", 20f);
        try {
            callPrinter("setFontSize", size);
            call.resolve();
        } catch (Exception e) {
            call.reject("setFontSize failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setBold(PluginCall call) {
        boolean bold = call.getBoolean("bold", false);
        try {
            // Sunmi uses sendRAWData for bold
            byte[] cmd = bold ? new byte[]{0x1B, 0x45, 0x01} : new byte[]{0x1B, 0x45, 0x00};
            callPrinter("sendRAWData", cmd);
            call.resolve();
        } catch (Exception e) {
            call.reject("setBold failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void lineWrap(PluginCall call) {
        int lines = call.getInt("lines", 3);
        try {
            callPrinter("lineWrap", lines);
            call.resolve();
        } catch (Exception e) {
            call.reject("lineWrap failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cutPaper(PluginCall call) {
        try {
            callPrinter("cutPaper");
            call.resolve();
        } catch (Exception e) {
            // Not all Sunmi models support cut — ignore silently
            call.resolve();
        }
    }

    @PluginMethod
    public void openDrawer(PluginCall call) {
        try {
            callPrinter("openDrawer");
            call.resolve();
        } catch (Exception e) {
            // Try ESC/POS command for drawer
            try {
                byte[] cmd = new byte[]{0x1B, 0x70, 0x00, 0x19, (byte) 0xFA};
                callPrinter("sendRAWData", cmd);
                call.resolve();
            } catch (Exception e2) {
                call.reject("openDrawer failed: " + e2.getMessage());
            }
        }
    }

    @PluginMethod
    public void printQRCode(PluginCall call) {
        String content = call.getString("content", "");
        int size = call.getInt("size", 6);
        int errorLevel = call.getInt("errorLevel", 3);
        try {
            callPrinter("printQRCode", content, size, errorLevel);
            call.resolve();
        } catch (Exception e) {
            call.reject("printQRCode failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printBarCode(PluginCall call) {
        String content = call.getString("content", "");
        int symbology = call.getInt("symbology", 8); // CODE128
        int height = call.getInt("height", 80);
        int width = call.getInt("width", 2);
        int textPosition = call.getInt("textPosition", 2); // Below
        try {
            callPrinter("printBarCode", content, symbology, height, width, textPosition);
            call.resolve();
        } catch (Exception e) {
            call.reject("printBarCode failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void sendRAWData(PluginCall call) {
        String base64Data = call.getString("data", "");
        try {
            byte[] data = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
            callPrinter("sendRAWData", data);
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
