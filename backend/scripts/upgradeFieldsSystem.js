const { Pool } = require('pg');
require('dotenv').config();

const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

const upgradeFieldsSystem = async () => {
  try {
    console.log('Upgrading fields system with yield maps...');

    // Create field_years table for proper year tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS field_years (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        field_name VARCHAR(255) NOT NULL,
        year INTEGER NOT NULL,
        crop VARCHAR(100),
        variety VARCHAR(100),
        planting_date DATE,
        harvest_date DATE,
        expected_yield DECIMAL(10,2),
        actual_yield DECIMAL(10,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, field_name, year)
      );
    `);
    console.log('✓ Created field_years table');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_field_years_user_field 
      ON field_years(user_id, field_name);
    `);

    // Create scouting_reports table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scouting_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        field_name VARCHAR(255) NOT NULL,
        year INTEGER NOT NULL,
        report_date DATE NOT NULL,
        growth_stage VARCHAR(50),
        pest_pressure VARCHAR(20),
        disease_notes TEXT,
        weed_pressure VARCHAR(20),
        general_notes TEXT,
        weather_conditions VARCHAR(100),
        photo_data BYTEA,
        photo_name VARCHAR(255),
        photo_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Created scouting_reports table');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_scouting_user_field_year 
      ON scouting_reports(user_id, field_name, year);
    `);

    // Create yield_maps table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS yield_maps (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        field_name VARCHAR(255) NOT NULL,
        year INTEGER NOT NULL,
        harvest_date DATE,
        average_yield DECIMAL(10,2),
        total_bushels DECIMAL(12,2),
        moisture_avg DECIMAL(5,2),
        map_file_data BYTEA,
        map_file_name VARCHAR(255),
        map_file_type VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, field_name, year)
      );
    `);
    console.log('✓ Created yield_maps table');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_yield_maps_user_field 
      ON yield_maps(user_id, field_name);
    `);

    // Create field_operations table (from John Deere)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS field_operations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        field_name VARCHAR(255) NOT NULL,
        year INTEGER NOT NULL,
        operation_type VARCHAR(50) NOT NULL,
        operation_date DATE NOT NULL,
        equipment_used VARCHAR(255),
        operator VARCHAR(100),
        product_applied VARCHAR(255),
        rate DECIMAL(10,2),
        rate_unit VARCHAR(50),
        area_covered DECIMAL(10,2),
        jd_operation_id VARCHAR(255),
        raw_jd_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Created field_operations table');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_field_operations_user_field_year 
      ON field_operations(user_id, field_name, year);
      CREATE INDEX IF NOT EXISTS idx_field_operations_jd_id 
      ON field_operations(jd_operation_id);
    `);

    // Update field_reports to support images
    await pool.query(`
      ALTER TABLE field_reports 
      ADD COLUMN IF NOT EXISTS thumbnail_data BYTEA,
      ADD COLUMN IF NOT EXISTS is_image BOOLEAN DEFAULT false;
    `);
    console.log('✓ Updated field_reports table');

    console.log('\n✓ Fields system upgrade complete!');
    console.log('\nNew capabilities:');
    console.log('- Proper year tracking with crop details');
    console.log('- Weekly scouting reports with photos');
    console.log('- Yield maps with harvest data');
    console.log('- Field operations from John Deere');
    console.log('- Soil and tissue sample management');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Upgrade error:', error);
    await pool.end();
    process.exit(1);
  }
};

upgradeFieldsSystem();
