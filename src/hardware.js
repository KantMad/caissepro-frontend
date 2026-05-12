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
    this._isCapacitor = false;
    // Check for Capacitor Sunmi plugin
    if (window.Capacitor?.Plugins?.SunmiPrinter) {
      this._bridge = window.Capacitor.Plugins.SunmiPrinter;
      this._isCapacitor = true;
    } else if (window.SunmiInnerPrinter) {
      this._bridge = window.SunmiInnerPrinter;
    } else if (window.PrintService) {
      this._bridge = window.PrintService;
    }

    if (this._bridge) {
      try {
        await this._cap('printerInit', {});
        this.connected = true;
        console.log('[Sunmi] Printer connected via', this._isCapacitor ? 'Capacitor plugin' : 'JS bridge');
        return true;
      } catch (e) {
        console.warn('[Sunmi] Init failed:', e);
      }
    }

    // Fallback: check if Android bridge is available
    if (window.android?.printText) {
      this._bridge = window.android;
      this.connected = true;
      console.log('[Sunmi] Printer connected via Android bridge');
      return true;
    }

    this.connected = false;
    return false;
  }

  // Capacitor plugins REQUIRE a single object argument — never positional args
  async _cap(method, params) {
    if (!this._bridge) throw new Error('Sunmi bridge non disponible');
    if (this._isCapacitor) {
      // Capacitor: always pass an object
      return await this._bridge[method](params || {});
    }
    // Legacy JS bridge: pass raw values
    if (typeof this._bridge[method] === 'function') {
      const vals = params ? Object.values(params) : [];
      return await this._bridge[method](...vals);
    }
    throw new Error(`Methode ${method} non disponible`);
  }

  async printText(text) {
    try { await this._cap('printText', { text }); } catch (e) {
      try { await this._cap('printOriginalText', { text }); } catch (e2) {
        console.error('[Sunmi] printText failed:', e2);
      }
    }
  }

  async printReceipt(ticket, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};

    try {
      await this._cap('printerInit', {});
      await this._cap('setAlignment', { alignment: 1 }); // center

      // Header - store name
      await this._cap('setFontSize', { size: 28 });
      await this._cap('setBold', { bold: true });
      await this.printText((s.name || co.name || 'Ma Boutique') + '\n');
      await this._cap('setFontSize', { size: 20 });
      await this._cap('setBold', { bold: false });

      if (s.address) await this.printText(s.address + '\n');
      if (s.postalCode || s.city) await this.printText(`${s.postalCode || ''} ${s.city || ''}\n`);
      if (s.phone) await this.printText(`Tel: ${s.phone}\n`);
      if (s.siret) await this.printText(`SIRET: ${s.siret}\n`);
      if (s.tvaIntra) await this.printText(`TVA: ${s.tvaIntra}\n`);

      await this.printText('================================================\n');

      // Ticket info
      await this._cap('setAlignment', { alignment: 0 }); // left
      await this._cap('setBold', { bold: true });
      await this.printText(`N: ${ticket.ticketNumber}  ${new Date(ticket.date || ticket.createdAt || '').toLocaleString('fr-FR')}\n`);
      await this._cap('setBold', { bold: false });
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

        await this._cap('setBold', { bold: true });
        await this.printText(`${name}${!isCustom && color ? ` (${color}/${size})` : ''}\n`);
        await this._cap('setBold', { bold: false });
        await this.printText(`  x${qty}  ${lineTTC.toFixed(2)} EUR\n`);
      }

      await this.printText('------------------------------------------------\n');

      // Promos
      if (ticket.promosApplied?.length > 0) {
        for (const promo of ticket.promosApplied) {
          await this._cap('setFontSize', { size: 18 });
          await this.printText(`  * ${promo}\n`);
          await this._cap('setFontSize', { size: 20 });
        }
        await this.printText('------------------------------------------------\n');
      }

      // Totals
      await this.printText(`Total HT     ${(ticket.totalHT || 0).toFixed(2)} EUR\n`);
      await this.printText(`TVA          ${(ticket.totalTVA || 0).toFixed(2)} EUR\n`);
      await this._cap('setBold', { bold: true });
      await this._cap('setFontSize', { size: 28 });
      await this.printText(`TOTAL TTC    ${(ticket.totalTTC || 0).toFixed(2)} EUR\n`);
      await this._cap('setFontSize', { size: 20 });
      await this._cap('setBold', { bold: false });

      // Payment
      const ml = { cash: 'ESP', card: 'CB', amex: 'AMEX', giftcard: 'CAD', cheque: 'CHQ', avoir: 'AVOIR' };
      if (ticket.payments?.length) {
        const payStr = ticket.payments.map(p => `${ml[p.method] || p.method} ${p.amount.toFixed(2)} EUR`).join(' + ');
        await this.printText(`Paiement: ${payStr}\n`);
      }

      await this.printText('================================================\n');

      // NF525
      await this._cap('setAlignment', { alignment: 1 });
      await this._cap('setFontSize', { size: 18 });
      await this.printText('EMPREINTE NF525\n');
      await this._cap('setFontSize', { size: 22 });
      await this._cap('setBold', { bold: true });
      await this.printText(`${ticket.fingerprint || '-'}\n`);
      await this._cap('setBold', { bold: false });

      // Footer
      await this._cap('setFontSize', { size: 16 });
      await this.printText(`${co.sw || 'CaissePro'} v${co.ver || '6.0.0'} - Conforme NF525\n`);
      if (s.footerMsg || co.footerMsg) await this.printText(`${s.footerMsg || co.footerMsg}\n`);

      if (ticket.customerName) {
        await this.printText(`Fidelite: +${Math.floor(ticket.totalTTC || 0)}pts\n`);
      }

      // Feed and cut
      await this._cap('lineWrap', { lines: 4 });
      try { await this._cap('cutPaper', {}); } catch (e) { /* some models don't support cut */ }

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
      await this._cap('printerInit', {});
      await this._cap('setAlignment', { alignment: 1 });
      await this._cap('setFontSize', { size: 28 });
      await this._cap('setBold', { bold: true });
      await this.printText('AVOIR / NOTE DE CREDIT\n');
      await this._cap('setFontSize', { size: 22 });
      await this.printText((s.name || co.name || 'Ma Boutique') + '\n');
      await this._cap('setBold', { bold: false });
      await this._cap('setFontSize', { size: 20 });
      await this._cap('setAlignment', { alignment: 0 });
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
      await this._cap('setBold', { bold: true });
      await this._cap('setFontSize', { size: 28 });
      await this.printText(`TOTAL AVOIR  -${(avoir.totalTTC || 0).toFixed(2)} EUR\n`);
      await this._cap('setFontSize', { size: 20 });
      await this._cap('setBold', { bold: false });
      await this.printText('================================================\n');
      await this._cap('setAlignment', { alignment: 1 });
      await this._cap('setFontSize', { size: 18 });
      await this.printText(`EMPREINTE NF525\n${avoir.fingerprint || '-'}\n`);
      await this._cap('lineWrap', { lines: 4 });
      try { await this._cap('cutPaper', {}); } catch (e) {}
      return true;
    } catch (e) { throw e; }
  }

  async printClosure(closure, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};
    try {
      await this._cap('printerInit', {});
      await this._cap('setAlignment', { alignment: 1 });
      await this._cap('setFontSize', { size: 28 });
      await this._cap('setBold', { bold: true });
      await this.printText('CLOTURE DE CAISSE\n');
      await this._cap('setFontSize', { size: 22 });
      await this.printText((s.name || co.name) + '\n');
      await this._cap('setBold', { bold: false });
      await this._cap('setFontSize', { size: 20 });
      await this._cap('setAlignment', { alignment: 0 });
      await this.printText('================================================\n');
      await this.printText(`Date: ${new Date(closure.date || closure.closedAt).toLocaleString('fr-FR')}\n`);
      await this.printText(`Caissier: ${closure.userName || '?'}\n`);
      await this.printText('------------------------------------------------\n');
      await this._cap('setBold', { bold: true });
      await this.printText(`CA TTC       ${(closure.totalTTC || closure.totalCA || 0).toFixed(2)} EUR\n`);
      await this._cap('setBold', { bold: false });
      await this.printText(`Total HT     ${(closure.totalHT || 0).toFixed(2)} EUR\n`);
      await this.printText(`Total TVA    ${(closure.totalTVA || 0).toFixed(2)} EUR\n`);
      await this.printText(`Nb ventes    ${closure.salesCount || closure.nbSales || 0}\n`);
      await this.printText(`Panier moyen ${(closure.avgBasket || 0).toFixed(2)} EUR\n`);
      await this.printText('================================================\n');
      await this._cap('setAlignment', { alignment: 1 });
      await this._cap('setFontSize', { size: 18 });
      await this.printText(`EMPREINTE NF525\n${closure.fingerprint || '-'}\n`);
      await this._cap('lineWrap', { lines: 4 });
      try { await this._cap('cutPaper', {}); } catch (e) {}
      return true;
    } catch (e) { throw e; }
  }

  async testPrint() {
    try {
      await this._cap('printerInit', {});
      await this._cap('setAlignment', { alignment: 1 });
      await this._cap('setFontSize', { size: 28 });
      await this._cap('setBold', { bold: true });
      await this.printText('TEST IMPRESSION\n');
      await this._cap('setFontSize', { size: 20 });
      await this._cap('setBold', { bold: false });
      await this.printText('================================================\n');
      await this._cap('setAlignment', { alignment: 0 });
      await this.printText('CaissePro - Imprimante Sunmi\n');
      await this.printText(`Date: ${new Date().toLocaleString('fr-FR')}\n`);
      await this.printText('Caracteres: EUR a e c u o\n');
      await this.printText('================================================\n');
      await this._cap('setAlignment', { alignment: 1 });
      await this.printText('Test OK !\n');
      await this._cap('lineWrap', { lines: 4 });
      try { await this._cap('cutPaper', {}); } catch (e) {}
      return true;
    } catch (e) { throw e; }
  }

  async openDrawer() {
    try { await this._cap('openDrawer', {}); } catch (e) {
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
// PAYMENT TERMINAL ADAPTERS
// ═══════════════════════════════════════════════════════

const PAYMENT_PROFILES = {
  manual: {
    id: 'manual',
    name: 'Manuel (TPE independant)',
    description: 'Le caissier encaisse sur le TPE separement',
    methods: ['card', 'amex', 'cash', 'cheque'],
    requiresConfig: false,
  },
  concert: {
    id: 'concert',
    name: 'Protocole Concert (Ingenico / Verifone)',
    description: 'Connexion directe au pinpad via TCP/IP ou serie',
    methods: ['card', 'amex', 'contactless'],
    requiresConfig: true,
    configFields: [
      { key: 'tpeHost', label: 'Adresse IP du TPE', placeholder: '192.168.1.100', type: 'text' },
      { key: 'tpePort', label: 'Port', placeholder: '8888', type: 'number' },
      { key: 'tpeProtocol', label: 'Protocole', type: 'select', options: [
        { value: 'concert_v2', label: 'Concert V2 (standard)' },
        { value: 'concert_v3', label: 'Concert V3.x (Telium)' },
        { value: 'nexo', label: 'NEXO (nouveau standard)' },
      ]},
      { key: 'tpeDeviceId', label: 'ID terminal', placeholder: '01', type: 'text' },
    ],
  },
  sumup: {
    id: 'sumup',
    name: 'SumUp',
    description: 'Terminal SumUp Air / Solo via API ou app',
    methods: ['card', 'amex', 'contactless'],
    requiresConfig: true,
    configFields: [
      { key: 'sumupAffiliateKey', label: 'Cle API SumUp', placeholder: 'sup_sk_...', type: 'text' },
      { key: 'sumupMerchantCode', label: 'Code marchand', placeholder: 'MXXXXXXX', type: 'text' },
    ],
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe Terminal',
    description: 'Lecteur Stripe (BBPOS, Verifone P400)',
    methods: ['card', 'amex', 'contactless'],
    requiresConfig: true,
    configFields: [
      { key: 'stripeLocationId', label: 'Location ID', placeholder: 'tml_...', type: 'text' },
      { key: 'stripePublishableKey', label: 'Cle publique Stripe', placeholder: 'pk_live_...', type: 'text' },
    ],
  },
  zettle: {
    id: 'zettle',
    name: 'Zettle by PayPal (iZettle)',
    description: 'Terminal Zettle Reader via app',
    methods: ['card', 'amex', 'contactless'],
    requiresConfig: true,
    configFields: [
      { key: 'zettleClientId', label: 'Client ID', type: 'text' },
    ],
  },
  worldline: {
    id: 'worldline',
    name: 'Worldline (ex-Ingenico Group)',
    description: 'TPE Worldline VALINA, YOMANI, LANE',
    methods: ['card', 'amex', 'contactless'],
    requiresConfig: true,
    configFields: [
      { key: 'wlHost', label: 'Adresse IP', placeholder: '192.168.1.100', type: 'text' },
      { key: 'wlPort', label: 'Port', placeholder: '20000', type: 'number' },
      { key: 'wlMerchantId', label: 'ID commerçant', type: 'text' },
    ],
  },
  pax_pay: {
    id: 'pax_pay',
    name: 'PAX Payment (integre)',
    description: 'Paiement integre sur terminal PAX',
    methods: ['card', 'amex', 'contactless'],
    requiresConfig: false,
  },
  sunmi_pay: {
    id: 'sunmi_pay',
    name: 'Sunmi Pay (integre)',
    description: 'Module paiement integre Sunmi P-series',
    methods: ['card', 'amex', 'contactless'],
    requiresConfig: false,
  },
};

// ── Concert Protocol (French POS-TPE standard) ──
class ConcertPaymentAdapter {
  constructor(config = {}) {
    this.config = config;
    this.connected = false;
    this._socket = null;
  }

  async connect() {
    // Concert protocol uses TCP socket to TPE
    // In a browser context, we need a WebSocket proxy or Capacitor TCP plugin
    const host = this.config.tpeHost;
    const port = this.config.tpePort || 8888;

    if (!host) throw new Error('Adresse IP du TPE non configuree');

    // Try Capacitor TCP plugin
    if (window.Capacitor?.Plugins?.TCPSocket) {
      try {
        await window.Capacitor.Plugins.TCPSocket.connect({ host, port: parseInt(port) });
        this.connected = true;
        return true;
      } catch (e) {
        throw new Error(`Connexion TPE echouee: ${e.message}`);
      }
    }

    // Try WebSocket proxy (for browser/desktop)
    try {
      const wsUrl = `ws://${host}:${parseInt(port) + 1}`;
      this._socket = new WebSocket(wsUrl);
      await new Promise((resolve, reject) => {
        this._socket.onopen = () => { this.connected = true; resolve(); };
        this._socket.onerror = () => reject(new Error('WebSocket connexion echouee'));
        setTimeout(() => reject(new Error('Timeout connexion TPE')), 5000);
      });
      return true;
    } catch (e) {
      // Fallback: assume manual mode if can't connect
      console.warn('[Concert] Connection failed, falling back to manual mode:', e.message);
      this.connected = false;
      return false;
    }
  }

  // Concert V2 message format: STX + Data + ETX + LRC
  _buildConcertMessage(type, amount, currency = 'EUR') {
    const STX = 0x02, ETX = 0x03;
    // Transaction types: 00=Debit, 01=Credit, 09=Annulation
    const typeCode = type === 'refund' ? '01' : '00';
    const amountStr = Math.round(amount * 100).toString().padStart(8, '0');
    const currencyCode = currency === 'EUR' ? '978' : '840';
    const deviceId = (this.config.tpeDeviceId || '01').padStart(2, '0');

    // Concert V2 frame: TypeTransaction + Montant + DeviseNumérique + ModeEncaissement + Données privées
    const data = `${typeCode}${amountStr}${currencyCode}1${deviceId}`;
    const bytes = [];
    bytes.push(STX);
    for (let i = 0; i < data.length; i++) bytes.push(data.charCodeAt(i));
    bytes.push(ETX);
    // LRC = XOR of all bytes from after STX to ETX inclusive
    let lrc = 0;
    for (let i = 1; i < bytes.length; i++) lrc ^= bytes[i];
    bytes.push(lrc);
    return new Uint8Array(bytes);
  }

  _parseConcertResponse(data) {
    // Concert response: STX + StatusCode(1) + Data + ETX + LRC
    if (!data || data.length < 4) return { success: false, error: 'Reponse invalide' };
    const status = String.fromCharCode(data[1]);
    // 0 = Accepted, 1-7 = various refusals
    const accepted = status === '0';
    let authCode = '';
    if (data.length > 5) {
      authCode = Array.from(data.slice(2, data.length - 2)).map(b => String.fromCharCode(b)).join('');
    }
    return {
      success: accepted,
      status: accepted ? 'approved' : 'declined',
      authCode,
      error: accepted ? null : `Transaction refusee (code: ${status})`,
    };
  }

  async charge(amount, options = {}) {
    if (!this.connected) {
      // Manual fallback
      return this._manualCharge(amount, options);
    }

    const msg = this._buildConcertMessage('debit', amount, options.currency);

    try {
      let response;
      if (window.Capacitor?.Plugins?.TCPSocket) {
        // Native TCP
        const result = await window.Capacitor.Plugins.TCPSocket.sendAndReceive({
          data: Array.from(msg), timeout: 120000
        });
        response = new Uint8Array(result.data);
      } else if (this._socket) {
        // WebSocket
        this._socket.send(msg);
        response = await new Promise((resolve, reject) => {
          this._socket.onmessage = (e) => resolve(new Uint8Array(e.data));
          setTimeout(() => reject(new Error('Timeout reponse TPE (2min)')), 120000);
        });
      }

      return this._parseConcertResponse(response);
    } catch (e) {
      return { success: false, error: e.message, status: 'error' };
    }
  }

  async refund(amount, options = {}) {
    if (!this.connected) return this._manualCharge(amount, { ...options, type: 'refund' });
    const msg = this._buildConcertMessage('refund', amount, options.currency);
    try {
      // Same send logic as charge
      if (window.Capacitor?.Plugins?.TCPSocket) {
        const result = await window.Capacitor.Plugins.TCPSocket.sendAndReceive({ data: Array.from(msg), timeout: 120000 });
        return this._parseConcertResponse(new Uint8Array(result.data));
      }
      return { success: false, error: 'Remboursement: connexion non disponible' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  _manualCharge(amount, options = {}) {
    return new Promise((resolve) => {
      const type = options.type === 'refund' ? 'Remboursement' : 'Encaissement';
      // Dispatch event so UI can show confirmation dialog
      const event = new CustomEvent('caissepro:payment-manual', {
        detail: { amount, type, resolve }
      });
      window.dispatchEvent(event);
    });
  }

  disconnect() {
    if (this._socket) this._socket.close();
    this.connected = false;
  }
}

// ── SumUp Payment Adapter ──
class SumUpPaymentAdapter {
  constructor(config = {}) {
    this.config = config;
    this.connected = false;
  }

  async connect() {
    // SumUp works via deep link (app-to-app) on Android or via API
    if (window.Capacitor?.isNativePlatform?.()) {
      this.connected = true;
      return true;
    }
    // Browser: SumUp API requires backend proxy
    if (this.config.sumupAffiliateKey) {
      this.connected = true;
      return true;
    }
    return false;
  }

  async charge(amount, options = {}) {
    const currency = options.currency || 'EUR';
    const reference = options.reference || `CP-${Date.now()}`;

    // Android: deep link to SumUp app
    if (window.Capacitor?.isNativePlatform?.()) {
      const url = `sumupmerchant://pay/1.0?affiliate-key=${this.config.sumupAffiliateKey || ''}&amount=${amount}&currency=${currency}&title=CaissePro&receipt-email=&foreign-tx-id=${reference}&callback=caissepro://payment-callback`;
      window.location.href = url;
      // Wait for callback
      return new Promise((resolve) => {
        const handler = (e) => {
          window.removeEventListener('caissepro:sumup-callback', handler);
          resolve(e.detail);
        };
        window.addEventListener('caissepro:sumup-callback', handler);
        // Timeout after 3 min
        setTimeout(() => resolve({ success: false, error: 'Timeout SumUp' }), 180000);
      });
    }

    // Browser: use SumUp Card widget or manual
    return this._manualFallback(amount, 'SumUp');
  }

  async refund(amount, options = {}) {
    return { success: false, error: 'Remboursement SumUp: utilisez le dashboard SumUp' };
  }

  _manualFallback(amount, provider) {
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('caissepro:payment-manual', {
        detail: { amount, type: `Encaisser ${amount.toFixed(2)}EUR sur ${provider}`, resolve }
      }));
    });
  }

  disconnect() { this.connected = false; }
}

// ── Stripe Terminal Adapter ──
class StripePaymentAdapter {
  constructor(config = {}) {
    this.config = config;
    this.connected = false;
    this._terminal = null;
  }

  async connect() {
    // Stripe Terminal JS SDK
    if (!window.StripeTerminal && this.config.stripePublishableKey) {
      // Load Stripe Terminal SDK dynamically
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/terminal/v1/';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Impossible de charger Stripe Terminal SDK'));
        document.head.appendChild(script);
      });
    }

    if (window.StripeTerminal) {
      this._terminal = window.StripeTerminal.create({
        onFetchConnectionToken: async () => {
          // This should call your backend to create a connection token
          const resp = await fetch('/api/stripe/terminal/connection-token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }
          });
          const data = await resp.json();
          return data.secret;
        },
        onUnexpectedReaderDisconnect: () => {
          this.connected = false;
          console.warn('[Stripe] Reader disconnected');
        },
      });

      // Discover and connect to reader
      const result = await this._terminal.discoverReaders({
        simulated: false,
        location: this.config.stripeLocationId,
      });

      if (result.discoveredReaders?.length > 0) {
        await this._terminal.connectReader(result.discoveredReaders[0]);
        this.connected = true;
        return true;
      }
    }

    return false;
  }

  async charge(amount, options = {}) {
    if (!this._terminal || !this.connected) {
      return this._manualFallback(amount, 'Stripe');
    }

    try {
      // Create payment intent via backend
      const resp = await fetch('/api/stripe/terminal/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency: options.currency || 'eur',
          description: options.reference || 'CaissePro',
        }),
      });
      const { clientSecret } = await resp.json();

      const result = await this._terminal.collectPaymentMethod(clientSecret);
      if (result.error) return { success: false, error: result.error.message };

      const processResult = await this._terminal.processPayment(result.paymentIntent);
      if (processResult.error) return { success: false, error: processResult.error.message };

      return {
        success: true,
        status: 'approved',
        authCode: processResult.paymentIntent.id,
        transactionId: processResult.paymentIntent.id,
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async refund(amount, options = {}) {
    // Stripe refunds go through the API, not the terminal
    try {
      const resp = await fetch('/api/stripe/terminal/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          paymentIntentId: options.originalTransactionId,
        }),
      });
      const data = await resp.json();
      return { success: data.success, status: data.success ? 'refunded' : 'error', error: data.error };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  _manualFallback(amount, provider) {
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('caissepro:payment-manual', {
        detail: { amount, type: `Encaisser ${amount.toFixed(2)}EUR sur ${provider}`, resolve }
      }));
    });
  }

  disconnect() {
    if (this._terminal) this._terminal.disconnectReader();
    this.connected = false;
  }
}

