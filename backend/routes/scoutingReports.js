const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Configure multer for photo uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get all scouting reports for a field/year
router.get('/:fieldName/:year', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, field_name, year, report_date, growth_stage, pest_pressure, 
              disease_notes, weed_pressure, general_notes, weather_conditions,
              photo_name, created_at
       FROM scouting_reports 
       WHERE user_id = $1 AND field_name = $2 AND year = $3
       ORDER BY report_date DESC`,
      [req.user.userId, req.params.fieldName, req.params.year]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scouting reports:', error);
    res.status(500).json({ error: 'Error fetching scouting reports' });
  }
});

// Get single scouting report with photo
router.get('/detail/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM scouting_reports 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const report = result.rows[0];
    
    // Convert photo to base64 if exists
    if (report.photo_data) {
      report.photo_base64 = report.photo_data.toString('base64');
      delete report.photo_data; // Don't send raw buffer
    }
    
    res.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Error fetching report' });
  }
});

// Add new scouting report
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { 
      fieldName, 
      year, 
      reportDate, 
      growthStage, 
      pestPressure,
      diseaseNotes,
      weedPressure,
      generalNotes,
      weatherConditions
    } = req.body;
    
    let photoData = null;
    let photoName = null;
    let photoType = null;
    
    if (req.file) {
      photoData = req.file.buffer;
      photoName = req.file.originalname;
      photoType = req.file.mimetype;
    }
    
    const result = await db.query(
      `INSERT INTO scouting_reports 
       (user_id, field_name, year, report_date, growth_stage, pest_pressure, 
        disease_notes, weed_pressure, general_notes, weather_conditions,
        photo_data, photo_name, photo_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING id, field_name, year, report_date, growth_stage, pest_pressure,
                 disease_notes, weed_pressure, general_notes, weather_conditions,
                 photo_name, created_at`,
      [req.user.userId, fieldName, year, reportDate, growthStage, pestPressure,
       diseaseNotes, weedPressure, generalNotes, weatherConditions,
       photoData, photoName, photoType]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding scouting report:', error);
    res.status(500).json({ error: 'Error adding scouting report' });
  }
});

// Delete scouting report
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM scouting_reports WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ message: 'Scouting report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Error deleting report' });
  }
});

module.exports = router;
