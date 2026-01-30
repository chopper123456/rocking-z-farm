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

const addApprovalSystem = async () => {
  try {
    console.log('Adding approval system...');

    // Add approved and is_admin columns
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
    `);
    console.log('✓ Added approval columns');

    // Make your account admin and approved
    await pool.query(`
      UPDATE users 
      SET approved = true, is_admin = true 
      WHERE email = 'cademcneil99@gmail.com';
    `);
    console.log('✓ Set cademcneil99@gmail.com as admin');

    console.log('\n✓ Approval system added!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error);
    await pool.end();
    process.exit(1);
  }
};

addApprovalSystem();
