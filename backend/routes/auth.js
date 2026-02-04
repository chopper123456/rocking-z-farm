const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Helper to log activity
const logActivity = async (userId, action, details = {}, ipAddress = null) => {
  try {
    await db.query(
      'INSERT INTO activity_log (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [userId, action, JSON.stringify(details), ipAddress]
    );
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// Login
router.post('/login', [
  body('username').trim().notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Find user
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      console.warn(`Failed login attempt for username: ${username} from IP: ${req.ip}`);
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if account is active
    if (!user.is_active) {
      console.warn(`Login attempt for disabled account: ${username}`);
      return res.status(403).json({ error: 'Account is disabled. Contact administrator.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      console.warn(`Failed login attempt for username: ${username} from IP: ${req.ip}`);
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Log activity
    await logActivity(user.id, 'login', { username: user.username }, req.ip);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        isAdmin: user.is_admin
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d', algorithm: 'HS256' }
    );

    console.log(`Successful login for user: ${username} (${user.is_admin ? 'ADMIN' : 'USER'}) from IP: ${req.ip}`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name || user.farm_name,
        farmName: user.farm_name,
        isAdmin: user.is_admin,
        role: user.is_admin ? 'admin' : 'team',
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Register new user (admin only); role = 'admin' | 'team'
router.post('/register', authMiddleware, [
  body('username').trim().isLength({ min: 3 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').optional().trim().escape(),
  body('role').optional().isIn(['admin', 'team']),
], async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Only administrators can create new accounts' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, fullName, role } = req.body;
    const isAdmin = role === 'admin';

    const userExists = await db.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, farm_name, full_name, is_admin, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7) RETURNING id, username, email, farm_name, full_name, is_admin`,
      [username, email, passwordHash, 'Rocking Z Acres', fullName || null, isAdmin, req.user.userId]
    );

    const newUser = result.rows[0];

    // Log activity
    await logActivity(req.user.userId, 'create_user', {
      newUserId: newUser.id,
      newUsername: newUser.username
    }, req.ip);

    console.log(`Admin ${req.user.username} created new user: ${username}`);

    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Get all users (admin only)
router.get('/users', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await db.query(`
      SELECT id, username, email, farm_name, full_name, is_admin, is_active, last_login, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Toggle user active status (admin only)
router.patch('/users/:id/toggle-active', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const userId = parseInt(req.params.id);

    // Can't disable yourself
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot disable your own account' });
    }

    const result = await db.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING id, username, is_active',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    await logActivity(req.user.userId, user.is_active ? 'enable_user' : 'disable_user', {
      targetUserId: userId,
      targetUsername: user.username
    }, req.ip);

    res.json({
      message: `User ${user.is_active ? 'enabled' : 'disabled'} successfully`,
      user: user
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({ error: 'Error updating user status' });
  }
});

// Reset user password (admin only)
router.post('/users/:id/reset-password', authMiddleware, [
  body('newPassword').isLength({ min: 8 })
], async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const result = await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING username',
      [passwordHash, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await logActivity(req.user.userId, 'reset_password', {
      targetUserId: userId,
      targetUsername: result.rows[0].username
    }, req.ip);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Error resetting password' });
  }
});

// Get activity log (admin only)
router.get('/activity-log', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);

    const result = await db.query(`
      SELECT al.*, u.username 
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({ error: 'Error fetching activity log' });
  }
});

module.exports = router;
