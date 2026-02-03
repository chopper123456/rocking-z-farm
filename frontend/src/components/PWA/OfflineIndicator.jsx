import { useEffect } from 'react';
import { useOffline } from '../../contexts/OfflineContext';

export default function OfflineIndicator() {
  const { isOnline, pendingCount } = useOffline();
  const visible = !isOnline || pendingCount > 0;

  useEffect(() => {
    if (visible) document.body.classList.add('has-offline-bar');
    else document.body.classList.remove('has-offline-bar');
    return () => document.body.classList.remove('has-offline-bar');
  }, [visible]);

  if (!visible) return null;

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`offline-indicator ${isOnline ? 'syncing' : ''}`}
      role="status"
      aria-live="polite"
    >
      {!isOnline && (
        <span className="offline-indicator-text">
          You're offline. Changes will sync when you're back online.
        </span>
      )}
      {isOnline && pendingCount > 0 && (
        <span className="offline-indicator-text">
          Syncing {pendingCount} item{pendingCount !== 1 ? 's' : ''}...
        </span>
      )}
    </div>
  );
}
