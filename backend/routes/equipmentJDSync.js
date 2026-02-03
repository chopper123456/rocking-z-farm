const express = require('express');
const router = express.Router();
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { ORG_USER_ID } = require('../config/org');

router.use(authMiddleware);
const JD_API_URL = 'https://sandboxapi.deere.com/platform';
// ISO 15143-3 (AEMP 2.0) Fleet API - returns only machines with telematic state "active" (on the map)
const AEMP_BASE_URL = process.env.JD_AEMP_URL || 'https://sandboxaemp.deere.com';

const xmlParser = new XMLParser({ ignoreAttributes: false });

// Recursively collect SerialNumber, EquipmentId, Id from parsed AEMP XML
function collectEquipmentIdsFromParsed(obj, ids, serials) {
  if (!obj || typeof obj !== 'object') return;
  if (obj.SerialNumber != null && String(obj.SerialNumber).trim()) serials.add(String(obj.SerialNumber).trim());
  if (obj.EquipmentId != null && String(obj.EquipmentId).trim()) ids.add(String(obj.EquipmentId).trim());
  if (obj.Id != null && String(obj.Id).trim()) ids.add(String(obj.Id).trim());
  if (obj.PIN != null && String(obj.PIN).trim()) ids.add(String(obj.PIN).trim());
  if (obj['@_id'] != null) ids.add(String(obj['@_id']));
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (Array.isArray(v)) v.forEach((item) => collectEquipmentIdsFromParsed(item, ids, serials));
    else if (v && typeof v === 'object') collectEquipmentIdsFromParsed(v, ids, serials);
  }
}

// Extract Links (next, connections) from parsed Fleet XML (ISO 15143-3)
function getLinksFromParsed(obj) {
  const links = { next: null, connections: null };
  function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (o.Links) {
      const arr = Array.isArray(o.Links) ? o.Links : [o.Links];
      for (const link of arr) {
        let rel = link.rel ?? link.Rel;
        if (Array.isArray(rel)) rel = rel[0];
        if (typeof rel === 'object' && rel != null) rel = rel['#text'] ?? rel[0];
        let href = link.href ?? link.Href ?? link['@_href'];
        if (Array.isArray(href)) href = href[0];
        if (typeof href === 'object' && href != null) href = href['#text'] ?? href[0];
        if (rel === 'next' && href) links.next = String(href).trim();
        if (rel === 'connections' && href) links.connections = String(href).trim();
      }
    }
    for (const k of Object.keys(o)) {
      if (o[k] && typeof o[k] === 'object') walk(o[k]);
    }
  }
  walk(obj);
  return links;
}

// Fetch active (on-map) machine IDs from AEMP Fleet API (ISO 15143-3)
async function getActiveMachineIdsFromAEMP(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/xml',
    'Accept-Encoding': 'gzip',
  };
  const ids = new Set();
  const serials = new Set();
  let nextUrl = `${AEMP_BASE_URL}/Fleet/1`;
  let connectionsUrl = null;

  while (nextUrl) {
    try {
      const res = await axios.get(nextUrl, { headers, responseType: 'text', maxRedirects: 5 });
      const xml = typeof res.data === 'string' ? res.data : '';
      const parsed = xmlParser.parse(xml);
      const links = getLinksFromParsed(parsed);
      if (links.connections) connectionsUrl = links.connections;
      collectEquipmentIdsFromParsed(parsed, ids, serials);
      nextUrl = links.next || null;
    } catch (err) {
      if (err.response?.status === 403) {
        return { error: 'AEMP access forbidden. Enable organization access in Operations Center.', connectionsUrl: connectionsUrl || null };
      }
      if (err.response?.status === 401) {
        return { error: 'AEMP token invalid or expired.', connectionsUrl: null };
      }
      console.error('AEMP Fleet request error:', nextUrl, err.response?.status, err.message);
      nextUrl = null;
    }
  }

  return {
    activeIds: [...ids],
    activeSerials: [...serials],
    connectionsUrl: connectionsUrl || null,
  };
}

