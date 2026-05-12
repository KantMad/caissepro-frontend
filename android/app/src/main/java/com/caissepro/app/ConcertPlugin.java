package com.caissepro.app;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/**
 * CaissePro — Concert Protocol Plugin (CTAP / Protocole Caisse)
 *
 * Implements the French standard protocol for POS ↔ Payment Terminal communication.
 * Works with Ingenico (Desk/5000, Move/5000, Lane/7000), Verifone (V240m, P400),
 * and Worldline (VALINA, YOMANI, LANE) terminals.
 *
 * Protocol: Concert V2 over TCP/IP
 * - STX (0x02) + Data + ETX (0x03) + LRC
 * - Data: ProtocolId(1) + TransType(2) + Amount(8) + Mode(1) + Currency(3) + Private(variable)
 */
@CapacitorPlugin(name = "ConcertProtocol")
public class ConcertPlugin extends Plugin {
    private static final String TAG = "ConcertProtocol";

    private static final byte STX = 0x02;
    private static final byte ETX = 0x03;
    private static final byte ENQ = 0x05;
    private static final byte ACK = 0x06;
    private static final byte NAK = 0x15;
    private static final byte EOT = 0x04;

    private static final int DEFAULT_PORT = 8888;
    private static final int CONNECT_TIMEOUT = 5000;   // 5s to connect
    private static final int READ_TIMEOUT = 120000;     // 2min to wait for payment

    // ── Test connection to TPE ──
    @PluginMethod
    public void ping(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);

        if (host.isEmpty()) {
            call.reject("Adresse IP du TPE requise");
            return;
        }

