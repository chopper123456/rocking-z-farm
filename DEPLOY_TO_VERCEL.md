# Deploy updates to Vercel

Vercel only deploys **when new code is pushed** to your Git repo. If you don’t push, Vercel keeps showing the old deployment.

---

## If pushes never show up as new deployments

Your repo has **no `package.json` at the root** — the app lives in `frontend/`. Vercel must be set up to build that folder.

### Option A: Use repo root (recommended after this fix)

We added **root `package.json`** and **root `vercel.json`** so Vercel can build from the repo root:

1. In Vercel: **Project → Settings → General**
2. Set **Root Directory** to **.** (leave blank) or leave as default.
3. In **Settings → Build & Development Settings**:
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `frontend/dist` ← set this exactly
   - **Install Command:** `npm install` (default)
4. Save and trigger a **Redeploy** from the Deployments tab.

### Option B: Use frontend as root

1. In Vercel: **Project → Settings → General**
2. Set **Root Directory** to **`frontend`** (no slash).
3. In **Build & Development Settings**:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Save and trigger a **Redeploy**.

### Check Git connection

1. **Settings → Git**
2. Confirm **Connected Git Repository** is the correct repo (e.g. `yourname/rocking-z-farm`).
3. Confirm **Production Branch** is the branch you push to (e.g. `main` or `master`).
4. If it says “Disconnected”, reconnect the repo.

### After changing settings

Push a small change (e.g. add a comment in `frontend/src/App.jsx`) and push. A new deployment should appear within 1–2 minutes.

---

## Step 1: Open a terminal

- **Option A:** In Cursor: **Terminal → New Terminal** (or `` Ctrl+` ``).
- **Option B:** Open **Command Prompt** or **PowerShell**: `Win + R` → type `cmd` → Enter.

## Step 2: Go to the project folder

```bash
cd C:\Users\Cade\Desktop\rocking-z-farm
```

## Step 3: See what’s not committed

```bash
git status
```

You should see modified files (e.g. `frontend/vercel.json`, `frontend/src/contexts/OfflineContext.jsx`, `frontend/vite.config.js`, `frontend/src/main.jsx`). If it says “nothing to commit, working tree clean”, your changes are already committed—skip to Step 5.

## Step 4: Commit and push

Run these **one at a time**:

```bash
git add .
```

```bash
git commit -m "Fix Vercel SPA, offline listener, and PWA icons"
```

```bash
git push origin main
```

- If your default branch is **master** instead of **main**, use:  
  `git push origin master`
- If Git asks for username/password, use a **Personal Access Token** from GitHub (Settings → Developer settings → Personal access tokens), not your normal password.

## Step 5: Check Vercel

1. Open [vercel.com](https://vercel.com) → your project.
2. Go to the **Deployments** tab.
3. A new deployment should appear within a minute (triggered by the push).
4. When it’s **Ready**, your updates are live.

---

## If you don’t use Git from the command line

- **GitHub Desktop:**  
  Open the repo → review changed files → write a summary (e.g. “Fix Vercel and PWA”) → **Commit to main** → **Push origin**.

- **VS Code / Cursor Source Control:**  
  Open Source Control (Ctrl+Shift+G) → stage changes (click +) → type message → **Commit** → **Sync** or **Push**.

---

## If “nothing to commit” but Vercel still shows old code

1. In Vercel: **Settings → Git** and confirm the correct **Repository** and **Production Branch** (e.g. `main`).
2. Make sure you pushed to that branch (`git push origin main`).
3. In **Deployments**, check the latest deployment’s **commit** – it should match your latest commit (run `git log -1` locally to see it).

---

## If you don’t have Git installed

1. Install: [git-scm.com/download/win](https://git-scm.com/download/win).
2. Restart the terminal, then run the steps above again.
