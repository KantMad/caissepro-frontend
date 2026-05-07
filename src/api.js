// ═══════════════════════════════════════
// CaissePro — Service API
// ═══════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || 'https://api.techincash.app';

let token = null;
try { token = sessionStorage.getItem('caissepro_token'); } catch(e) {}

export function setToken(t) { token = t; try { if(t) sessionStorage.setItem('caissepro_token', t); else sessionStorage.removeItem('caissepro_token'); } catch(e) {} }
export function getToken() { return token; }
export function clearToken() { token = null; try { sessionStorage.removeItem('caissepro_token'); } catch(e) {} }

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  
  // Handle file downloads (FEC, etc.)
  const ct = res.headers.get('content-type');
  if (ct && ct.includes('text/plain')) {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.headers.get('content-disposition')?.split('filename=')[1] || 'export.txt';
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  }
  
  return res.json();
}

// ══ Auth ══
export const auth = {
  login: (name, password) => api('/api/auth/login', { method: 'POST', body: JSON.stringify({ name, password }) }),
  me: () => api('/api/auth/me'),
  profiles: () => api('/api/auth/profiles'),
  users: () => api('/api/auth/users'),
  createUser: (data) => api('/api/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => api(`/api/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => api(`/api/auth/users/${id}`, { method: 'DELETE' }),
  clock: (type) => api('/api/auth/clock', { method: 'POST', body: JSON.stringify({ type }) }),
};

// ══ Products ══
export const products = {
  list: (params) => api('/api/products?' + new URLSearchParams(params || {})),
  get: (id) => api(`/api/products/${id}`),
  create: (data) => api('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => api(`/api/products/${id}`, { method: 'DELETE' }),
  duplicate: (id) => api(`/api/products/${id}/duplicate`, { method: 'POST' }),
  addVariant: (id, data) => api(`/api/products/${id}/variants`, { method: 'POST', body: JSON.stringify(data) }),
  removeVariant: (id, variantId) => api(`/api/products/${id}/variants/${variantId}`, { method: 'DELETE' }),
  findByEAN: (ean) => api(`/api/products/find/ean/${ean}`),
  categories: () => api('/api/products/categories/list'),
};

// ══ Sales ══
export const sales = {
  checkout: (data) => api('/api/sales/checkout', { method: 'POST', body: JSON.stringify(data) }),
  list: (params) => api('/api/sales?' + new URLSearchParams(params || {})),
  get: (id) => api(`/api/sales/${id}`),
  void: (saleId, reason) => api('/api/sales/void', { method: 'POST', body: JSON.stringify({ saleId, reason }) }),
  stats: () => api('/api/sales/stats/summary'),
  bestSellers: () => api('/api/sales/stats/best-sellers'),
  bySeller: () => api('/api/sales/stats/by-seller'),
  byDay: () => api('/api/sales/stats/by-day'),
};

// ══ Customers ══
export const customers = {
  list: (search) => api('/api/customers?' + new URLSearchParams(search ? { search } : {})),
  create: (data) => api('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => api(`/api/customers/${id}`, { method: 'DELETE' }),
  history: (id) => api(`/api/customers/${id}/history`),
  rgpd: (id) => api(`/api/customers/${id}/rgpd`),
  tiers: () => api('/api/customers/loyalty/tiers'),
};

// ══ Stock ══
export const stock = {
  alerts: () => api('/api/stock/alerts'),
  movements: (params) => api('/api/stock/movements?' + new URLSearchParams(params || {})),
  receive: (data) => api('/api/stock/receive', { method: 'POST', body: JSON.stringify(data) }),
  adjust: (data) => api('/api/stock/adjust', { method: 'POST', body: JSON.stringify(data) }),
  aging: () => api('/api/stock/aging'),
  reorder: () => api('/api/stock/reorder'),
};

// ══ Fiscal ══
export const fiscal = {
  closure: (data) => api('/api/fiscal/closure', { method: 'POST', body: JSON.stringify(data) }),
  closures: () => api('/api/fiscal/closures'),
  fec: () => api('/api/fiscal/fec'),
  archive: () => api('/api/fiscal/archive').then(data => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `archive-${new Date().toISOString().split('T')[0]}.json`; a.click();
    return data;
  }),
  verifyChain: () => api('/api/fiscal/verify-chain'),
  tvaSummary: (params) => api('/api/fiscal/tva-summary?' + new URLSearchParams(params || {})),
  counter: () => api('/api/fiscal/counter'),
};

// ══ Audit ══
export const audit = {
  list: (params) => api('/api/audit?' + new URLSearchParams(params || {})),
  create: (action, detail, reference) => api('/api/audit', { method: 'POST', body: JSON.stringify({ action, detail, reference }) }),
  jet: () => api('/api/audit/jet'),
  createJet: (eventType, detail) => api('/api/audit/jet', { method: 'POST', body: JSON.stringify({ eventType, detail }) }),
  clock: () => api('/api/audit/clock'),
  priceHistory: () => api('/api/audit/price-history'),
};

// ══ Settings ══
export const settings = {
  get: () => api('/api/settings'),
  update: (data) => api('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  promos: () => api('/api/settings/promos'),
  activePromos: () => api('/api/settings/promos/active'),
  createPromo: (data) => api('/api/settings/promos', { method: 'POST', body: JSON.stringify(data) }),
  togglePromo: (id) => api(`/api/settings/promos/${id}/toggle`, { method: 'PUT' }),
  taxRates: () => api('/api/settings/tax-rates'),
  openRegister: (amount) => api('/api/settings/register/open', { method: 'POST', body: JSON.stringify({ openingAmount: amount }) }),
  closeRegister: (id, data) => api(`/api/settings/register/${id}/close`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ══ Health ══
export const health = () => api('/api/health');
