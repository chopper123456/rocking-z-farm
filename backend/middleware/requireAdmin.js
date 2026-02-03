/**
 * Require Admin role. Use after authMiddleware.
 * Returns 403 if the authenticated user is not an admin.
 */
function requireAdmin(req, res, next) {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}

module.exports = requireAdmin;
