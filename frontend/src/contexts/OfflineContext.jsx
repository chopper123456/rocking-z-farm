import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getCachedFields,
  setCachedFields,
  getPendingSyncQueue,
  addToSyncQueue,
  removeSyncQueueItem,
  markSyncQueueItemFailed
} from '../utils/offlineDB';
import { fieldsAPI } from '../utils/api';

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    navigator.addEventListener('online', handleOnline);
    navigator.addEventListener('offline', handleOffline);
    return () => {
      navigator.removeEventListener('online', handleOnline);
      navigator.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingSyncQueue();
    setPendingCount(pending.length);
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [isOnline, refreshPendingCount]);

  const cacheFields = useCallback(async () => {
    try {
      const res = await fieldsAPI.getAll({ onMapOnly: false });
      await setCachedFields(res.data || []);
    } catch (e) {
      console.warn('Cache fields failed', e);
    }
  }, []);

  const queueScoutingReport = useCallback(async (payload) => {
    await addToSyncQueue({ type: 'scouting-report', payload });
    await refreshPendingCount();
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.sync.register('sync-pending-reports');
      } catch (_) {}
    }
  }, [refreshPendingCount]);

  const processSyncQueue = useCallback(async () => {
    const pending = await getPendingSyncQueue();
    const { default: api, API_URL } = await import('../utils/api');
    for (const item of pending) {
      try {
        if (item.action === 'scouting-report') {
          const formData = new FormData();
          const p = item.payload;
          if (p.photoBlob) {
            formData.append('photo', p.photoBlob, p.photoName || 'photo.jpg');
          }
          formData.append('fieldName', p.fieldName);
          formData.append('year', String(p.year));
          formData.append('reportDate', p.reportDate);
          formData.append('growthStage', p.growthStage || '');
          formData.append('pestPressure', p.pestPressure || 'Low');
          formData.append('weedPressure', p.weedPressure || 'Low');
          formData.append('diseaseNotes', p.diseaseNotes || '');
          formData.append('generalNotes', p.generalNotes || '');
          formData.append('weatherConditions', p.weatherConditions || '');
          await api.post('/scouting-reports', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
        await removeSyncQueueItem(item.id);
      } catch (err) {
        console.warn('Sync item failed', item.id, err);
        await markSyncQueueItemFailed(item.id);
      }
    }
    await refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (!isOnline) return;
    processSyncQueue();
  }, [isOnline, processSyncQueue]);

  const value = {
    isOnline,
    pendingCount,
    refreshPendingCount,
    getCachedFields,
    cacheFields,
    queueScoutingReport
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
}
