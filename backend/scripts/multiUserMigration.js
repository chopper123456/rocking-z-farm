/**
 * Multi-User Migration
 * - Ensures users table has is_admin, is_active, last_login, created_by, full_name
 * - Creates activity_log if missing
 * - Ensures first admin exists with id=1 (so existing field/equipment data with user_id=1 is valid)
 *
 * Run: node backend/scripts/multiUserMigration.js
 * Set ADMIN_PASSWORD and optionally ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_FULL_NAME in env.
 */
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@rockingzacres.com';
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME || 'Farm Owner';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

async function run() {
  try {
    console.log('Running multi-user migration...');

    // 1) Add columns to users if missing
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
        ADD COLUMN IF NOT EXISTS created_by INTEGER,
        ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);
    `);
    console.log('✓ Users table columns OK');

    // 2) activity_log
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
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at);
    `);
    console.log('✓ activity_log OK');

    // 3) Ensure a user with id=1 exists (so existing data with user_id=1 is valid)
    const hasUser1 = await pool.query('SELECT id FROM users WHERE id = 1');
    if (hasUser1.rows.length === 0) {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await pool.query(
        `INSERT INTO users (id, username, email, password_hash, farm_name, full_name, is_admin, is_active)
         VALUES (1, $1, $2, $3, $4, $5, true, true)`,
        [ADMIN_USERNAME, ADMIN_EMAIL, hash, 'Rocking Z Acres', ADMIN_FULL_NAME]
      );
      await pool.query("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 1) FROM users))");
      console.log('✓ Created first admin (id=1)');
      console.log(`  Username: ${ADMIN_USERNAME}`);
      console.log(`  Email: ${ADMIN_EMAIL}`);
      console.log(`  Password: ${ADMIN_PASSWORD}`);
    } else {
      await pool.query(
        'UPDATE users SET is_admin = true, is_active = true, full_name = COALESCE(full_name, $1) WHERE id = 1',
        [ADMIN_FULL_NAME]
      );
      console.log('✓ User id=1 exists; ensured admin and active.');
    }

    // If no user has id=1 but table has other users, we can't easily "reserve" id=1 in PostgreSQL after serial has advanced. The above INSERT with id=1 works only when no row has id=1. So we're good.

    console.log('\n✓ Multi-user migration complete.');
    console.log('\nNext: Set JWT_SECRET in your environment, then log in with the admin account.');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    await pool.end();
    process.exit(1);
  }
}

run();
