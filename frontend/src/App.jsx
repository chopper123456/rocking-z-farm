import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';
import AdminPanel from './components/Admin/AdminPanel';
import JohnDeereIntegration from './components/Settings/JohnDeereIntegration';
import LivestockModule from './components/Modules/LivestockModule';
import FieldsModule from './components/Modules/FieldsModule';
import EquipmentModule from './components/Modules/EquipmentModule';
import GrainModule from './components/Modules/GrainModule';
import InventoryModule from './components/Modules/InventoryModule';
import { SpeedInsights } from '@vercel/speed-insights/react';
import InstallPrompt from './components/PWA/InstallPrompt';
import BottomNav from './components/Layout/BottomNav';
import './components/PWA/PWA.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      document.body.classList.add('has-bottom-nav');
    } else {
      document.body.classList.remove('has-bottom-nav');
    }
    return () => document.body.classList.remove('has-bottom-nav');
  }, [isAuthenticated]);

  const handleLogin = (token, userData, rememberMe = false) => {
    if (rememberMe) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
    } else {
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(userData));
    }
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.5rem',
        color: 'var(--earth-dark)'
      }}>
        Loading... 🌾
      </div>
    );
  }

  return (
    <Router>
      <SpeedInsights />
      {isAuthenticated && (
        <>
          <InstallPrompt />
          <BottomNav />
        </>
      )}
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? 
            <Navigate to="/" replace /> : 
            <Login onLogin={handleLogin} />
          } 
        />
        <Route
          path="/"
          element={
            isAuthenticated ? 
            <Dashboard user={user} onLogout={handleLogout} /> : 
            <Navigate to="/login" replace />
          }
        />
        <Route
          path="/admin"
          element={
            isAuthenticated ? 
            (user?.isAdmin ? <AdminPanel user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />) : 
            <Navigate to="/login" replace />
          }
        />
        <Route
          path="/john-deere"
          element={
            isAuthenticated ? 
            (user?.isAdmin ? <JohnDeereIntegration user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />) : 
            <Navigate to="/login" replace />
          }
        />
        <Route
          path="/livestock"
          element={
            isAuthenticated ? 
            <LivestockModule user={user} onLogout={handleLogout} /> : 
            <Navigate to="/login" replace />
          }
        />
        <Route
          path="/fields"
          element={
            isAuthenticated ? 
            <FieldsModule user={user} onLogout={handleLogout} /> : 
            <Navigate to="/login" replace />
          }
        />
        <Route
          path="/equipment"
          element={
            isAuthenticated ? 
            <EquipmentModule user={user} onLogout={handleLogout} /> : 
            <Navigate to="/login" replace />
          }
        />
        <Route
          path="/grain"
          element={
            isAuthenticated ? 
            <GrainModule user={user} onLogout={handleLogout} /> : 
            <Navigate to="/login" replace />
          }
        />
        <Route
          path="/inventory"
          element={
            isAuthenticated ? 
            <InventoryModule user={user} onLogout={handleLogout} /> : 
            <Navigate to="/login" replace />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
