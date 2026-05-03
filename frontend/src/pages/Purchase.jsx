// src/pages/Purchase.jsx – Full auto-calculation on every keystroke
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api, { calcPurchase, fmtGHS } from '../utils/api';
import toast from 'react-hot-toast';

export default function PurchasePage() {
  const [items,     setItems]     = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [history,   setHistory]   = useState([]);
  const [computed,  setComputed]  = useState({ base_amount: 0, vat_amount: 0, final_amount: 0 });
  const [saving,    setSaving]    = useState(false);
  const [editing,   setEditing]   = useState(null);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: { quantity: '', unit_price: '', vat_applicable: false, vat_percentage: 15 }
  });

  const watched = watch(['quantity', 'unit_price', 'vat_applicable', 'vat_percentage']);

  // ── Auto-calculate on every input change ──────────────────
  useEffect(() => {
    const [qty, price, vatOn, vatPct] = watched;
    setComputed(calcPurchase(qty, price, vatOn, vatPct));
  }, [watched[0], watched[1], watched[2], watched[3]]);

  // ── Load dropdowns ────────────────────────────────────────
  useEffect(() => { load(); }, []);

  const load = () => {
    Promise.all([
      api.get('/inventory/items/'),
      api.get('/inventory/locations/'),
      api.get('/inventory/purchases/'),
    ]).then(([i, l, h]) => {
      setItems(i.data.results || i.data);
      setLocations(l.data.results || l.data);
      setHistory(h.data.results || h.data);
    }).catch(() => {});
    api.get('/users/').then(r => setSuppliers(r.data.results || r.data)).catch(() => {});
  };

  const startEdit = (p) => {
    setEditing(p.id);
    reset({
      purchase_date: p.purchase_date,
      supplier_id: p.supplier,
      item_id: p.item,
      location_id: p.location,
      quantity: p.quantity,
      unit_price: p.unit_price,
      vat_applicable: p.vat_applicable,
      vat_percentage: p.vat_percentage,
      invoice_number: p.invoice_number,
      remark: p.remark
    });
  };

  const deleteRecord = async (id) => {
    if (!window.confirm('Delete this purchase? This will adjust stock ledger.')) return;
    try {
      await api.delete(`/inventory/purchases/${id}/`);
      toast.success('Purchase deleted.');
      load();
    } catch (e) {
      toast.error('Failed to delete.');
    }
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        quantity:       parseFloat(data.quantity),
        unit_price:     parseFloat(data.unit_price),
        vat_percentage: parseFloat(data.vat_percentage || 0),
      };
      if (editing) {
        await api.patch(`/inventory/purchases/${editing}/`, payload);
        toast.success('Purchase updated.');
      } else {
        await api.post('/inventory/purchases/', payload);
        toast.success('Purchase posted. Stock ledger updated.');
      }
      reset();
      setEditing(null);
      setComputed({ base_amount: 0, vat_amount: 0, final_amount: 0 });
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save purchase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb16">
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          All amounts are auto-calculated. VAT is configurable per transaction.
        </div>
        <span className="badge b-blue">GH₵ · Ghana Cedi</span>
      </div>

      <div className="g2">
        {/* ── Entry Form ── */}
        <div className="card">
          <div className="card-title"><span className="card-title-ic">📥</span>{editing ? 'Edit Purchase Entry' : 'New Purchase Entry'}</div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="sec-div">Supplier & Item</div>
            <div className="fgrid">
              <div className="fg">
                <label>Purchase Date *</label>
                <input type="date" {...register('purchase_date', { required: true })} />
              </div>
              <div className="fg">
                <label>Supplier *</label>
                <select {...register('supplier_id', { required: true })}>
                  <option value="">— Select Supplier —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="fg">
                <label>Item *</label>
                <select {...register('item_id', { required: true })}>
                  <option value="">— Select Item —</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.item_type})</option>)}
                </select>
              </div>
              <div className="fg">
                <label>Destination Location *</label>
                <select {...register('location_id', { required: true })}>
                  <option value="">— Select Location —</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            <div className="sec-div">Quantity & Pricing — Auto-Calculated</div>
            <div className="fgrid">
              <div className="fg">
                <label>Quantity *</label>
                <input type="number" step="0.001" min="0" placeholder="0"
                       {...register('quantity', { required: true, min: 0.001 })} />
              </div>
              <div className="fg">
                <label>Unit Price (GH₵) *</label>
                <input type="number" step="0.01" min="0" placeholder="0.00"
                       {...register('unit_price', { required: true, min: 0 })} />
              </div>
            </div>

            {/* ── Live Calculation Preview ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div className="fg">
                <label>Base Amount (Qty × Price)</label>
                <div className="calc-box">{fmtGHS(computed.base_amount)}</div>
              </div>
              <div className="fg">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" style={{ width: 'auto' }} {...register('vat_applicable')} />
                  Apply VAT &nbsp;
                  <input type="number" step="0.1" min="0" max="100"
                         style={{ width: 70, display: 'inline-block' }}
                         {...register('vat_percentage')} />
                  <span style={{ fontSize: 12 }}>%</span>
                </label>
                <div className="calc-box" style={{ color: watch('vat_applicable') ? 'var(--blue)' : 'var(--muted)' }}>
                  {fmtGHS(computed.vat_amount)}
                </div>
              </div>
            </div>

            {/* ── Totals Breakdown ── */}
            <div className="vat-breakdown">
              <div className="vb-row"><span style={{ color: 'var(--muted)' }}>Base Amount</span><strong>{fmtGHS(computed.base_amount)}</strong></div>
              <div className="vb-row"><span style={{ color: 'var(--muted)' }}>VAT {watch('vat_applicable') ? `(${watch('vat_percentage')}%)` : '(N/A)'}</span><strong>{fmtGHS(computed.vat_amount)}</strong></div>
              <div className="vb-row total"><span>Total Payable</span><span style={{ fontSize: 16 }}>{fmtGHS(computed.final_amount)}</span></div>
            </div>

            <div className="sec-div" style={{ marginTop: 14 }}>Reference</div>
            <div className="fgrid">
              <div className="fg">
                <label>Supplier Invoice No.</label>
                <input type="text" placeholder="e.g. INV-2026-0001" {...register('invoice_number')} />
              </div>
              <div className="fg">
                <label>Remark</label>
                <input type="text" placeholder="Optional note" {...register('remark')} />
              </div>
            </div>

            <div className="flex gap8 mt16">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '⏳ Saving…' : editing ? '✓ Update Purchase' : '✓ Post Purchase'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { reset(); setEditing(null); setComputed({ base_amount: 0, vat_amount: 0, final_amount: 0 }); }}>
                {editing ? 'Cancel' : 'Clear'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Recent Purchases ── */}
        <div className="card">
          <div className="flex items-center justify-between mb4">
            <div className="card-title" style={{ margin: 0 }}><span className="card-title-ic">📋</span>Recent Purchases</div>
            <div className="flex gap8">
              <button className="export-btn excel" onClick={async () => {
                try {
                  const r = await api.get('/reports/spare-parts/?format=excel', { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                  const a = document.createElement('a'); a.href = url; a.download = 'purchases_report.xlsx'; a.click(); URL.revokeObjectURL(url);
                  toast.success('Excel downloaded.');
                } catch { toast.error('Download failed.'); }
              }}>📊 Excel</button>
              <button className="export-btn pdf" onClick={async () => {
                try {
                  const r = await api.get('/reports/spare-parts/?format=pdf', { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
                  const a = document.createElement('a'); a.href = url; a.download = 'purchases_report.pdf'; a.click(); URL.revokeObjectURL(url);
                  toast.success('PDF downloaded.');
                } catch { toast.error('PDF download failed.'); }
              }}>🖨️ PDF</button>
            </div>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Item</th><th>Qty</th><th>Unit (GH₵)</th>
                  <th>VAT</th><th>Final (GH₵)</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No purchases yet</td></tr>
                )}
                {history.map(p => (
                  <tr key={p.id}>
                    <td>{new Date(p.purchase_date).toLocaleDateString('en-GB')}</td>
                    <td>{p.item_name}</td>
                    <td>{p.quantity}</td>
                    <td className="ced">{parseFloat(p.unit_price).toFixed(2)}</td>
                    <td>{p.vat_applicable ? <span className="badge b-blue">{p.vat_percentage}%</span> : <span className="badge b-gray">None</span>}</td>
                    <td className="ced">{parseFloat(p.final_amount).toFixed(2)}</td>
                    <td><span className="badge b-green">Posted</span></td>
                    <td>
                      <div className="flex gap4">
                        <button className="btn btn-ghost btn-xs" onClick={() => startEdit(p)}>Edit</button>
                        <button className="btn btn-danger btn-xs" onClick={() => deleteRecord(p.id)}>Del</button>
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
