// src/pages/Fuel.jsx – Fuel log with live excess detection
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api, { calcFuel, fmtGHS } from '../utils/api';
import toast from 'react-hot-toast';

export default function FuelPage() {
  const [trucks,  setTrucks]  = useState([]);
  const [trips,   setTrips]   = useState([]);
  const [limits,  setLimits]  = useState({});   // truck_id → fuel_limit
  const [history, setHistory] = useState([]);
  const [computed, setComputed] = useState({ excess_fuel: 0, total_cost: 0 });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  const { register, handleSubmit, watch, reset } = useForm({
    defaultValues: { price_per_litre: '14.50', litres: '', fuel_limit: '' }
  });

  const watchedTruck  = watch('truck_id');
  const watchedLitres = watch('litres');
  const watchedLimit  = watch('fuel_limit');
  const watchedPrice  = watch('price_per_litre');

  // Load data
  useEffect(() => {
    api.get('/trucks/?status=ACTIVE').then(r => {
      const t = r.data.results || r.data;
      setTrucks(t);
    });
    api.get('/fuel/limits/').then(r => {
      const lmap = {};
      (r.data.results || r.data).forEach(l => { lmap[l.truck] = l.fuel_limit; });
      setLimits(lmap);
    });
    api.get('/trips/?status=EN_ROUTE').then(r => setTrips(r.data.results || r.data));
    loadHistory();
  }, []);

  const loadHistory = () => {
    api.get('/fuel/logs/').then(r => setHistory(r.data.results || r.data));
  };

  const startEdit = (f) => {
    setEditing(f.id);
    reset({
      date: f.date,
      truck_id: f.truck,
      trip_id: f.trip || '',
      odometer: f.odometer || '',
      fuel_limit: f.fuel_limit,
      litres: f.litres,
      price_per_litre: f.price_per_litre,
      remark: f.remark || '',
    });
  };

  const deleteRecord = async (id) => {
    if (!window.confirm('Delete this fuel log?')) return;
    try {
      await api.delete(`/fuel/logs/${id}/`);
      toast.success('Fuel log deleted.');
      loadHistory();
    } catch (e) {
      toast.error('Failed to delete fuel log.');
    }
  };

  // When truck changes → auto-fill fuel limit
  useEffect(() => {
    if (watchedTruck && limits[watchedTruck]) {
      // We need to set fuel_limit – using setValue via ref trick
      document.querySelector('[name="fuel_limit"]').value = limits[watchedTruck];
    }
  }, [watchedTruck, limits]);

  // Live auto-calculation
  useEffect(() => {
    setComputed(calcFuel(watchedLitres, watchedLimit, watchedPrice));
  }, [watchedLitres, watchedLimit, watchedPrice]);

  const excess = computed.excess_fuel;

  const onSubmit = async (data) => {
    if (excess > 0 && !data.remark?.trim()) {
      toast.error('Remark is MANDATORY when fuel exceeds the limit.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...data,
        truck_id:       parseInt(data.truck_id),
        trip_id:        data.trip_id ? parseInt(data.trip_id) : null,
        litres:         parseFloat(data.litres),
        fuel_limit:     parseFloat(data.fuel_limit),
        price_per_litre: parseFloat(data.price_per_litre),
        odometer:       data.odometer ? parseFloat(data.odometer) : null,
      };
      if (editing) {
        await api.patch(`/fuel/logs/${editing}/`, payload);
        toast.success('Fuel log updated successfully.');
      } else {
        await api.post('/fuel/logs/', payload);
        toast.success('Fuel log saved successfully.');
      }
      reset({ price_per_litre: '14.50' });
      setEditing(null);
      setComputed({ excess_fuel: 0, total_cost: 0 });
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save fuel log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="g2">
        {/* ── Fuel Log Form ── */}
        <div className="card">
          <div className="card-title"><span className="card-title-ic">⛽</span>{editing ? 'Edit Fuel Fill' : 'Log Fuel Fill'}</div>
          <form onSubmit={handleSubmit(onSubmit)}>

            <div className="sec-div">Truck & Date</div>
            <div className="fgrid">
              <div className="fg">
                <label>Date *</label>
                <input type="date" {...register('date', { required: true })} />
              </div>
              <div className="fg">
                <label>Truck *</label>
                <select {...register('truck_id', { required: true })}>
                  <option value="">— Select Truck —</option>
                  {trucks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.truck_number} – {t.model}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Linked Trip (Optional)</label>
                <select {...register('trip_id')}>
                  <option value="">None</option>
                  {trips.map(t => (
                    <option key={t.id} value={t.id}>{t.waybill_no} – {t.origin}</option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Odometer (km)</label>
                <input type="number" step="0.1" placeholder="e.g. 84230" {...register('odometer')} />
              </div>
            </div>

            <div className="sec-div">Fuel Details — Auto-Calculated</div>
            <div className="fgrid">
              <div className="fg">
                <label>Fuel Limit (L) — Auto-Filled</label>
                <input type="number" step="0.1" placeholder="Auto from truck"
                       {...register('fuel_limit', { required: true })}
                       style={{ color: 'var(--blue)', fontWeight: 600 }} />
              </div>
              <div className="fg">
                <label>Litres Issued *</label>
                <input type="number" step="0.1" min="0" placeholder="0.0"
                       {...register('litres', { required: true, min: 0.1 })}
                       style={{ borderColor: excess > 0 ? 'var(--red)' : undefined }} />
              </div>
              <div className="fg">
                <label>Price per Litre (GH₵) *</label>
                <input type="number" step="0.01" min="0" placeholder="14.50"
                       {...register('price_per_litre', { required: true })} />
              </div>
            </div>

            {/* Live calculation results */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div className="fg">
                <label>Excess Fuel (L) — Auto</label>
                <div className="calc-box" style={{
                  color:       excess > 0 ? 'var(--red)' : 'var(--green)',
                  borderColor: excess > 0 ? '#fecdd3'    : '#bbf7d0',
                  background:  excess > 0 ? '#fff1f2'    : '#f0fdf4',
                  fontSize: 15,
                }}>
                  {excess > 0 ? `⚠️ +${excess.toFixed(2)}L EXCESS` : '✓ Within Limit'}
                </div>
              </div>
              <div className="fg">
                <label>Total Cost (GH₵) — Auto</label>
                <div className="calc-box" style={{ fontSize: 15 }}>{fmtGHS(computed.total_cost)}</div>
              </div>
            </div>

            {excess > 0 && (
              <div className="excess-warn mt8">
                ⚠️ Fuel issued exceeds the truck limit by <strong>{excess.toFixed(2)}L</strong>. Remark below is MANDATORY.
              </div>
            )}

            <div className="fg mt12">
              <label style={{ color: excess > 0 ? 'var(--red)' : undefined }}>
                Remark {excess > 0 ? '* (MANDATORY – excess detected)' : '(Optional)'}
              </label>
              <input type="text" placeholder={excess > 0 ? 'Explain reason for excess fuel' : 'Optional note'}
                     {...register('remark')}
                     style={{ borderColor: excess > 0 ? 'var(--red)' : undefined }} />
            </div>

            <div className="flex gap8 mt16">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '⏳ Saving…' : editing ? '✓ Update Fuel Log' : '💾 Save Fuel Log'}
              </button>
              <button type="button" className="btn btn-ghost"
                      onClick={() => { setEditing(null); reset({ price_per_litre: '14.50' }); setComputed({ excess_fuel: 0, total_cost: 0 }); }}>
                {editing ? 'Cancel' : 'Clear'}
              </button>
            </div>
          </form>
        </div>

        {/* ── History & Excess Report ── */}
        <div>
          <div className="flex justify-end mb12">
            <button className="btn btn-ghost" style={{ background: 'var(--green)', color: '#fff' }}
              onClick={async () => {
                try {
                  const resp = await api.get('/reports/fuel/?format=excel', { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                  const a = document.createElement('a'); a.href = url; a.download = 'fuel_report.xlsx'; a.click(); URL.revokeObjectURL(url);
                  toast.success('Fuel report downloaded.');
                } catch { toast.error('Download failed.'); }
              }}>
              <span style={{ marginRight: 6 }}>📊</span> Download Fuel Report (Excel)
            </button>
            <button className="btn btn-ghost ml8" style={{ background: 'var(--blue)', color: '#fff' }}
              onClick={async () => {
                try {
                  const resp = await api.get('/reports/fuel/?format=pdf', { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
                  const a = document.createElement('a'); a.href = url; a.download = 'fuel_report.pdf'; a.click(); URL.revokeObjectURL(url);
                  toast.success('Fuel PDF downloaded.');
                } catch { toast.error('PDF download failed.'); }
              }}>
              <span style={{ marginRight: 6 }}>🖨️</span> Download Fuel Report (PDF)
            </button>
          </div>

          <div className="card mb16">
            <div className="card-title"><span className="card-title-ic">🔴</span>Fuel Excess Incidents</div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Truck</th><th>Limit</th><th>Issued</th><th>Excess</th><th>Remark</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {history.filter(h => parseFloat(h.excess_fuel) > 0).length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>No excess incidents</td></tr>
                  )}
                  {history.filter(h => parseFloat(h.excess_fuel) > 0).map(fl => (
                    <tr key={fl.id}>
                      <td>{new Date(fl.date).toLocaleDateString('en-GB')}</td>
                      <td className="mono"><strong>{fl.truck_number}</strong></td>
                      <td>{fl.fuel_limit}L</td>
                      <td>{fl.litres}L</td>
                      <td><span className="badge b-red">+{fl.excess_fuel}L</span></td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fl.remark}</td>
                      <td>
                        <div className="flex gap4">
                          <button className="btn btn-ghost btn-xs" onClick={() => startEdit(fl)}>Edit</button>
                          <button className="btn btn-danger btn-xs" onClick={() => deleteRecord(fl.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title"><span className="card-title-ic">📋</span>Recent Fuel Logs</div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Truck</th><th>Litres</th><th>Price/L</th><th>Total</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {history.slice(0, 8).map(fl => (
                    <tr key={fl.id}>
                      <td>{new Date(fl.date).toLocaleDateString('en-GB')}</td>
                      <td className="mono">{fl.truck_number}</td>
                      <td>{fl.litres}L</td>
                      <td>GH₵ {fl.price_per_litre}</td>
                      <td className="ced">{fmtGHS(fl.total_cost)}</td>
                      <td>
                        {parseFloat(fl.excess_fuel) > 0
                          ? <span className="badge b-red">Excess</span>
                          : <span className="badge b-green">Normal</span>}
                      </td>
                      <td>
                        <div className="flex gap4">
                          <button className="btn btn-ghost btn-xs" onClick={() => startEdit(fl)}>Edit</button>
                          <button className="btn btn-danger btn-xs" onClick={() => deleteRecord(fl.id)}>Del</button>
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
    </div>
  );
}
