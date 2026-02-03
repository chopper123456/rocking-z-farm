import { NavLink } from 'react-router-dom';
import './BottomNav.css';

const navItems = [
  { to: '/', icon: '🏠', label: 'Home' },
  { to: '/fields', icon: '🌾', label: 'Fields' },
  { to: '/equipment', icon: '🚜', label: 'Equipment' },
  { to: '/grain', icon: '🌽', label: 'Grain' },
  { to: '/inventory', icon: '🧪', label: 'Inventory' }
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main">
      <div className="bottom-nav-inner">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            end={to === '/'}
          >
            <span className="bottom-nav-icon" aria-hidden="true">{icon}</span>
            <span className="bottom-nav-label">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
