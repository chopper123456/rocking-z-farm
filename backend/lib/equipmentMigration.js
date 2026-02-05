/**
 * Equipment module tables - run on server startup so Railway DB has tables.
 * Uses CREATE TABLE IF NOT EXISTS so safe to run every time.
 */

async function runEquipmentMigration(db) {
  await db.query(`
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
  await db.query(`CREATE INDEX IF NOT EXISTS idx_equipment_assets_user ON equipment_assets(user_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_equipment_assets_jd ON equipment_assets(jd_asset_id);`);

  // Add is_active for "active equipment" filter (from JD Connections)
  await db.query(`
    ALTER TABLE equipment_assets ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_equipment_assets_active ON equipment_assets(is_active);`);

  // Fields table: JD link columns + boundary geometry (add if table exists from initDatabase)
  try {
    await db.query(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS jd_field_id VARCHAR(255);`);
    await db.query(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS jd_farm_id VARCHAR(255);`);
    await db.query(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS farm_name VARCHAR(255);`);
    await db.query(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS boundary_geojson JSONB;`);
  } catch (e) {
    // fields table may not exist yet
  }

  await db.query(`
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
  await db.query(`CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_asset ON equipment_maintenance(equipment_asset_id);`);

  await db.query(`
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

  await db.query(`
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

  await db.query(`
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

  await db.query(`
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

  await db.query(`
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
}

module.exports = { runEquipmentMigration };