// Update equipment_assets.is_active from AEMP Fleet (machines "on the map")
async function updateActiveFromAEMP(accessToken) {
  const aemp = await getActiveMachineIdsFromAEMP(accessToken);
  if (aemp.error) {
    console.warn('AEMP Fleet:', aemp.error);
    return { warning: aemp.error, connectionsUrl: aemp.connectionsUrl };
  }
  const activeIds = aemp.activeIds || [];
  const activeSerials = aemp.activeSerials || [];
  if (activeIds.length === 0 && activeSerials.length === 0) return { updated: 0 };

  // Mark active: jd_asset_id or serial_number matches AEMP list
  await db.query(
    `UPDATE equipment_assets SET is_active = true
     WHERE user_id = $1 AND (jd_asset_id = ANY($2::text[]) OR serial_number = ANY($3::text[]))`,
    [ORG_USER_ID, activeIds.length ? activeIds : [''], activeSerials.length ? activeSerials : ['']]
  );
  // Mark inactive: JD equipment not in AEMP Fleet list
  await db.query(
    `UPDATE equipment_assets SET is_active = false
     WHERE user_id = $1 AND jd_asset_id IS NOT NULL
     AND NOT (jd_asset_id = ANY($2::text[]) OR serial_number = ANY($3::text[]))`,
    [ORG_USER_ID, activeIds.length ? activeIds : [''], activeSerials.length ? activeSerials : ['']]
  );
  // Manual (non-JD) equipment stays active
  await db.query(
    'UPDATE equipment_assets SET is_active = true WHERE user_id = $1 AND jd_asset_id IS NULL',
    [ORG_USER_ID]
  );
  return { updated: activeIds.length + activeSerials.length, connectionsUrl: aemp.connectionsUrl };
}

// Fallback: Fetch connected machine/asset IDs from JD Platform Connections API
async function updateActiveFromConnections(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.deere.axiom.v3+json',
  };
  let connectedIds = [];
  try {
    const res = await axios.get(`${JD_API_URL}/connections`, { headers });
    const list = res.data.values || res.data.members || res.data || [];
    const arr = Array.isArray(list) ? list : [list];
    for (const item of arr) {
      const id = item.id ?? item.assetId ?? item.machineId ?? item.principalId ?? item['@id'];
      if (id) connectedIds.push(String(id));
    }
  } catch (err) {
    if (err.response?.status !== 404 && err.response?.status !== 403) {
      console.error('Connections API error:', err.response?.status, err.response?.data);
    }
    return;
  }
  if (connectedIds.length === 0) return;
  await db.query(
    'UPDATE equipment_assets SET is_active = (jd_asset_id = ANY($1::text[])) WHERE user_id = $2 AND jd_asset_id IS NOT NULL',
    [connectedIds, ORG_USER_ID]
  );
  await db.query(
    'UPDATE equipment_assets SET is_active = true WHERE user_id = $1 AND jd_asset_id IS NULL',
    [ORG_USER_ID]
  );
}

// Get John Deere access token and enabled org (shared org token)
async function getJDAccess() {
  const tokenResult = await db.query(
    'SELECT access_token FROM john_deere_tokens WHERE user_id = $1',
    [ORG_USER_ID]
  );
  if (tokenResult.rows.length === 0) {
    return { error: 'John Deere not connected' };
  }
  const accessToken = tokenResult.rows[0].access_token;

  const orgsResponse = await axios.get(`${JD_API_URL}/organizations`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.deere.axiom.v3+json',
    },
  });

  let enabledOrg = null;
  for (const org of orgsResponse.data.values || []) {
    const connectionsLink = org.links?.find((link) => link.rel === 'connections');
    if (!connectionsLink) {
      enabledOrg = org;
      break;
    }
  }
  if (!enabledOrg) {
    return { error: 'No enabled organization found. Enable John Deere organization access first.' };
  }
  return { accessToken, orgId: enabledOrg.id, org: enabledOrg };
}

