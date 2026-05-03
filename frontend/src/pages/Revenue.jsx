// src/pages/Revenue.jsx
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api, { fmtGHS, fmtDate } from '../utils/api';
import toast from 'react-hot-toast';

export default function RevenuePage() {
  const [items,  setItems]  = useState([]);
const [saving, setSaving] = useState(false);
const [search, setSearch] = useState('');
const [editing, setEditing] = useState(null);

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { source: 'HAULAGE', date: new Date().toISOString().split('T')[0] }
  });

  useEffect(() => { load(); }, []);

  const load = () => {
    api.get('/finance/revenue/').then(r => setItems(r.data.results || r.data)).catch(() => {});
  };
// Start editing a revenue record
const startEdit = (rec) => {
  setEditing(rec.id);
  reset({
    source: rec.source,
    amount: rec.amount,
    date: rec.date ? rec.date.split('T')[0] : '',
    reference: rec.reference,
    description: rec.description,
  });
};

// Delete a revenue record
const deleteRecord = async (id) => {
  if (!window.confirm('Delete this revenue record?')) return;
  try {
    await api.delete(`/finance/revenue/${id}/`);
    toast.success('Revenue deleted.');
    load();
  } catch (e) {
    toast.error('Failed to delete.');
  }
};
  const onSubmit = async (data) => {
  setSaving(true);
  try {
    const payload = { ...data, amount: parseFloat(data.amount) };
    if (editing) {
      await api.patch(`/finance/revenue/${editing}/`, payload);
      toast.success('Revenue updated.');
    } else {
      await api.post('/finance/revenue/', payload);
      toast.success('Revenue recorded.');
    }
    reset({ source: 'HAULAGE', date: new Date().toISOString().split('T')[0] });
    setEditing(null);
    load();
  } catch (e) {
    toast.error(e.response?.data?.detail || 'Failed to save.');
  } finally { setSaving(false); }
};

  const filtered = items.filter(i =>
    i.description?.toLowerCase().includes(search.toLowerCase()) ||
    i.reference?.toLowerCase().includes(search.toLowerCase())
  );

  const total   = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const haulage = items.filter(i => i.source === 'HAULAGE').reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const other   = items.filter(i => i.source === 'OTHER').reduce((s, i) => s + parseFloat(i.amount || 0), 0);

  // Monthly trend (last 6 months)
  const monthlyData = (() => {
    const map = {};
    items.forEach(i => {
      const m = i.date ? i.date.slice(0, 7) : null;
      if (m) map[m] = (map[m] || 0) + parseFloat(i.amount || 0);
    });
    return Object.entries(map).sort().slice(-6);
  })();

  return (
    <div>
      <div className="kpi-grid mb16" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {[
          { label: 'Total Revenue',  val: fmtGHS(total),   color: 'var(--green)' },
          { label: 'Transport Revenue', val: fmtGHS(haulage), color: 'var(--blue)'  },
          { label: 'Other Revenue',  val: fmtGHS(other),   color: 'var(--amber)' },
        ].map((k, i) => (
          <div key={i} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-val" style={{ color: k.color, fontSize: 15 }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div className="g2">
        {/* Form */}
        <div className="card">
          <div className="card-title"><span className="card-title-ic">💰</span>{editing ? 'Edit Revenue' : 'Record Revenue'}</div>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="fgrid">
              <div className="fg">
                <label>Source *</label>
                <select {...register('source', { required: true })}>
                  <option value="HAULAGE">HAULAGE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div className="fg">
                <label>Amount (GH₵) *</label>
                <input type="number" step="0.01" min="0" placeholder="0.00" {...register('amount', { required: true })} />
              </div>
              <div className="fg">
                <label>Date *</label>
                <input type="date" {...register('date', { required: true })} />
              </div>
              <div className="fg">
                <label>Reference No.</label>
                <input type="text" placeholder="INV-001" {...register('reference')} />
              </div>
            </div>
            <div className="fg mb16">
              <label>Description</label>
              <textarea rows={2} placeholder="Description of revenue source…" {...register('description')} />
            </div>
            <button type="submit" className="btn btn-success" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? '⏳ Saving…' : (editing ? 'Update Revenue' : '+ Record Revenue')}
            </button>
            {editing && <button type="button" className="btn btn-ghost mt8" style={{ width: '100%' }} onClick={() => { setEditing(null); reset({ source: 'HAULAGE', date: new Date().toISOString().split('T')[0] }); }}>Cancel</button>}
          </form>

          {/* Mini monthly chart */}
          {monthlyData.length > 0 && (
            <div className="mt16">
              <div className="sec-div">Monthly Trend</div>
              {monthlyData.map(([month, val]) => {
                const max = Math.max(...monthlyData.map(([,v]) => v));
                const pct = max > 0 ? (val / max) * 100 : 0;
                return (
                  <div key={month} className="prog-row">
                    <div className="prog-lbl" style={{ fontSize: 10, color: 'var(--muted)' }}>{month}</div>
                    <div className="prog-bar">
                      <div className="prog-fill" style={{ width: `${pct}%`, background: 'var(--green)' }} />
                    </div>
                    <div className="prog-val" style={{ fontSize: 10, width: 90, color: 'var(--green)', fontWeight: 600 }}>
                      {fmtGHS(val)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* List */}
        <div className="card">
          <div className="flex items-center justify-between mb12">
            <div className="card-title" style={{ margin: 0 }}>
              <span className="card-title-ic">📋</span>Revenue History
            </div>
            <div className="flex gap8">
              <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: 160, padding: '6px 10px', fontSize: 12 }} />
              <button className="export-btn excel" onClick={async () => {
                try {
                  const r = await api.get('/reports/revenue-expenditure/?format=excel', { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                  const a = document.createElement('a'); a.href = url; a.download = 'revenue_report.xlsx'; a.click(); URL.revokeObjectURL(url);
                  toast.success('Excel downloaded.');
                } catch { toast.error('Download failed.'); }
              }}>📊 Excel</button>
              <button className="export-btn pdf" onClick={async () => {
                try {
                  const r = await api.get('/reports/revenue-expenditure/?format=pdf', { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
                  const a = document.createElement('a'); a.href = url; a.download = 'revenue_report.pdf'; a.click(); URL.revokeObjectURL(url);
                  toast.success('PDF downloaded.');
                } catch { toast.error('Download failed.'); }
              }}>🖨️ PDF</button>
            </div>
          </div>
          <div className="tbl-wrap" style={{ maxHeight: 450, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>Date</th><th>Source</th><th>Description</th><th>Reference</th><th>Amount</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map(i => (
  <tr key={i.id}>
    <td style={{ fontSize: 11 }}>{fmtDate(i.date)}</td>
    <td><span className={`badge ${i.source === 'HAULAGE' ? 'b-green' : 'b-blue'}`}>{i.source}</span></td>
    <td style={{ fontSize: 11 }}>{i.description || '—'}</td>
    <td className="mono" style={{ fontSize: 11 }}>{i.reference || '—'}</td>
    <td className="ced" style={{ color: 'var(--green)', fontWeight: 700 }}>+ {fmtGHS(i.amount)}</td>
    <td>
      <div className="flex gap4">
        <button className="btn btn-ghost btn-xs" onClick={() => startEdit(i)}>Edit</button>
        <button className="btn btn-danger btn-xs" onClick={() => deleteRecord(i.id)}>Del</button>
      </div>
    </td>
  </tr>
))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
