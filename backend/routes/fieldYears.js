const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all years for a field
router.get('/:fieldName', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM field_years 
       WHERE user_id = $1 AND field_name = $2
       ORDER BY year DESC`,
      [req.user.userId, req.params.fieldName]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching years:', error);
    res.status(500).json({ error: 'Error fetching years' });
  }
});

// Get specific year details
router.get('/:fieldName/:year', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM field_years 
       WHERE user_id = $1 AND field_name = $2 AND year = $3`,
      [req.user.userId, req.params.fieldName, req.params.year]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Year not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching year:', error);
    res.status(500).json({ error: 'Error fetching year' });
  }
});

// Add new year
router.post('/', async (req, res) => {
  try {
    const { 
      fieldName, 
      year, 
      crop, 
      variety, 
      plantingDate, 
      harvestDate,
      expectedYield,
      notes 
    } = req.body;
    
    const result = await db.query(
      `INSERT INTO field_years 
       (user_id, field_name, year, crop, variety, planting_date, harvest_date, expected_yield, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [req.user.userId, fieldName, year, crop, variety, plantingDate, harvestDate, expectedYield, notes]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Year already exists for this field' });
    }
    console.error('Error adding year:', error);
    res.status(500).json({ error: 'Error adding year' });
  }
});

// Update year
router.put('/:fieldName/:year', async (req, res) => {
  try {
    const { 
      crop, 
      variety, 
      plantingDate, 
      harvestDate,
      expectedYield,
      actualYield,
      notes 
    } = req.body;
    
    const result = await db.query(
      `UPDATE field_years 
       SET crop = $1, variety = $2, planting_date = $3, harvest_date = $4, 
           expected_yield = $5, actual_yield = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $8 AND field_name = $9 AND year = $10
       RETURNING *`,
      [crop, variety, plantingDate, harvestDate, expectedYield, actualYield, notes,
       req.user.userId, req.params.fieldName, req.params.year]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Year not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating year:', error);
    res.status(500).json({ error: 'Error updating year' });
  }
});

// Delete year
router.delete('/:fieldName/:year', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM field_years WHERE user_id = $1 AND field_name = $2 AND year = $3 RETURNING *',
      [req.user.userId, req.params.fieldName, req.params.year]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Year not found' });
    }
    
    res.json({ message: 'Year deleted successfully' });
  } catch (error) {
    console.error('Error deleting year:', error);
    res.status(500).json({ error: 'Error deleting year' });
  }
});

module.exports = router;
