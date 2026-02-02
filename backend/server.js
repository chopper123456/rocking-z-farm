require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// Fail fast if JWT_SECRET is missing in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Set it in your environment (e.g. Railway).');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - Railway uses proxy
app.set('trust proxy', 1);

// Rate limiting - prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many login attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
// CORS - only allow requests from your domains
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://rocking-z-farm.vercel.app',
      'https://rocking-z-farm-44gx2tbmx-rocking-z-acres.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173'
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin ends with vercel.app (for preview deployments)
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Compression - reduce response sizes
app.use(compression());

// Request size limits - prevent large payload attacks
app.use(express.json({ limit: '10mb' })); // Max 10MB JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to auth routes
app.use('/api/auth/login', loginLimiter);

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/john-deere', require('./routes/johnDeere'));
app.use('/api/livestock', require('./routes/livestock'));
app.use('/api/fields', require('./routes/fields'));
app.use('/api/field-years', require('./routes/fieldYears'));
app.use('/api/field-reports', require('./routes/fieldReports'));
app.use('/api/scouting-reports', require('./routes/scoutingReports'));
app.use('/api/yield-maps', require('./routes/yieldMaps'));
app.use('/api/field-operations', require('./routes/fieldOperations'));
app.use('/api/equipment', require('./routes/equipmentMaintenance')); // nested :assetId/maintenance, schedule, parts, fuel, operators
app.use('/api/equipment', require('./routes/equipment')); // list, get one, create, update, delete
app.use('/api/equipment-jd', require('./routes/equipmentJDSync'));
app.use('/api/grain', require('./routes/grain'));
app.use('/api/inventory', require('./routes/inventory'));

// Health check endpoint (no rate limiting)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Rocking Z Farm API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Don't expose error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({ 
    error: isDev ? err.message : 'Something went wrong!',
    ...(isDev && { stack: err.stack })
  });
});

// Run equipment migration on startup (creates tables if missing - safe for Railway)
const db = require('./config/database');
const { runEquipmentMigration } = require('./lib/equipmentMigration');

async function start() {
  try {
    await runEquipmentMigration(db);
    console.log('✓ Equipment tables ready');
  } catch (err) {
    console.error('Equipment migration failed:', err.message);
    // Still start server so Fields and other modules work
  }
  app.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════╗
  ║   🌾 Rocking Z Farm API Server Running 🌾   ║
  ╠═══════════════════════════════════════════════╣
  ║   Port: ${PORT}                                ║
  ║   Environment: ${process.env.NODE_ENV || 'production'}    ║
  ║   CORS: Restricted to Vercel domains         ║
  ║   Rate Limiting: Enabled                      ║
  ║   Compression: Enabled                        ║
  ╚═══════════════════════════════════════════════╝
  `);
  });
}

start();

module.exports = app;
