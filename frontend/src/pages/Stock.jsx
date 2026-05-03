import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api, { fmtGHS, fmtDate } from '../utils/api';

const SPARE_PARTS = [
  "99 Glue (Big Size)", "Adaptor", "Adaptor 22-27", "Air Blower Filter", "Air Hose",
  "Air Hose Flexible (50 Yards)", "Air Cylinder", "Air Blower (Complete)", "Air Cleaner (Complete)",
  "Air Condition Filter", "Air Distribution Valve", "Air Horn", "Air Horn (3 Pipe)",
  "Automatic Clutch Disc", "Automatic Pressure Plate",
  "Automatic Release Bearing", "Automatic Ring", "Automatic Clutch Booster", "Automatic Plate",
  "Axle Nut", "Axle Case", "Air Cleaner Case", "Battery Terminal", "Benger Bolt",
  "Benger Hole", "Box Spanner (32, 36)", "Brake Bulb", "Brake Shoe Locker", "Brake Pin",
  "Brake Locker", "Brass Bushing", "Capless Bulb", "Back Alarm", "Shock Absorber Springs",
  "Balloon (Air Suspension)", "Jack", "Driving Gear (Complete)", "Cello Tape", "Centre Gear",
  "Crank Shaft Sensor", "Counter Sensor", "Container Belt", "Centre Bolt", "Nut",
  "Manual Clutch Booster", "Manifold (Complete)", "Clutch Foot Valve",
  "Cutting Disc", "Cutting Nozzle", "Cutting Torch", "Cut Out", "Cross Member",
  "Driving Mirror", "Driver Seat", "Door Switch", "Door Glass", "Door Opener",
  "Door Cable", "D Block", "Control Valve", "Electrodes", "Allen Key Set",
  "Welding Gloves", "Welding Goggles", "Welding Shield", "Engine Mount (Seat)",
  "Engine Ring", "Engine Spring & Ball", "Epoxy", "EBS Valve", "Front Spring",
  "Front Axle", "Fan Belt", "Fan Clutch", "Fan Blade", "Brake Pads", "Brake Band",
  "Brake Pot", "Brake Disc", "Brake Drum", "Wheel Stud", "Fuel Filter", "Fuel Sensor",
  "Gear Knob", "Gear Pump", "Actuator", "Grease Gun",
  "Grinding Disc", "Grinding Paste", "Gear Box Parts", "Bulb (H1, H3, H4, H7)",
  "Hand Brake Valve", "Battery", "Equalizer Beam", "Equalizer Pin", "Helper Balloon",
  "Hub Bearing", "Hydraulic Hose", "Hydrometer", "Heavy Jack (50 Ton)",
  "Manual Clutch Set", "Measuring Unit", "Nipple", "O Ring", "Oil Filter", "Oil Pan Gasket",
  "Parking Bulb", "Heater Patch", "Pressure Limit Valve", "Radiator Seat", "Return Spring",
  "Tyre Valve", "Shock Absorber", "Side Light", "Silicone", "Silencer", "Spring Rubber",
  "Steering Filter", "Speedometer Sensor", "Paint Brush", "Tipping Valve", "Tipping Motor",
  "Tipping Shaft", "Oil Valve", "Tank Cover", "Tachograph", "Thread Tape", "Tie Rod End",
  "Traffic Light", "Triangle Reflector", "Rim", "Tube", "Flap", "Turn Table",
  "Thrust Bearing", "Water Separator", "Wiper Blade", "Suspension Bar", "Oil Seal",
  "Fire Extinguisher", "First Aid Kit", "Engine Piston", "Rubber Clip", "Saw Blade",
  "Caliper", "Relay Valve", "Electric Wire", "Tarpaulin", "Control Board", "U Clamp",
  "Fuel Gauge", "Exhaust Sensor", "Fog Light", "Power Switch", "Alternator",
  "Intercooler", "Water Hose", "Turbo Charger", "Injector", "AC Compressor",
  "King Pin Set", "Flywheel", "Head Light", "Wheel Spanner", "Cabin Shock Absorber",
  "Rubber Bushing", "Steering Parts", "Shaft", "Starter Motor", "Bearing Set",
  "Piston with Ring", "Head Gasket", "Windscreen", "Synchronizer", "Low Gear",
  "Steel Plate"
];

const TYRES = [
  "315/80R22.5 KAPSEN S09 TRAILER D 2 AXLE",
  "Apollo Tyre",
  "MRF Tyre",
  "Ceat Tyre",
  "JK Tyre",
  "Birla Tyre",
  "Michelin Tyre",
  "Bridgestone Tyre",
  "Goodyear Tyre",
  "Continental Tyre",
  "315/80R22.5",
  "385/65R22.5",
  "12.00R24",
  "12.00R20",
];

const LUBRICANTS = [];

const ITEM_DICT = {
  SPARE_PART: SPARE_PARTS,
  TYRE: TYRES,
  LUBRICANT: LUBRICANTS
};

