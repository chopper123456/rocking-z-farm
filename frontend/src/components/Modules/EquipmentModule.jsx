import { useState, useEffect } from 'react';
import Header from '../Layout/Header';
import axios from 'axios';
import { equipmentAPI, equipmentJDAPI } from '../../utils/api';
import './EquipmentModule.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const CATEGORIES = [
  { value: 'tractor', label: 'Tractor' },
  { value: 'combine', label: 'Combine' },
  { value: 'sprayer', label: 'Sprayer' },
  { value: 'implement', label: 'Implement' },
];

function EquipmentModule({ user, onLogout }) {
  const [equipment, setEquipment] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [view, setView] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [parts, setParts] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [operators, setOperators] = useState([]);
  const [fieldUsage, setFieldUsage] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [maintenanceCosts, setMaintenanceCosts] = useState([]);
  const [fuelReport, setFuelReport] = useState([]);
  const [detailTab, setDetailTab] = useState('overview');

  const [syncingJD, setSyncingJD] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [activeOnly, setActiveOnly] = useState(true);

  const [jdHoursOfOperation, setJdHoursOfOperation] = useState(null);
  const [jdMachineAlerts, setJdMachineAlerts] = useState(null);
  const [jdDataLoading, setJdDataLoading] = useState(false);

  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [showEditEquipment, setShowEditEquipment] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);
  const [showAddFuel, setShowAddFuel] = useState(false);
  const [showAddOperator, setShowAddOperator] = useState(false);
  const [showReports, setShowReports] = useState(false);

  const [newEquipment, setNewEquipment] = useState({
    name: '',
    category: 'tractor',
    make: '',
    model: '',
    year: '',
    serialNumber: '',
    currentHours: '',
    currentMiles: '',
    purchaseDate: '',
    purchaseCost: '',
    insurancePolicy: '',
    insuranceExpires: '',
    registrationNumber: '',
    registrationExpires: '',
    notes: '',
  });

  const [editEquipment, setEditEquipment] = useState({ ...newEquipment });

  const [newService, setNewService] = useState({
    serviceDate: new Date().toISOString().split('T')[0],
    serviceType: 'Oil Change',
    description: '',
    cost: '',
    hoursAtService: '',
    receipt: null,
  });

  const [newSchedule, setNewSchedule] = useState({
    taskName: '',
    intervalHours: '',
    intervalDays: '',
    lastDoneDate: '',
    lastDoneHours: '',
    nextDueDate: '',
    nextDueHours: '',
    notes: '',
  });

  const [newPart, setNewPart] = useState({ partName: '', partNumber: '', quantity: 1, location: '', notes: '' });
  const [newFuel, setNewFuel] = useState({
    fuelDate: new Date().toISOString().split('T')[0],
    gallons: '',
    cost: '',
    hoursAtFill: '',
    notes: '',
  });
  const [newOperator, setNewOperator] = useState({
    operatorName: '',
    assignedFrom: new Date().toISOString().split('T')[0],
    assignedTo: '',
    isPrimary: false,
    notes: '',
  });

  const token = () => localStorage.getItem('token');
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    loadEquipment();
    loadAlerts();
    // Auto-sync from John Deere on page load (silent background sync)
    handleSyncFromJD(true);
  }, [activeOnly]);

  useEffect(() => {
    if (selectedAsset) {
      loadDetailData();
    }
  }, [selectedAsset]);

  useEffect(() => {
    if (selectedAsset?.jd_asset_id) {
      setJdDataLoading(true);
      setJdHoursOfOperation(null);
      setJdMachineAlerts(null);
      Promise.all([
        equipmentJDAPI.hoursOfOperation(selectedAsset.jd_asset_id).then((r) => r.data).catch(() => null),
        equipmentJDAPI.machineAlerts(selectedAsset.jd_asset_id).then((r) => r.data).catch(() => null),
      ]).then(([hours, alerts]) => {
        setJdHoursOfOperation(hours);
        setJdMachineAlerts(alerts);
        setJdDataLoading(false);
      }).catch(() => setJdDataLoading(false));
    } else {
      setJdHoursOfOperation(null);
      setJdMachineAlerts(null);
    }
  }, [selectedAsset?.jd_asset_id]);

  const loadEquipment = async () => {
    try {
      setLoading(true);
      const res = await equipmentAPI.getAll({ activeOnly: activeOnly });
      setEquipment(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to load equipment');
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const res = await axios.get(`${API_URL}/equipment-jd/alerts`, { headers: headers() });
      setAlerts(res.data);
    } catch {
      setAlerts([]);
    }
  };

  const loadDetailData = async () => {
    if (!selectedAsset) return;
    const id = selectedAsset.id;
    try {
      const [m, s, p, f, o] = await Promise.all([
        axios.get(`${API_URL}/equipment/${id}/maintenance`, { headers: headers() }),
        axios.get(`${API_URL}/equipment/${id}/schedule`, { headers: headers() }),
        axios.get(`${API_URL}/equipment/${id}/parts`, { headers: headers() }),
        axios.get(`${API_URL}/equipment/${id}/fuel`, { headers: headers() }),
        axios.get(`${API_URL}/equipment/${id}/operators`, { headers: headers() }),
      ]);
      setMaintenance(m.data);
      setSchedule(s.data);
      setParts(p.data);
      setFuelLogs(f.data);
      setOperators(o.data);
    } catch (err) {
      console.error(err);
    }
    try {
      const res = await axios.get(`${API_URL}/equipment-jd/field-usage`, { headers: headers() });
      setFieldUsage(res.data.filter((u) => u.equipment_name && selectedAsset.name && u.equipment_name.toLowerCase().includes(selectedAsset.name.toLowerCase())));
    } catch {
      setFieldUsage([]);
    }
  };

  const handleEquipmentClick = (asset) => {
    setSelectedAsset(asset);
    setView('detail');
    setDetailTab('overview');
  };

  const handleAddEquipment = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/equipment`, newEquipment, { headers: headers() });
      setShowAddEquipment(false);
      setNewEquipment({ name: '', category: 'tractor', make: '', model: '', year: '', serialNumber: '', currentHours: '', currentMiles: '', purchaseDate: '', purchaseCost: '', insurancePolicy: '', insuranceExpires: '', registrationNumber: '', registrationExpires: '', notes: '' });
      loadEquipment();
      alert('Equipment added!');
    } catch (err) {
      console.error(err);
      alert('Failed to add equipment');
    }
  };

  const handleUpdateEquipment = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/equipment/${selectedAsset.id}`, editEquipment, { headers: headers() });
      setShowEditEquipment(false);
      const res = await axios.get(`${API_URL}/equipment/${selectedAsset.id}`, { headers: headers() });
      setSelectedAsset(res.data);
      loadEquipment();
      alert('Equipment updated!');
    } catch (err) {
      console.error(err);
      alert('Failed to update equipment');
    }
  };

  const handleDeleteEquipment = async () => {
    if (!selectedAsset) return;
    if (!window.confirm(`Delete "${selectedAsset.name}" and all its maintenance, parts, fuel, and operator records?`)) return;
    try {
      await axios.delete(`${API_URL}/equipment/${selectedAsset.id}`, { headers: headers() });
      setView('list');
      setSelectedAsset(null);
      loadEquipment();
      loadAlerts();
      alert('Equipment deleted.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete equipment');
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('serviceDate', newService.serviceDate);
    formData.append('serviceType', newService.serviceType);
    formData.append('description', newService.description);
    formData.append('cost', newService.cost);
    formData.append('hoursAtService', newService.hoursAtService);
    if (newService.receipt) formData.append('receipt', newService.receipt);
    try {
      await axios.post(`${API_URL}/equipment/${selectedAsset.id}/maintenance`, formData, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
      });
      setShowAddService(false);
      setNewService({ serviceDate: new Date().toISOString().split('T')[0], serviceType: 'Oil Change', description: '', cost: '', hoursAtService: '', receipt: null });
      loadDetailData();
      const res = await axios.get(`${API_URL}/equipment/${selectedAsset.id}`, { headers: headers() });
      setSelectedAsset(res.data);
      alert('Service record added!');
    } catch (err) {
      console.error(err);
      alert('Failed to add service');
    }
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/equipment/${selectedAsset.id}/schedule`, newSchedule, { headers: headers() });
      setShowAddSchedule(false);
      setNewSchedule({ taskName: '', intervalHours: '', intervalDays: '', lastDoneDate: '', lastDoneHours: '', nextDueDate: '', nextDueHours: '', notes: '' });
      loadDetailData();
      loadAlerts();
      alert('Schedule item added!');
    } catch (err) {
      console.error(err);
      alert('Failed to add schedule');
    }
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/equipment/${selectedAsset.id}/parts`, newPart, { headers: headers() });
      setShowAddPart(false);
      setNewPart({ partName: '', partNumber: '', quantity: 1, location: '', notes: '' });
      loadDetailData();
      alert('Part added!');
    } catch (err) {
      console.error(err);
      alert('Failed to add part');
    }
  };

  const handleAddFuel = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/equipment/${selectedAsset.id}/fuel`, newFuel, { headers: headers() });
      setShowAddFuel(false);
      setNewFuel({ fuelDate: new Date().toISOString().split('T')[0], gallons: '', cost: '', hoursAtFill: '', notes: '' });
      loadDetailData();
      alert('Fuel log added!');
    } catch (err) {
      console.error(err);
      alert('Failed to add fuel log');
    }
  };

  const handleAddOperator = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/equipment/${selectedAsset.id}/operators`, newOperator, { headers: headers() });
      setShowAddOperator(false);
      setNewOperator({ operatorName: '', assignedFrom: new Date().toISOString().split('T')[0], assignedTo: '', isPrimary: false, notes: '' });
      loadDetailData();
      alert('Operator added!');
    } catch (err) {
      console.error(err);
      alert('Failed to add operator');
    }
  };

  const handleSyncFromJD = async (silent = false) => {
    setSyncingJD(true);
    if (!silent) setSyncMessage(null);
    try {
      const res = await axios.post(`${API_URL}/equipment-jd/sync`, {}, { headers: headers() });
      loadEquipment();
      loadAlerts();
      const msg = res.data.message || 'Sync complete.';
      if (!silent) {
        setSyncMessage(msg);
        alert(msg);
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to sync from John Deere.';
      if (!silent) {
        setSyncMessage(errMsg);
        alert(errMsg);
      }
    } finally {
      setSyncingJD(false);
    }
  };

  const handleSyncHours = async () => {
    try {
      const res = await axios.post(`${API_URL}/equipment-jd/sync-hours/${selectedAsset.id}`, {}, { headers: headers() });
      const r = await axios.get(`${API_URL}/equipment/${selectedAsset.id}`, { headers: headers() });
      setSelectedAsset(r.data);
      alert(res.data.message || 'Hours synced.');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to sync hours.');
    }
  };

  const loadReports = async () => {
    try {
      const [costRes, fuelRes] = await Promise.all([
        axios.get(`${API_URL}/equipment-jd/reports/maintenance-costs?year=${reportYear}`, { headers: headers() }),
        axios.get(`${API_URL}/equipment-jd/reports/fuel?year=${reportYear}`, { headers: headers() }),
      ]);
      setMaintenanceCosts(costRes.data);
      setFuelReport(fuelRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showReports) loadReports();
  }, [showReports, reportYear]);

  const downloadReceipt = (maintId) => {
    window.open(`${API_URL}/equipment/${selectedAsset.id}/maintenance/${maintId}/receipt`, '_blank');
  };

  const filteredEquipment = equipment.filter(
    (e) =>
      e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.model?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by category for sectioned list: Tractors, Combines, Sprayers, Implements, Other (only if has items)
  const SECTION_ORDER = ['tractor', 'combine', 'sprayer', 'implement'];
  const otherItems = filteredEquipment.filter((e) => !SECTION_ORDER.includes((e.category || '').toLowerCase()));
  const equipmentByCategory = [
    ...SECTION_ORDER.map((cat) => ({
      category: cat,
      label: CATEGORIES.find((c) => c.value === cat)?.label || cat,
      icon: { tractor: '🚜', combine: '🌾', sprayer: '💨', implement: '🔧' }[cat] || '📦',
      items: filteredEquipment.filter((e) => (e.category || '').toLowerCase() === cat),
    })),
    ...(otherItems.length > 0 ? [{ category: 'other', label: 'Other', icon: '📦', items: otherItems }] : []),
  ];

  const timelineItems = maintenance
    .map((m) => ({
      date: new Date(m.service_date),
      type: 'service',
      icon: '🔧',
      title: m.service_type,
      details: [m.description, m.cost ? `$${Number(m.cost).toFixed(2)}` : '', m.hours_at_service ? `${m.hours_at_service} hrs` : ''].filter(Boolean).join(' • '),
      data: m,
    }))
    .sort((a, b) => b.date - a.date);

  return (
    <div className="app-container equipment-module">
      <Header user={user} onLogout={onLogout} title="Equipment" />

      <div className="module-content">
        {view === 'list' && (
          <>
            <div className="section-header">
              <h2>🚜 Equipment</h2>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button className="action-btn jd-btn" onClick={handleSyncFromJD} disabled={syncingJD} title="Sync equipment from John Deere Operations Center">
                  {syncingJD ? '⏳ Syncing...' : '🚜 Sync from John Deere'}
                </button>
                <button className="add-button" onClick={() => setShowAddEquipment(true)}>
                  + Add Equipment
                </button>
              </div>
            </div>
            {syncMessage && (
              <div className="equipment-subsection" style={{ marginBottom: '1rem', background: '#f0f7f0', borderLeft: '4px solid var(--earth-mid)' }}>
                <p style={{ margin: 0, color: '#333' }}>{syncMessage}</p>
                <button type="button" onClick={() => setSyncMessage(null)} style={{ marginTop: '0.5rem', fontSize: '0.9rem', background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}>Dismiss</button>
              </div>
            )}

            {alerts.length > 0 && (
              <div className="equipment-subsection" style={{ marginBottom: '1.5rem' }}>
                <h4>⚠️ Upcoming Maintenance</h4>
                {alerts.slice(0, 5).map((a) => (
                  <div key={a.id} className="alert-item">
                    <strong>{a.equipment_name}</strong>: {a.task_name}
                    {a.next_due_date && ` — Due ${new Date(a.next_due_date).toLocaleDateString()}`}
                    {a.next_due_hours != null && ` — ${a.next_due_hours} hrs`}
                  </div>
                ))}
              </div>
            )}

            <div className="equipment-list-controls">
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="🔍 Search equipment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <label className="active-only-toggle">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                />
                <span>On map only</span>
              </label>
            </div>

            {loading ? (
              <div className="loading">Loading equipment...</div>
            ) : filteredEquipment.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🚜</div>
                <p>
                  {activeOnly
                    ? 'No equipment on map. Sync from John Deere above, or turn off "On map only" to see all equipment.'
                    : 'No equipment yet. Add manually or sync from John Deere.'}
                </p>
                {activeOnly ? (
                  <button type="button" className="add-button" style={{ marginTop: '1rem' }} onClick={() => setActiveOnly(false)}>
                    Show all equipment
                  </button>
                ) : (
                  <button className="add-button" style={{ marginTop: '1rem' }} onClick={() => setShowAddEquipment(true)}>
                    + Add Equipment
                  </button>
                )}
              </div>
            ) : (
              <div className="equipment-list-by-category">
                {equipmentByCategory.map((section) => (
                  <div key={section.category} className="equipment-category-section">
                    <h3 className="equipment-category-heading">
                      <span className="equipment-category-icon">{section.icon}</span>
                      {section.category === 'other' ? section.label : `${section.label}s`}
                      {section.items.length > 0 && (
                        <span className="equipment-category-count">({section.items.length})</span>
                      )}
                    </h3>
                    {section.items.length === 0 ? (
                      <p className="equipment-category-empty">
                        {section.category === 'other' ? 'No other equipment' : `No ${section.label.toLowerCase()}s`}
                      </p>
                    ) : (
                      <div className="equipment-list">
                        {section.items.map((asset) => (
                          <div key={asset.id} className="equipment-card" onClick={() => handleEquipmentClick(asset)}>
                            <h3>{asset.name}</h3>
                            <div className="equipment-meta">
                              {asset.make && asset.model && <span>{asset.make} {asset.model}</span>}
                              {asset.year && <span>Year: {asset.year}</span>}
                              {(asset.current_hours != null && asset.current_hours > 0) && <span>{Number(asset.current_hours).toLocaleString()} hrs</span>}
                              {asset.jd_asset_id && <span style={{ color: 'var(--earth-mid)' }}>John Deere</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'detail' && selectedAsset && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <button className="back-button" onClick={() => { setView('list'); setSelectedAsset(null); }}>
                ← Back to Equipment
              </button>
              <div>
                <button className="edit-btn" onClick={() => { setEditEquipment({ name: selectedAsset.name, category: selectedAsset.category, make: selectedAsset.make, model: selectedAsset.model, year: selectedAsset.year || '', serialNumber: selectedAsset.serial_number || '', currentHours: selectedAsset.current_hours ?? '', currentMiles: selectedAsset.current_miles ?? '', purchaseDate: selectedAsset.purchase_date?.split('T')[0] || '', purchaseCost: selectedAsset.purchase_cost ?? '', insurancePolicy: selectedAsset.insurance_policy || '', insuranceExpires: selectedAsset.insurance_expires?.split('T')[0] || '', registrationNumber: selectedAsset.registration_number || '', registrationExpires: selectedAsset.registration_expires?.split('T')[0] || '', notes: selectedAsset.notes || '' }); setShowEditEquipment(true); }}>
                  ✏️ Edit
                </button>
                <button className="delete-equipment-btn" style={{ marginLeft: '0.5rem' }} onClick={handleDeleteEquipment}>
                  🗑️ Delete
                </button>
              </div>
            </div>

            <div className="equipment-detail-header">
              <h3>{selectedAsset.name}</h3>
              <p>
                {selectedAsset.make} {selectedAsset.model} {selectedAsset.year && ` • ${selectedAsset.year}`}
                {selectedAsset.current_hours != null && selectedAsset.current_hours > 0 && ` • ${Number(selectedAsset.current_hours).toLocaleString()} hrs`}
                {selectedAsset.jd_asset_id && ' • John Deere'}
              </p>
            </div>

            <div className="action-buttons-grid">
              <button className="action-btn jd-btn" onClick={handleSyncFromJD}>🚜 Sync from John Deere</button>
              {selectedAsset.jd_asset_id && (
                <button className="action-btn jd-btn" onClick={handleSyncHours}>📊 Sync Hours from JD</button>
              )}
              <button className="action-btn" onClick={() => setShowAddService(true)}>🔧 Log Service</button>
              <button className="action-btn" onClick={() => setShowAddSchedule(true)}>📅 Add Schedule</button>
              <button className="action-btn" onClick={() => setShowAddPart(true)}>🔩 Add Part</button>
              <button className="action-btn" onClick={() => setShowAddFuel(true)}>⛽ Log Fuel</button>
              <button className="action-btn" onClick={() => setShowAddOperator(true)}>👤 Assign Operator</button>
              <button className="action-btn" onClick={() => { setShowReports(true); loadReports(); }}>📊 Reports</button>
            </div>

            <div className="detail-tabs">
              {['overview', 'service', 'schedule', 'parts', 'fuel', 'operators', 'field-usage'].map((tab) => (
                <button key={tab} className={detailTab === tab ? 'active' : ''} onClick={() => setDetailTab(tab)}>
                  {tab.replace('-', ' ')}
                </button>
              ))}
            </div>

            {detailTab === 'overview' && (
              <div className="equipment-overview-card">
                <div className="year-header">
                  <h2>Overview</h2>
                </div>
                <div className="equipment-stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Hours</span>
                    <span className="stat-value">{selectedAsset.current_hours != null ? Number(selectedAsset.current_hours).toLocaleString() : '—'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Miles</span>
                    <span className="stat-value">{selectedAsset.current_miles != null ? Number(selectedAsset.current_miles).toLocaleString() : '—'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Purchase</span>
                    <span className="stat-value">{selectedAsset.purchase_date ? new Date(selectedAsset.purchase_date).toLocaleDateString() : '—'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Purchase Cost</span>
                    <span className="stat-value">{selectedAsset.purchase_cost != null ? `$${Number(selectedAsset.purchase_cost).toLocaleString()}` : '—'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Serial</span>
                    <span className="stat-value">{selectedAsset.serial_number || '—'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Insurance Exp</span>
                    <span className="stat-value">{selectedAsset.insurance_expires ? new Date(selectedAsset.insurance_expires).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
                {selectedAsset.notes && <p style={{ color: '#666', marginTop: '1rem' }}>{selectedAsset.notes}</p>}

                {selectedAsset.jd_asset_id && (
                  <div className="jd-data-sections" style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                    <h4 style={{ marginBottom: '0.75rem', color: 'var(--earth-mid)' }}>🚜 John Deere Data</h4>
                    {jdDataLoading && <p style={{ color: '#666' }}>Loading…</p>}
                    {!jdDataLoading && jdHoursOfOperation != null && (
                      <div className="equipment-subsection" style={{ marginBottom: '1rem' }}>
                        <h5>Hours of operation</h5>
                        <pre style={{ fontSize: '0.85rem', overflow: 'auto', maxHeight: '120px', background: '#f8f8f8', padding: '0.75rem', borderRadius: 8 }}>
                          {JSON.stringify(jdHoursOfOperation, null, 2)}
                        </pre>
                      </div>
                    )}
                    {!jdDataLoading && jdMachineAlerts != null && (
                      <div className="equipment-subsection">
                        <h5>Machine alerts (DTC)</h5>
                        {(jdMachineAlerts.values && jdMachineAlerts.values.length > 0) || (jdMachineAlerts.alerts && jdMachineAlerts.alerts.length > 0) ? (
                          <ul style={{ listStyle: 'none', padding: 0 }}>
                            {(jdMachineAlerts.values || jdMachineAlerts.alerts || []).map((a, i) => (
                              <li key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                                {a.description ?? a.message ?? a.code ?? JSON.stringify(a)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ color: '#666' }}>No active alerts.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {detailTab === 'service' && (
              <div className="timeline-section">
                <h3>Service History</h3>
                {timelineItems.length === 0 ? (
                  <div className="empty-state">
                    <p>No service records. Click "Log Service" to add one.</p>
                  </div>
                ) : (
                  timelineItems.map((item, i) => (
                    <div key={item.data.id} className="timeline-item">
                      <div className="timeline-icon">{item.icon}</div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <h4>{item.title}</h4>
                          <span className="timeline-date">{item.date.toLocaleDateString()}</span>
                        </div>
                        <p className="timeline-details">{item.details}</p>
                        {item.data.receipt_data && (
                          <button type="button" className="edit-btn" style={{ marginTop: '0.5rem' }} onClick={() => downloadReceipt(item.data.id)}>📎 Receipt</button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'schedule' && (
              <div className="equipment-subsection">
                <h4>Maintenance Schedule</h4>
                {schedule.length === 0 ? (
                  <p className="empty-state">No schedule items. Click "Add Schedule" to add one.</p>
                ) : (
                  schedule.map((s) => (
                    <div key={s.id} className="alert-item">
                      <strong>{s.task_name}</strong>
                      {s.next_due_date && ` — Due ${new Date(s.next_due_date).toLocaleDateString()}`}
                      {s.next_due_hours != null && ` — ${s.next_due_hours} hrs`}
                      {s.notes && <span> — {s.notes}</span>}
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'parts' && (
              <div className="equipment-subsection">
                <h4>Parts Inventory</h4>
                {parts.length === 0 ? (
                  <p className="empty-state">No parts. Click "Add Part" to add one.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {parts.map((p) => (
                      <li key={p.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                        <strong>{p.part_name}</strong> {p.part_number && `(${p.part_number})`} — Qty: {p.quantity} {p.location && ` @ ${p.location}`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {detailTab === 'fuel' && (
              <div className="equipment-subsection">
                <h4>Fuel Logs</h4>
                {fuelLogs.length === 0 ? (
                  <p className="empty-state">No fuel logs. Click "Log Fuel" to add one.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {fuelLogs.map((f) => (
                      <li key={f.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                        {new Date(f.fuel_date).toLocaleDateString()} — {Number(f.gallons).toFixed(1)} gal{f.cost ? ` — $${Number(f.cost).toFixed(2)}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {detailTab === 'operators' && (
              <div className="equipment-subsection">
                <h4>Operators</h4>
                {operators.length === 0 ? (
                  <p className="empty-state">No operators. Click "Assign Operator" to add one.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {operators.map((o) => (
                      <li key={o.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                        <strong>{o.operator_name}</strong> {o.is_primary && '(Primary)'} — {new Date(o.assigned_from).toLocaleDateString()}
                        {o.assigned_to && ` to ${new Date(o.assigned_to).toLocaleDateString()}`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {detailTab === 'field-usage' && (
              <div className="equipment-subsection">
                <h4>Field Usage (from operations)</h4>
                {fieldUsage.length === 0 ? (
                  <p className="empty-state">No field operations linked to this equipment name yet.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {fieldUsage.slice(0, 20).map((u) => (
                      <li key={u.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                        {u.field_name} — {u.year} — {u.operation_type} — {new Date(u.operation_date).toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        {/* Modals */}
        {showAddEquipment && (
          <div className="modal active">
            <div className="modal-content" style={{ maxWidth: '520px' }}>
              <div className="modal-header">
                <h3>Add Equipment</h3>
                <button className="close-btn" onClick={() => setShowAddEquipment(false)}>×</button>
              </div>
              <form onSubmit={handleAddEquipment}>
                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" required value={newEquipment.name} onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })} placeholder="e.g. Tractor 1" />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={newEquipment.category} onChange={(e) => setNewEquipment({ ...newEquipment, category: e.target.value })}>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Make / Model / Year</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.5rem' }}>
                    <input type="text" value={newEquipment.make} onChange={(e) => setNewEquipment({ ...newEquipment, make: e.target.value })} placeholder="Make" />
                    <input type="text" value={newEquipment.model} onChange={(e) => setNewEquipment({ ...newEquipment, model: e.target.value })} placeholder="Model" />
                    <input type="number" value={newEquipment.year} onChange={(e) => setNewEquipment({ ...newEquipment, year: e.target.value })} placeholder="Year" min="1900" max="2030" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Serial Number</label>
                  <input type="text" value={newEquipment.serialNumber} onChange={(e) => setNewEquipment({ ...newEquipment, serialNumber: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Current Hours / Miles</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="number" step="0.1" value={newEquipment.currentHours} onChange={(e) => setNewEquipment({ ...newEquipment, currentHours: e.target.value })} placeholder="Hours" />
                    <input type="number" step="0.1" value={newEquipment.currentMiles} onChange={(e) => setNewEquipment({ ...newEquipment, currentMiles: e.target.value })} placeholder="Miles" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Purchase Date / Cost</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="date" value={newEquipment.purchaseDate} onChange={(e) => setNewEquipment({ ...newEquipment, purchaseDate: e.target.value })} />
                    <input type="number" step="0.01" value={newEquipment.purchaseCost} onChange={(e) => setNewEquipment({ ...newEquipment, purchaseCost: e.target.value })} placeholder="Cost" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Insurance / Registration (optional)</label>
                  <input type="text" value={newEquipment.insurancePolicy} onChange={(e) => setNewEquipment({ ...newEquipment, insurancePolicy: e.target.value })} placeholder="Policy" />
                  <input type="date" value={newEquipment.insuranceExpires} onChange={(e) => setNewEquipment({ ...newEquipment, insuranceExpires: e.target.value })} style={{ marginTop: '0.5rem' }} placeholder="Expires" />
                  <input type="text" value={newEquipment.registrationNumber} onChange={(e) => setNewEquipment({ ...newEquipment, registrationNumber: e.target.value })} style={{ marginTop: '0.5rem' }} placeholder="Reg #" />
                  <input type="date" value={newEquipment.registrationExpires} onChange={(e) => setNewEquipment({ ...newEquipment, registrationExpires: e.target.value })} style={{ marginTop: '0.5rem' }} />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={newEquipment.notes} onChange={(e) => setNewEquipment({ ...newEquipment, notes: e.target.value })} rows={2} />
                </div>
                <button type="submit" className="btn-primary">Add Equipment</button>
              </form>
            </div>
          </div>
        )}

        {showEditEquipment && selectedAsset && (
          <div className="modal active">
            <div className="modal-content" style={{ maxWidth: '520px' }}>
              <div className="modal-header">
                <h3>Edit {selectedAsset.name}</h3>
                <button className="close-btn" onClick={() => setShowEditEquipment(false)}>×</button>
              </div>
              <form onSubmit={handleUpdateEquipment}>
                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" required value={editEquipment.name} onChange={(e) => setEditEquipment({ ...editEquipment, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={editEquipment.category} onChange={(e) => setEditEquipment({ ...editEquipment, category: e.target.value })}>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Make / Model / Year</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.5rem' }}>
                    <input type="text" value={editEquipment.make} onChange={(e) => setEditEquipment({ ...editEquipment, make: e.target.value })} />
                    <input type="text" value={editEquipment.model} onChange={(e) => setEditEquipment({ ...editEquipment, model: e.target.value })} />
                    <input type="number" value={editEquipment.year} onChange={(e) => setEditEquipment({ ...editEquipment, year: e.target.value })} min="1900" max="2030" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Serial / Hours / Miles</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <input type="text" value={editEquipment.serialNumber} onChange={(e) => setEditEquipment({ ...editEquipment, serialNumber: e.target.value })} placeholder="Serial" />
                    <input type="number" step="0.1" value={editEquipment.currentHours} onChange={(e) => setEditEquipment({ ...editEquipment, currentHours: e.target.value })} placeholder="Hours" />
                    <input type="number" step="0.1" value={editEquipment.currentMiles} onChange={(e) => setEditEquipment({ ...editEquipment, currentMiles: e.target.value })} placeholder="Miles" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Purchase Date / Cost</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="date" value={editEquipment.purchaseDate} onChange={(e) => setEditEquipment({ ...editEquipment, purchaseDate: e.target.value })} />
                    <input type="number" step="0.01" value={editEquipment.purchaseCost} onChange={(e) => setEditEquipment({ ...editEquipment, purchaseCost: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Insurance / Registration</label>
                  <input type="text" value={editEquipment.insurancePolicy} onChange={(e) => setEditEquipment({ ...editEquipment, insurancePolicy: e.target.value })} placeholder="Policy" />
                  <input type="date" value={editEquipment.insuranceExpires} onChange={(e) => setEditEquipment({ ...editEquipment, insuranceExpires: e.target.value })} style={{ marginTop: '0.5rem' }} />
                  <input type="text" value={editEquipment.registrationNumber} onChange={(e) => setEditEquipment({ ...editEquipment, registrationNumber: e.target.value })} style={{ marginTop: '0.5rem' }} />
                  <input type="date" value={editEquipment.registrationExpires} onChange={(e) => setEditEquipment({ ...editEquipment, registrationExpires: e.target.value })} style={{ marginTop: '0.5rem' }} />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={editEquipment.notes} onChange={(e) => setEditEquipment({ ...editEquipment, notes: e.target.value })} rows={2} />
                </div>
                <button type="submit" className="btn-primary">Save Changes</button>
              </form>
            </div>
          </div>
        )}

        {showAddService && selectedAsset && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Log Service — {selectedAsset.name}</h3>
                <button className="close-btn" onClick={() => setShowAddService(false)}>×</button>
              </div>
              <form onSubmit={handleAddService}>
                <div className="form-group">
                  <label>Date *</label>
                  <input type="date" required value={newService.serviceDate} onChange={(e) => setNewService({ ...newService, serviceDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Service Type</label>
                  <input type="text" value={newService.serviceType} onChange={(e) => setNewService({ ...newService, serviceType: e.target.value })} placeholder="Oil Change, Filter, etc." />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} rows={2} />
                </div>
                <div className="form-group">
                  <label>Cost / Hours at service</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="number" step="0.01" value={newService.cost} onChange={(e) => setNewService({ ...newService, cost: e.target.value })} placeholder="Cost" />
                    <input type="number" step="0.1" value={newService.hoursAtService} onChange={(e) => setNewService({ ...newService, hoursAtService: e.target.value })} placeholder="Hours" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Receipt (PDF or image)</label>
                  <input type="file" accept=".pdf,image/*" onChange={(e) => setNewService({ ...newService, receipt: e.target.files[0] })} />
                </div>
                <button type="submit" className="btn-primary">Add Service</button>
              </form>
            </div>
          </div>
        )}

        {showAddSchedule && selectedAsset && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add Schedule — {selectedAsset.name}</h3>
                <button className="close-btn" onClick={() => setShowAddSchedule(false)}>×</button>
              </div>
              <form onSubmit={handleAddSchedule}>
                <div className="form-group">
                  <label>Task Name *</label>
                  <input type="text" required value={newSchedule.taskName} onChange={(e) => setNewSchedule({ ...newSchedule, taskName: e.target.value })} placeholder="e.g. Oil change" />
                </div>
                <div className="form-group">
                  <label>Interval (hours or days)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="number" step="0.1" value={newSchedule.intervalHours} onChange={(e) => setNewSchedule({ ...newSchedule, intervalHours: e.target.value })} placeholder="Hours" />
                    <input type="number" value={newSchedule.intervalDays} onChange={(e) => setNewSchedule({ ...newSchedule, intervalDays: e.target.value })} placeholder="Days" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Last done / Next due</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="date" value={newSchedule.lastDoneDate} onChange={(e) => setNewSchedule({ ...newSchedule, lastDoneDate: e.target.value })} />
                    <input type="number" step="0.1" value={newSchedule.lastDoneHours} onChange={(e) => setNewSchedule({ ...newSchedule, lastDoneHours: e.target.value })} placeholder="Hours" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input type="date" value={newSchedule.nextDueDate} onChange={(e) => setNewSchedule({ ...newSchedule, nextDueDate: e.target.value })} placeholder="Next due date" />
                    <input type="number" step="0.1" value={newSchedule.nextDueHours} onChange={(e) => setNewSchedule({ ...newSchedule, nextDueHours: e.target.value })} placeholder="Next due hrs" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={newSchedule.notes} onChange={(e) => setNewSchedule({ ...newSchedule, notes: e.target.value })} rows={2} />
                </div>
                <button type="submit" className="btn-primary">Add Schedule</button>
              </form>
            </div>
          </div>
        )}

        {showAddPart && selectedAsset && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add Part — {selectedAsset.name}</h3>
                <button className="close-btn" onClick={() => setShowAddPart(false)}>×</button>
              </div>
              <form onSubmit={handleAddPart}>
                <div className="form-group">
                  <label>Part Name *</label>
                  <input type="text" required value={newPart.partName} onChange={(e) => setNewPart({ ...newPart, partName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Part Number / Quantity / Location</label>
                  <input type="text" value={newPart.partNumber} onChange={(e) => setNewPart({ ...newPart, partNumber: e.target.value })} placeholder="Part #" />
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input type="number" min={1} value={newPart.quantity} onChange={(e) => setNewPart({ ...newPart, quantity: parseInt(e.target.value) || 1 })} />
                    <input type="text" value={newPart.location} onChange={(e) => setNewPart({ ...newPart, location: e.target.value })} placeholder="Location" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={newPart.notes} onChange={(e) => setNewPart({ ...newPart, notes: e.target.value })} rows={2} />
                </div>
                <button type="submit" className="btn-primary">Add Part</button>
              </form>
            </div>
          </div>
        )}

        {showAddFuel && selectedAsset && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Log Fuel — {selectedAsset.name}</h3>
                <button className="close-btn" onClick={() => setShowAddFuel(false)}>×</button>
              </div>
              <form onSubmit={handleAddFuel}>
                <div className="form-group">
                  <label>Date *</label>
                  <input type="date" required value={newFuel.fuelDate} onChange={(e) => setNewFuel({ ...newFuel, fuelDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Gallons * / Cost / Hours</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <input type="number" step="0.1" required value={newFuel.gallons} onChange={(e) => setNewFuel({ ...newFuel, gallons: e.target.value })} placeholder="Gal" />
                    <input type="number" step="0.01" value={newFuel.cost} onChange={(e) => setNewFuel({ ...newFuel, cost: e.target.value })} placeholder="Cost" />
                    <input type="number" step="0.1" value={newFuel.hoursAtFill} onChange={(e) => setNewFuel({ ...newFuel, hoursAtFill: e.target.value })} placeholder="Hours" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={newFuel.notes} onChange={(e) => setNewFuel({ ...newFuel, notes: e.target.value })} rows={2} />
                </div>
                <button type="submit" className="btn-primary">Add Fuel Log</button>
              </form>
            </div>
          </div>
        )}

        {showAddOperator && selectedAsset && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Assign Operator — {selectedAsset.name}</h3>
                <button className="close-btn" onClick={() => setShowAddOperator(false)}>×</button>
              </div>
              <form onSubmit={handleAddOperator}>
                <div className="form-group">
                  <label>Operator Name *</label>
                  <input type="text" required value={newOperator.operatorName} onChange={(e) => setNewOperator({ ...newOperator, operatorName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Assigned From / To</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="date" value={newOperator.assignedFrom} onChange={(e) => setNewOperator({ ...newOperator, assignedFrom: e.target.value })} />
                    <input type="date" value={newOperator.assignedTo} onChange={(e) => setNewOperator({ ...newOperator, assignedTo: e.target.value })} placeholder="Optional end" />
                  </div>
                </div>
                <div className="form-group">
                  <label>
                    <input type="checkbox" checked={newOperator.isPrimary} onChange={(e) => setNewOperator({ ...newOperator, isPrimary: e.target.checked })} /> Primary operator
                  </label>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={newOperator.notes} onChange={(e) => setNewOperator({ ...newOperator, notes: e.target.value })} rows={2} />
                </div>
                <button type="submit" className="btn-primary">Add Operator</button>
              </form>
            </div>
          </div>
        )}

        {showReports && (
          <div className="modal active">
            <div className="modal-content" style={{ maxWidth: '560px' }}>
              <div className="modal-header">
                <h3>Equipment Reports</h3>
                <button className="close-btn" onClick={() => setShowReports(false)}>×</button>
              </div>
              <div className="form-group">
                <label>Year</label>
                <select value={reportYear} onChange={(e) => setReportYear(parseInt(e.target.value))}>
                  {[reportYear, reportYear - 1, reportYear - 2].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <h4 style={{ fontFamily: 'Bebas Neue', marginTop: '1rem' }}>Maintenance Costs</h4>
              {maintenanceCosts.length === 0 ? <p>No data</p> : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {maintenanceCosts.map((r) => (
                    <li key={r.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                      <strong>{r.name}</strong> — ${Number(r.total_cost).toFixed(2)} ({r.service_count} services)
                    </li>
                  ))}
                </ul>
              )}
              <h4 style={{ fontFamily: 'Bebas Neue', marginTop: '1rem' }}>Fuel</h4>
              {fuelReport.length === 0 ? <p>No data</p> : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {fuelReport.map((r) => (
                    <li key={r.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                      <strong>{r.name}</strong> — {Number(r.total_gallons).toFixed(1)} gal — ${r.total_cost ? Number(r.total_cost).toFixed(2) : '—'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EquipmentModule;
