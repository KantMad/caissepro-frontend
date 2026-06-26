// ═══════════════════════════════════════
// CaissePro — ESC/POS Thermal Printer
// Web Serial API + WebUSB support
// ═══════════════════════════════════════

// ESC/POS Command Constants
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;
const CR = 0x0D;

const CMD = {
  INIT: [ESC, 0x40],                          // Initialize printer
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT_ON: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH_ON: [ESC, 0x21, 0x20],
  DOUBLE_ON: [ESC, 0x21, 0x30],               // Double width + height
  NORMAL: [ESC, 0x21, 0x00],                  // Normal size
  UNDERLINE_ON: [ESC, 0x2D, 0x01],
  UNDERLINE_OFF: [ESC, 0x2D, 0x00],
  FONT_A: [ESC, 0x4D, 0x00],                  // 12x24 (standard)
  FONT_B: [ESC, 0x4D, 0x01],                  // 9x17 (condensed)
  CUT_PARTIAL: [GS, 0x56, 0x01],              // Partial cut
  CUT_FULL: [GS, 0x56, 0x00],                 // Full cut
  FEED_LINES: (n) => [ESC, 0x64, n],          // Feed n lines
  LINE_SPACING: (n) => [ESC, 0x33, n],        // Set line spacing
  OPEN_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xFA], // Open cash drawer (pin 2)
  BARCODE_HEIGHT: (h) => [GS, 0x68, h],
  BARCODE_WIDTH: (w) => [GS, 0x77, w],
  BARCODE_EAN13: [GS, 0x6B, 0x02],            // Print EAN-13 barcode
  BARCODE_TEXT_BELOW: [GS, 0x48, 0x02],
};

// Character encoding for French characters
const CHARSET_FRENCH = [ESC, 0x52, 0x01];  // Select France char set
const CODEPAGE_PC858 = [ESC, 0x74, 0x13];  // PC858 (Western European with €)

// Paper width constants (in characters)
const PAPER_48 = 48; // 80mm paper
const PAPER_32 = 32; // 58mm paper

class ThermalPrinter {
  constructor() {
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.connected = false;
    this.connectionType = null; // 'serial' | 'usb' | 'bluetooth'
    this.usbDevice = null;
    this.btDevice = null;       // Web Bluetooth device
    this.btChar = null;         // caractéristique GATT d'écriture
    this.paperWidth = PAPER_48; // Default 80mm
    this.encoding = 'pc858';
    this._listeners = new Set();
  }

  // ── Event system ──
  on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(event, data) { this._listeners.forEach(fn => fn(event, data)); }

  // ── Connection ──
  get isSupported() {
    return !!navigator.serial || !!navigator.usb || !!navigator.bluetooth;
  }
  get serialSupported() { return !!navigator.serial; }
  get usbSupported() { return !!navigator.usb; }
  get bluetoothSupported() { return !!navigator.bluetooth; }

