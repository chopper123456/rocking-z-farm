import Header from '../Layout/Header';

function EquipmentModule({ user, onLogout }) {
  return (
    <div className="app-container">
      <Header user={user} onLogout={onLogout} title="Equipment Logs" />
      <div className="module-content">
        <h2>🚜 Equipment Module</h2>
        <p>This module is under development. It will track equipment maintenance.</p>
      </div>
    </div>
  );
}

export default EquipmentModule;