// ── Zettle (iZettle) Adapter ──
class ZettlePaymentAdapter {
  constructor(config = {}) { this.config = config; this.connected = false; }

  async connect() {
    // Zettle works via deep link on Android/iOS
    if (window.Capacitor?.isNativePlatform?.()) { this.connected = true; return true; }
    return false;
  }

  async charge(amount, options = {}) {
    const reference = options.reference || `CP-${Date.now()}`;
    if (window.Capacitor?.isNativePlatform?.()) {
      // iZettle deep link
      const url = `izettle://x-callback-url/payment?amount=${Math.round(amount * 100)}&currency=EUR&reference=${reference}`;
      window.location.href = url;
      return new Promise((resolve) => {
        setTimeout(() => resolve({ success: false, error: 'Timeout Zettle' }), 180000);
      });
    }
    return { success: false, error: 'Zettle necessite l\'app mobile' };
  }

  async refund(amount, options = {}) {
    return { success: false, error: 'Remboursement Zettle: utilisez l\'app Zettle' };
  }

  disconnect() { this.connected = false; }
}

// ── Worldline Adapter ──
class WorldlinePaymentAdapter {
  constructor(config = {}) { this.config = config; this.connected = false; }

  async connect() {
    // Similar to Concert but uses Worldline-specific protocol (NEXO/ep2)
    const host = this.config.wlHost;
    if (!host) return false;
    // Same TCP/WebSocket approach as Concert
    this.connected = true;
    return true;
  }

