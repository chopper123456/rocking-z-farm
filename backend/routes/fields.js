const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { ORG_USER_ID } = require('../config/org');

router.use(authMiddleware);

// Get all fields (shared org data; optional: ?onMapOnly=true)
router.get('/', async (req, res) => {
  try {
    const onMapOnly = req.query.onMapOnly === 'true' || req.query.onMapOnly === '1';
    const result = onMapOnly
      ? await db.query(
          'SELECT * FROM fields WHERE user_id = $1 AND jd_field_id IS NOT NULL ORDER BY field_name',
          [ORG_USER_ID]
        )
      : await db.query(
          'SELECT * FROM fields WHERE user_id = $1 ORDER BY field_name',
          [ORG_USER_ID]
        );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching fields:', error);
    res.status(500).json({ error: 'Error fetching fields' });
  }
});

// Add new field (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { fieldName, acreage, soilType, irrigationType, notes } = req.body;
    const result = await db.query(
      `INSERT INTO fields (user_id, field_name, acreage, soil_type, irrigation_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [ORG_USER_ID, fieldName, acreage, soilType, irrigationType, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding field:', error);
    res.status(500).json({ error: 'Error adding field' });
  }
});

// Update field (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { fieldName, acreage, soilType, irrigationType, notes } = req.body;
    const result = await db.query(
      `UPDATE fields SET field_name = $1, acreage = $2, soil_type = $3, 
       irrigation_type = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [fieldName, acreage, soilType, irrigationType, notes, req.params.id, ORG_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating field:', error);
    res.status(500).json({ error: 'Error updating field' });
  }
});

// Delete field (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM fields WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, ORG_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }
    res.json({ message: 'Field deleted successfully' });
  } catch (error) {
    console.error('Error deleting field:', error);
    res.status(500).json({ error: 'Error deleting field' });
  }
});

module.exports = router;
