import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import axios from 'axios';
import './AdminPanel.css';

function AdminPanel({ user, onLogout }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    fullName: ''
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    // Check if user is admin
    if (!user?.isAdmin) {
      alert('Access denied. Admin only.');
      navigate('/');
      return;
    }
    loadUsers();
  }, [user, navigate]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadActivityLog = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/activity-log?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivityLog(response.data);
      setShowActivityLog(true);
    } catch (error) {
      console.error('Error loading activity log:', error);
      alert('Failed to load activity log');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (newUser.password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/auth/register`, newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setShowAddUser(false);
      setNewUser({ username: '', email: '', password: '', fullName: '' });
      loadUsers();
      alert('Employee account created successfully!');
    } catch (error) {
      console.error('Error creating user:', error);
      const errorMsg = error.response?.data?.error || 
                      error.response?.data?.errors?.[0]?.msg ||
                      'Failed to create user';
      alert(errorMsg);
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    const action = currentStatus ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API_URL}/auth/users/${userId}/toggle-active`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadUsers();
      alert(`User ${action}d successfully`);
    } catch (error) {
      console.error('Error toggling user:', error);
      alert(error.response?.data?.error || 'Failed to update user');
    }
  };

  const handleResetPassword = async (userId, username) => {
    const newPassword = prompt(`Enter new password for ${username} (min 8 characters):`);
    
    if (!newPassword) return;
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/auth/users/${userId}/reset-password`, 
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`Password reset for ${username}. New password: ${newPassword}`);
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Failed to reset password');
    }
  };

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className="app-container">
      <Header user={user} onLogout={onLogout} title="Admin Panel" />
      
      <div className="admin-content">
        <div className="admin-header">
          <h2>👨‍💼 Employee Management</h2>
          <div className="admin-actions">
            <button className="btn-primary" onClick={() => setShowAddUser(true)}>
              + Add Employee
            </button>
            <button className="btn-secondary" onClick={loadActivityLog}>
              📊 View Activity Log
            </button>
            <button className="btn-secondary" onClick={() => navigate('/')}>
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading employees...</div>
        ) : (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={!u.is_active ? 'inactive' : ''}>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.farm_name || '-'}</td>
                    <td>
                      <span className={`role-badge ${u.is_admin ? 'admin' : 'user'}`}>
                        {u.is_admin ? 'Admin' : 'Employee'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${u.is_active ? 'active' : 'inactive'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                    <td>
                      <div className="action-buttons">
                        {!u.is_admin && (
                          <>
                            <button 
                              className="btn-small"
                              onClick={() => handleToggleActive(u.id, u.is_active)}
                            >
                              {u.is_active ? 'Disable' : 'Enable'}
                            </button>
                            <button 
                              className="btn-small"
                              onClick={() => handleResetPassword(u.id, u.username)}
                            >
                              Reset Password
                            </button>
                          </>
                        )}
                        {u.is_admin && <span className="text-muted">Admin Account</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add User Modal */}
        {showAddUser && (
          <div className="modal active">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add New Employee</h3>
                <button className="close-btn" onClick={() => setShowAddUser(false)}>×</button>
              </div>
              <form onSubmit={handleAddUser}>
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    placeholder="johndoe"
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>
                <div className="form-group">
                  <label>Password * (min 8 characters)</label>
                  <input
                    type="password"
                    required
                    minLength="8"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddUser(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Activity Log Modal */}
        {showActivityLog && (
          <div className="modal active">
            <div className="modal-content large">
              <div className="modal-header">
                <h3>📊 Activity Log (Last 50 actions)</h3>
                <button className="close-btn" onClick={() => setShowActivityLog(false)}>×</button>
              </div>
              <div className="activity-log">
                {activityLog.map((log) => (
                  <div key={log.id} className="activity-item">
                    <div className="activity-time">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    <div className="activity-details">
                      <strong>{log.username || 'Unknown'}</strong> - {log.action}
                      {log.ip_address && <span className="ip"> from {log.ip_address}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
