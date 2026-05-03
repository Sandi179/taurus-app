// src/pages/Issue.jsx – Issue items with live stock check & auto-calc
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api, { fmtGHS } from '../utils/api';
import toast from 'react-hot-toast';

export default function IssuePage() {
  const [items,     setItems]     = useState([]);
  const [locations, setLocations] = useState([]);
  const [trucks,    setTrucks]    = useState([]);
  const [history,   setHistory]   = useState([]);
  const [avail,     setAvail]     = useState(null);
  const [unitPrice, setUnitPrice] = useState(0);
  const [totalVal,  setTotalVal]  = useState(0);
  const [stockErr,  setStockErr]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editing,   setEditing]   = useState(null);

  const { register, handleSubmit, watch, reset } = useForm({
    defaultValues: { issue_type: 'TRUCK', quantity: '' }
  });

  const watchedItem  = watch('item_id');
  const watchedLoc   = watch('location_id');
  const watchedQty   = watch('quantity');
  const watchedType  = watch('issue_type');

  // Load dropdowns
  useEffect(() => { load(); }, []);

  const load = () => {
    api.get('/inventory/items/').then(r  => setItems(r.data.results    || r.data));
    api.get('/inventory/locations/').then(r => setLocations(r.data.results || r.data));
    api.get('/trucks/?status=ACTIVE').then(r => setTrucks(r.data.results || r.data));
    api.get('/inventory/issues/').then(r => setHistory(r.data.results || r.data));
  };

  const startEdit = (i) => {
    setEditing(i.id);
    reset({
      issue_date: i.issue_date,
      issue_type: i.issue_type,
      item_id: i.item,
      location_id: i.location,
      truck_id: i.truck || '',
      quantity: i.quantity,
      remark: i.remark
    });
  };

  const deleteRecord = async (id) => {
    if (!window.confirm('Delete this issue? This will adjust stock ledger.')) return;
    try {
      await api.delete(`/inventory/issues/${id}/`);
      toast.success('Issue deleted.');
      load();
    } catch (e) {
      toast.error('Failed to delete.');
    }
  };

  // When item OR location changes → fetch available qty
  useEffect(() => {
    if (!watchedItem) { setAvail(null); setUnitPrice(0); return; }
    const params = { item: watchedItem };
    if (watchedLoc) params.location = watchedLoc;
    api.get('/inventory/available-stock/', { params })
      .then(r => {
        setAvail(r.data.available_qty);
        // Get last unit price from ledger
        api.get('/inventory/ledger/', { params: { item: watchedItem, transaction_type: 'PURCHASE' } })
          .then(lr => {
            const rows = lr.data.results || lr.data;
            if (rows.length > 0) setUnitPrice(parseFloat(rows[0].unit_price) || 0);
          });
      })
      .catch(() => setAvail(null));
  }, [watchedItem, watchedLoc]);

  // Live total value calculation
  useEffect(() => {
    const qty = parseFloat(watchedQty) || 0;
    setTotalVal(qty * unitPrice);
    setStockErr(avail !== null && qty > parseFloat(avail));
  }, [watchedQty, unitPrice, avail]);

  const onSubmit = async (data) => {
    if (stockErr) { toast.error('Insufficient stock. Cannot issue.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...data,
        quantity:   parseFloat(data.quantity),
        truck_id:   data.truck_id || null,
        issue_date: data.issue_date,
      };
      if (editing) {
        await api.patch(`/inventory/issues/${editing}/`, payload);
        toast.success('Issue updated.');
      } else {
        await api.post('/inventory/issues/', payload);
        toast.success('Issue recorded. Stock ledger debited.');
      }
      reset();
      setEditing(null);
      setAvail(null); setUnitPrice(0); setTotalVal(0);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to record issue.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb16">
        <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Stock is validated live. Issue is blocked if quantity exceeds available stock.
        </p>
      </div>

      <div className="g2">
        {/* ── Issue Form ── */}
        <div className="card">
          <div className="card-title"><span className="card-title-ic">📤</span>{editing ? 'Edit Issued Item' : 'Issue Item from Stock'}</div>
          <form onSubmit={handleSubmit(onSubmit)}>

            <div className="sec-div">Issue Details</div>
            <div className="fgrid">
              <div className="fg">
                <label>Issue Date *</label>
                <input type="date" {...register('issue_date', { required: true })} />
              </div>
              <div className="fg">
                <label>Issue Type *</label>
                <select {...register('issue_type', { required: true })}>
                  <option value="TRUCK">TRUCK</option>
                  <option value="WORKSHOP">WORKSHOP</option>
                  <option value="BREAKDOWN">BREAKDOWN</option>
                </select>
              </div>
              <div className="fg">
                <label>Item *</label>
                <select {...register('item_id', { required: true })}>
                  <option value="">— Select Item —</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Issue From (Location) *</label>
                <select {...register('location_id', { required: true })}>
                  <option value="">— Select Location —</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              {watchedType === 'TRUCK' && (
                <div className="fg">
                  <label>Truck</label>
                  <select {...register('truck_id')}>
                    <option value="">— Select Truck —</option>
                    {trucks.map(t => (
                      <option key={t.id} value={t.id}>{t.truck_number} – {t.model}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="sec-div">Quantity & Live Stock Check</div>
            <div className="fgrid">
              <div className="fg">
                <label>Available Stock</label>
                <div className="calc-box" style={{ color: avail === null ? 'var(--muted)' : avail > 0 ? 'var(--green)' : 'var(--red)' }}>
                  {avail === null ? 'Select item & location' : `${parseFloat(avail).toFixed(3)} units`}
                </div>
              </div>
              <div className="fg">
                <label>Unit Price (GH₵)</label>
                <div className="calc-box">{unitPrice > 0 ? fmtGHS(unitPrice) : '—'}</div>
              </div>
              <div className="fg">
                <label>Quantity to Issue *</label>
                <input type="number" step="0.001" min="0.001" placeholder="0"
                       {...register('quantity', { required: true, min: 0.001 })}
                       style={{ borderColor: stockErr ? 'var(--red)' : undefined }} />
              </div>
              <div className="fg">
                <label>Total Value (GH₵) — Auto</label>
                <div className="calc-box">{fmtGHS(totalVal)}</div>
              </div>
            </div>

            {/* Stock status indicator */}
            {stockErr && (
              <div className="excess-warn">
                ⛔ Insufficient stock. Available: {parseFloat(avail || 0).toFixed(3)} · Requested: {watch('quantity')}. Issue blocked.
              </div>
            )}
            {!stockErr && avail !== null && parseFloat(watch('quantity') || 0) > 0 && (
              <div className="stock-ok">
                ✓ Stock sufficient. Ready to issue.
              </div>
            )}

            <div className="fg mt12">
              <label>Remark</label>
              <input type="text" placeholder="Purpose / job reference" {...register('remark')} />
            </div>

            <div className="flex gap8 mt16">
              <button type="submit" className="btn btn-amber" disabled={saving || stockErr}>
                {saving ? '⏳ Processing…' : editing ? '✓ Update Issue' : '↗ Issue Item'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { reset(); setEditing(null); setAvail(null); setUnitPrice(0); setTotalVal(0); }}>
                {editing ? 'Cancel' : 'Clear'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Issue History ── */}
        <div className="card">
          <div className="flex items-center justify-between mb4">
            <div className="card-title" style={{ margin: 0 }}><span className="card-title-ic">📋</span>Recent Issues</div>
            <div className="flex gap8">
              <button className="export-btn excel" onClick={async () => {
                try {
                  const r = await api.get('/reports/spare-parts/?format=excel', { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                  const a = document.createElement('a'); a.href = url; a.download = 'issues_report.xlsx'; a.click(); URL.revokeObjectURL(url);
                  toast.success('Excel downloaded.');
                } catch { toast.error('Download failed.'); }
              }}>📊 Excel</button>
              <button className="export-btn pdf" onClick={async () => {
                try {
                  const r = await api.get('/reports/spare-parts/?format=pdf', { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
                  const a = document.createElement('a'); a.href = url; a.download = 'issues_report.pdf'; a.click(); URL.revokeObjectURL(url);
                  toast.success('PDF downloaded.');
                } catch { toast.error('PDF download failed.'); }
              }}>🖨️ PDF</button>
            </div>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Item</th><th>Type</th><th>Truck</th>
                  <th>Qty</th><th>Value (GH₵)</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No issues yet</td></tr>
                )}
                {history.map(i => (
                  <tr key={i.id}>
                    <td>{new Date(i.issue_date).toLocaleDateString('en-GB')}</td>
                    <td>{i.item_name}</td>
                    <td><span className={`badge ${i.issue_type === 'TRUCK' ? 'b-blue' : 'b-amber'}`}>{i.issue_type}</span></td>
                    <td className="mono">{i.truck_number || '—'}</td>
                    <td>{i.quantity}</td>
                    <td className="ced">{parseFloat(i.final_amount).toFixed(2)}</td>
                    <td>
                      <div className="flex gap4">
                        <button className="btn btn-ghost btn-xs" onClick={() => startEdit(i)}>Edit</button>
                        <button className="btn btn-danger btn-xs" onClick={() => deleteRecord(i.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
