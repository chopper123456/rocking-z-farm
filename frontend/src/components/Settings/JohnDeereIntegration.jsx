import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../Layout/Header';
import api, { API_URL } from '../../utils/api';
import './JohnDeereIntegration.css';

function getStoredToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function JohnDeereIntegration({ user, onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [jdConnected, setJdConnected] = useState(false);
  const [jdLoading, setJdLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

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
      setLoading(true);
      const response = await api.get('/john-deere/status');
      setJdConnected(response.data.connected);
    } catch (error) {
      console.error('Error checking JD status:', error);
      setJdConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectJohnDeere = () => {
    setJdLoading(true);
    const token = getStoredToken();
    window.location.href = `${API_URL}/john-deere/connect?token=${token}`;
  };

  const handleSyncFields = async () => {
    if (!window.confirm('This will import all your fields from John Deere. Continue?')) {
      return;
    }

    setSyncing(true);
    try {
      const response = await api.post('/john-deere/sync/fields', {});
      
      alert(`✅ ${response.data.message}\n\nFields added: ${response.data.fieldsAdded}\nTotal fields found: ${response.data.totalFields}`);
      
      if (window.confirm('Would you like to view your fields now?')) {
        navigate('/fields');
      }
    } catch (error) {
      console.error('Sync error:', error);
      if (error.response?.status === 401) return; // api interceptor handles redirect to login
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
      await api.delete('/john-deere/disconnect');
      setJdConnected(false);
      alert('✅ Disconnected from John Deere');
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('❌ Failed to disconnect');
    }
  };

  return (
    <div className="app-container">
      <Header user={user} onLogout={onLogout} title="John Deere Integration" />
      
      <div className="jd-page">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>

        <div className="jd-page-header">
          <h2>🚜 John Deere Operations Center</h2>
          <p>Connect your John Deere account to automatically sync fields and equipment</p>
        </div>

        {loading ? (
          <div className="loading">Checking connection status...</div>
        ) : (
          <>
            <div className="jd-status-card">
              <div className="status-header">
                <h3>Connection Status</h3>
                {jdConnected ? (
                  <span className="status-badge connected">✓ Connected</span>
                ) : (
                  <span className="status-badge disconnected">✗ Not Connected</span>
                )}
              </div>

              {jdConnected ? (
                <div className="jd-connected-content">
                  <p className="status-text">Your account is connected to John Deere Operations Center.</p>
                  
                  <div className="jd-actions">
                    <button 
                      className="btn-sync" 
                      onClick={handleSyncFields}
                      disabled={syncing}
                    >
                      {syncing ? '⏳ Syncing...' : '🔄 Sync Fields Now'}
                    </button>
                    <button 
                      className="btn-disconnect" 
                      onClick={handleDisconnect}
                    >
                      Disconnect Account
                    </button>
                  </div>

                  <div className="info-box">
                    <h4>What gets synced?</h4>
                    <ul>
                      <li>✓ All field boundaries and names</li>
                      <li>✓ Field acreage and soil types</li>
                      <li>✓ Equipment details (coming soon)</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="jd-disconnected-content">
                  <p className="status-text">Connect to automatically import your fields from John Deere.</p>
                  
                  <button 
                    className="btn-connect-jd" 
                    onClick={handleConnectJohnDeere}
                    disabled={jdLoading}
                  >
                    {jdLoading ? 'Connecting...' : '🔗 Connect John Deere Account'}
                  </button>

                  <div className="info-box">
                    <h4>Benefits of Connecting:</h4>
                    <ul>
                      <li>✓ Automatically import all fields</li>
                      <li>✓ Keep field data up-to-date</li>
                      <li>✓ No manual data entry required</li>
                      <li>✓ Secure OAuth connection</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default JohnDeereIntegration;
