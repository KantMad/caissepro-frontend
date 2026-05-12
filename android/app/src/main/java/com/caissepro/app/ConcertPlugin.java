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
 * CaissePro — Concert Protocol Plugin (Protocole Caisse / CTAP)
 *
 * Implements the French standard protocol for POS to Payment Terminal communication.
 * Works with Ingenico (Desk/5000, Move/5000, Lane/7000), Verifone (V240m, P400),
 * and Worldline (VALINA, YOMANI, LANE) terminals.
 *
 * Protocol: Concert V2 over TCP/IP (NOT serial)
 * ─────────────────────────────────────────────
 * Over TCP/IP there is NO ENQ/ACK handshake (that's only for serial RS232).
 *
 * Message format (POS -> TPE):
 *   STX (0x02) + Data (34 bytes fixed) + ETX (0x03) + LRC
 *
 * Data fields (34 bytes total):
 *   posNumber     2 chars   POS identifier ("01" default)
 *   amount        8 chars   Amount in cents, zero-padded ("00001050" = 10.50 EUR)
 *   answerFlag    1 char    '1' = POS expects response
 *   paymentMode   1 char    '1' = card, '0' = not specified
 *   transType     1 char    '0' = debit/sale, '1' = credit/refund, 'A' = cancel
 *   currency      3 chars   ISO 4217 numeric ("978" = EUR)
 *   privateData  10 chars   Space-padded, can contain reference
 *   delay         4 chars   Timeout authorization in seconds ("A010" = 10s)
 *   authorization 4 chars   Authorization timeout ("B010" = 10s)
 *
 * Response format (TPE -> POS):
 *   STX (0x02) + ResponseData + ETX (0x03) + LRC
 *
 * ResponseData:
 *   posNumber     2 chars
 *   status        1 char    '0' = accepted, '5' = pending, '7' = refused
 *   amount        8 chars
 *   paymentMode   1 char
 *   currency      3 chars   (only if status != '5')
 *   privateData  10 chars   (may contain auth code)
 *
 * LRC: XOR of all bytes from data[0] to ETX inclusive (NOT including STX)
 */
@CapacitorPlugin(name = "ConcertProtocol")
public class ConcertPlugin extends Plugin {
    private static final String TAG = "ConcertProtocol";

    private static final byte STX = 0x02;
    private static final byte ETX = 0x03;

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

    // ── Send payment request (debit) ──
    @PluginMethod
    public void sale(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);
        int amount = call.getInt("amount", 0); // cents
        String currency = call.getString("currency", "EUR");
        String reference = call.getString("reference", "");
        String posNumber = call.getString("posNumber", "01");

        if (host.isEmpty()) { call.reject("Adresse IP du TPE requise"); return; }
        if (amount <= 0) { call.reject("Montant invalide"); return; }

        Log.i(TAG, "Sale: " + amount + " cents to " + host + ":" + port);

        new Thread(() -> {
            try {
                // transType '0' = debit/sale
                JSObject result = sendConcertTransaction(host, port, posNumber, amount, '0', currency, reference);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "Sale error: " + e.getMessage());
                call.reject("Erreur paiement Concert: " + e.getMessage());
            }
        }).start();
    }

    // ── Send refund request (credit) ──
    @PluginMethod
    public void refund(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);
        int amount = call.getInt("amount", 0);
        String currency = call.getString("currency", "EUR");
        String posNumber = call.getString("posNumber", "01");

        if (host.isEmpty()) { call.reject("Adresse IP du TPE requise"); return; }
        if (amount <= 0) { call.reject("Montant invalide"); return; }

        new Thread(() -> {
            try {
                // transType '1' = credit/refund
                JSObject result = sendConcertTransaction(host, port, posNumber, amount, '1', currency, "");
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
        String posNumber = call.getString("posNumber", "01");

        new Thread(() -> {
            try {
                // transType 'A' = cancel
                JSObject result = sendConcertTransaction(host, port, posNumber, 0, 'A', "EUR", "");
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Erreur annulation: " + e.getMessage());
            }
        }).start();
    }

    // ══════════════════════════════════════════════════════════════
    // Concert V2 Protocol Implementation (TCP/IP mode)
    // ══════════════════════════════════════════════════════════════

    /**
     * Send a Concert V2 transaction over TCP/IP.
     * Over TCP there is NO ENQ/ACK handshake — just send the framed message directly.
     */
    private JSObject sendConcertTransaction(String host, int port, String posNumber,
                                             int amountCents, char transType,
                                             String currency, String reference)
            throws IOException {

        Socket socket = new Socket();
        socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT);
        socket.setSoTimeout(READ_TIMEOUT);

        OutputStream out = socket.getOutputStream();
        InputStream in = socket.getInputStream();

        try {
            // ── Build and send Concert V2 message directly (no ENQ/ACK over TCP) ──
            byte[] message = buildConcertMessage(posNumber, amountCents, transType, currency, reference);
            out.write(message);
            out.flush();
            Log.d(TAG, "Sent Concert message (" + message.length + " bytes): " + bytesToHex(message));

            // ── Wait for response (up to 2 min — customer is paying) ──
            JSObject result = readConcertResponse(in);

            return result;

        } finally {
            try { socket.close(); } catch (Exception e) {}
        }
    }

    /**
     * Build Concert V2 message frame.
     * Format: STX + 34-byte data + ETX + LRC
     *
     * Data layout (34 bytes):
     *   [0-1]   posNumber     2 chars
     *   [2-9]   amount        8 chars (zero-padded cents)
     *   [10]    answerFlag    1 char  ('1' = expect response)
     *   [11]    paymentMode   1 char  ('1' = card)
     *   [12]    transType     1 char  ('0'=debit, '1'=credit, 'A'=cancel)
     *   [13-15] currency      3 chars (ISO 4217 numeric)
     *   [16-25] privateData  10 chars (space-padded)
     *   [26-29] delay         4 chars ("A010" = 10s auto-authorization delay)
     *   [30-33] authorization 4 chars ("B010" = 10s authorization timeout)
     */
    private byte[] buildConcertMessage(String posNumber, int amountCents, char transType,
                                        String currency, String reference) {
        // Ensure posNumber is exactly 2 chars
        String pos = (posNumber + "  ").substring(0, 2);

        // Amount: 8 chars zero-padded
        String amountStr = String.format("%08d", amountCents);

        // Answer flag: always '1' (we want a response)
        char answerFlag = '1';

        // Payment mode: '1' = card
        char paymentMode = '1';

        // Currency: ISO 4217 numeric code
        String currencyCode = getCurrencyNumeric(currency);

        // Private data: 10 chars, space-padded
        String privData = reference != null ? reference : "";
        if (privData.length() > 10) privData = privData.substring(0, 10);
        privData = String.format("%-10s", privData); // left-align, pad with spaces

        // Delay and authorization timeouts
        String delay = "A010";         // 10 second auto-authorization delay
        String authorization = "B010"; // 10 second authorization timeout

        // Assemble the 34-byte data string
        String data = pos + amountStr + answerFlag + paymentMode + transType + currencyCode
                     + privData + delay + authorization;

        Log.d(TAG, "Concert data (" + data.length() + " chars): [" + data + "]");

        // Build frame: STX + data + ETX + LRC
        byte[] dataBytes = data.getBytes(StandardCharsets.ISO_8859_1);
        byte[] frame = new byte[1 + dataBytes.length + 1 + 1]; // STX + data + ETX + LRC

        frame[0] = STX;
        System.arraycopy(dataBytes, 0, frame, 1, dataBytes.length);
        frame[1 + dataBytes.length] = ETX;

        // Calculate LRC: XOR of all bytes from data[0] to ETX inclusive (NOT STX)
        byte lrc = 0;
        for (int i = 1; i < 1 + dataBytes.length + 1; i++) {
            lrc ^= frame[i];
        }
        frame[frame.length - 1] = lrc;

        return frame;
    }

    /**
     * Read and parse a Concert V2 response from the TPE.
     * Response: STX + data + ETX + LRC
     *
     * Response data:
     *   [0-1]  posNumber  2 chars
     *   [2]    status     1 char: '0'=accepted, '5'=pending, '7'=refused
     *   [3-10] amount     8 chars
     *   [11]   paymentMode 1 char
     *   [12-14] currency  3 chars (if status != '5')
     *   [15+]  privateData (variable, may contain auth code in first 6 chars)
     */
    private JSObject readConcertResponse(InputStream in) throws IOException {
        // Wait for STX
        int b = readByteWithTimeout(in, READ_TIMEOUT);
        if (b != STX) {
            throw new IOException("Reponse inattendue du TPE (attendu STX 0x02, recu: 0x" + Integer.toHexString(b) + ")");
        }

        // Read until ETX
        byte[] buffer = new byte[1024];
        int pos = 0;

        while (true) {
            b = readByteWithTimeout(in, 10000);
            if (b == ETX) {
                break;
            }
            if (pos < buffer.length) {
                buffer[pos++] = (byte) b;
            }
        }

        // Read LRC byte
        byte lrcReceived = (byte) readByteWithTimeout(in, 2000);

        // Verify LRC: XOR of data bytes + ETX
        byte lrcCalc = 0;
        for (int i = 0; i < pos; i++) {
            lrcCalc ^= buffer[i];
        }
        lrcCalc ^= ETX;

        if (lrcCalc != lrcReceived) {
            Log.w(TAG, "LRC mismatch: calculated=0x" + Integer.toHexString(lrcCalc & 0xFF)
                     + " received=0x" + Integer.toHexString(lrcReceived & 0xFF));
        }

        // Parse response
        String response = new String(buffer, 0, pos, StandardCharsets.ISO_8859_1);
        Log.i(TAG, "Concert response (" + pos + " chars): [" + response + "]");

        return parseConcertResponse(response, lrcCalc == lrcReceived);
    }

    /**
     * Parse Concert V2 response data.
     *
     * Minimum response: posNumber(2) + status(1) + amount(8) + paymentMode(1) = 12 chars
     * With currency: + currency(3) = 15 chars
     * With private data: 15+ chars
     */
    private JSObject parseConcertResponse(String response, boolean lrcOk) {
        JSObject ret = new JSObject();
        ret.put("lrcValid", lrcOk);
        ret.put("rawResponse", response);

        if (response.length() < 3) {
            ret.put("success", false);
            ret.put("status", "error");
            ret.put("error", "Reponse trop courte du TPE: " + response.length() + " octets");
            return ret;
        }

        // posNumber at [0-1]
        String posNumber = response.substring(0, 2);
        ret.put("posNumber", posNumber);

        // Status at [2]
        char status = response.charAt(2);
        ret.put("statusCode", String.valueOf(status));

        switch (status) {
            case '0':
                ret.put("success", true);
                ret.put("status", "approved");
                break;
            case '5':
                ret.put("success", false);
                ret.put("status", "pending");
                ret.put("error", "Transaction en attente — verifiez le terminal");
                break;
            case '7':
                ret.put("success", false);
                ret.put("status", "declined");
                ret.put("error", "Transaction refusee");
                break;
            case '9':
                ret.put("success", false);
                ret.put("status", "cancelled");
                ret.put("error", "Transaction annulee par le client");
                break;
            default:
                ret.put("success", false);
                ret.put("status", "unknown");
                ret.put("error", "Statut TPE inconnu: '" + status + "' (0x" + Integer.toHexString(status) + ")");
                break;
        }

        // Amount at [3-10] (8 chars)
        if (response.length() >= 11) {
            String amountStr = response.substring(3, 11);
            try {
                int cents = Integer.parseInt(amountStr.trim());
                ret.put("amount", cents);
            } catch (NumberFormatException e) {
                ret.put("amount", 0);
                Log.w(TAG, "Could not parse amount: [" + amountStr + "]");
            }
        }

        // Payment mode at [11]
        if (response.length() >= 12) {
            char payMode = response.charAt(11);
            ret.put("paymentMode", String.valueOf(payMode));
        }

        // Currency at [12-14] (only if status != '5')
        if (response.length() >= 15 && status != '5') {
            ret.put("currency", response.substring(12, 15));
        }

        // Private data at [15+] (may contain authorization code)
        if (response.length() > 15) {
            String privateData = response.substring(15).trim();
            ret.put("privateData", privateData);

            // First 6 chars of private data are typically the authorization code
            if (privateData.length() >= 6) {
                String authCode = privateData.substring(0, 6).trim();
                if (!authCode.isEmpty()) ret.put("authCode", authCode);
            }
            // Remaining data may contain card type, masked PAN etc.
            if (privateData.length() > 6) {
                ret.put("terminalData", privateData.substring(6).trim());
            }
        }

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
