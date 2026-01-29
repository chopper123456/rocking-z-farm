import Header from '../Layout/Header';

function LivestockModule({ user, onLogout }) {
  return (
    <div className="app-container">
      <Header user={user} onLogout={onLogout} title="Livestock Management" />
      <div className="module-content">
        <h2>🐄 Livestock Module</h2>
        <p>This module is under development. It will include full livestock tracking functionality.</p>
      </div>
    </div>
  );
}

export default LivestockModule;
