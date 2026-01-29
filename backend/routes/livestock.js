const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get all livestock for user
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM livestock WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
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
      [req.params.id, req.user.userId]
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

// Add new livestock
router.post('/', async (req, res) => {
  try {
    const { tagNumber, animalType, breed, birthdate, weight, healthStatus, location, notes } = req.body;
    
    const result = await db.query(
      `INSERT INTO livestock (user_id, tag_number, animal_type, breed, birthdate, weight, health_status, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.userId, tagNumber, animalType, breed, birthdate, weight, healthStatus, location, notes]
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
      [tagNumber, animalType, breed, birthdate, weight, healthStatus, location, notes, req.params.id, req.user.userId]
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

// Delete livestock
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM livestock WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.userId]
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
