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
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * CaissePro — Concert / Caisse-AP Protocol Plugin
 *
 * Supports BOTH protocol versions:
 *
 * ═══ CAISSE-AP V3 (Concert V3) — TCP/IP ═══
 * Used by: Ingenico Desk/5000, Move/5000 over Ethernet/WiFi
 * Format: TLV (Tag-Length-Value) — variable length ASCII
 * Port: 8888 (default)
 * No STX/ETX/LRC framing, no ENQ/ACK handshake
 * Reference: https://github.com/akretion/caisse-ap-ip
 *
 * Message structure: TAG(2) + LENGTH(3, zero-padded) + VALUE
 * Example: CZ0040300CA00201CB00511245CE003978BA00100CD00100
 *
 * Request tags:
 *   CZ = protocol version (always "0300", must be first)
 *   CJ = protocol identifier (12 chars)
 *   CA = POS number ("01"-"99")
 *   CB = amount in cents (variable length)
 *   CD = action: "0"=debit, "1"=refund/reimburse
 *   CE = currency ISO numeric ("978"=EUR)
 *   BA = answer mode: "0"=wait for end, "1"=immediate
 *   CC = payment mode: omit for default CB, "00C"=check
 *   CF = private data (reference)
 *
 * Response tags:
 *   AE = status: "10"=success, "01"=failure
 *   AF = error code: "04"=refused, "05"=forbidden, "08"=timeout, "09"=format, "11"=abandon
 *   AC = authorization number (6 digits)
 *   AA = masked card number
 *   AB = card expiry (YYMM)
 *   AI = application ID (AID)
 *   CC = payment type: "001"=CB contact, "00B"=CB contactless
 *   CI = contact indicator: "1"=contact, "2"=contactless
 *   CF = private data echoed back
 *   CG = seller contract number
 *
 * ═══ CONCERT V2 — Serial/USB (legacy fallback) ═══
 * Fixed 34-byte message with STX/ETX/LRC framing
 * Only used if explicitly configured (protocol="concert_v2")
 */
@CapacitorPlugin(name = "ConcertProtocol")
public class ConcertPlugin extends Plugin {
    private static final String TAG = "ConcertProtocol";

    private static final byte STX = 0x02;
    private static final byte ETX = 0x03;

    private static final int DEFAULT_PORT = 8888;
    private static final int CONNECT_TIMEOUT = 5000;   // 5s to connect
    private static final int READ_TIMEOUT = 180000;     // 3min to wait for payment (customer enters PIN etc.)

    // ══════════════════════════════════════════════════════════════
    // PUBLIC METHODS (Capacitor bridge)
    // ══════════════════════════════════════════════════════════════

    // ── Test TCP connection to TPE ──
    @PluginMethod
    public void ping(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);

        if (host.isEmpty()) {
            call.reject("Adresse IP du TPE requise");
            return;
        }

