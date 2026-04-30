# SignalIQ Live Deployment Guide

## Recommended fastest path: Render Docker deploy

This repo is now deployable as one web service: React is built into `client/dist`, and Express serves both the API and frontend from port `3000`.

## 1. Push repo to GitHub
```bash
git init
git add .
git commit -m "Prepare SignalIQ for production deploy"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## 2. Create Render service
1. Go to Render.
2. New → Blueprint, select this GitHub repo.
3. Render reads `render.yaml`.
4. Add the required secret env vars listed below.
5. Deploy.

## 3. Required env vars before real launch
Set these in Render → Environment:

```bash
JWT_SECRET=<long random secret>
RESEND_API_KEY=<your Resend API key>
RESEND_WEBHOOK_SECRET=<your Resend webhook signing secret>
RESEND_WEBHOOK_KEY=<random fallback key>
CRM_WEBHOOK_KEY=<random CRM webhook key>
APP_ORIGIN=https://<your-render-or-custom-domain>
PUBLIC_APP_URL=https://<your-render-or-custom-domain>
API_PUBLIC_URL=https://<your-render-or-custom-domain>
GOOGLE_CLIENT_ID=<google oauth client id>
GOOGLE_CLIENT_SECRET=<google oauth secret>
GOOGLE_REDIRECT_URI=https://<your-render-or-custom-domain>/api/google/callback
CAMPAIGN_REPLY_TO=thealvindean@gmail.com
SENDING_FROM=SignalIQ <hello@axistms.com>
```

If `axistms.com` is not verified in Resend yet, temporarily use:
```bash
SENDING_FROM=SignalIQ <onboarding@resend.dev>
```

## 4. Update provider dashboards after deploy

### Resend webhook
Set endpoint to:
```text
https://<your-live-domain>/api/webhooks/resend
```
Use your `RESEND_WEBHOOK_SECRET` as the signing secret.
Enable events:
- `email.sent`
- `email.delivered`
- `email.opened`
- `email.clicked`
- `email.bounced`
- `email.complained`
- `email.replied`

### Google OAuth
Add this Authorized redirect URI:
```text
https://<your-live-domain>/api/google/callback
```

### CRM conversion webhook
Post conversions to:
```text
https://<your-live-domain>/api/webhooks/conversions?key=<CRM_WEBHOOK_KEY>
```

## 5. Verify live deployment
```bash
curl https://<your-live-domain>/api/health
```
Expected:
```json
{"ok":true,"resend":true}
```

Then log in with:
- Email: `thealvindean@gmail.com`
- Password: the admin password set in the live database. First registered user becomes admin if no users exist.

## 6. Production notes
- Render disk persists SQLite at `/app/server/data`.
- For heavier production traffic, migrate SQLite to Postgres.
- Do not commit `server/.env`.
- Keep `RESEND_WEBHOOK_SECRET` enabled so engagement tracking is signed and real.
