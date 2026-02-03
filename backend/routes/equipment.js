const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

const userId = 1; // Fixed for shared farm account

// List all equipment assets (optional: ?activeOnly=true to show only JD-connected/active)
router.get('/', async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === 'true' || req.query.activeOnly === '1';
    const result = activeOnly
      ? await db.query(
          `SELECT * FROM equipment_assets WHERE user_id = $1 AND (is_active IS NOT FALSE) ORDER BY category, name`,
          [userId]
        )
      : await db.query(
          `SELECT * FROM equipment_assets WHERE user_id = $1 ORDER BY category, name`,
          [userId]
        );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ error: 'Error fetching equipment' });
  }
});

// Get one equipment asset by id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM equipment_assets WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ error: 'Error fetching equipment' });
  }
});

// Create equipment asset
router.post('/', async (req, res) => {
  try {
    const {
      name,
      category,
      make,
      model,
      year,
      serialNumber,
      currentHours,
      currentMiles,
      purchaseDate,
      purchaseCost,
      insurancePolicy,
      insuranceExpires,
      registrationNumber,
      registrationExpires,
      notes,
    } = req.body;

    const result = await db.query(
      `INSERT INTO equipment_assets (
        user_id, name, category, make, model, year, serial_number,
        current_hours, current_miles, purchase_date, purchase_cost,
        insurance_policy, insurance_expires, registration_number, registration_expires, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [
        userId,
        name || 'Unnamed',
        category || 'tractor',
        make || null,
        model || null,
        year ? parseInt(year) : null,
        serialNumber || null,
        currentHours ? parseFloat(currentHours) : 0,
        currentMiles ? parseFloat(currentMiles) : 0,
        purchaseDate || null,
        purchaseCost ? parseFloat(purchaseCost) : null,
        insurancePolicy || null,
        insuranceExpires || null,
        registrationNumber || null,
        registrationExpires || null,
        notes || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding equipment:', error);
    res.status(500).json({ error: 'Error adding equipment' });
  }
});

// Update equipment asset
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      category,
      make,
      model,
      year,
      serialNumber,
      currentHours,
      currentMiles,
      purchaseDate,
      purchaseCost,
      insurancePolicy,
      insuranceExpires,
      registrationNumber,
      registrationExpires,
      notes,
    } = req.body;

    const result = await db.query(
      `UPDATE equipment_assets SET
        name = COALESCE($4, name),
        category = COALESCE($5, category),
        make = COALESCE($6, make),
        model = COALESCE($7, model),
        year = COALESCE($8, year),
        serial_number = COALESCE($9, serial_number),
        current_hours = COALESCE($10, current_hours),
        current_miles = COALESCE($11, current_miles),
        purchase_date = COALESCE($12, purchase_date),
        purchase_cost = COALESCE($13, purchase_cost),
        insurance_policy = COALESCE($14, insurance_policy),
        insurance_expires = COALESCE($15, insurance_expires),
        registration_number = COALESCE($16, registration_number),
        registration_expires = COALESCE($17, registration_expires),
        notes = COALESCE($18, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 RETURNING *`,
      [
        req.params.id,
        userId,
        name,
        category,
        make,
        model,
        year ? parseInt(year) : null,
        serialNumber,
        currentHours != null ? parseFloat(currentHours) : null,
        currentMiles != null ? parseFloat(currentMiles) : null,
        purchaseDate,
        purchaseCost != null ? parseFloat(purchaseCost) : null,
        insurancePolicy,
        insuranceExpires,
        registrationNumber,
        registrationExpires,
        notes,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating equipment:', error);
    res.status(500).json({ error: 'Error updating equipment' });
  }
});

// Delete equipment asset (cascades to maintenance, parts, fuel, operators)
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM equipment_assets WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    res.json({ message: 'Equipment deleted successfully' });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    res.status(500).json({ error: 'Error deleting equipment' });
  }
});

module.exports = router;
