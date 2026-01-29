import Header from '../Layout/Header';

function FieldsModule({ user, onLogout }) {
  return (
    <div className="app-container">
      <Header user={user} onLogout={onLogout} title="Fields Management" />
      <div className="module-content">
        <h2>🌾 Fields Module</h2>
        <p>This module is under development. It will include field management and reports.</p>
      </div>
    </div>
  );
}

export default FieldsModule;
