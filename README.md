# SignalIQ Grid System

Full-stack outreach platform with auth, contacts, campaigns, launch wizard, KPI intelligence, agent control, billing, and webhook-driven attribution.

## Stack
- Frontend: Vite + React + TypeScript
- Backend: Node + Express + SQLite (`better-sqlite3`)
- Email: Resend
- Billing: Stripe

## Run locally

### 1) Backend
```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### 2) Frontend build (served by backend)
```bash
cd client
npm install
npm run build
```

## Environment
`server/.env`
- `PORT=3000`
- `APP_ORIGIN=http://localhost:3000`
- `JWT_SECRET=...`
- `ADMIN_EMAIL=...`
- `RESEND_API_KEY=`
- `RESEND_WEBHOOK_KEY=`
- `RESEND_WEBHOOK_SECRET=` (preferred, signature verified via Svix)
- `CRM_WEBHOOK_KEY=`
- `STRIPE_SECRET_KEY=`
- `STRIPE_WEBHOOK_SECRET=`
- `STRIPE_PRO_MONTHLY_PRICE_ID=`
- `STRIPE_TEAM_MONTHLY_PRICE_ID=`
- `SENDING_FROM=SignalIQ <onboarding@resend.dev>`

## API highlights
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/contacts`
- `POST /api/contacts`
- `GET /api/campaigns`
- `POST /api/campaigns`
- `POST /api/campaigns/:id/launch`
- `GET /api/matrix`
- `GET /api/dashboard/kpis`
- `GET /api/agents`
- `POST /api/agents/run-minimum`
- `GET /api/learning`
- `POST /api/learning`
- `GET /api/billing/status`
- `POST /api/billing/checkout-session`
- `POST /api/billing/portal-session`
- `POST /api/webhooks/resend`
- `POST /api/webhooks/stripe`
- `POST /api/webhooks/conversions?key=<CRM_WEBHOOK_KEY>`

## Current status
- Working auth, RBAC, persistence
- Working campaign launch with QA/SOP/A-B/agent minimum-cycle hard-stops
- Working KPI dashboard + learning registry + playbook library
- Working webhook tracking for open/click/reply and CRM conversion attribution
- Working billing backend (Stripe checkout + portal + plan limits)
