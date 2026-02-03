const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { ORG_USER_ID } = require('../config/org');

router.use(authMiddleware);

const JD_API_URL = 'https://sandboxapi.deere.com/platform';

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
    const connectionsLink = org.links?.find((l) => l.rel === 'connections');
    if (!connectionsLink) {
      enabledOrg = org;
      break;
    }
  }
  if (!enabledOrg) {
    return { error: 'No enabled organization found. Connect John Deere first.' };
  }
  return { accessToken, orgId: enabledOrg.id };
}

// Sync fields and farms from John Deere (admin only)
router.post('/sync', requireAdmin, async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) {
      return res.status(400).json({ error: jd.error });
    }

    const { accessToken, orgId } = jd;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.deere.axiom.v3+json',
    };

    // Fetch farms: GET /organizations/{orgId}/farms
    const farmIdToName = {};
    let farmsUrl = `${JD_API_URL}/organizations/${orgId}/farms`;
    while (farmsUrl) {
      try {
        const farmsRes = await axios.get(farmsUrl, { headers });
        const farmList = farmsRes.data.values || farmsRes.data.members || farmsRes.data || [];
        const farms = Array.isArray(farmList) ? farmList : [farmList];
        for (const f of farms) {
          const id = f.id ?? f['@id'];
          const name = f.name ?? f.displayName ?? f.title ?? id;
          if (id) farmIdToName[String(id)] = name;
        }
        const nextLink = farmsRes.data.links?.find((l) => l.rel === 'nextPage' || l.rel === 'next');
        farmsUrl = nextLink?.uri || null;
      } catch (err) {
        if (err.response?.status !== 404 && err.response?.status !== 403) {
          console.error('JD farms error:', err.response?.status, err.response?.data);
        }
        farmsUrl = null;
      }
    }

    // Fetch fields: GET /organizations/{orgId}/fields
    let fieldsAdded = 0;
    let fieldsUpdated = 0;
    let nextFieldsUrl = `${JD_API_URL}/organizations/${orgId}/fields`;

    while (nextFieldsUrl) {
      try {
        const fieldsRes = await axios.get(nextFieldsUrl, { headers });
        const fieldList = fieldsRes.data.values || fieldsRes.data.members || fieldsRes.data || [];
        const jdFields = Array.isArray(fieldList) ? fieldList : [fieldList];

        for (const f of jdFields) {
          const jdFieldId = f.id ?? f['@id'];
          if (!jdFieldId) continue;

          const fieldName = f.name ?? f.displayName ?? f.title ?? f.fieldName ?? String(jdFieldId);
          const acreage = f.area != null ? parseFloat(f.area) : (f.acreage != null ? parseFloat(f.acreage) : null);
          const jdFarmId = f.farmId ?? f.farm?.id ?? (f.links && f.links.find((l) => l.rel === 'farm')?.uri?.split('/').pop()) ?? null;
          const farmName = jdFarmId ? (farmIdToName[String(jdFarmId)] || null) : null;

          const existingByJd = await db.query(
            'SELECT id FROM fields WHERE user_id = $1 AND jd_field_id = $2',
            [ORG_USER_ID, String(jdFieldId)]
          );
          const existing = existingByJd.rows.length > 0
            ? existingByJd
            : await db.query(
                'SELECT id FROM fields WHERE user_id = $1 AND LOWER(TRIM(field_name)) = LOWER(TRIM($2))',
                [ORG_USER_ID, fieldName]
              );

          if (existing.rows.length > 0) {
            await db.query(
              `UPDATE fields SET field_name = $1, acreage = COALESCE($2, acreage), jd_field_id = $3, jd_farm_id = $4, farm_name = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
              [fieldName, acreage, String(jdFieldId), jdFarmId ? String(jdFarmId) : null, farmName, existing.rows[0].id]
            );
            fieldsUpdated++;
          } else {
            await db.query(
              `INSERT INTO fields (user_id, field_name, acreage, jd_field_id, jd_farm_id, farm_name) VALUES ($1, $2, $3, $4, $5, $6)`,
              [ORG_USER_ID, fieldName, acreage, String(jdFieldId), jdFarmId ? String(jdFarmId) : null, farmName]
            );
            fieldsAdded++;
          }
        }

        const nextLink = fieldsRes.data.links?.find((l) => l.rel === 'nextPage' || l.rel === 'next');
        nextFieldsUrl = nextLink?.uri || null;
      } catch (err) {
        if (err.response?.status === 403) {
          return res.status(403).json({ error: 'John Deere returned Forbidden for fields. Your app may need Fields access in Operations Center.' });
        }
        if (err.response?.status !== 404) {
          console.error('JD fields sync error:', err.response?.status, err.response?.data);
        }
        nextFieldsUrl = null;
      }
    }

    res.json({
      message: `Synced fields from John Deere. ${fieldsAdded} new, ${fieldsUpdated} updated.`,
      fieldsAdded,
      fieldsUpdated,
    });
  } catch (error) {
    console.error('Fields JD sync error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to sync fields from John Deere',
      details: error.response?.data?.message || error.message,
    });
  }
});

// List JD farms (for display; optional)
router.get('/farms', async (req, res) => {
  try {
    const jd = await getJDAccess();
    if (jd.error) return res.status(400).json({ error: jd.error });
    const headers = {
      Authorization: `Bearer ${jd.accessToken}`,
      Accept: 'application/vnd.deere.axiom.v3+json',
    };
    const response = await axios.get(`${JD_API_URL}/organizations/${jd.orgId}/farms`, { headers });
    const list = response.data.values || response.data.members || response.data || [];
    res.json(Array.isArray(list) ? list : [list]);
  } catch (error) {
    if (error.response?.status === 404) return res.json([]);
    console.error('JD farms error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to fetch farms' });
  }
});

module.exports = router;
