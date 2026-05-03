// src/pages/Maintenance.jsx
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api, { fmtGHS, fmtDate } from '../utils/api';
import toast from 'react-hot-toast';

const TYPE_BADGE = {
  PREVENTIVE: 'b-blue', CORRECTIVE: 'b-amber', BREAKDOWN: 'b-red'
};
const STATUS_BADGE = { PENDING: 'b-amber', IN_PROGRESS: 'b-blue', DONE: 'b-green' };

export default function MaintenancePage() {
  const [records, setRecords] = useState([]);
  const [trucks,  setTrucks]  = useState([]);
  const [saving,  setSaving]  = useState(false);
  const [tab,     setTab]     = useState('list');
  const [editing, setEditing] = useState(null);

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { maintenance_type: 'PREVENTIVE', status: 'PENDING', service_date: new Date().toISOString().split('T')[0] }
  });

  useEffect(() => { load(); }, []);

  const load = () => {
    api.get('/maintenance/logs/').then(r => setRecords(r.data.results || r.data)).catch(() => {});
    api.get('/trucks/').then(r => setTrucks(r.data.results || r.data)).catch(() => {});
  };

  const startEdit = (rec) => { setEditing(rec.id); reset({ ...rec, truck: rec.truck }); setTab('form'); };
  const cancelForm = () => { reset({ maintenance_type: 'PREVENTIVE', status: 'PENDING', service_date: new Date().toISOString().split('T')[0] }); setEditing(null); setTab('list'); };

  const deleteRecord = async (id) => {
    if (!window.confirm('Are you sure you want to delete this maintenance record?')) return;
    try {
      await api.delete(`/maintenance/logs/${id}/`);
      toast.success('Maintenance record deleted.');
      load();
    } catch (e) {
      toast.error('Cannot delete record.');
    }
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        labour_cost: data.labour_cost ? parseFloat(data.labour_cost) : 0,
        parts_cost:  data.parts_cost  ? parseFloat(data.parts_cost)  : 0,
      };
      if (editing) {
        await api.patch(`/maintenance/logs/${editing}/`, payload);
        toast.success('Maintenance record updated.');
      } else {
        await api.post('/maintenance/logs/', payload);
        toast.success('Maintenance record created.');
      }
      cancelForm(); load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const pending    = records.filter(r => r.status === 'PENDING').length;
  const inProgress = records.filter(r => r.status === 'IN_PROGRESS').length;
  const totalCost  = records.reduce((s, r) => s + parseFloat(r.total_cost || 0), 0);

  return (
    <div>
      <div className="kpi-grid mb16" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { label: 'Total Records',  val: records.length, color: 'var(--blue)',  fmt: false },
          { label: 'Pending',        val: pending,        color: 'var(--amber)', fmt: false },
          { label: 'In Progress',    val: inProgress,     color: 'var(--blue)',  fmt: false },
          { label: 'Total Cost',     val: fmtGHS(totalCost), color: 'var(--red)', fmt: true },
        ].map((k, i) => (
          <div key={i} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-val" style={{ color: k.color, fontSize: k.fmt ? 15 : 22 }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb16">
          <div className="card-title" style={{ margin: 0 }}>
            <span className="card-title-ic">🛠️</span> Maintenance Records
          </div>
          <div className="flex gap8">
            <button className="export-btn excel" onClick={async () => {
              try {
                const r = await api.get('/reports/maintenance/?format=excel', { responseType: 'blob' });
                const url = URL.createObjectURL(new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                const a = document.createElement('a'); a.href = url; a.download = 'maintenance_report.xlsx'; a.click(); URL.revokeObjectURL(url);
                toast.success('Excel downloaded.');
              } catch { toast.error('Download failed.'); }
            }}>📊 Excel</button>
            <button className="export-btn pdf" onClick={async () => {
              try {
                const r = await api.get('/reports/maintenance/?format=pdf', { responseType: 'blob' });
                const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
                const a = document.createElement('a'); a.href = url; a.download = 'maintenance_report.pdf'; a.click(); URL.revokeObjectURL(url);
                toast.success('PDF downloaded.');
              } catch { toast.error('Download failed.'); }
            }}>🖨️ PDF</button>
            <button className="btn btn-primary btn-sm" onClick={() => { cancelForm(); setTab(tab === 'form' ? 'list' : 'form'); }}>
              {tab === 'form' ? '← Back to List' : '+ New Record'}
            </button>
          </div>
        </div>

        {tab === 'form' ? (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="fgrid">
              <div className="fg">
                <label>Truck *</label>
                <select {...register('truck', { required: true })}>
                  <option value="">— Select Truck —</option>
                  {trucks.map(t => <option key={t.id} value={t.id}>{t.truck_number} – {t.model}</option>)}
                </select>
              </div>
              <div className="fg">
                <label>Maintenance Type *</label>
                <select {...register('maintenance_type', { required: true })}>
                  <option value="PREVENTIVE">PREVENTIVE</option>
                  <option value="CORRECTIVE">CORRECTIVE</option>
                  <option value="BREAKDOWN">BREAKDOWN</option>
                </select>
              </div>
              <div className="fg">
                <label>Status</label>
                <select {...register('status')}>
                  <option value="PENDING">PENDING</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="DONE">DONE</option>
                </select>
              </div>
              <div className="fg">
                <label>Service Date *</label>
                <input type="date" {...register('service_date', { required: true })} />
              </div>
              <div className="fg">
                <label>Labour Cost (GH₵)</label>
                <input type="number" step="0.01" min="0" placeholder="0.00" {...register('labour_cost')} />
              </div>
              <div className="fg">
                <label>Parts Cost (GH₵)</label>
                <input type="number" step="0.01" min="0" placeholder="0.00" {...register('parts_cost')} />
              </div>
              <div className="fg">
                <label>Odometer at Service (km)</label>
                <input type="number" step="0.1" min="0" {...register('odometer_at_service')} />
              </div>
              <div className="fg">
                <label>Next Service Date</label>
                <input type="date" {...register('next_service_date')} />
              </div>
            </div>
            <div className="fg mb16">
              <label>Description / Work Done *</label>
              <textarea rows={3} placeholder="Describe the maintenance work performed…" {...register('description', { required: true })} />
            </div>
            <div className="flex gap8">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '⏳ Saving…' : editing ? '✓ Update Record' : '+ Create Record'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancelForm}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Truck</th><th>Type</th><th>Description</th>
                  <th>Mechanic</th><th>Odometer</th><th>Cost</th><th>Next Service</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 11 }}>{fmtDate(r.service_date)}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{r.truck_number}</td>
                    <td><span className={`badge ${TYPE_BADGE[r.maintenance_type]}`}>{r.maintenance_type}</span></td>
                    <td style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</td>
                    <td style={{ fontSize: 11 }}>{r.mechanic_name || '—'}</td>
                    <td style={{ fontSize: 11 }}>{r.odometer_at_service ? `${parseFloat(r.odometer_at_service).toLocaleString()} km` : '—'}</td>
                    <td className="ced">{r.total_cost ? fmtGHS(r.total_cost) : '—'}</td>
                    <td style={{ fontSize: 11 }}>{fmtDate(r.next_service_date)}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status?.replace('_', ' ')}</span></td>
                    <td>
                      <div className="flex gap4">
                        <button className="btn btn-ghost btn-xs" onClick={() => startEdit(r)}>Edit</button>
                        <button className="btn btn-danger btn-xs" onClick={() => deleteRecord(r.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No maintenance records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