// Helper: extract equipment fields from JD Equipment API or platform response (flat or nested).
// Per JD docs: prefer EquipmentType / EquipmentApexType for type; Category is legacy and may be deprecated.
// Implements (planter, disk, corn head, spray boom) are equipment paired with a machine.
function parseJDMachine(item) {
  const name = item.name || item.displayName || item.title || item.description || (item.model && (item.model.displayName || item.model.name)) || (Array.isArray(item.model) ? item.model[0]?.name : null) || item.id || 'Unknown';
  const jdId = item.id || item['@id'] || item.assetId || item.machineId || item.principalId;
  if (jdId == null || jdId === '') return null;

  const makeObj = item.make;
  const make = typeof makeObj === 'string' ? makeObj : (makeObj?.name || (Array.isArray(makeObj) && makeObj[0]?.name) || item.brand || null);
  // EquipmentType (recommended) > EquipmentApexType (ag) > type / isgType > legacy category
  const typeObj = item.equipmentType || item.equipmentApexType || item.type || item.isgType;
  const typeName = typeof typeObj === 'string' ? typeObj : (typeObj?.name || (Array.isArray(typeObj) && typeObj[0]?.name) || item.category || null);
  const modelVal = item.model;
  const model = typeof modelVal === 'string' ? modelVal : (modelVal && (modelVal.name || modelVal.displayName || modelVal.modelName)) || (Array.isArray(modelVal) && modelVal[0]?.name) || item.modelName || null;
  const year = item.modelYear != null ? parseInt(item.modelYear) : (item.year != null ? parseInt(item.year) : (item.model && item.model.year != null ? parseInt(item.model.year) : null));
  const serialNumber = item.serialNumber || item.serial || item.serialNo || null;
  const hours = item.hours != null ? parseFloat(item.hours) : item.totalEngineHours != null ? parseFloat(item.totalEngineHours) : item.engineHours != null ? parseFloat(item.engineHours) : (item.meters && item.meters.engineHours != null) ? parseFloat(item.meters.engineHours) : null;
  const typeRaw = (typeName || item.category || item.kind || 'machine').toLowerCase();
  const catMap = {
    tractor: 'tractor', combine: 'combine', sprayer: 'sprayer', implement: 'implement',
    machine: 'tractor', harvester: 'combine', applicator: 'sprayer',
    'four-wheel drive tractor': 'tractor', 'two-wheel drive': 'tractor',
    planter: 'implement', disk: 'implement', 'corn head': 'implement', 'spray boom': 'implement',
    planter: 'implement', disk: 'implement', cultivator: 'implement', seeder: 'implement',
  };
  const category = catMap[typeRaw] || (item['@type'] === 'Implement' ? 'implement' : 'tractor');

  return { name, jdId: String(jdId), make, model, year, serialNumber, hours, category, raw: item };
}

