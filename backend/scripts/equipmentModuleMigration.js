/**
 * Equipment Module Migration - Rocking Z Acres
 * Run once: node scripts/equipmentModuleMigration.js
 * Creates tables for full equipment management (assets, maintenance, parts, fuel, operators, JD sync).
 */

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

const run = async () => {
  try {
    console.log('Running Equipment Module migration...');

    // 1. Equipment assets (tractors, combines, sprayers, implements)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_assets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'tractor',
        make VARCHAR(100),
        model VARCHAR(100),
        year INTEGER,
        serial_number VARCHAR(100),
        current_hours DECIMAL(12,2) DEFAULT 0,
        current_miles DECIMAL(12,2) DEFAULT 0,
        purchase_date DATE,
        purchase_cost DECIMAL(12,2),
        insurance_policy VARCHAR(255),
        insurance_expires DATE,
        registration_number VARCHAR(100),
        registration_expires DATE,
        notes TEXT,
        jd_asset_id VARCHAR(255),
        jd_raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ equipment_assets');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_assets_user ON equipment_assets(user_id);
      CREATE INDEX IF NOT EXISTS idx_equipment_assets_jd ON equipment_assets(jd_asset_id);
    `);

    // 2. Service history (dates, costs, notes, receipts)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_maintenance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        equipment_asset_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
        service_date DATE NOT NULL,
        service_type VARCHAR(100) NOT NULL,
        description TEXT,
        cost DECIMAL(12,2),
        hours_at_service DECIMAL(12,2),
        receipt_data BYTEA,
        receipt_name VARCHAR(255),
        receipt_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ equipment_maintenance');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_asset ON equipment_maintenance(equipment_asset_id);
    `);

    // 3. Maintenance schedule / alerts (hours or calendar based)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_maintenance_schedule (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        equipment_asset_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
        task_name VARCHAR(255) NOT NULL,
        interval_hours DECIMAL(12,2),
        interval_days INTEGER,
        last_done_date DATE,
        last_done_hours DECIMAL(12,2),
        next_due_date DATE,
        next_due_hours DECIMAL(12,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ equipment_maintenance_schedule');

    // 4. Parts inventory per machine
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_parts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        equipment_asset_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
        part_name VARCHAR(255) NOT NULL,
        part_number VARCHAR(100),
        quantity INTEGER DEFAULT 1,
        location VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ equipment_parts');

    // 5. Fuel consumption tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_fuel_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        equipment_asset_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
        fuel_date DATE NOT NULL,
        gallons DECIMAL(10,2) NOT NULL,
        cost DECIMAL(10,2),
        hours_at_fill DECIMAL(12,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ equipment_fuel_logs');

    // 6. Operator assignments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_operators (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        equipment_asset_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
        operator_name VARCHAR(255) NOT NULL,
        assigned_from DATE DEFAULT CURRENT_DATE,
        assigned_to DATE,
        is_primary BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ equipment_operators');

    // 7. JD equipment data cache (for telemetry/sync)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS john_deere_equipment (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        jd_asset_id VARCHAR(255) NOT NULL,
        equipment_asset_id INTEGER REFERENCES equipment_assets(id) ON DELETE SET NULL,
        name VARCHAR(255),
        raw_data JSONB,
        last_hours DECIMAL(12,2),
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, jd_asset_id)
      );
    `);
    console.log('✓ john_deere_equipment');

    console.log('\n✓ Equipment Module migration complete.');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    await pool.end();
    process.exit(1);
  }
};

run();
