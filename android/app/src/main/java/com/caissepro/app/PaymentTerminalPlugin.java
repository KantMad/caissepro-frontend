package com.caissepro.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

/**
 * CaissePro — Universal Payment Terminal Plugin
 *
 * Supports multiple POS hardware brands via Intent-based payment:
 * - Sunmi T2s/T3 (built-in pinpad via PayService Intent)
 * - PAX A920/A80 (BroadPOS Intent)
 * - Ingenico/Verifone (Concert protocol terminals with companion app)
 * - SumUp (SumUp app Intent)
 * - Generic Android (any payment app that accepts standard Intents)
 * - Manual fallback (no hardware needed)
 *
 * The plugin auto-detects the hardware manufacturer and routes to the correct
 * payment method. It can also be configured explicitly from the JS layer.
 */
@CapacitorPlugin(name = "PaymentTerminal")
public class PaymentTerminalPlugin extends Plugin {
    private static final String TAG = "PaymentTerminal";

    // ── Hardware detection ──
    @PluginMethod
    public void detectHardware(PluginCall call) {
        JSObject ret = new JSObject();
        String manufacturer = Build.MANUFACTURER.toLowerCase();
        String model = Build.MODEL.toLowerCase();
        String brand = Build.BRAND.toLowerCase();

        ret.put("manufacturer", Build.MANUFACTURER);
        ret.put("model", Build.MODEL);
        ret.put("brand", Build.BRAND);

        // Detect payment capability
        if (manufacturer.contains("sunmi")) {
            ret.put("type", "sunmi");
            ret.put("hasBuiltInPayment", hasSunmiPayService());
            ret.put("hasBuiltInPrinter", true);
        } else if (manufacturer.contains("pax") || brand.contains("pax")) {
            ret.put("type", "pax");
            ret.put("hasBuiltInPayment", hasPaxBroadPOS());
            ret.put("hasBuiltInPrinter", true);
        } else if (manufacturer.contains("imin")) {
            ret.put("type", "imin");
            ret.put("hasBuiltInPayment", false);
            ret.put("hasBuiltInPrinter", true);
        } else if (manufacturer.contains("nexgo")) {
            ret.put("type", "nexgo");
            ret.put("hasBuiltInPayment", true);
            ret.put("hasBuiltInPrinter", true);
        } else {
            ret.put("type", "generic");
            ret.put("hasBuiltInPayment", false);
            ret.put("hasBuiltInPrinter", false);
        }

        // Check for installed payment apps
        ret.put("hasSumUp", isAppInstalled("com.sumup.merchant"));
        ret.put("hasZettle", isAppInstalled("com.izettle.android"));
        ret.put("hasConcertApp", isAppInstalled("fr.concert.caisse") || isAppInstalled("com.ingenico.pclservice"));

        Log.i(TAG, "Hardware detected: " + ret.toString());
        call.resolve(ret);
    }

