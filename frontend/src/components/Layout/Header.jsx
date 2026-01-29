import { useNavigate } from 'react-router-dom';
import './Header.css';

function Header({ user, onLogout, title = "Rocking Z" }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
      navigate('/login');
    }
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            {title}
            <span className="status-indicator"></span>
          </h1>
          {user?.farmName && <span className="farm-name">{user.farmName}</span>}
        </div>
        <div className="header-right">
          <span className="user-name">👤 {user?.username}</span>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
