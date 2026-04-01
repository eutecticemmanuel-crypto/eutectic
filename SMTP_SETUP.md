# SMTP Setup

Use this guide to make email verification deliver real messages instead of only generating codes in the backend.

## Recommended Gmail Setup

1. Sign in to the Gmail account you want to send from.
2. Turn on 2-Step Verification in the Google account security settings.
3. Open the Google App Passwords page.
4. Create a new app password for Mail.
5. Copy the 16-character app password.

## Put These Values In `.env`

```env
VERIFICATION_SENDER_EMAIL=your-real-email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_FAMILY=4
SMTP_USER=your-real-email@gmail.com
SMTP_PASS=your-16-character-app-password
```

## Test After Saving

1. Start the backend with `node server.js`.
2. Open `http://localhost:3000/api/health`.
3. Confirm the `verificationSender` field shows your real sender email.
4. Open the public registration page and request a verification code.
5. Check the inbox and spam folder of the test email address.

## Important Notes

- Do not use your normal Gmail password here.
- Use an app password only.
- If you switch to another mail provider later, update `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS`.
- `SMTP_FAMILY=4` forces IPv4 when the hosting environment cannot reach Gmail over IPv6.
