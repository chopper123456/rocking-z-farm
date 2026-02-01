import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../Layout/Header';
import axios from 'axios';
import './Dashboard.css';

function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [jdConnected, setJdConnected] = useState(false);
  const [jdLoading, setJdLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    checkJohnDeereStatus();
    
    // Check for OAuth callback
    if (searchParams.get('jd_connected') === 'true') {
      alert('✅ Successfully connected to John Deere!');
      checkJohnDeereStatus();
    }
    if (searchParams.get('jd_error')) {
      alert('❌ Failed to connect to John Deere. Please try again.');
    }
  }, [searchParams]);

  const checkJohnDeereStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/john-deere/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJdConnected(response.data.connected);
    } catch (error) {
      console.error('Error checking JD status:', error);
      setJdConnected(false);
    }
  };

  const handleConnectJohnDeere = () => {
    setJdLoading(true);
    const token = localStorage.getItem('token');
    window.location.href = `${API_URL}/john-deere/connect?token=${token}`;
  };

  const handleSyncFields = async () => {
    if (!window.confirm('This will import all your fields from John Deere. Continue?')) {
      return;
    }

    setSyncing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/john-deere/sync/fields`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(`✅ ${response.data.message}\n\nFields added: ${response.data.fieldsAdded}\nTotal fields found: ${response.data.totalFields}`);
      
      // Refresh fields page if user wants to see them
      if (window.confirm('Would you like to view your fields now?')) {
        navigate('/fields');
      }
    } catch (error) {
      console.error('Sync error:', error);
      
      // Check if error response has connections URL
      if (error.response?.data?.connectionsUrl) {
        const connectionsUrl = error.response.data.connectionsUrl;
        const message = error.response.data.message || 'You need to enable organization access';
        
        if (window.confirm(`${message}\n\nClick OK to open the connections page in a new tab.`)) {
          window.open(connectionsUrl, '_blank');
        }
      } else {
        alert(`❌ Failed to sync fields.\n\n${error.response?.data?.message || error.message || 'Please try again.'}`);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect from John Deere?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/john-deere/disconnect`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJdConnected(false);
      alert('✅ Disconnected from John Deere');
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('❌ Failed to disconnect');
    }
  };

  const modules = [
    {
      id: 'fields',
      icon: '🌾',
      title: 'Fields',
      description: 'Monitor field data, soil tests, and tissue samples',
      path: '/fields',
    },
    {
      id: 'equipment',
      icon: '🚜',
      title: 'Equipment',
      description: 'Log equipment maintenance and service records',
      path: '/equipment',
    },
    {
      id: 'grain',
      icon: '🌽',
      title: 'Grain',
      description: 'Track grain inventory and storage',
      path: '/grain',
    },
    {
      id: 'inventory',
      icon: '🧪',
      title: 'Inventory',
      description: 'Manage farm supplies and inventory',
      path: '/inventory',
    },
  ];

  return (
    <div className="app-container">
      <Header user={user} onLogout={onLogout} />
      
      <div className="home-screen">
        <div className="welcome-card">
          <h2>Welcome back, {user?.username}! 👋</h2>
          <p>
            {user?.farmName ? `Managing ${user.farmName}` : 'Manage your farm operations efficiently with Rocking Z Acres.'}
          </p>
          {user?.isAdmin && (
            <button 
              className="admin-button"
              onClick={() => navigate('/admin')}
            >
              👨‍💼 Admin Panel
            </button>
          )}
        </div>

        {/* John Deere Integration Section */}
        <div className="jd-integration-card">
          <div className="jd-header">
            <div>
              <h3>🚜 John Deere Integration</h3>
              <p>{jdConnected ? 'Connected and ready to sync' : 'Connect to import your fields automatically'}</p>
            </div>
            {jdConnected && (
              <span className="connected-badge">✓ Connected</span>
            )}
          </div>
          
          {jdConnected ? (
            <div className="jd-actions">
              <button 
                className="btn-sync" 
                onClick={handleSyncFields}
                disabled={syncing}
              >
                {syncing ? '⏳ Syncing...' : '🔄 Sync Fields from John Deere'}
              </button>
              <button 
                className="btn-disconnect" 
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button 
              className="btn-connect-jd" 
              onClick={handleConnectJohnDeere}
              disabled={jdLoading}
            >
              {jdLoading ? 'Connecting...' : '🔗 Connect John Deere Account'}
            </button>
          )}
        </div>

        <div className="module-grid">
          {modules.map((module) => (
            <div
              key={module.id}
              className="module-card"
              onClick={() => navigate(module.path)}
            >
              <div className="module-icon">{module.icon}</div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
            </div>
          ))}
        </div>

        <div className="info-section">
          <div className="info-card">
            <h3>🌱 Getting Started</h3>
            <p>
              {jdConnected 
                ? 'Click "Sync Fields" above to import all your fields from John Deere!' 
                : 'Connect your John Deere account above to automatically import all your fields and equipment.'}
            </p>
          </div>
          <div className="info-card">
            <h3>📊 Farm Data</h3>
            <p>
              All your information is securely stored and accessible anytime from any device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
