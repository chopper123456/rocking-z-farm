const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const db = require('../config/database');

// John Deere API URLs
const JD_AUTH_URL = 'https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/authorize';
const JD_TOKEN_URL = 'https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/token';
const JD_API_URL = 'https://sandboxapi.deere.com/platform';

// Initiate OAuth flow - Connect to John Deere
router.get('/connect', async (req, res) => {
  try {
    // Get token from query string or header
    const token = req.query.token || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // Verify and decode token
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded JWT:', decoded);
    const userId = decoded.userId;
    console.log('User ID from token:', userId);
    
    if (!userId) {
      console.error('No userId in JWT token');
      return res.status(401).json({ error: 'Invalid token - no userId' });
    }
    
    const authUrl = `${JD_AUTH_URL}?` +
      `client_id=${process.env.JOHN_DEERE_CLIENT_ID}` +
      `&response_type=code` +
      `&scope=ag1 ag2 ag3 eq1 eq2 org1 org2 files` +
      `&redirect_uri=${encodeURIComponent(process.env.JOHN_DEERE_CALLBACK_URL)}` +
      `&state=${userId}`;
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('Connect error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// OAuth callback - Receive authorization code
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  console.log('OAuth callback - State:', state, 'Code:', code ? 'present' : 'missing');
  
  if (error) {
    console.error('OAuth error from JD:', error);
    return res.redirect('https://rocking-z-farm.vercel.app?jd_error=denied');
  }
  
  if (!code) {
    console.error('No code in callback');
    return res.redirect('https://rocking-z-farm.vercel.app?jd_error=no_code');
  }
  
  // State should contain userId, but if it's missing, we can't continue
  const userId = state && state !== 'undefined' ? parseInt(state) : null;
  
  if (!userId) {
    console.error('Invalid or missing userId in state:', state);
    return res.redirect('https://rocking-z-farm.vercel.app?jd_error=invalid_state');
  }
  
  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      JD_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.JOHN_DEERE_CALLBACK_URL
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(
            `${process.env.JOHN_DEERE_CLIENT_ID}:${process.env.JOHN_DEERE_CLIENT_SECRET}`
          ).toString('base64')}`
        }
      }
    );
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    
    await db.query(`
      INSERT INTO john_deere_tokens (user_id, access_token, refresh_token, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        access_token = $2,
        refresh_token = $3,
        expires_at = $4,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, access_token, refresh_token, expiresAt]);
    
    console.log('Successfully stored tokens for user:', userId);
    
    // Redirect back to frontend with success
    res.redirect('https://rocking-z-farm.vercel.app?jd_connected=true');
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.redirect('https://rocking-z-farm.vercel.app?jd_error=auth_failed');
  }
});

// Check connection status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT expires_at FROM john_deere_tokens WHERE user_id = $1',
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ connected: false });
    }
    
    const expiresAt = new Date(result.rows[0].expires_at);
    const isExpired = expiresAt < new Date();
    
    res.json({ 
      connected: !isExpired,
      expiresAt: expiresAt 
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Sync fields from John Deere
router.post('/sync/fields', authMiddleware, async (req, res) => {
  try {
    // Get access token
    const tokenResult = await db.query(
      'SELECT access_token FROM john_deere_tokens WHERE user_id = $1',
      [req.user.userId]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'John Deere not connected' });
    }
    
    const accessToken = tokenResult.rows[0].access_token;
    
    // Get organizations
    const orgsResponse = await axios.get(`${JD_API_URL}/organizations`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.deere.axiom.v3+json'
      }
    });
    
    if (!orgsResponse.data.values || orgsResponse.data.values.length === 0) {
      return res.json({ 
        message: 'No organizations found',
        fieldsAdded: 0 
      });
    }
    
    const orgId = orgsResponse.data.values[0].id;
    let fieldsAdded = 0;
    
    // Get fields for the organization
    const fieldsResponse = await axios.get(
      `${JD_API_URL}/organizations/${orgId}/fields`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.deere.axiom.v3+json'
        }
      }
    );
    
    // Import fields into database
    if (fieldsResponse.data.values) {
      for (const field of fieldsResponse.data.values) {
        try {
          // Check if field already exists
          const existing = await db.query(
            'SELECT id FROM fields WHERE field_name = $1 AND user_id = $2',
            [field.name, req.user.userId]
          );
          
          if (existing.rows.length === 0) {
            // Add new field
            await db.query(`
              INSERT INTO fields (user_id, field_name, acreage, notes)
              VALUES ($1, $2, $3, $4)
            `, [
              req.user.userId,
              field.name,
              field.area?.value || null,
              `Imported from John Deere on ${new Date().toLocaleDateString()}`
            ]);
            fieldsAdded++;
          }
          
          // Store raw John Deere data
          await db.query(`
            INSERT INTO john_deere_data (user_id, data_type, field_name, sync_date, raw_data)
            VALUES ($1, $2, $3, NOW(), $4)
          `, [req.user.userId, 'field', field.name, JSON.stringify(field)]);
          
        } catch (fieldError) {
          console.error('Error importing field:', field.name, fieldError);
        }
      }
    }
    
    res.json({ 
      message: `Successfully synced ${fieldsAdded} new fields from John Deere`,
      fieldsAdded: fieldsAdded,
      totalFields: fieldsResponse.data.values?.length || 0
    });
    
  } catch (error) {
    console.error('Sync error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to sync fields',
      details: error.response?.data?.message || error.message
    });
  }
});

// Disconnect John Deere
router.delete('/disconnect', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM john_deere_tokens WHERE user_id = $1',
      [req.user.userId]
    );
    
    res.json({ message: 'John Deere disconnected successfully' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

module.exports = router;
