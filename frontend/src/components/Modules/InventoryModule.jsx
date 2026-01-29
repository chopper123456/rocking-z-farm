import Header from '../Layout/Header';

function InventoryModule({ user, onLogout }) {
  return (
    <div className="app-container">
      <Header user={user} onLogout={onLogout} title="Inventory Management" />
      <div className="module-content">
        <h2>🧪 Inventory Module</h2>
        <p>This module is under development. It will track farm supplies and inventory.</p>
      </div>
    </div>
  );
}

export default InventoryModule;
