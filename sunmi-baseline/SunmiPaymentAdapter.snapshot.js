class SunmiPaymentAdapter {
  constructor(config = {}) { this.config = config; this.connected = false; }

  async connect() {
    const bridge = _getPayBridge();
    if (bridge) {
      const hw = await bridge.detectHardware();
      if (hw.type === 'sunmi' && hw.hasBuiltInPayment) { this.connected = true; return true; }
    }
    return false;
  }

  async charge(amount, options = {}) {
    const bridge = _getPayBridge();
    if (bridge) {
      try {
        const result = await bridge.sale({
          amount: Math.round(amount * 100), currency: options.currency || 'EUR',
          reference: options.reference || `CP-${Date.now()}`, provider: 'sunmi',
        });
        if (result.requiresManual) return _manualPayment(amount, 'Encaissement', 'Sunmi TPE');
        return result;
      } catch (e) { return _manualPayment(amount, 'Encaissement', 'Sunmi TPE'); }
    }
    return _manualPayment(amount, 'Encaissement', 'Sunmi TPE');
  }

  async refund(amount, options = {}) {
    const bridge = _getPayBridge();
    if (bridge) {
      try {
        const result = await bridge.refund({
          amount: Math.round(amount * 100), reference: options.reference || '', provider: 'sunmi',
        });
        if (result.requiresManual) return _manualPayment(amount, 'Remboursement', 'Sunmi TPE');
        return result;
      } catch (e) { return _manualPayment(amount, 'Remboursement', 'Sunmi TPE'); }
    }
    return _manualPayment(amount, 'Remboursement', 'Sunmi TPE');
  }

  disconnect() { this.connected = false; }
}
