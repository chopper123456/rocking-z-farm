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

const createTable = async () => {
  try {
    console.log('Creating john_deere_tokens table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS john_deere_tokens (
        user_id INTEGER PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✓ john_deere_tokens table created');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error);
    await pool.end();
    process.exit(1);
  }
};

createTable();
