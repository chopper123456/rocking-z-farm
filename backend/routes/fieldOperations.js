const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

const JD_API_URL = 'https://sandboxapi.deere.com/platform';

// Get field operations for a field/year
router.get('/:fieldName/:year', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM field_operations 
       WHERE user_id = $1 AND field_name = $2 AND year = $3
       ORDER BY operation_date DESC`,
      [ORG_USER_ID, req.params.fieldName, req.params.year]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching operations:', error);
    res.status(500).json({ error: 'Error fetching operations' });
  }
});

// Sync field operations from John Deere (admin only)
router.post('/sync/:fieldName/:year', requireAdmin, async (req, res) => {
  try {
    const { fieldName, year } = req.params;
    
    const tokenResult = await db.query(
      'SELECT access_token FROM john_deere_tokens WHERE user_id = $1',
      [ORG_USER_ID]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'John Deere not connected' });
    }
    
    const accessToken = tokenResult.rows[0].access_token;
    
    // Get organization
    const orgsResponse = await axios.get(`${JD_API_URL}/organizations`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.deere.axiom.v3+json'
      }
    });
    
    // Find enabled org
    let enabledOrg = null;
    for (const org of orgsResponse.data.values || []) {
      const connectionsLink = org.links?.find(link => link.rel === 'connections');
      if (!connectionsLink) {
        enabledOrg = org;
        break;
      }
    }
    
    if (!enabledOrg) {
      return res.status(403).json({ error: 'No enabled organization found' });
    }
    
    const orgId = enabledOrg.id;
    
    // Get field operations
    let allOperations = [];
    let nextPageUrl = `${JD_API_URL}/organizations/${orgId}/fieldOperations`;
    
    while (nextPageUrl) {
      const opsResponse = await axios.get(nextPageUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.deere.axiom.v3+json'
        }
      });
      
      if (opsResponse.data.values) {
        allOperations = allOperations.concat(opsResponse.data.values);
      }
      
      const nextPageLink = opsResponse.data.links?.find(link => link.rel === 'nextPage');
      nextPageUrl = nextPageLink?.uri || null;
    }
    
    console.log(`Found ${allOperations.length} total operations from JD`);
    
    // Filter operations for this field and year
    let operationsAdded = 0;
    
    for (const op of allOperations) {
      try {
        // Extract field name from operation
        const opFieldName = op.field?.name || op.fieldName;
        
        // Check if this operation is for our field
        if (opFieldName && opFieldName.toLowerCase() === fieldName.toLowerCase()) {
          // Extract date
          const opDate = new Date(op.startTime || op.date);
          const opYear = opDate.getFullYear();
          
          // Check if this operation is for our year
          if (opYear === parseInt(year)) {
            // Check if operation already exists
            const existingOp = await db.query(
              'SELECT id FROM field_operations WHERE jd_operation_id = $1 AND user_id = $2',
              [op.id, ORG_USER_ID]
            );
            
            if (existingOp.rows.length === 0) {
              // Extract equipment from various JD response shapes (Field Operations API includes machine/equipment when present)
              const equipmentUsed = op.machine?.name || op.machine?.displayName || op.equipment
                || op.equipmentDisplayName || op.sourceDevice?.name || op.implement?.name
                || (typeof op.machine === 'string' ? op.machine : null) || null;
              // Add operation
              await db.query(
                `INSERT INTO field_operations 
                 (user_id, field_name, year, operation_type, operation_date, 
                  equipment_used, operator, product_applied, rate, rate_unit, 
                  area_covered, jd_operation_id, raw_jd_data)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                  userId,
                  fieldName,
                  opYear,
                  op.operationType || op.type || 'Unknown',
                  opDate.toISOString().split('T')[0],
                  equipmentUsed,
                  op.operator || null,
                  op.product || op.material || null,
                  op.rate || op.applicationRate || null,
                  op.rateUnit || op.unit || null,
                  op.area || op.totalArea || null,
                  op.id,
                  JSON.stringify(op)
                ]
              );
              
              operationsAdded++;
            }
          }
        }
      } catch (opError) {
        console.error('Error processing operation:', op.id, opError);
      }
    }
    
    res.json({
      message: `Synced ${operationsAdded} operations for ${fieldName} (${year})`,
      operationsAdded,
      totalOperationsChecked: allOperations.length
    });
    
    // Auto-update planting and harvest dates in field_years
    if (operationsAdded > 0) {
      try {
        // Find planting operation
        const plantingOp = await db.query(
          `SELECT operation_date FROM field_operations 
           WHERE user_id = $1 AND field_name = $2 AND year = $3 
           AND operation_type ILIKE '%plant%'
           ORDER BY operation_date ASC LIMIT 1`,
          [ORG_USER_ID, fieldName, year]
        );
        
        // Find harvest operation
        const harvestOp = await db.query(
          `SELECT operation_date FROM field_operations 
           WHERE user_id = $1 AND field_name = $2 AND year = $3 
           AND operation_type ILIKE '%harvest%'
           ORDER BY operation_date DESC LIMIT 1`,
          [ORG_USER_ID, fieldName, year]
        );
        
        // Update field_years with dates
        let updateFields = [];
        let updateValues = [ORG_USER_ID, fieldName, year];
        let paramIndex = 4;
        
        if (plantingOp.rows.length > 0) {
          updateFields.push(`planting_date = $${paramIndex}`);
          updateValues.push(plantingOp.rows[0].operation_date);
          paramIndex++;
        }
        
        if (harvestOp.rows.length > 0) {
          updateFields.push(`harvest_date = $${paramIndex}`);
          updateValues.push(harvestOp.rows[0].operation_date);
          paramIndex++;
        }
        
        if (updateFields.length > 0) {
          await db.query(
            `UPDATE field_years 
             SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND field_name = $2 AND year = $3`,
            updateValues
          );
          console.log(`Auto-updated planting/harvest dates for ${fieldName} ${year}`);
        }
      } catch (dateError) {
        console.error('Error auto-updating dates:', dateError);
        // Don't fail the whole sync if date update fails
      }
    }
    
  } catch (error) {
    console.error('Sync operations error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to sync operations',
      details: error.response?.data?.message || error.message
    });
  }
});

// Delete operation (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM field_operations WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, ORG_USER_ID]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Operation not found' });
    }
    
    res.json({ message: 'Operation deleted successfully' });
  } catch (error) {
    console.error('Error deleting operation:', error);
    res.status(500).json({ error: 'Error deleting operation' });
  }
});

module.exports = router;
