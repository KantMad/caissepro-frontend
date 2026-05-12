// ═══════════════════════════════════════════════════════
// CaissePro — Hardware Abstraction Layer (HAL)
// Unified interface for all POS terminals
// ═══════════════════════════════════════════════════════

const HARDWARE_PROFILES = {
  sunmi: {
    id: 'sunmi',
    name: 'Sunmi (T2s, T2, T3, V2)',
    hasPrinter: true,
    hasDualScreen: true,  // T2s, T3 only
    hasCashDrawer: true,
    hasNFC: true,
    printerWidth: 48,     // 80mm
    detect: () => {
      const ua = navigator.userAgent || '';
      return ua.includes('Sunmi') ||
        typeof window.SunmiInnerPrinter !== 'undefined' ||
        typeof window.PrintService !== 'undefined';
    },
  },
  pax: {
    id: 'pax',
    name: 'PAX (A920, A930, E800)',
    hasPrinter: true,
    hasDualScreen: false,
    hasCashDrawer: false,
    hasNFC: true,
    printerWidth: 32,     // 58mm
    detect: () => {
      const ua = navigator.userAgent || '';
      return ua.includes('PAX') || typeof window.pax !== 'undefined';
    },
  },
  imin: {
    id: 'imin',
    name: 'iMin (D1, D2, D3, D4)',
    hasPrinter: true,
    hasDualScreen: true,  // D3, D4 only
    hasCashDrawer: true,
    hasNFC: true,
    printerWidth: 48,
    detect: () => {
      const ua = navigator.userAgent || '';
      return ua.includes('iMin') || typeof window.iminPrinter !== 'undefined';
    },
  },
  generic_android: {
    id: 'generic_android',
    name: 'Tablette Android + imprimante externe',
    hasPrinter: false,    // Must use external printer via BT/USB
    hasDualScreen: false,
    hasCashDrawer: false,
    hasNFC: false,
    printerWidth: 48,
    detect: () => /Android/i.test(navigator.userAgent),
  },
  desktop: {
    id: 'desktop',
    name: 'PC / Mac (navigateur)',
    hasPrinter: false,    // Uses Web Serial / WebUSB
    hasDualScreen: false,  // Uses window.open popup
    hasCashDrawer: false,
    hasNFC: false,
    printerWidth: 48,
    detect: () => !(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)),
  },
};

// ═══════════════════════════════════════════════════════
// Auto-detect hardware
// ═══════════════════════════════════════════════════════
function detectHardware() {
  // Priority order: specific POS > generic Android > desktop
  const order = ['sunmi', 'pax', 'imin', 'generic_android', 'desktop'];
  for (const id of order) {
    if (HARDWARE_PROFILES[id].detect()) return id;
  }
  return 'desktop';
}

// ═══════════════════════════════════════════════════════
// Sunmi Printer Adapter (via Capacitor bridge)
// ═══════════════════════════════════════════════════════
class SunmiPrinterAdapter {
  constructor() {
    this.connected = false;
    this._bridge = null;
  }

  async connect() {
    // Check for Capacitor Sunmi plugin or JS bridge
    if (window.Capacitor?.Plugins?.SunmiPrinter) {
      this._bridge = window.Capacitor.Plugins.SunmiPrinter;
    } else if (window.SunmiInnerPrinter) {
      this._bridge = window.SunmiInnerPrinter;
    } else if (window.PrintService) {
      this._bridge = window.PrintService;
    }

    if (this._bridge) {
      try {
        await this._call('printerInit');
        this.connected = true;
        return true;
      } catch (e) {
        console.warn('[Sunmi] Init failed:', e);
      }
    }

    // Fallback: check if Android bridge is available
    if (window.android?.printText) {
      this._bridge = window.android;
      this.connected = true;
      return true;
    }

    this.connected = false;
    return false;
  }

  async _call(method, ...args) {
    if (!this._bridge) throw new Error('Sunmi bridge non disponible');
    if (typeof this._bridge[method] === 'function') {
      return await this._bridge[method](...args);
    }
    // Capacitor plugin style
    if (this._bridge[method]) return await this._bridge[method](...args);
    throw new Error(`Methode ${method} non disponible`);
  }

  async printText(text) {
    try { await this._call('printText', text); } catch (e) {
      // Fallback: try printOriginalText or sendRAWData
      try { await this._call('printOriginalText', text); } catch (e2) {
        console.error('[Sunmi] printText failed:', e2);
      }
    }
  }

