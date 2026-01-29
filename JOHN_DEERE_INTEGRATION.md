# John Deere Operations Center Integration Roadmap

## Overview

This document outlines the plan for integrating John Deere Operations Center API with your Rocking Z Farm Management System.

## Prerequisites

1. **John Deere Developer Account**
   - Sign up at: https://developer.deere.com/
   - Create an application
   - Get API credentials (Client ID and Client Secret)

2. **Understanding OAuth 2.0**
   - John Deere uses OAuth 2.0 for authentication
   - You'll need to implement the OAuth flow

3. **API Documentation**
   - Review: https://developer.deere.com/documentation

## Integration Phases

### Phase 1: OAuth Setup (Week 1-2)

**Backend Tasks:**
1. Install OAuth library:
   ```bash
   cd backend
   npm install passport passport-oauth2
   ```

2. Create OAuth routes (`backend/routes/johnDeere.js`):
   - `/api/john-deere/auth` - Initiate OAuth flow
   - `/api/john-deere/callback` - Handle OAuth callback
   - `/api/john-deere/disconnect` - Revoke access

3. Store OAuth tokens in database:
   ```sql
   CREATE TABLE john_deere_tokens (
     user_id INTEGER REFERENCES users(id),
     access_token TEXT,
     refresh_token TEXT,
     expires_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

**Frontend Tasks:**
1. Add "Connect John Deere" button to Dashboard
2. Create OAuth redirect handling
3. Show connection status

### Phase 2: Data Fetching (Week 3-4)

**Key John Deere API Endpoints:**

1. **Organizations** - Get user's organization info
   ```
   GET /platform/organizations
   ```

2. **Fields** - Get field boundaries and info
   ```
   GET /platform/organizations/{orgId}/fields
   ```

3. **Equipment** - Get equipment data
   ```
   GET /platform/organizations/{orgId}/machines
   ```

4. **Operations Data** - Get planting, harvest, application data
   ```
   GET /platform/organizations/{orgId}/operations
   ```

**Implementation:**

Create sync service (`backend/services/johnDeereSync.js`):
```javascript
const syncFieldData = async (userId, accessToken) => {
  // 1. Fetch fields from John Deere
  // 2. Match with existing fields in database
  // 3. Create new fields if needed
  // 4. Store raw data in john_deere_data table
  // 5. Update relevant tables (fields, equipment, etc.)
};
```

### Phase 3: Field Mapping (Week 5)

**Challenge:** Match John Deere fields with your existing fields

**Solution:**
1. Create mapping UI where user can:
   - See John Deere fields
   - See their existing fields
   - Match them together

2. Store mappings in database:
   ```sql
   CREATE TABLE field_mappings (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     local_field_name VARCHAR(100),
     jd_field_id VARCHAR(100),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

### Phase 4: Automated Sync (Week 6-7)

**Backend Tasks:**
1. Create cron job for periodic syncing:
   ```javascript
   const cron = require('node-cron');
   
   // Sync every 6 hours
   cron.schedule('0 */6 * * *', async () => {
     await syncAllUsersData();
   });
   ```

2. Add webhook endpoints for real-time updates:
   ```javascript
   POST /api/john-deere/webhooks/field-update
   POST /api/john-deere/webhooks/operation-complete
   ```

**Frontend Tasks:**
1. Add "Sync Now" button
2. Show last sync time
3. Display sync status/progress

### Phase 5: Data Display (Week 8)

**New Features:**
1. **Field History Tab**
   - Show John Deere operation history
   - Display yield maps
   - Show as-planted/as-applied data

2. **Equipment Integration**
   - Import equipment from John Deere
   - Show telemetry data
   - Display maintenance alerts

3. **Analytics Dashboard**
   - Combine your data with John Deere data
   - Show trends over time
   - Compare fields/years

## Database Schema Updates

```sql
-- Enhance john_deere_data table
ALTER TABLE john_deere_data ADD COLUMN jd_field_id VARCHAR(100);
ALTER TABLE john_deere_data ADD COLUMN operation_type VARCHAR(50);
ALTER TABLE john_deere_data ADD COLUMN season VARCHAR(20);

-- Add indexes
CREATE INDEX idx_jd_data_field ON john_deere_data(jd_field_id);
CREATE INDEX idx_jd_data_type ON john_deere_data(data_type);
```

## Sample API Implementation

```javascript
// backend/routes/johnDeere.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth');

// Initiate OAuth flow
router.get('/auth', authMiddleware, (req, res) => {
  const authUrl = `https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/authorize?` +
    `client_id=${process.env.JOHN_DEERE_CLIENT_ID}` +
    `&response_type=code` +
    `&scope=ag1 ag2 ag3` +
    `&redirect_uri=${process.env.JOHN_DEERE_CALLBACK_URL}` +
    `&state=${req.user.userId}`;
  
  res.redirect(authUrl);
});

// Handle OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const userId = state;
  
  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/token',
      {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.JOHN_DEERE_CALLBACK_URL
      },
      {
        auth: {
          username: process.env.JOHN_DEERE_CLIENT_ID,
          password: process.env.JOHN_DEERE_CLIENT_SECRET
        }
      }
    );
    
    // Store tokens in database
    await db.query(
      `INSERT INTO john_deere_tokens (user_id, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
      [userId, tokenResponse.data.access_token, tokenResponse.data.refresh_token]
    );
    
    res.redirect('/dashboard?jd_connected=true');
  } catch (error) {
    console.error('OAuth error:', error);
    res.redirect('/dashboard?jd_error=true');
  }
});