// Sync equipment list from John Deere Operations Center (admin only)
router.post('/sync', requireAdmin, async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) {
      return res.status(400).json({ error: jd.error });
    }

    const { accessToken, orgId, org } = jd;
    let assetsAdded = 0;
    let totalFetched = 0;
    const triedEndpoints = [];
    let got403 = false;

    // Refresh "on map" status from AEMP Fleet (ISO 15143-3) so Equipment tab shows only active machines
    const aempRefresh = await updateActiveFromAEMP(accessToken);
    if (aempRefresh.warning) await updateActiveFromConnections(accessToken);

    // Equipment API (official): GET /equipment?organizationIds=xxx — OAuth scope eq1, Accept: application/json
    const JD_EQUIPMENT_API = 'https://equipmentapi.deere.com/isg';
    const equipmentApiUrl = `${JD_EQUIPMENT_API}/equipment?organizationIds=${orgId}&itemLimit=100`;
    const equipmentHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    // Try Equipment API first (correct endpoint per John Deere docs)
    let nextPageUrl = equipmentApiUrl;
    const seenIds = new Set();

    while (nextPageUrl) {
      try {
        const response = await axios.get(nextPageUrl, { headers: equipmentHeaders });
        triedEndpoints.push(nextPageUrl);
        const data = response.data;
        const list = data.values || (Array.isArray(data) ? data : []);
        const items = Array.isArray(list) ? list : (list && typeof list === 'object' && !Array.isArray(list) ? [list] : []);

        for (const item of items) {
          const parsed = parseJDMachine(item);
          if (!parsed || seenIds.has(parsed.jdId)) continue;
          seenIds.add(parsed.jdId);
          totalFetched++;

          const existing = await db.query(
            'SELECT id FROM equipment_assets WHERE jd_asset_id = $1 AND user_id = $2',
            [parsed.jdId, ORG_USER_ID]
          );
          if (existing.rows.length > 0) {
            await db.query(
              'UPDATE equipment_assets SET name = $1, make = $2, model = $3, year = $4, serial_number = $5, current_hours = COALESCE($6, current_hours), jd_raw_data = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8',
              [parsed.name, parsed.make, parsed.model, parsed.year, parsed.serialNumber, parsed.hours, JSON.stringify(parsed.raw), existing.rows[0].id]
            );
            continue;
          }
          await db.query(
            `INSERT INTO equipment_assets (user_id, name, category, make, model, year, serial_number, current_hours, jd_asset_id, jd_raw_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [ORG_USER_ID, parsed.name, parsed.category, parsed.make, parsed.model, parsed.year, parsed.serialNumber, parsed.hours, parsed.jdId, JSON.stringify(parsed.raw)]
          );
          assetsAdded++;
        }

        const nextLink = data.links && (Array.isArray(data.links) ? data.links.find((l) => l.rel === 'nextPage') : null);
        nextPageUrl = nextLink && nextLink.uri ? nextLink.uri : null;
        if (items.length === 0 && !nextPageUrl) break;
      } catch (err) {
        if (err.response && err.response.status === 403) got403 = true;
        if (err.response) {
          console.error('Equipment API error:', nextPageUrl, err.response.status, err.response.data && JSON.stringify(err.response.data).slice(0, 300));
        }
        nextPageUrl = null;
      }
    }

    if (totalFetched > 0) {
      const aempResult = await updateActiveFromAEMP(accessToken);
      if (aempResult.warning) {
        await updateActiveFromConnections(accessToken);
        return res.json({
          message: `Synced equipment from John Deere. ${assetsAdded} new asset(s) added, ${totalFetched} total. (AEMP map filter: ${aempResult.warning})`,
          assetsAdded,
          totalFetched,
          aempWarning: aempResult.warning,
          connectionsUrl: aempResult.connectionsUrl || null,
        });
      }
      return res.json({
        message: `Synced equipment from John Deere. ${assetsAdded} new asset(s) added, ${totalFetched} total. "On map only" uses AEMP Fleet (active machines).`,
        assetsAdded,
        totalFetched,
      });
    }

    // Fallback: try platform paths (in case sandbox uses different base)
    const platformHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.deere.axiom.v3+json',
    };
    const urlsToTry = [
      `${JD_API_URL}/organizations/${orgId}/machines`,
      `${JD_API_URL}/organizations/${orgId}/assets`,
      `${JD_API_URL}/organizations/${orgId}/equipment`,
    ];

    for (const startUrl of urlsToTry) {
      let nextPageUrl = startUrl;
      const seenIds = new Set();

      while (nextPageUrl) {
        try {
          const response = await axios.get(nextPageUrl, { headers: platformHeaders });
          triedEndpoints.push(nextPageUrl);

          const data = response.data;
          const list = Array.isArray(data) ? data : (data.values || data.members || data.equipment || data.machines || (data._embedded && (data._embedded.machines || data._embedded.equipment)) || []);
          const items = Array.isArray(list) ? list : [];

          for (const item of items) {
            const parsed = parseJDMachine(item);
            if (!parsed || seenIds.has(parsed.jdId)) continue;
            seenIds.add(parsed.jdId);
            totalFetched++;

            const existing = await db.query(
              'SELECT id FROM equipment_assets WHERE jd_asset_id = $1 AND user_id = $2',
              [parsed.jdId, ORG_USER_ID]
            );
            if (existing.rows.length > 0) {
              await db.query(
                'UPDATE equipment_assets SET name = $1, make = $2, model = $3, year = $4, serial_number = $5, current_hours = COALESCE($6, current_hours), jd_raw_data = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8',
                [parsed.name, parsed.make, parsed.model, parsed.year, parsed.serialNumber, parsed.hours, JSON.stringify(parsed.raw), existing.rows[0].id]
              );
              continue;
            }

            await db.query(
              `INSERT INTO equipment_assets (
                user_id, name, category, make, model, year, serial_number, current_hours, jd_asset_id, jd_raw_data
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                ORG_USER_ID,
                parsed.name,
                parsed.category,
                parsed.make,
                parsed.model,
                parsed.year,
                parsed.serialNumber,
                parsed.hours,
                parsed.jdId,
                JSON.stringify(parsed.raw),
              ]
            );
            assetsAdded++;
          }

          const nextLink = data.links && data.links.find((l) => l.rel === 'nextPage' || l.rel === 'next');
          nextPageUrl = nextLink && nextLink.uri ? nextLink.uri : null;
          if (items.length === 0 && !nextPageUrl) break;
        } catch (err) {
          if (err.response && err.response.status === 403) got403 = true;
          if (err.response && err.response.status !== 404) {
            console.error('JD equipment endpoint error:', nextPageUrl, err.response.status, err.response.data && JSON.stringify(err.response.data).slice(0, 200));
          }
          nextPageUrl = null;
        }
      }

      if (totalFetched > 0) {
        const aempResult = await updateActiveFromAEMP(accessToken);
        if (aempResult.warning) {
          await updateActiveFromConnections(accessToken);
          return res.json({
            message: `Synced equipment from John Deere. ${assetsAdded} new asset(s) added, ${totalFetched} total. (AEMP: ${aempResult.warning})`,
            assetsAdded,
            totalFetched,
            aempWarning: aempResult.warning,
            connectionsUrl: aempResult.connectionsUrl || null,
          });
        }
        return res.json({
          message: `Synced equipment from John Deere. ${assetsAdded} new asset(s) added, ${totalFetched} total. "On map only" uses AEMP Fleet.`,
          assetsAdded,
          totalFetched,
        });
      }
    }

    // Fallback: add equipment from field operations (equipment_used from JD operations)
    let fromOps = 0;
    try {
      fromOps = await syncEquipmentFromFieldOperations();
    } catch (fallbackErr) {
      console.error('Equipment fallback from field operations failed:', fallbackErr);
    }
    if (fromOps > 0) {
      const msg = got403
        ? `John Deere returned Forbidden (403) for the equipment list—your org may need equipment access in Operations Center. We added ${fromOps} equipment from your field operations.`
        : `No equipment list from John Deere. Added ${fromOps} equipment from your field operations.`;
      return res.json({
        message: msg,
        assetsAdded: fromOps,
        totalFetched: 0,
        fromFieldOperations: true,
      });
    }

    const noDataMsg = got403
      ? 'John Deere returned Forbidden (403) for the equipment list—your app may not have equipment access. Use "Add from field operations" after syncing field operations in the Fields module to add equipment names from JD operations.'
      : 'John Deere sync completed. No equipment found. Sync field operations first (Fields module), then click "Add from field operations" to add equipment names from JD.';
    return res.json({
      message: noDataMsg,
      assetsAdded: 0,
      totalFetched: 0,
      triedEndpoints: [...new Set(triedEndpoints)],
    });
  } catch (error) {
    console.error('Equipment JD sync error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to sync equipment from John Deere',
      details: error.response?.data?.message || error.message,
    });
  }
});