  async printReceipt(ticket, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};

    try {
      await this._call('printerInit');
      await this._call('setAlignment', 1); // center

      // Header - store name
      await this._call('setFontSize', 28);
      await this._call('setBold', true);
      await this.printText((s.name || co.name || 'Ma Boutique') + '\n');
      await this._call('setFontSize', 20);
      await this._call('setBold', false);

      if (s.address) await this.printText(s.address + '\n');
      if (s.postalCode || s.city) await this.printText(`${s.postalCode || ''} ${s.city || ''}\n`);
      if (s.phone) await this.printText(`Tel: ${s.phone}\n`);
      if (s.siret) await this.printText(`SIRET: ${s.siret}\n`);
      if (s.tvaIntra) await this.printText(`TVA: ${s.tvaIntra}\n`);

      await this.printText('================================================\n');

      // Ticket info
      await this._call('setAlignment', 0); // left
      await this._call('setBold', true);
      await this.printText(`N: ${ticket.ticketNumber}  ${new Date(ticket.date || ticket.createdAt || '').toLocaleString('fr-FR')}\n`);
      await this._call('setBold', false);
      await this.printText(`Caissier: ${ticket.userName || '?'}\n`);
      if (ticket.customerName) await this.printText(`Client: ${ticket.customerName}\n`);

      await this.printText('------------------------------------------------\n');

      // Items
      for (const item of (ticket.items || [])) {
        const name = item.product?.name || item.product_name || '?';
        const color = item.variant?.color || item.variant_color || '';
        const size = item.variant?.size || item.variant_size || '';
        const qty = item.quantity || 1;
        const isCustom = item.isCustom || item.is_custom;
        const lineTTC = item.lineTTC || item.line_ttc || (item.unit_price * qty);

        await this._call('setBold', true);
        await this.printText(`${name}${!isCustom && color ? ` (${color}/${size})` : ''}\n`);
        await this._call('setBold', false);
        await this.printText(`  x${qty}  ${lineTTC.toFixed(2)} EUR\n`);
      }

      await this.printText('------------------------------------------------\n');

      // Promos
      if (ticket.promosApplied?.length > 0) {
        for (const promo of ticket.promosApplied) {
          await this._call('setFontSize', 18);
          await this.printText(`  * ${promo}\n`);
          await this._call('setFontSize', 20);
        }
        await this.printText('------------------------------------------------\n');
      }

      // Totals
      await this.printText(`Total HT     ${(ticket.totalHT || 0).toFixed(2)} EUR\n`);
      await this.printText(`TVA          ${(ticket.totalTVA || 0).toFixed(2)} EUR\n`);
      await this._call('setBold', true);
      await this._call('setFontSize', 28);
      await this.printText(`TOTAL TTC    ${(ticket.totalTTC || 0).toFixed(2)} EUR\n`);
      await this._call('setFontSize', 20);
      await this._call('setBold', false);

      // Payment
      const ml = { cash: 'ESP', card: 'CB', amex: 'AMEX', giftcard: 'CAD', cheque: 'CHQ', avoir: 'AVOIR' };
      if (ticket.payments?.length) {
        const payStr = ticket.payments.map(p => `${ml[p.method] || p.method} ${p.amount.toFixed(2)} EUR`).join(' + ');
        await this.printText(`Paiement: ${payStr}\n`);
      }

      await this.printText('================================================\n');

      // NF525
      await this._call('setAlignment', 1);
      await this._call('setFontSize', 18);
      await this.printText('EMPREINTE NF525\n');
      await this._call('setFontSize', 22);
      await this._call('setBold', true);
      await this.printText(`${ticket.fingerprint || '-'}\n`);
      await this._call('setBold', false);

      // Footer
      await this._call('setFontSize', 16);
      await this.printText(`${co.sw || 'CaissePro'} v${co.ver || '6.0.0'} - Conforme NF525\n`);
      if (s.footerMsg || co.footerMsg) await this.printText(`${s.footerMsg || co.footerMsg}\n`);

      if (ticket.customerName) {
        await this.printText(`Fidelite: +${Math.floor(ticket.totalTTC || 0)}pts\n`);
      }

      // Feed and cut
      await this._call('lineWrap', 4);
      try { await this._call('cutPaper'); } catch (e) { /* some models don't support cut */ }

      return true;
    } catch (e) {
      console.error('[Sunmi] printReceipt error:', e);
      throw e;
    }
  }

  async printAvoir(avoir, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};
    try {
      await this._call('printerInit');
      await this._call('setAlignment', 1);
      await this._call('setFontSize', 28);
      await this._call('setBold', true);
      await this.printText('AVOIR / NOTE DE CREDIT\n');
      await this._call('setFontSize', 22);
      await this.printText((s.name || co.name || 'Ma Boutique') + '\n');
      await this._call('setBold', false);
      await this._call('setFontSize', 20);
      await this._call('setAlignment', 0);
      await this.printText('================================================\n');
      await this.printText(`N: ${avoir.avoirNumber}\n`);
      await this.printText(`Ticket original: ${avoir.originalTicket}\n`);
      await this.printText(`Date: ${new Date(avoir.date).toLocaleString('fr-FR')}\n`);
      await this.printText(`Motif: ${avoir.reason || 'Non specifie'}\n`);
      await this.printText('------------------------------------------------\n');
      for (const item of (avoir.items || [])) {
        const name = item.product?.name || '?';
        const v = item.variant ? ` (${item.variant.color}/${item.variant.size})` : '';
        await this.printText(`${name}${v} x${item.quantity}  -${(item.lineTTC || 0).toFixed(2)} EUR\n`);
      }
      await this.printText('------------------------------------------------\n');
      await this._call('setBold', true);
      await this._call('setFontSize', 28);
      await this.printText(`TOTAL AVOIR  -${(avoir.totalTTC || 0).toFixed(2)} EUR\n`);
      await this._call('setFontSize', 20);
      await this._call('setBold', false);
      await this.printText('================================================\n');
      await this._call('setAlignment', 1);
      await this._call('setFontSize', 18);
      await this.printText(`EMPREINTE NF525\n${avoir.fingerprint || '-'}\n`);
      await this._call('lineWrap', 4);
      try { await this._call('cutPaper'); } catch (e) {}
      return true;
    } catch (e) { throw e; }
  }

  async printClosure(closure, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};
    try {
      await this._call('printerInit');
      await this._call('setAlignment', 1);
      await this._call('setFontSize', 28);
      await this._call('setBold', true);
      await this.printText('CLOTURE DE CAISSE\n');
      await this._call('setFontSize', 22);
      await this.printText((s.name || co.name) + '\n');
      await this._call('setBold', false);
      await this._call('setFontSize', 20);
      await this._call('setAlignment', 0);
      await this.printText('================================================\n');
      await this.printText(`Date: ${new Date(closure.date || closure.closedAt).toLocaleString('fr-FR')}\n`);
      await this.printText(`Caissier: ${closure.userName || '?'}\n`);
      await this.printText('------------------------------------------------\n');
      await this._call('setBold', true);
      await this.printText(`CA TTC       ${(closure.totalTTC || closure.totalCA || 0).toFixed(2)} EUR\n`);
      await this._call('setBold', false);
      await this.printText(`Total HT     ${(closure.totalHT || 0).toFixed(2)} EUR\n`);
      await this.printText(`Total TVA    ${(closure.totalTVA || 0).toFixed(2)} EUR\n`);
      await this.printText(`Nb ventes    ${closure.salesCount || closure.nbSales || 0}\n`);
      await this.printText(`Panier moyen ${(closure.avgBasket || 0).toFixed(2)} EUR\n`);
      await this.printText('================================================\n');
      await this._call('setAlignment', 1);
      await this._call('setFontSize', 18);
      await this.printText(`EMPREINTE NF525\n${closure.fingerprint || '-'}\n`);
      await this._call('lineWrap', 4);
      try { await this._call('cutPaper'); } catch (e) {}
      return true;
    } catch (e) { throw e; }
  }

  async testPrint() {
    try {
      await this._call('printerInit');
      await this._call('setAlignment', 1);
      await this._call('setFontSize', 28);
      await this._call('setBold', true);
      await this.printText('TEST IMPRESSION\n');
      await this._call('setFontSize', 20);
      await this._call('setBold', false);
      await this.printText('================================================\n');
      await this._call('setAlignment', 0);
      await this.printText('CaissePro - Imprimante Sunmi\n');
      await this.printText(`Date: ${new Date().toLocaleString('fr-FR')}\n`);
      await this.printText('Caracteres: EUR a e c u o\n');
      await this.printText('================================================\n');
      await this._call('setAlignment', 1);
      await this.printText('Test OK !\n');
      await this._call('lineWrap', 4);
      try { await this._call('cutPaper'); } catch (e) {}
      return true;
    } catch (e) { throw e; }
  }

  async openDrawer() {
    try { await this._call('openDrawer'); } catch (e) {
      console.warn('[Sunmi] openDrawer not available');
    }
  }

  disconnect() { this.connected = false; }
}

