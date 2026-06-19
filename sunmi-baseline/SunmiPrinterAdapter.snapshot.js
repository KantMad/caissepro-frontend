class SunmiPrinterAdapter {
  constructor() {
    this.connected = false;
    this._bridge = null;
    this._status = null;
  }

  async connect() {
    this._isCapacitor = false;

    // Check for Capacitor Sunmi plugin
    if (window.Capacitor?.Plugins?.SunmiPrinter) {
      this._bridge = window.Capacitor.Plugins.SunmiPrinter;
      this._isCapacitor = true;
      console.log('[Sunmi] Capacitor plugin found, checking status...');

      // Get full diagnostic status
      try {
        this._status = await this._bridge.getStatus();
        console.log('[Sunmi] Status:', JSON.stringify(this._status));
      } catch (e) {
        console.warn('[Sunmi] getStatus failed:', e);
      }

      // Try to init printer
      try {
        await this._bridge.printerInit({});
        this.connected = true;
        console.log('[Sunmi] Printer connected via Capacitor plugin');
        return true;
      } catch (e) {
        console.warn('[Sunmi] printerInit failed:', e.message || e);
        // If service wasn't ready, try reconnect then retry
        try {
          console.log('[Sunmi] Attempting reconnect...');
          const reconResult = await this._bridge.reconnect();
          console.log('[Sunmi] Reconnect result:', JSON.stringify(reconResult));
          if (reconResult.connected) {
            await this._bridge.printerInit({});
            this.connected = true;
            console.log('[Sunmi] Printer connected after reconnect');
            return true;
          }
        } catch (e2) {
          console.warn('[Sunmi] Reconnect failed:', e2.message || e2);
        }
      }
    } else if (window.SunmiInnerPrinter) {
      this._bridge = window.SunmiInnerPrinter;
    } else if (window.PrintService) {
      this._bridge = window.PrintService;
    }

    if (this._bridge && !this._isCapacitor) {
      try {
        const vals = [];
        if (typeof this._bridge.printerInit === 'function') {
          await this._bridge.printerInit(...vals);
        }
        this.connected = true;
        console.log('[Sunmi] Printer connected via legacy JS bridge');
        return true;
      } catch (e) {
        console.warn('[Sunmi] Legacy init failed:', e);
      }
    }

    // Fallback: check if Android bridge is available
    if (window.android?.printText) {
      this._bridge = window.android;
      this._isCapacitor = false;
      this.connected = true;
      console.log('[Sunmi] Printer connected via Android bridge');
      return true;
    }

    this.connected = false;
    console.warn('[Sunmi] No printer bridge found. Capacitor available:', !!window.Capacitor, 'Plugins:', Object.keys(window.Capacitor?.Plugins || {}));
    return false;
  }

  // Get full diagnostic info (call from settings/debug UI)
  async getDiagnostics() {
    if (!this._bridge || !this._isCapacitor) {
      return { available: false, bridge: !!this._bridge, isCapacitor: this._isCapacitor, connected: this.connected };
    }
    try {
      const status = await this._bridge.getStatus();
      return { available: true, ...status, jsConnected: this.connected };
    } catch (e) {
      return { available: true, error: e.message, jsConnected: this.connected };
    }
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
      console.error('[Sunmi] printText failed:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Build a batch command array for the native printBatch method
  // This sends ONE Capacitor call that Java executes synchronously
  // ═══════════════════════════════════════════════════════════
  _buildReceiptBatch(ticket, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};
    const t = ticket || {};
    const fmt = (v) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
    const cmds = [];

    // Helper to push commands
    const text = (txt) => cmds.push({ cmd: 'text', text: txt });
    const bold = (on) => cmds.push({ cmd: 'bold', enabled: on });
    const size = (v) => cmds.push({ cmd: 'size', value: v });
    const align = (v) => cmds.push({ cmd: 'align', value: v });

    // Header
    align(1);
    size(32); bold(true);
    text((s.name || co.name || 'Ma Boutique') + '\n');
    size(24); bold(false);
    if (s.address) text(s.address + '\n');
    if (s.postalCode || s.city) text(`${s.postalCode || ''} ${s.city || ''}\n`);
    if (s.phone) text(`Tel: ${s.phone}\n`);
    if (s.siret) text(`SIRET: ${s.siret}\n`);
    if (s.tvaIntra) text(`TVA: ${s.tvaIntra}\n`);
    cmds.push({ cmd: 'line', char: '=', len: 32 });

    // Gift card mode: no prices, special header
    const isGift = !!t._giftCard;

    // Ticket info
    align(0); bold(true);
    let dateStr = '';
    try { dateStr = new Date(t.date || t.createdAt || Date.now()).toLocaleString('fr-FR'); } catch (e) {}
    if (isGift) {
      align(1); size(32); bold(true);
      text('TICKET CADEAU\n');
      size(24); bold(false); align(0);
    }
    text(`N: ${t.ticketNumber || t.ticket_number || '?'}  ${dateStr}\n`);
    bold(false);
    if (!isGift) { bold(true); text(`Caissier: ${t.userName || t.user_name || '?'}\n`); bold(false); }
    if (t.customerName || t.customer_name) { bold(true); text(`Client: ${t.customerName || t.customer_name}\n`); bold(false); }
    cmds.push({ cmd: 'line', char: '-', len: 32 });

    // Items
    const items = t.items || [];
    for (const item of items) {
      if (!item) continue;
      const name = item.product?.name || item.product_name || item.name || '?';
      const sku = item.product?.sku || item.product_sku || item.sku || '';
      const color = item.variant?.color || item.variant_color || '';
      const colorCode = item.variant?.colorCode || item.variant_color_code || item.color_code || '';
      const sz = item.variant?.size || item.variant_size || '';
      const ean = item.variant?.ean || item.variant_ean || item.ean || '';
      const qty = item.quantity || 1;
      const isCustom = item.isCustom || item.is_custom;
      const lineTTC = Number(item.lineTTC || item.line_ttc || 0) || (Number(item.unit_price || 0) * qty);

      bold(true);
      text(`${name}\n`);
      bold(false);
      if (!isCustom && (color || sz)) {
        text(`  ${color}/${sz}`);
        if (sku) text(` | Ref: ${sku}`);
        if (colorCode) text(` | ${colorCode}`);
        text('\n');
        if (ean) { size(20); text(`  EAN: ${ean}\n`); size(24); }
      }
      if (isGift) {
        text(`  x${qty}\n`);
      } else {
        bold(true); text(`  x${qty}  ${fmt(lineTTC)} EUR\n`); bold(false);
      }
    }
    cmds.push({ cmd: 'line', char: '-', len: 32 });

    if (!isGift) {
      // Promos
      if (t.promosApplied?.length > 0) {
        for (const promo of t.promosApplied) {
          size(22); text(`  * ${promo}\n`); size(24);
        }
        cmds.push({ cmd: 'line', char: '-', len: 32 });
      }

      // Discount
      if (Number(t.globalDiscount || t.global_discount || 0) > 0) {
        bold(true); text(`Remise       -${fmt(t.globalDiscount || t.global_discount)} EUR\n`); bold(false);
      }

      // Totals
      bold(true);
      text(`Total HT     ${fmt(t.totalHT || t.total_ht)} EUR\n`);
      text(`TVA          ${fmt(t.totalTVA || t.total_tva)} EUR\n`);
      size(32);
      text(`TOTAL TTC    ${fmt(t.totalTTC || t.total_ttc)} EUR\n`);
      size(24); bold(false);

      // Payment
      const ml = { cash: 'ESP', card: 'CB', amex: 'AMEX', giftcard: 'CAD', cheque: 'CHQ', avoir: 'AVOIR' };
      const payments = t.payments || [];
      if (payments.length > 0) {
        const payStr = payments.map(p => `${ml[p.method] || p.method || '?'} ${fmt(p.amount)} EUR`).join(' + ');
        bold(true); text(`Paiement: ${payStr}\n`); bold(false);
      }
      cmds.push({ cmd: 'line', char: '=', len: 32 });

      // NF525
      align(1); size(22); bold(true);
      text('EMPREINTE NF525\n');
      size(24);
      text(`${t.fingerprint || t.hash || '-'}\n`);
      bold(false);
    } else {
      // Gift card footer
      align(1); size(22); bold(true);
      text(`Echange possible sous ${(t._returnDays || 30)} jours\n`);
      text('sur presentation de ce ticket\n');
      bold(false); size(24);
      cmds.push({ cmd: 'line', char: '=', len: 32 });
    }

    // Footer — garantie
    align(1); size(20); bold(true);
    text('Garantie legale 2 ans\n');
    bold(false);

    // EAN-13 barcode (Sunmi native printBarCode)
    if (t.barcode && t.barcode.length === 13) {
      align(1);
      cmds.push({ cmd: 'barcode', text: t.barcode, type: 2, height: 100, width: 2 });
    }

    // Footer text AFTER barcode
    align(1);
    if (s.footerMsg || co.footerMsg) { size(24); bold(true); text(`${s.footerMsg || co.footerMsg}\n`); bold(false); }
    if (s.ticketFreeText) { size(22); bold(true); const ftLines = s.ticketFreeText.split('\n'); for (const ln of ftLines) { text(ln + '\n'); } bold(false); }
    if (t.customerName || t.customer_name) {
      size(20); text(`Fidelite: +${Math.floor(Number(t.totalTTC || t.total_ttc) || 0)}pts\n`);
    }
    size(18); text(`${co.sw || 'CaissePro'} v${co.ver || '6.1.0'} - Conforme NF525\n`);

    // Feed and cut
    cmds.push({ cmd: 'feed', lines: 4 });
    cmds.push({ cmd: 'cut' });

    return cmds;
  }

  _buildAvoirBatch(avoir, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};
    const a = avoir || {};
    const fmt = (v) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
    const cmds = [];
    const text = (txt) => cmds.push({ cmd: 'text', text: txt });
    const bold = (on) => cmds.push({ cmd: 'bold', enabled: on });
    const size = (v) => cmds.push({ cmd: 'size', value: v });
    const align = (v) => cmds.push({ cmd: 'align', value: v });

    align(1); size(32); bold(true);
    text('AVOIR / NOTE DE CREDIT\n');
    size(26); text((s.name || co.name || 'Ma Boutique') + '\n');
    bold(false); size(24); align(0);
    cmds.push({ cmd: 'line', char: '=', len: 32 });
    bold(true); text(`N: ${a.avoirNumber || a.avoir_number || '?'}\n`); bold(false);
    text(`Ticket original: ${a.originalTicket || a.original_ticket || '?'}\n`);
    let dateStr = '';
    try { dateStr = new Date(a.date || Date.now()).toLocaleString('fr-FR'); } catch (e) {}
    text(`Date: ${dateStr}\n`);
    bold(true); text(`Motif: ${a.reason || 'Non specifie'}\n`); bold(false);
    cmds.push({ cmd: 'line', char: '-', len: 32 });
    for (const item of (a.items || [])) {
      if (!item) continue;
      const name = item.product?.name || item.product_name || item.name || '?';
      const sku = item.product?.sku || item.product_sku || item.sku || '';
      const color = item.variant?.color || item.variant_color || item.color || '';
      const colorCode = item.variant?.colorCode || item.variant_color_code || item.color_code || '';
      const sz = item.variant?.size || item.variant_size || item.size || '';
      const ean = item.variant?.ean || item.variant_ean || item.ean || '';
      bold(true); text(`${name}\n`); bold(false);
      if (color || sz) {
        text(`  ${color}/${sz}`);
        if (sku) text(` | Ref: ${sku}`);
        if (colorCode) text(` | ${colorCode}`);
        text('\n');
        if (ean) { size(20); text(`  EAN: ${ean}\n`); size(24); }
      }
      bold(true); text(`  x${item.quantity || 1}  -${fmt(item.lineTTC || item.line_ttc)} EUR\n`); bold(false);
    }
    cmds.push({ cmd: 'line', char: '-', len: 32 });
    const refundLabels = { cash: 'Especes', card: 'Carte bancaire', avoir: 'Avoir client' };
    bold(true); size(32);
    text(`TOTAL AVOIR  -${fmt(a.totalTTC || a.total_ttc)} EUR\n`);
    size(24); bold(false);
    bold(true); text(`Remboursement: ${refundLabels[a.refundMethod || a.refund_method] || a.refundMethod || a.refund_method || '?'}\n`); bold(false);
    cmds.push({ cmd: 'line', char: '=', len: 32 });
    align(1); size(22); bold(true);
    text(`EMPREINTE NF525\n${a.fingerprint || a.hash || '-'}\n`); bold(false);

    // Garantie
    size(20); bold(true); text('Garantie legale 2 ans\n'); bold(false);

    // EAN-13 barcode
    if (a.barcode && a.barcode.length === 13) {
      align(1);
      cmds.push({ cmd: 'barcode', text: a.barcode, type: 2, height: 100, width: 2 });
    }

    // Footer text AFTER barcode
    align(1);
    if (s.footerMsg || co.footerMsg) { size(24); bold(true); text(`${s.footerMsg || co.footerMsg}\n`); bold(false); }
    if (s.ticketFreeText) { size(22); bold(true); const ftLines = s.ticketFreeText.split('\n'); for (const ln of ftLines) { text(ln + '\n'); } bold(false); }
    size(18); text(`${co.sw || 'CaissePro'} v${co.ver || '6.1.0'} - Conforme NF525\n`);

    cmds.push({ cmd: 'feed', lines: 4 });
    cmds.push({ cmd: 'cut' });
    return cmds;
  }

  _buildClosureBatch(closure, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};
    const c = closure || {};
    const fmt = (v) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
    const cmds = [];
    const text = (txt) => cmds.push({ cmd: 'text', text: txt });
    const bold = (on) => cmds.push({ cmd: 'bold', enabled: on });
    const size = (v) => cmds.push({ cmd: 'size', value: v });
    const align = (v) => cmds.push({ cmd: 'align', value: v });

    align(1); size(32); bold(true);
    text('CLOTURE DE CAISSE\n');
    size(26); text((s.name || co.name || 'Ma Boutique') + '\n');
    bold(false); size(24); align(0);
    cmds.push({ cmd: 'line', char: '=', len: 32 });
    bold(true); text(`Date: ${(() => { try { return new Date(c.date || c.closedAt || Date.now()).toLocaleString('fr-FR'); } catch (e) { return '?'; } })()}\n`);
    text(`Caissier: ${c.userName || c.user_name || '?'}\n`); bold(false);
    cmds.push({ cmd: 'line', char: '-', len: 32 });
    bold(true); size(28);
    text(`CA TTC       ${fmt(c.totalTTC || c.totalCA || c.total_ttc)} EUR\n`);
    size(24); bold(false);
    bold(true); text(`Total HT     ${fmt(c.totalHT || c.total_ht)} EUR\n`);
    text(`Total TVA    ${fmt(c.totalTVA || c.total_tva)} EUR\n`);
    text(`Nb ventes    ${c.salesCount || c.nbSales || c.sales_count || 0}\n`);
    text(`Panier moyen ${fmt(c.avgBasket || c.avg_basket)} EUR\n`); bold(false);
    cmds.push({ cmd: 'line', char: '=', len: 32 });
    align(1); size(22); bold(true);
    text(`EMPREINTE NF525\n${c.fingerprint || c.hash || '-'}\n`); bold(false);
    cmds.push({ cmd: 'feed', lines: 4 });
    cmds.push({ cmd: 'cut' });
    return cmds;
  }

  async printReceipt(ticket, settings, companyInfo) {
    if (this._isCapacitor && this._bridge) {
      const commands = this._buildReceiptBatch(ticket, settings, companyInfo);
      console.log('[Sunmi] printReceipt:', commands.length, 'commands');

      // Prefer printRaw (ESC/POS) — works even when printerState=2 (PREPARING)
      // Falls back to printBatch (AIDL) if printRaw not available
      if (this._bridge.printRaw) {
        console.log('[Sunmi] Using printRaw (ESC/POS bypass)');
        const result = await this._bridge.printRaw({ commands });
        console.log('[Sunmi] printRaw result:', JSON.stringify(result));
        return true;
      } else if (this._bridge.printBatch) {
        console.log('[Sunmi] Using printBatch (AIDL)');
        const result = await this._bridge.printBatch({ commands });
        console.log('[Sunmi] printBatch result:', JSON.stringify(result));
        return true;
      }
    }
    // Fallback for non-Capacitor (legacy bridge) — sequential calls
    return this._legacyPrintReceipt(ticket, settings, companyInfo);
  }

  async printAvoir(avoir, settings, companyInfo) {
    if (this._isCapacitor && this._bridge) {
      const commands = this._buildAvoirBatch(avoir, settings, companyInfo);
      if (this._bridge.printRaw) {
        await this._bridge.printRaw({ commands });
      } else if (this._bridge.printBatch) {
        await this._bridge.printBatch({ commands });
      }
      return true;
    }
    return this._legacyPrintAvoir(avoir, settings, companyInfo);
  }

  async printClosure(closure, settings, companyInfo) {
    if (this._isCapacitor && this._bridge) {
      const commands = this._buildClosureBatch(closure, settings, companyInfo);
      if (this._bridge.printRaw) {
        await this._bridge.printRaw({ commands });
      } else if (this._bridge.printBatch) {
        await this._bridge.printBatch({ commands });
      }
      return true;
    }
    return this._legacyPrintClosure(closure, settings, companyInfo);
  }

  // ── Retouche ──
  _buildRetoucheBatch(bon, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};
    const fmt = (v) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
    const cmds = [];
    const text = (txt) => cmds.push({ cmd: 'text', text: txt });
    const bold = (on) => cmds.push({ cmd: 'bold', enabled: on });
    const size = (v) => cmds.push({ cmd: 'size', value: v });
    const align = (v) => cmds.push({ cmd: 'align', value: v });

    // Header (same as receipt)
    align(1); size(32); bold(true);
    text((s.name || co.name || 'Ma Boutique') + '\n');
    size(24); bold(false);
    if (s.address) text(s.address + '\n');
    if (s.postalCode || s.city) text(`${s.postalCode || ''} ${s.city || ''}\n`);
    if (s.phone) text(`Tel: ${s.phone}\n`);
    if (s.siret) text(`SIRET: ${s.siret}\n`);
    cmds.push({ cmd: 'line', char: '=', len: 32 });

    align(1); size(32); bold(true);
    text('BON DE RETOUCHE\n');
    size(24); bold(false);
    cmds.push({ cmd: 'line', char: '=', len: 32 });

    align(0); bold(true);
    let dateStr = '';
    try { dateStr = new Date(bon.date || Date.now()).toLocaleString('fr-FR'); } catch (e) {}
    text(`N: ${bon.num || '?'}  ${dateStr}\n`);
    bold(false);
    if (bon.seller) { bold(true); text(`Vendeur: ${bon.seller}\n`); bold(false); }
    if (bon.client) { bold(true); text(`Client: ${bon.client}\n`); bold(false); }
    if (bon.phone) text(`Tel: ${bon.phone}\n`);
    cmds.push({ cmd: 'line', char: '-', len: 32 });

    if (bon.dateRetrait) {
      bold(true); align(1);
      text(`RETRAIT: ${new Date(bon.dateRetrait).toLocaleDateString('fr-FR')}\n`);
      bold(false); align(0);
      cmds.push({ cmd: 'line', char: '-', len: 32 });
    }

    const tvaRate = (s.retoucheTVA || 20) / 100;
    let totalTTC = 0;
    for (const item of (bon.items || [])) {
      if (!item.desc) continue;
      const price = parseFloat(item.price) || 0;
      totalTTC += price;
      bold(true); text(`Retouche: ${item.desc}\n`); bold(false);
      text(`  1 x ${fmt(price)} EUR TTC\n`);
    }
    cmds.push({ cmd: 'line', char: '-', len: 32 });

    const totalHT = totalTTC / (1 + tvaRate);
    bold(true);
    text(`Total HT     ${fmt(totalHT)} EUR\n`);
    text(`TVA ${(tvaRate * 100).toFixed(1)}%    ${fmt(totalTTC - totalHT)} EUR\n`);
    size(32);
    text(`TOTAL TTC    ${fmt(totalTTC)} EUR\n`);
    size(24); bold(false);
    cmds.push({ cmd: 'line', char: '=', len: 32 });

    if (bon.notes) { size(22); bold(true); text(`Notes: ${bon.notes}\n`); bold(false); size(24); cmds.push({ cmd: 'line', char: '-', len: 32 }); }

    align(1); size(20); bold(true);
    text(`${co.sw || 'CaissePro'} v${co.ver || '6.1.0'}\n`);
    bold(false);
    if (s.retoucheMsg) { bold(true); text(s.retoucheMsg + '\n'); bold(false); }
    else { bold(true); text(`Retrait prevu sous ${s.retoucheDelay || 5} jours ouvres\n`); bold(false); }
    if (s.footerMsg || co.footerMsg) { bold(true); text(`${s.footerMsg || co.footerMsg}\n`); bold(false); }

    // EAN-13 barcode
    if (bon.barcode && bon.barcode.length === 13) {
      align(1);
      cmds.push({ cmd: 'barcode', text: bon.barcode, type: 2, height: 100, width: 2 });
    }

    cmds.push({ cmd: 'feed', lines: 4 });
    cmds.push({ cmd: 'cut' });
    return cmds;
  }

  async printRetouche(bon, settings, companyInfo) {
    if (this._isCapacitor && this._bridge) {
      const commands = this._buildRetoucheBatch(bon, settings, companyInfo);
      if (this._bridge.printRaw) { await this._bridge.printRaw({ commands }); }
      else if (this._bridge.printBatch) { await this._bridge.printBatch({ commands }); }
      return true;
    }
    try {
      await this._cap('printerInit', {});
      await this.printText('BON DE RETOUCHE\n');
      await this.printText(`N: ${bon?.num || '?'}\nClient: ${bon?.client || '?'}\n`);
      for (const item of (bon?.items || [])) { if (item.desc) await this.printText(`${item.desc}  ${parseFloat(item.price || 0).toFixed(2)} EUR\n`); }
      await this._cap('lineWrap', { lines: 4 });
      try { await this._cap('cutPaper', {}); } catch (e) {}
      return true;
    } catch (e) { throw e; }
  }

  // ── Register Open ──
  _buildRegisterOpenBatch(data, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};
    const fmt = (v) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
    const cmds = [];
    const text = (txt) => cmds.push({ cmd: 'text', text: txt });
    const bold = (on) => cmds.push({ cmd: 'bold', enabled: on });
    const size = (v) => cmds.push({ cmd: 'size', value: v });
    const align = (v) => cmds.push({ cmd: 'align', value: v });

    align(1); size(32); bold(true);
    text((s.name || co.name || 'Ma Boutique') + '\n');
    size(24); bold(false);
    cmds.push({ cmd: 'line', char: '=', len: 32 });
    align(1); size(32); bold(true);
    text('OUVERTURE DE CAISSE\n');
    size(24); bold(false);
    cmds.push({ cmd: 'line', char: '=', len: 32 });
    align(0);
    let dateStr = '';
    try { dateStr = new Date(data.openDate || Date.now()).toLocaleString('fr-FR'); } catch (e) {}
    bold(true); text(`Date: ${dateStr}\n`);
    if (data.userName) text(`Caissier: ${data.userName}\n`);
    if (data.storeName) text(`Magasin: ${data.storeName}\n`);
    bold(false);
    cmds.push({ cmd: 'line', char: '-', len: 32 });
    bold(true); size(32);
    text(`FOND DE CAISSE  ${fmt(data.openingAmount)} EUR\n`);
    size(24); bold(false);
    if (data.denominations) {
      cmds.push({ cmd: 'line', char: '-', len: 32 });
      for (const [k, v] of Object.entries(data.denominations)) { if (v > 0) { bold(true); text(`  ${k} EUR x ${v}\n`); bold(false); } }
    }
    cmds.push({ cmd: 'line', char: '=', len: 32 });
    align(1); size(20); bold(true);
    text('Document obligatoire - a conserver\n'); bold(false);
    cmds.push({ cmd: 'feed', lines: 4 });
    cmds.push({ cmd: 'cut' });
    return cmds;
  }

  async printRegisterOpen(data, settings, companyInfo) {
    if (this._isCapacitor && this._bridge) {
      const commands = this._buildRegisterOpenBatch(data, settings, companyInfo);
      if (this._bridge.printRaw) { await this._bridge.printRaw({ commands }); }
      else if (this._bridge.printBatch) { await this._bridge.printBatch({ commands }); }
      return true;
    }
    try {
      await this._cap('printerInit', {});
      await this.printText('OUVERTURE DE CAISSE\n');
      await this.printText(`Fond: ${parseFloat(data?.openingAmount || 0).toFixed(2)} EUR\n`);
      await this._cap('lineWrap', { lines: 4 });
      try { await this._cap('cutPaper', {}); } catch (e) {}
      return true;
    } catch (e) { throw e; }
  }

  // ── Register Close ──
  _buildRegisterCloseBatch(data, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};
    const fmt = (v) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
    const cmds = [];
    const text = (txt) => cmds.push({ cmd: 'text', text: txt });
    const bold = (on) => cmds.push({ cmd: 'bold', enabled: on });
    const size = (v) => cmds.push({ cmd: 'size', value: v });
    const align = (v) => cmds.push({ cmd: 'align', value: v });

    align(1); size(32); bold(true);
    text((s.name || co.name || 'Ma Boutique') + '\n');
    size(24); bold(false);
    cmds.push({ cmd: 'line', char: '=', len: 32 });
    align(1); size(32); bold(true);
    text('FERMETURE DE CAISSE\n');
    size(24); bold(false);
    cmds.push({ cmd: 'line', char: '=', len: 32 });
    align(0);
    let openStr = '', closeStr = '';
    try { openStr = new Date(data.openDate || Date.now()).toLocaleString('fr-FR'); } catch (e) {}
    try { closeStr = new Date(data.closeDate || Date.now()).toLocaleString('fr-FR'); } catch (e) {}
    bold(true);
    text(`Ouverture: ${openStr}\n`);
    text(`Fermeture: ${closeStr}\n`);
    if (data.userName) text(`Caissier: ${data.userName}\n`);
    if (data.storeName) text(`Magasin: ${data.storeName}\n`);
    bold(false);
    cmds.push({ cmd: 'line', char: '-', len: 32 });
    bold(true); size(26); text('ACTIVITE\n'); size(24); bold(false);
    bold(true); text(`Nb ventes        ${data.salesCount || 0}\n`);
    size(28); text(`CA TTC           ${fmt(data.totalTTC || data.totalCA)} EUR\n`); size(24);
    text(`Total HT         ${fmt(data.totalHT)} EUR\n`);
    text(`Total TVA        ${fmt(data.totalTVA)} EUR\n`);
    if (data.avgBasket) text(`Panier moyen     ${fmt(data.avgBasket)} EUR\n`);
    bold(false);
    cmds.push({ cmd: 'line', char: '-', len: 32 });
    bold(true); size(26); text('PAIEMENTS\n'); size(24);
    if (data.cashTotal != null) text(`Especes          ${fmt(data.cashTotal)} EUR\n`);
    if (data.cardTotal != null) text(`CB               ${fmt(data.cardTotal)} EUR\n`);
    bold(false);
    cmds.push({ cmd: 'line', char: '-', len: 32 });
    bold(true); size(26); text('CONTROLE\n'); size(24);
    text(`Fond ouverture   ${fmt(data.openingAmount)} EUR\n`);
    if (data.actualCash != null) text(`Especes comptees ${fmt(data.actualCash)} EUR\n`);
    if (data.actualCard != null) text(`CB comptees      ${fmt(data.actualCard)} EUR\n`);
    bold(false);
    cmds.push({ cmd: 'line', char: '=', len: 32 });
    align(1); size(20); bold(true);
    text('Document obligatoire - a conserver\n'); bold(false);
    cmds.push({ cmd: 'feed', lines: 4 });
    cmds.push({ cmd: 'cut' });
    return cmds;
  }

  async printRegisterClose(data, settings, companyInfo) {
    if (this._isCapacitor && this._bridge) {
      const commands = this._buildRegisterCloseBatch(data, settings, companyInfo);
      if (this._bridge.printRaw) { await this._bridge.printRaw({ commands }); }
      else if (this._bridge.printBatch) { await this._bridge.printBatch({ commands }); }
      return true;
    }
    try {
      await this._cap('printerInit', {});
      await this.printText('FERMETURE DE CAISSE\n');
      await this.printText(`CA TTC: ${parseFloat(data?.totalTTC || data?.totalCA || 0).toFixed(2)} EUR\n`);
      await this._cap('lineWrap', { lines: 4 });
      try { await this._cap('cutPaper', {}); } catch (e) {}
      return true;
    } catch (e) { throw e; }
  }

  // ── Gift Card ──
  async printGiftCard(card, settings, companyInfo) {
    if (this._isCapacitor && this._bridge) {
      const s = settings || {};
      const co = companyInfo || {};
      const fmt = (v) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
      const cmds = [];
      const text = (txt) => cmds.push({ cmd: 'text', text: txt });
      const bold = (on) => cmds.push({ cmd: 'bold', enabled: on });
      const size = (v) => cmds.push({ cmd: 'size', value: v });
      const align = (v) => cmds.push({ cmd: 'align', value: v });

      align(1); size(32); bold(true);
      text((s.name || co.name || 'Ma Boutique') + '\n');
      size(24); bold(false);
      cmds.push({ cmd: 'line', char: '=', len: 32 });
      align(1); size(32); bold(true);
      text('CARTE CADEAU\n');
      size(26); text(`${card.code || '?'}\n`);
      size(24); bold(false);
      cmds.push({ cmd: 'line', char: '-', len: 32 });
      align(0); bold(true);
      text(`Montant: ${fmt(card.initialAmount || card.initial_amount)} EUR\n`);
      text(`Solde:   ${fmt(card.balance || card.remaining)} EUR\n`);
      if (card.customerName) text(`Client:  ${card.customerName}\n`);
      bold(false);
      cmds.push({ cmd: 'line', char: '=', len: 32 });
      align(1); size(20); bold(true);
      text(`${co.sw || 'CaissePro'}\n`); bold(false);
      cmds.push({ cmd: 'feed', lines: 4 });
      cmds.push({ cmd: 'cut' });

      if (this._bridge.printRaw) { await this._bridge.printRaw({ commands: cmds }); }
      else if (this._bridge.printBatch) { await this._bridge.printBatch({ commands: cmds }); }
      return true;
    }
    try {
      await this._cap('printerInit', {});
      await this.printText(`CARTE CADEAU\n${card?.code || '?'}\nMontant: ${parseFloat(card?.initialAmount || 0).toFixed(2)} EUR\n`);
      await this._cap('lineWrap', { lines: 4 });
      return true;
    } catch (e) { throw e; }
  }

  async testPrint() {
    if (this._isCapacitor && this._bridge?.testPrint) {
      // Use the native Java testPrint — proven to work
      const result = await this._bridge.testPrint({});
      console.log('[Sunmi] native testPrint result:', JSON.stringify(result));
      return true;
    }
    // Fallback: use printBatch
    if (this._isCapacitor && this._bridge?.printBatch) {
      const commands = [
        { cmd: 'align', value: 1 },
        { cmd: 'size', value: 28 },
        { cmd: 'bold', enabled: true },
        { cmd: 'text', text: 'TEST IMPRESSION\n' },
        { cmd: 'size', value: 20 },
        { cmd: 'bold', enabled: false },
        { cmd: 'line', char: '=', len: 32 },
        { cmd: 'align', value: 0 },
        { cmd: 'text', text: 'CaissePro - Imprimante Sunmi\n' },
        { cmd: 'text', text: `Date: ${new Date().toLocaleString('fr-FR')}\n` },
        { cmd: 'text', text: 'Caracteres: EUR a e c u o\n' },
        { cmd: 'line', char: '=', len: 32 },
        { cmd: 'align', value: 1 },
        { cmd: 'text', text: 'Test OK !\n' },
        { cmd: 'feed', lines: 4 },
        { cmd: 'cut' },
      ];
      await this._bridge.printBatch({ commands });
      return true;
    }
    throw new Error('No print method available');
  }

  // Legacy methods (for non-Capacitor environments)
  async _legacyPrintReceipt(ticket, settings, companyInfo) {
    const s = settings || {};
    const co = companyInfo || {};
    const t = ticket || {};
    const fmt = (v) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
    try {
      await this._cap('printerInit', {});
      await this._cap('setAlignment', { alignment: 1 });
      await this._cap('setFontSize', { size: 28 });
      await this.printText((s.name || co.name || 'Ma Boutique') + '\n');
      await this._cap('setFontSize', { size: 20 });
      let dateStr = '';
      try { dateStr = new Date(t.date || t.createdAt || Date.now()).toLocaleString('fr-FR'); } catch (e) {}
      await this._cap('setAlignment', { alignment: 0 });
      await this.printText(`N: ${t.ticketNumber || '?'}  ${dateStr}\n`);
      await this.printText(`Caissier: ${t.userName || '?'}\n`);
      for (const item of (t.items || [])) {
        if (!item) continue;
        const name = item.product?.name || item.product_name || '?';
        const qty = item.quantity || 1;
        const lineTTC = Number(item.lineTTC || item.line_ttc || 0) || (Number(item.unit_price || 0) * qty);
        await this.printText(`${name} x${qty}  ${fmt(lineTTC)} EUR\n`);
      }
      await this.printText(`TOTAL TTC    ${fmt(t.totalTTC || t.total_ttc)} EUR\n`);
      await this._cap('lineWrap', { lines: 4 });
      try { await this._cap('cutPaper', {}); } catch (e) {}
      return true;
    } catch (e) { console.error('[Sunmi] legacy print error:', e); throw e; }
  }

  async _legacyPrintAvoir(avoir, settings, companyInfo) {
    const fmt = (v) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
    try {
      await this._cap('printerInit', {});
      await this.printText('AVOIR\n');
      await this.printText(`N: ${avoir?.avoirNumber || '?'}\n`);
      await this.printText(`TOTAL: -${fmt(avoir?.totalTTC)} EUR\n`);
      await this._cap('lineWrap', { lines: 4 });
      return true;
    } catch (e) { throw e; }
  }

  async _legacyPrintClosure(closure, settings, companyInfo) {
    const fmt = (v) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
    try {
      await this._cap('printerInit', {});
      await this.printText('CLOTURE DE CAISSE\n');
      await this.printText(`CA TTC: ${fmt(closure?.totalTTC || closure?.totalCA)} EUR\n`);
      await this._cap('lineWrap', { lines: 4 });
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