  async charge(amount, options = {}) {
    // Worldline NEXO protocol or REST API
    if (this.config.wlHost) {
      try {
        const resp = await fetch(`http://${this.config.wlHost}:${this.config.wlPort || 20000}/api/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'PURCHASE', amount: Math.round(amount * 100), currency: 'EUR',
            merchantId: this.config.wlMerchantId,
          }),
        });
        const data = await resp.json();
        return { success: data.approved, status: data.approved ? 'approved' : 'declined', authCode: data.authCode, error: data.error };
      } catch (e) {
        return this._manualFallback(amount, 'Worldline');
      }
    }
    return this._manualFallback(amount, 'Worldline');
  }

  async refund(amount, options = {}) {
    return this._manualFallback(amount, 'Worldline (remboursement)');
  }

  _manualFallback(amount, provider) {
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('caissepro:payment-manual', {
        detail: { amount, type: `Encaisser ${amount.toFixed(2)}EUR sur ${provider}`, resolve }
      }));
    });
  }

  disconnect() { this.connected = false; }
}

// ── PAX Integrated Payment ──
class PAXPaymentAdapter {
  constructor(config = {}) { this.config = config; this.connected = false; }
  async connect() {
    if (window.Capacitor?.Plugins?.PAXPayment) { this.connected = true; return true; }
    if (window.pax?.payment) { this.connected = true; return true; }
    return false;
  }
  async charge(amount, options = {}) {
    try {
      const bridge = window.Capacitor?.Plugins?.PAXPayment || window.pax?.payment;
      if (!bridge) return { success: false, error: 'PAX Payment bridge non disponible' };
      const result = await bridge.sale({ amount: Math.round(amount * 100), currency: 'EUR' });
      return { success: result.approved, status: result.approved ? 'approved' : 'declined', authCode: result.authCode, transactionId: result.transactionId };
    } catch (e) { return { success: false, error: e.message }; }
  }
  async refund(amount, options = {}) {
    try {
      const bridge = window.Capacitor?.Plugins?.PAXPayment || window.pax?.payment;
      if (!bridge) return { success: false, error: 'PAX bridge non disponible' };
      const result = await bridge.refund({ amount: Math.round(amount * 100), originalTxId: options.originalTransactionId });
      return { success: result.approved, status: 'refunded' };
    } catch (e) { return { success: false, error: e.message }; }
  }
  disconnect() { this.connected = false; }
}

// ── Sunmi Integrated Payment ──
class SunmiPaymentAdapter {
  constructor(config = {}) { this.config = config; this.connected = false; }
  async connect() {
    if (window.Capacitor?.Plugins?.SunmiPayment) { this.connected = true; return true; }
    return false;
  }
  async charge(amount, options = {}) {
    try {
      const bridge = window.Capacitor?.Plugins?.SunmiPayment;
      if (!bridge) return { success: false, error: 'Sunmi Payment non disponible' };
      const result = await bridge.sale({ amount: Math.round(amount * 100), currency: 'EUR' });
      return { success: result.approved, status: result.approved ? 'approved' : 'declined', authCode: result.authCode };
    } catch (e) { return { success: false, error: e.message }; }
  }
  async refund(amount, options = {}) { return { success: false, error: 'Utilisez le TPE Sunmi pour les remboursements' }; }
  disconnect() { this.connected = false; }
}

// ── Manual Payment (no TPE integration) ──
class ManualPaymentAdapter {
  constructor() { this.connected = true; }
  async connect() { this.connected = true; return true; }

  async charge(amount, options = {}) {
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('caissepro:payment-manual', {
        detail: {
          amount,
          type: 'Encaissement',
          message: `Encaissez ${amount.toFixed(2)}EUR sur le TPE puis confirmez`,
          resolve,
        }
      }));
    });
  }

  async refund(amount, options = {}) {
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('caissepro:payment-manual', {
        detail: {
          amount,
          type: 'Remboursement',
          message: `Remboursez ${amount.toFixed(2)}EUR sur le TPE puis confirmez`,
          resolve,
        }
      }));
    });
  }

  disconnect() {}
}

// ═══════════════════════════════════════════════════════
// CASH DRAWER ADAPTERS
// ═══════════════════════════════════════════════════════

class CashDrawerAdapter {
  constructor(hardwareId) { this.hardwareId = hardwareId; }

  async open() {
    // Sunmi: ESC/POS command via printer
    if (this.hardwareId === 'sunmi' && window.Capacitor?.Plugins?.SunmiPrinter) {
      try { await window.Capacitor.Plugins.SunmiPrinter.openDrawer(); return true; } catch (e) {}
    }
    // iMin
    if (this.hardwareId === 'imin' && window.iminPrinter?.openDrawer) {
      try { await window.iminPrinter.openDrawer(); return true; } catch (e) {}
    }
    // Generic: send ESC/POS open drawer command via connected printer
    if (window.__escposPrinter?.connected) {
      try { await window.__escposPrinter.openDrawer(); return true; } catch (e) {}
    }
    console.warn('[CashDrawer] No drawer available for', this.hardwareId);
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// BARCODE SCANNER ADAPTER
// ═══════════════════════════════════════════════════════

class BarcodeScannerAdapter {
  constructor(hardwareId) {
    this.hardwareId = hardwareId;
    this._listeners = new Set();
    this._buffer = '';
    this._lastKeyTime = 0;
    this._keyHandler = this._onKeyPress.bind(this);
  }

  onScan(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(barcode) { this._listeners.forEach(fn => fn(barcode)); }

  // Start listening for scans (keyboard wedge mode — works with all USB/BT scanners)
  start() {
    document.addEventListener('keydown', this._keyHandler);
    // Also listen for Capacitor barcode plugin
    if (window.Capacitor?.Plugins?.BarcodeScanner) {
      window.Capacitor.Plugins.BarcodeScanner.addListener('barcodeScanned', (result) => {
        this._emit(result.barcode || result.value);
      });
    }
  }

  stop() {
    document.removeEventListener('keydown', this._keyHandler);
  }

  _onKeyPress(e) {
    const now = Date.now();
    // Scanners type very fast (< 50ms between keys). Humans type slower.
    if (now - this._lastKeyTime > 100) this._buffer = '';
    this._lastKeyTime = now;

    if (e.key === 'Enter' && this._buffer.length >= 8) {
      // Likely a barcode scan
      const barcode = this._buffer.trim();
      this._buffer = '';
      // Don't emit if an input is focused (user is typing)
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        // Let the input handle it
        return;
      }
      e.preventDefault();
      this._emit(barcode);
    } else if (e.key.length === 1) {
      this._buffer += e.key;
    }
  }
}

// ═══════════════════════════════════════════════════════
// Main Hardware Manager
// ═══════════════════════════════════════════════════════
class HardwareManager {
  constructor() {
    this._hardwareId = null;
    this._printer = null;
    this._payment = null;
    this._paymentId = null;
    this._paymentConfig = {};
    this._dualScreen = null;
    this._cashDrawer = null;
    this._scanner = null;
    this._listeners = new Set();
  }

  get profiles() { return HARDWARE_PROFILES; }
  get paymentProfiles() { return PAYMENT_PROFILES; }
  get currentId() { return this._hardwareId; }
  get currentProfile() { return HARDWARE_PROFILES[this._hardwareId]; }
  get printer() { return this._printer; }
  get payment() { return this._payment; }
  get paymentId() { return this._paymentId; }
  get paymentConfig() { return this._paymentConfig; }
  get dualScreen() { return this._dualScreen; }
  get cashDrawer() { return this._cashDrawer; }
  get scanner() { return this._scanner; }

  on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(event, data) { this._listeners.forEach(fn => fn(event, data)); }

  // Initialize with auto-detect or saved preference
  init() {
    const saved = localStorage.getItem('caissepro_hardware');
    this._hardwareId = saved || detectHardware();

    // Load payment config
    const savedPayment = localStorage.getItem('caissepro_payment_type');
    const savedPaymentConfig = localStorage.getItem('caissepro_payment_config');
    this._paymentId = savedPayment || 'manual';
    try { this._paymentConfig = savedPaymentConfig ? JSON.parse(savedPaymentConfig) : {}; } catch (e) { this._paymentConfig = {}; }

    this._initAdapters();
    console.log(`[HAL] Hardware: ${this._hardwareId} (${this.currentProfile?.name}), Payment: ${this._paymentId}`);
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

  // Switch payment terminal
  setPayment(id, config = {}) {
    if (!PAYMENT_PROFILES[id]) throw new Error(`Payment inconnu: ${id}`);
    this._paymentId = id;
    this._paymentConfig = config;
    localStorage.setItem('caissepro_payment_type', id);
    localStorage.setItem('caissepro_payment_config', JSON.stringify(config));
    this._initPaymentAdapter();
    this._emit('payment-changed', { id, profile: PAYMENT_PROFILES[id] });
  }

  updatePaymentConfig(config) {
    this._paymentConfig = { ...this._paymentConfig, ...config };
    localStorage.setItem('caissepro_payment_config', JSON.stringify(this._paymentConfig));
    this._initPaymentAdapter();
  }

  _initAdapters() {
    // Printer
    switch (this._hardwareId) {
      case 'sunmi': this._printer = new SunmiPrinterAdapter(); break;
      case 'pax': this._printer = new PAXPrinterAdapter(); break;
      case 'imin': this._printer = new iMinPrinterAdapter(); break;
      default: this._printer = new BrowserPrintAdapter();
    }
    this._dualScreen = new DualScreenAdapter(this._hardwareId);
    this._cashDrawer = new CashDrawerAdapter(this._hardwareId);
    this._scanner = new BarcodeScannerAdapter(this._hardwareId);
    this._initPaymentAdapter();
  }

  _initPaymentAdapter() {
    switch (this._paymentId) {
      case 'concert': this._payment = new ConcertPaymentAdapter(this._paymentConfig); break;
      case 'sumup': this._payment = new SumUpPaymentAdapter(this._paymentConfig); break;
      case 'stripe': this._payment = new StripePaymentAdapter(this._paymentConfig); break;
      case 'zettle': this._payment = new ZettlePaymentAdapter(this._paymentConfig); break;
      case 'worldline': this._payment = new WorldlinePaymentAdapter(this._paymentConfig); break;
      case 'pax_pay': this._payment = new PAXPaymentAdapter(this._paymentConfig); break;
      case 'sunmi_pay': this._payment = new SunmiPaymentAdapter(this._paymentConfig); break;
      default: this._payment = new ManualPaymentAdapter();
    }
  }

  // Auto-connect printer
  async connectPrinter() {
    if (!this._printer) return false;
    const ok = await this._printer.connect();
    this._emit('printer-status', { connected: ok });
    return ok;
  }

  // Connect payment terminal
  async connectPayment() {
    if (!this._payment) return false;
    const ok = await this._payment.connect();
    this._emit('payment-status', { connected: ok });
    return ok;
  }

  // Charge via payment terminal
  async charge(amount, options = {}) {
    if (!this._payment) return { success: false, error: 'Aucun terminal configure' };
    return await this._payment.charge(amount, options);
  }

  // Refund via payment terminal
  async refund(amount, options = {}) {
    if (!this._payment) return { success: false, error: 'Aucun terminal configure' };
    return await this._payment.refund(amount, options);
  }

  // Open cash drawer
  async openDrawer() {
    if (!this._cashDrawer) return false;
    return await this._cashDrawer.open();
  }
}

// Singleton
const hardwareManager = new HardwareManager();

export default hardwareManager;
export {
  HardwareManager,
  HARDWARE_PROFILES,
  PAYMENT_PROFILES,
  detectHardware,
  SunmiPrinterAdapter,
  PAXPrinterAdapter,
  iMinPrinterAdapter,
  BrowserPrintAdapter,
  DualScreenAdapter,
  CashDrawerAdapter,
  BarcodeScannerAdapter,
  ConcertPaymentAdapter,
  SumUpPaymentAdapter,
  StripePaymentAdapter,
  ZettlePaymentAdapter,
  WorldlinePaymentAdapter,
  ManualPaymentAdapter,
};