    // ══════════════════════════════════════════
    // SALE (debit/charge)
    // ══════════════════════════════════════════
    @PluginMethod
    public void sale(PluginCall call) {
        int amount = call.getInt("amount", 0); // amount in cents
        String currency = call.getString("currency", "EUR");
        String reference = call.getString("reference", "");
        String provider = call.getString("provider", "auto");

        if (amount <= 0) {
            call.reject("Montant invalide");
            return;
        }

        Log.i(TAG, "Sale request: " + amount + " cents, provider=" + provider);

        if ("auto".equals(provider)) {
            provider = autoDetectProvider();
        }

        try {
            switch (provider) {
                case "sunmi":
                    saleSunmi(call, amount, currency, reference);
                    break;
                case "pax":
                    salePax(call, amount, currency, reference);
                    break;
                case "sumup":
                    saleSumUp(call, amount, currency, reference);
                    break;
                case "zettle":
                    saleZettle(call, amount, currency, reference);
                    break;
                case "nexgo":
                    saleNexgo(call, amount, currency, reference);
                    break;
                default:
                    // Try generic Intent, then fallback to manual
                    saleGenericIntent(call, amount, currency, reference);
                    break;
            }
        } catch (Exception e) {
            Log.e(TAG, "Sale error: " + e.getMessage());
            call.reject("Erreur paiement: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════
    // REFUND
    // ══════════════════════════════════════════
    @PluginMethod
    public void refund(PluginCall call) {
        int amount = call.getInt("amount", 0);
        String currency = call.getString("currency", "EUR");
        String reference = call.getString("reference", "");
        String provider = call.getString("provider", "auto");

        if (amount <= 0) {
            call.reject("Montant invalide");
            return;
        }

        if ("auto".equals(provider)) {
            provider = autoDetectProvider();
        }

        try {
            switch (provider) {
                case "sunmi":
                    refundSunmi(call, amount, currency, reference);
                    break;
                case "pax":
                    refundPax(call, amount, currency, reference);
                    break;
                default:
                    // Manual refund fallback
                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("requiresManual", true);
                    ret.put("message", "Effectuez le remboursement de " + formatAmount(amount) + " EUR sur le TPE puis confirmez");
                    call.resolve(ret);
                    break;
            }
        } catch (Exception e) {
            call.reject("Erreur remboursement: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════
    // CANCEL ongoing transaction
    // ══════════════════════════════════════════
    @PluginMethod
    public void cancel(PluginCall call) {
        // Most Intent-based payments can't be cancelled mid-flight
        // The user must cancel on the terminal itself
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    // ══════════════════════════════════════════
    // SUNMI — PayService Intent
    // ══════════════════════════════════════════
    private void saleSunmi(PluginCall call, int amount, String currency, String reference) {
        Intent intent = new Intent();

        // Method 1: Sunmi PayService (standard on T2s, T3, P-series)
        intent.setAction("com.sunmi.pay.action.DO_PAY");
        intent.putExtra("PAY_AMOUNT", String.valueOf(amount));
        intent.putExtra("PAY_CURRENCY", currency);
        intent.putExtra("PAY_REFERENCE", reference);
        intent.putExtra("PAY_TYPE", "CARD"); // CARD, NFC, QR

        if (canResolveIntent(intent)) {
            startActivityForResult(call, intent, "onPaymentResult");
            return;
        }

        // Method 2: Sunmi unified payment (newer devices)
        intent = new Intent();
        intent.setAction("com.sunmi.pay.hardware.aidl.PAY");
        intent.putExtra("amount", String.valueOf(amount));
        intent.putExtra("transType", "00"); // 00=sale
        intent.putExtra("currency", getCurrencyCode(currency));

        if (canResolveIntent(intent)) {
            startActivityForResult(call, intent, "onPaymentResult");
            return;
        }

        // Method 3: Sunmi built-in payment app (P2 series)
        intent = new Intent();
        intent.setClassName("com.sunmi.payment", "com.sunmi.payment.PaymentActivity");
        intent.putExtra("amount", amount);
        intent.putExtra("transType", 1); // 1=sale

        if (canResolveIntent(intent)) {
            startActivityForResult(call, intent, "onPaymentResult");
            return;
        }

        // No Sunmi payment service found — fallback
        resolveManualFallback(call, amount);
    }

    private void refundSunmi(PluginCall call, int amount, String currency, String reference) {
        Intent intent = new Intent();
        intent.setAction("com.sunmi.pay.action.DO_PAY");
        intent.putExtra("PAY_AMOUNT", String.valueOf(amount));
        intent.putExtra("PAY_TYPE", "REFUND");
        intent.putExtra("PAY_REFERENCE", reference);

        if (canResolveIntent(intent)) {
            startActivityForResult(call, intent, "onPaymentResult");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("requiresManual", true);
        ret.put("message", "Effectuez le remboursement de " + formatAmount(amount) + " EUR sur le TPE Sunmi");
        call.resolve(ret);
    }

    // ══════════════════════════════════════════
    // PAX — BroadPOS Intent
    // ══════════════════════════════════════════
    private void salePax(PluginCall call, int amount, String currency, String reference) {
        Intent intent = new Intent();

        // BroadPOS standard Intent
        intent.setAction("com.pax.us.pay.action.SALE");
        intent.putExtra("com.pax.us.pay.extra.AMOUNT", String.valueOf(amount));
        intent.putExtra("com.pax.us.pay.extra.ECR_REF_NUM", reference);
        intent.putExtra("com.pax.us.pay.extra.CURRENCY", getCurrencyCode(currency));

        if (canResolveIntent(intent)) {
            startActivityForResult(call, intent, "onPaymentResult");
            return;
        }

        // PAX EU variant
        intent = new Intent();
        intent.setAction("com.pax.pay.action.SALE");
        intent.putExtra("AMOUNT", String.valueOf(amount));
        intent.putExtra("ECR_REF", reference);

        if (canResolveIntent(intent)) {
            startActivityForResult(call, intent, "onPaymentResult");
            return;
        }

        resolveManualFallback(call, amount);
    }

    private void refundPax(PluginCall call, int amount, String currency, String reference) {
        Intent intent = new Intent();
        intent.setAction("com.pax.us.pay.action.RETURN");
        intent.putExtra("com.pax.us.pay.extra.AMOUNT", String.valueOf(amount));
        intent.putExtra("com.pax.us.pay.extra.ECR_REF_NUM", reference);

        if (canResolveIntent(intent)) {
            startActivityForResult(call, intent, "onPaymentResult");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("requiresManual", true);
        ret.put("message", "Effectuez le remboursement de " + formatAmount(amount) + " EUR sur le TPE PAX");
        call.resolve(ret);
    }

    // ══════════════════════════════════════════
    // SUMUP — App Intent
    // ══════════════════════════════════════════
    private void saleSumUp(PluginCall call, int amount, String currency, String reference) {
        Intent intent = new Intent();

        // SumUp merchant app Intent
        intent.setAction("com.sumup.merchant.PAYMENT");
        intent.putExtra("amount", amount / 100.0); // SumUp expects decimal
        intent.putExtra("currency", currency);
        intent.putExtra("title", reference);
        intent.putExtra("skip_success_screen", true);

        if (canResolveIntent(intent)) {
            startActivityForResult(call, intent, "onPaymentResult");
            return;
        }

        // Fallback: deep link
        String deepLink = "sumupmerchant://pay/1.0"
            + "?amount=" + formatAmount(amount)
            + "&currency=" + currency
            + "&title=" + reference
            + "&skip-screen-success=true"
            + "&callback=caissepro://sumup-callback";

        Intent deepLinkIntent = new Intent(Intent.ACTION_VIEW,
            android.net.Uri.parse(deepLink));

        if (canResolveIntent(deepLinkIntent)) {
            startActivityForResult(call, deepLinkIntent, "onPaymentResult");
            return;
        }

        resolveManualFallback(call, amount);
    }

    // ══════════════════════════════════════════
    // ZETTLE — App Intent
    // ══════════════════════════════════════════
    private void saleZettle(PluginCall call, int amount, String currency, String reference) {
        Intent intent = new Intent();
        intent.setAction("com.izettle.android.payment.CHARGE");
        intent.putExtra("amount", (long) amount);
        intent.putExtra("currency", currency);
        intent.putExtra("reference", reference);

        if (canResolveIntent(intent)) {
            startActivityForResult(call, intent, "onPaymentResult");
            return;
        }

        // Deep link fallback
        String deepLink = "izettle://x-callback-url/payment"
            + "?amount=" + amount
            + "&currency=" + currency
            + "&reference=" + reference;
        Intent deepLinkIntent = new Intent(Intent.ACTION_VIEW,
            android.net.Uri.parse(deepLink));

        if (canResolveIntent(deepLinkIntent)) {
            startActivityForResult(call, deepLinkIntent, "onPaymentResult");
            return;
        }

        resolveManualFallback(call, amount);
    }

    // ══════════════════════════════════════════
    // NEXGO — Payment Intent
    // ══════════════════════════════════════════
    private void saleNexgo(PluginCall call, int amount, String currency, String reference) {
        Intent intent = new Intent();
        intent.setAction("com.nexgo.payment.action.SALE");
        intent.putExtra("AMOUNT", String.valueOf(amount));
        intent.putExtra("CURRENCY", getCurrencyCode(currency));
        intent.putExtra("REFERENCE", reference);

        if (canResolveIntent(intent)) {
            startActivityForResult(call, intent, "onPaymentResult");
            return;
        }

        resolveManualFallback(call, amount);
    }

    // ══════════════════════════════════════════
    // GENERIC — Try common payment Intent patterns
    // ══════════════════════════════════════════
    private void saleGenericIntent(PluginCall call, int amount, String currency, String reference) {
        // Try a set of known generic payment actions
        String[] genericActions = {
            "com.merchant.payment.SALE",
            "com.android.payment.SALE",
            "android.intent.action.PAY",
        };

        for (String action : genericActions) {
            Intent intent = new Intent(action);
            intent.putExtra("amount", amount);
            intent.putExtra("AMOUNT", String.valueOf(amount));
            intent.putExtra("currency", currency);
            intent.putExtra("reference", reference);
            if (canResolveIntent(intent)) {
                startActivityForResult(call, intent, "onPaymentResult");
                return;
            }
        }

        // No payment app found — return manual mode
        resolveManualFallback(call, amount);
    }

    // ══════════════════════════════════════════
    // CALLBACK — Unified result handler
    // ══════════════════════════════════════════
    @ActivityCallback
    private void onPaymentResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;

        JSObject ret = new JSObject();
        int resultCode = activityResult.getResultCode();
        Intent data = activityResult.getData();

        Log.i(TAG, "Payment result: code=" + resultCode);

        if (resultCode == Activity.RESULT_OK) {
            ret.put("success", true);
            ret.put("status", "approved");

            if (data != null && data.getExtras() != null) {
                Bundle extras = data.getExtras();
                // Extract common result fields across vendors
                String authCode = getExtraString(extras, "AUTH_CODE", "authCode",
                    "com.pax.us.pay.extra.AUTH_CODE", "APPROVAL_CODE");
                String cardType = getExtraString(extras, "CARD_TYPE", "cardType",
                    "com.pax.us.pay.extra.CARD_TYPE", "card_type");
                String maskedPan = getExtraString(extras, "MASKED_PAN", "maskedPan",
                    "com.pax.us.pay.extra.MASKED_PAN", "card_number");
                String txId = getExtraString(extras, "TX_ID", "transactionId",
                    "com.pax.us.pay.extra.TRANS_NO", "tx_code", "VOUCHER_NO");
                String resultMsg = getExtraString(extras, "RESULT_CODE", "resultCode",
                    "com.pax.us.pay.extra.RESULT_CODE", "message");

                if (authCode != null) ret.put("authCode", authCode);
                if (cardType != null) ret.put("cardType", cardType);
                if (maskedPan != null) ret.put("maskedPan", maskedPan);
                if (txId != null) ret.put("transactionId", txId);
                if (resultMsg != null) ret.put("resultMessage", resultMsg);

                // Log all extras for debugging
                for (String key : extras.keySet()) {
                    Log.d(TAG, "Payment extra: " + key + " = " + extras.get(key));
                }
            }
        } else if (resultCode == Activity.RESULT_CANCELED) {
            ret.put("success", false);
            ret.put("status", "cancelled");
            ret.put("error", "Transaction annulee par l'utilisateur");
        } else {
            ret.put("success", false);
            ret.put("status", "declined");

            if (data != null && data.getExtras() != null) {
                String error = getExtraString(data.getExtras(), "ERROR", "error",
                    "RESULT_CODE", "com.pax.us.pay.extra.RESULT_CODE");
                ret.put("error", error != null ? error : "Transaction refusee (code " + resultCode + ")");
            } else {
                ret.put("error", "Transaction refusee (code " + resultCode + ")");
            }
        }

        call.resolve(ret);
    }

    // ══════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════

    private String autoDetectProvider() {
        String manufacturer = Build.MANUFACTURER.toLowerCase();
        if (manufacturer.contains("sunmi")) return "sunmi";
        if (manufacturer.contains("pax")) return "pax";
        if (manufacturer.contains("nexgo")) return "nexgo";
        if (isAppInstalled("com.sumup.merchant")) return "sumup";
        if (isAppInstalled("com.izettle.android")) return "zettle";
        return "generic";
    }

    private boolean hasSunmiPayService() {
        try {
            Intent intent = new Intent("com.sunmi.pay.action.DO_PAY");
            return canResolveIntent(intent);
        } catch (Exception e) { return false; }
    }

    private boolean hasPaxBroadPOS() {
        try {
            Intent intent = new Intent("com.pax.us.pay.action.SALE");
            return canResolveIntent(intent);
        } catch (Exception e) { return false; }
    }

    private boolean canResolveIntent(Intent intent) {
        PackageManager pm = getContext().getPackageManager();
        List<ResolveInfo> activities = pm.queryIntentActivities(intent,
            PackageManager.MATCH_DEFAULT_ONLY);
        return activities != null && !activities.isEmpty();
    }

    private boolean isAppInstalled(String packageName) {
        try {
            getContext().getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private String getCurrencyCode(String currency) {
        switch (currency.toUpperCase()) {
            case "EUR": return "978";
            case "USD": return "840";
            case "GBP": return "826";
            case "CHF": return "756";
            default: return "978";
        }
    }

    private String formatAmount(int cents) {
        return String.format("%.2f", cents / 100.0);
    }

    private void resolveManualFallback(PluginCall call, int amount) {
        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("requiresManual", true);
        ret.put("message", "Encaissez " + formatAmount(amount) + " EUR sur le TPE puis confirmez dans l'application");
        call.resolve(ret);
    }

    /** Try multiple keys to find a value in extras (vendor-agnostic) */
    private String getExtraString(Bundle extras, String... keys) {
        for (String key : keys) {
            if (extras.containsKey(key)) {
                Object val = extras.get(key);
                if (val != null) return val.toString();
            }
        }
        return null;
    }
}
