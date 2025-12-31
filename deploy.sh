#!/bin/bash

# Azure App Service deployment script
echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Deployment complete!"
