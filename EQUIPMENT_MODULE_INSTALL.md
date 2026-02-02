# Equipment Module — Installation Guide (Rocking Z Acres)

This guide walks you through adding the full Equipment module to your Rocking Z Acres farm app. **No coding required** — follow the steps in order.

---

## What You’re Installing

- **Equipment list**: Tractors, combines, sprayers, implements
- **Per-equipment tracking**: Make, model, year, serial, hours/miles, purchase, insurance, registration
- **Service history**: Dates, costs, notes, PDF/image receipts
- **Maintenance schedule**: Upcoming alerts by hours or calendar
- **Parts inventory**: Parts per machine
- **Fuel logs**: Gallons and cost per machine
- **Operator assignments**: Who runs which equipment
- **John Deere**: Sync equipment from JD Operations Center, sync hours, see which equipment was used on which fields
- **Reports**: Maintenance costs, fuel costs, utilization, depreciation

---

## Step 1: Run the Database Migration

The Equipment module needs new tables in your PostgreSQL database. You only need to do this **once**.

### Option A: You use Railway (or another host) and have a “run script” or terminal

1. Open your **backend** project (the one that has `server.js` and a `scripts` folder).
2. In the project root, create a `.env` file if you don’t have one, and put your database connection in it. For Railway, this is usually a single URL, for example:
   ```env
   DATABASE_URL=postgresql://user:password@host:port/database
   ```
   (Railway gives you this in the “Variables” tab for your PostgreSQL service.)
3. Open a terminal in the **backend** folder.
4. Run:
   ```bash
   node scripts/equipmentModuleMigration.js
   ```
5. You should see lines like:
   - `✓ equipment_assets`
   - `✓ equipment_maintenance`
   - … and similar for the other tables.
6. If you see “Migration error” or a message about “relation already exists”, that usually means the tables are already there — you can continue to Step 2.

### Option B: You only have access to a database tool (e.g. pgAdmin, TablePlus)

1. Connect to your PostgreSQL database.
2. Run the SQL that creates the Equipment tables. You can get this from the file `backend/scripts/equipmentModuleMigration.js` (it’s the parts inside `pool.query(\`...\`)`).  
   If you prefer, we can provide a single “run this SQL” file — ask your developer or use the script above from a machine that can run Node.

---

## Step 2: Deploy the Backend

1. Make sure all new backend files are in your project:
   - `backend/routes/equipment.js` (updated for full equipment assets)
   - `backend/routes/equipmentMaintenance.js` (maintenance, schedule, parts, fuel, operators)
   - `backend/routes/equipmentJDSync.js` (John Deere sync and reports)
   - `backend/scripts/equipmentModuleMigration.js` (already run in Step 1)
2. Push your code to Git (e.g. GitHub) so Railway can deploy.
3. On **Railway**, open your backend service and confirm it redeploys without errors. Check the “Deployments” or “Logs” tab.

---

## Step 3: Deploy the Frontend

1. Make sure the frontend has:
   - `frontend/src/components/Modules/EquipmentModule.jsx` (full Equipment UI)
   - `frontend/src/components/Modules/EquipmentModule.css`
2. Push to Git. **Vercel** will usually auto-deploy when you push.
3. After deploy, open your app (e.g. `https://rocking-z-farm.vercel.app`) and log in.
4. Go to **Equipment** (from the main menu). You should see the Equipment list page. If you haven’t added or synced any equipment yet, it will say “No equipment yet”.

---

## Step 4: Add Your First Piece of Equipment

1. On the Equipment page, click **“+ Add Equipment”**.
2. Fill in at least **Name** (e.g. “Tractor 1”) and **Category** (Tractor, Combine, Sprayer, or Implement).
3. Optionally add Make, Model, Year, Serial Number, Hours, Purchase date/cost, Insurance, Registration, Notes.
4. Click **“Add Equipment”**.
5. You should see the new equipment card. Click it to open the detail view.

---

## Step 5: Try Service History and Other Features

From an equipment’s detail page you can:

- **Log Service**: Click “Log Service”, enter date, type (e.g. Oil Change), cost, hours, and optionally upload a PDF/image receipt.
- **Add Schedule**: Click “Add Schedule” to set a maintenance task and next due date or hours (for upcoming alerts).
- **Add Part**: Add a part name, part number, quantity, location.
- **Log Fuel**: Enter date, gallons, cost, hours.
- **Assign Operator**: Enter operator name and optional date range.

Use the tabs (**Overview**, **service**, **schedule**, **parts**, **fuel**, **operators**, **field usage**) to switch between sections.

---

## Step 6: Connect John Deere (Optional)

If you already use John Deere with your Fields module:

1. In the app, go to **Settings → John Deere** and connect your John Deere account if you haven’t already.
2. Open **Equipment** and either:
   - From the list view, or  
   - From a specific equipment’s detail view  
   click **“Sync from John Deere”**.
3. Any equipment in John Deere Operations Center that the API returns will be added (or updated) in your Equipment list. If your JD account has no equipment or the sandbox returns nothing, the list may stay empty — you can still add equipment manually.
4. For equipment that came from John Deere, **“Sync Hours from JD”** (on that equipment’s page) will try to update current hours from JD telemetry when the API supports it.

Field usage (“which equipment was used on which fields”) comes from your existing field operations: after you sync field operations from John Deere in the Fields module, the Equipment module shows those operations under the **field usage** tab when the operation’s equipment name matches your equipment.

---

## Step 7: Reports

1. Open any equipment and click **“Reports”**, or from the list you can open an asset and then Reports.
2. In the Reports modal, pick a **Year**.
3. You’ll see:
   - **Maintenance costs** per equipment for that year
   - **Fuel** (gallons and cost) per equipment for that year

Other report endpoints (utilization, depreciation) are available from the API for future use or custom dashboards.

---

## Troubleshooting

- **“Failed to load equipment”**  
  - Backend may not be running or the new routes aren’t deployed.  
  - Run the migration (Step 1) and redeploy backend (Step 2).  
  - Check that the frontend `VITE_API_URL` (or default) points to your real backend URL.

- **“John Deere not connected”** when syncing  
  - Go to Settings → John Deere and complete the connection flow.  
  - Make sure you’re logged in as the same user that connected JD.

- **No equipment after “Sync from John Deere”**  
  - The John Deere sandbox may not return equipment for your org, or the API path may differ. You can still add and use all equipment manually.

- **Receipt download doesn’t open**  
  - Ensure the maintenance record was saved with a receipt file (PDF or image).  
  - Try a different browser or check pop-up blockers.

---

## File Checklist

**Backend (all under `backend/`):**

- `routes/equipment.js` — list, get one, create, update, delete equipment assets  
- `routes/equipmentMaintenance.js` — maintenance, schedule, parts, fuel, operators (nested under `/api/equipment/:assetId/...`)  
- `routes/equipmentJDSync.js` — JD sync, sync hours, field usage, alerts, reports  
- `scripts/equipmentModuleMigration.js` — migration script (run once)  
- `server.js` — updated to use the three equipment-related route files (see your project’s `server.js` for the exact `app.use(...)` lines)

**Frontend (under `frontend/src/`):**

- `components/Modules/EquipmentModule.jsx` — full Equipment UI  
- `components/Modules/EquipmentModule.css` — styles (earth tones to match Fields)  
- `utils/api.js` — updated with `equipmentAPI` and `equipmentJDAPI` (optional but recommended)

**Docs:**

- `EQUIPMENT_MODULE_INSTALL.md` — this guide

---

You’re done. The Equipment module is ready to use with the same look and behavior style as your Fields module, including timeline, cards, and John Deere integration where available.