export default function StockPage() {
  const [stock,     setStock]     = useState([]);
  const [locations, setLocations] = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [totalVal,  setTotalVal]  = useState(0);

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { item_type: 'SPARE_PART', unit: 'pcs', opening_qty: '', unit_price: '', reorder_level: 0 }
  });

  const watchedQty = watch('opening_qty');
  const watchedPrice = watch('unit_price');

  useEffect(() => {
    const q = parseFloat(watchedQty) || 0;
    const p = parseFloat(watchedPrice) || 0;
    setTotalVal(q * p);
  }, [watchedQty, watchedPrice]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/inventory/closing-stock/'),
      api.get('/inventory/locations/')
    ]).then(([s, l]) => {
      setStock(s.data.results || s.data);
      setLocations(l.data.results || l.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const payload = {
        name: data.item_type === 'TYRE' && data.tyre_size ? `${data.name} - ${data.tyre_size}` : data.name,
        item_type: data.item_type,
        unit: data.unit,
        description: data.description,
        reorder_level: parseFloat(data.reorder_level || 0),
      };
      
      if (editing) {
        await api.patch(`/inventory/items/${editing}/`, payload);
        toast.success('Item updated successfully.');
      } else {
        if (parseFloat(data.opening_qty) > 0) {
          payload.opening_qty = parseFloat(data.opening_qty);
          payload.unit_price = parseFloat(data.unit_price);
          payload.location_id = data.location_id;
        }
        await api.post('/inventory/items/', payload);
        toast.success('Item created successfully.');
      }
      
      reset({ item_type: 'SPARE_PART', unit: 'pcs', opening_qty: '', unit_price: '', reorder_level: 0, tyre_size: '', name: '', description: '' });
      setEditing(null);
      setShowForm(false);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s) => {
    setEditing(s.item__id);
    let tyreSize = '';
    let name = s.item__name;
    if (s.item__item_type === 'TYRE' && name.includes(' - ')) {
      const parts = name.split(' - ');
      tyreSize = parts.pop();
      name = parts.join(' - ');
    }
    reset({
      name,
      tyre_size: tyreSize,
      item_type: s.item__item_type,
      unit: s.item__unit,
      reorder_level: s.item__reorder_level,
      description: s.description || ''
    });
    setShowForm(true);
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item? It will be removed from the system.')) return;
    try {
      await api.delete(`/inventory/items/${id}/`);
      toast.success('Item deleted successfully.');
      loadData();
    } catch (e) {
      toast.error('Cannot delete item. It may have existing ledger transactions or purchases.');
    }
  };

  const filtered = stock.filter(s =>
    (s.item__name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.item__item_type || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = stock.length;
  const lowStock   = stock.filter(s => parseFloat(s.closing_qty || 0) <= parseFloat(s.item__reorder_level || 0) && parseFloat(s.closing_qty || 0) > 0).length;
  const outOfStock = stock.filter(s => parseFloat(s.closing_qty || 0) <= 0).length;
  const totalValue = stock.reduce((sum, s) => sum + parseFloat(s.closing_value || 0), 0);

  return (
    <div>
      <div className="kpi-grid mb16" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { label: 'Total Items',   val: totalItems,        color: 'var(--blue)',  fmt: false },
          { label: 'Low Stock',     val: lowStock,          color: 'var(--amber)', fmt: false },
          { label: 'Out of Stock',  val: outOfStock,        color: 'var(--red)',   fmt: false },
          { label: 'Total Value',   val: fmtGHS(totalValue),color: 'var(--green)', fmt: true  },
        ].map((k, i) => (
          <div key={i} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-val" style={{ color: k.color, fontSize: k.fmt ? 16 : 22 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {lowStock > 0 && (
        <div className="alert alert-warn mb16">
          ⚠️ <strong>{lowStock} item(s)</strong> are at or below reorder quantity. Please replenish stock.
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb16">
          <div className="card-title" style={{ margin: 0 }}>
            <span className="card-title-ic">📦</span> Stock Ledger
          </div>
          <div className="flex gap8">
            <input type="text" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: 220, padding: '7px 10px', fontSize: 12 }} />
            <button className="export-btn excel" onClick={async () => {
              try {
                const r = await api.get('/reports/stock/?format=excel', { responseType: 'blob' });
                const url = URL.createObjectURL(new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                const a = document.createElement('a'); a.href = url; a.download = 'stock_report.xlsx'; a.click(); URL.revokeObjectURL(url);
                toast.success('Excel downloaded.');
              } catch { toast.error('Download failed.'); }
            }}>📊 Excel</button>
            <button className="export-btn pdf" onClick={async () => {
              try {
                const r = await api.get('/reports/stock/?format=pdf', { responseType: 'blob' });
                const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
                const a = document.createElement('a'); a.href = url; a.download = 'stock_report.pdf'; a.click(); URL.revokeObjectURL(url);
                toast.success('PDF downloaded.');
              } catch { toast.error('Download failed.'); }
            }}>🖨️ PDF</button>
            <button className="btn btn-primary btn-sm" onClick={() => { 
              if (showForm) {
                reset({ item_type: 'SPARE_PART', unit: 'pcs', opening_qty: '', unit_price: '', reorder_level: 0, tyre_size: '', name: '', description: '' });
                setEditing(null);
              }
              setShowForm(!showForm);
            }}>
              {showForm ? 'Cancel' : '+ Add Inventory Item'}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb16 p16" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 12px 0' }}>{editing ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h4>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="fgrid">
                <div className="fg" style={{ gridColumn: watch('item_type') === 'TYRE' ? 'span 1' : 'span 2' }}>
                  <label>Item Name (Brand) *</label>
                  <input type="text" list="item-suggestions" placeholder="Type or select an item..." {...register('name', { required: true })} />
                  <datalist id="item-suggestions">
                    {(ITEM_DICT[watch('item_type')] || []).map((item, i) => (
                      <option key={i} value={item} />
                    ))}
                  </datalist>
                </div>
                {watch('item_type') === 'TYRE' && (
                  <div className="fg">
                    <label>Tyre Size</label>
                    <select {...register('tyre_size')}>
                      <option value="">— Select Size —</option>
                      <option value="10.00 R20">10.00 R20</option>
                      <option value="11.00 R20">11.00 R20</option>
                      <option value="12.00 R20">12.00 R20</option>
                      <option value="295/90 R20">295/90 R20</option>
                      <option value="315/80 R22.5">315/80 R22.5</option>
                      <option value="295/80 R22.5">295/80 R22.5</option>
                    </select>
                  </div>
                )}
                <div className="fg">
                  <label>Item Type *</label>
                  <select {...register('item_type', { required: true })}>
                    <option value="SPARE_PART">Spare Part</option>
                    <option value="LUBRICANT">Lubricant</option>
                    <option value="TYRE">Tyre</option>
                  </select>
                </div>
                <div className="fg">
                  <label>Unit</label>
                  <select {...register('unit')}>
                    <option value="pcs">pcs</option>
                    <option value="litres">litres</option>
                    <option value="set">set</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
                <div className="fg">
                  <label>Reorder Quantity</label>
                  <input type="number" step="0.01" min="0" {...register('reorder_level')} />
                </div>
                <div className="fg">
                  <label>Description</label>
                  <input type="text" {...register('description')} />
                </div>
              </div>

              {!editing && (
                <>
                  <div className="sec-div" style={{ marginTop: 12 }}>Opening Stock (Optional)</div>
                  <div className="fgrid">
                    <div className="fg">
                      <label>Location</label>
                      <select {...register('location_id')}>
                        <option value="">— Select Location —</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div className="fg">
                      <label>Opening Quantity</label>
                      <input type="number" step="0.01" min="0" placeholder="0" {...register('opening_qty')} />
                    </div>
                    <div className="fg">
                      <label>Unit Price (GH₵)</label>
                      <input type="number" step="0.01" min="0" placeholder="0.00" {...register('unit_price')} />
                    </div>
                    <div className="fg">
                      <label>Total Value (GH₵) — Auto</label>
                      <div className="calc-box">{fmtGHS(totalVal)}</div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap8 mt12">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '⏳ Saving…' : editing ? '✓ Update Item' : '✓ Save Item & Stock'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Item Name</th><th>Type</th>
                <th>Location</th><th>Op. Qty</th><th>Op. Val</th><th>Closing Qty</th><th>Closing Val</th>
                <th>Reorder Qty</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Loading…</td></tr>
              )}
              {!loading && filtered.map(s => {
                const opQty   = parseFloat(s.opening_qty || 0);
                const opVal   = parseFloat(s.opening_value || 0);
                const qty     = parseFloat(s.closing_qty || 0);
                const reorder = parseFloat(s.item__reorder_level || 0);
                const value   = parseFloat(s.closing_value || 0);
                const isLow   = qty <= reorder && qty > 0;
                const isOut   = qty <= 0;
                return (
                  <tr key={`${s.item__id}-${s.location__id}`}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400, marginBottom: 2 }}>{`ITM-${s.item__id.toString().padStart(4, '0')}`}</div>
                      {s.item__name}
                    </td>
                    <td><span className="badge b-blue">{s.item__item_type}</span></td>
                    <td>{s.location__name || '—'}</td>
                    <td className="mono" style={{ color: 'var(--muted)' }}>{opQty.toLocaleString()}</td>
                    <td className="ced" style={{ color: 'var(--muted)' }}>{fmtGHS(opVal)}</td>
                    <td className="mono" style={{ fontWeight: 700, color: isOut ? 'var(--red)' : isLow ? '#b45309' : 'var(--text)' }}>
                      {qty.toLocaleString()}
                    </td>
                    <td className="ced" style={{ fontWeight: 600 }}>{fmtGHS(value)}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 11 }}>{reorder.toLocaleString()}</td>
                    <td>
                      {isOut  && <span className="badge b-red">Out of Stock</span>}
                      {isLow  && !isOut && <span className="badge b-amber">Low Stock</span>}
                      {!isLow && !isOut && <span className="badge b-green">OK</span>}
                    </td>
                    <td>
                      <div className="flex gap4">
                        <button className="btn btn-ghost btn-xs" onClick={() => startEdit(s)}>Edit</button>
                        <button className="btn btn-danger btn-xs" onClick={() => deleteItem(s.item__id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No stock items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
