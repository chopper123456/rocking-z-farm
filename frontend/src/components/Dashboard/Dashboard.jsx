import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import './Dashboard.css';

function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const modules = [
    {
      id: 'livestock',
      icon: '🐄',
      title: 'Livestock',
      description: 'Track and manage your livestock records',
      path: '/livestock',
    },
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
            {user?.farmName ? `Managing ${user.farmName}` : 'Manage your farm operations efficiently with Rocking Z.'}
          </p>
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
              Click on any module above to start managing your farm data. 
              All your information is securely stored and accessible anytime.
            </p>
          </div>
          <div className="info-card">
            <h3>🔄 Coming Soon</h3>
            <p>
              John Deere Operations Center integration will be available soon, 
              allowing you to sync field data automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