// ═══════════════════════════════════════════════════════
// PAX Printer Adapter
// ═══════════════════════════════════════════════════════
class PAXPrinterAdapter {
  constructor() { this.connected = false; this._bridge = null; }

  async connect() {
    if (window.Capacitor?.Plugins?.PAXPrinter) {
      this._bridge = window.Capacitor.Plugins.PAXPrinter;
    } else if (window.pax?.printer) {
      this._bridge = window.pax.printer;
    }
    if (this._bridge) { this.connected = true; return true; }
    return false;
  }

  async printText(text) {
    if (this._bridge?.printStr) await this._bridge.printStr(text);
    else if (this._bridge?.printText) await this._bridge.printText(text);
  }

  // PAX uses same receipt logic, delegate to text-based printing
  async printReceipt(ticket, settings, companyInfo) {
    return await _textBasedPrint(this, 'receipt', ticket, settings, companyInfo, 32);
  }
  async printAvoir(avoir, settings, companyInfo) {
    return await _textBasedPrint(this, 'avoir', avoir, settings, companyInfo, 32);
  }
  async printClosure(closure, settings, companyInfo) {
    return await _textBasedPrint(this, 'closure', closure, settings, companyInfo, 32);
  }
  async testPrint() {
    await this.printText('=== TEST CaissePro ===\n');
    await this.printText(`PAX Printer OK\n${new Date().toLocaleString('fr-FR')}\n\n\n`);
    return true;
  }
  async openDrawer() { /* PAX generally no cash drawer */ }
  disconnect() { this.connected = false; }
}

