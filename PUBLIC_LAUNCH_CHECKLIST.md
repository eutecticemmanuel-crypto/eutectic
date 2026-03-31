# Public Launch Checklist

This file turns the deployment work into a short, concrete checklist.

## 1. Local Setup

- Confirm `.env` exists and review the values.
- Keep `ADMIN_EMAIL=admin@abious.org` and `ADMIN_PASSWORD=admin@123` only long enough to regain access.
- Change `ADMIN_PASSWORD` before the real public launch.
- Replace `VERIFICATION_SENDER_EMAIL`, `SMTP_USER`, and `SMTP_PASS` with real mail settings.

## 2. Backend Checks

- Start the site with `node server.js`.
- Open `http://localhost:3000/api/health`.
- Confirm the response shows `ok: true`.
- Confirm admin login works on `admin.html`.
- Register a member and verify the email code flow from the public page.

## 3. Public Hosting

- Deploy the backend to Render or another HTTPS host.
- Set `PUBLIC_BASE_URL` to the final public HTTPS URL.
- Use MongoDB Atlas or Firebase for public data storage.
- Add all environment variables from `.env` to your hosting dashboard.

## 4. Before Announcing The Site

- Test admin login.
- Test member registration.
- Test email verification delivery.
- Test member login.
- Test members page, news page, and images.
- Review privacy and security policy content in the admin dashboard.

## 5. Recommended Immediate Changes

- Change the admin password after your first successful login.
- Replace placeholder email settings before public launch.
- Do not use the bundled localtunnel link as the final production URL.
