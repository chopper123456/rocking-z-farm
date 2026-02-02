const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

const userId = 1;
const JD_API_URL = 'https://sandboxapi.deere.com/platform';

// Get John Deere access token and enabled org (shared helper)
async function getJDAccess() {
  const tokenResult = await db.query(
    'SELECT access_token FROM john_deere_tokens WHERE user_id = $1',
    [userId]
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
  return { accessToken, orgId: enabledOrg.id };
}

// Sync equipment list from John Deere Operations Center
// JD Platform may expose assets/machines under organizations or a separate link
router.post('/sync', async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) {
      return res.status(400).json({ error: jd.error });
    }

    const { accessToken, orgId } = jd;
    let assetsAdded = 0;
    const triedEndpoints = [];

    // Try common JD equipment/asset endpoints (sandbox may vary)
    const endpointsToTry = [
      `${JD_API_URL}/organizations/${orgId}/assets`,
      `${JD_API_URL}/organizations/${orgId}/machines`,
      `${JD_API_URL}/organizations/${orgId}/equipment`,
    ];

    for (const url of endpointsToTry) {
      try {
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.deere.axiom.v3+json',
          },
        });
        triedEndpoints.push(url);

        const values = response.data.values || response.data;
        const list = Array.isArray(values) ? values : (values && values.length ? values : []);

        for (const item of list) {
          const name = item.name || item.displayName || item.title || item.id || 'Unknown';
          const jdId = item.id || item['@id'] || item.assetId;
          if (!jdId) continue;

          const existing = await db.query(
            'SELECT id FROM equipment_assets WHERE jd_asset_id = $1 AND user_id = $2',
            [String(jdId), userId]
          );
          if (existing.rows.length > 0) {
            await db.query(
              'UPDATE equipment_assets SET jd_raw_data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [JSON.stringify(item), existing.rows[0].id]
            );
            continue;
          }

          const make = item.make || item.brand || null;
          const model = item.model || null;
          const year = item.year ? parseInt(item.year) : null;
          const serialNumber = item.serialNumber || item.serial || null;
          const hours = item.hours != null ? parseFloat(item.hours) : null;
          const category = (item.type || item.category || 'tractor').toLowerCase();
          const catMap = { tractor: 'tractor', combine: 'combine', sprayer: 'sprayer', implement: 'implement', machine: 'tractor' };
          const categoryFinal = catMap[category] || 'tractor';

          await db.query(
            `INSERT INTO equipment_assets (
              user_id, name, category, make, model, year, serial_number, current_hours, jd_asset_id, jd_raw_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              userId,
              name,
              categoryFinal,
              make,
              model,
              year,
              serialNumber,
              hours,
              String(jdId),
              JSON.stringify(item),
            ]
          );
          assetsAdded++;
        }

        if (list.length > 0) {
          return res.json({
            message: `Synced equipment from John Deere. ${assetsAdded} new asset(s) added.`,
            assetsAdded,
            totalChecked: list.length,
          });
        }
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error('JD equipment endpoint error:', url, err.response?.data || err.message);
        }
      }
    }

    // If no endpoint returned data, still report success with 0 added (user may have no JD equipment)
    return res.json({
      message: 'John Deere sync completed. No equipment found in Operations Center, or API format differs.',
      assetsAdded: 0,
      triedEndpoints,
    });
  } catch (error) {
    console.error('Equipment JD sync error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to sync equipment from John Deere',
      details: error.response?.data?.message || error.message,
    });
  }
});

// Get usage hours from JD (if telemetry available) and update local asset
router.post('/sync-hours/:assetId', async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) {
      return res.status(400).json({ error: jd.error });
    }

    const asset = await db.query(
      'SELECT id, jd_asset_id, name FROM equipment_assets WHERE id = $1 AND user_id = $2',
      [req.params.assetId, userId]
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

    // Try telemetry/usage endpoint (JD API may expose hours per asset)
    try {
      const url = `${JD_API_URL}/organizations/${jd.orgId}/assets/${jdAssetId}`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.deere.axiom.v3+json',
        },
      });
      const data = response.data;
      hours = data.totalEngineHours ?? data.engineHours ?? data.hours ?? data.meter ?? null;
      if (hours != null) {
        await db.query(
          'UPDATE equipment_assets SET current_hours = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [parseFloat(hours), req.params.assetId]
        );
      }
    } catch (err) {
      // Telemetry endpoint might not exist in sandbox
    }

    // Update john_deere_equipment cache
    await db.query(
      `INSERT INTO john_deere_equipment (user_id, jd_asset_id, equipment_asset_id, name, last_hours, last_sync_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, jd_asset_id) DO UPDATE SET
         equipment_asset_id = $3, name = $4, last_hours = $5, last_sync_at = CURRENT_TIMESTAMP`,
      [userId, jdAssetId, req.params.assetId, asset.rows[0].name, hours]
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

// Which equipment was used on which fields (from field_operations)
router.get('/field-usage', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT equipment_used AS equipment_name, field_name, year, operation_type, operation_date, id
       FROM field_operations
       WHERE user_id = $1 AND equipment_used IS NOT NULL AND equipment_used != ''
       ORDER BY operation_date DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching field usage:', error);
    res.status(500).json({ error: 'Error fetching field usage' });
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
    const params = [userId];
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

// Maintenance cost summary
router.get('/reports/maintenance-costs', async (req, res) => {
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
    const params = [userId];
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
    const params = [userId];
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

// Depreciation tracking (simple: purchase cost and current hours for rough value)
router.get('/reports/depreciation', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, category, purchase_date, purchase_cost, current_hours, year
       FROM equipment_assets WHERE user_id = $1 AND (purchase_cost IS NOT NULL OR current_hours IS NOT NULL)
       ORDER BY name`,
      [userId]
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
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Error fetching alerts' });
  }
});

module.exports = router;
