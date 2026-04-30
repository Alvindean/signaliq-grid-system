# SONIQ — AI Song Creation Studio

Full-stack deployment: Vercel (serverless) + Supabase (auth + database).

## Project Structure

```
soniq-vercel/
├── api/
│   ├── generate.js        ← Anthropic proxy with auth + usage metering
│   ├── auth.js            ← Signup / login / session endpoints  
│   └── songs.js           ← Cloud library CRUD
├── public/
│   └── index.html         ← Full SONIQ app
├── supabase-schema.sql    ← Run once in Supabase SQL editor
├── vercel.json
└── package.json
```

---

## Deploy in 4 Steps (~20 minutes)

### Step 1 — Supabase setup

1. Create free account at supabase.com
2. New Project → give it a name and password
3. SQL Editor → New Query → paste supabase-schema.sql → Run
4. Settings → API → copy these 3 values:
   - Project URL        → SUPABASE_URL
   - anon public        → SUPABASE_ANON_KEY  
   - service_role       → SUPABASE_SERVICE_ROLE_KEY (keep secret!)

### Step 2 — Push to GitHub

```bash
git init
git add .
git commit -m "SONIQ v1.0"
git remote add origin https://github.com/YOU/soniq.git
git push -u origin main
```

### Step 3 — Deploy to Vercel

1. vercel.com → Add New Project → import your repo
2. Framework: Other
3. Click Deploy (fails until env vars are set — that's OK)

### Step 4 — Environment variables

Vercel → your project → Settings → Environment Variables — add all 5:

| Variable                   | Where to find it |
|----------------------------|-----------------|
| ANTHROPIC_API_KEY          | console.anthropic.com → API Keys |
| SUPABASE_URL               | Supabase → Settings → API → Project URL |
| SUPABASE_ANON_KEY          | Supabase → Settings → API → anon public |
| SUPABASE_SERVICE_ROLE_KEY  | Supabase → Settings → API → service_role |
| APP_URL                    | Your Vercel URL e.g. https://soniq.vercel.app |

After saving → Deployments → latest → Redeploy. Done.

---

## Local Development

```bash
npm install
```

Create .env.local (never commit):
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
APP_URL=http://localhost:3000
```

```bash
npx vercel dev
# → open http://localhost:3000
```

---

## Usage Limits

| Plan                | Songs/month | Library       |
|---------------------|-------------|---------------|
| Not signed in       | 3/hour      | localStorage  |
| Free (signed in)    | 5/month     | Cloud sync    |
| Pro ($9/mo)         | Unlimited   | Cloud sync    |

Manually upgrade a user in Supabase:
```sql
UPDATE user_profiles SET plan = 'pro' WHERE email = 'user@example.com';
```

---

## How the Security Works

```
Browser → POST /api/generate (Authorization: Bearer <jwt>)
        → Vercel Function verifies JWT with Supabase
        → Checks + increments usage counter
        → Calls Anthropic with your API key (server-side only)
        → Returns result
```

Your Anthropic API key never touches the browser. Ever.

---

## Next: Add Stripe

1. Create products in Stripe: Pro $9/mo, Studio $19/mo
2. Add api/stripe-webhook.js — on checkout.session.completed, update user_profiles.plan = 'pro'
3. Add Upgrade button → Stripe Checkout link

Stripe quickstart: stripe.com/docs/billing/quickstart
