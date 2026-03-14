# MongoDB Atlas Setup Guide for Abious Rehabilitation

This guide will help you set up a free MongoDB Atlas database for your website.

## Step 1: Create MongoDB Atlas Account

1. Go to: **https://www.mongodb.com/cloud/atlas/register**
2. Enter your email and create a password
3. Verify your email address

## Step 2: Create Free Cluster

1. After login, click **"Create"** to start a new project
2. Select **"Free"** (M0) cluster - it's free forever
3. Choose **AWS** as cloud provider
4. Select region closest to you (e.g., `eu-central-1` Frankfurt or `us-east-1`)
5. Click **"Create Cluster"**
6. Wait 1-3 minutes for it to deploy

## Step 3: Create Database User

1. Click **"Database Access"** in left sidebar
2. Click **"Add New Database User"**
3. Username: `abious_admin`
4. Password: Create a strong password (COPY IT - you'll need it!)
5. Click **"Add User"**

## Step 4: Allow Network Access

1. Click **"Network Access"** in left sidebar  
2. Click **"Add IP Address"**
3. Select **"Allow Access from Anywhere" (0.0.0.0/0)**
4. Click **"Confirm"**

## Step 5: Get Connection String

1. Click **"Database"** in left sidebar
2. Click **"Connect"** button on your cluster
3. Select **"Drivers"**
4. Copy the connection string - it looks like:
```
mongodb+srv://abious_admin:<YOUR_PASSWORD>@cluster0.xxx.mongodb.net/?retryWrites=true&w=majority
```

## Step 6: Run Server with MongoDB Atlas

Replace `<YOUR_PASSWORD>` with your actual password, then run:

```powershell
$env:MONGODB_URI = "mongodb+srv://abious_admin:YOUR_PASSWORD_HERE@cluster0.xxx.mongodb.net/?retryWrites=true&w=majority"
node server.js
```

## Alternative: Quick Start Command

Once you have your connection string, create a batch file:

```batch
@echo off
set MONGODB_URI=your_mongodb_atlas_connection_string_here
node server.js
```

## Verification

When the server starts, you should see:
```
=== MongoDB Configuration ===
Using MongoDB Atlas from MONGODB_URI
============================
✓ Connected to MongoDB successfully
```

## Troubleshooting

- **Connection timeout**: Make sure you added 0.0.0.0/0 to Network Access
- **Authentication failed**: Check your username and password in connection string
- **Cluster not ready**: Wait a few minutes after creating cluster

## Need Help?

If you encounter issues, copy the exact error message and share it for assistance.
