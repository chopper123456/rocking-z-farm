const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files allowed'), false);
    }
  },
});

// Get all reports for a field and year
router.get('/:fieldName/:year', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, field_name, year, report_type, report_date, file_name, file_type, notes, created_at
       FROM field_reports 
       WHERE user_id = $1 AND field_name = $2 AND year = $3
       ORDER BY report_date DESC`,
      [req.user.userId, req.params.fieldName, req.params.year]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Error fetching reports' });
  }
});

// Get years for a specific field
router.get('/:fieldName/years', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT year FROM field_reports 
       WHERE user_id = $1 AND field_name = $2
       ORDER BY year DESC`,
      [req.user.userId, req.params.fieldName]
    );
    res.json(result.rows.map(r => r.year));
  } catch (error) {
    console.error('Error fetching years:', error);
    res.status(500).json({ error: 'Error fetching years' });
  }
});

// Download report file
router.get('/download/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT file_data, file_name, file_type FROM field_reports WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const report = result.rows[0];
    const safeName = (report.file_name || 'report').replace(/[\r\n"]/g, '').slice(0, 200) || 'report';
    res.setHeader('Content-Type', report.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(report.file_data);
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ error: 'Error downloading report' });
  }
});

// Add new report with optional file
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { fieldName, year, reportType, reportDate, notes } = req.body;
    
    let fileData = null;
    let fileName = null;
    let fileType = null;
    
    if (req.file) {
      fileData = req.file.buffer;
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
    }
    
    const result = await db.query(
      `INSERT INTO field_reports (user_id, field_name, year, report_type, report_date, file_data, file_name, file_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, field_name, year, report_type, report_date, file_name, file_type, notes, created_at`,
      [req.user.userId, fieldName, year, reportType, reportDate, fileData, fileName, fileType, notes]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding report:', error);
    res.status(500).json({ error: 'Error adding report' });
  }
});

// Delete report
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM field_reports WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Error deleting report' });
  }
});

module.exports = router;
