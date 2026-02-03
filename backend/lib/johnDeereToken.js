/**
 * Get a valid John Deere access token, refreshing if expired.
 * Use this instead of reading access_token directly from john_deere_tokens.
 * Returns { accessToken } or { error }.
 */

const axios = require('axios');
const JD_TOKEN_URL = 'https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/token';

// Consider token expired this many ms before expires_at (e.g. 5 min buffer)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

async function getValidJohnDeereAccessToken(db, orgUserId) {
  const row = await db.query(
    'SELECT access_token, refresh_token, expires_at FROM john_deere_tokens WHERE user_id = $1',
    [orgUserId]
  );
  if (row.rows.length === 0) {
    return { error: 'John Deere not connected' };
  }

  const { access_token, refresh_token, expires_at } = row.rows[0];
  const expiresAt = expires_at ? new Date(expires_at) : null;
  const now = new Date();
  // Refresh if: no expiry, or expired (or within 5 min of expiry), or expiry is in the past
  const isExpired = !expiresAt || expiresAt.getTime() - REFRESH_BUFFER_MS <= now.getTime();
  const needsRefresh = isExpired;

  if (!needsRefresh) {
    return { accessToken: access_token };
  }

  if (!refresh_token) {
    return { error: 'John Deere token expired. Please reconnect in John Deere settings.' };
  }

  try {
    const tokenResponse = await axios.post(
      JD_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.JOHN_DEERE_CLIENT_ID}:${process.env.JOHN_DEERE_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
      }
    );
    const { access_token: newAccess, refresh_token: newRefresh, expires_in } = tokenResponse.data;
    const newExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);
    await db.query(
      `UPDATE john_deere_tokens SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4`,
      [newAccess, newRefresh || refresh_token, newExpiresAt, orgUserId]
    );
    return { accessToken: newAccess };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error('John Deere token refresh failed:', status, data || err.message);
    if (status === 400 || status === 401) {
      await db.query('DELETE FROM john_deere_tokens WHERE user_id = $1', [orgUserId]);
      return { error: 'John Deere session expired. Please reconnect in John Deere settings.' };
    }
    return { error: data?.error_description || data?.error || 'Failed to refresh John Deere token.' };
  }
}

/** Clear stored John Deere tokens for org (e.g. after 401 expired from JD API). */
async function clearJohnDeereTokens(db, orgUserId) {
  await db.query('DELETE FROM john_deere_tokens WHERE user_id = $1', [orgUserId]);
}

module.exports = { getValidJohnDeereAccessToken, clearJohnDeereTokens };
