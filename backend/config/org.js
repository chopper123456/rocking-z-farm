/**
 * Organization (farm) user ID. All shared farm data (fields, equipment, grain, etc.)
 * is stored under this user_id so every authenticated user sees the same data.
 * The first admin created in migration gets id=1; existing data already has user_id=1.
 */
const ORG_USER_ID = parseInt(process.env.ORG_USER_ID, 10) || 1;

module.exports = { ORG_USER_ID };