// ═══════════════════════════════════════════════════════
// iMin Printer Adapter
// ═══════════════════════════════════════════════════════
class iMinPrinterAdapter {
  constructor() { this.connected = false; this._bridge = null; }

  async connect() {
    if (window.Capacitor?.Plugins?.iMinPrinter) {
      this._bridge = window.Capacitor.Plugins.iMinPrinter;
    } else if (window.iminPrinter) {
      this._bridge = window.iminPrinter;
    }
    if (this._bridge) { this.connected = true; return true; }
    return false;
  }

  async printText(text) {
    if (this._bridge?.printText) await this._bridge.printText(text);
  }

  async printReceipt(ticket, settings, companyInfo) {
    return await _textBasedPrint(this, 'receipt', ticket, settings, companyInfo, 48);
  }
  async printAvoir(avoir, s, co) { return await _textBasedPrint(this, 'avoir', avoir, s, co, 48); }
  async printClosure(c, s, co) { return await _textBasedPrint(this, 'closure', c, s, co, 48); }
  async testPrint() {
    await this.printText('=== TEST CaissePro ===\n');
    await this.printText(`iMin Printer OK\n${new Date().toLocaleString('fr-FR')}\n\n\n`);
    return true;
  }
  async openDrawer() { try { await this._bridge?.openDrawer(); } catch (e) {} }
  disconnect() { this.connected = false; }
}

// ═══════════════════════════════════════════════════════
// Browser Fallback (iframe print)
// ═══════════════════════════════════════════════════════
class BrowserPrintAdapter {
  constructor() { this.connected = true; } // Always "connected"

  async connect() { this.connected = true; return true; }