        new Thread(() -> {
            JSObject ret = new JSObject();
            ret.put("host", host);
            ret.put("port", port);
            try {
                Socket socket = new Socket();
                socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT);
                socket.close();
                ret.put("success", true);
                ret.put("message", "TPE accessible sur " + host + ":" + port);
            } catch (Exception e) {
                Log.e(TAG, "Ping failed: " + e.getMessage());
                ret.put("success", false);
                ret.put("error", "TPE injoignable: " + e.getMessage());
            }
            call.resolve(ret);
        }).start();
    }

    // ── Scan a specific port ──
    @PluginMethod
    public void scanPort(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);
        int timeout = call.getInt("timeout", 2000);

        new Thread(() -> {
            JSObject ret = new JSObject();
            ret.put("host", host);
            ret.put("port", port);
            try {
                Socket socket = new Socket();
                socket.connect(new InetSocketAddress(host, port), timeout);
                socket.close();
                ret.put("open", true);
            } catch (Exception e) {
                ret.put("open", false);
                ret.put("error", e.getMessage());
            }
            call.resolve(ret);
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
        String protocol = call.getString("protocol", "v3"); // "v3" or "v2"

        if (host.isEmpty()) { call.reject("Adresse IP du TPE requise"); return; }
        if (amount <= 0) { call.reject("Montant invalide"); return; }

        Log.i(TAG, "Sale: " + amount + " cents to " + host + ":" + port + " (protocol " + protocol + ")");

        new Thread(() -> {
            try {
                JSObject result;
                if ("v2".equals(protocol)) {
                    result = sendConcertV2(host, port, posNumber, amount, '0', currency, reference);
                } else {
                    result = sendCaisseAPv3(host, port, posNumber, amount, "0", currency, reference);
                }
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "Sale error: " + e.getMessage(), e);
                call.reject("Erreur paiement: " + e.getMessage());
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
        String posNumber = call.getString("posNumber", "01");
        String protocol = call.getString("protocol", "v3");

        if (host.isEmpty()) { call.reject("Adresse IP du TPE requise"); return; }
        if (amount <= 0) { call.reject("Montant invalide"); return; }

        new Thread(() -> {
            try {
                JSObject result;
                if ("v2".equals(protocol)) {
                    result = sendConcertV2(host, port, posNumber, amount, '1', currency, "");
                } else {
                    result = sendCaisseAPv3(host, port, posNumber, amount, "1", currency, "");
                }
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Erreur remboursement: " + e.getMessage());
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
                // V3 cancel: send debit with amount 0 (terminal interprets as cancel)
                // Some terminals need a specific approach — this is a best-effort
                JSObject result = sendCaisseAPv3(host, port, posNumber, 0, "0", "EUR", "CANCEL");
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Erreur annulation: " + e.getMessage());
            }
        }).start();
    }

    // ── Send raw Caisse-AP V3 message (for debug panel) ──
    @PluginMethod
    public void sendRawV3(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);
        String message = call.getString("message", "");

        if (host.isEmpty() || message.isEmpty()) {
            call.reject("Host et message requis");
            return;
        }

        new Thread(() -> {
            try {
                Socket socket = new Socket();
                socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT);
                socket.setSoTimeout(READ_TIMEOUT);

                OutputStream out = socket.getOutputStream();
                InputStream in = socket.getInputStream();

                Log.i(TAG, "sendRawV3: [" + message + "] to " + host + ":" + port);
                out.write(message.getBytes(StandardCharsets.US_ASCII));
                out.flush();

                // Read response
                byte[] buf = new byte[2048];
                int len = in.read(buf);
                socket.close();

                JSObject ret = new JSObject();
                if (len > 0) {
                    String response = new String(buf, 0, len, StandardCharsets.US_ASCII);
                    ret.put("success", true);
                    ret.put("rawResponse", response);
                    ret.put("responseLength", len);
                    ret.put("parsed", parseTLVResponse(response));
                } else {
                    ret.put("success", false);
                    ret.put("error", "Pas de reponse du TPE");
                }
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "sendRawV3 error: " + e.getMessage());
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            }
        }).start();
    }

    // ── Get diagnostic info ──
    @PluginMethod
    public void getDiagnostic(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("pluginName", "ConcertProtocol");
        ret.put("defaultPort", DEFAULT_PORT);
        ret.put("connectTimeout", CONNECT_TIMEOUT);
        ret.put("readTimeout", READ_TIMEOUT);
        ret.put("supportedProtocols", "Caisse-AP V3 (TLV/TCP), Concert V2 (34-byte/STX-ETX)");
        ret.put("v3Tags", "CZ,CJ,CA,CB,CD,CE,BA,CC,CF | AE,AF,AC,AA,AB,AI,CC,CI");
        call.resolve(ret);
    }

    // ══════════════════════════════════════════════════════════════
    // CAISSE-AP V3 (Concert V3) — TLV over TCP/IP
    // Reference: https://github.com/akretion/caisse-ap-ip
    // ══════════════════════════════════════════════════════════════

    /**
     * Build and send a Caisse-AP V3 TLV message over TCP/IP.
     *
     * Message format: concatenation of TAG(2) + LENGTH(3, zero-padded) + VALUE
     * No framing (no STX/ETX/LRC) — plain ASCII over TCP.
     * Open a new TCP connection for each transaction.
     */
    private JSObject sendCaisseAPv3(String host, int port, String posNumber,
                                     int amountCents, String action,
                                     String currency, String reference)
            throws IOException {

        // Build TLV message
        LinkedHashMap<String, String> tags = new LinkedHashMap<>();

        // CZ must be first — protocol version
        // Terminal responded with 0301, so we match it
        tags.put("CZ", "0301");

        // NOTE: Do NOT send CJ — it's the terminal's own identifier (e.g. 330538600404).
        // The POS should not send CJ; the terminal returns its CJ in the response.

        // CA: POS/cash register number
        String pos = posNumber != null ? posNumber : "01";
        if (pos.length() < 2) pos = "0" + pos;
        tags.put("CA", pos);

        // CE: currency ISO 4217 numeric (send BEFORE amount per spec ordering)
        tags.put("CE", getCurrencyNumeric(currency));

        // BA: answer mode — "0"=wait for transaction end (recommended)
        tags.put("BA", "0");

        // CD: action — "0"=debit, "1"=reimburse/refund
        tags.put("CD", action);

        // CB: amount in cents (variable length)
        if (amountCents > 0) {
            tags.put("CB", String.valueOf(amountCents));
        }

        // CF: private/reference data (optional)
        if (reference != null && !reference.isEmpty()) {
            tags.put("CF", reference);
        }

        // Build the TLV string
        String message = buildTLVMessage(tags);

        Log.i(TAG, "Caisse-AP V3 message: [" + message + "] (" + message.length() + " chars)");
        Log.i(TAG, "Sending to " + host + ":" + port);

        // Open TCP connection, send, wait for response
        Socket socket = new Socket();
        socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT);
        socket.setSoTimeout(READ_TIMEOUT);

        OutputStream out = socket.getOutputStream();
        InputStream in = socket.getInputStream();

        try {
            // Send the TLV message as plain ASCII
            out.write(message.getBytes(StandardCharsets.US_ASCII));
            out.flush();

            // Wait for response (can take up to 3 min — customer entering PIN, etc.)
            byte[] buffer = new byte[2048];
            int totalRead = 0;

            // Some terminals send the response in chunks
            // Wait for data, then read until no more data for 500ms
            long startTime = System.currentTimeMillis();
            while (System.currentTimeMillis() - startTime < READ_TIMEOUT) {
                if (in.available() > 0) {
                    int bytesRead = in.read(buffer, totalRead, buffer.length - totalRead);
                    if (bytesRead > 0) {
                        totalRead += bytesRead;
                        // Wait a bit to see if more data comes
                        Thread.sleep(200);
                        if (in.available() == 0) break; // No more data
                    } else if (bytesRead == -1) {
                        break; // Connection closed
                    }
                } else {
                    Thread.sleep(100);
                }
            }

            if (totalRead == 0) {
                throw new IOException("Pas de reponse du TPE (timeout " + READ_TIMEOUT + "ms)");
            }

            String response = new String(buffer, 0, totalRead, StandardCharsets.US_ASCII);
            Log.i(TAG, "Caisse-AP V3 response (" + totalRead + " chars): [" + response + "]");

            // Parse TLV response
            return parseV3Response(response);

        } catch (InterruptedException e) {
            throw new IOException("Interrupted while waiting for TPE response");
        } finally {
            try { socket.close(); } catch (Exception e) {}
        }
    }

    /**
     * Build a TLV message string from a map of tags.
     * Format per tag: TAG(2 chars) + LENGTH(3 chars, zero-padded) + VALUE
     *
     * Example: CZ0040300CA00201CB00511245
     */
    private String buildTLVMessage(LinkedHashMap<String, String> tags) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : tags.entrySet()) {
            String tag = entry.getKey();
            String value = entry.getValue();
            String length = String.format("%03d", value.length());
            sb.append(tag).append(length).append(value);
        }
        return sb.toString();
    }

    /**
     * Parse a TLV response string into individual tags.
     * Each tag: TAG(2) + LENGTH(3) + VALUE(length)
     */
    private LinkedHashMap<String, String> parseTLV(String tlvString) {
        LinkedHashMap<String, String> result = new LinkedHashMap<>();
        int i = 0;
        while (i + 5 <= tlvString.length()) {
            String tag = tlvString.substring(i, i + 2);
            int length;
            try {
                length = Integer.parseInt(tlvString.substring(i + 2, i + 5));
            } catch (NumberFormatException e) {
                Log.w(TAG, "Invalid TLV length at position " + i + ": " + tlvString.substring(i));
                break;
            }
            if (i + 5 + length > tlvString.length()) {
                Log.w(TAG, "TLV value exceeds message length at tag " + tag);
                break;
            }
            String value = tlvString.substring(i + 5, i + 5 + length);
            result.put(tag, value);
            i += 5 + length;
        }
        return result;
    }

    /**
     * Parse a Caisse-AP V3 TLV response and return a structured JSObject.
     */
    private JSObject parseV3Response(String response) {
        JSObject ret = new JSObject();
        ret.put("rawResponse", response);
        ret.put("protocol", "caisse-ap-v3");

        LinkedHashMap<String, String> tags = parseTLV(response);

        // Put all parsed tags into the response
        JSObject parsedTags = parseTLVResponse(response);
        ret.put("tags", parsedTags);

        // AE: transaction status
        String status = tags.get("AE");
        if (status != null) {
            ret.put("statusCode", status);
            switch (status) {
                case "10":
                    ret.put("success", true);
                    ret.put("status", "approved");
                    break;
                case "01":
                    ret.put("success", false);
                    ret.put("status", "declined");
                    ret.put("error", "Transaction refusee par le terminal");
                    break;
                case "11":
                    ret.put("success", true);
                    ret.put("status", "acknowledged");
                    break;
                default:
                    ret.put("success", false);
                    ret.put("status", "unknown");
                    ret.put("error", "Statut inconnu: " + status);
                    break;
            }
        } else {
            ret.put("success", false);
            ret.put("status", "no_status");
            ret.put("error", "Pas de tag AE dans la reponse");
        }

        // AF: error code (if present)
        String errorCode = tags.get("AF");
        if (errorCode != null) {
            ret.put("errorCode", errorCode);
            String errorLabel;
            switch (errorCode) {
                case "04": errorLabel = "Refuse par la banque"; break;
                case "05": errorLabel = "Interdit"; break;
                case "07": errorLabel = "Erreur format requete"; break;
                case "08": errorLabel = "Timeout"; break;
                case "09": errorLabel = "Erreur format"; break;
                case "11": errorLabel = "Abandon par le porteur"; break;
                case "12": errorLabel = "Carte non supportee"; break;
                default: errorLabel = "Code erreur " + errorCode; break;
            }
            ret.put("errorLabel", errorLabel);
            if (!ret.has("error") || ret.getString("error") == null) {
                ret.put("error", errorLabel);
            }
        }

        // AC: authorization number
        String authCode = tags.get("AC");
        if (authCode != null) ret.put("authCode", authCode.trim());

        // AA: masked card number
        String cardNumber = tags.get("AA");
        if (cardNumber != null) ret.put("maskedPan", cardNumber.trim());

        // AB: card expiry (YYMM)
        String expiry = tags.get("AB");
        if (expiry != null) ret.put("cardExpiry", expiry);

        // AI: Application ID (AID)
        String aid = tags.get("AI");
        if (aid != null) ret.put("applicationId", aid);

        // CC: payment type
        String payType = tags.get("CC");
        if (payType != null) {
            ret.put("paymentType", payType);
            String payLabel;
            switch (payType) {
                case "001": payLabel = "CB Contact"; break;
                case "00B": payLabel = "CB Sans Contact"; break;
                case "002": payLabel = "Amex Contact"; break;
                case "00D": payLabel = "Amex Sans Contact"; break;
                case "00C": payLabel = "Cheque"; break;
                default: payLabel = "Type " + payType; break;
            }
            ret.put("paymentLabel", payLabel);
        }

        // CI: contact indicator
        String contactIndicator = tags.get("CI");
        if (contactIndicator != null) {
            ret.put("contactless", "2".equals(contactIndicator));
        }

        // CB: amount confirmed
        String confirmedAmount = tags.get("CB");
        if (confirmedAmount != null) {
            try {
                ret.put("amount", Integer.parseInt(confirmedAmount));
            } catch (NumberFormatException e) {}
        }

        // CF: private data echoed
        String privateData = tags.get("CF");
        if (privateData != null) ret.put("privateData", privateData);

        // CG: seller contract number
        String contract = tags.get("CG");
        if (contract != null) ret.put("contractNumber", contract);

        return ret;
    }

    /**
     * Parse TLV response into a flat JSObject (for debug display).
     */
    private JSObject parseTLVResponse(String response) {
        JSObject ret = new JSObject();
        LinkedHashMap<String, String> tags = parseTLV(response);
        for (Map.Entry<String, String> entry : tags.entrySet()) {
            ret.put(entry.getKey(), entry.getValue());
        }
        return ret;
    }

    // ══════════════════════════════════════════════════════════════
    // CONCERT V2 — Legacy 34-byte format (STX/ETX/LRC)
    // Kept as fallback for older terminals or serial-over-IP bridges
    // ══════════════════════════════════════════════════════════════

    private JSObject sendConcertV2(String host, int port, String posNumber,
                                    int amountCents, char transType,
                                    String currency, String reference)
            throws IOException {

        Socket socket = new Socket();
        socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT);
        socket.setSoTimeout(READ_TIMEOUT);

        OutputStream out = socket.getOutputStream();
        InputStream in = socket.getInputStream();

        try {
            byte[] message = buildV2Message(posNumber, amountCents, transType, currency, reference);
            out.write(message);
            out.flush();
            Log.d(TAG, "Sent Concert V2 message (" + message.length + " bytes): " + bytesToHex(message));

            return readV2Response(in);
        } finally {
            try { socket.close(); } catch (Exception e) {}
        }
    }

    /**
     * Build Concert V2 34-byte message: STX + 34-byte data + ETX + LRC
     */
    private byte[] buildV2Message(String posNumber, int amountCents, char transType,
                                   String currency, String reference) {
        String pos = (posNumber + "00").substring(0, 2);
        String amountStr = String.format("%08d", amountCents);
        char answerFlag = '1';  // expect response
        char paymentMode = '1'; // card
        String currencyCode = getCurrencyNumeric(currency);
        String privData = reference != null ? reference : "";
        if (privData.length() > 10) privData = privData.substring(0, 10);
        privData = String.format("%-10s", privData);
        String delay = "A010";
        String authorization = "B010";

        String data = pos + amountStr + answerFlag + paymentMode + transType + currencyCode
                     + privData + delay + authorization;

        Log.d(TAG, "V2 data (" + data.length() + " chars): [" + data + "]");

        byte[] dataBytes = data.getBytes(StandardCharsets.ISO_8859_1);
        byte[] frame = new byte[1 + dataBytes.length + 1 + 1];

        frame[0] = STX;
        System.arraycopy(dataBytes, 0, frame, 1, dataBytes.length);
        frame[1 + dataBytes.length] = ETX;

        byte lrc = 0;
        for (int i = 1; i < 1 + dataBytes.length + 1; i++) {
            lrc ^= frame[i];
        }
        frame[frame.length - 1] = lrc;

        return frame;
    }

    /**
     * Read Concert V2 response: STX + data + ETX + LRC
     */
    private JSObject readV2Response(InputStream in) throws IOException {
        int b = readByteWithTimeout(in, READ_TIMEOUT);
        if (b != STX) {
            throw new IOException("Attendu STX (0x02), recu: 0x" + Integer.toHexString(b));
        }

        byte[] buffer = new byte[1024];
        int pos = 0;
        while (true) {
            b = readByteWithTimeout(in, 10000);
            if (b == ETX) break;
            if (pos < buffer.length) buffer[pos++] = (byte) b;
        }

        byte lrcReceived = (byte) readByteWithTimeout(in, 2000);
        byte lrcCalc = 0;
        for (int i = 0; i < pos; i++) lrcCalc ^= buffer[i];
        lrcCalc ^= ETX;

        String response = new String(buffer, 0, pos, StandardCharsets.ISO_8859_1);
        Log.i(TAG, "V2 response (" + pos + " chars): [" + response + "]");

        return parseV2Response(response, lrcCalc == lrcReceived);
    }

    private JSObject parseV2Response(String response, boolean lrcOk) {
        JSObject ret = new JSObject();
        ret.put("lrcValid", lrcOk);
        ret.put("rawResponse", response);
        ret.put("protocol", "concert-v2");

        if (response.length() < 3) {
            ret.put("success", false);
            ret.put("status", "error");
            ret.put("error", "Reponse trop courte: " + response.length() + " octets");
            return ret;
        }

        ret.put("posNumber", response.substring(0, 2));
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
                ret.put("error", "Transaction en attente");
                break;
            case '7':
                ret.put("success", false);
                ret.put("status", "declined");
                ret.put("error", "Transaction refusee");
                break;
            case '9':
                ret.put("success", false);
                ret.put("status", "cancelled");
                ret.put("error", "Transaction annulee");
                break;
            default:
                ret.put("success", false);
                ret.put("status", "unknown");
                ret.put("error", "Statut inconnu: '" + status + "'");
                break;
        }

        if (response.length() >= 11) {
            try {
                ret.put("amount", Integer.parseInt(response.substring(3, 11).trim()));
            } catch (NumberFormatException e) {}
        }
        if (response.length() >= 12) {
            ret.put("paymentMode", String.valueOf(response.charAt(11)));
        }
        if (response.length() >= 15 && status != '5') {
            ret.put("currency", response.substring(12, 15));
        }
        if (response.length() > 15) {
            String privateData = response.substring(15).trim();
            ret.put("privateData", privateData);
            if (privateData.length() >= 6) {
                String authCode = privateData.substring(0, 6).trim();
                if (!authCode.isEmpty()) ret.put("authCode", authCode);
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
                if (b == -1) throw new IOException("Connexion fermee par le TPE");
                return b;
            }
            try { Thread.sleep(50); } catch (InterruptedException e) { break; }
        }
        throw new IOException("Timeout (" + timeoutMs + "ms)");
    }

    private String getCurrencyNumeric(String currency) {
        if (currency == null) return "978";
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
