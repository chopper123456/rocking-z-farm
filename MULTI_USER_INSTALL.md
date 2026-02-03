# Multi-User System Installation Guide

This guide walks you through upgrading your Rocking Z Farm app from a single shared login to a **multi-user system** with **Admin** and **Team** roles. All existing data (fields, equipment, operations, reports) is preserved.

---

## What You Get

- **Admin**: Full access—create/edit/delete fields and equipment, see all financial data, manage users, sync John Deere, upload soil/tissue samples and yield maps.
- **Team**: View all fields and equipment; add scouting reports (with photos), maintenance records, fuel logs, and notes. **Cannot** delete fields/equipment, see costs/revenue, manage users, or sync John Deere.

---

## Step 1: Back Up Your Database

Before running any migration:

1. In **Railway** (or your hosting dashboard), open your PostgreSQL service.
2. Use **Backups** or **pg_dump** to create a full backup of your database.
3. If you run locally, copy your `.env` file to a safe place (it has `DATABASE_URL` and `JWT_SECRET`).

---

## Step 2: Set Environment Variables

You need these for the migration and for the app:

| Variable | Where to set | Description |
|----------|----------------|-------------|
| `JWT_SECRET` | Railway / `.env` | A long random string (e.g. 32+ characters). **Required** in production. |
| `ADMIN_PASSWORD` | Optional for migration | Password for the first admin account. If not set, default is `ChangeMe123!` — **change it after first login.** |
| `ADMIN_USERNAME` | Optional | Default: `admin` |
| `ADMIN_EMAIL` | Optional | Default: `admin@rockingzacres.com` |
| `ADMIN_FULL_NAME` | Optional | Default: `Farm Owner` |

**How to set on Railway:**

1. Open your backend project → **Variables**.
2. Add or edit:
   - `JWT_SECRET` = (generate a long random string; e.g. use an online generator).
   - `ADMIN_PASSWORD` = (choose a strong password for the first admin).

---

## Step 3: Run the Migration (Backend)

The migration:

- Adds columns to the `users` table if missing (`is_admin`, `is_active`, `last_login`, `full_name`, etc.).
- Creates the `activity_log` table if it doesn’t exist.
- Ensures a first admin user with **id = 1** exists (so all existing field/equipment data tied to `user_id = 1` stays valid).

**Option A – Run locally (recommended first time):**

1. Open a terminal on your computer.
2. Go to the project folder:  
   `cd path\to\rocking-z-farm`
3. Create a `.env` in the project root (or in `backend`) with at least:
   - `DATABASE_URL` = your PostgreSQL connection string (same as Railway).
   - `JWT_SECRET` = same value you use in production.
   - Optionally: `ADMIN_PASSWORD`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_FULL_NAME`.
4. Run the migration:
   ```bash
   node backend/scripts/multiUserMigration.js
   ```
5. You should see messages like:
   - `✓ Users table columns OK`
   - `✓ activity_log OK`
   - `✓ Created first admin (id=1)` or `✓ User id=1 exists; ensured admin and active.`
   - `✓ Multi-user migration complete.`

**Option B – Run on Railway:**

1. In Railway, open your **backend** service.
2. Go to **Settings** → find how to run a one-off command (e.g. “Run command” or use a temporary script).
3. Run:  
   `node scripts/multiUserMigration.js`  
   (from the app’s root; adjust path if your deploy root is `backend`).
4. Ensure `DATABASE_URL`, `JWT_SECRET`, and optionally `ADMIN_PASSWORD` are set in **Variables** before running.

If you already had a `users` table from a previous setup, the migration only adds missing columns and ensures an admin with id = 1. It does **not** delete any existing data.

---

## Step 4: Deploy Backend and Frontend

1. **Backend (Railway)**  
   - Push your code (with the new migration and backend changes) so Railway redeploys.  
   - Confirm `JWT_SECRET` and `ADMIN_PASSWORD` (and any other env vars) are set in Railway Variables.

2. **Frontend (Vercel)**  
   - Push your code so Vercel redeploys the updated React app (new login, header role, admin panel, and role-based hiding).

---

## Step 5: First Login

1. Open your app in the browser (e.g. `https://rocking-z-farm.vercel.app`).
2. You should see the **Login** page (username + password).
3. Log in with:
   - **Username:** `admin` (or the value of `ADMIN_USERNAME` if you set it).
   - **Password:** The value of `ADMIN_PASSWORD` you set, or `ChangeMe123!` if you didn’t set it.
4. **Change the password immediately** if you used the default:
   - Go to **Admin** (or **Employee Management**) in the header menu.
   - Find your admin user and use **Reset Password**.

You should see the dashboard, your name (or “Welcome back, admin”), and an **Admin** badge in the header. All existing fields and equipment should still be there.

---

## Step 6: Create Team Users (Optional)

1. While logged in as **Admin**, open the **Admin** (Employee Management) panel from the header menu.
2. Click **+ Add Employee**.
3. Fill in:
   - **Username** (required)
   - **Email** (required)
   - **Full Name** (optional)
   - **Role:** choose **Team** (or **Admin** for another full-access user).
   - **Password** (required, min 8 characters).
4. Click **Create Employee**.

Team users can log in with their own username and password. They will see the same fields and equipment but will **not** see:

- Delete buttons for fields/equipment  
- Financial data (costs, purchase cost, maintenance/fuel costs in reports)  
- John Deere sync buttons  
- Admin / Employee Management menu  
- Soil/tissue/yield uploads (admin only)

They **can** add scouting reports (with photos), maintenance records, fuel logs (without cost if you hide it), and similar day-to-day data.

---

## Troubleshooting

- **“Token is not valid” or 401 on login**  
  - Ensure `JWT_SECRET` is set **exactly the same** in the environment used by the backend (Railway) and that the backend was restarted after adding it.

- **“Invalid credentials”**  
  - Confirm you’re using the username/password for the admin account (e.g. `admin` / `ADMIN_PASSWORD`).  
  - If you changed the password via Reset Password, use the new one.

- **“Account is disabled”**  
  - An admin must re-enable the user from the Admin panel (toggle status).

- **Existing data missing**  
  - The migration does not remove data. All records with `user_id = 1` stay as-is and are shown to everyone (org-wide). If something is missing, check the backup and that the migration completed without errors.

- **Migration fails with “relation users does not exist”**  
  - Run your original database init script first (e.g. `node backend/scripts/initDatabase.js` if you have one), then run `multiUserMigration.js` again.

---

## Summary Checklist

- [ ] Back up database and `.env`
- [ ] Set `JWT_SECRET` (and optionally `ADMIN_PASSWORD`) in Railway and/or local `.env`
- [ ] Run `node backend/scripts/multiUserMigration.js`
- [ ] Deploy backend and frontend
- [ ] Log in as admin and change default password if needed
- [ ] Create Team users from the Admin panel if desired

After this, your app uses the new multi-user system with Admin and Team roles while keeping all existing fields, equipment, and operations intact.
