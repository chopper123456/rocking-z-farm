import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';

function Header({ user, onLogout, title }) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="app-header">
      <div className="header-content">
        <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          🌾 {title || 'Rocking Z Acres'}
        </h1>
        
        <div className="header-actions" ref={menuRef}>
          <div className="user-menu">
            <button 
              className="menu-trigger"
              onClick={() => setShowMenu(!showMenu)}
            >
              <span className="user-name">{user?.fullName || user?.username}</span>
              <span className={`role-badge role-${user?.role || (user?.isAdmin ? 'admin' : 'team')}`}>
                {user?.role === 'admin' || user?.isAdmin ? 'Admin' : 'Team'}
              </span>
              <span className="menu-icon">▼</span>
            </button>

            {showMenu && (
              <div className="dropdown-menu">
                <div className="menu-section">
                  <div className="menu-header">Account</div>
                  <div className="menu-item" onClick={() => {
                    navigate('/settings');
                    setShowMenu(false);
                  }}>
                    ⚙️ Settings
                  </div>
                  {user?.isAdmin && (
                    <div className="menu-item" onClick={() => {
                      navigate('/john-deere');
                      setShowMenu(false);
                    }}>
                      🚜 John Deere Integration
                    </div>
                  )}
                </div>

                {user?.isAdmin && (
                  <div className="menu-section">
                    <div className="menu-header">Admin</div>
                    <div className="menu-item" onClick={() => {
                      navigate('/admin');
                      setShowMenu(false);
                    }}>
                      👨‍💼 Employee Management
                    </div>
                  </div>
                )}

                <div className="menu-section">
                  <div 
                    className="menu-item logout"
                    onClick={() => {
                      setShowMenu(false);
                      onLogout();
                    }}
                  >
                    🚪 Logout
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
