# MongoDB Atlas Setup Guide for Abious Rehabilitation

This guide helps you connect the site to MongoDB Atlas so members, logins, verification codes, and website content stay live in the cloud.

## Step 1: Create Atlas

1. Open `https://www.mongodb.com/cloud/atlas/register`
2. Create an account and verify your email
3. Create a free `M0` cluster

## Step 2: Create A Database User

1. Open `Database Access`
2. Add a new user, for example `abious_admin`
3. Save the password somewhere safe

## Step 3: Allow Network Access

1. Open `Network Access`
2. Add `0.0.0.0/0`
3. Confirm

## Step 4: Copy The Connection String

Use the Drivers option and copy a string like this:

```text
mongodb+srv://abious_admin:<PASSWORD>@cluster0.xxx.mongodb.net/abious_rehab?retryWrites=true&w=majority&appName=AbiousRehab
```

## Step 5: Add It To This Project

1. Copy `.env.example` to `.env`
2. Replace the `MONGODB_URI` value with your Atlas string
3. Keep the database name in the URL, for example `abious_rehab`

Example:

```env
MONGODB_URI=mongodb+srv://abious_admin:YOUR_PASSWORD_HERE@cluster0.xxx.mongodb.net/abious_rehab?retryWrites=true&w=majority&appName=AbiousRehab
```

You can also test it from PowerShell:

```powershell
$env:MONGODB_URI = "mongodb+srv://abious_admin:YOUR_PASSWORD_HERE@cluster0.xxx.mongodb.net/abious_rehab?retryWrites=true&w=majority&appName=AbiousRehab"
node server.js
```

## Verification

When the server starts successfully, the log should show that MongoDB Atlas is being used and that the connection succeeded.

## Troubleshooting

- Connection timeout: check Network Access and make sure `0.0.0.0/0` exists.
- Authentication failed: recheck the username, password, and URL encoding in the connection string.
- Cluster not ready: wait a few minutes after creating the cluster.
