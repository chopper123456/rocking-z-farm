/**
 * IndexedDB for offline storage and sync queue.
 * Schema: fields cache, current year data, pending scouting/field reports, sync queue.
 */
import { openDB } from 'idb';

const DB_NAME = 'rocking-z-offline';
const DB_VERSION = 1;

export const STORES = {
  FIELDS: 'fields',
  FIELD_YEARS: 'fieldYears',
  FIELD_REPORTS: 'fieldReports',
  SCOUTING_REPORTS: 'scoutingReports',
  SYNC_QUEUE: 'syncQueue',
  CACHE_META: 'cacheMeta'
};

export async function openOfflineDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.FIELDS)) {
        db.createObjectStore(STORES.FIELDS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.FIELD_YEARS)) {
        db.createObjectStore(STORES.FIELD_YEARS, { keyPath: ['fieldName', 'year'] });
      }
      if (!db.objectStoreNames.contains(STORES.FIELD_REPORTS)) {
        db.createObjectStore(STORES.FIELD_REPORTS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.SCOUTING_REPORTS)) {
        db.createObjectStore(STORES.SCOUTING_REPORTS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const queue = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        queue.createIndex('byStatus', 'status');
        queue.createIndex('byCreated', 'createdAt');
      }
      if (!db.objectStoreNames.contains(STORES.CACHE_META)) {
        db.createObjectStore(STORES.CACHE_META, { keyPath: 'key' });
      }
    }
  });
}

// --- Cache meta (last sync time) ---
export async function getCacheMeta(key) {
  const db = await openOfflineDB();
  return db.get(STORES.CACHE_META, key);
}

export async function setCacheMeta(key, value) {
  const db = await openOfflineDB();
  await db.put(STORES.CACHE_META, { key, ...value });
}

// --- Fields cache ---
export async function getCachedFields() {
  const db = await openOfflineDB();
  return db.getAll(STORES.FIELDS);
}

export async function setCachedFields(fields) {
  const db = await openOfflineDB();
  const tx = db.transaction(STORES.FIELDS, 'readwrite');
  await tx.store.clear();
  for (const f of fields) {
    await tx.store.put(f);
  }
  await tx.done;
  await setCacheMeta('fields', { updatedAt: Date.now() });
}

// --- Field years cache (per field) ---
export async function getCachedFieldYears(fieldName) {
  const db = await openOfflineDB();
  const all = await db.getAll(STORES.FIELD_YEARS);
  return all.filter(r => r.fieldName === fieldName);
}

export async function setCachedFieldYear(fieldName, year, data) {
  const db = await openOfflineDB();
  await db.put(STORES.FIELD_YEARS, { fieldName, year, ...data });
}

// --- Sync queue: pending actions when offline ---
export async function addToSyncQueue(action) {
  const db = await openOfflineDB();
  return db.add(STORES.SYNC_QUEUE, {
    action: action.type,
    payload: action.payload,
    status: 'pending',
    createdAt: Date.now()
  });
}

export async function getPendingSyncQueue() {
  const db = await openOfflineDB();
  return db.getAllFromIndex(STORES.SYNC_QUEUE, 'byStatus', 'pending');
}

export async function removeSyncQueueItem(id) {
  const db = await openOfflineDB();
  await db.delete(STORES.SYNC_QUEUE, id);
}

export async function markSyncQueueItemFailed(id) {
  const db = await openOfflineDB();
  const item = await db.get(STORES.SYNC_QUEUE, id);
  if (item) {
    item.status = 'failed';
    item.failedAt = Date.now();
    await db.put(STORES.SYNC_QUEUE, item);
  }
}

// --- Local (offline) scouting reports (to show in UI before sync) ---
export async function addLocalScoutingReport(report) {
  const db = await openOfflineDB();
  return db.add(STORES.SCOUTING_REPORTS, {
    ...report,
    _local: true,
    createdAt: Date.now()
  });
}

export async function getLocalScoutingReports(fieldName, year) {
  const db = await openOfflineDB();
  const all = await db.getAll(STORES.SCOUTING_REPORTS);
  return all.filter(r => r._local && r.fieldName === fieldName && r.year === year);
}

export async function removeLocalScoutingReport(id) {
  const db = await openOfflineDB();
  await db.delete(STORES.SCOUTING_REPORTS, id);
}

export async function getAllLocalScoutingReports() {
  const db = await openOfflineDB();
  const all = await db.getAll(STORES.SCOUTING_REPORTS);
  return all.filter(r => r._local);
}