// Refresh "on map" status from AEMP Fleet API (ISO 15143-3) - no full equipment sync
router.post('/refresh-on-map', requireAdmin, async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) {
      return res.status(400).json({ error: jd.error });
    }
    const result = await updateActiveFromAEMP(jd.accessToken);
    if (result.warning) {
      await updateActiveFromConnections(jd.accessToken);
      return res.json({
        message: `On-map status refreshed using Connections (AEMP: ${result.warning}). Enable organization access in Operations Center for AEMP map filter.`,
        aempWarning: result.warning,
        connectionsUrl: result.connectionsUrl || null,
      });
    }
    res.json({
      message: 'On-map status refreshed from AEMP Fleet (machines with active telematic state).',
      updated: result.updated,
    });
  } catch (error) {
    console.error('Refresh on-map error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to refresh on-map status',
      details: error.response?.data?.message || error.message,
    });
  }
});

// Get usage hours from JD (if telemetry available) and update local asset
router.post('/sync-hours/:assetId', requireAdmin, async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) {
      return res.status(400).json({ error: jd.error });
    }

    const asset = await db.query(
      'SELECT id, jd_asset_id, name FROM equipment_assets WHERE id = $1 AND user_id = $2',
      [req.params.assetId, ORG_USER_ID]
    );
    if (asset.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    const jdAssetId = asset.rows[0].jd_asset_id;
    if (!jdAssetId) {
      return res.status(400).json({ error: 'This equipment is not linked to John Deere' });
    }

    const { accessToken } = jd;
    let hours = null;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.deere.axiom.v3+json',
    };

    // Try platform engine hours endpoint first: GET /machines/{id}/engineHours
    try {
      const url = `${JD_API_URL}/machines/${jdAssetId}/engineHours`;
      const response = await axios.get(url, { headers });
      const data = response.data;
      hours = data.totalEngineHours ?? data.engineHours ?? data.hours ?? data.value ?? (data.values && data.values[0] && (data.values[0].hours ?? data.values[0].value)) ?? null;
    } catch (err) {
      // continue to fallback
    }

    // Fallback: organizations/assets endpoint
    if (hours == null) {
      try {
        const url = `${JD_API_URL}/organizations/${jd.orgId}/assets/${jdAssetId}`;
        const response = await axios.get(url, { headers });
        const data = response.data;
        hours = data.totalEngineHours ?? data.engineHours ?? data.hours ?? data.meter ?? null;
      } catch (err) {
        // Telemetry endpoint might not exist in sandbox
      }
    }

    if (hours != null) {
      await db.query(
        'UPDATE equipment_assets SET current_hours = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [parseFloat(hours), req.params.assetId]
      );
    }

    // Update john_deere_equipment cache
    await db.query(
      `INSERT INTO john_deere_equipment (user_id, jd_asset_id, equipment_asset_id, name, last_hours, last_sync_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, jd_asset_id) DO UPDATE SET
         equipment_asset_id = $3, name = $4, last_hours = $5, last_sync_at = CURRENT_TIMESTAMP`,
      [ORG_USER_ID, jdAssetId, req.params.assetId, asset.rows[0].name, hours]
    );

    res.json({
      message: hours != null ? `Updated hours to ${hours}` : 'No telemetry hours available from John Deere',
      currentHours: hours,
    });
  } catch (error) {
    console.error('Sync hours error:', error);
    res.status(500).json({ error: 'Failed to sync hours' });
  }
});

