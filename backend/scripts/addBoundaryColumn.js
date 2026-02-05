/**
 * One-off: add boundary_geojson column to fields table if missing.
 * Run: node scripts/addBoundaryColumn.js (from backend dir)
 * Or from repo root: node backend/scripts/addBoundaryColumn.js
 */
require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  const db = require('../config/database');
  try {
    await db.query(`
      ALTER TABLE fields ADD COLUMN IF NOT EXISTS boundary_geojson JSONB;
    `);
    console.log('✓ fields.boundary_geojson column exists');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

run();
