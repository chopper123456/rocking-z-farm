const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all equipment logs
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM equipment WHERE user_id = $1 ORDER BY service_date DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ error: 'Error fetching equipment' });
  }
});

// Add equipment log
router.post('/', async (req, res) => {
  try {
    const { equipmentName, serviceType, hours, notes } = req.body;
    const result = await db.query(
      `INSERT INTO equipment (user_id, equipment_name, service_type, hours, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.userId, equipmentName, serviceType, hours, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding equipment:', error);
    res.status(500).json({ error: 'Error adding equipment' });
  }
});

// Delete equipment log
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM equipment WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment log not found' });
    }
    res.json({ message: 'Equipment log deleted successfully' });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    res.status(500).json({ error: 'Error deleting equipment' });
  }
});

module.exports = router;
