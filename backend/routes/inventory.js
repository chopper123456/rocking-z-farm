const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all inventory
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM inventory WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Error fetching inventory' });
  }
});

// Add inventory item
router.post('/', async (req, res) => {
  try {
    const { productName, category, quantity, unit, location, notes } = req.body;
    const result = await db.query(
      `INSERT INTO inventory (user_id, product_name, category, quantity, unit, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.userId, productName, category, quantity, unit, location, notes]
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
      [productName, category, quantity, unit, location, notes, req.params.id, req.user.userId]
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

// Delete inventory item
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM inventory WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.userId]
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
