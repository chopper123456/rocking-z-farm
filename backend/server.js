require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 5000;

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
app.use('/api/field-reports', require('./routes/fieldReports'));
app.use('/api/equipment', require('./routes/equipment'));
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

// Start server
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

module.exports = app;