// Create equipment from field operations (equipment_used from JD operations) so list is populated even if machines API returns nothing
async function syncEquipmentFromFieldOperations() {
  const result = await db.query(
    `SELECT DISTINCT equipment_used AS name FROM field_operations
     WHERE user_id = $1 AND equipment_used IS NOT NULL AND TRIM(equipment_used) != ''`,
    [ORG_USER_ID]
  );
  let added = 0;
  for (const row of result.rows || []) {
    const name = (row.name || '').trim();
    if (!name) continue;
    const existing = await db.query(
      'SELECT id FROM equipment_assets WHERE user_id = $1 AND (name = $2 OR name ILIKE $2)',
      [ORG_USER_ID, name]
    );
    if (existing.rows.length > 0) continue;
    await db.query(
      `INSERT INTO equipment_assets (user_id, name, category, notes) VALUES ($1, $2, 'tractor', $3)`,
      [ORG_USER_ID, name, 'Added from John Deere field operations']
    );
    added++;
  }
  return added;
}

// Sync equipment from John Deere: first try machines API, then add any equipment names from field operations
router.post('/sync-from-operations', requireAdmin, async (req, res) => {
  try {
    const added = await syncEquipmentFromFieldOperations();
    res.json({
      message: added > 0 ? `Added ${added} equipment from field operations.` : 'No new equipment names found in field operations.',
      assetsAdded: added,
    });
  } catch (error) {
    console.error('Sync from operations error:', error);
    res.status(500).json({ error: 'Failed to sync equipment from operations' });
  }
});

