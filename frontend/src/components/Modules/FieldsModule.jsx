import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import axios from 'axios';
import { fieldsAPI, fieldsJDAPI } from '../../utils/api';
import './FieldsModule.css';

function FieldsModule({ user, onLogout }) {
  const navigate = useNavigate();
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearDetails, setYearDetails] = useState(null);
  const [years, setYears] = useState([]);
  const [view, setView] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [timelineItems, setTimelineItems] = useState([]);
  const [stats, setStats] = useState({ operations: 0, soilReports: 0, tissueReports: 0, scoutingReports: 0, yieldMap: false });

  const [showAddField, setShowAddField] = useState(false);
  const [showUploadSoil, setShowUploadSoil] = useState(false);
  const [showUploadTissue, setShowUploadTissue] = useState(false);
  const [showAddScouting, setShowAddScouting] = useState(false);
  const [showUploadYield, setShowUploadYield] = useState(false);
  const [showEditYear, setShowEditYear] = useState(false);
  const [showCustomYear, setShowCustomYear] = useState(false);
  const [showManageField, setShowManageField] = useState(false);
  const [syncingFieldsJD, setSyncingFieldsJD] = useState(false);
  const [syncFieldsMessage, setSyncFieldsMessage] = useState(null);
  const [onMapOnly, setOnMapOnly] = useState(true);

  const [newField, setNewField] = useState({
    fieldName: '',
    acreage: '',
    soilType: '',
    irrigationType: '',
    notes: ''
  });

  const [soilUpload, setSoilUpload] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    notes: '',
    file: null
  });

  const [tissueUpload, setTissueUpload] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    notes: '',
    file: null
  });

  const [scoutingNote, setScoutingNote] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    growthStage: '',
    pestPressure: 'Low',
    weedPressure: 'Low',
    diseaseNotes: '',
    generalNotes: '',
    weatherConditions: '',
    photo: null
  });

  const [yieldUpload, setYieldUpload] = useState({
    harvestDate: '',
    averageYield: '',
    totalBushels: '',
    moistureAvg: '',
    notes: '',
    mapFile: null
  });

  const [editYearData, setEditYearData] = useState({
    crop: '',
    variety: '',
    expectedYield: '',
    notes: ''
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    // Auto-sync fields from John Deere on page load (silent background sync)
    handleSyncFieldsFromJD(true);
  }, []);

  useEffect(() => {
    loadFields();
  }, [onMapOnly]);

  useEffect(() => {
    if (selectedField && selectedYear && yearDetails) {
      loadTimelineAndStats();
    }
  }, [selectedField, selectedYear, yearDetails]);

  const loadFields = async () => {
    try {
      setLoading(true);
      const response = await fieldsAPI.getAll({ onMapOnly: onMapOnly });
      setFields(response.data);
    } catch (error) {
      console.error('Error loading fields:', error);
      alert('Failed to load fields');
    } finally {
      setLoading(false);
    }
  };

  const loadYears = async (fieldName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/field-years/${fieldName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setYears(response.data);
    } catch (error) {
      console.error('Error loading years:', error);
      setYears([]);
    }
  };

  const loadYearDetails = async (fieldName, year) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/field-years/${fieldName}/${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setYearDetails(response.data);
      setEditYearData({
        crop: response.data.crop || '',
        variety: response.data.variety || '',
        expectedYield: response.data.expected_yield || '',
        notes: response.data.notes || ''
      });
    } catch (error) {
      console.error('Error loading year details:', error);
    }
  };

  const loadTimelineAndStats = async () => {
    const token = localStorage.getItem('token');
    let timeline = [];
    let newStats = { operations: 0, soilReports: 0, tissueReports: 0, scoutingReports: 0, yieldMap: false };

    try {
      // Load operations
      const opsRes = await axios.get(
        `${API_URL}/field-operations/${selectedField.field_name}/${selectedYear}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      newStats.operations = opsRes.data.length;
      opsRes.data.forEach(op => {
        timeline.push({
          date: new Date(op.operation_date),
          type: 'operation',
          icon: '🚜',
          title: op.operation_type,
          details: `${op.equipment_used || 'Equipment not specified'}${op.product_applied ? ` • ${op.product_applied}` : ''}${op.rate ? ` • ${op.rate} ${op.rate_unit}` : ''}`,
          data: op
        });
      });

      // Load scouting reports
      const scoutingRes = await axios.get(
        `${API_URL}/scouting-reports/${selectedField.field_name}/${selectedYear}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      newStats.scoutingReports = scoutingRes.data.length;
      scoutingRes.data.forEach(report => {
        timeline.push({
          date: new Date(report.report_date),
          type: 'scouting',
          icon: '📝',
          title: 'Scouting Report',
          details: `${report.growth_stage || 'Growth stage not specified'} • Pest: ${report.pest_pressure || 'N/A'} • Weed: ${report.weed_pressure || 'N/A'}`,
          data: report
        });
      });

      // Load soil/tissue reports
      const reportsRes = await axios.get(
        `${API_URL}/field-reports/${selectedField.field_name}/${selectedYear}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      reportsRes.data.forEach(report => {
        if (report.report_type === 'soil') {
          newStats.soilReports++;
          timeline.push({
            date: new Date(report.report_date),
            type: 'soil',
            icon: '🧪',
            title: 'Soil Sample',
            details: report.notes || 'No notes',
            data: report
          });
        } else if (report.report_type === 'tissue') {
          newStats.tissueReports++;
          timeline.push({
            date: new Date(report.report_date),
            type: 'tissue',
            icon: '🌿',
            title: 'Tissue Sample',
            details: report.notes || 'No notes',
            data: report
          });
        }
      });

      // Load yield map
      try {
        const yieldRes = await axios.get(
          `${API_URL}/yield-maps/${selectedField.field_name}/${selectedYear}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (yieldRes.data) {
          newStats.yieldMap = true;
          timeline.push({
            date: new Date(yieldRes.data.harvest_date || yieldRes.data.created_at),
            type: 'yield',
            icon: '📊',
            title: 'Yield Map',
            details: `${yieldRes.data.average_yield || 'N/A'} bu/ac avg • ${yieldRes.data.total_bushels || 'N/A'} total bu`,
            data: yieldRes.data
          });
        }
      } catch (error) {
        // Yield map doesn't exist, that's okay
      }

      // Sort timeline by date (newest first)
      timeline.sort((a, b) => b.date - a.date);
      
      setTimelineItems(timeline);
      setStats(newStats);
    } catch (error) {
      console.error('Error loading timeline:', error);
    }
  };

  const handleAddField = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/fields`, newField, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAddField(false);
      setNewField({ fieldName: '', acreage: '', soilType: '', irrigationType: '', notes: '' });
      loadFields();
      alert('Field added successfully!');
    } catch (error) {
      console.error('Error adding field:', error);
      alert('Failed to add field');
    }
  };

  const handleUpdateYear = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/field-years/${selectedField.field_name}/${selectedYear}`,
        editYearData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowEditYear(false);
      await loadYearDetails(selectedField.field_name, selectedYear);
      alert('Year updated successfully!');
    } catch (error) {
      console.error('Error updating year:', error);
      alert('Failed to update year');
    }
  };

  const handleFieldClick = async (field) => {
    setSelectedField(field);
    await loadYears(field.field_name);
    
    // Always try to open current year, create if doesn't exist
    const currentYear = new Date().getFullYear();
    const currentYearData = await checkYearExists(field.field_name, currentYear);
    
    if (currentYearData) {
      // Current year exists, open it automatically
      setSelectedYear(currentYear);
      await loadYearDetails(field.field_name, currentYear);
      setView('year-detail');
    } else {
      // Current year doesn't exist, create it automatically
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${API_URL}/field-years`, {
          fieldName: field.field_name,
          year: currentYear,
          crop: '',
          variety: '',
          notes: ''
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Reload years and open the new current year
        await loadYears(field.field_name);
        setSelectedYear(currentYear);
        await loadYearDetails(field.field_name, currentYear);
        setView('year-detail');
      } catch (error) {
        console.error('Error creating current year:', error);
        // If creation fails, show field detail view with year buttons
        setView('field-detail');
      }
    }
  };

  const checkYearExists = async (fieldName, year) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/field-years/${fieldName}/${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      return null;
    }
  };

  const handleYearClick = async (year) => {
    setSelectedYear(year.year);
    await loadYearDetails(selectedField.field_name, year.year);
    setView('year-detail');
  };

  const handleDeleteField = async (fieldId) => {
    // First confirmation
    if (!window.confirm('⚠️ DELETE FIELD - Are you sure?\n\nThis will delete the field and ALL data (years, reports, operations, etc.)')) {
      return;
    }
    
    // Second confirmation
    if (!window.confirm('⚠️ FINAL WARNING!\n\nThis cannot be undone. Delete this field permanently?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/fields/${fieldId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setView('list');
      loadFields();
      alert('Field deleted successfully!');
    } catch (error) {
      console.error('Error deleting field:', error);
      alert('Failed to delete field');
    }
  };

  const handleSyncFieldsFromJD = async (silent = false) => {
    try {
      setSyncingFieldsJD(true);
      if (!silent) setSyncFieldsMessage(null);
      const response = await fieldsJDAPI.sync();
      const msg = response.data?.message || 'Fields synced from John Deere.';
      if (!silent) {
        setSyncFieldsMessage(msg);
        alert(`✅ ${msg}`);
      }
      await loadFields();
    } catch (error) {
      const errMsg = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to sync fields from John Deere.';
      if (!silent) {
        setSyncFieldsMessage(errMsg);
        alert(errMsg);
      }
      // Silent fail on auto-sync - just log to console
      console.error('Auto-sync from John Deere failed:', errMsg);
    } finally {
      setSyncingFieldsJD(false);
    }
  };

  const handleSyncFromJohnDeere = async () => {
    if (!window.confirm(`Sync operations from John Deere for ${selectedField.field_name} (${selectedYear})?\n\nThis will pull planting, spraying, tillage, and harvest operations.`)) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/field-operations/sync/${selectedField.field_name}/${selectedYear}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`✅ ${response.data.message}`);
      
      // Reload year details (may have updated planting/harvest dates)
      await loadYearDetails(selectedField.field_name, selectedYear);
      await loadTimelineAndStats();
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Failed to sync. Make sure John Deere is connected.');
    }
  };

  const handleUploadSoilReport = async (e) => {
    e.preventDefault();
    if (!soilUpload.file) {
      alert('Please select a PDF file');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', soilUpload.file);
      formData.append('fieldName', selectedField.field_name);
      formData.append('year', selectedYear);
      formData.append('reportType', 'soil');
      formData.append('reportDate', soilUpload.reportDate);
      formData.append('notes', soilUpload.notes);

      await axios.post(`${API_URL}/field-reports`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setShowUploadSoil(false);
      setSoilUpload({ reportDate: new Date().toISOString().split('T')[0], notes: '', file: null });
      await loadTimelineAndStats();
      alert('Soil report uploaded successfully!');
    } catch (error) {
      console.error('Error uploading soil report:', error);
      alert('Failed to upload soil report');
    }
  };

  const handleUploadTissueReport = async (e) => {
    e.preventDefault();
    if (!tissueUpload.file) {
      alert('Please select a PDF file');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', tissueUpload.file);
      formData.append('fieldName', selectedField.field_name);
      formData.append('year', selectedYear);
      formData.append('reportType', 'tissue');
      formData.append('reportDate', tissueUpload.reportDate);
      formData.append('notes', tissueUpload.notes);

      await axios.post(`${API_URL}/field-reports`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setShowUploadTissue(false);
      setTissueUpload({ reportDate: new Date().toISOString().split('T')[0], notes: '', file: null });
      await loadTimelineAndStats();
      alert('Tissue report uploaded successfully!');
    } catch (error) {
      console.error('Error uploading tissue report:', error);
      alert('Failed to upload tissue report');
    }
  };

  const handleAddScoutingNote = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      if (scoutingNote.photo) {
        formData.append('photo', scoutingNote.photo);
      }
      formData.append('fieldName', selectedField.field_name);
      formData.append('year', selectedYear);
      formData.append('reportDate', scoutingNote.reportDate);
      formData.append('growthStage', scoutingNote.growthStage);
      formData.append('pestPressure', scoutingNote.pestPressure);
      formData.append('weedPressure', scoutingNote.weedPressure);
      formData.append('diseaseNotes', scoutingNote.diseaseNotes);
      formData.append('generalNotes', scoutingNote.generalNotes);
      formData.append('weatherConditions', scoutingNote.weatherConditions);

      await axios.post(`${API_URL}/scouting-reports`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setShowAddScouting(false);
      setScoutingNote({
        reportDate: new Date().toISOString().split('T')[0],
        growthStage: '',
        pestPressure: 'Low',
        weedPressure: 'Low',
        diseaseNotes: '',
        generalNotes: '',
        weatherConditions: '',
        photo: null
      });
      await loadTimelineAndStats();
      alert('Scouting report added successfully!');
    } catch (error) {
      console.error('Error adding scouting report:', error);
      alert('Failed to add scouting report');
    }
  };

  const handleUploadYieldMap = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      if (yieldUpload.mapFile) {
        formData.append('mapFile', yieldUpload.mapFile);
      }
      formData.append('fieldName', selectedField.field_name);
      formData.append('year', selectedYear);
      formData.append('harvestDate', yieldUpload.harvestDate);
      formData.append('averageYield', yieldUpload.averageYield);
      formData.append('totalBushels', yieldUpload.totalBushels);
      formData.append('moistureAvg', yieldUpload.moistureAvg);
      formData.append('notes', yieldUpload.notes);

      await axios.post(`${API_URL}/yield-maps`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setShowUploadYield(false);
      setYieldUpload({ harvestDate: '', averageYield: '', totalBushels: '', moistureAvg: '', notes: '', mapFile: null });
      await loadTimelineAndStats();
      
      // Update year details with actual yield
      if (yieldUpload.averageYield) {
        await axios.put(
          `${API_URL}/field-years/${selectedField.field_name}/${selectedYear}`,
          { ...editYearData, actualYield: yieldUpload.averageYield },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await loadYearDetails(selectedField.field_name, selectedYear);
      }
      
      alert('Yield map uploaded successfully!');
    } catch (error) {
      console.error('Error uploading yield map:', error);
      alert('Failed to upload yield map');
    }
  };

  const filteredFields = fields.filter(f => 
    f.field_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const prevYear = currentYear - 1;

  return (
    <div className="app-container">
      <Header user={user} onLogout={onLogout} title="Fields Management" />
      
      <div className="module-content">
        {/* FIELD LIST VIEW */}
        {view === 'list' && (
          <>
            <div className="section-header">
              <h2>🌱 Your Fields</h2>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {user?.isAdmin && (
                  <>
                    <button
                      className="action-btn jd-btn"
                      onClick={handleSyncFieldsFromJD}
                      disabled={syncingFieldsJD}
                      title="Sync field list from John Deere Operations Center"
                    >
                      {syncingFieldsJD ? '⏳ Syncing...' : '🚜 Sync fields from John Deere'}
                    </button>
                    <button className="add-button" onClick={() => setShowAddField(true)}>
                      + Add Field
                    </button>
                  </>
                )}
              </div>
            </div>
            {syncFieldsMessage && (
              <div className="fields-sync-message" style={{ marginBottom: '1rem', background: '#f0f7f0', borderLeft: '4px solid var(--earth-mid)', padding: '0.75rem 1rem', borderRadius: 4 }}>
                <p style={{ margin: 0, color: '#333' }}>{syncFieldsMessage}</p>
                <button type="button" onClick={() => setSyncFieldsMessage(null)} style={{ marginTop: '0.5rem', fontSize: '0.9rem', background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}>Dismiss</button>
              </div>
            )}

            <div className="fields-list-controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <label className="on-map-only-toggle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem', color: '#333', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={onMapOnly}
                  onChange={(e) => setOnMapOnly(e.target.checked)}
                />
                <span>On map only</span>
              </label>
            </div>

            {loading ? (
              <div className="loading">Loading fields...</div>
            ) : filteredFields.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🌱</div>
                <p>
                  {onMapOnly
                    ? 'No fields on map. Sync from John Deere above, or turn off "On map only" to see all fields.'
                    : 'No fields yet. Click "Add Field" to create your first field.'}
                </p>
                {onMapOnly && (
                  <button type="button" className="add-button" style={{ marginTop: '1rem' }} onClick={() => setOnMapOnly(false)}>
                    Show all fields
                  </button>
                )}
              </div>
            ) : (
              <div className="field-list">
                {filteredFields.map((field) => (
                  <div key={field.id} className="field-card" onClick={() => handleFieldClick(field)}>
                    <h3>{field.field_name}</h3>
                    <div className="field-info">
                      {field.acreage && <span>📏 {field.acreage} acres</span>}
                      {field.soil_type && <span>🌱 {field.soil_type}</span>}
                      {field.farm_name && <span style={{ color: 'var(--earth-mid)' }}>🏠 {field.farm_name}</span>}
                    </div>
                    {field.jd_field_id && <span className="jd-badge" style={{ fontSize: '0.75rem', color: 'var(--earth-mid)', marginTop: '0.25rem', display: 'block' }}>John Deere</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* FIELD DETAIL VIEW - Year Selection */}
        {view === 'field-detail' && selectedField && (
          <>
            <div className="field-actions-bar">
              <button className="back-button" onClick={() => setView('list')}>
                ← Back to Fields
              </button>
              {user?.isAdmin && (
                <button className="delete-field-btn" onClick={() => handleDeleteField(selectedField.id)}>
                  🗑️ Delete Field
                </button>
              )}
            </div>
            
            <div className="field-detail-header">
              <h3>{selectedField.field_name}</h3>
              <p>
                {selectedField.acreage && `${selectedField.acreage} acres`}
                {selectedField.soil_type && ` • ${selectedField.soil_type}`}
              </p>
            </div>

            <div className="years-section">
              <div className="section-header">
                <h3>Select Growing Season</h3>
                {user?.isAdmin && (
                  <button className="add-button" onClick={() => setShowAddYear(true)}>
                    + Add Year
                  </button>
                )}
              </div>

              {years.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📅</div>
                  <p>No years yet. Click "+ Add Year" to start tracking this field.</p>
                </div>
              ) : (
                <div className="year-list">
                  {years.map((year) => (
                    <div 
                      key={year.id} 
                      className="year-card"
                      onClick={() => handleYearClick(year)}
                    >
                      <h3>{year.year} Season</h3>
                      <p>{year.crop || 'No crop specified'} {year.variety && `- ${year.variety}`}</p>
                      {year.planting_date && (
                        <span className="date-badge">Planted: {new Date(year.planting_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* YEAR DETAIL VIEW - Timeline */}
        {view === 'year-detail' && selectedField && selectedYear && yearDetails && (
          <>
            <div className="top-bar">
              <button className="back-button" onClick={() => setView('list')}>
                ← Back to Fields
              </button>
              
              <div className="year-selector">
                <label>Viewing:</label>
                <select 
                  value={selectedYear} 
                  onChange={async (e) => {
                    const newYear = parseInt(e.target.value);
                    setSelectedYear(newYear);
                    await loadYearDetails(selectedField.field_name, newYear);
                  }}
                  className="year-dropdown"
                >
                  {years.sort((a, b) => b.year - a.year).map(y => (
                    <option key={y.year} value={y.year}>
                      {y.year} Season {y.crop && `- ${y.crop}`}
                    </option>
                  ))}
                </select>
                
                {user?.isAdmin && (
                  <button 
                    className="add-year-btn" 
                    onClick={() => setShowCustomYear(true)}
                  >
                    + Add Year
                  </button>
                )}
              </div>
              
              {user?.isAdmin && (
                <button className="manage-field-btn" onClick={() => setShowManageField(true)}>
                  ⚙️ Manage Field
                </button>
              )}
            </div>
            
            <div className="year-overview-card">
              <div className="year-header">
                <div>
                  <h2>{selectedField.field_name} - {selectedYear} Season</h2>
                  <p className="crop-info">
                    {yearDetails.crop || 'No crop set'} 
                    {yearDetails.variety && ` • ${yearDetails.variety}`}
                  </p>
                </div>
                {user?.isAdmin && (
                  <button className="edit-btn" onClick={() => setShowEditYear(true)}>
                    ✏️ Edit
                  </button>
                )}
              </div>

              <div className="year-stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Planting Date</span>
                  <span className="stat-value">
                    {yearDetails.planting_date ? new Date(yearDetails.planting_date).toLocaleDateString() : 'Not set'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Harvest Date</span>
                  <span className="stat-value">
                    {yearDetails.harvest_date ? new Date(yearDetails.harvest_date).toLocaleDateString() : 'Not set'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Expected Yield</span>
                  <span className="stat-value">{yearDetails.expected_yield || 'Not set'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Actual Yield</span>
                  <span className="stat-value">{yearDetails.actual_yield || 'Not harvested'}</span>
                </div>
              </div>

              <div className="quick-stats">
                <div className="quick-stat">🚜 {stats.operations} Operations</div>
                <div className="quick-stat">📝 {stats.scoutingReports} Scout Reports</div>
                <div className="quick-stat">🧪 {stats.soilReports} Soil Samples</div>
                <div className="quick-stat">🌿 {stats.tissueReports} Tissue Samples</div>
                {stats.yieldMap && <div className="quick-stat">📊 Yield Map</div>}
              </div>
            </div>

            <div className="action-buttons-grid">
              {user?.isAdmin && (
                <>
                  <button className="action-btn jd-btn" onClick={handleSyncFromJohnDeere}>
                    🚜 Sync from John Deere
                  </button>
                  <button className="action-btn" onClick={() => setShowUploadSoil(true)}>
                    🧪 Upload Soil Report
                  </button>
                  <button className="action-btn" onClick={() => setShowUploadTissue(true)}>
                    🌿 Upload Tissue Report
                  </button>
                  <button className="action-btn" onClick={() => setShowUploadYield(true)}>
                    📊 Upload Yield Map
                  </button>
                </>
              )}
              <button className="action-btn" onClick={() => setShowAddScouting(true)}>
                📝 Add Scouting Note
              </button>
            </div>

            <div className="timeline-section">
              <h3>Timeline</h3>
              {timelineItems.length === 0 ? (
                <div className="empty-timeline">
                  <p>No activity yet. Click "Sync from John Deere" or add reports above.</p>
                </div>
              ) : (
                <div className="timeline">
                  {timelineItems.map((item, index) => (
                    <div key={index} className={`timeline-item ${item.type}`}>
                      <div className="timeline-icon">{item.icon}</div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <h4>{item.title}</h4>
                          <span className="timeline-date">
                            {item.date.toLocaleDateString()}
                          </span>
                        </div>
                        <p className="timeline-details">{item.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ADD FIELD MODAL */}
        {showAddField && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add New Field</h3>
                <button className="close-btn" onClick={() => setShowAddField(false)}>×</button>
              </div>
              <form onSubmit={handleAddField}>
                <div className="form-group">
                  <label>Field Name *</label>
                  <input
                    type="text"
                    required
                    value={newField.fieldName}
                    onChange={(e) => setNewField({...newField, fieldName: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Acreage</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newField.acreage}
                    onChange={(e) => setNewField({...newField, acreage: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Soil Type</label>
                  <input
                    type="text"
                    value={newField.soilType}
                    onChange={(e) => setNewField({...newField, soilType: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Irrigation Type</label>
                  <input
                    type="text"
                    value={newField.irrigationType}
                    onChange={(e) => setNewField({...newField, irrigationType: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={newField.notes}
                    onChange={(e) => setNewField({...newField, notes: e.target.value})}
                  />
                </div>
                <button type="submit" className="btn-primary">Add Field</button>
              </form>
            </div>
          </div>
        )}

        {/* EDIT YEAR MODAL */}
        {showEditYear && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Edit {selectedYear} Season</h3>
                <button className="close-btn" onClick={() => setShowEditYear(false)}>×</button>
              </div>
              <form onSubmit={handleUpdateYear}>
                <div className="form-group">
                  <label>Crop</label>
                  <input
                    type="text"
                    value={editYearData.crop}
                    onChange={(e) => setEditYearData({...editYearData, crop: e.target.value})}
                    placeholder="e.g., Corn, Soybeans"
                  />
                </div>
                <div className="form-group">
                  <label>Variety</label>
                  <input
                    type="text"
                    value={editYearData.variety}
                    onChange={(e) => setEditYearData({...editYearData, variety: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Expected Yield (bu/ac)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editYearData.expectedYield}
                    onChange={(e) => setEditYearData({...editYearData, expectedYield: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={editYearData.notes}
                    onChange={(e) => setEditYearData({...editYearData, notes: e.target.value})}
                  />
                </div>
                <button type="submit" className="btn-primary">Save Changes</button>
              </form>
            </div>
          </div>
        )}

        {/* UPLOAD SOIL REPORT MODAL */}
        {showUploadSoil && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Upload Soil Report</h3>
                <button className="close-btn" onClick={() => setShowUploadSoil(false)}>×</button>
              </div>
              <form onSubmit={handleUploadSoilReport}>
                <div className="form-group">
                  <label>Report Date *</label>
                  <input
                    type="date"
                    required
                    value={soilUpload.reportDate}
                    onChange={(e) => setSoilUpload({...soilUpload, reportDate: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>PDF File *</label>
                  <input
                    type="file"
                    required
                    accept=".pdf"
                    onChange={(e) => setSoilUpload({...soilUpload, file: e.target.files[0]})}
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={soilUpload.notes}
                    onChange={(e) => setSoilUpload({...soilUpload, notes: e.target.value})}
                    placeholder="Any notes about this soil sample..."
                  />
                </div>
                <button type="submit" className="btn-primary">Upload Report</button>
              </form>
            </div>
          </div>
        )}

        {/* UPLOAD TISSUE REPORT MODAL */}
        {showUploadTissue && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Upload Tissue Report</h3>
                <button className="close-btn" onClick={() => setShowUploadTissue(false)}>×</button>
              </div>
              <form onSubmit={handleUploadTissueReport}>
                <div className="form-group">
                  <label>Report Date *</label>
                  <input
                    type="date"
                    required
                    value={tissueUpload.reportDate}
                    onChange={(e) => setTissueUpload({...tissueUpload, reportDate: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>PDF File *</label>
                  <input
                    type="file"
                    required
                    accept=".pdf"
                    onChange={(e) => setTissueUpload({...tissueUpload, file: e.target.files[0]})}
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={tissueUpload.notes}
                    onChange={(e) => setTissueUpload({...tissueUpload, notes: e.target.value})}
                    placeholder="Any notes about this tissue sample..."
                  />
                </div>
                <button type="submit" className="btn-primary">Upload Report</button>
              </form>
            </div>
          </div>
        )}

        {/* ADD SCOUTING NOTE MODAL */}
        {showAddScouting && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add Scouting Report</h3>
                <button className="close-btn" onClick={() => setShowAddScouting(false)}>×</button>
              </div>
              <form onSubmit={handleAddScoutingNote}>
                <div className="form-group">
                  <label>Scout Date *</label>
                  <input
                    type="date"
                    required
                    value={scoutingNote.reportDate}
                    onChange={(e) => setScoutingNote({...scoutingNote, reportDate: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Growth Stage</label>
                  <input
                    type="text"
                    value={scoutingNote.growthStage}
                    onChange={(e) => setScoutingNote({...scoutingNote, growthStage: e.target.value})}
                    placeholder="e.g., V6, R3, etc."
                  />
                </div>
                <div className="form-group">
                  <label>Pest Pressure</label>
                  <select
                    value={scoutingNote.pestPressure}
                    onChange={(e) => setScoutingNote({...scoutingNote, pestPressure: e.target.value})}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Weed Pressure</label>
                  <select
                    value={scoutingNote.weedPressure}
                    onChange={(e) => setScoutingNote({...scoutingNote, weedPressure: e.target.value})}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Disease Notes</label>
                  <textarea
                    value={scoutingNote.diseaseNotes}
                    onChange={(e) => setScoutingNote({...scoutingNote, diseaseNotes: e.target.value})}
                    placeholder="Any disease observations..."
                  />
                </div>
                <div className="form-group">
                  <label>General Notes</label>
                  <textarea
                    value={scoutingNote.generalNotes}
                    onChange={(e) => setScoutingNote({...scoutingNote, generalNotes: e.target.value})}
                    placeholder="Overall observations..."
                  />
                </div>
                <div className="form-group">
                  <label>Weather</label>
                  <input
                    type="text"
                    value={scoutingNote.weatherConditions}
                    onChange={(e) => setScoutingNote({...scoutingNote, weatherConditions: e.target.value})}
                    placeholder="e.g., Sunny, 75°F"
                  />
                </div>
                <div className="form-group">
                  <label>Photo (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setScoutingNote({...scoutingNote, photo: e.target.files[0]})}
                  />
                </div>
                <button type="submit" className="btn-primary">Add Report</button>
              </form>
            </div>
          </div>
        )}

        {/* UPLOAD YIELD MAP MODAL */}
        {showUploadYield && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Upload Yield Map</h3>
                <button className="close-btn" onClick={() => setShowUploadYield(false)}>×</button>
              </div>
              <form onSubmit={handleUploadYieldMap}>
                <div className="form-group">
                  <label>Harvest Date</label>
                  <input
                    type="date"
                    value={yieldUpload.harvestDate}
                    onChange={(e) => setYieldUpload({...yieldUpload, harvestDate: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Average Yield (bu/ac)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={yieldUpload.averageYield}
                    onChange={(e) => setYieldUpload({...yieldUpload, averageYield: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Total Bushels</label>
                  <input
                    type="number"
                    step="0.1"
                    value={yieldUpload.totalBushels}
                    onChange={(e) => setYieldUpload({...yieldUpload, totalBushels: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Moisture %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={yieldUpload.moistureAvg}
                    onChange={(e) => setYieldUpload({...yieldUpload, moistureAvg: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Yield Map File (optional)</label>
                  <input
                    type="file"
                    onChange={(e) => setYieldUpload({...yieldUpload, mapFile: e.target.files[0]})}
                  />
                  <small>Accepts: .shp, .csv, .pdf, images</small>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={yieldUpload.notes}
                    onChange={(e) => setYieldUpload({...yieldUpload, notes: e.target.value})}
                  />
                </div>
                <button type="submit" className="btn-primary">Upload Yield Map</button>
              </form>
            </div>
          </div>
        )}

        {/* ADD CUSTOM YEAR MODAL */}
        {showCustomYear && selectedField && (
          <div className="modal active">
            <div className="modal-content small">
              <div className="modal-header">
                <h3>Add Year to {selectedField.field_name}</h3>
                <button className="close-btn" onClick={() => setShowCustomYear(false)}>×</button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const yearInput = e.target.customYear.value;
                const year = parseInt(yearInput);
                
                if (year < 1900 || year > 2100) {
                  alert('Please enter a valid year between 1900 and 2100');
                  return;
                }
                
                try {
                  const token = localStorage.getItem('token');
                  await axios.post(`${API_URL}/field-years`, {
                    fieldName: selectedField.field_name,
                    year: year,
                    crop: '',
                    variety: '',
                    notes: ''
                  }, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  
                  await loadYears(selectedField.field_name);
                  setSelectedYear(year);
                  await loadYearDetails(selectedField.field_name, year);
                  setShowCustomYear(false);
                  alert(`${year} season added successfully!`);
                } catch (error) {
                  if (error.response?.data?.error?.includes('already exists')) {
                    // Year exists, just switch to it
                    setSelectedYear(year);
                    await loadYearDetails(selectedField.field_name, year);
                    setShowCustomYear(false);
                  } else {
                    alert('Failed to add year');
                  }
                }
              }}>
                <div className="form-group">
                  <label>Year *</label>
                  <input
                    type="number"
                    name="customYear"
                    required
                    min="1900"
                    max="2100"
                    defaultValue={new Date().getFullYear() + 1}
                    placeholder="Enter year (e.g., 2026)"
                  />
                </div>
                <button type="submit" className="btn-primary">Add Year</button>
              </form>
            </div>
          </div>
        )}

        {/* MANAGE FIELD MODAL */}
        {showManageField && selectedField && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Manage {selectedField.field_name}</h3>
                <button className="close-btn" onClick={() => setShowManageField(false)}>×</button>
              </div>
              
              <div className="manage-options">
                <div className="manage-section">
                  <h4>Field Details</h4>
                  <p><strong>Name:</strong> {selectedField.field_name}</p>
                  <p><strong>Acreage:</strong> {selectedField.acreage || 'Not set'} acres</p>
                  <p><strong>Soil Type:</strong> {selectedField.soil_type || 'Not set'}</p>
                  <p><strong>Irrigation:</strong> {selectedField.irrigation_type || 'Not set'}</p>
                  {selectedField.notes && <p><strong>Notes:</strong> {selectedField.notes}</p>}
                </div>
                
                <div className="manage-section danger-zone">
                  <h4>⚠️ Danger Zone</h4>
                  <p>Permanently delete this field and all associated data:</p>
                  <ul>
                    <li>All years and crop data</li>
                    <li>All soil and tissue reports</li>
                    <li>All scouting notes</li>
                    <li>All operations data</li>
                    <li>All yield maps</li>
                  </ul>
                  <p><strong>This cannot be undone!</strong></p>
                  <button 
                    className="btn-danger"
                    onClick={() => {
                      setShowManageField(false);
                      handleDeleteField(selectedField.id);
                    }}
                  >
                    🗑️ Delete Field Permanently
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FieldsModule;
