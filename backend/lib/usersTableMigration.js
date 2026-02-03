/**
 * Users table schema - run on server startup so production (e.g. Railway)
 * has full_name and other multi-user columns without running scripts manually.
 * Each ALTER is separate so ADD COLUMN IF NOT EXISTS works in all PostgreSQL versions.
 */

async function runUsersTableMigration(db) {
  const alters = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100)`,
  ];
  for (const sql of alters) {
    try {
      await db.query(sql);
    } catch (err) {
      console.warn('Users table migration step:', err.message);
    }
  }

  // activity_log for multi-user
  await db.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(100) NOT NULL,
      details JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_log(user_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at);`);

  // Backfill full_name from farm_name for existing rows
  try {
    await db.query(`
      UPDATE users SET full_name = farm_name
      WHERE full_name IS NULL AND farm_name IS NOT NULL
    `);
  } catch (err) {
    console.warn('Users table backfill full_name:', err.message);
  }
}

module.exports = { runUsersTableMigration };
