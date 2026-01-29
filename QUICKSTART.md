# 🚀 Quick Start Guide

## Get Running in 5 Minutes

### Step 1: Install PostgreSQL

If you don't have PostgreSQL installed:

**Mac:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Step 2: Create Database

```bash
# Access PostgreSQL
psql postgres

# Create database
CREATE DATABASE rocking_z_farm;

# Create user (optional, if you want a dedicated user)
CREATE USER farm_admin WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE rocking_z_farm TO farm_admin;

# Exit
\q
```

### Step 3: Set Up Backend

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your database info
# Use a text editor to update DB_USER, DB_PASSWORD, etc.

# Initialize database
npm run init-db
```

### Step 4: Set Up Frontend

```bash
cd ../frontend

# Install dependencies
npm install
```

### Step 5: Run the App

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Step 6: Open in Browser

Go to: http://localhost:3000

1. Click "Register here"
2. Create your account
3. Start managing your farm!

## 🎉 You're Done!

The app is now running with:
- ✅ Backend API on port 5000
- ✅ Frontend on port 3000
- ✅ PostgreSQL database
- ✅ User authentication ready

## Next Steps

1. **Register an Account** - Create your farm account
2. **Explore Modules** - Click through the different management areas
3. **Add Test Data** - Try adding some livestock or field data
4. **Customize** - Review the module components and start building out full functionality

## Common Issues

### "Database connection failed"
- Check PostgreSQL is running: `pg_isready`
- Verify .env credentials match your PostgreSQL user/password

### "Port 3000 already in use"
- Another app is using port 3000
- Change port in `frontend/vite.config.js`

### "Cannot find module"
- Run `npm install` in both backend and frontend folders

### "ECONNREFUSED ::1:5432"
- PostgreSQL not running
- Start it: `brew services start postgresql@15` (Mac) or `sudo systemctl start postgresql` (Linux)

## Development Tips

### View Database Tables
```bash
psql rocking_z_farm
\dt  # List all tables
\d users  # Describe users table
```

### Reset Database
```bash
cd backend
npm run init-db
```

### Check API Health
```bash
curl http://localhost:5000/api/health
```

Should return:
```json
{
  "status": "ok",
  "message": "Rocking Z Farm API is running",
  "timestamp": "2024-..."
}
```
