# Render Values

Use these exact values when creating or updating the Render web service.

## Service Basics

- Name: `abious-rehabilitation-center`
- Runtime: `Node`
- Region: `Oregon`
- Build Command: `npm install`
- Start Command: `npm start`

## Environment Variables

- `NODE_VERSION` = `18`
- `PORT` = `3000`
- `HOST` = `0.0.0.0`
- `PUBLIC_BASE_URL` = `https://your-render-service.onrender.com`
- `MONGODB_URI` = your MongoDB Atlas connection string
- `ADMIN_EMAIL` = `admin@abious.org`
- `ADMIN_PASSWORD` = `set-a-strong-admin-password`
- `VERIFICATION_TOKEN_SECRET` = `set-a-long-random-secret`
- `SESSION_TTL_MS` = `604800000`
- `VERIFICATION_SENDER_EMAIL` = `your-gmail-address@gmail.com`
- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `587`
- `SMTP_SECURE` = `false`
- `SMTP_FAMILY` = `4`
- `SMTP_USER` = `your-gmail-address@gmail.com`
- `SMTP_PASS` = `your-gmail-app-password`

## Important

- If this is a Gmail account, `SMTP_PASS` may need to be a Gmail App Password instead of the normal account password.
- If Render shows `ETIMEDOUT` on `smtp.gmail.com:465`, use `SMTP_PORT=587` and `SMTP_SECURE=false`.
- If the Render service already exists, add or update the `sync: false` variables manually in the Render dashboard because Render does not backfill those from Blueprint syncs.
