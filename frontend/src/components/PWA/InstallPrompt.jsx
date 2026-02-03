import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('pwa-install-dismissed');
    if (stored) setDismissed(true);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!dismissed) setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed]);

  useEffect(() => {
    const handler = () => setShowPrompt(false);
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="Install app">
      <div className="install-prompt-content">
        <span className="install-prompt-icon">🌾</span>
        <p className="install-prompt-text">
          Add Rocking Z Farm to your home screen for quick access and offline use.
        </p>
        <div className="install-prompt-actions">
          <button type="button" className="install-prompt-btn primary" onClick={handleInstall}>
            Add to Home Screen
          </button>
          <button type="button" className="install-prompt-btn secondary" onClick={handleDismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
