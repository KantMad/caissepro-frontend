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
    this.connectionType = null; // 'serial' | 'usb'
    this.usbDevice = null;
    this.paperWidth = PAPER_48; // Default 80mm
    this.encoding = 'pc858';
    this._listeners = new Set();
  }

  // ── Event system ──
  on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(event, data) { this._listeners.forEach(fn => fn(event, data)); }

  // ── Connection ──
  get isSupported() {
    return !!navigator.serial || !!navigator.usb;
  }
  get serialSupported() { return !!navigator.serial; }
  get usbSupported() { return !!navigator.usb; }

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
          { vendorId: 0x04B8 }, // Epson
          { vendorId: 0x0519 }, // Star Micronics
          { vendorId: 0x0DD4 }, // Custom
          { vendorId: 0x0416 }, // Bixolon
          { vendorId: 0x0FE6 }, // Kontron/ICS
          { vendorId: 0x1FC9 }, // NXP (generic printers)
          { vendorId: 0x20D1 }, // Xiamen
          { vendorId: 0x0483 }, // STMicroelectronics (used in some printers)
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

  async disconnect() {
    try {
      if (this.connectionType === 'serial' && this.port) {
        if (this.writer) { this.writer.releaseLock(); this.writer = null; }
        await this.port.close();
        this.port = null;
      } else if (this.connectionType === 'usb' && this.usbDevice) {
        await this.usbDevice.close();
        this.usbDevice = null;
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
    if (data && data.length === 13) {
      await this.send(CMD.BARCODE_HEIGHT(50));
      await this.send(CMD.BARCODE_WIDTH(2));
      await this.send(CMD.BARCODE_TEXT_BELOW);
      await this.send(CMD.ALIGN_CENTER);
      await this.send([...CMD.BARCODE_EAN13, ...this._encode(data), 0x00]);
      await this.newline();
    }
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

      // ── Ticket info ──
      await this.alignLeft();
      await this.bold(true);
      await this.line(`N° ${ticket.ticketNumber}`, new Date(ticket.date || ticket.createdAt || '').toLocaleString('fr-FR'));
      await this.bold(false);
      await this.line(`Caissier: ${ticket.userName || '?'}`);
      if (ticket.customerName) await this.line(`Client: ${ticket.customerName}`);

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

        // Variant details
        if (!isCustom && (color || size)) {
          await this.fontSmall();
          let detail = `  ${color}/${size}`;
          if (sku) detail += ` | Ref: ${sku}`;
          if (ean) detail += ` | EAN: ${ean}`;
          await this.text(detail);
          await this.newline();
          await this.fontNormal();
        }

        // Qty x price line
        const unitPrice = lineTTC / qty;
        let qtyLine = `  ${qty} x ${unitPrice.toFixed(2)}€`;
        if (discount > 0) qtyLine += ` (-${discount}%)`;
        const total = discount > 0 ? (lineTTC * (1 - discount / 100)).toFixed(2) : lineTTC.toFixed(2);
        await this.line(qtyLine, `${total}€`);
      }

      await this.separator('-');

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
      await this.line('Sous-total HT', `${(ticket.totalHT || 0).toFixed(2)}€`);
      await this.line('TVA', `${(ticket.totalTVA || 0).toFixed(2)}€`);

      if (ticket.globalDiscount > 0) {
        await this.line('Remise', `-${ticket.globalDiscount.toFixed(2)}€`);
      }

      await this.bold(true);
      await this.doubleSize();
      await this.line('TOTAL TTC', `${(ticket.totalTTC || 0).toFixed(2)}€`);
      await this.normalSize();
      await this.bold(false);

      await this.separator('-');

      // ── Payment ──
      const methodLabels = { cash: 'ESP', card: 'CB', giftcard: 'CAD', cheque: 'CHQ', avoir: 'AVOIR' };
      if (ticket.payments?.length) {
        const payStr = ticket.payments.map(p => `${methodLabels[p.method] || p.method} ${p.amount.toFixed(2)}€`).join(' + ');
        await this.line('Paiement:', payStr);
      }

      // Cash change
      if (ticket.paymentMethod === 'cash' && ticket.cashGiven > 0) {
        await this.line('Recu:', `${ticket.cashGiven.toFixed(2)}€`);
        await this.line('Rendu:', `${(ticket.cashGiven - (ticket.totalTTC || 0)).toFixed(2)}€`);
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

      // ── Footer ──
      await this.alignCenter();
      await this.fontSmall();
      await this.text(`${co.sw || 'CaissePro'} v${co.ver || '5.0.0'}`);
      await this.newline();
      await this.text('Garantie legale 2 ans');
      await this.newline();
      if (s.footerMsg || co.footerMsg) {
        await this.text(s.footerMsg || co.footerMsg);
        await this.newline();
      }

      if (ticket.saleNote) {
        await this.newline();
        await this.text(`Note: ${ticket.saleNote}`);
        await this.newline();
      }

      if (ticket.customerName) {
        await this.newline();
        await this.bold(true);
        await this.text(`Fidelite: +${Math.floor(ticket.totalTTC || 0)}pts`);
        await this.newline();
        await this.bold(false);
      }

      await this.fontNormal();

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

      await this.line(`N° ${avoir.avoirNumber}`);
      await this.line(`Ticket original: ${avoir.originalTicket}`);
      await this.line(`Date: ${new Date(avoir.date).toLocaleString('fr-FR')}`);
      if (avoir.userName) await this.line(`Caissier: ${avoir.userName}`);
      if (avoir.customerName) await this.line(`Client: ${avoir.customerName}`);
      await this.line(`Motif: ${avoir.reason || 'Non specifie'}`);

      await this.separator('-');

      // Items
      for (const item of (avoir.items || [])) {
        const name = item.product?.name || '?';
        const sku = item.product?.sku || '';
        const variant = item.variant ? ` (${item.variant.color}/${item.variant.size})` : '';
        await this.line(`${name}${variant} x${item.quantity}`, `-${(item.lineTTC || 0).toFixed(2)}€`);
        if (sku) { await this.fontSmall(); await this.line(`  Ref: ${sku}`); await this.fontNormal(); }
      }

      await this.separator('-');

      // Total
      await this.bold(true);
      await this.doubleSize();
      const refundLabels = { cash: 'Especes', card: 'Carte bancaire', avoir: 'Avoir client' };
      await this.line('TOTAL AVOIR', `-${(avoir.totalTTC || 0).toFixed(2)}€`);
      await this.normalSize();
      await this.bold(false);
      await this.line('Remboursement:', refundLabels[avoir.refundMethod] || avoir.refundMethod);

      await this.separator('=');

      // NF525
      await this.alignCenter();
      await this.fontSmall();
      await this.bold(true);
      await this.text('EMPREINTE NF525');
      await this.newline();
      await this.fontNormal();
      await this.text(avoir.fingerprint || '—');
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

      await this.line(`N° ${closure.closureNumber || closure.zNumber || '?'}`);
      await this.line(`Date: ${new Date(closure.date || closure.closedAt).toLocaleString('fr-FR')}`);
      await this.line(`Caissier: ${closure.userName || '?'}`);

      await this.separator('-');

      await this.bold(true);
      await this.line('CA TTC', `${(closure.totalTTC || closure.totalCA || 0).toFixed(2)}€`);
      await this.bold(false);
      await this.line('Total HT', `${(closure.totalHT || 0).toFixed(2)}€`);
      await this.line('Total TVA', `${(closure.totalTVA || 0).toFixed(2)}€`);
      await this.line('Nb ventes', `${closure.salesCount || closure.nbSales || 0}`);
      await this.line('Panier moyen', `${(closure.avgBasket || 0).toFixed(2)}€`);

      await this.separator('-');
      await this.bold(true);
      await this.text('VENTILATION PAIEMENTS');
      await this.newline();
      await this.bold(false);

      const payments = closure.payments || closure.byPayment || {};
      const payLabels = { cash: 'Especes', card: 'Carte', giftcard: 'Cadeaux', cheque: 'Cheques', avoir: 'Avoirs' };
      for (const [method, amount] of Object.entries(payments)) {
        await this.line(`  ${payLabels[method] || method}`, `${(typeof amount === 'number' ? amount : amount?.total || 0).toFixed(2)}€`);
      }

      if (closure.openingAmount !== undefined || closure.closingAmount !== undefined) {
        await this.separator('-');
        await this.line('Fond ouverture', `${(closure.openingAmount || 0).toFixed(2)}€`);
        await this.line('Fond fermeture', `${(closure.closingAmount || 0).toFixed(2)}€`);
        if (closure.cashDiff !== undefined) {
          await this.line('Ecart', `${closure.cashDiff.toFixed(2)}€`);
        }
      }

      await this.separator('=');

      // NF525
      await this.alignCenter();
      await this.fontSmall();
      await this.bold(true);
      await this.text('EMPREINTE NF525');
      await this.newline();
      await this.fontNormal();
      await this.text(closure.fingerprint || '—');
      await this.newline();
      await this.bold(false);

      await this.fontSmall();
      await this.text(`${co.sw || 'CaissePro'} v${co.ver || '5.0.0'}`);
      await this.newline();
      await this.fontNormal();

      await this.feed(4);
      await this.cut();

      this._emit('printed', { type: 'closure' });
      return true;
    } catch (e) {
      this._emit('error', { message: e.message });
      throw new Error(`Erreur impression cloture: ${e.message}`);
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
