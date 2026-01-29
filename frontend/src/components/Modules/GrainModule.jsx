import Header from '../Layout/Header';

function GrainModule({ user, onLogout }) {
  return (
    <div className="app-container">
      <Header user={user} onLogout={onLogout} title="Grain Inventory" />
      <div className="module-content">
        <h2>🌽 Grain Module</h2>
        <p>This module is under development. It will manage grain storage and tracking.</p>
      </div>
    </div>
  );
}

export default GrainModule;
