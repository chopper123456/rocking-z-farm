const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { ORG_USER_ID } = require('../config/org');

router.use(authMiddleware);

// Get all livestock (shared org data)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM livestock WHERE user_id = $1 ORDER BY created_at DESC',
      [ORG_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching livestock:', error);
    res.status(500).json({ error: 'Error fetching livestock' });
  }
});

// Get single livestock by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM livestock WHERE id = $1 AND user_id = $2',
      [req.params.id, ORG_USER_ID]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Livestock not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching livestock:', error);
    res.status(500).json({ error: 'Error fetching livestock' });
  }
});

// Add new livestock (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { tagNumber, animalType, breed, birthdate, weight, healthStatus, location, notes } = req.body;
    
    const result = await db.query(
      `INSERT INTO livestock (user_id, tag_number, animal_type, breed, birthdate, weight, health_status, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [ORG_USER_ID, tagNumber, animalType, breed, birthdate, weight, healthStatus, location, notes]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding livestock:', error);
    res.status(500).json({ error: 'Error adding livestock' });
  }
});

// Update livestock
router.put('/:id', async (req, res) => {
  try {
    const { tagNumber, animalType, breed, birthdate, weight, healthStatus, location, notes } = req.body;
    
    const result = await db.query(
      `UPDATE livestock 
       SET tag_number = $1, animal_type = $2, breed = $3, birthdate = $4, 
           weight = $5, health_status = $6, location = $7, notes = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [tagNumber, animalType, breed, birthdate, weight, healthStatus, location, notes, req.params.id, ORG_USER_ID]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Livestock not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating livestock:', error);
    res.status(500).json({ error: 'Error updating livestock' });
  }
});

// Delete livestock (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM livestock WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, ORG_USER_ID]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Livestock not found' });
    }
    
    res.json({ message: 'Livestock deleted successfully' });
  } catch (error) {
    console.error('Error deleting livestock:', error);
    res.status(500).json({ error: 'Error deleting livestock' });
  }
});

module.exports = router;
