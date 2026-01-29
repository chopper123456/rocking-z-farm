const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all grain inventory
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM grain_inventory WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching grain inventory:', error);
    res.status(500).json({ error: 'Error fetching grain inventory' });
  }
});

// Add grain entry
router.post('/', async (req, res) => {
  try {
    const { binNumber, grainType, quantity, moisture, notes } = req.body;
    const result = await db.query(
      `INSERT INTO grain_inventory (user_id, bin_number, grain_type, quantity, moisture, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.userId, binNumber, grainType, quantity, moisture, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding grain:', error);
    res.status(500).json({ error: 'Error adding grain' });
  }
});

// Update grain entry
router.put('/:id', async (req, res) => {
  try {
    const { binNumber, grainType, quantity, moisture, notes } = req.body;
    const result = await db.query(
      `UPDATE grain_inventory SET bin_number = $1, grain_type = $2, quantity = $3, 
       moisture = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [binNumber, grainType, quantity, moisture, notes, req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Grain entry not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating grain:', error);
    res.status(500).json({ error: 'Error updating grain' });
  }
});

// Delete grain entry
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM grain_inventory WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Grain entry not found' });
    }
    res.json({ message: 'Grain entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting grain:', error);
    res.status(500).json({ error: 'Error deleting grain' });
  }
});

module.exports = router;
