const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { ORG_USER_ID } = require('../config/org');

router.use(authMiddleware);

// Get all inventory (shared org data)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM inventory WHERE user_id = $1 ORDER BY created_at DESC',
      [ORG_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Error fetching inventory' });
  }
});

// Add inventory item (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { productName, category, quantity, unit, location, notes } = req.body;
    const result = await db.query(
      `INSERT INTO inventory (user_id, product_name, category, quantity, unit, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [ORG_USER_ID, productName, category, quantity, unit, location, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding inventory:', error);
    res.status(500).json({ error: 'Error adding inventory' });
  }
});

// Update inventory item
router.put('/:id', async (req, res) => {
  try {
    const { productName, category, quantity, unit, location, notes } = req.body;
    const result = await db.query(
      `UPDATE inventory SET product_name = $1, category = $2, quantity = $3, 
       unit = $4, location = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [productName, category, quantity, unit, location, notes, req.params.id, ORG_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: 'Error updating inventory' });
  }
});

// Delete inventory item (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM inventory WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, ORG_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory:', error);
    res.status(500).json({ error: 'Error deleting inventory' });
  }
});

module.exports = router;
