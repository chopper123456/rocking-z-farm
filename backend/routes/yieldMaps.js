const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { ORG_USER_ID } = require('../config/org');

router.use(authMiddleware);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for yield map files
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/') || file.mimetype === 'application/zip') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, image, or ZIP files allowed'), false);
    }
  },
});

// Get yield map for a field/year
router.get('/:fieldName/:year', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, field_name, year, harvest_date, average_yield, total_bushels,
              moisture_avg, map_file_name, notes, created_at
       FROM yield_maps 
       WHERE user_id = $1 AND field_name = $2 AND year = $3`,
      [ORG_USER_ID, req.params.fieldName, req.params.year]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Yield map not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching yield map:', error);
    res.status(500).json({ error: 'Error fetching yield map' });
  }
});

// Download yield map file
router.get('/download/:fieldName/:year', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT map_file_data, map_file_name, map_file_type 
       FROM yield_maps 
       WHERE user_id = $1 AND field_name = $2 AND year = $3`,
      [ORG_USER_ID, req.params.fieldName, req.params.year]
    );
    
    if (result.rows.length === 0 || !result.rows[0].map_file_data) {
      return res.status(404).json({ error: 'Yield map file not found' });
    }
    
    const map = result.rows[0];
    const safeName = (map.map_file_name || 'yield-map').replace(/[\r\n"]/g, '').slice(0, 200) || 'yield-map';
    res.setHeader('Content-Type', map.map_file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(map.map_file_data);
  } catch (error) {
    console.error('Error downloading yield map:', error);
    res.status(500).json({ error: 'Error downloading yield map' });
  }
});

// Add or update yield map (admin only)
router.post('/', requireAdmin, upload.single('mapFile'), async (req, res) => {
  try {
    const { 
      fieldName, 
      year, 
      harvestDate, 
      averageYield,
      totalBushels,
      moistureAvg,
      notes 
    } = req.body;
    
    let mapFileData = null;
    let mapFileName = null;
    let mapFileType = null;
    
    if (req.file) {
      mapFileData = req.file.buffer;
      mapFileName = req.file.originalname;
      mapFileType = req.file.mimetype;
    }
    
    const result = await db.query(
      `INSERT INTO yield_maps 
       (user_id, field_name, year, harvest_date, average_yield, total_bushels,
        moisture_avg, map_file_data, map_file_name, map_file_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (user_id, field_name, year)
       DO UPDATE SET
         harvest_date = $4,
         average_yield = $5,
         total_bushels = $6,
         moisture_avg = $7,
         map_file_data = COALESCE($8, yield_maps.map_file_data),
         map_file_name = COALESCE($9, yield_maps.map_file_name),
         map_file_type = COALESCE($10, yield_maps.map_file_type),
         notes = $11
       RETURNING id, field_name, year, harvest_date, average_yield, total_bushels,
                 moisture_avg, map_file_name, notes, created_at`,
      [ORG_USER_ID, fieldName, year, harvestDate, averageYield, totalBushels,
       moistureAvg, mapFileData, mapFileName, mapFileType, notes]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving yield map:', error);
    res.status(500).json({ error: 'Error saving yield map' });
  }
});

// Delete yield map (admin only)
router.delete('/:fieldName/:year', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM yield_maps WHERE user_id = $1 AND field_name = $2 AND year = $3 RETURNING *',
      [ORG_USER_ID, req.params.fieldName, req.params.year]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Yield map not found' });
    }
    
    res.json({ message: 'Yield map deleted successfully' });
  } catch (error) {
    console.error('Error deleting yield map:', error);
    res.status(500).json({ error: 'Error deleting yield map' });
  }
});

module.exports = router;
