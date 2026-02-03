const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { ORG_USER_ID } = require('../config/org');
const multer = require('multer');

router.use(authMiddleware);

// In-memory storage for multipart (receipts). For production you might use disk or S3.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files allowed'), false);
    }
  },
});

// ---- Service history ----

// List maintenance records for an equipment asset
router.get('/:assetId/maintenance', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM equipment_maintenance 
       WHERE equipment_asset_id = $1 AND user_id = $2 
       ORDER BY service_date DESC`,
      [req.params.assetId, ORG_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance:', error);
    res.status(500).json({ error: 'Error fetching maintenance' });
  }
});

// Add maintenance record (optional receipt file)
router.post('/:assetId/maintenance', upload.single('receipt'), async (req, res) => {
  try {
    const { serviceDate, serviceType, description, cost, hoursAtService } = req.body;
    const file = req.file;

    const result = await db.query(
      `INSERT INTO equipment_maintenance (
        user_id, equipment_asset_id, service_date, service_type, description,
        cost, hours_at_service, receipt_data, receipt_name, receipt_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        ORG_USER_ID,
        req.params.assetId,
        serviceDate,
        serviceType || 'Service',
        description || null,
        cost ? parseFloat(cost) : null,
        hoursAtService ? parseFloat(hoursAtService) : null,
        file ? file.buffer : null,
        file ? file.originalname : null,
        file ? file.mimetype : null,
      ]
    );

    // Update asset current hours if provided
    if (hoursAtService) {
      await db.query(
        'UPDATE equipment_assets SET current_hours = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
        [parseFloat(hoursAtService), req.params.assetId, ORG_USER_ID]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding maintenance:', error);
    res.status(500).json({ error: 'Error adding maintenance' });
  }
});

// Delete maintenance record
router.delete('/:assetId/maintenance/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM equipment_maintenance WHERE id = $1 AND equipment_asset_id = $2 AND user_id = $3 RETURNING *',
      [req.params.id, req.params.assetId, ORG_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting maintenance:', error);
    res.status(500).json({ error: 'Error deleting maintenance' });
  }
});

// Download receipt
router.get('/:assetId/maintenance/:id/receipt', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT receipt_data, receipt_name, receipt_type FROM equipment_maintenance WHERE id = $1 AND equipment_asset_id = $2 AND user_id = $3',
      [req.params.id, req.params.assetId, ORG_USER_ID]
    );
    if (result.rows.length === 0 || !result.rows[0].receipt_data) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    const row = result.rows[0];
    const safeName = (row.receipt_name || 'receipt').replace(/[\r\n"]/g, '').slice(0, 200) || 'receipt';
    res.setHeader('Content-Type', row.receipt_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(row.receipt_data);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    res.status(500).json({ error: 'Error downloading receipt' });
  }
});

// ---- Maintenance schedule / alerts ----

router.get('/:assetId/schedule', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM equipment_maintenance_schedule 
       WHERE equipment_asset_id = $1 AND user_id = $2 ORDER BY next_due_hours ASC NULLS LAST, next_due_date ASC NULLS LAST`,
      [req.params.assetId, ORG_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Error fetching schedule' });
  }
});

router.post('/:assetId/schedule', async (req, res) => {
  try {
    const {
      taskName,
      intervalHours,
      intervalDays,
      lastDoneDate,
      lastDoneHours,
      nextDueDate,
      nextDueHours,
      notes,
    } = req.body;

    const result = await db.query(
      `INSERT INTO equipment_maintenance_schedule (
        user_id, equipment_asset_id, task_name, interval_hours, interval_days,
        last_done_date, last_done_hours, next_due_date, next_due_hours, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        ORG_USER_ID,
        req.params.assetId,
        taskName || 'Task',
        intervalHours ? parseFloat(intervalHours) : null,
        intervalDays ? parseInt(intervalDays) : null,
        lastDoneDate || null,
        lastDoneHours != null ? parseFloat(lastDoneHours) : null,
        nextDueDate || null,
        nextDueHours != null ? parseFloat(nextDueHours) : null,
        notes || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding schedule:', error);
    res.status(500).json({ error: 'Error adding schedule' });
  }
});

router.put('/:assetId/schedule/:id', async (req, res) => {
  try {
    const {
      taskName,
      intervalHours,
      intervalDays,
      lastDoneDate,
      lastDoneHours,
      nextDueDate,
      nextDueHours,
      notes,
    } = req.body;

    const result = await db.query(
      `UPDATE equipment_maintenance_schedule SET
        task_name = COALESCE($4, task_name),
        interval_hours = COALESCE($5, interval_hours),
        interval_days = COALESCE($6, interval_days),
        last_done_date = COALESCE($7, last_done_date),
        last_done_hours = COALESCE($8, last_done_hours),
        next_due_date = COALESCE($9, next_due_date),
        next_due_hours = COALESCE($10, next_due_hours),
        notes = COALESCE($11, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND equipment_asset_id = $2 AND user_id = $3 RETURNING *`,
      [
        req.params.id,
        req.params.assetId,
        ORG_USER_ID,
        taskName,
        intervalHours != null ? parseFloat(intervalHours) : null,
        intervalDays != null ? parseInt(intervalDays) : null,
        lastDoneDate,
        lastDoneHours != null ? parseFloat(lastDoneHours) : null,
        nextDueDate,
        nextDueHours != null ? parseFloat(nextDueHours) : null,
        notes,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Error updating schedule' });
  }
});

router.delete('/:assetId/schedule/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM equipment_maintenance_schedule WHERE id = $1 AND equipment_asset_id = $2 AND user_id = $3 RETURNING *',
      [req.params.id, req.params.assetId, ORG_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Error deleting schedule' });
  }
});

// ---- Parts inventory ----

router.get('/:assetId/parts', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM equipment_parts WHERE equipment_asset_id = $1 AND user_id = $2 ORDER BY part_name',
      [req.params.assetId, ORG_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching parts:', error);
    res.status(500).json({ error: 'Error fetching parts' });
  }
});