// Sync field data
router.post('/sync/fields', authMiddleware, async (req, res) => {
  try {
    // Get user's access token
    const tokenResult = await db.query(
      'SELECT access_token FROM john_deere_tokens WHERE user_id = $1',
      [req.user.userId]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'John Deere not connected' });
    }
    
    const accessToken = tokenResult.rows[0].access_token;
    
    // Fetch organizations
    const orgsResponse = await axios.get(
      'https://sandboxapi.deere.com/platform/organizations',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.deere.axiom.v3+json'
        }
      }
    );
    
    const orgId = orgsResponse.data.values[0].id;
    
    // Fetch fields
    const fieldsResponse = await axios.get(
      `https://sandboxapi.deere.com/platform/organizations/${orgId}/fields`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.deere.axiom.v3+json'
        }
      }
    );
    
    // Store field data
    for (const field of fieldsResponse.data.values) {
      await db.query(
        `INSERT INTO john_deere_data (user_id, data_type, field_name, raw_data, sync_date)
         VALUES ($1, $2, $3, $4, NOW())`,
        [req.user.userId, 'field', field.name, JSON.stringify(field)]
      );
    }
    
    res.json({ 
      message: 'Fields synced successfully',
      count: fieldsResponse.data.values.length 
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

module.exports = router;
```

## Environment Variables to Add

```env
# John Deere API Configuration
JOHN_DEERE_CLIENT_ID=your_client_id_here
JOHN_DEERE_CLIENT_SECRET=your_client_secret_here
JOHN_DEERE_CALLBACK_URL=http://localhost:5000/api/john-deere/callback
JOHN_DEERE_API_URL=https://sandboxapi.deere.com  # Use production URL when ready
```

## Testing Strategy

1. **Use John Deere Sandbox** (sandboxapi.deere.com) for development
2. **Test with sample data** before connecting real equipment
3. **Handle token expiration** gracefully
4. **Implement retry logic** for failed API calls
5. **Log all sync operations** for debugging

## Estimated Timeline

- **Phase 1 (OAuth):** 1-2 weeks
- **Phase 2 (Data Fetching):** 1-2 weeks
- **Phase 3 (Field Mapping):** 1 week
- **Phase 4 (Automated Sync):** 1-2 weeks
- **Phase 5 (Data Display):** 1 week

**Total:** 5-8 weeks for full integration

## Resources

- [John Deere Developer Portal](https://developer.deere.com/)
- [API Documentation](https://developer.deere.com/documentation)
- [OAuth Guide](https://developer.deere.com/documentation/oauth)
- [Sample Code](https://github.com/JohnDeere)

## Next Steps

Once your web app is running smoothly:
1. Create John Deere developer account
2. Set up test credentials
3. Implement OAuth flow (Phase 1)
4. Test with sandbox API
5. Gradually add data syncing features

---

**Note:** This is a comprehensive roadmap. Start with getting the basic web app working first, then tackle John Deere integration phase by phase.
