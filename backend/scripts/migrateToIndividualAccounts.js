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

const migrateToIndividualAccounts = async () => {
  try {
    console.log('Migrating to individual user accounts...');

    // Add new columns to users table
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_by INTEGER;
    `);
    console.log('✓ Added new columns to users table');

    // Create your admin account
    const adminExists = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@rockingzacres.com'"
    );

    if (adminExists.rows.length === 0) {
      const bcrypt = require('bcrypt');
      const adminPassword = process.env.ADMIN_PASSWORD || 'AdminRockingZ2024!';
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      await pool.query(`
        INSERT INTO users (username, email, password_hash, farm_name, is_admin, is_active)
        VALUES ($1, $2, $3, $4, true, true)
      `, ['admin', 'admin@rockingzacres.com', hashedPassword, 'Rocking Z Acres']);
      
      console.log('✓ Created admin account');
      console.log('  Username: admin');
      console.log('  Email: admin@rockingzacres.com');
      console.log('  Password:', adminPassword);
    } else {
      // Update existing admin
      await pool.query(`
        UPDATE users 
        SET is_admin = true, is_active = true 
        WHERE email = 'admin@rockingzacres.com'
      `);
      console.log('✓ Updated existing admin account');
    }

    // Create activity log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Created activity_log table');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at);
    `);
    console.log('✓ Created activity_log indexes');

    console.log('\n✓ Migration complete!');
    console.log('\nNEXT STEPS:');
    console.log('1. Add ADMIN_PASSWORD to Railway environment variables');
    console.log('2. Login with: username=admin, password=' + (process.env.ADMIN_PASSWORD || 'AdminRockingZ2024!'));
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration error:', error);
    await pool.end();
    process.exit(1);
  }
};

migrateToIndividualAccounts();
