import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import axios from 'axios';
import './FieldsModule.css';

function FieldsModule({ user, onLogout }) {
  const navigate = useNavigate();
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearDetails, setYearDetails] = useState(null);
  const [years, setYears] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [view, setView] = useState('list'); // list, field-detail, year-detail
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddField, setShowAddField] = useState(false);
  const [showAddYear, setShowAddYear] = useState(false);

  // Tab-specific data
  const [scoutingReports, setScoutingReports] = useState([]);
  const [soilReports, setSoilReports] = useState([]);
  const [tissueReports, setTissueReports] = useState([]);
  const [yieldMap, setYieldMap] = useState(null);
  const [operations, setOperations] = useState([]);

  const [newField, setNewField] = useState({
    fieldName: '',
    acreage: '',
    soilType: '',
    irrigationType: '',
    notes: ''
  });

  const [newYear, setNewYear] = useState({
    year: new Date().getFullYear(),
    crop: '',
    variety: '',
    plantingDate: '',
    expectedYield: '',
    notes: ''
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    loadFields();
  }, []);

  useEffect(() => {
    if (selectedField && selectedYear && yearDetails) {
      loadTabData(activeTab);
    }
  }, [activeTab, selectedField, selectedYear, yearDetails]);

  const loadFields = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/fields`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    } catch (error) {
      console.error('Error loading year details:', error);
    }
  };

  const loadTabData = async (tab) => {
    const token = localStorage.getItem('token');
    
    try {
      switch(tab) {
        case 'scouting':
          const scoutingRes = await axios.get(
            `${API_URL}/scouting-reports/${selectedField.field_name}/${selectedYear}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setScoutingReports(scoutingRes.data);
          break;
          
        case 'soil':
          const soilRes = await axios.get(
            `${API_URL}/field-reports/${selectedField.field_name}/${selectedYear}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setSoilReports(soilRes.data.filter(r => r.report_type === 'soil'));
          break;
          
        case 'tissue':
          const tissueRes = await axios.get(
            `${API_URL}/field-reports/${selectedField.field_name}/${selectedYear}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setTissueReports(tissueRes.data.filter(r => r.report_type === 'tissue'));
          break;
          
        case 'yield':
          try {
            const yieldRes = await axios.get(
              `${API_URL}/yield-maps/${selectedField.field_name}/${selectedYear}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            setYieldMap(yieldRes.data);
          } catch (error) {
            if (error.response?.status === 404) {
              setYieldMap(null);
            }
          }
          break;
          
        case 'operations':
          const opsRes = await axios.get(
            `${API_URL}/field-operations/${selectedField.field_name}/${selectedYear}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setOperations(opsRes.data);
          break;
      }
    } catch (error) {
      console.error(`Error loading ${tab} data:`, error);
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

  const handleAddYear = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/field-years`, {
        ...newYear,
        fieldName: selectedField.field_name
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAddYear(false);
      setNewYear({ year: new Date().getFullYear(), crop: '', variety: '', plantingDate: '', expectedYield: '', notes: '' });
      await loadYears(selectedField.field_name);
      alert('Year added successfully!');
    } catch (error) {
      console.error('Error adding year:', error);
      alert(error.response?.data?.error || 'Failed to add year');
    }
  };

  const handleFieldClick = async (field) => {
    setSelectedField(field);
    await loadYears(field.field_name);
    setView('field-detail');
  };

  const handleYearClick = async (year) => {
    setSelectedYear(year.year);
    await loadYearDetails(selectedField.field_name, year.year);
    setActiveTab('overview');
    setView('year-detail');
  };

  const handleDeleteField = async (fieldId) => {
    if (!window.confirm('Are you sure you want to delete this field?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/fields/${fieldId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadFields();
      alert('Field deleted successfully!');
    } catch (error) {
      console.error('Error deleting field:', error);
      alert('Failed to delete field');
    }
  };

  const handleSyncOperations = async () => {
    if (!window.confirm(`Sync field operations from John Deere for ${selectedField.field_name} (${selectedYear})?`)) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/field-operations/sync/${selectedField.field_name}/${selectedYear}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`✅ ${response.data.message}`);
      loadTabData('operations');
    } catch (error) {
      console.error('Error syncing operations:', error);
      alert('Failed to sync operations. Make sure John Deere is connected.');
    }
  };

  const filteredFields = fields.filter(f => 
    f.field_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs = [
    { id: 'overview', label: '📋 Overview', icon: '📋' },
    { id: 'scouting', label: '🔍 Scouting', icon: '🔍' },
    { id: 'soil', label: '🧪 Soil Samples', icon: '🧪' },
    { id: 'tissue', label: '🌿 Tissue Samples', icon: '🌿' },
    { id: 'yield', label: '📊 Yield Map', icon: '📊' },
    { id: 'operations', label: '🚜 Operations', icon: '🚜' }
  ];

  return (
    <div className="app-container">
      <Header user={user} onLogout={onLogout} title="Fields Management" />
      
      <div className="module-content">
        {/* FIELD LIST VIEW */}
        {view === 'list' && (
          <>
            <div className="section-header">
              <h2>🌱 Your Fields</h2>
              <button className="add-button" onClick={() => setShowAddField(true)}>
                + Add Field
              </button>
            </div>

            <div className="search-bar">
              <input
                type="text"
                placeholder="🔍 Search fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="loading">Loading fields...</div>
            ) : filteredFields.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🌱</div>
                <p>No fields yet. Click "Add Field" to create your first field.</p>
              </div>
            ) : (
              <div className="field-list">
                {filteredFields.map((field) => (
                  <div key={field.id} className="field-card">
                    <div className="field-card-content" onClick={() => handleFieldClick(field)}>
                      <h3>{field.field_name}</h3>
                      <div className="field-info">
                        {field.acreage && <span>📏 {field.acreage} acres</span>}
                        {field.soil_type && <span>🌱 {field.soil_type}</span>}
                      </div>
                    </div>
                    <button 
                      className="delete-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteField(field.id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* FIELD DETAIL VIEW - Year Selection */}
        {view === 'field-detail' && selectedField && (
          <>
            <button className="back-button" onClick={() => setView('list')}>
              ← Back to Fields
            </button>
            
            <div className="field-detail-header">
              <h3>{selectedField.field_name}</h3>
              <p>
                {selectedField.acreage && `${selectedField.acreage} acres`}
                {selectedField.soil_type && ` • ${selectedField.soil_type}`}
              </p>
            </div>

            <div className="section-header">
              <h2>Select Season</h2>
              <button className="add-button" onClick={() => setShowAddYear(true)}>
                + Add Year
              </button>
            </div>

            {years.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <p>No years yet. Click "Add Year" to start tracking this field.</p>
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
          </>
        )}

        {/* YEAR DETAIL VIEW - Tabs */}
        {view === 'year-detail' && selectedField && selectedYear && yearDetails && (
          <>
            <button className="back-button" onClick={() => setView('field-detail')}>
              ← Back to Field
            </button>
            
            <div className="field-detail-header">
              <h3>{selectedField.field_name} - {selectedYear} Season</h3>
              <p>{yearDetails.crop || 'No crop'} {yearDetails.variety && `• ${yearDetails.variety}`}</p>
            </div>

            <div className="tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div className="tab-content">
              {activeTab === 'overview' && (
                <div className="overview-content">
                  <h3>Year Details</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Crop:</label>
                      <span>{yearDetails.crop || 'Not specified'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Variety:</label>
                      <span>{yearDetails.variety || 'Not specified'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Planting Date:</label>
                      <span>{yearDetails.planting_date ? new Date(yearDetails.planting_date).toLocaleDateString() : 'Not set'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Expected Yield:</label>
                      <span>{yearDetails.expected_yield || 'Not set'}</span>
                    </div>
                    {yearDetails.actual_yield && (
                      <div className="detail-item">
                        <label>Actual Yield:</label>
                        <span>{yearDetails.actual_yield}</span>
                      </div>
                    )}
                  </div>
                  {yearDetails.notes && (
                    <div className="notes-section">
                      <h4>Notes:</h4>
                      <p>{yearDetails.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'operations' && (
                <div className="operations-content">
                  <div className="section-header">
                    <h3>Field Operations</h3>
                    <button className="add-button" onClick={handleSyncOperations}>
                      🔄 Sync from John Deere
                    </button>
                  </div>
                  
                  {operations.length === 0 ? (
                    <div className="empty-state">
                      <p>No operations recorded. Click "Sync from John Deere" to import operations.</p>
                    </div>
                  ) : (
                    <div className="operations-timeline">
                      {operations.map(op => (
                        <div key={op.id} className="operation-card">
                          <div className="operation-header">
                            <h4>{op.operation_type}</h4>
                            <span className="operation-date">{new Date(op.operation_date).toLocaleDateString()}</span>
                          </div>
                          <div className="operation-details">
                            {op.equipment_used && <p><strong>Equipment:</strong> {op.equipment_used}</p>}
                            {op.operator && <p><strong>Operator:</strong> {op.operator}</p>}
                            {op.product_applied && <p><strong>Product:</strong> {op.product_applied}</p>}
                            {op.rate && <p><strong>Rate:</strong> {op.rate} {op.rate_unit}</p>}
                            {op.area_covered && <p><strong>Area:</strong> {op.area_covered} acres</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Other tabs will be implemented in next iteration */}
              {activeTab !== 'overview' && activeTab !== 'operations' && (
                <div className="coming-soon">
                  <p>This tab is being built. Check back soon!</p>
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

        {/* ADD YEAR MODAL */}
        {showAddYear && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add Year</h3>
                <button className="close-btn" onClick={() => setShowAddYear(false)}>×</button>
              </div>
              <form onSubmit={handleAddYear}>
                <div className="form-group">
                  <label>Year *</label>
                  <input
                    type="number"
                    required
                    min="2000"
                    max="2100"
                    value={newYear.year}
                    onChange={(e) => setNewYear({...newYear, year: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Crop</label>
                  <input
                    type="text"
                    value={newYear.crop}
                    onChange={(e) => setNewYear({...newYear, crop: e.target.value})}
                    placeholder="e.g., Corn, Soybeans"
                  />
                </div>
                <div className="form-group">
                  <label>Variety</label>
                  <input
                    type="text"
                    value={newYear.variety}
                    onChange={(e) => setNewYear({...newYear, variety: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Planting Date</label>
                  <input
                    type="date"
                    value={newYear.plantingDate}
                    onChange={(e) => setNewYear({...newYear, plantingDate: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Expected Yield</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newYear.expectedYield}
                    onChange={(e) => setNewYear({...newYear, expectedYield: e.target.value})}
                    placeholder="Bushels per acre"
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={newYear.notes}
                    onChange={(e) => setNewYear({...newYear, notes: e.target.value})}
                  />
                </div>
                <button type="submit" className="btn-primary">Add Year</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FieldsModule;
