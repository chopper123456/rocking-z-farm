import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import './Dashboard.css';

function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();

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
          <h2>Welcome back, {user?.fullName || user?.username}! 👋</h2>
          <p>
            {user?.farmName ? `Managing ${user.farmName}` : 'Manage your farm operations efficiently with Rocking Z Acres.'}
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
      </div>
    </div>
  );
}

export default Dashboard;
