// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import api, { fmtGHS } from '../utils/api';

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    api.get('/reports/dashboard/').then(r => setKpis(r.data)).catch(() => {});
  }, []);

  const fleet  = kpis?.fleet         || {};
  const month  = kpis?.this_month    || {};
  const alerts = kpis?.expiry_alerts || [];

  return (
    <div>
      {alerts.length > 0 && (
        <div className="alert alert-warn mb16">
          ⚠️ <strong>{alerts.length} alert{alerts.length>1?'s':''}: </strong>
          {alerts.slice(0,3).map(a => `${a.truck_number} – ${a.name} expires in ${a.days_remaining}d`).join(' · ')}
        </div>
      )}

      {/* KPI Row */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Active Trucks</div>
          <div className="kpi-val" style={{ color: 'var(--blue)' }}>{fleet.active_trucks ?? '—'}</div>
          <div className="kpi-sub">🚛 {fleet.ongoing_trips ?? 0} on trip</div>
          <div className="kpi-track"><div className="kpi-fill" style={{ width: '80%', background: 'var(--blue)' }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Active Drivers</div>
          <div className="kpi-val">{fleet.active_drivers ?? '—'}</div>
          <div className="kpi-track"><div className="kpi-fill" style={{ width: '75%', background: 'var(--sky)' }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Trips This Month</div>
          <div className="kpi-val">{month.trips ?? '—'}</div>
          <div className="kpi-track"><div className="kpi-fill" style={{ width: '60%', background: '#7c3aed' }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Monthly Revenue</div>
          <div className="kpi-val" style={{ fontSize: 18, color: 'var(--green)' }}>{month.revenue ? fmtGHS(month.revenue) : '—'}</div>
          <div className="kpi-track"><div className="kpi-fill" style={{ width: '70%', background: 'var(--green)' }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Monthly Expenditure</div>
          <div className="kpi-val" style={{ fontSize: 18, color: 'var(--red)' }}>{month.expenditure ? fmtGHS(month.expenditure) : '—'}</div>
          <div className="kpi-track"><div className="kpi-fill" style={{ width: '50%', background: 'var(--red)' }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Net Profit (Month)</div>
          <div className="kpi-val" style={{ fontSize: 18, color: (month.net_profit||0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {month.net_profit != null ? fmtGHS(month.net_profit) : '—'}
          </div>
          <div className="kpi-track"><div className="kpi-fill" style={{ width: '65%', background: 'var(--amber)' }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Fuel Usage (Liters)</div>
          <div className="kpi-val" style={{ color: 'var(--blue)' }}>
            {month.fuel_litres != null ? month.fuel_litres.toLocaleString() + ' L' : '—'}
          </div>
          <div className="kpi-sub" style={{ color: 'var(--red)' }}>{month.fuel_excess_events ?? 0} excess events</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Stock Value</div>
          <div className="kpi-val" style={{ fontSize: 18, color: 'var(--blue)' }}>{kpis?.stock_value != null ? fmtGHS(kpis.stock_value) : '—'}</div>
          <div className="kpi-track"><div className="kpi-fill" style={{ width: '55%', background: 'var(--blue)' }} /></div>
        </div>
      </div>

      <div className="g2 mt16">
        {/* Alerts Timeline */}
        <div className="card">
          <div className="card-title"><span className="card-title-ic">🚨</span>Expiry Alerts</div>
          {alerts.length === 0 ? (
            <div className="alert alert-success">✓ No expiry alerts. All documents are current.</div>
          ) : (
            <div className="timeline">
              {alerts.map((a, i) => (
                <div className="tl-item" key={i}>
                  <div className={`tl-dot ${a.level === 'DANGER' ? 'danger' : 'warn'}`} />
                  <div className="tl-title">{a.truck_number} – {a.name}</div>
                  <div className="tl-sub">
                    Expires {new Date(a.date).toLocaleDateString('en-GB')} ·&nbsp;
                    <span style={{ color: a.level === 'DANGER' ? 'var(--red)' : 'var(--amber)', fontWeight: 500 }}>
                      {a.days_remaining} days remaining
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="card">
          <div className="card-title"><span className="card-title-ic">📊</span>Month at a Glance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Revenue',      val: month.revenue,      color: 'var(--green)', pct: 70 },
              { label: 'Expenditure',  val: month.expenditure,  color: 'var(--red)',   pct: 50 },
              { label: 'Net Profit',   val: month.net_profit,   color: 'var(--blue)',  pct: 65 },
            ].map((r, i) => (
              <div key={i}>
                <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--muted)' }}>{r.label}</span>
                  <span style={{ fontWeight: 600, color: r.color }}>{r.val != null ? fmtGHS(r.val) : '—'}</span>
                </div>
                <div className="prog-bar">
                  <div className="prog-fill" style={{ width: `${r.pct}%`, background: r.color }} />
                </div>
              </div>
            ))}
            <div style={{ margin: '8px 0', borderTop: '1px solid var(--border)' }} />
            <div className="flex justify-between" style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>Trips</span>
              <span style={{ fontWeight: 700 }}>{month.trips ?? '—'}</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>Fuel Used</span>
              <span style={{ fontWeight: 700 }}>{month.fuel_litres ? `${month.fuel_litres.toLocaleString()} L` : '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
