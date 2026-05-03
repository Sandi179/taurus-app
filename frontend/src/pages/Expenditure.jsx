// src/pages/Expenditure.jsx
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api, { fmtGHS, fmtDate } from '../utils/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['FUEL','MAINTENANCE','TYRE','SPARE_PART','DRIVER_WAGE','TOLL','ADMIN','OTHER'];
const CAT_BADGE  = { FUEL:'b-blue', MAINTENANCE:'b-amber', TYRE:'b-gray', SPARE_PART:'b-navy', DRIVER_WAGE:'b-purple', TOLL:'b-gray', ADMIN:'b-green', OTHER:'b-gray' };

export default function ExpenditurePage() {
  const [items,   setItems]   = useState([]);
  const [trucks,  setTrucks]  = useState([]);
  const [saving,  setSaving]  = useState(false);
  const [search,  setSearch]  = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [editing, setEditing] = useState(null);

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { date: new Date().toISOString().split('T')[0] }
  });

  useEffect(() => { load(); }, []);

  const load = () => {
    api.get('/finance/expenditure/').then(r => setItems(r.data.results || r.data)).catch(() => {});
    api.get('/trucks/?status=ACTIVE').then(r => setTrucks(r.data.results || r.data)).catch(() => {});
  };

  const startEdit = (rec) => {
    setEditing(rec.id);
    reset({
      ...rec,
      date: rec.date ? rec.date.split('T')[0] : '',
      truck: rec.truck || ''
    });
  };

  const deleteRecord = async (id) => {
    if (!window.confirm('Delete this expenditure?')) return;
    try {
      await api.delete(`/finance/expenditure/${id}/`);
      toast.success('Expenditure deleted.');
      load();
    } catch (e) {
      toast.error('Failed to delete.');
    }
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const payload = { ...data, truck: data.truck || null, amount: parseFloat(data.amount) };
      if (editing) {
        await api.patch(`/finance/expenditure/${editing}/`, payload);
        toast.success('Expenditure updated.');
      } else {
        await api.post('/finance/expenditure/', payload);
        toast.success('Expenditure recorded.');
      }
      reset({ date: new Date().toISOString().split('T')[0] });
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const filtered = items.filter(i => {
    const matchSearch = i.description?.toLowerCase().includes(search.toLowerCase()) ||
                        i.reference?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || i.category === filterCat;
    return matchSearch && matchCat;
  });

  const total     = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const byCategory = CATEGORIES.reduce((acc, c) => {
    acc[c] = items.filter(i => i.category === c).reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    return acc;
  }, {});

  return (
    <div>
      <div className="kpi-grid mb16" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { label: 'Total Expenditure', val: fmtGHS(total),                        color: 'var(--red)'   },
          { label: 'Fuel Costs',        val: fmtGHS(byCategory.FUEL),             color: 'var(--blue)'  },
          { label: 'Maintenance',       val: fmtGHS(byCategory.MAINTENANCE),      color: 'var(--amber)' },
          { label: 'Driver Wages',      val: fmtGHS(byCategory.DRIVER_WAGE),      color: 'var(--green)' },
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
          <div className="card-title"><span className="card-title-ic">💸</span>{editing ? 'Edit Expenditure' : 'Record Expenditure'}</div>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="fgrid">
              <div className="fg">
                <label>Category *</label>
                <select {...register('category', { required: true })}>
                  <option value="">— Select —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
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
                <label>Truck (optional)</label>
                <select {...register('truck')}>
                  <option value="">— Not truck-specific —</option>
                  {trucks.map(t => <option key={t.id} value={t.id}>{t.truck_number}</option>)}
                </select>
              </div>
              <div className="fg">
                <label>Reference / Receipt No.</label>
                <input type="text" placeholder="RCPT-001" {...register('reference')} />
              </div>
            </div>
            <div className="fg mb16">
              <label>Description</label>
              <textarea rows={2} placeholder="Details about this expense…" {...register('description')} />
            </div>
            <div className="flex gap8 mt16">
              <button type="submit" className="btn btn-danger" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                {saving ? '⏳ Saving…' : editing ? '✓ Update' : '+ Record'}
              </button>
              {editing && (
                <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); reset(); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List */}
        <div className="card">
          <div className="flex items-center justify-between mb12">
            <div className="card-title" style={{ margin: 0 }}>
              <span className="card-title-ic">📋</span>Expenditure History
            </div>
            <div className="flex gap8">
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1.5px solid var(--border)' }}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
              <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: 140, padding: '6px 10px', fontSize: 12 }} />
              <button className="export-btn excel" onClick={async () => {
                try {
                  const r = await api.get('/reports/revenue-expenditure/?format=excel', { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                  const a = document.createElement('a'); a.href = url; a.download = 'expenditure_report.xlsx'; a.click(); URL.revokeObjectURL(url);
                  toast.success('Excel downloaded.');
                } catch { toast.error('Download failed.'); }
              }}>📊 Excel</button>
              <button className="export-btn pdf" onClick={async () => {
                try {
                  const r = await api.get('/reports/revenue-expenditure/?format=pdf', { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
                  const a = document.createElement('a'); a.href = url; a.download = 'expenditure_report.pdf'; a.click(); URL.revokeObjectURL(url);
                  toast.success('PDF downloaded.');
                } catch { toast.error('Download failed.'); }
              }}>🖨️ PDF</button>
            </div>
          </div>
          <div className="tbl-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>Date</th><th>Category</th><th>Truck</th><th>Description</th><th>Ref</th><th>Amount</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map(i => (
                  <tr key={i.id}>
                    <td style={{ fontSize: 11 }}>{fmtDate(i.date)}</td>
                    <td><span className={`badge ${CAT_BADGE[i.category] || 'b-gray'}`}>{i.category?.replace('_',' ')}</span></td>
                    <td className="mono" style={{ fontSize: 11 }}>{i.truck_number || '—'}</td>
                    <td style={{ fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.description || '—'}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{i.reference || '—'}</td>
                    <td className="ced" style={{ color: 'var(--red)' }}>- {fmtGHS(i.amount)}</td>
                    <td>
                      <div className="flex gap4">
                        <button className="btn btn-ghost btn-xs" onClick={() => startEdit(i)}>Edit</button>
                        <button className="btn btn-danger btn-xs" onClick={() => deleteRecord(i.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