// Which equipment was used on which fields (from field_operations)
router.get('/field-usage', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT equipment_used AS equipment_name, field_name, year, operation_type, operation_date, id
       FROM field_operations
       WHERE user_id = $1 AND equipment_used IS NOT NULL AND equipment_used != ''
       ORDER BY operation_date DESC`,
      [ORG_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching field usage:', error);
    res.status(500).json({ error: 'Error fetching field usage' });
  }
});

// John Deere Connections: list of connected (active) machine/asset IDs
router.get('/connections', async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) {
      return res.status(400).json({ error: jd.error, connectedAssetIds: [] });
    }
    const headers = {
      Authorization: `Bearer ${jd.accessToken}`,
      Accept: 'application/vnd.deere.axiom.v3+json',
    };
    const resJd = await axios.get(`${JD_API_URL}/connections`, { headers });
    const list = resJd.data.values || resJd.data.members || resJd.data || [];
    const arr = Array.isArray(list) ? list : [list];
    const connectedAssetIds = [];
    for (const item of arr) {
      const id = item.id ?? item.assetId ?? item.machineId ?? item.principalId ?? item['@id'];
      if (id) connectedAssetIds.push(String(id));
    }
    res.json({ connectedAssetIds });
  } catch (error) {
    if (error.response?.status === 404 || error.response?.status === 403) {
      return res.json({ connectedAssetIds: [] });
    }
    console.error('Connections error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch connections', connectedAssetIds: [] });
  }
});

// JD machine data: hours of operation (view hours of operation for machines)
router.get('/machines/:jdAssetId/hours-of-operation', async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) return res.status(400).json({ error: jd.error });
    const url = `${JD_API_URL}/machines/${req.params.jdAssetId}/hoursOfOperation`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${jd.accessToken}`,
        Accept: 'application/vnd.deere.axiom.v3+json',
      },
    });
    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 404) return res.json({ values: [] });
    console.error('Hours of operation error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.response?.data?.message || 'Failed to fetch hours of operation' });
  }
});

// JD machine data: engine hours (GET /machines/{principalId}/engineHours; OAuth scope: eq1; no eTag)
router.get('/machines/:jdAssetId/engine-hours', async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) return res.status(400).json({ error: jd.error });
    const url = `${JD_API_URL}/machines/${req.params.jdAssetId}/engineHours`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${jd.accessToken}`,
        Accept: 'application/vnd.deere.axiom.v3+json',
        'Accept-Encoding': 'gzip',
      },
    });
    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 404) return res.json({ engineHours: null });
    console.error('Engine hours error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.response?.data?.message || 'Failed to fetch engine hours' });
  }
});

// JD machine data: DTC alerts
router.get('/machines/:jdAssetId/alerts', async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) return res.status(400).json({ error: jd.error });
    const url = `${JD_API_URL}/machines/${req.params.jdAssetId}/alerts`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${jd.accessToken}`,
        Accept: 'application/vnd.deere.axiom.v3+json',
      },
    });
    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 404) return res.json({ values: [], alerts: [] });
    console.error('Alerts error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.response?.data?.message || 'Failed to fetch alerts' });
  }
});

// JD operators in organization
router.get('/operators', async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) return res.status(400).json({ error: jd.error });
    let nextUrl = `${JD_API_URL}/organizations/${jd.orgId}/operators`;
    const operators = [];
    const headers = {
      Authorization: `Bearer ${jd.accessToken}`,
      Accept: 'application/vnd.deere.axiom.v3+json',
    };
    while (nextUrl) {
      const response = await axios.get(nextUrl, { headers });
      const list = response.data.values || response.data.members || response.data || [];
      const arr = Array.isArray(list) ? list : [list];
      operators.push(...arr);
      const nextLink = response.data.links?.find((l) => l.rel === 'nextPage' || l.rel === 'next');
      nextUrl = nextLink?.uri || null;
    }
    res.json(operators);
  } catch (error) {
    if (error.response?.status === 404) return res.json([]);
    console.error('Operators error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.response?.data?.message || 'Failed to fetch operators' });
  }
});

