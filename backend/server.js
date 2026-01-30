require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['https://rocking-z-farm-44gx2tbmx-rocking-z-acres.vercel.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/livestock', require('./routes/livestock'));
app.use('/api/fields', require('./routes/fields'));
app.use('/api/field-reports', require('./routes/fieldReports'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/grain', require('./routes/grain'));
app.use('/api/inventory', require('./routes/inventory'));

// Health check endpoint
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
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║   🌾 Rocking Z Farm API Server Running 🌾   ║
  ╠═══════════════════════════════════════════════╣
  ║   Port: ${PORT}                                ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}              ║
  ║   Database: ${process.env.DB_NAME}          ║
  ╚═══════════════════════════════════════════════╝
  `);
});

module.exports = app;
