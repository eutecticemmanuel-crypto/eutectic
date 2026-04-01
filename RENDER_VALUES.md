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
- `PUBLIC_BASE_URL` = `https://abious-rehabilitation-center.onrender.com`
- `MONGODB_URI` = your MongoDB Atlas connection string
- `ADMIN_EMAIL` = `admin@abious.org`
- `ADMIN_PASSWORD` = `St!lla18`
- `VERIFICATION_TOKEN_SECRET` = `c3ae4582875c40c9ac03521af93b32ad28d82d6365054694a6246a40653c5205`
- `SESSION_TTL_MS` = `604800000`
- `VERIFICATION_SENDER_EMAIL` = `isaacnewton0767304563@gmail.com`
- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `465`
- `SMTP_SECURE` = `true`
- `SMTP_FAMILY` = `4`
- `SMTP_USER` = `isaacnewton0767304563@gmail.com`
- `SMTP_PASS` = `St!lla18`

## Important

- If this is a Gmail account, `SMTP_PASS` may need to be a Gmail App Password instead of the normal account password.
- If the Render service already exists, add or update the `sync: false` variables manually in the Render dashboard because Render does not backfill those from Blueprint syncs.
