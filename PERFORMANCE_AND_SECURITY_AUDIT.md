# Performance & Security Audit — Rocking Z Farm

**Date:** February 2, 2025  
**Scope:** Backend (Express, PostgreSQL), Frontend (React, Vite), auth, file uploads, API, dependencies.

---

## Executive summary

- **Security:** Strong baseline (auth, rate limiting, CORS, parameterized SQL). Several hardening fixes were applied; a few items remain for you to decide (CORS previews, dependency upgrades).
- **Performance:** DB pooling and compression are in place; optional improvements are documented (indexes, production sourcemaps).

---

## 1. Security

### 1.1 What’s already solid

| Area | Status |
|------|--------|
| **Authentication** | JWT with Bearer token; auth middleware on protected routes. |
| **Passwords** | bcrypt hashing; min length and validation on register/reset. |
| **Rate limiting** | Login: 5/15 min; API: 100/15 min. |
| **CORS** | Restricted to Vercel domains + localhost; credentials allowed. |
| **Request size** | JSON/urlencoded limited to 10MB. |
| **SQL** | Parameterized queries (`$1`, `$2`) everywhere; no string concatenation into SQL. |
| **File uploads (equipment)** | Multer: 10MB limit; fileFilter allows only PDF and images. |
| **Secrets** | `.env` in `.gitignore`; JWT and JD credentials from env. |
| **Error details** | Stack traces only in development. |
| **Admin actions** | Register, toggle user, reset password, activity log gated by `isAdmin`. |

### 1.2 Fixes applied in this audit

1. **Activity log DoS** — `GET /api/auth/activity-log?limit=...` now clamps `limit` to 1–500 (default 100). Prevents large queries.
2. **Content-Disposition header injection** — Download endpoints for equipment receipts and field reports now sanitize filenames (strip `\r`, `\n`, `"`; max 200 chars) before setting `Content-Disposition`.
3. **Field reports file type** — Multer for field reports now has a `fileFilter` allowing only PDF and images (aligned with equipment receipts).
4. **JWT_SECRET in production** — Server exits on startup if `NODE_ENV=production` and `JWT_SECRET` is not set.
5. **Production sourcemaps** — Vite build disables sourcemaps in production to avoid exposing full source.

### 1.3 Recommendations (your choice)

| Item | Risk | Recommendation |
|------|------|----------------|
| **CORS `*.vercel.app`** | Any Vercel preview can call your API. | If you need strict control, replace `origin.endsWith('.vercel.app')` with an explicit list of preview URLs or remove it. |
| **Backend: tar / node-pre-gyp** | `npm audit` reports high severity in transitive deps (tar). | Your app doesn’t use tar directly; risk is low. Optional: `npm audit fix` (if it doesn’t break things) or wait for upstream fixes in pg/tooling. |
| **Frontend: esbuild / Vite** | Moderate advisory for dev server. | Affects only `vite` dev server, not production build. Optional: upgrade Vite when convenient (`npm audit fix --force` can be breaking). |
| **Token in localStorage** | XSS could steal token. | Mitigation: keep dependencies updated, avoid rendering user HTML. Future: consider httpOnly cookies for tokens. |
| **Script: ADMIN_PASSWORD fallback** | `migrateToIndividualAccounts.js` has a default password in code. | Don’t run that script in production; or remove the fallback and require `ADMIN_PASSWORD` in env. |

---

## 2. Performance

### 2.1 What’s already in place

| Area | Status |
|------|--------|
| **DB connection pool** | `pg` Pool: max 20, idleTimeout 30s, connectionTimeout 2s. |
| **Compression** | `compression()` middleware for responses. |
| **Equipment indexes** | Migration creates indexes on `equipment_assets` (user_id, jd_asset_id), `equipment_maintenance` (equipment_asset_id). |
| **John Deere sync** | Field operations pagination (nextPage); equipment sync uses parameterized queries. |

### 2.2 Recommendations (optional)

| Item | Suggestion |
|------|------------|
| **Indexes** | If `fields`, `field_operations`, or `field_reports` grow large, add indexes on `user_id` (and `field_name`/`year` where you filter). |
| **Sourcemaps** | Already disabled for production builds; no change needed. |
| **Heavy lists** | If equipment or field lists get very large, consider pagination or virtual scrolling on the frontend. |
| **Frontend bundle** | Current stack is small; if you add heavy libs later, use dynamic imports for rarely used modules. |

---

## 3. Dependency audit (npm audit)

### Backend

- **High:** `tar` (via `@mapbox/node-pre-gyp`) — path sanitization / symlink issues. Not used directly by your code; risk is low. Optional: run `npm audit fix` and test; if nothing breaks, keep it.
- **Action taken:** `npm audit fix` was run; no automatic fix was available for this transitive chain. Documented for awareness.

### Frontend

- **Moderate:** `esbuild` (via Vite) — dev server request handling. Does **not** affect production build or deployed app.
- **Action:** No change required for production. Optional: upgrade Vite when you’re ready (may require testing).

---

## 4. Files changed in this audit

| File | Change |
|------|--------|
| `backend/server.js` | Require `JWT_SECRET` when `NODE_ENV=production`; exit with clear error if missing. |
| `backend/routes/auth.js` | Activity log `limit` clamped to 1–500. |
| `backend/routes/equipmentMaintenance.js` | Sanitize receipt filename in `Content-Disposition`. |
| `backend/routes/fieldReports.js` | Sanitize report filename in `Content-Disposition`; add multer `fileFilter` (PDF + images). |
| `frontend/vite.config.js` | Disable sourcemaps when building for production. |

---

## 5. Checklist for deployment (Railway / Vercel)

- [ ] `JWT_SECRET` set in Railway (and strong; e.g. 32+ random chars).
- [ ] `DATABASE_URL` (or DB_*) set in Railway.
- [ ] John Deere: `JOHN_DEERE_CLIENT_ID`, `JOHN_DEERE_CLIENT_SECRET`, `JOHN_DEERE_CALLBACK_URL` set where used.
- [ ] Frontend: `VITE_API_URL` points to your production API (if different from default).
- [ ] No `.env` or secrets committed; `.gitignore` includes `.env`, `.env.local`, `.env.production`.

---

## 6. Re-running checks later

```bash
# Backend
cd backend && npm audit

# Frontend
cd frontend && npm audit
```

For deeper security scanning you can add: `snyk` or `npm audit --audit-level=high` in CI.
