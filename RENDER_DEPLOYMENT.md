# Deploying to Render.com

This guide explains how to deploy the Abious Rehabilitation Center website to Render.com.

## Prerequisites

1. A [Render.com](https://render.com) account
2. A [GitHub](https://github.com) repository containing your code
3. Node.js 18+ installed locally

## Files Created for Deployment

I've created the following files to enable Render.com deployment:

1. **`package.json`** - Added "start" script and Node.js version requirement (>=18)
2. **`Procfile`** - Tells Render how to start your application
3. **`render.yaml`** - Configuration for automated deployment

## Deployment Steps

### Option 1: Automatic Deployment (Recommended)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Add Render.com deployment configuration"
   git push origin main
   ```

2. **Connect GitHub to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" and select "Web Service"
   - Click "Connect a repository"
   - Select your GitHub repository

3. **Configure the service**
   - Name: `abious-rehabilitation-center`
   - Region: `Oregon` (or closest to you)
   - Branch: `main`
   - Build Command: `npm install`
   - Start Command: `npm start`

4. **Environment Variables** (if needed)
   - Add `MONGODB_URI` if using MongoDB Atlas
   - Add `ADMIN_EMAIL` and `ADMIN_PASSWORD`
   - Add `VERIFICATION_TOKEN_SECRET`
   - Add `PUBLIC_BASE_URL` with your final HTTPS domain
   - Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `VERIFICATION_SENDER_EMAIL`
   - Add `FIREBASE_SERVICE_ACCOUNT` JSON if using Firebase

5. **Click "Create Web Service"**

### Option 2: Deploy from render.yaml

1. Push the code to GitHub including `render.yaml`
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New +" and select "Blueprint"
4. Connect your GitHub repository
5. Render will detect `render.yaml` and configure automatically

## Troubleshooting

### Common Issues

1. **Build fails**
   - Make sure Node.js version is 18 or higher in package.json
   - Ensure all dependencies are in package.json

2. **App doesn't start**
   - Check that the start script in package.json is correct: `"start": "node server.js"`
   - Verify Procfile contains: `web: node server.js`

3. **Database connection issues**
   - Set `MONGODB_URI` environment variable in Render dashboard
   - For MongoDB Atlas, use connection string: `mongodb+srv://<username>:<password>@cluster.mongodb.net/abious_rehab`

4. **Static files not loading**
   - The server.js should serve static files from the current directory
   - Check that HTML files are in the root directory

### Checking Logs

1. Go to Render Dashboard
2. Select your web service
3. Click "Logs" tab
4. Check for any error messages

## Important Notes

- Render provides a free tier (Web Service) that sleeps after 15 minutes of inactivity
- For persistent data, use MongoDB Atlas or another cloud database
- The app uses port 3000 by default, but Render will set the `PORT` environment variable
- Do not rely on JSON file storage for a public site; use MongoDB Atlas or Firebase
- Change the default admin password before launch
- Set up SMTP before launch or email verification will not deliver codes

## Public Launch Checklist

1. Point one public domain to the backend and set `PUBLIC_BASE_URL` to that exact HTTPS URL.
2. Put the site behind a persistent database such as MongoDB Atlas or Firebase.
3. Set a real admin password, keep `VERIFICATION_TOKEN_SECRET` private, and never commit `.env`.
4. Configure SMTP and send a real verification email test before announcing the site.
5. Verify these flows on the live domain: admin login, member registration, code verification, member login, members list, news page, and image loading.
6. Review your privacy policy and security policy content in the admin dashboard before launch.
7. If you use the bundled localtunnel script, treat it as temporary only; use Render or another stable HTTPS host for the real public release.

## Database Configuration

If your app uses MongoDB:

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Get your connection string (replace `<password>` with your actual password)
3. Add as environment variable in Render: `MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/abious_rehab`

If your app uses Firebase:

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Download the service account JSON file
3. Add the contents as an environment variable in Render, or use Firebase configuration directly

## After Deployment

Once deployed, Render will provide you with a URL like:
`https://abious-rehabilitation-center.onrender.com`

Visit this URL to verify your website is working!
