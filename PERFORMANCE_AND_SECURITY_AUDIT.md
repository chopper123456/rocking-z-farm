# Deep Performance & Security Audit — Rocking Z Farm

**Date:** February 3, 2026  
**Scope:** Backend (Express, PostgreSQL), Frontend (React, Vite), PWA, auth, file uploads, API, dependencies.

---

## Executive summary

- **Security:** Strong baseline (auth, rate limiting, CORS, parameterized SQL, file filters). This audit applied additional hardening: JWT algorithm pinning, Helmet security headers, yield map filename sanitization and file filter, and documented remaining recommendations.
- **Performance:** DB pooling, compression, and frontend code-splitting are in place. Optional improvements (indexes, lazy routes) are documented.
- **Dependencies:** Backend has 2 high (tar via node-pre-gyp); frontend has 2 moderate (esbuild via Vite dev server). Mitigations and upgrade paths are noted below.

---

## 1. Security

### 1.1 What’s already solid

| Area | Status |
|------|--------|
| **Authentication** | JWT with Bearer token; auth middleware on protected routes; **JWT algorithm pinned to HS256** (this audit). |
| **Passwords** | bcrypt hashing; min 8 chars; validation on register/reset. |
| **Rate limiting** | Login: 5/15 min; API: 100/15 min. |
| **CORS** | Restricted to Vercel domains + localhost; credentials allowed. |
| **Request size** | JSON/urlencoded limited to 10MB. |
| **SQL** | Parameterized queries (`$1`, `$2`) everywhere; no string concatenation. |
| **File uploads** | Multer: 10MB (field reports, scouting, equipment); 50MB (yield maps). fileFilter on field reports (PDF + images), scouting (images), equipment (PDF + images), **yield maps (PDF + images + ZIP)** (this audit). |
| **Content-Disposition** | Filenames sanitized (strip `\r\n"`, max 200 chars) on field reports download; **yield map download** (this audit). |
| **Secrets** | `.env` in `.gitignore`; JWT and JD credentials from env. |
| **Error details** | Stack traces only in development. |
| **Admin actions** | Register, toggle user, reset password, activity log gated by `isAdmin`. |
| **XSS** | No `dangerouslySetInnerHTML`, `eval`, or `innerHTML` in frontend. |
| **Security headers** | **Helmet** added (this audit); CSP disabled to avoid breaking SPA/API; X-Content-Type-Options, X-Frame-Options, etc. enabled. |

### 1.2 Fixes applied in this audit

1. **JWT algorithm** — `jwt.sign` uses `algorithm: 'HS256'`; `jwt.verify` uses `algorithms: ['HS256']` to prevent algorithm confusion.
2. **Helmet** — `helmet()` middleware added; CSP disabled; other headers (X-DNS-Prefetch-Control, X-Frame-Options, X-Content-Type-Options, etc.) enabled.
3. **Yield map download** — Content-Disposition filename sanitized (strip `\r\n"`, max 200 chars).
4. **Yield map upload** — Multer `fileFilter` added: only PDF, image, or ZIP.

### 1.3 Recommendations (your choice)

| Item | Risk | Recommendation |
|------|------|----------------|
| **CORS `*.vercel.app`** | Any Vercel preview can call your API. | For strict control, replace `origin.endsWith('.vercel.app')` with an explicit list or remove. |
| **Token in localStorage** | XSS could steal token. | Keep deps updated; avoid rendering user HTML. Future: consider httpOnly cookies for tokens. |
| **Stored file names** | `req.file.originalname` stored as-is; path traversal in filename is mitigated by not writing to disk. | Optional: sanitize (e.g. basename, strip non-printable) before storing. |
| **Input validation** | Fields, grain, inventory routes accept body without express-validator. | Optional: add validation/sanitization for string length and type on create/update. |
| **ORG_USER_ID** | Defaults to 1 if not set. | Set `ORG_USER_ID` in production if you use multi-tenant or different org ID. |

---

## 2. Performance

### 2.1 What’s in place

| Area | Status |
|------|--------|
| **DB connection pool** | `pg` Pool: max 20, idleTimeout 30s, connectionTimeout 2s. |
| **Compression** | `compression()` middleware on responses. |
| **Frontend bundle** | `manualChunks`: vendor-react, vendor-utils; chunkSizeWarningLimit 600. |
| **Sourcemaps** | Disabled in production (`sourcemap: process.env.NODE_ENV !== 'production'`). |
| **PWA caching** | NetworkFirst for `/api/*`; CacheFirst for images. |
| **Equipment indexes** | Migration creates indexes on equipment_assets (user_id, jd_asset_id), equipment_maintenance (equipment_asset_id). |

### 2.2 Optional improvements

| Item | Suggestion |
|------|------------|
| **DB indexes** | If `fields`, `field_reports`, `field_operations`, or `scouting_reports` grow large, add indexes on `user_id` and (where you filter) `field_name`, `year`. Example: `CREATE INDEX IF NOT EXISTS idx_field_reports_user_field_year ON field_reports(user_id, field_name, year);` |
| **SSL for DB** | If Railway or provider uses SSL, ensure `DATABASE_URL` includes `?sslmode=require` or pool config has `ssl: { rejectUnauthorized: true }`. |
| **Lazy routes** | For very large apps, lazy-load route components: `const FieldsModule = lazy(() => import('./Modules/FieldsModule'));` and wrap in `<Suspense>`. |
| **Heavy lists** | If equipment or field lists grow very large, consider pagination or virtual scrolling (e.g. react-window) on the frontend. |
| **API response size** | Scouting report detail returns photo as base64; for many reports consider separate image URLs or pagination. |

---

## 3. Dependency audit (npm audit)

### Backend

- **High (2):** `tar` (via `@mapbox/node-pre-gyp`) — path overwrite/symlink issues. Not used directly by your code; risk is in native dependency install.  
  **Action:** Run `npm audit fix` if available; otherwise monitor and upgrade `pg` when a fixed transitive release is available.

### Frontend

- **Moderate (2):** `esbuild` (via Vite) — dev server request handling. **Does not affect production build or deployed app.**  
  **Action:** No change required for production. Optional: upgrade Vite when convenient (`npm audit fix --force` may be breaking).

---

## 4. Files changed in this audit

| File | Change |
|------|--------|
| `backend/server.js` | Added Helmet (CSP disabled). |
| `backend/middleware/auth.js` | `jwt.verify(..., { algorithms: ['HS256'] })`. |
| `backend/routes/auth.js` | `jwt.sign(..., { algorithm: 'HS256' })`. |
| `backend/routes/yieldMaps.js` | Content-Disposition filename sanitized; Multer fileFilter (PDF, image, ZIP). |
| `backend/package.json` | Added `helmet` dependency. |

---

## 5. Checklist for deployment

- [ ] `JWT_SECRET` set in Railway (32+ random chars).
- [ ] `DATABASE_URL` (or DB_*) set in Railway.
- [ ] John Deere env vars set where used.
- [ ] Frontend `VITE_API_URL` points to production API if needed.
- [ ] No `.env` or secrets committed; `.gitignore` includes `.env`, `.env.local`, `.env.production`.
- [ ] `ORG_USER_ID` set in production if not using default 1.

---

## 6. Re-running checks

```bash
# Backend
cd backend && npm audit

# Frontend
cd frontend && npm audit
```

For deeper scanning: `npx snyk test` or `npm audit --audit-level=high` in CI.
