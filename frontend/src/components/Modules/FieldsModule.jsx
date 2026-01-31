import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import { fieldsAPI, fieldReportsAPI } from '../../utils/api';
import './FieldsModule.css';

function FieldsModule({ user, onLogout }) {
  const navigate = useNavigate();
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [years, setYears] = useState([]);
  const [showAddField, setShowAddField] = useState(false);
  const [showAddYear, setShowAddYear] = useState(false);
  const [showAddReport, setShowAddReport] = useState(false);
  const [reportType, setReportType] = useState('');
  const [reports, setReports] = useState([]);
  const [view, setView] = useState('list'); // list, field-detail, year-detail, reports
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [newField, setNewField] = useState({
    fieldName: '',
    acreage: '',
    soilType: '',
    irrigationType: '',
    notes: ''
  });

  const [newYear, setNewYear] = useState({ year: new Date().getFullYear() });
  
  const [newReport, setNewReport] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    notes: '',
    file: null
  });

  useEffect(() => {
    loadFields();
  }, []);

  const loadFields = async () => {
    try {
      setLoading(true);
      const response = await fieldsAPI.getAll();
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
      const response = await fieldReportsAPI.getYears(fieldName);
      const yearsList = response.data || [];
      setYears(yearsList.sort((a, b) => b - a));
    } catch (error) {
      console.error('Error loading years:', error);
      setYears([]);
    }
  };

  const loadReports = async (fieldName, year, type) => {
    try {
      const response = await fieldReportsAPI.getByFieldAndYear(fieldName, year);
      const filtered = response.data.filter(r => r.report_type === type);
      setReports(filtered);
    } catch (error) {
      console.error('Error loading reports:', error);
      setReports([]);
    }
  };

  const handleAddField = async (e) => {
    e.preventDefault();
    try {
      await fieldsAPI.create(newField);
      setShowAddField(false);
      setNewField({ fieldName: '', acreage: '', soilType: '', irrigationType: '', notes: '' });
      loadFields();
      alert('Field added successfully!');
    } catch (error) {
      console.error('Error adding field:', error);
      alert('Failed to add field');
    }
  };

  const handleFieldClick = async (field) => {
    setSelectedField(field);
    await loadYears(field.field_name);
    setView('field-detail');
  };

  const handleYearClick = async (year) => {
    setSelectedYear(year);
    setView('year-detail');
  };

  const handleAddYear = async (e) => {
    e.preventDefault();
    try {
      // Create a placeholder report to establish the year
      const reportData = new FormData();
      reportData.append('fieldName', selectedField.field_name);
      reportData.append('year', newYear.year);
      reportData.append('reportType', '_year_marker');
      reportData.append('reportDate', `${newYear.year}-01-01`);
      reportData.append('notes', 'Year placeholder');

      await fieldReportsAPI.create(reportData);
      setShowAddYear(false);
      setNewYear({ year: new Date().getFullYear() });
      await loadYears(selectedField.field_name);
      alert('Year added successfully!');
    } catch (error) {
      console.error('Error adding year:', error);
      alert('Failed to add year');
    }
  };

  const handleAddReport = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('fieldName', selectedField.field_name);
      formData.append('year', selectedYear);
      formData.append('reportType', reportType);
      formData.append('reportDate', newReport.reportDate);
      formData.append('notes', newReport.notes);
      if (newReport.file) {
        formData.append('file', newReport.file);
      }

      await fieldReportsAPI.create(formData);
      setShowAddReport(false);
      setNewReport({ reportDate: new Date().toISOString().split('T')[0], notes: '', file: null });
      await loadReports(selectedField.field_name, selectedYear, reportType);
      alert('Report added successfully!');
    } catch (error) {
      console.error('Error adding report:', error);
      alert('Failed to add report');
    }
  };

  const handleDeleteField = async (fieldId) => {
    if (!window.confirm('Are you sure you want to delete this field?')) return;
    try {
      await fieldsAPI.delete(fieldId);
      loadFields();
      alert('Field deleted successfully!');
    } catch (error) {
      console.error('Error deleting field:', error);
      alert('Failed to delete field');
    }
  };

  const filteredFields = fields.filter(f => 
    f.field_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                    key={year} 
                    className="year-card"
                    onClick={() => handleYearClick(year)}
                  >
                    <h3>{year} Season</h3>
                    <p>View reports →</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* YEAR DETAIL VIEW - Report Types */}
        {view === 'year-detail' && selectedField && selectedYear && (
          <>
            <button className="back-button" onClick={() => setView('field-detail')}>
              ← Back to Field
            </button>
            
            <div className="field-detail-header">
              <h3>{selectedField.field_name} - {selectedYear} Season</h3>
            </div>

            <div className="module-grid">
              <div 
                className="module-card"
                onClick={() => {
                  setReportType('soil');
                  loadReports(selectedField.field_name, selectedYear, 'soil');
                  setView('reports');
                }}
              >
                <span className="module-icon">🧪</span>
                <h3>Soil Reports</h3>
                <p>View soil test results</p>
              </div>

              <div 
                className="module-card"
                onClick={() => {
                  setReportType('tissue');
                  loadReports(selectedField.field_name, selectedYear, 'tissue');
                  setView('reports');
                }}
              >
                <span className="module-icon">🌿</span>
                <h3>Tissue Reports</h3>
                <p>View tissue sample results</p>
              </div>
            </div>
          </>
        )}

        {/* REPORTS VIEW */}
        {view === 'reports' && (
          <>
            <button className="back-button" onClick={() => setView('year-detail')}>
              ← Back to Season
            </button>
            
            <div className="section-header">
              <h2>{reportType === 'soil' ? '🧪 Soil Reports' : '🌿 Tissue Reports'}</h2>
              <button className="add-button" onClick={() => setShowAddReport(true)}>
                + Add Report
              </button>
            </div>

            {reports.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">{reportType === 'soil' ? '🧪' : '🌿'}</div>
                <p>No reports yet. Click "Add Report" to upload a {reportType} report.</p>
              </div>
            ) : (
              <div className="report-list">
                {reports.map((report) => (
                  <div key={report.id} className="report-card">
                    <div className="report-header">
                      <h4>{new Date(report.report_date).toLocaleDateString()}</h4>
                      {report.file_name && (
                        <a 
                          href={`/api/field-reports/download/${report.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="download-btn"
                        >
                          📥 Download
                        </a>
                      )}
                    </div>
                    {report.notes && <p>{report.notes}</p>}
                  </div>
                ))}
              </div>
            )}
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
                    onChange={(e) => setNewYear({year: e.target.value})}
                  />
                </div>
                <button type="submit" className="btn-primary">Add Year</button>
              </form>
            </div>
          </div>
        )}

        {/* ADD REPORT MODAL */}
        {showAddReport && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add {reportType === 'soil' ? 'Soil' : 'Tissue'} Report</h3>
                <button className="close-btn" onClick={() => setShowAddReport(false)}>×</button>
              </div>
              <form onSubmit={handleAddReport}>
                <div className="form-group">
                  <label>Report Date *</label>
                  <input
                    type="date"
                    required
                    value={newReport.reportDate}
                    onChange={(e) => setNewReport({...newReport, reportDate: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Upload File (PDF)</label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setNewReport({...newReport, file: e.target.files[0]})}
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={newReport.notes}
                    onChange={(e) => setNewReport({...newReport, notes: e.target.value})}
                  />
                </div>
                <button type="submit" className="btn-primary">Add Report</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FieldsModule;