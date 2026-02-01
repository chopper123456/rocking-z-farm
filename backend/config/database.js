const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL if available (Railway), otherwise use individual variables (local)
const pool = process.env.DATABASE_URL 
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20, // Maximum 20 connections in pool
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 2000, // Return error if connection takes longer than 2 seconds
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

// Test connection and log pool status
pool.on('connect', () => {
  console.log('✓ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Log pool information on startup
pool.on('acquire', () => {
  const poolStatus = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };
  if (poolStatus.waiting > 0) {
    console.warn('⚠️  Database pool has waiting connections:', poolStatus);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
