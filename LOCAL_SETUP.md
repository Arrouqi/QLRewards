# Local Setup Instructions

## Prerequisites
- Node.js 18+ installed
- PostgreSQL database (local or remote)

## Steps to Run Locally

### 1. Download the Project
Click the three dots menu in Replit and select "Download as zip"

### 2. Extract and Install Dependencies
```bash
unzip project.zip
cd project
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the root folder with:
```
DATABASE_URL=postgresql://username:password@localhost:5432/your_database
SESSION_SECRET=your-secret-key-here
```

### 4. Set Up the Database
Run the SQL from `production_data_seed.sql` in your PostgreSQL database to create tables and seed data.

Or if using Drizzle migrations:
```bash
npm run db:push
```

### 5. Run the Application

Development mode:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

### 6. Access the App
Open http://localhost:5000 in your browser

## Default Admin Login
- Username: `admin`
- Password: `admin123`

## Project Structure
- `client/` - React frontend (Vite)
- `server/` - Express backend
- `shared/` - Shared types and schema
- `production_data_seed.sql` - Database seed file
