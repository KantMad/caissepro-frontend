package com.caissepro.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom Capacitor plugins
        registerPlugin(SunmiPrinterPlugin.class);
        registerPlugin(PaymentTerminalPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