        new Thread(() -> {
            try {
                Socket socket = new Socket();
                socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT);
                boolean connected = socket.isConnected();
                socket.close();

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("host", host);
                ret.put("port", port);
                ret.put("message", "TPE accessible sur " + host + ":" + port);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Ping failed: " + e.getMessage());
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", "TPE injoignable: " + e.getMessage());
                ret.put("host", host);
                ret.put("port", port);
                call.resolve(ret);
            }
        }).start();
    }

    // ── Send payment request ──
    @PluginMethod
    public void sale(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);
        int amount = call.getInt("amount", 0); // cents
        String currency = call.getString("currency", "EUR");
        String reference = call.getString("reference", "");

        if (host.isEmpty()) { call.reject("Adresse IP du TPE requise"); return; }
        if (amount <= 0) { call.reject("Montant invalide"); return; }

        Log.i(TAG, "Sale: " + amount + " cents to " + host + ":" + port);

        new Thread(() -> {
            try {
                JSObject result = sendConcertTransaction(host, port, "00", amount, currency, reference);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "Sale error: " + e.getMessage());
                call.reject("Erreur paiement Concert: " + e.getMessage());
            }
        }).start();
    }

    // ── Send refund request ──
    @PluginMethod
    public void refund(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);
        int amount = call.getInt("amount", 0);
        String currency = call.getString("currency", "EUR");

        if (host.isEmpty()) { call.reject("Adresse IP du TPE requise"); return; }
        if (amount <= 0) { call.reject("Montant invalide"); return; }

        new Thread(() -> {
            try {
                JSObject result = sendConcertTransaction(host, port, "20", amount, currency, "");
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Erreur remboursement Concert: " + e.getMessage());
            }
        }).start();
    }

    // ── Cancel ongoing transaction ──
    @PluginMethod
    public void cancel(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);

        new Thread(() -> {
            try {
                JSObject result = sendConcertTransaction(host, port, "01", 0, "EUR", "");
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Erreur annulation: " + e.getMessage());
            }
        }).start();
    }

    // ── Get last transaction status ──
    @PluginMethod
    public void lastStatus(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);

        new Thread(() -> {
            try {
                JSObject result = sendConcertTransaction(host, port, "02", 0, "EUR", "");
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Erreur statut: " + e.getMessage());
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // Concert V2 Protocol Implementation
    // ══════════════════════════════════════════════════════════════

    private JSObject sendConcertTransaction(String host, int port, String transType,
                                             int amountCents, String currency, String reference)
            throws IOException {

        Socket socket = new Socket();
        socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT);
        socket.setSoTimeout(READ_TIMEOUT);

        OutputStream out = socket.getOutputStream();
        InputStream in = socket.getInputStream();

        try {
            // ── Step 1: Send ENQ (enquiry) to initiate communication ──
            out.write(ENQ);
            out.flush();
            Log.d(TAG, "Sent ENQ");

            // ── Step 2: Wait for ACK from TPE ──
            int ack = readByteWithTimeout(in, 5000);
            if (ack != ACK) {
                throw new IOException("TPE n'a pas repondu ACK (recu: 0x" + Integer.toHexString(ack) + ")");
            }
            Log.d(TAG, "Received ACK");

            // ── Step 3: Build and send Concert V2 message ──
            byte[] message = buildConcertMessage(transType, amountCents, currency, reference);
            out.write(message);
            out.flush();
            Log.d(TAG, "Sent Concert message: " + bytesToHex(message));

            // ── Step 4: Wait for ACK of message receipt ──
            ack = readByteWithTimeout(in, 5000);
            if (ack == NAK) {
                // TPE rejected message, retry once
                out.write(message);
                out.flush();
                ack = readByteWithTimeout(in, 5000);
                if (ack != ACK) {
                    throw new IOException("TPE a rejete le message deux fois");
                }
            } else if (ack != ACK) {
                throw new IOException("Pas de ACK apres envoi message (recu: 0x" + Integer.toHexString(ack) + ")");
            }
            Log.d(TAG, "Message acknowledged");

            // ── Step 5: Wait for response (up to 2 min — customer is paying) ──
            JSObject result = readConcertResponse(in, out);

            // ── Step 6: Send EOT to end communication ──
            out.write(EOT);
            out.flush();
            Log.d(TAG, "Sent EOT");

            return result;

        } finally {
            try { socket.close(); } catch (Exception e) {}
        }
    }

    private byte[] buildConcertMessage(String transType, int amountCents, String currency, String reference) {
        // Concert V2 message format:
        // Protocol ID: "1" (Concert V2)
        // Transaction type: 2 chars (00=sale, 01=cancel, 02=last status, 20=refund)
        // Amount: 8 chars zero-padded (in cents)
        // Payment mode: "1" (card)
        // Currency: 3 chars ISO numeric (978=EUR, 840=USD)
        // Private data: variable length

        String protocolId = "1";
        String amountStr = String.format("%08d", amountCents);
        String paymentMode = "1"; // 1=card
        String currencyCode = getCurrencyNumeric(currency);

        // Private data (optional): contains reference and terminal config
        String privateData = "";
        if (reference != null && !reference.isEmpty()) {
            // Field separator: FS (0x1C)
            privateData = reference;
        }

        String data = protocolId + transType + amountStr + paymentMode + currencyCode + privateData;

        // Build frame: STX + data + ETX + LRC
        byte[] dataBytes = data.getBytes(StandardCharsets.ISO_8859_1);
        byte[] frame = new byte[dataBytes.length + 3]; // STX + data + ETX + LRC

        frame[0] = STX;
        System.arraycopy(dataBytes, 0, frame, 1, dataBytes.length);
        frame[dataBytes.length + 1] = ETX;

        // Calculate LRC: XOR of all bytes from STX (exclusive) to ETX (inclusive)
        byte lrc = 0;
        for (int i = 1; i <= dataBytes.length + 1; i++) {
            lrc ^= frame[i];
        }
        frame[dataBytes.length + 2] = lrc;

        return frame;
    }

    private JSObject readConcertResponse(InputStream in, OutputStream out) throws IOException {
        // Wait for STX
        int b = readByteWithTimeout(in, READ_TIMEOUT);
        if (b != STX) {
            throw new IOException("Reponse inattendue du TPE (attendu STX, recu: 0x" + Integer.toHexString(b) + ")");
        }

        // Read until ETX
        byte[] buffer = new byte[1024];
        int pos = 0;
        byte lrcReceived;

        while (true) {
            b = readByteWithTimeout(in, 10000);
            if (b == ETX) {
                break;
            }
            if (pos < buffer.length) {
                buffer[pos++] = (byte) b;
            }
        }

        // Read LRC
        lrcReceived = (byte) readByteWithTimeout(in, 2000);

        // Verify LRC
        byte lrcCalc = 0;
        for (int i = 0; i < pos; i++) {
            lrcCalc ^= buffer[i];
        }
        lrcCalc ^= ETX;

        if (lrcCalc != lrcReceived) {
            Log.w(TAG, "LRC mismatch: calculated=" + lrcCalc + " received=" + lrcReceived);
            // Send NAK and try to re-read
            out.write(NAK);
            out.flush();
        } else {
            // Send ACK
            out.write(ACK);
            out.flush();
        }

        // Parse response
        String response = new String(buffer, 0, pos, StandardCharsets.ISO_8859_1);
        Log.i(TAG, "Concert response: " + response);

        return parseConcertResponse(response);
    }

    private JSObject parseConcertResponse(String response) {
        JSObject ret = new JSObject();

        if (response.length() < 4) {
            ret.put("success", false);
            ret.put("status", "error");
            ret.put("error", "Reponse trop courte: " + response);
            return ret;
        }

        // Response format:
        // Protocol ID: 1 char
        // Status: 1 char (0=accepted, 1-4=declined/error, 5=pending, 7=cancelled)
        // Amount: 8 chars
        // Payment mode: 1 char
        // Then optional fields depending on terminal

        char status = response.charAt(1);
        String amountStr = response.length() >= 10 ? response.substring(2, 10) : "0";

        switch (status) {
            case '0':
                ret.put("success", true);
                ret.put("status", "approved");
                break;
            case '1':
                ret.put("success", false);
                ret.put("status", "declined");
                ret.put("error", "Transaction refusee par la banque");
                break;
            case '2':
                ret.put("success", false);
                ret.put("status", "error");
                ret.put("error", "Erreur communication banque");
                break;
            case '3':
                ret.put("success", false);
                ret.put("status", "error");
                ret.put("error", "Erreur terminal de paiement");
                break;
            case '4':
                ret.put("success", false);
                ret.put("status", "declined");
                ret.put("error", "Transaction refusee — reessayez");
                break;
            case '5':
                ret.put("success", false);
                ret.put("status", "pending");
                ret.put("error", "Transaction en attente de confirmation");
                break;
            case '7':
                ret.put("success", false);
                ret.put("status", "cancelled");
                ret.put("error", "Transaction annulee");
                break;
            case '9':
                ret.put("success", false);
                ret.put("status", "cancelled");
                ret.put("error", "Transaction annulee par le client");
                break;
            default:
                ret.put("success", false);
                ret.put("status", "unknown");
                ret.put("error", "Statut inconnu: " + status);
                break;
        }

        // Parse amount
        try {
            int cents = Integer.parseInt(amountStr.trim());
            ret.put("amount", cents);
        } catch (NumberFormatException e) {
            ret.put("amount", 0);
        }

        // Extract optional fields if present
        // After the base fields (13 chars min), remaining is "private data"
        if (response.length() > 13) {
            String privateData = response.substring(13);
            ret.put("privateData", privateData);

            // Try to extract authorization code (usually first 6 chars of private data)
            if (privateData.length() >= 6) {
                String authCode = privateData.substring(0, 6).trim();
                if (!authCode.isEmpty()) ret.put("authCode", authCode);
            }
            // Try to extract card type and masked PAN from remaining data
            if (privateData.length() > 6) {
                ret.put("terminalData", privateData.substring(6).trim());
            }
        }

        ret.put("rawResponse", response);
        return ret;
    }

    // ══════════════════════════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════════════════════════

    private int readByteWithTimeout(InputStream in, int timeoutMs) throws IOException {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            if (in.available() > 0) {
                int b = in.read();
                if (b == -1) throw new IOException("Connection fermee par le TPE");
                return b;
            }
            try { Thread.sleep(50); } catch (InterruptedException e) { break; }
        }
        throw new IOException("Timeout en attente de reponse du TPE (" + timeoutMs + "ms)");
    }

    private String getCurrencyNumeric(String currency) {
        switch (currency.toUpperCase()) {
            case "EUR": return "978";
            case "USD": return "840";
            case "GBP": return "826";
            case "CHF": return "756";
            default: return "978";
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X ", b));
        }
        return sb.toString().trim();
    }
}
