# 🌾 Rocking Z Farm Management System

A full-stack web application for managing farm operations including livestock tracking, field management, equipment logs, grain inventory, and more. Built with React, Node.js, Express, and PostgreSQL.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Future Enhancements](#future-enhancements)
- [Deployment](#deployment)

## ✨ Features

- **User Authentication**: Secure login and registration system
- **Livestock Management**: Track animals with tag numbers, breeds, health status, and locations
- **Field Management**: Monitor fields with soil tests, tissue samples, and yearly reports
- **Equipment Logs**: Record equipment maintenance and service history
- **Grain Inventory**: Track grain storage across bins with moisture levels
- **General Inventory**: Manage farm supplies and inventory
- **Responsive Design**: Mobile-friendly interface that works on all devices
- **Future John Deere Integration**: Database structure ready for John Deere Operations Center API

## 🛠 Tech Stack

### Frontend
- **React 18** - UI framework
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Vite** - Build tool and dev server

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **PostgreSQL** - Database
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Multer** - File uploads

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/download/)
- **npm** (comes with Node.js)

## 🚀 Installation

### 1. Clone or Navigate to Project

```bash
cd rocking-z-farm
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

## 🗄 Database Setup

### 1. Create PostgreSQL Database

Open PostgreSQL command line or GUI tool (like pgAdmin) and create a database:

```sql
CREATE DATABASE rocking_z_farm;
```

### 2. Configure Environment Variables

In the `backend` folder, create a `.env` file (copy from `.env.example`):

```bash
cd backend
cp .env.example .env
```

Edit the `.env` file with your database credentials:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=rocking_z_farm
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password

JWT_SECRET=your_super_secret_key_change_this_in_production
```

### 3. Initialize Database Tables

Run the database initialization script:

```bash
npm run init-db
```

You should see output confirming all tables were created:
```
✓ Users table created
✓ Livestock table created
✓ Fields table created
✓ Field Reports table created
✓ Equipment table created
✓ Grain Inventory table created
✓ Inventory table created
✓ John Deere Data table created (ready for future integration)
✓ Indexes created
✓ Database initialization complete!
```

## 🏃 Running the Application

### Development Mode

You'll need two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

You should see:
```
╔═══════════════════════════════════════════════╗
║   🌾 Rocking Z Farm API Server Running 🌾   ║
╠═══════════════════════════════════════════════╣
║   Port: 5000                                  ║
║   Environment: development                    ║
║   Database: rocking_z_farm                    ║
╚═══════════════════════════════════════════════╝
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## 📁 Project Structure

```
rocking-z-farm/
├── backend/
│   ├── config/
│   │   └── database.js          # Database connection
│   ├── middleware/
│   │   └── auth.js               # JWT authentication
│   ├── routes/
│   │   ├── auth.js               # Login/register endpoints
│   │   ├── livestock.js          # Livestock CRUD
│   │   ├── fields.js             # Fields CRUD
│   │   ├── fieldReports.js       # Field reports with file uploads
│   │   ├── equipment.js          # Equipment logs
│   │   ├── grain.js              # Grain inventory
│   │   └── inventory.js          # General inventory
│   ├── scripts/
│   │   └── initDatabase.js       # Database initialization
│   ├── .env.example              # Environment variables template
│   ├── package.json
│   └── server.js                 # Main server file
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   ├── Register.jsx
│   │   │   │   └── Auth.css
│   │   │   ├── Dashboard/
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   └── Dashboard.css
│   │   │   ├── Layout/
│   │   │   │   ├── Header.jsx
│   │   │   │   └── Header.css
│   │   │   └── Modules/
│   │   │       ├── LivestockModule.jsx
│   │   │       ├── FieldsModule.jsx
│   │   │       ├── EquipmentModule.jsx
│   │   │       ├── GrainModule.jsx
│   │   │       └── InventoryModule.jsx
│   │   ├── utils/
│   │   │   └── api.js            # API client with all endpoints
│   │   ├── App.jsx               # Main app with routing
│   │   ├── main.jsx              # React entry point
│   │   └── index.css             # Global styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── README.md                     # This file
```

## 🔄 Current Status

### ✅ Completed
- Full backend API with all CRUD endpoints
- Database schema with all required tables
- User authentication (register/login)
- JWT token-based security
- Frontend routing and navigation
- Dashboard home screen
- Header component with logout
- Login and registration forms
- API client with all endpoints configured

### 🚧 In Progress (Module Implementation Needed)
The placeholder modules need to be implemented with full functionality:

1. **Livestock Module** - Add forms for creating/editing livestock records
2. **Fields Module** - Implement field management with year-based reports
3. **Equipment Module** - Create equipment log entry forms
4. **Grain Module** - Build grain inventory management
5. **Inventory Module** - Implement general inventory tracking

Each module should include:
- List view with all records
- Add/Edit modals or forms
- Delete functionality with confirmation
- Mobile-responsive design
- Integration with backend API (already configured)

## 🔮 Future Enhancements

### Phase 1: Complete Core Modules
- Finish implementing all module components
- Add filtering and search functionality
- Implement data export (CSV/PDF)

### Phase 2: John Deere Integration
- Set up John Deere Operations Center OAuth
- Create data sync endpoints
- Build field mapping between systems
- Add automatic field data updates

### Phase 3: Mobile App
- Convert to React Native or Progressive Web App
- Add offline functionality
- Implement push notifications
- Mobile camera integration for photos

### Phase 4: Advanced Features
- Analytics and reporting dashboard
- Weather integration
- Task management and scheduling
- Multi-user permissions
- Data backup and restore

## 🚀 Deployment

### Backend Deployment (Example: Heroku, Railway, DigitalOcean)

1. Set up PostgreSQL database on your hosting provider
2. Set environment variables on the server
3. Deploy backend code
4. Run database initialization

### Frontend Deployment (Example: Vercel, Netlify)

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Deploy the `dist` folder to your hosting provider
3. Set the API URL environment variable to point to your backend

### Environment Variables for Production

Frontend (.env):
```
VITE_API_URL=https://your-backend-url.com/api
```

Backend (set on hosting platform):
```
NODE_ENV=production
DB_HOST=your-production-db-host
DB_USER=your-production-db-user
DB_PASSWORD=your-production-db-password
JWT_SECRET=your-very-secure-random-string
```

## 📝 Development Notes

### Adding a New Module

1. Create the module component in `frontend/src/components/Modules/`
2. Add the route in `App.jsx`
3. Create the corresponding API endpoints in `backend/routes/`
4. Update the database schema if needed

### Testing the API

You can test the API endpoints using tools like:
- **Postman** - GUI for API testing
- **curl** - Command line HTTP client
- **Thunder Client** - VS Code extension

Example test:
```bash
# Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "farmer",
    "email": "farmer@rockingz.com",
    "password": "password123",
    "farmName": "Rocking Z Farm"
  }'
```

## 🤝 Contributing

This is a custom farm management system. Future contributions should focus on:
- Completing module implementations
- Adding John Deere API integration
- Improving mobile responsiveness
- Adding tests

## 📄 License

Private - Rocking Z Farm

---

**Need Help?** Check the inline code comments or review the original HTML for UI/UX reference.

**Ready for John Deere Integration?** The database already includes a `john_deere_data` table. When you're ready, we can add the OAuth flow and data syncing endpoints.
