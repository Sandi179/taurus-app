// src/pages/Invoicing.jsx
import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import api, { fmtGHS } from '../utils/api';
import toast from 'react-hot-toast';

export default function InvoicingPage() {
  const [trips,    setTrips]    = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [totals,   setTotals]   = useState({ subtotal: 0, vat_amount: 0, total_amount: 0 });
  const [saving,   setSaving]   = useState(false);
  const [tab,      setTab]      = useState('new');
  const [editing,  setEditing]  = useState(null);

  const { register, control, handleSubmit, watch, reset } = useForm({
    defaultValues: {
      invoice_date:  new Date().toISOString().split('T')[0],
      vat_applicable: false,
      vat_percentage: 15,
      lines: [{ description: '', quantity: '', unit_price: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');
  const watchedVAT   = watch('vat_applicable');
  const watchedVATPct = watch('vat_percentage');

  useEffect(() => {
    api.get('/trips/?status=COMPLETED').then(r => setTrips(r.data.results || r.data));
    loadInvoices();
  }, []);

  // Live total calculation from line items
  useEffect(() => {
    const subtotal = (watchedLines || []).reduce((sum, l) => {
      return sum + (parseFloat(l.quantity || 0) * parseFloat(l.unit_price || 0));
    }, 0);
    const vat   = watchedVAT ? subtotal * (parseFloat(watchedVATPct || 0) / 100) : 0;
    const total = subtotal + vat;
    setTotals({ subtotal, vat_amount: vat, total_amount: total });
  }, [watchedLines, watchedVAT, watchedVATPct]);

  // Auto-fill from trip
  const onTripSelect = (e) => {
    const trip = trips.find(t => t.id === parseInt(e.target.value));
    if (!trip) return;
    // Pre-fill first line with trip details
    const desc = `Haulage Services – ${trip.origin} to ${trip.destination} (${trip.waybill_no})`;
    document.querySelector('[name="lines.0.description"]').value = desc;
    document.querySelector('[name="lines.0.quantity"]').value    = trip.delivered_qty || trip.loaded_qty;
    document.querySelector('[name="lines.0.unit_price"]').value  = trip.rate_per_ton || '';
  };

  const loadInvoices = () => {
    api.get('/invoicing/').then(r => setInvoices(r.data.results || r.data));
  };

  const startEdit = async (inv) => {
    setEditing(inv.id);
    setTab('new');
    // Fetch full invoice with lines
    try {
      const resp = await api.get(`/invoicing/${inv.id}/`);
      const fullInv = resp.data;
      reset({
        invoice_date: fullInv.invoice_date,
        due_date: fullInv.due_date || '',
        client_name: fullInv.client_name,
        client_phone: fullInv.client_phone || '',
        client_address: fullInv.client_address || '',
        trip_id: fullInv.trip || '',
        vat_applicable: fullInv.vat_applicable,
        vat_percentage: fullInv.vat_percentage,
        notes: fullInv.notes || '',
        lines: fullInv.lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
        }))
      });
    } catch {
      toast.error('Failed to load invoice details.');
    }
  };

  const deleteRecord = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await api.delete(`/invoicing/${id}/`);
      toast.success('Invoice deleted.');
      loadInvoices();
    } catch (e) {
      toast.error('Failed to delete invoice.');
    }
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const payload = {
        client_name:    data.client_name,
        client_address: data.client_address || '',
        client_phone:   data.client_phone   || '',
        invoice_date:   data.invoice_date,
        due_date:       data.due_date        || null,
        trip_id:        data.trip_id         || null,
        vat_applicable: data.vat_applicable,
        vat_percentage: parseFloat(data.vat_percentage || 15),
        notes:          data.notes || '',
      };

      let invId, invNumber;
      if (editing) {
        const r = await api.patch(`/invoicing/${editing}/`, payload);
        invId = editing;
        invNumber = r.data.invoice_number;
      } else {
        const resp = await api.post('/invoicing/', payload);
        invId = resp.data.id;
        invNumber = resp.data.invoice_number;
      }

      // Save / replace line items
      await Promise.all(data.lines.map(line =>
        api.post('/invoicing/lines/', {
          invoice_id:  invId,
          description: line.description,
          quantity:    parseFloat(line.quantity),
          unit_price:  parseFloat(line.unit_price),
        })
      ));

      toast.success(editing ? `Invoice ${invNumber} updated.` : `Invoice ${invNumber} created.`);
      reset({ invoice_date: new Date().toISOString().split('T')[0], vat_applicable: false, vat_percentage: 15, lines: [{ description:'',quantity:'',unit_price:'' }] });
      setEditing(null);
      setTotals({ subtotal: 0, vat_amount: 0, total_amount: 0 });
      loadInvoices();
      setTab('list');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = async (id, number) => {
    try {
      const resp = await api.get(`/invoicing/${id}/pdf/`, { responseType: 'blob' });
      const url  = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('PDF download failed.');
    }
  };



  const STATUS_BADGE = { DRAFT:'b-gray', SENT:'b-blue', PAID:'b-green', OVERDUE:'b-red' };

  return (
    <div>
      <div className="tabs">
        {['new','list'].map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'new' ? '+ New Invoice' : `All Invoices (${invoices.length})`}
          </div>
        ))}
      </div>

      {tab === 'new' && (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="g2">
            <div className="card">
              <div className="card-title"><span className="card-title-ic">🧾</span>{editing ? 'Edit Invoice' : 'Invoice Builder'}</div>

              <div className="sec-div">Client & Date</div>
              <div className="fgrid">
                <div className="fg">
                  <label>Invoice Date *</label>
                  <input type="date" {...register('invoice_date', { required: true })} />
                </div>
                <div className="fg">
                  <label>Due Date</label>
                  <input type="date" {...register('due_date')} />
                </div>
                <div className="fg">
                  <label>Client Name *</label>
                  <input type="text" placeholder="Client / Company name" {...register('client_name', { required: true })} />
                </div>
                <div className="fg">
                  <label>Client Phone</label>
                  <input type="text" placeholder="+233 XX XXX XXXX" {...register('client_phone')} />
                </div>
                <div className="fg" style={{ gridColumn: 'span 2' }}>
                  <label>Client Address</label>
                  <input type="text" placeholder="Address" {...register('client_address')} />
                </div>
                <div className="fg" style={{ gridColumn: 'span 2' }}>
                  <label>Link to Trip (Auto-fills line items)</label>
                  <select {...register('trip_id')} onChange={onTripSelect}>
                    <option value="">— Select Completed Trip —</option>
                    {trips.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.waybill_no} · {t.origin} → {t.destination} · {t.material_type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sec-div">Line Items — Totals Auto-Calculated</div>
              {fields.map((field, idx) => (
                <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.2fr 1.2fr auto', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                  <div className="fg">
                    {idx === 0 && <label>Description</label>}
                    <input type="text" placeholder="Service description" {...register(`lines.${idx}.description`, { required: true })} />
                  </div>
                  <div className="fg">
                    {idx === 0 && <label>Qty</label>}
                    <input type="number" step="0.001" placeholder="1" {...register(`lines.${idx}.quantity`, { required: true })} />
                  </div>
                  <div className="fg">
                    {idx === 0 && <label>Unit Rate (GH₵)</label>}
                    <input type="number" step="0.01" placeholder="0.00" {...register(`lines.${idx}.unit_price`, { required: true })} />
                  </div>
                  <div className="fg">
                    {idx === 0 && <label>Amount (GH₵)</label>}
                    <div className="calc-box" style={{ fontSize: 12 }}>
                      {fmtGHS((parseFloat(watchedLines?.[idx]?.quantity||0) * parseFloat(watchedLines?.[idx]?.unit_price||0)))}
                    </div>
                  </div>
                  <div>
                    {idx === 0 && <label style={{ visibility:'hidden' }}>X</label>}
                    {fields.length > 1 && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(idx)}>✕</button>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm mt8" onClick={() => append({ description:'', quantity:'', unit_price:'' })}>
                + Add Line
              </button>

              <div className="sec-div mt12">VAT & Totals</div>
              <div className="fgrid">
                <div className="fg">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" style={{ width: 'auto' }} {...register('vat_applicable')} />
                    Apply VAT
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" step="0.1" min="0" {...register('vat_percentage')} style={{ width: 80 }} />
                    <span style={{ fontSize: 13 }}>%</span>
                  </div>
                </div>
                <div className="fg">
                  <label>Notes</label>
                  <input type="text" placeholder="Payment terms, notes…" {...register('notes')} />
                </div>
              </div>

              <div className="vat-breakdown">
                <div className="vb-row"><span style={{ color: 'var(--muted)' }}>Subtotal</span><strong>{fmtGHS(totals.subtotal)}</strong></div>
                <div className="vb-row"><span style={{ color: 'var(--muted)' }}>VAT {watchedVAT ? `(${watchedVATPct}%)` : '(N/A)'}</span><strong>{fmtGHS(totals.vat_amount)}</strong></div>
                <div className="vb-row total"><span>Total Payable</span><span style={{ fontSize: 17 }}>{fmtGHS(totals.total_amount)}</span></div>
              </div>

              <div className="flex gap8 mt16">
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '⏳ Saving…' : editing ? '✓ Update Invoice' : '💾 Create Invoice'}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); reset(); setTotals({ subtotal:0, vat_amount:0, total_amount:0 }); }}>{editing ? 'Cancel' : 'Clear'}</button>
                </div>
            </div>

            {/* Live Invoice Preview */}
            <div className="card">
              <div className="card-title"><span className="card-title-ic">👁️</span>Live Preview</div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
                <div style={{ background: 'var(--navy)', color: '#fff', padding: '12px 16px', borderRadius: '6px 6px 0 0', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>TAURUS TRADE & LOGISTICS</div>
                  <div style={{ fontSize: 11, opacity: .6, marginTop: 2 }}>Tax Invoice</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{watch('client_name') || 'Client Name'}</div>
                    <div style={{ color: 'var(--muted)' }}>{watch('client_phone') || ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: 'var(--blue)' }}>INVOICE #</div>
                    <div style={{ color: 'var(--muted)', fontSize: 11 }}>Date: {watch('invoice_date') || '—'}</div>
                  </div>
                </div>
                <div className="tbl-wrap" style={{ marginBottom: 12 }}>
                  <table>
                    <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                    <tbody>
                      {(watchedLines || []).map((l, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: 11 }}>{l.description || '—'}</td>
                          <td>{l.quantity || 0}</td>
                          <td>{fmtGHS(l.unit_price || 0)}</td>
                          <td className="ced">{fmtGHS((parseFloat(l.quantity||0) * parseFloat(l.unit_price||0)))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="vat-breakdown">
                  <div className="vb-row"><span style={{ color: 'var(--muted)', fontSize: 12 }}>Subtotal</span><span className="ced">{fmtGHS(totals.subtotal)}</span></div>
                  <div className="vb-row"><span style={{ color: 'var(--muted)', fontSize: 12 }}>VAT</span><span className="ced">{fmtGHS(totals.vat_amount)}</span></div>
                  <div className="vb-row total"><span>TOTAL DUE</span><span>{fmtGHS(totals.total_amount)}</span></div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {tab === 'list' && (
        <div className="card">
          <div className="card-title"><span className="card-title-ic">📋</span>All Invoices</div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Invoice #</th><th>Client</th><th>Date</th><th>Subtotal</th><th>VAT</th><th>Total</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No invoices yet</td></tr>
                )}
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="mono">{inv.invoice_number}</td>
                    <td>{inv.client_name}</td>
                    <td>{new Date(inv.invoice_date).toLocaleDateString('en-GB')}</td>
                    <td className="ced">{fmtGHS(inv.subtotal)}</td>
                    <td>{inv.vat_applicable ? <span className="badge b-blue">{inv.vat_percentage}%</span> : <span className="badge b-gray">N/A</span>}</td>
                    <td className="ced" style={{ fontWeight: 700 }}>{fmtGHS(inv.total_amount)}</td>
                    <td><span className={`badge ${STATUS_BADGE[inv.status]}`}>{inv.status}</span></td>
                    <td>
                      <div className="flex gap4">
                        <button className="export-btn pdf btn-xs" onClick={() => downloadPDF(inv.id, inv.invoice_number)}>🖨️ PDF</button>
                        <button className="btn btn-ghost btn-xs" onClick={() => startEdit(inv)}>Edit</button>
                        <button className="btn btn-danger btn-xs" onClick={() => deleteRecord(inv.id)}>Del</button>
                      </div>
                    </td>
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

const STATUS_BADGE = { DRAFT:'b-gray', SENT:'b-blue', PAID:'b-green', OVERDUE:'b-red' };
