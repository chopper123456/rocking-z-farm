const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { ORG_USER_ID } = require('../config/org');
const db = require('../config/database');
const { getValidJohnDeereAccessToken } = require('../lib/johnDeereToken');

// John Deere API URLs
const JD_AUTH_URL = 'https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/authorize';
const JD_TOKEN_URL = 'https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/token';
const JD_API_URL = 'https://sandboxapi.deere.com/platform';

// Initiate OAuth flow - Connect to John Deere (admin only; token stored for org)
router.get('/connect', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const token = req.query.token || req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }
    require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    const authUrl = `${JD_AUTH_URL}?` +
      `client_id=${process.env.JOHN_DEERE_CLIENT_ID}` +
      `&response_type=code` +
      `&scope=ag1 ag2 ag3 eq1 eq2 org1 org2 files` +
      `&redirect_uri=${encodeURIComponent(process.env.JOHN_DEERE_CALLBACK_URL)}` +
      `&state=${ORG_USER_ID}`;
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
  
  const orgId = state && state !== 'undefined' ? parseInt(state, 10) : null;
  if (!orgId) {
    console.error('Invalid or missing state:', state);
    return res.redirect('https://rocking-z-farm.vercel.app?jd_error=invalid_state');
  }

  try {
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
    `, [orgId, access_token, refresh_token, expiresAt]);
    console.log('Successfully stored John Deere tokens for org:', orgId);
    
    // Redirect back to frontend with success
    res.redirect('https://rocking-z-farm.vercel.app?jd_connected=true');
  } catch (error) {
    const data = error.response?.data || {};
    const errCode = data.error;
    console.error('OAuth error:', data.error_description || data.error || error.message);
    if (errCode === 'invalid_grant') {
      return res.redirect('https://rocking-z-farm.vercel.app?jd_error=code_expired');
    }
    res.redirect('https://rocking-z-farm.vercel.app?jd_error=auth_failed');
  }
});

// Check connection status (uses refresh so "connected" reflects valid token)
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const token = await getValidJohnDeereAccessToken(db, ORG_USER_ID);
    if (token.error) {
      return res.json({ connected: false, error: token.error });
    }
    const result = await db.query(
      'SELECT expires_at FROM john_deere_tokens WHERE user_id = $1',
      [ORG_USER_ID]
    );
    const expiresAt = result.rows.length ? new Date(result.rows[0].expires_at) : null;
    res.json({ connected: true, expiresAt });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Get connections URL
router.get('/connections-url', authMiddleware, async (req, res) => {
  try {
    const token = await getValidJohnDeereAccessToken(db, ORG_USER_ID);
    if (token.error) {
      return res.status(400).json({ error: token.error });
    }
    const accessToken = token.accessToken;
    
    // Get organizations to find connections link
    const orgsResponse = await axios.get(`${JD_API_URL}/organizations`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.deere.axiom.v3+json'
      }
    });
    
    console.log('Organizations response for connections URL:', JSON.stringify(orgsResponse.data, null, 2));
    
    const connectionsLink = orgsResponse.data.links?.find(link => link.rel === 'connections');
    
    if (connectionsLink) {
      return res.json({
        hasConnectionsLink: true,
        connectionsUrl: connectionsLink.uri,
        message: 'You need to visit this URL to enable organization access'
      });
    }
    
    return res.json({
      hasConnectionsLink: false,
      organizations: orgsResponse.data.values?.length || 0,
      message: 'Organization access already enabled or no organizations found'
    });
    
  } catch (error) {
    console.error('Connections URL error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to get connections URL',
      details: error.response?.data || error.message
    });
  }
});

// Sync fields from John Deere (admin only)
router.post('/sync/fields', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const token = await getValidJohnDeereAccessToken(db, ORG_USER_ID);
    if (token.error) {
      return res.status(400).json({ error: token.error });
    }
    const accessToken = token.accessToken;
    
    // Get organizations - THIS is where we check for connections link
    console.log('Fetching organizations to check for connections link...');
    const orgsResponse = await axios.get(`${JD_API_URL}/organizations`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.deere.axiom.v3+json'
      }
    });
    
    console.log('Organizations API response:', JSON.stringify(orgsResponse.data, null, 2));
    
    // Find an organization that doesn't have a connections link (meaning it's enabled)
    let enabledOrg = null;
    const orgsNeedingAccess = [];
    
    if (orgsResponse.data.values && orgsResponse.data.values.length > 0) {
      for (const org of orgsResponse.data.values) {
        const connectionsLink = org.links?.find(link => link.rel === 'connections');
        
        if (connectionsLink) {
          // This org needs access enabled
          orgsNeedingAccess.push({
            name: org.name,
            connectionsUrl: connectionsLink.uri
          });
        } else {
          // This org is enabled! Use it
          enabledOrg = org;
          break;
        }
      }
    }
    
    // If we found orgs that need access but no enabled org, show the connections URLs
    if (!enabledOrg && orgsNeedingAccess.length > 0) {
      console.log('Organizations need access enabled:', orgsNeedingAccess);
      return res.status(403).json({
        error: 'Organization access not enabled',
        connectionsUrl: orgsNeedingAccess[0].connectionsUrl,
        message: `You need to enable organization access for: ${orgsNeedingAccess.map(o => o.name).join(', ')}`,
        organizations: orgsNeedingAccess
      });
    }
    
    // If we have no organizations at all
    if (!enabledOrg) {
      return res.json({ 
        message: 'No organizations found or accessible',
        fieldsAdded: 0 
      });
    }
    
    const orgId = enabledOrg.id;
    console.log('Using enabled organization:', enabledOrg.name, 'ID:', orgId);
    let fieldsAdded = 0;
    
    // Get fields for the organization (with pagination)
    let allFields = [];
    let nextPageUrl = `${JD_API_URL}/organizations/${orgId}/fields`;
    
    while (nextPageUrl) {
      console.log('Fetching fields from:', nextPageUrl);
      const fieldsResponse = await axios.get(nextPageUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.deere.axiom.v3+json'
        }
      });
      
      if (fieldsResponse.data.values) {
        allFields = allFields.concat(fieldsResponse.data.values);
        console.log(`Fetched ${fieldsResponse.data.values.length} fields, total so far: ${allFields.length}`);
      }
      
      // Check for next page
      const nextPageLink = fieldsResponse.data.links?.find(link => link.rel === 'nextPage');
      nextPageUrl = nextPageLink?.uri || null;
    }
    
    console.log(`Total fields found: ${allFields.length}`);
    
    // Import fields into database
    if (allFields.length > 0) {
      for (const field of allFields) {
        try {
          // Check if field already exists
          const existing = await db.query(
            'SELECT id FROM fields WHERE field_name = $1 AND user_id = $2',
            [field.name, ORG_USER_ID]
          );
          
          if (existing.rows.length === 0) {
            // Add new field
            await db.query(`
              INSERT INTO fields (user_id, field_name, acreage, notes)
              VALUES ($1, $2, $3, $4)
            `, [
              userId,
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
          `, [ORG_USER_ID, 'field', field.name, JSON.stringify(field)]);
          
        } catch (fieldError) {
          console.error('Error importing field:', field.name, fieldError);
        }
      }
    }
    
    res.json({ 
      message: `Successfully synced ${fieldsAdded} new fields from John Deere`,
      fieldsAdded: fieldsAdded,
      totalFields: allFields.length
    });
    
  } catch (error) {
    console.error('Sync error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to sync fields',
      details: error.response?.data?.message || error.message
    });
  }
});

// Disconnect John Deere (admin only)
router.delete('/disconnect', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM john_deere_tokens WHERE user_id = $1',
      [ORG_USER_ID]
    );
    
    res.json({ message: 'John Deere disconnected successfully' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

module.exports = router;