router.post('/:assetId/parts', async (req, res) => {
  try {
    const { partName, partNumber, quantity, location, notes } = req.body;
    const result = await db.query(
      `INSERT INTO equipment_parts (user_id, equipment_asset_id, part_name, part_number, quantity, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        ORG_USER_ID,
        req.params.assetId,
        partName || 'Part',
        partNumber || null,
        quantity ? parseInt(quantity) : 1,
        location || null,
        notes || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding part:', error);
    res.status(500).json({ error: 'Error adding part' });
  }
});

router.put('/:assetId/parts/:id', async (req, res) => {
  try {
    const { partName, partNumber, quantity, location, notes } = req.body;
    const result = await db.query(
      `UPDATE equipment_parts SET
        part_name = COALESCE($4, part_name),
        part_number = COALESCE($5, part_number),
        quantity = COALESCE($6, quantity),
        location = COALESCE($7, location),
        notes = COALESCE($8, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND equipment_asset_id = $2 AND user_id = $3 RETURNING *`,
      [
        req.params.id,
        req.params.assetId,
        ORG_USER_ID,
        partName,
        partNumber,
        quantity != null ? parseInt(quantity) : null,
        location,
        notes,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating part:', error);
    res.status(500).json({ error: 'Error updating part' });
  }
});

router.delete('/:assetId/parts/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM equipment_parts WHERE id = $1 AND equipment_asset_id = $2 AND user_id = $3 RETURNING *',
      [req.params.id, req.params.assetId, ORG_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting part:', error);
    res.status(500).json({ error: 'Error deleting part' });
  }
});

// ---- Fuel logs ----

router.get('/:assetId/fuel', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM equipment_fuel_logs WHERE equipment_asset_id = $1 AND user_id = $2 ORDER BY fuel_date DESC',
      [req.params.assetId, ORG_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching fuel logs:', error);
    res.status(500).json({ error: 'Error fetching fuel logs' });
  }
});

router.post('/:assetId/fuel', async (req, res) => {
  try {
    const { fuelDate, gallons, cost, hoursAtFill, notes } = req.body;
    const result = await db.query(
      `INSERT INTO equipment_fuel_logs (user_id, equipment_asset_id, fuel_date, gallons, cost, hours_at_fill, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        ORG_USER_ID,
        req.params.assetId,
        fuelDate,
        gallons ? parseFloat(gallons) : 0,
        cost ? parseFloat(cost) : null,
        hoursAtFill ? parseFloat(hoursAtFill) : null,
        notes || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding fuel log:', error);
    res.status(500).json({ error: 'Error adding fuel log' });
  }
});

router.delete('/:assetId/fuel/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM equipment_fuel_logs WHERE id = $1 AND equipment_asset_id = $2 AND user_id = $3 RETURNING *',
      [req.params.id, req.params.assetId, ORG_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fuel log not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting fuel log:', error);
    res.status(500).json({ error: 'Error deleting fuel log' });
  }
});

// ---- Operators ----

router.get('/:assetId/operators', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM equipment_operators 
       WHERE equipment_asset_id = $1 AND user_id = $2 
       ORDER BY is_primary DESC, assigned_from DESC`,
      [req.params.assetId, ORG_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching operators:', error);
    res.status(500).json({ error: 'Error fetching operators' });
  }
});

router.post('/:assetId/operators', async (req, res) => {
  try {
    const { operatorName, assignedFrom, assignedTo, isPrimary, notes } = req.body;
    const result = await db.query(
      `INSERT INTO equipment_operators (user_id, equipment_asset_id, operator_name, assigned_from, assigned_to, is_primary, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        ORG_USER_ID,
        req.params.assetId,
        operatorName || 'Operator',
        assignedFrom || new Date().toISOString().split('T')[0],
        assignedTo || null,
        isPrimary === true || isPrimary === 'true',
        notes || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding operator:', error);
    res.status(500).json({ error: 'Error adding operator' });
  }
});

router.delete('/:assetId/operators/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM equipment_operators WHERE id = $1 AND equipment_asset_id = $2 AND user_id = $3 RETURNING *',
      [req.params.id, req.params.assetId, ORG_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting operator:', error);
    res.status(500).json({ error: 'Error deleting operator' });
  }
});

// Pass through to equipment router when no nested route matches (e.g. GET /api/equipment, GET /api/equipment/1)
router.use((req, res, next) => next());

module.exports = router;