// Equipment utilization report: hours used per month (from maintenance + fuel logs as proxy if no JD hours)
router.get('/reports/utilization', async (req, res) => {
  try {
    const { assetId, year } = req.query;
    let query = `
      SELECT e.id, e.name, e.category,
        DATE_TRUNC('month', m.service_date) AS month,
        COUNT(m.id) AS service_count,
        MAX(m.hours_at_service) AS hours_recorded
      FROM equipment_assets e
      LEFT JOIN equipment_maintenance m ON m.equipment_asset_id = e.id AND m.user_id = e.user_id
      WHERE e.user_id = $1
    `;
    const params = [ORG_USER_ID];
    if (assetId) {
      params.push(assetId);
      query += ` AND e.id = $${params.length}`;
    }
    if (year) {
      params.push(year);
      query += ` AND EXTRACT(YEAR FROM m.service_date) = $${params.length}`;
    }
    query += ` GROUP BY e.id, e.name, e.category, DATE_TRUNC('month', m.service_date) ORDER BY e.name, month DESC`;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error utilization report:', error);
    res.status(500).json({ error: 'Error generating report' });
  }
});

// Maintenance cost summary (admin only - financial)
router.get('/reports/maintenance-costs', requireAdmin, async (req, res) => {
  try {
    const { assetId, year } = req.query;
    let query = `
      SELECT e.id, e.name, e.category,
        SUM(m.cost) AS total_cost,
        COUNT(m.id) AS service_count
      FROM equipment_assets e
      LEFT JOIN equipment_maintenance m ON m.equipment_asset_id = e.id AND m.user_id = e.user_id
      WHERE e.user_id = $1 AND m.cost IS NOT NULL
    `;
    const params = [ORG_USER_ID];
    if (assetId) {
      params.push(assetId);
      query += ` AND e.id = $${params.length}`;
    }
    if (year) {
      params.push(year);
      query += ` AND EXTRACT(YEAR FROM m.service_date) = $${params.length}`;
    }
    query += ` GROUP BY e.id, e.name, e.category ORDER BY total_cost DESC`;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error maintenance cost report:', error);
    res.status(500).json({ error: 'Error generating report' });
  }
});

// Fuel cost analysis
router.get('/reports/fuel', async (req, res) => {
  try {
    const { assetId, year } = req.query;
    let query = `
      SELECT e.id, e.name,
        SUM(f.gallons) AS total_gallons,
        SUM(f.cost) AS total_cost,
        COUNT(f.id) AS fill_count
      FROM equipment_assets e
      LEFT JOIN equipment_fuel_logs f ON f.equipment_asset_id = e.id AND f.user_id = e.user_id
      WHERE e.user_id = $1
    `;
    const params = [ORG_USER_ID];
    if (assetId) {
      params.push(assetId);
      query += ` AND e.id = $${params.length}`;
    }
    if (year) {
      params.push(year);
      query += ` AND EXTRACT(YEAR FROM f.fuel_date) = $${params.length}`;
    }
    query += ` GROUP BY e.id, e.name ORDER BY total_cost DESC NULLS LAST`;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fuel report:', error);
    res.status(500).json({ error: 'Error generating report' });
  }
});

// Depreciation tracking (admin only - financial)
router.get('/reports/depreciation', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, category, purchase_date, purchase_cost, current_hours, year
       FROM equipment_assets WHERE user_id = $1 AND (purchase_cost IS NOT NULL OR current_hours IS NOT NULL)
       ORDER BY name`,
      [ORG_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error depreciation report:', error);
    res.status(500).json({ error: 'Error generating report' });
  }
});

// Upcoming maintenance alerts (all equipment)
router.get('/alerts', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, e.name AS equipment_name, e.current_hours
       FROM equipment_maintenance_schedule s
       JOIN equipment_assets e ON e.id = s.equipment_asset_id AND e.user_id = s.user_id
       WHERE s.user_id = $1
         AND (s.next_due_date <= CURRENT_DATE + INTERVAL '30 days' OR s.next_due_hours <= e.current_hours + 50)
       ORDER BY s.next_due_date ASC NULLS LAST, s.next_due_hours ASC NULLS LAST`,
      [ORG_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Error fetching alerts' });
  }
});

module.exports = router;
