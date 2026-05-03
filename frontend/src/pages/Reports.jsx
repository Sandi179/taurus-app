// src/pages/Reports.jsx – All reports with PDF & Excel export
import { useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const REPORTS = [
  { key: 'stock',                label: 'Stock Report',              icon: '📦', color: 'var(--blue)'  },
  { key: 'spare-parts',          label: 'Spare Parts',               icon: '🔧', color: 'var(--muted)' },
  { key: 'tyres',                label: 'Tyre Report',               icon: '🛞', color: '#7c3aed'       },
  { key: 'trips',                label: 'Trip Report',               icon: '🗺️', color: 'var(--sky)'   },
  { key: 'fuel',                 label: 'Fuel Report',               icon: '⛽', color: 'var(--amber)'  },
  { key: 'revenue-expenditure',  label: 'Revenue vs Expenditure',    icon: '💰', color: 'var(--green)'  },
  { key: 'vat',                  label: 'VAT Report',                icon: '🧮', color: 'var(--red)'    },
  { key: 'maintenance',          label: 'Maintenance Report',        icon: '🛠️', color: '#0369a1'       },
];

export default function ReportsPage() {
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30*86400000).toISOString().split('T')[0]);
  const [dateTo,   setDateTo]   = useState(today);
  const [active,   setActive]   = useState('stock');
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  const currentReport = REPORTS.find(r => r.key === active);

  const fetch_report = async (fmt = 'json') => {
    setLoading(true);
    try {
      const params = { date_from: dateFrom, date_to: dateTo, format: fmt };

      if (fmt !== 'json') {
        const resp = await api.get(`/reports/${active}/`, { params, responseType: 'blob' });
        const ext  = fmt === 'pdf' ? 'pdf' : 'xlsx';
        const mime = fmt === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const blob = new Blob([resp.data], { type: mime });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `taurus_${active}_${dateTo}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${currentReport.label} exported as ${fmt.toUpperCase()}.`);
      } else {
        const resp = await api.get(`/reports/${active}/`, { params });
        setData(resp.data);
      }
    } catch (e) {
      toast.error('Report generation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Report selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {REPORTS.map(r => (
          <button key={r.key}
            className={`btn ${active === r.key ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderColor: active === r.key ? undefined : r.color, color: active !== r.key ? r.color : undefined }}
            onClick={() => { setActive(r.key); setData(null); }}>
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      {/* Filters & export */}
      <div className="card mb16">
        <div className="card-title">
          <span className="card-title-ic">{currentReport?.icon}</span>
          {currentReport?.label}
        </div>
        <div className="export-bar">
          <div className="date-inputs">
            <label style={{ margin: 0, marginRight: 4 }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <label style={{ margin: '0 4px' }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => fetch_report('json')} disabled={loading}>
            {loading ? '⏳ Loading…' : '🔍 Generate Report'}
          </button>
          <button className="export-btn excel" onClick={() => fetch_report('excel')} disabled={loading}>
            📊 Export Excel
          </button>
          <button className="export-btn pdf" onClick={() => fetch_report('pdf')} disabled={loading}>
            🖨️ Export PDF
          </button>
        </div>

        {/* Summary Cards */}
        {data?.summary && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '14px 0' }}>
            {Object.entries(data.summary).map(([k, v]) => (
              <div key={k} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 16px', minWidth: 160,
              }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>
                  {typeof v === 'number'
                    ? v % 1 !== 0
                      ? `GH₵ ${v.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
                      : v.toLocaleString()
                    : v}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Data Table */}
        {data && (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  {data.headers.map((h, i) => <th key={i}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr><td colSpan={data.headers.length} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                    No data for selected period
                  </td></tr>
                )}
                {data.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={typeof cell === 'number' && cell % 1 !== 0 ? 'ced' : ''}>
                        {typeof cell === 'number'
                          ? cell % 1 !== 0
                            ? cell.toLocaleString('en-GH', { minimumFractionDigits: 2 })
                            : cell.toLocaleString()
                          : cell === null || cell === '' ? '—' : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!data && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{currentReport?.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Click "Generate Report" to load data</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Use Export buttons to download PDF or Excel</div>
          </div>
        )}
      </div>

      {/* Fuel excess incidents (only for fuel report) */}
      {data?.excess_incidents && data.excess_incidents.length > 0 && (
        <div className="card">
          <div className="card-title"><span className="card-title-ic">🔴</span>Fuel Excess Incidents</div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Truck</th><th>Limit (L)</th><th>Issued (L)</th><th>Excess (L)</th><th>Remark</th></tr>
              </thead>
              <tbody>
                {data.excess_incidents.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, ci) => (
                      <td key={ci}>
                        {ci === 4 && parseFloat(cell) > 0
                          ? <span className="badge b-red">+{cell}L</span>
                          : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
