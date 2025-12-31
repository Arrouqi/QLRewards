# Azure App Service Deployment Guide

## Prerequisites
- Azure App Service (Node.js 18 LTS or higher)
- GitHub repository connected to Azure App Service
- PostgreSQL database (Azure Cosmos DB for PostgreSQL or Azure Database for PostgreSQL)

## Azure App Service Configuration

### 1. Application Settings
In Azure Portal, go to your App Service > Configuration > Application settings and add:

| Name | Value |
|------|-------|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `EXTERNAL_DATABASE_URL` | Your PostgreSQL connection string (same as above) |
| `SESSION_SECRET` | A random secure string |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~18` |

### 2. Startup Command
In Azure Portal, go to your App Service > Configuration > General settings:

Set the **Startup Command** to:
```
npm run start
```

### 3. Build Configuration
Make sure your deployment is building the app. In Deployment Center settings, ensure:
- Build provider: GitHub Actions or Kudu
- For GitHub Actions, the workflow should run `npm install` and `npm run build`

### 4. Manual Build (if needed)
If the app doesn't build automatically, SSH into your App Service and run:
```bash
cd /home/site/wwwroot
npm install
npm run build
```

## Database Setup
Run the `production_data_seed.sql` script in your Azure PostgreSQL database to create tables and seed data.

## Troubleshooting

### App shows default Azure page
- Check if `dist/` folder exists in your deployment
- Verify the startup command is set to `npm run start`
- Check Application logs in Azure Portal > Log stream

### Database connection issues
- Ensure your App Service IP is whitelisted in PostgreSQL firewall
- Verify the connection string includes `sslmode=require`

### Build fails
- Check if Node.js version is 18+
- Ensure all dependencies are in `dependencies` (not `devDependencies`) if needed for production

## File Structure After Build
```
/home/site/wwwroot/
├── dist/
│   ├── index.cjs      # Server bundle
│   └── public/        # Static frontend files
├── node_modules/
├── package.json
└── ...
```

## Default Admin Login
- Username: `admin`
- Password: `admin123`
