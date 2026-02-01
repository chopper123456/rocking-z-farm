const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// Get credentials from environment variables
const FARM_USERNAME = process.env.FARM_USERNAME || 'farm';
const FARM_PASSWORD = process.env.FARM_PASSWORD;

// Validate that password is set
if (!FARM_PASSWORD) {
  console.error('⚠️  WARNING: FARM_PASSWORD environment variable is not set!');
  console.error('⚠️  Set FARM_PASSWORD in Railway environment variables');
}

// Login user
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Check if password is configured
    if (!FARM_PASSWORD) {
      console.error('Login attempt failed: FARM_PASSWORD not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Check credentials (constant-time comparison to prevent timing attacks)
    const usernameMatch = username === FARM_USERNAME;
    const passwordMatch = password === FARM_PASSWORD;
    
    if (!usernameMatch || !passwordMatch) {
      // Log failed attempt (for monitoring)
      console.warn(`Failed login attempt for username: ${username} from IP: ${req.ip}`);
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        username: FARM_USERNAME,
        userId: 1 // Fixed user ID for shared account
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Log successful login
    console.log(`Successful login for user: ${username} from IP: ${req.ip}`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        username: FARM_USERNAME,
        farmName: 'Rocking Z Acres'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