  async connectSerial(options = {}) {
    if (!navigator.serial) throw new Error("Web Serial API non supportée par ce navigateur");

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({
        baudRate: options.baudRate || 9600,
        dataBits: options.dataBits || 8,
        stopBits: options.stopBits || 1,
        parity: options.parity || 'none',
        flowControl: options.flowControl || 'none',
      });

      this.writer = this.port.writable.getWriter();
      this.connected = true;
      this.connectionType = 'serial';
      this.paperWidth = options.paperWidth || PAPER_48;
      this._emit('connected', { type: 'serial' });

      // Initialize printer
      await this._write(CMD.INIT);
      await this._write(CHARSET_FRENCH);
      await this._write(CODEPAGE_PC858);

      return true;
    } catch (e) {
      this.connected = false;
      if (e.name === 'NotFoundError') throw new Error("Aucune imprimante sélectionnée");
      throw new Error(`Connexion série échouée: ${e.message}`);
    }
  }

  async connectUSB() {
    if (!navigator.usb) throw new Error("WebUSB non supporté par ce navigateur");

    try {
      this.usbDevice = await navigator.usb.requestDevice({
        filters: [
          { classCode: 7 },     // Classe USB « imprimante » — couvre la plupart des ESC/POS
          { vendorId: 0x04B8 }, // Epson
          { vendorId: 0x0519 }, // Star Micronics
          { vendorId: 0x0DD4 }, // Custom
          { vendorId: 0x0416 }, // Bixolon
          { vendorId: 0x0FE6 }, // Kontron/ICS
          { vendorId: 0x1FC9 }, // NXP (generic printers)
          { vendorId: 0x20D1 }, // Xiamen
          { vendorId: 0x0483 }, // STMicroelectronics
          { vendorId: 0x0922 }, // Dymo
          { vendorId: 0x2730 }, // Citizen Systems
          { vendorId: 0x1A86 }, // QinHeng/CH340 (Xprinter & clones bon marché)
          { vendorId: 0x067B }, // Prolific PL2303 (USB-série)
          { vendorId: 0x6868 }, // Zjiang
        ]
      });

      await this.usbDevice.open();
      if (this.usbDevice.configuration === null) {
        await this.usbDevice.selectConfiguration(1);
      }
      await this.usbDevice.claimInterface(0);

      this.connected = true;
      this.connectionType = 'usb';
      this._emit('connected', { type: 'usb' });

      // Initialize
      await this._writeUSB(new Uint8Array(CMD.INIT));
      await this._writeUSB(new Uint8Array(CHARSET_FRENCH));
      await this._writeUSB(new Uint8Array(CODEPAGE_PC858));

      return true;
    } catch (e) {
      this.connected = false;
      if (e.name === 'NotFoundError') throw new Error("Aucun périphérique USB sélectionné");
      throw new Error(`Connexion USB échouée: ${e.message}`);
    }
  }

  async connectBluetooth() {
    if (!navigator.bluetooth) throw new Error("Web Bluetooth non supporté par ce navigateur");
    // Services GATT courants des imprimantes ESC/POS / modules BLE
    const PRINT_SERVICES = [
      0x18F0,
      0xFFE0,
      0xFF00,
      '000018f0-0000-1000-8000-00805f9b34fb',
      '0000ff00-0000-1000-8000-00805f9b34fb',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC/Microchip transparent UART
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // certains modules
    ];
    try {
      this.btDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINT_SERVICES,
      });
      const server = await this.btDevice.gatt.connect();
      // Cherche un service exposant une caractéristique d'écriture
      let writeChar = null;
      const services = await server.getPrimaryServices();
      for (const svc of services) {
        const chars = await svc.getCharacteristics();
        for (const ch of chars) {
          if (ch.properties.write || ch.properties.writeWithoutResponse) { writeChar = ch; break; }
        }
        if (writeChar) break;
      }
      if (!writeChar) throw new Error("Aucune caractéristique d'écriture trouvée sur l'imprimante");

      this.btChar = writeChar;
      this.connected = true;
      this.connectionType = 'bluetooth';
      this.paperWidth = PAPER_48;
      this.btDevice.addEventListener('gattserverdisconnected', () => {
        this.connected = false; this.connectionType = null; this.btChar = null;
        this._emit('disconnected');
      });
      this._emit('connected', { type: 'bluetooth' });

      await this._writeBLE(new Uint8Array(CMD.INIT));
      await this._writeBLE(new Uint8Array(CHARSET_FRENCH));
      await this._writeBLE(new Uint8Array(CODEPAGE_PC858));
      return true;
    } catch (e) {
      this.connected = false;
      if (e.name === 'NotFoundError') throw new Error("Aucune imprimante Bluetooth sélectionnée");
      throw new Error(`Connexion Bluetooth échouée: ${e.message}`);
    }
  }

  // BLE : écriture par paquets sous la MTU (≈ 512 o ; 180 par sécurité)
  async _writeBLE(data) {
    if (!this.connected || !this.btChar) return;
    const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
    const CHUNK = 180;
    for (let i = 0; i < arr.length; i += CHUNK) {
      const slice = arr.slice(i, i + CHUNK);
      if (this.btChar.properties.writeWithoutResponse) await this.btChar.writeValueWithoutResponse(slice);
      else await this.btChar.writeValue(slice);
    }
  }

  async disconnect() {
    try {
      if (this.connectionType === 'serial' && this.port) {
        if (this.writer) { this.writer.releaseLock(); this.writer = null; }
        await this.port.close();
        this.port = null;
      } else if (this.connectionType === 'usb' && this.usbDevice) {
        await this.usbDevice.close();
        this.usbDevice = null;
      } else if (this.connectionType === 'bluetooth' && this.btDevice) {
        if (this.btDevice.gatt?.connected) this.btDevice.gatt.disconnect();
        this.btDevice = null; this.btChar = null;
      }
    } catch (e) {
      console.warn("Printer disconnect warning:", e);
    }
    this.connected = false;
    this.connectionType = null;
    this._emit('disconnected');
  }

  // ── Low-level write ──
  async _write(data) {
    if (!this.connected || !this.writer) return;
    const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
    await this.writer.write(arr);
  }

  async _writeUSB(data) {
    if (!this.connected || !this.usbDevice) return;
    const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
    // Find the OUT endpoint
    const iface = this.usbDevice.configuration.interfaces[0];
    const alt = iface.alternates[0];
    const ep = alt.endpoints.find(e => e.direction === 'out');
    if (ep) {
      await this.usbDevice.transferOut(ep.endpointNumber, arr);
    }
  }

  async send(data) {
    if (this.connectionType === 'serial') return this._write(data);
    if (this.connectionType === 'usb') return this._writeUSB(data);
    if (this.connectionType === 'bluetooth') return this._writeBLE(data);
  }

  // ── Text encoding helper (handles French characters & €) ──
  _encode(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      // PC858 mapping for common French/European characters
      const map = {
        0x20AC: 0xD5, // €
        0x00E9: 0x82, // é
        0x00E8: 0x8A, // è
        0x00EA: 0x88, // ê
        0x00EB: 0x89, // ë
        0x00E0: 0x85, // à
        0x00E2: 0x83, // â
        0x00E7: 0x87, // ç
        0x00F4: 0x93, // ô
        0x00F9: 0x97, // ù
        0x00FB: 0x96, // û
        0x00FC: 0x81, // ü
        0x00EF: 0x8B, // ï
        0x00EE: 0x8C, // î
        0x00C9: 0x90, // É
        0x00C8: 0xD4, // È
        0x00C0: 0xB7, // À
        0x00D4: 0xE2, // Ô
        0x2014: 0x2D, // — → -
        0x2013: 0x2D, // – → -
        0x2019: 0x27, // ' → '
        0x2018: 0x27, // ' → '
        0x201C: 0x22, // " → "
        0x201D: 0x22, // " → "
      };
      if (c < 128) {
        bytes.push(c);
      } else if (map[c] !== undefined) {
        bytes.push(map[c]);
      } else {
        bytes.push(0x3F); // ? for unmapped
      }
    }
    return new Uint8Array(bytes);
  }

  // ── High-level print helpers ──
  async text(str) { await this.send(this._encode(str)); }
  async newline() { await this.send([LF]); }
  async feed(n = 3) { await this.send(CMD.FEED_LINES(n)); }
  async cut(full = false) { await this.send(full ? CMD.CUT_FULL : CMD.CUT_PARTIAL); }
  async openDrawer() { await this.send(CMD.OPEN_DRAWER); }

  async bold(on = true) { await this.send(on ? CMD.BOLD_ON : CMD.BOLD_OFF); }
  async alignLeft() { await this.send(CMD.ALIGN_LEFT); }
  async alignCenter() { await this.send(CMD.ALIGN_CENTER); }
  async alignRight() { await this.send(CMD.ALIGN_RIGHT); }
  async doubleSize() { await this.send(CMD.DOUBLE_ON); }
  async normalSize() { await this.send(CMD.NORMAL); }
  async fontSmall() { await this.send(CMD.FONT_B); }
  async fontNormal() { await this.send(CMD.FONT_A); }

  async separator(char = '-') {
    await this.text(char.repeat(this.paperWidth));
    await this.newline();
  }

  async line(left, right = '') {
    if (!right) {
      await this.text(left);
      await this.newline();
      return;
    }
    const space = this.paperWidth - left.length - right.length;
    if (space > 0) {
      await this.text(left + ' '.repeat(space) + right);
    } else {
      await this.text(left.substring(0, this.paperWidth - right.length - 1) + ' ' + right);
    }
    await this.newline();
  }

  async barcode(data) {
    if (!data || data.length !== 13) return;

    // ── Generate EAN-13 barcode as raster bitmap ──
    const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
    const EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
    const EAN_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
    const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

    const d = data.split('').map(Number);
    const parity = PARITY[d[0]];

    // Build module pattern (1 = black bar, 0 = space)
    let modules = [1,0,1]; // start guard
    for (let i = 0; i < 6; i++) {
      const enc = parity[i] === 'L' ? EAN_L : EAN_G;
      modules.push(...enc[d[i + 1]].split('').map(Number));
    }
    modules.push(0,1,0,1,0); // center guard
    for (let i = 0; i < 6; i++) {
      modules.push(...EAN_R[d[i + 7]].split('').map(Number));
    }
    modules.push(1,0,1); // end guard

    // Scale: each module = 2 pixels wide
    const scale = 2;
    const barcodePixelW = modules.length * scale; // 95 * 2 = 190 pixels

    // Use ESC * mode 33 (24-dot double-density): prints 24 dots high per pass
    // Each column = 3 bytes (24 vertical dots), width up to 65535 columns
    const barcodeH = 48; // 48 dots = 2 passes of 24 dots
    const passH = 24;
    const numPasses = barcodeH / passH; // 2

    await this.send(CMD.ALIGN_CENTER);
    // Set line spacing to 24 dots (so passes don't have gaps)
    await this.send([ESC, 0x33, passH]);

    for (let pass = 0; pass < numPasses; pass++) {
      // ESC * m nL nH d1...dk
      // m=33 (24-dot double-density), nL/nH = number of columns
      const nL = barcodePixelW & 0xFF;
      const nH = (barcodePixelW >> 8) & 0xFF;
      // Build as Uint8Array to avoid large array spread
      const buf = new Uint8Array(5 + barcodePixelW * 3);
      buf[0] = ESC; buf[1] = 0x2A; buf[2] = 33; buf[3] = nL; buf[4] = nH;
      for (let x = 0; x < barcodePixelW; x++) {
        const moduleIdx = Math.floor(x / scale);
        const isBar = modules[moduleIdx] === 1;
        const off = 5 + x * 3;
        // Each column: 3 bytes = 24 vertical dots (all black or all white)
        buf[off] = buf[off + 1] = buf[off + 2] = isBar ? 0xFF : 0x00;
      }
      await this.send(buf);
      await this.send([LF]); // advance to next pass
    }

    // Restore default line spacing
    await this.send([ESC, 0x32]);

    // Print barcode number below
    await this.send(CMD.ALIGN_CENTER);
    await this.send(CMD.FONT_B);
    await this.text(data);
    await this.newline();
    await this.send(CMD.FONT_A);
  }

  // ── Receipt formatting ──
  async printReceipt(ticket, settings, companyInfo) {
    if (!this.connected) throw new Error("Imprimante non connectée");

    const s = settings || {};
    const co = companyInfo || {};
    const W = this.paperWidth;

    try {
      // Initialize
      await this.send(CMD.INIT);
      await this.send(CHARSET_FRENCH);
      await this.send(CODEPAGE_PC858);

      // ── Header ──
      await this.alignCenter();
      await this.doubleSize();
      await this.bold(true);
      await this.text(s.name || co.name || 'Ma Boutique');
      await this.newline();
      await this.normalSize();
      await this.bold(false);

      if (s.address) { await this.text(s.address); await this.newline(); }
      if (s.postalCode || s.city) {
        await this.text(`${s.postalCode || ''} ${s.city || ''}`);
        await this.newline();
      }
      if (s.phone) { await this.text(`Tel: ${s.phone}`); await this.newline(); }
      if (s.siret) { await this.text(`SIRET: ${s.siret}`); await this.newline(); }
      if (s.tvaIntra) { await this.text(`TVA: ${s.tvaIntra}`); await this.newline(); }

      await this.separator('=');

      // ── Gift card mode ──
      const isGift = !!ticket._giftCard;

      // ── Ticket info ──
      await this.alignLeft();
      if (isGift) {
        await this.alignCenter();
        await this.doubleSize();
        await this.bold(true);
        await this.text('TICKET CADEAU');
        await this.newline();
        await this.normalSize();
        await this.bold(false);
        await this.alignLeft();
      }
      await this.bold(true);
      await this.line(`N° ${ticket.ticketNumber}`, new Date(ticket.date || ticket.createdAt || '').toLocaleString('fr-FR'));
      await this.bold(false);
      if (!isGift) { await this.bold(true); await this.line(`Caissier: ${ticket.userName || '?'}`); await this.bold(false); }
      if (ticket.customerName) { await this.bold(true); await this.line(`Client: ${ticket.customerName}`); await this.bold(false); }

      await this.separator('-');

      // ── Items ──
      const items = ticket.items || [];
      for (const item of items) {
        const name = item.product?.name || item.product_name || '?';
        const sku = item.product?.sku || item.product_sku || '';
        const color = item.variant?.color || item.variant_color || '';
        const size = item.variant?.size || item.variant_size || '';
        const ean = item.variant?.ean || item.variant_ean || '';
        const qty = item.quantity || 1;
        const isCustom = item.isCustom || item.is_custom;
        const lineTTC = item.lineTTC || item.line_ttc || (item.unit_price * qty);
        const discount = item.discount || 0;

        // Product name line
        await this.bold(true);
        const itemName = isCustom ? `${name} (divers)` : `${name}`;
        await this.text(itemName);
        await this.newline();
        await this.bold(false);

        // Variant details + ref + colorCode
        const colorCode = item.variant?.colorCode || item.variant_color_code || item.color_code || '';
        if (!isCustom && (color || size)) {
          let detail = `  ${color}/${size}`;
          if (!isGift && sku) detail += ` | Ref: ${sku}`;
          if (!isGift && colorCode) detail += ` | ${colorCode}`;
          await this.bold(true); await this.text(detail); await this.newline(); await this.bold(false);
          if (!isGift && ean) {
            await this.fontSmall();
            await this.text(`  EAN: ${ean}`);
            await this.newline();
            await this.fontNormal();
          }
        }

        // Qty x price line (skip prices for gift card)
        if (isGift) {
          await this.text(`  x${qty}`);
          await this.newline();
        } else {
          const unitPrice = lineTTC / qty;
          let qtyLine = `  ${qty} x ${unitPrice.toFixed(2)}€`;
          if (discount > 0) qtyLine += ` (-${discount}%)`;
          const total = discount > 0 ? (lineTTC * (1 - discount / 100)).toFixed(2) : lineTTC.toFixed(2);
          await this.bold(true);
          await this.line(qtyLine, `${total}€`);
          await this.bold(false);
        }
      }

      await this.separator('-');

      if (!isGift) {
        // ── Promos ──
        if (ticket.promosApplied?.length > 0) {
          await this.fontSmall();
          for (const promo of ticket.promosApplied) {
            await this.text(`  * ${promo}`);
            await this.newline();
          }
          await this.fontNormal();
          await this.separator('-');
        }

        // ── Totals ──
        await this.bold(true);
        await this.line('Sous-total HT', `${(ticket.totalHT || 0).toFixed(2)}€`);
        await this.line('TVA', `${(ticket.totalTVA || 0).toFixed(2)}€`);
        await this.bold(false);

        if (ticket.globalDiscount > 0) {
          await this.bold(true); await this.line('Remise', `-${ticket.globalDiscount.toFixed(2)}€`); await this.bold(false);
        }

        await this.bold(true);
        await this.doubleSize();
        await this.line('TOTAL TTC', `${(ticket.totalTTC || 0).toFixed(2)}€`);
        await this.normalSize();
        await this.bold(false);

        await this.newline(); // marge entre les totaux et le paiement
        await this.separator('-');

        // ── Payment ──
        const methodLabels = { cash: 'ESP', card: 'CB', giftcard: 'CAD', cheque: 'CHQ', avoir: 'AVOIR' };
        if (ticket.payments?.length) {
          const payStr = ticket.payments.map(p => `${methodLabels[p.method] || p.method} ${p.amount.toFixed(2)}€`).join(' + ');
          await this.bold(true); await this.line('Paiement:', payStr); await this.bold(false);
        }

        // Cash change
        if (ticket.paymentMethod === 'cash' && ticket.cashGiven > 0) {
          await this.bold(true);
          await this.line('Recu:', `${ticket.cashGiven.toFixed(2)}€`);
          await this.line('Rendu:', `${(ticket.cashGiven - (ticket.totalTTC || 0)).toFixed(2)}€`);
          await this.bold(false);
        }

        await this.separator('=');

        // ── NF525 Fingerprint ──
        await this.alignCenter();
        await this.bold(true);
        await this.fontSmall();
        await this.text('EMPREINTE NF525');
        await this.newline();
        await this.fontNormal();
        await this.text(ticket.fingerprint || '—');
        await this.newline();
        await this.bold(false);

        await this.separator('-');
      } else {
        // Gift card exchange policy
        await this.alignCenter();
        await this.fontSmall();
        await this.text(`Echange possible sous ${ticket._returnDays || 30} jours`);
        await this.newline();
        await this.text('sur presentation de ce ticket');
        await this.newline();
        await this.fontNormal();
        await this.separator('=');
      }

      // ── Footer ──
      await this.alignCenter();
      await this.fontNormal();
      await this.bold(true);
      await this.text('Garantie legale 2 ans');
      await this.newline();
      await this.bold(false);

      // EAN-13 barcode (BEFORE footer text so text appears below barcode)
      if (ticket.barcode) {
        await this.newline();
        await this.alignCenter();
        await this.barcode(ticket.barcode);
      }

      // Footer text AFTER barcode
      await this.alignCenter();

      // Footer message (thank you) — prominent
      if (s.footerMsg || co.footerMsg) {
        await this.newline();
        await this.bold(true);
        await this.doubleSize();
        await this.text(s.footerMsg || co.footerMsg);
        await this.newline();
        await this.normalSize();
        await this.bold(false);
      }

      // Free text field — configurable custom message
      if (s.ticketFreeText) {
        await this.newline();
        await this.bold(true);
        const lines = s.ticketFreeText.split('\n');
        for (const ln of lines) {
          await this.text(ln);
          await this.newline();
        }
        await this.bold(false);
      }

      if (ticket.saleNote) {
        await this.newline();
        await this.bold(true);
        await this.text(`Note: ${ticket.saleNote}`);
        await this.newline();
        await this.bold(false);
      }

      if (ticket.customerName) {
        await this.newline();
        await this.bold(true);
        await this.text(`Fidelite: +${Math.floor(ticket.totalTTC || 0)}pts`);
        await this.newline();
        await this.bold(false);
      }

      await this.bold(true);
      await this.text(`${co.sw || 'CaissePro'} v${co.ver || '6.1.0'}`);
      await this.newline();
      await this.bold(false);

      // Feed & cut
      await this.feed(4);
      await this.cut();

      this._emit('printed', { type: 'receipt', ticket: ticket.ticketNumber });
      return true;
    } catch (e) {
      this._emit('error', { message: e.message });
      throw new Error(`Erreur impression: ${e.message}`);
    }
  }

  // ── Print credit note (avoir) ──
  async printAvoir(avoir, settings, companyInfo) {
    if (!this.connected) throw new Error("Imprimante non connectee");

    const s = settings || {};
    const co = companyInfo || {};

    try {
      await this.send(CMD.INIT);
      await this.send(CHARSET_FRENCH);
      await this.send(CODEPAGE_PC858);

      // Header
      await this.alignCenter();
      await this.doubleSize();
      await this.bold(true);
      await this.text('AVOIR / NOTE DE CREDIT');
      await this.newline();
      await this.normalSize();
      await this.text(s.name || co.name || 'Ma Boutique');
      await this.newline();
      await this.bold(false);
      if (s.siret) { await this.text(`SIRET: ${s.siret}`); await this.newline(); }

      await this.separator('=');
      await this.alignLeft();

      await this.bold(true);
      await this.line(`N° ${avoir.avoirNumber}`);
      await this.bold(false);
      await this.bold(true); await this.line(`Ticket original: ${avoir.originalTicket}`); await this.bold(false);
      await this.bold(true); await this.line(`Date: ${new Date(avoir.date).toLocaleString('fr-FR')}`); await this.bold(false);
      if (avoir.userName) { await this.bold(true); await this.line(`Caissier: ${avoir.userName}`); await this.bold(false); }
      if (avoir.customerName) { await this.bold(true); await this.line(`Client: ${avoir.customerName}`); await this.bold(false); }
      await this.bold(true); await this.line(`Motif: ${avoir.reason || 'Non specifie'}`); await this.bold(false);

      await this.separator('-');

      // Items
      for (const item of (avoir.items || [])) {
        const name = item.product?.name || item.product_name || item.name || '?';
        const sku = item.product?.sku || item.product_sku || item.sku || '';
        const color = item.variant?.color || item.variant_color || item.color || '';
        const colorCode = item.variant?.colorCode || item.variant_color_code || item.color_code || '';
        const sz = item.variant?.size || item.variant_size || item.size || '';
        const ean = item.variant?.ean || item.variant_ean || item.ean || '';
        await this.bold(true); await this.text(name); await this.newline(); await this.bold(false);
        if (color || sz) {
          let detail = `  ${color}/${sz}`;
          if (sku) detail += ` | Ref: ${sku}`;
          if (colorCode) detail += ` | ${colorCode}`;
          await this.bold(true); await this.text(detail); await this.newline(); await this.bold(false);
          if (ean) { await this.fontSmall(); await this.text(`  EAN: ${ean}`); await this.newline(); await this.fontNormal(); }
        }
        await this.bold(true); await this.line(`  x${item.quantity || 1}`, `-${(item.lineTTC || item.line_ttc || 0).toFixed(2)}€`); await this.bold(false);
      }

      await this.separator('-');

      // Total
      await this.bold(true);
      await this.doubleSize();
      const refundLabels = { cash: 'Especes', card: 'Carte bancaire', avoir: 'Avoir client' };
      await this.line('TOTAL AVOIR', `-${(avoir.totalTTC || 0).toFixed(2)}€`);
      await this.normalSize();
      await this.bold(false);
      if (avoir.remaining != null && Number(avoir.remaining) < (Number(avoir.totalTTC || 0) - 0.001)) {
        await this.separator('-');
        await this.bold(true); await this.line('SOLDE RESTANT', `${Number(avoir.remaining).toFixed(2)}€`); await this.bold(false);
      }
      await this.bold(true); await this.line('Remboursement:', refundLabels[avoir.refundMethod] || avoir.refundMethod); await this.bold(false);

      await this.separator('=');

      // NF525
      await this.alignCenter();
      await this.bold(true);
      await this.text('EMPREINTE NF525');
      await this.newline();
      await this.text(avoir.fingerprint || '—');
      await this.newline();
      await this.bold(false);

      // Garantie
      await this.bold(true);
      await this.text('Garantie legale 2 ans');
      await this.newline();
      await this.bold(false);

      // EAN-13 barcode
      if (avoir.barcode) {
        await this.newline();
        await this.alignCenter();
        await this.barcode(avoir.barcode);
      }

      // Footer text AFTER barcode
      await this.alignCenter();
      if (s.footerMsg || co.footerMsg) {
        await this.newline();
        await this.bold(true);
        await this.doubleSize();
        await this.text(s.footerMsg || co.footerMsg);
        await this.newline();
        await this.normalSize();
        await this.bold(false);
      }
      if (s.ticketFreeText) {
        await this.newline();
        await this.bold(true);
        const ftLines = s.ticketFreeText.split('\n');
        for (const ln of ftLines) { await this.text(ln); await this.newline(); }
        await this.bold(false);
      }
      await this.fontNormal();
      await this.bold(true);
      await this.text(`${co.sw || 'CaissePro'} v${co.ver || '6.1.0'}`);
      await this.newline();
      await this.bold(false);

      await this.feed(4);
      await this.cut();

      this._emit('printed', { type: 'avoir', number: avoir.avoirNumber });
      return true;
    } catch (e) {
      this._emit('error', { message: e.message });
      throw new Error(`Erreur impression avoir: ${e.message}`);
    }
  }

  // ── Print Z closure report ──
  async printClosure(closure, settings, companyInfo) {
    if (!this.connected) throw new Error("Imprimante non connectee");

    const s = settings || {};
    const co = companyInfo || {};

    try {
      await this.send(CMD.INIT);
      await this.send(CHARSET_FRENCH);
      await this.send(CODEPAGE_PC858);

      await this.alignCenter();
      await this.doubleSize();
      await this.bold(true);
      await this.text('CLOTURE DE CAISSE');
      await this.newline();
      await this.normalSize();
      await this.text(s.name || co.name || 'Ma Boutique');
      await this.newline();
      await this.bold(false);

      await this.separator('=');
      await this.alignLeft();

      await this.bold(true);
      await this.line(`N° ${closure.closureNumber || closure.zNumber || '?'}`);
      await this.line(`Date: ${new Date(closure.date || closure.closedAt).toLocaleString('fr-FR')}`);
      await this.line(`Caissier: ${closure.userName || '?'}`);
      await this.bold(false);

      await this.separator('-');

      await this.bold(true);
      await this.doubleSize();
      await this.line('CA TTC', `${(closure.totalTTC || closure.totalCA || 0).toFixed(2)}€`);
      await this.normalSize();
      await this.line('Total HT', `${(closure.totalHT || 0).toFixed(2)}€`);
      await this.line('Total TVA', `${(closure.totalTVA || 0).toFixed(2)}€`);
      await this.line('Nb ventes', `${closure.salesCount || closure.nbSales || 0}`);
      await this.line('Panier moyen', `${(closure.avgBasket || 0).toFixed(2)}€`);
      await this.bold(false);

      await this.separator('-');
      await this.bold(true);
      await this.text('VENTILATION PAIEMENTS');
      await this.newline();
      await this.bold(false);

      const payments = closure.payments || closure.byPayment || {};
      const payLabels = { cash: 'Especes', card: 'Carte', giftcard: 'Cadeaux', cheque: 'Cheques', avoir: 'Avoirs' };
      for (const [method, amount] of Object.entries(payments)) {
        await this.bold(true); await this.line(`  ${payLabels[method] || method}`, `${(typeof amount === 'number' ? amount : amount?.total || 0).toFixed(2)}€`); await this.bold(false);
      }

      if (closure.openingAmount !== undefined || closure.closingAmount !== undefined) {
        await this.separator('-');
        await this.bold(true);
        await this.line('Fond ouverture', `${(closure.openingAmount || 0).toFixed(2)}€`);
        await this.line('Fond fermeture', `${(closure.closingAmount || 0).toFixed(2)}€`);
        if (closure.cashDiff !== undefined) {
          await this.line('Ecart', `${closure.cashDiff.toFixed(2)}€`);
        }
        await this.bold(false);
      }

      await this.separator('=');

      // NF525
      await this.alignCenter();
      await this.bold(true);
      await this.text('EMPREINTE NF525');
      await this.newline();
      await this.text(closure.fingerprint || '—');
      await this.newline();
      await this.bold(false);

      await this.bold(true);
      await this.text(`${co.sw || 'CaissePro'} v${co.ver || '6.1.0'}`);
      await this.newline();
      await this.bold(false);

      await this.feed(4);
      await this.cut();

      this._emit('printed', { type: 'closure' });
      return true;
    } catch (e) {
      this._emit('error', { message: e.message });
      throw new Error(`Erreur impression cloture: ${e.message}`);
    }
  }

  // ── Print register opening ticket ──
  async printRegisterOpen(data, settings, companyInfo) {
    if (!this.connected) throw new Error("Imprimante non connectee");

    const s = settings || {};
    const co = companyInfo || {};

    try {
      await this.send(CMD.INIT);
      await this.send(CHARSET_FRENCH);
      await this.send(CODEPAGE_PC858);

      // Header
      await this.alignCenter();
      await this.doubleSize();
      await this.bold(true);
      await this.text(s.name || co.name || 'Ma Boutique');
      await this.newline();
      await this.normalSize();
      await this.bold(false);

      if (s.address) { await this.text(s.address); await this.newline(); }
      if (s.postalCode || s.city) {
        await this.text(`${s.postalCode || ''} ${s.city || ''}`);
        await this.newline();
      }
      if (s.phone) { await this.text(`Tel: ${s.phone}`); await this.newline(); }
      if (s.siret) { await this.text(`SIRET: ${s.siret}`); await this.newline(); }
      if (s.tvaIntra) { await this.text(`TVA: ${s.tvaIntra}`); await this.newline(); }

      await this.separator('=');

      await this.alignCenter();
      await this.doubleSize();
      await this.bold(true);
      await this.text('OUVERTURE DE CAISSE');
      await this.newline();
      await this.normalSize();
      await this.bold(false);

      await this.separator('=');

      // Session info
      await this.alignLeft();
      await this.line('Date', new Date(data.openDate || '').toLocaleString('fr-FR'));
      await this.line('Caissier', data.userName || '?');
      if (data.storeName) await this.line('Magasin', data.storeName);

      await this.separator('-');

      // Opening amount
      await this.alignCenter();
      await this.bold(true);
      await this.text('FOND DE CAISSE');
      await this.newline();
      await this.doubleSize();
      await this.text(`${(data.openingAmount || 0).toFixed(2)} EUR`);
      await this.newline();
      await this.normalSize();
      await this.bold(false);

      // Denomination detail if available
      if (data.denominations && Object.keys(data.denominations).length > 0) {
        await this.separator('-');
        await this.alignLeft();
        await this.fontSmall();
        await this.bold(true);
        await this.text('DETAIL DES COUPURES');
        await this.newline();
        await this.bold(false);
        const denoms = Object.entries(data.denominations)
          .filter(([, count]) => count > 0)
          .sort(([a], [b]) => parseFloat(b) - parseFloat(a));
        for (const [value, count] of denoms) {
          const v = parseFloat(value);
          const label = v >= 1 ? `${v.toFixed(0)} EUR` : `${(v * 100).toFixed(0)} cts`;
          await this.line(`  ${label} x ${count}`, `${(v * count).toFixed(2)} EUR`);
        }
        await this.fontNormal();
      }

      await this.separator('=');

      // Footer
      await this.alignCenter();
      await this.fontSmall();
      await this.text(`${co.sw || 'CaissePro'} v${co.ver || '6.1.0'}`);
      await this.newline();
      await this.text('Document obligatoire — A conserver');
      await this.newline();
      await this.fontNormal();

      await this.feed(4);
      await this.cut();

      this._emit('printed', { type: 'register-open' });
      return true;
    } catch (e) {
      this._emit('error', { message: e.message });
      throw new Error(`Erreur impression ouverture caisse: ${e.message}`);
    }
  }

  // ── Print register closing ticket ──
  async printRegisterClose(data, settings, companyInfo) {
    if (!this.connected) throw new Error("Imprimante non connectee");

    const s = settings || {};
    const co = companyInfo || {};

    try {
      await this.send(CMD.INIT);
      await this.send(CHARSET_FRENCH);
      await this.send(CODEPAGE_PC858);

      // Header
      await this.alignCenter();
      await this.doubleSize();
      await this.bold(true);
      await this.text(s.name || co.name || 'Ma Boutique');
      await this.newline();
      await this.normalSize();
      await this.bold(false);

      if (s.address) { await this.text(s.address); await this.newline(); }
      if (s.postalCode || s.city) {
        await this.text(`${s.postalCode || ''} ${s.city || ''}`);
        await this.newline();
      }
      if (s.phone) { await this.text(`Tel: ${s.phone}`); await this.newline(); }
      if (s.siret) { await this.text(`SIRET: ${s.siret}`); await this.newline(); }
      if (s.tvaIntra) { await this.text(`TVA: ${s.tvaIntra}`); await this.newline(); }

      await this.separator('=');

      await this.alignCenter();
      await this.doubleSize();
      await this.bold(true);
      await this.text('FERMETURE DE CAISSE');
      await this.newline();
      await this.normalSize();
      await this.bold(false);

      await this.separator('=');

      // Session info
      await this.alignLeft();
      await this.line('Date ouverture', new Date(data.openDate || '').toLocaleString('fr-FR'));
      await this.line('Date fermeture', new Date(data.closeDate || '').toLocaleString('fr-FR'));
      await this.line('Caissier', data.userName || '?');
      if (data.storeName) await this.line('Magasin', data.storeName);

      await this.separator('-');

      // Activity summary
      await this.bold(true);
      await this.text('ACTIVITE');
      await this.newline();
      await this.bold(false);
      await this.line('Nombre de tickets', String(data.ticketCount || 0));
      await this.line('Total HT', `${(data.totalHT || 0).toFixed(2)} EUR`);
      await this.line('Total TVA', `${(data.totalTVA || 0).toFixed(2)} EUR`);
      await this.bold(true);
      await this.line('Total TTC', `${(data.totalTTC || 0).toFixed(2)} EUR`);
      await this.bold(false);

      await this.separator('-');

      // Payment breakdown
      await this.bold(true);
      await this.text('VENTILATION PAIEMENTS');
      await this.newline();
      await this.bold(false);
      if (data.byPayment) {
        await this.line('Especes', `${(data.byPayment.cash || 0).toFixed(2)} EUR`);
        await this.line('Carte bancaire', `${(data.byPayment.card || 0).toFixed(2)} EUR`);
        if ((data.byPayment.cheque || 0) > 0) await this.line('Cheques', `${data.byPayment.cheque.toFixed(2)} EUR`);
        if ((data.byPayment.giftcard || 0) > 0) await this.line('Cartes cadeaux', `${data.byPayment.giftcard.toFixed(2)} EUR`);
        if ((data.byPayment.amex || 0) > 0) await this.line('American Express', `${data.byPayment.amex.toFixed(2)} EUR`);
        if ((data.byPayment.avoir || 0) > 0) await this.line('Avoirs utilises', `${data.byPayment.avoir.toFixed(2)} EUR`);
      }

      await this.separator('-');

      // Cash control
      await this.bold(true);
      await this.text('CONTROLE CAISSE');
      await this.newline();
      await this.bold(false);
      await this.line('Fond ouverture', `${(data.openingAmount || 0).toFixed(2)} EUR`);
      await this.line('+ Encaissements ESP', `${(data.byPayment?.cash || 0).toFixed(2)} EUR`);
      await this.bold(true);
      await this.line('= Especes attendues', `${(data.expectedCash || 0).toFixed(2)} EUR`);
      await this.bold(false);

      if (data.actualCash != null) {
        await this.line('Especes comptees', `${parseFloat(data.actualCash).toFixed(2)} EUR`);
        const cashDiff = parseFloat(data.actualCash) - (data.expectedCash || 0);
        await this.bold(true);
        await this.line('Ecart especes', `${cashDiff >= 0 ? '+' : ''}${cashDiff.toFixed(2)} EUR`);
        await this.bold(false);
      }

      if (data.actualCard != null) {
        await this.line('CB attendues', `${(data.byPayment?.card || 0).toFixed(2)} EUR`);
        await this.line('CB comptees', `${parseFloat(data.actualCard).toFixed(2)} EUR`);
        const cardDiff = parseFloat(data.actualCard) - (data.byPayment?.card || 0);
        await this.bold(true);
        await this.line('Ecart CB', `${cardDiff >= 0 ? '+' : ''}${cardDiff.toFixed(2)} EUR`);
        await this.bold(false);
      }

      // Returns
      if ((data.returnCount || 0) > 0 || (data.totalReturns || 0) > 0) {
        await this.separator('-');
        await this.bold(true);
        await this.text('RETOURS / AVOIRS');
        await this.newline();
        await this.bold(false);
        await this.line('Nombre d\'avoirs', String(data.returnCount || 0));
        await this.line('Total retours', `-${(data.totalReturns || 0).toFixed(2)} EUR`);
      }

      await this.separator('=');

      // Grand total
      await this.bold(true);
      await this.line('CA NET', `${(data.netRevenue || 0).toFixed(2)} EUR`);
      await this.doubleSize();
      await this.alignCenter();
      await this.text(`GT: ${(data.grandTotal || 0).toFixed(2)} EUR`);
      await this.newline();
      await this.normalSize();
      await this.bold(false);

      await this.separator('=');

      // Footer
      await this.alignCenter();
      await this.fontSmall();
      await this.text(`${co.sw || 'CaissePro'} v${co.ver || '6.1.0'}`);
      await this.newline();
      await this.text('Document obligatoire — A conserver');
      await this.newline();
      await this.fontNormal();

      await this.feed(4);
      await this.cut();

      this._emit('printed', { type: 'register-close' });
      return true;
    } catch (e) {
      this._emit('error', { message: e.message });
      throw new Error(`Erreur impression fermeture caisse: ${e.message}`);
    }
  }

  // ── Print retouche receipt (same format as sales receipt) ──
  async printTenue(tenue, settings, companyInfo) {
    if (!this.connected) throw new Error("Imprimante non connectee");
    const s = settings || {};
    const co = companyInfo || {};
    try {
      await this.send(CMD.INIT);
      await this.send(CHARSET_FRENCH);
      await this.send(CODEPAGE_PC858);
      // Header
      await this.alignCenter(); await this.doubleSize(); await this.bold(true);
      await this.text(s.name || co.name || 'Ma Boutique'); await this.newline();
      await this.normalSize(); await this.bold(false);
      if (s.address) { await this.text(s.address); await this.newline(); }
      if (s.postalCode || s.city) { await this.text(`${s.postalCode || ''} ${s.city || ''}`); await this.newline(); }
      if (s.siret) { await this.text(`SIRET: ${s.siret}`); await this.newline(); }
      await this.separator('=');
      // Title
      await this.alignCenter(); await this.doubleSize(); await this.bold(true);
      await this.text('BON DE TENUE EMPLOYE'); await this.newline();
      await this.normalSize(); await this.bold(false);
      await this.separator('=');
      // Info
      await this.alignLeft(); await this.bold(true);
      await this.line(`N° ${tenue.num}`, new Date(tenue.date || '').toLocaleString('fr-FR'));
      await this.line(`Employe: ${tenue.employee || '?'}`);
      await this.bold(false);
      await this.separator('-');
      // Items
      let totalQty = 0;
      for (const item of (tenue.items || [])) {
        const qty = parseInt(item.quantity, 10) || 1; totalQty += qty;
        const nm = item.productName || item.name || '?';
        const color = item.variantColor || ''; const sz = item.variantSize || '';
        const sku = item.sku || ''; const ean = item.ean || '';
        await this.bold(true); await this.text(nm); await this.newline(); await this.bold(false);
        if (color || sz) {
          let d = `  ${color}/${sz}`; if (sku) d += ` | Ref: ${sku}`;
          await this.text(d); await this.newline();
          if (ean) { await this.fontSmall(); await this.text(`  EAN: ${ean}`); await this.newline(); await this.fontNormal(); }
        }
        await this.bold(true); await this.line(`  x${qty}`); await this.bold(false);
      }
      await this.separator('-');
      // Total
      await this.bold(true); await this.doubleSize();
      await this.line('TOTAL', `${totalQty} pc`);
      await this.normalSize(); await this.bold(false);
      if (tenue.totalValue > 0) await this.line('Valeur (cout)', `${(tenue.totalValue || 0).toFixed(2)}€`);
      await this.separator('=');
      if (tenue.notes) { await this.bold(true); await this.text(`Notes: ${tenue.notes}`); await this.newline(); await this.bold(false); }
      // Barcode EAN-13
      if (tenue.barcode) { await this.newline(); await this.alignCenter(); await this.barcode(tenue.barcode); }
      await this.alignCenter(); await this.text('Justificatif de sortie de stock'); await this.newline();
      if (s.footerMsg || co.footerMsg) { await this.bold(true); await this.text(s.footerMsg || co.footerMsg); await this.newline(); await this.bold(false); }
      await this.feed(4); await this.cut();
      return true;
    } catch (e) { throw e; }
  }

  async printCashMovement(mv, settings, companyInfo) {
    if (!this.connected) throw new Error("Imprimante non connectee");
    const s = settings || {};
    const co = companyInfo || {};
    const isIn = mv.direction === 'in';
    const amt = parseFloat(mv.amount) || 0;
    await this.send(CMD.INIT);
    await this.send(CHARSET_FRENCH);
    await this.send(CODEPAGE_PC858);
    // Header
    await this.alignCenter(); await this.doubleSize(); await this.bold(true);
    await this.text(s.name || co.name || 'Ma Boutique'); await this.newline();
    await this.normalSize(); await this.bold(false);
    if (s.siret) { await this.text(`SIRET: ${s.siret}`); await this.newline(); }
    await this.separator('=');
    // Title
    await this.alignCenter(); await this.doubleSize(); await this.bold(true);
    await this.text(isIn ? 'APPORT DE CAISSE' : 'PRELEVEMENT CAISSE'); await this.newline();
    await this.normalSize(); await this.bold(false);
    await this.separator('=');
    // Info
    await this.alignLeft();
    await this.line(`N: ${mv.movement_number || mv.movementNumber || '-'}`, new Date(mv.date || mv.created_at || '').toLocaleString('fr-FR'));
    await this.line(`Operateur: ${mv.userName || mv.user_name || '?'}`);
    await this.text(`Motif: ${mv.reason || '-'}`); await this.newline();
    await this.separator('-');
    // Montant
    await this.bold(true); await this.doubleSize();
    await this.line(isIn ? 'MONTANT +' : 'MONTANT -', `${amt.toFixed(2)}€`);
    await this.normalSize(); await this.bold(false);
    await this.separator('=');
    // Barcode EAN-13
    if (mv.barcode) { await this.newline(); await this.alignCenter(); await this.barcode(mv.barcode); }
    await this.alignCenter(); await this.fontSmall(); await this.text('Mouvement hors CA - Conforme NF525'); await this.newline(); await this.fontNormal();
    await this.feed(4); await this.cut();
    return true;
  }

  async printRetouche(bon, settings, companyInfo) {
    if (!this.connected) throw new Error("Imprimante non connectee");

    const s = settings || {};
    const co = companyInfo || {};

    try {
      await this.send(CMD.INIT);
      await this.send(CHARSET_FRENCH);
      await this.send(CODEPAGE_PC858);

      // ── Header (identical to receipt) ──
      await this.alignCenter();
      await this.doubleSize();
      await this.bold(true);
      await this.text(s.name || co.name || 'Ma Boutique');
      await this.newline();
      await this.normalSize();
      await this.bold(false);

      if (s.address) { await this.text(s.address); await this.newline(); }
      if (s.postalCode || s.city) {
        await this.text(`${s.postalCode || ''} ${s.city || ''}`);
        await this.newline();
      }
      if (s.phone) { await this.text(`Tel: ${s.phone}`); await this.newline(); }
      if (s.siret) { await this.text(`SIRET: ${s.siret}`); await this.newline(); }
      if (s.tvaIntra) { await this.text(`TVA: ${s.tvaIntra}`); await this.newline(); }

      await this.separator('=');

      // ── Title ──
      await this.alignCenter();
      await this.doubleSize();
      await this.bold(true);
      await this.text('BON DE RETOUCHE');
      await this.newline();
      await this.normalSize();
      await this.bold(false);

      await this.separator('=');

      // ── Bon info ──
      await this.alignLeft();
      await this.bold(true);
      await this.line(`N° ${bon.num}`, new Date(bon.date || '').toLocaleString('fr-FR'));
      await this.bold(false);
      if (bon.seller) { await this.bold(true); await this.line(`Vendeur: ${bon.seller}`); await this.bold(false); }
      if (bon.client) { await this.bold(true); await this.line(`Client: ${bon.client}`); await this.bold(false); }
      if (bon.phone) { await this.bold(true); await this.line(`Tel: ${bon.phone}`); await this.bold(false); }

      await this.separator('-');

      // ── Date retrait ──
      if (bon.dateRetrait) {
        await this.bold(true);
        await this.alignCenter();
        await this.text(`RETRAIT: ${new Date(bon.dateRetrait).toLocaleDateString('fr-FR')}`);
        await this.newline();
        await this.bold(false);
        await this.alignLeft();
        await this.separator('-');
      }

      // ── Items (retouche services) ──
      const items = bon.items || [];
      const tvaRate = (s.retoucheTVA || 20) / 100;
      let totalTTC = 0;
      for (const item of items) {
        if (!item.desc) continue;
        const price = parseFloat(item.price) || 0;
        totalTTC += price;

        await this.bold(true);
        await this.text(`Retouche: ${item.desc}`);
        await this.newline();
        await this.bold(false);

        const ht = (price / (1 + tvaRate)).toFixed(2);
        await this.line(`  1 x ${price.toFixed(2)}€ TTC`, `${price.toFixed(2)}€`);
      }

      await this.separator('-');

      // ── Totals ──
      const totalHT = totalTTC / (1 + tvaRate);
      const totalTVA = totalTTC - totalHT;

      await this.bold(true);
      await this.line('Sous-total HT', `${totalHT.toFixed(2)}€`);
      await this.line(`TVA ${(tvaRate * 100).toFixed(1)}%`, `${totalTVA.toFixed(2)}€`);
      await this.bold(false);

      await this.bold(true);
      await this.doubleSize();
      await this.line('TOTAL TTC', `${totalTTC.toFixed(2)}€`);
      await this.normalSize();
      await this.bold(false);

      await this.separator('=');

      // ── Notes ──
      if (bon.notes) {
        await this.fontSmall();
        await this.text(`Notes: ${bon.notes}`);
        await this.newline();
        await this.fontNormal();
        await this.separator('-');
      }

      // ── Footer ──
      await this.alignCenter();
      await this.fontNormal();
      await this.bold(true);
      await this.text(`${co.sw || 'CaissePro'} v${co.ver || '6.1.0'}`);
      await this.newline();
      if (s.retoucheMsg) {
        await this.text(s.retoucheMsg);
        await this.newline();
      } else {
        await this.text(`Retrait prevu sous ${s.retoucheDelay || 5} jours ouvres`);
        await this.newline();
      }
      if (s.footerMsg || co.footerMsg) {
        await this.text(s.footerMsg || co.footerMsg);
        await this.newline();
      }
      await this.bold(false);

      // EAN-13 barcode
      if (bon.barcode) {
        await this.newline();
        await this.alignCenter();
        await this.barcode(bon.barcode);
      }

      await this.feed(4);
      await this.cut();

      this._emit('printed', { type: 'retouche', number: bon.num });
      return true;
    } catch (e) {
      this._emit('error', { message: e.message });
      throw new Error(`Erreur impression bon de retouche: ${e.message}`);
    }
  }

  // ── Print gift card receipt ──
  async printGiftCard(card, settings, companyInfo) {
    if (!this.connected) throw new Error("Imprimante non connectee");

    const s = settings || {};
    const co = companyInfo || {};

    try {
      await this.send(CMD.INIT);
      await this.send(CHARSET_FRENCH);
      await this.send(CODEPAGE_PC858);

      // Header
      await this.alignCenter();
      if (co.name) {
        await this.doubleSize();
        await this.bold(true);
        await this.text(co.name);
        await this.newline();
        await this.normalSize();
        await this.bold(false);
      }
      if (co.address) { await this.text(co.address); await this.newline(); }
      if (co.phone) { await this.text(`Tel: ${co.phone}`); await this.newline(); }
      if (co.siret) { await this.text(`SIRET: ${co.siret}`); await this.newline(); }

      await this.separator('=');
      await this.doubleSize();
      await this.bold(true);
      await this.text('CARTE CADEAU');
      await this.newline();
      await this.normalSize();
      await this.bold(false);
      await this.separator('=');

      // Card details
      await this.alignLeft();
      await this.bold(true);
      await this.text(`Code: ${card.code}`);
      await this.newline();

      await this.text(`Date: ${new Date(card.created_at).toLocaleDateString('fr-FR')}`);
      await this.newline();

      if (card.expires_at) {
        await this.text(`Expire: ${new Date(card.expires_at).toLocaleDateString('fr-FR')}`);
        await this.newline();
      }

      if (card.customer_name) {
        await this.text(`Client: ${card.customer_name}`);
        await this.newline();
      }
      await this.bold(false);

      await this.separator('-');

      await this.alignCenter();
      await this.doubleSize();
      await this.bold(true);
      await this.text(`${parseFloat(card.remaining || card.initial_amount).toFixed(2)} EUR`);
      await this.newline();
      await this.normalSize();
      await this.bold(false);

      if (card.initial_amount !== card.remaining) {
        await this.bold(true);
        await this.text(`Montant initial: ${parseFloat(card.initial_amount).toFixed(2)} EUR`);
        await this.newline();
        await this.bold(false);
      }

      await this.separator('-');

      await this.bold(true);
      await this.text('Presentez ce ticket pour utiliser');
      await this.newline();
      await this.text('votre carte cadeau en magasin.');
      await this.newline();
      await this.fontNormal();

      // EAN-13 barcode
      if (card.barcode) {
        await this.newline();
        await this.alignCenter();
        await this.barcode(card.barcode);
      }

      await this.feed(4);
      await this.cut();

      this._emit('printed', { type: 'giftcard', code: card.code });
      return true;
    } catch (e) {
      this._emit('error', { message: e.message });
      throw new Error(`Erreur impression carte cadeau: ${e.message}`);
    }
  }

  // ── Test print ──
  async testPrint() {
    if (!this.connected) throw new Error("Imprimante non connectee");

    await this.send(CMD.INIT);
    await this.send(CHARSET_FRENCH);
    await this.send(CODEPAGE_PC858);

    await this.alignCenter();
    await this.doubleSize();
    await this.bold(true);
    await this.text('TEST IMPRESSION');
    await this.newline();
    await this.normalSize();
    await this.bold(false);
    await this.separator('=');
    await this.alignLeft();
    await this.text('CaissePro - Imprimante thermique');
    await this.newline();
    await this.text(`Connexion: ${this.connectionType === 'serial' ? 'Serie (Web Serial)' : 'USB (WebUSB)'}`);
    await this.newline();
    await this.text(`Largeur papier: ${this.paperWidth} caracteres`);
    await this.newline();
    await this.text(`Date: ${new Date().toLocaleString('fr-FR')}`);
    await this.newline();
    await this.separator('-');
    await this.text('Caracteres francais:');
    await this.newline();
    await this.text('e e a c u o i E A - 0.50€');
    await this.newline();
    await this.separator('-');

    await this.bold(true);
    await this.text('Gras');
    await this.bold(false);
    await this.text(' / Normal / ');
    await this.fontSmall();
    await this.text('Petit');
    await this.fontNormal();
    await this.newline();

    await this.alignCenter();
    await this.doubleSize();
    await this.text('DOUBLE TAILLE');
    await this.newline();
    await this.normalSize();

    await this.separator('=');
    await this.text('Test OK !');
    await this.newline();

    await this.feed(4);
    await this.cut();

    this._emit('printed', { type: 'test' });
    return true;
  }
}

// Singleton instance
const printer = new ThermalPrinter();

export default printer;
export { ThermalPrinter, PAPER_48, PAPER_32 };
