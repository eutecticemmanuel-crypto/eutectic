# Firebase Setup Guide for Abious Rehabilitation

This guide will help you set up a free Firebase database for your website.

## Step 1: Create Firebase Account

1. Go to: **https://console.firebase.google.com/**
2. Sign in with your Google account
3. Click **"Add project"**
4. Enter project name: `abious-rehabilitation`
5. Disable Google Analytics (optional, saves resources)
6. Click **"Create Project"** (wait 1-2 minutes)

## Step 2: Create Firestore Database

1. In Firebase console, click **"Build"** in left menu
2. Click **"Firestore Database"**
3. Click **"Create Database"**
4. Choose a location (closest to you)
5. Start in **"Test mode"** (allows all reads/writes for development)
6. Click **"Enable"**

## Step 3: Get Firebase Config

1. Click **"Project Overview"** (gear icon) → **"Project settings"**
2. Scroll down to **"Your apps"**
3. Click the **</>** (web) icon
4. Register app (name: `abious-web`)
5. **Copy the firebaseConfig object** - it looks like:
```javascript
{
  apiKey: "AIzaSy...",
  authDomain: "abious-rehabilitation.firebaseapp.com",
  projectId: "abious-rehabilitation",
  storageBucket: "abious-rehabilitation.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
}
```

## Step 4: Install Firebase Admin SDK

Run this command in your project folder:
```bash
npm install firebase-admin
```

## Step 5: Create Service Account

1. In Firebase console, go to **Project Settings**
2. Click **"Service accounts"** tab
3. Click **"Generate new private key"**
4. Save the JSON file as `firebase-service-account.json` in your project

## Step 6: Update Server

Once you have your Firebase config, the server will automatically detect and use Firebase for data storage!

## Quick Test

After setup, restart your server:
```powershell
node server.js
```

You should see:
```
✓ Connected to Firebase Firestore successfully
```
