const db = require('../config/database');

const initDatabase = async () => {
  try {
    console.log('Initializing database...');

    // Create Users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        farm_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Users table created');

    // Create Livestock table
    await db.query(`
      CREATE TABLE IF NOT EXISTS livestock (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        tag_number VARCHAR(50) NOT NULL,
        animal_type VARCHAR(50) NOT NULL,
        breed VARCHAR(100),
        birthdate DATE,
        weight DECIMAL(10, 2),
        health_status VARCHAR(100),
        location VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Livestock table created');

    // Create Fields table
    await db.query(`
      CREATE TABLE IF NOT EXISTS fields (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        field_name VARCHAR(100) NOT NULL,
        acreage DECIMAL(10, 2),
        soil_type VARCHAR(100),
        irrigation_type VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Fields table created');

    // Create Field Reports table (for soil tests, tissue samples, etc.)
    await db.query(`
      CREATE TABLE IF NOT EXISTS field_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        field_name VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        report_type VARCHAR(50) NOT NULL,
        report_date DATE NOT NULL,
        file_data BYTEA,
        file_name VARCHAR(255),
        file_type VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Field Reports table created');

    // Create Equipment table
    await db.query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        equipment_name VARCHAR(100) NOT NULL,
        service_type VARCHAR(100),
        hours INTEGER,
        notes TEXT,
        service_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Equipment table created');

    // Create Grain Inventory table
    await db.query(`
      CREATE TABLE IF NOT EXISTS grain_inventory (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        bin_number VARCHAR(50) NOT NULL,
        grain_type VARCHAR(50) NOT NULL,
        quantity DECIMAL(10, 2),
        moisture DECIMAL(5, 2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Grain Inventory table created');

    // Create General Inventory table
    await db.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_name VARCHAR(100) NOT NULL,
        category VARCHAR(50),
        quantity DECIMAL(10, 2),
        unit VARCHAR(20),
        location VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Inventory table created');

    // Create John Deere Data table (for future API integration)
    await db.query(`
      CREATE TABLE IF NOT EXISTS john_deere_data (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        data_type VARCHAR(50) NOT NULL,
        field_name VARCHAR(100),
        sync_date TIMESTAMP NOT NULL,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ John Deere Data table created (ready for future integration)');

    // Create indexes for better performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_livestock_user_id ON livestock(user_id);
      CREATE INDEX IF NOT EXISTS idx_fields_user_id ON fields(user_id);
      CREATE INDEX IF NOT EXISTS idx_field_reports_user_id ON field_reports(user_id);
      CREATE INDEX IF NOT EXISTS idx_field_reports_field_year ON field_reports(field_name, year);
      CREATE INDEX IF NOT EXISTS idx_equipment_user_id ON equipment(user_id);
      CREATE INDEX IF NOT EXISTS idx_grain_user_id ON grain_inventory(user_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
      CREATE INDEX IF NOT EXISTS idx_john_deere_user_id ON john_deere_data(user_id);
    `);
    console.log('✓ Indexes created');

    console.log('\n✓ Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error initializing database:', error);
    process.exit(1);
  }
};

initDatabase();
