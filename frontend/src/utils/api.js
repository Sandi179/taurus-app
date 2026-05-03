// src/utils/api.js  – Axios instance with JWT auto-refresh
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({ baseURL: BASE, headers: { 'Content-Type': 'application/json' } });

// Attach access token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// On 401 → refresh token once, then retry
api.interceptors.response.use(
  r => r,
  async err => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      try {
        const refresh = localStorage.getItem('refresh');
        const { data } = await axios.post(`${BASE}/auth/refresh/`, { refresh });
        localStorage.setItem('access', data.access);
        orig.headers.Authorization = `Bearer ${data.access}`;
        return api(orig);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Convenience wrappers ──────────────────────────────────────
export const calcPurchase = (qty, price, vatOn, vatPct) => {
  const base = parseFloat(qty || 0) * parseFloat(price || 0);
  const vat  = vatOn ? base * (parseFloat(vatPct || 0) / 100) : 0;
  return { base_amount: base, vat_amount: vat, final_amount: base + vat };
};

export const calcInvoiceLine = (qty, rate) => {
  return parseFloat(qty || 0) * parseFloat(rate || 0);
};

export const calcInvoiceTotals = (lines, vatOn, vatPct) => {
  const subtotal = lines.reduce((s, l) => s + calcInvoiceLine(l.quantity, l.unit_price), 0);
  const vat      = vatOn ? subtotal * (parseFloat(vatPct || 0) / 100) : 0;
  return { subtotal, vat_amount: vat, total_amount: subtotal + vat };
};

export const calcFuel = (litres, limit, pricePerLitre) => {
  const l   = parseFloat(litres || 0);
  const lim = parseFloat(limit  || 0);
  return {
    excess_fuel: Math.max(0, l - lim),
    total_cost:  l * parseFloat(pricePerLitre || 0),
  };
};

export const calcTrip = (loadedQty, deliveredQty, ratePerTon) => {
  const loaded    = parseFloat(loadedQty    || 0);
  const delivered = parseFloat(deliveredQty || 0);
  const rate      = parseFloat(ratePerTon   || 0);
  return {
    qty_difference: loaded - delivered,
    trip_revenue:   delivered * rate,
  };
};

export const calcDuration = (loadingTime, unloadingTime) => {
  if (!loadingTime || !unloadingTime) return null;
  const diff = new Date(unloadingTime) - new Date(loadingTime);
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
};

export const fmtGHS = v => `GH₵ ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;
export const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB') : '—';
export const fmtNum  = v => parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 });