  _printViaIframe(html) {
    let iframe = document.getElementById('__print_iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = '__print_iframe';
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:0;border:none;visibility:hidden;';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;font-size:11px;padding:4px;width:72mm;max-width:72mm;color:#000}
      .bold{font-weight:bold}.center{text-align:center}.big{font-size:16px}.small{font-size:9px}
      .sep{border-top:1px dashed #000;margin:4px 0}.row{display:flex;justify-content:space-between}
      @media print{@page{size:72mm auto;margin:2mm}body{padding:0}}
    </style></head><body>${html}</body></html>`);
    doc.close();
    return new Promise(r => {
      setTimeout(() => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { window.print(); }
        r(true);
      }, 250);
    });
  }

  async printReceipt(ticket, settings, companyInfo) {
    // Try to use existing data-print-receipt element
    const el = document.querySelector('[data-print-receipt]');
    if (el) return this._printViaIframe(el.innerHTML);
    // Fallback: generate receipt HTML
    return this._printViaIframe(_generateReceiptHTML(ticket, settings, companyInfo));
  }

  async printAvoir(avoir, settings, companyInfo) {
    const el = document.querySelector('[data-print-receipt]');
    if (el) return this._printViaIframe(el.innerHTML);
    return this._printViaIframe(`<div class="center bold big">AVOIR</div><div class="center">${avoir.avoirNumber}</div><div class="sep"></div><div class="center bold big">${(avoir.totalTTC||0).toFixed(2)} EUR</div>`);
  }

  async printClosure(closure, settings, companyInfo) {
    const el = document.querySelector('[data-print-receipt]');
    if (el) return this._printViaIframe(el.innerHTML);
    return this._printViaIframe(`<div class="center bold big">CLOTURE</div><div class="sep"></div><div class="bold">CA TTC: ${(closure.totalTTC||closure.totalCA||0).toFixed(2)} EUR</div>`);
  }

  async testPrint() {
    return this._printViaIframe('<div class="center bold big">TEST IMPRESSION</div><div class="sep"></div><div class="center">CaissePro OK</div>');
  }

  async openDrawer() { console.warn('[Browser] Cash drawer not supported'); }
  disconnect() {}
}

// ═══════════════════════════════════════════════════════
// Text-based receipt generator (for PAX/iMin/generic)
// ═══════════════════════════════════════════════════════
async function _textBasedPrint(adapter, type, data, settings, companyInfo, width) {
  const s = settings || {};
  const co = companyInfo || {};
  const sep = '='.repeat(width);
  const dsep = '-'.repeat(width);
  const pad = (l, r) => { const sp = width - l.length - r.length; return l + (sp > 0 ? ' '.repeat(sp) : ' ') + r; };

  let lines = [];
  if (type === 'receipt') {
    lines.push((s.name || co.name || 'Ma Boutique'));
    if (s.address) lines.push(s.address);
    if (s.siret) lines.push(`SIRET: ${s.siret}`);
    lines.push(sep);
    lines.push(`N: ${data.ticketNumber}  ${new Date(data.date || data.createdAt || '').toLocaleString('fr-FR')}`);
    lines.push(`Caissier: ${data.userName || '?'}`);
    if (data.customerName) lines.push(`Client: ${data.customerName}`);
    lines.push(dsep);
    for (const item of (data.items || [])) {
      const name = item.product?.name || item.product_name || '?';
      const qty = item.quantity || 1;
      const ttc = item.lineTTC || item.line_ttc || (item.unit_price * qty);
      lines.push(pad(`${name} x${qty}`, `${ttc.toFixed(2)}E`));
    }
    lines.push(dsep);
    lines.push(pad('Total HT', `${(data.totalHT || 0).toFixed(2)}E`));
    lines.push(pad('TVA', `${(data.totalTVA || 0).toFixed(2)}E`));
    lines.push(pad('TOTAL TTC', `${(data.totalTTC || 0).toFixed(2)}E`));
    lines.push(sep);
    lines.push(`NF525: ${data.fingerprint || '-'}`);
  }

  const fullText = lines.join('\n') + '\n\n\n\n';
  await adapter.printText(fullText);
  return true;
}

// ═══════════════════════════════════════════════════════
// Generate receipt HTML (fallback for browser)
// ═══════════════════════════════════════════════════════
function _generateReceiptHTML(ticket, settings, companyInfo) {
  const s = settings || {};
  const co = companyInfo || {};
  let h = `<div class="center bold big">${s.name || co.name || 'Ma Boutique'}</div>`;
  if (s.address) h += `<div class="center">${s.address}</div>`;
  if (s.siret) h += `<div class="center small">SIRET: ${s.siret}</div>`;
  h += '<div class="sep"></div>';
  h += `<div class="row"><span class="bold">N: ${ticket.ticketNumber}</span><span>${new Date(ticket.date || ticket.createdAt || '').toLocaleString('fr-FR')}</span></div>`;
  h += `<div>Caissier: ${ticket.userName || '?'}</div>`;
  h += '<div class="sep"></div>';
  for (const item of (ticket.items || [])) {
    const name = item.product?.name || item.product_name || '?';
    const ttc = item.lineTTC || item.line_ttc || ((item.unit_price || 0) * (item.quantity || 1));
    h += `<div class="row"><span>${name} x${item.quantity || 1}</span><span>${ttc.toFixed(2)}EUR</span></div>`;
  }
  h += '<div class="sep"></div>';
  h += `<div class="row bold big"><span>TOTAL TTC</span><span>${(ticket.totalTTC || 0).toFixed(2)}EUR</span></div>`;
  h += '<div class="sep"></div>';
  h += `<div class="center small">NF525: ${ticket.fingerprint || '-'}</div>`;
  return h;
}

// ═══════════════════════════════════════════════════════
// Dual Screen Adapter (customer display)
// ═══════════════════════════════════════════════════════
class DualScreenAdapter {
  constructor(hardwareId) {
    this.hardwareId = hardwareId;
    this._ref = null;
  }

  get isSupported() {
    if (this.hardwareId === 'sunmi' || this.hardwareId === 'imin') {
      // Dual screen only in native wrapper (Capacitor)
      return !!window.Capacitor?.Plugins?.DualScreen;
    }
    // Desktop: popup
    return this.hardwareId === 'desktop';
  }

  async show(htmlContent) {
    if (this.hardwareId === 'desktop') {
      return this._showPopup(htmlContent);
    }
    // Capacitor dual screen plugin
    if (window.Capacitor?.Plugins?.DualScreen) {
      return await window.Capacitor.Plugins.DualScreen.show({ html: htmlContent });
    }
    return false;
  }

  _showPopup(htmlContent) {
    if (this._ref && !this._ref.closed) {
      this._ref.document.body.innerHTML = htmlContent;
      return true;
    }
    this._ref = window.open('', 'CaisseProClient', 'width=800,height=600,menubar=no,toolbar=no');
    if (!this._ref) return false;
    this._ref.document.write(`<!DOCTYPE html><html><head><title>Ecran Client</title></head><body>${htmlContent}</body></html>`);
    this._ref.document.close();
    return true;
  }
}

// ═══════════════════════════════════════════════════════
// Main Hardware Manager
// ═══════════════════════════════════════════════════════
class HardwareManager {
  constructor() {
    this._hardwareId = null;
    this._printer = null;
    this._dualScreen = null;
    this._listeners = new Set();
  }

  get profiles() { return HARDWARE_PROFILES; }
  get currentId() { return this._hardwareId; }
  get currentProfile() { return HARDWARE_PROFILES[this._hardwareId]; }
  get printer() { return this._printer; }
  get dualScreen() { return this._dualScreen; }

  on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(event, data) { this._listeners.forEach(fn => fn(event, data)); }

  // Initialize with auto-detect or saved preference
  init() {
    const saved = localStorage.getItem('caissepro_hardware');
    this._hardwareId = saved || detectHardware();
    this._initAdapters();
    console.log(`[HAL] Hardware: ${this._hardwareId} (${this.currentProfile?.name})`);
    return this._hardwareId;
  }

  // Switch hardware manually
  setHardware(id) {
    if (!HARDWARE_PROFILES[id]) throw new Error(`Hardware inconnu: ${id}`);
    this._hardwareId = id;
    localStorage.setItem('caissepro_hardware', id);
    this._initAdapters();
    this._emit('hardware-changed', { id, profile: this.currentProfile });
  }

  _initAdapters() {
    switch (this._hardwareId) {
      case 'sunmi':
        this._printer = new SunmiPrinterAdapter();
        break;
      case 'pax':
        this._printer = new PAXPrinterAdapter();
        break;
      case 'imin':
        this._printer = new iMinPrinterAdapter();
        break;
      default:
        this._printer = new BrowserPrintAdapter();
    }
    this._dualScreen = new DualScreenAdapter(this._hardwareId);
  }

  // Auto-connect printer
  async connectPrinter() {
    if (!this._printer) return false;
    const ok = await this._printer.connect();
    this._emit('printer-status', { connected: ok });
    return ok;
  }
}

// Singleton
const hardwareManager = new HardwareManager();

export default hardwareManager;
export {
  HardwareManager,
  HARDWARE_PROFILES,
  detectHardware,
  SunmiPrinterAdapter,
  PAXPrinterAdapter,
  iMinPrinterAdapter,
  BrowserPrintAdapter,
  DualScreenAdapter,
};
