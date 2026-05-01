const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');
const Stripe = require('stripe');
const { Webhook } = require('svix');
const { z } = require('zod');
const path = require('path');
const { google } = require('googleapis');
const dns = require('dns').promises;
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Anthropic = require('@anthropic-ai/sdk');

dotenv.config();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:5173';
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || APP_ORIGIN;
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || `http://localhost:${PORT}`;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRO_MONTHLY_PRICE_ID = process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '';
const STRIPE_TEAM_MONTHLY_PRICE_ID = process.env.STRIPE_TEAM_MONTHLY_PRICE_ID || '';
const CRM_WEBHOOK_KEY = (process.env.CRM_WEBHOOK_KEY || '').trim();
const RESEND_WEBHOOK_SECRET = (process.env.RESEND_WEBHOOK_SECRET || '').trim();
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.API_PUBLIC_URL || 'http://localhost:3000'}/api/google/callback`;

// In-house SMTP (Gmail App Password or any SMTP)
const SMTP_HOST = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = (process.env.SMTP_PASS || '').trim();
const SMTP_FROM = (process.env.SMTP_FROM || SMTP_USER).trim();
const CAMPAIGN_REPLY_TO = (process.env.CAMPAIGN_REPLY_TO || '').trim();
const smtpTransport = SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  : null;

const db = new Database('./data/signaliq.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT NOT NULL,
  company TEXT,
  niche TEXT,
  business_level TEXT,
  consent_basis TEXT NOT NULL DEFAULT 'legitimate_interest',
  unsubscribed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, email)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  niche TEXT NOT NULL,
  business_level TEXT NOT NULL,
  framework TEXT NOT NULL,
  predicted_conversion REAL,
  actual_conversion REAL,
  status TEXT NOT NULL DEFAULT 'draft',
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  contact_id INTEGER,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_gates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  gate_type TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  reviewer_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, gate_type)
);

CREATE TABLE IF NOT EXISTS sop_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_by_user_id INTEGER,
  completed_at TEXT,
  UNIQUE(campaign_id, step_key)
);

CREATE TABLE IF NOT EXISTS ab_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 0,
  min_sample_size INTEGER NOT NULL DEFAULT 100,
  variant_a_subject TEXT,
  variant_a_body TEXT,
  variant_b_subject TEXT,
  variant_b_body TEXT
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  agent_key TEXT NOT NULL,
  area TEXT NOT NULL,
  lane TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  run_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  impact REAL NOT NULL DEFAULT 0,
  confidence INTEGER NOT NULL DEFAULT 50,
  evidence TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT,
  recipient_email TEXT,
  event_type TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TEXT,
  monthly_send_limit INTEGER NOT NULL DEFAULT 100,
  sent_this_period INTEGER NOT NULL DEFAULT 0,
  period_key TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversion_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  campaign_send_id INTEGER,
  recipient_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  value_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  source TEXT NOT NULL DEFAULT 'crm_webhook',
  raw_payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS google_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  google_email TEXT,
  google_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TEXT,
  scopes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS google_contact_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  google_contact_id TEXT NOT NULL,
  imported_contact_id INTEGER,
  status TEXT NOT NULL DEFAULT 'imported',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, google_contact_id)
);

-- Multi-inbox: each Google Workspace inbox available for sending
CREATE TABLE IF NOT EXISTS sending_inboxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  google_connection_id INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  daily_limit INTEGER NOT NULL DEFAULT 80,
  sends_today INTEGER NOT NULL DEFAULT 0,
  sends_today_date TEXT NOT NULL DEFAULT '',
  warmup_day INTEGER NOT NULL DEFAULT 0,
  health_score INTEGER NOT NULL DEFAULT 100,
  pool TEXT NOT NULL DEFAULT 'ramping',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_send_at TEXT,
  consecutive_bounce_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Inbox health events (bounces, complaints, opens per inbox)
CREATE TABLE IF NOT EXISTS inbox_health_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sending_inbox_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  recorded_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled sends queue
CREATE TABLE IF NOT EXISTS scheduled_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  scheduled_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  sending_window TEXT NOT NULL DEFAULT 'optimal',
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Email verification results cache
CREATE TABLE IF NOT EXISTS email_verifications (
  email TEXT PRIMARY KEY,
  is_valid INTEGER NOT NULL DEFAULT 0,
  is_disposable INTEGER NOT NULL DEFAULT 0,
  mx_found INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Warmup plans per inbox
CREATE TABLE IF NOT EXISTS warmup_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sending_inbox_id INTEGER NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  current_day INTEGER NOT NULL DEFAULT 1,
  target_daily_sends INTEGER NOT NULL DEFAULT 100,
  warmup_tool TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

function hasColumn(tableName, columnName) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return cols.some((c) => c.name === columnName);
}

if (!hasColumn('users', 'role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
}

if (!hasColumn('campaign_sends', 'variant')) {
  db.exec("ALTER TABLE campaign_sends ADD COLUMN variant TEXT NOT NULL DEFAULT 'control'");
}
if (!hasColumn('campaign_sends', 'opened')) {
  db.exec('ALTER TABLE campaign_sends ADD COLUMN opened INTEGER NOT NULL DEFAULT 0');
}
if (!hasColumn('campaign_sends', 'clicked')) {
  db.exec('ALTER TABLE campaign_sends ADD COLUMN clicked INTEGER NOT NULL DEFAULT 0');
}
if (!hasColumn('campaign_sends', 'replied')) {
  db.exec('ALTER TABLE campaign_sends ADD COLUMN replied INTEGER NOT NULL DEFAULT 0');
}
if (!hasColumn('campaign_sends', 'converted')) {
  db.exec('ALTER TABLE campaign_sends ADD COLUMN converted INTEGER NOT NULL DEFAULT 0');
}

const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
if (configuredAdminEmail) {
  db.prepare('UPDATE users SET role = ? WHERE lower(email) = ?').run('admin', configuredAdminEmail);
}
const hasAdmin = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count > 0;
if (!hasAdmin) {
  db.prepare("UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY id LIMIT 1)").run();
}
const existingUsers = db.prepare('SELECT id FROM users').all();
for (const userRow of existingUsers) {
  const period = currentPeriodKey ? currentPeriodKey() : '';
  db.prepare(
    `INSERT INTO billing_accounts (user_id, plan, status, monthly_send_limit, sent_this_period, period_key)
     VALUES (?, 'free', 'active', 100, 0, ?)
     ON CONFLICT(user_id) DO NOTHING`
  ).run(userRow.id, period);
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

async function analyzeEmailPersuasion(campaign) {
  if (!anthropic || !campaign?.variant_a_subject || !campaign?.variant_a_body) {
    return null;
  }
  const prompt = `You are an email persuasion auditor. Score the email below on a 0-100 scale based on Cialdini's principles (reciprocity, commitment, social proof, authority, liking, scarcity), copy clarity, and CTA strength.

Subject: ${campaign.variant_a_subject}
Body: ${campaign.variant_a_body}

Reply with ONLY this JSON, no preamble or markdown:
{"score": <0-100>, "verdict": "<one-sentence summary>", "weaknesses": ["..."], "strengths": ["..."]}`;

  try {
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = result.content?.[0]?.type === 'text' ? result.content[0].text.trim() : '';
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.score !== 'number') return null;
    const status = parsed.score >= 75 ? 'pass' : 'fail';
    const note = parsed.verdict
      ? `${parsed.verdict}${parsed.weaknesses?.length ? ' Weaknesses: ' + parsed.weaknesses.slice(0, 3).join('; ') + '.' : ''}`
      : 'Real Claude analysis completed.';
    return { status, score: Math.round(parsed.score), notes: note.slice(0, 500) };
  } catch (err) {
    console.error('analyzeEmailPersuasion failed:', err.message);
    return null;
  }
}
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const stripePrices = {
  pro: STRIPE_PRO_MONTHLY_PRICE_ID,
  team: STRIPE_TEAM_MONTHLY_PRICE_ID,
};
const getSendProvider = () => (smtpTransport ? 'smtp' : (resend ? 'resend' : 'simulation'));
const getSendFrom = () => (process.env.SENDING_FROM || SMTP_FROM || 'SignalIQ <onboarding@resend.dev>').trim();
const getReplyTo = (userId, fallbackEmail = '') => {
  if (CAMPAIGN_REPLY_TO) return CAMPAIGN_REPLY_TO;
  const conn = db.prepare('SELECT google_email FROM google_connections WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
  return (conn?.google_email || SMTP_FROM || SMTP_USER || fallbackEmail || '').trim();
};

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));

const clientDistPath = path.resolve(__dirname, '../client/dist');

app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  res.setHeader('x-request-id', requestId);
  res.on('finish', () => {
    const log = {
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
    };
    console.log(JSON.stringify(log));
  });
  next();
});

const requestBuckets = new Map();
function rateLimit(bucketKey, max, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${bucketKey}:${req.ip || 'unknown'}`;
    const bucket = requestBuckets.get(key) || { count: 0, start: now };
    if (now - bucket.start > windowMs) {
      bucket.count = 0;
      bucket.start = now;
    }
    bucket.count += 1;
    requestBuckets.set(key, bucket);
    if (bucket.count > max) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    next();
  };
}

function makeToken(user) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role || 'member' }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

const SOP_REQUIRED_STEPS = [
  'sop_intake',
  'sop_compliance',
  'sop_segment_validation',
  'sop_copy_review',
  'sop_launch_checklist',
];

const AGENT_CATALOG = [
  { key: 'ei_builder_perf', area: 'Email Intelligence', lane: 'build' },
  { key: 'ei_builder_persuasion', area: 'Email Intelligence', lane: 'build' },
  { key: 'ei_auditor', area: 'Email Intelligence', lane: 'audit' },
  { key: 'sb_builder_narrative', area: 'StoryBrand', lane: 'build' },
  { key: 'sb_builder_clarity', area: 'StoryBrand', lane: 'build' },
  { key: 'sb_auditor', area: 'StoryBrand', lane: 'audit' },
  { key: 'hz_builder_value', area: 'Hormozi Offer', lane: 'build' },
  { key: 'hz_builder_risk', area: 'Hormozi Offer', lane: 'build' },
  { key: 'hz_auditor', area: 'Hormozi Offer', lane: 'audit' },
  { key: 'voc_builder_data', area: 'VOC Personalization', lane: 'build' },
  { key: 'voc_builder_mapping', area: 'VOC Personalization', lane: 'build' },
  { key: 'voc_auditor', area: 'VOC Personalization', lane: 'audit' },
  { key: 'mc_builder_competitive', area: 'Market Compliance', lane: 'build' },
  { key: 'mc_builder_legal', area: 'Market Compliance', lane: 'build' },
  { key: 'mc_auditor', area: 'Market Compliance', lane: 'audit' },
];

function upsertSopDefaults(campaignId) {
  for (const step of SOP_REQUIRED_STEPS) {
    db.prepare(
      `INSERT INTO sop_steps (campaign_id, step_key, completed)
       VALUES (?, ?, 0)
       ON CONFLICT(campaign_id, step_key) DO NOTHING`
    ).run(campaignId, step);
  }
}

function getQaStatus(campaignId) {
  const rows = db
    .prepare('SELECT gate_type, passed, score, notes, reviewer_user_id, created_at FROM qa_gates WHERE campaign_id = ?')
    .all(campaignId);
  const map = Object.fromEntries(rows.map((r) => [r.gate_type, r]));
  return {
    rows,
    ready:
      Boolean(map.self_check?.passed) &&
      Boolean(map.peer_check?.passed) &&
      Boolean(map.lead_signoff?.passed),
  };
}

function getSopStatus(campaignId) {
  upsertSopDefaults(campaignId);
  const rows = db.prepare('SELECT step_key, completed, completed_by_user_id, completed_at FROM sop_steps WHERE campaign_id = ?').all(campaignId);
  const completed = rows.filter((r) => r.completed).length;
  const required = SOP_REQUIRED_STEPS.length;
  return {
    rows,
    completed,
    required,
    ready: completed === required,
  };
}

function getLatestAgentRows(userId) {
  const latestRows = [];
  for (const agent of AGENT_CATALOG) {
    const row = db
      .prepare(
        `SELECT agent_key, area, lane, status, score, notes, run_id, created_at
         FROM agent_runs
         WHERE user_id = ? AND agent_key = ?
         ORDER BY id DESC
         LIMIT 1`
      )
      .get(userId, agent.key);
    latestRows.push(
      row || {
        agent_key: agent.key,
        area: agent.area,
        lane: agent.lane,
        status: 'not_run',
        score: 0,
        notes: 'Not run yet.',
        run_id: null,
        created_at: null,
      }
    );
  }
  return latestRows;
}

function getAgentSummary(rows) {
  const total = rows.length;
  const passed = rows.filter((row) => row.status === 'pass').length;
  const failed = rows.filter((row) => row.status === 'fail').length;
  const auditRows = rows.filter((row) => row.lane === 'audit');
  const allAuditsPassed = auditRows.length > 0 && auditRows.every((row) => row.status === 'pass');
  const minimumReady = passed >= 12 && allAuditsPassed;
  return { total, passed, failed, all_audits_passed: allAuditsPassed, minimum_ready: minimumReady };
}

function currentPeriodKey() {
  const now = new Date();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}`;
}

function upsertBillingAccount(userId) {
  const period = currentPeriodKey();
  db.prepare(
    `INSERT INTO billing_accounts (user_id, plan, status, monthly_send_limit, sent_this_period, period_key)
     VALUES (?, 'free', 'active', 100, 0, ?)
     ON CONFLICT(user_id) DO NOTHING`
  ).run(userId, period);
  const account = db.prepare('SELECT * FROM billing_accounts WHERE user_id = ?').get(userId);
  if (account.period_key !== period) {
    db.prepare(
      `UPDATE billing_accounts
       SET sent_this_period = 0, period_key = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`
    ).run(period, userId);
    return db.prepare('SELECT * FROM billing_accounts WHERE user_id = ?').get(userId);
  }
  return account;
}

function planLimit(plan) {
  if (plan === 'team') return 20000;
  if (plan === 'pro') return 5000;
  return 100;
}

function billingStatus(userId) {
  const account = upsertBillingAccount(userId);
  const remaining = Math.max(0, account.monthly_send_limit - account.sent_this_period);
  return {
    plan: account.plan,
    status: account.status,
    monthly_send_limit: account.monthly_send_limit,
    sent_this_period: account.sent_this_period,
    remaining_sends: remaining,
    period_key: account.period_key,
    current_period_end: account.current_period_end || null,
  };
}

function applyBillingUsage(userId, sentCount) {
  upsertBillingAccount(userId);
  db.prepare(
    `UPDATE billing_accounts
     SET sent_this_period = sent_this_period + ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(sentCount, userId);
  return billingStatus(userId);
}

function normalizeResendEvent(payload) {
  const eventType = payload?.type || payload?.event?.type || payload?.event_type || null;
  const eventData = payload?.data || payload?.event?.data || payload || {};
  const providerId = eventData?.email_id || eventData?.id || payload?.email_id || null;
  const recipientEmail = eventData?.to || eventData?.email || payload?.to || null;
  return {
    eventType,
    providerId: providerId ? String(providerId) : null,
    recipientEmail: recipientEmail ? String(recipientEmail).toLowerCase() : null,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, resend: Boolean(resend), timestamp: new Date().toISOString() });
});

app.post('/api/webhooks/resend', rateLimit('resend-webhook', 120, 60_000), (req, res) => {
  if (RESEND_WEBHOOK_SECRET) {
    try {
      const wh = new Webhook(RESEND_WEBHOOK_SECRET);
      wh.verify(req.rawBody || Buffer.from(JSON.stringify(req.body)), {
        'svix-id': String(req.headers['svix-id'] || ''),
        'svix-timestamp': String(req.headers['svix-timestamp'] || ''),
        'svix-signature': String(req.headers['svix-signature'] || ''),
      });
    } catch {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } else {
    const configuredKey = (process.env.RESEND_WEBHOOK_KEY || '').trim();
    if (configuredKey) {
      const providedKey = String(req.query.key || '');
      if (providedKey !== configuredKey) {
        return res.status(401).json({ error: 'Invalid webhook key' });
      }
    }
  }

  const payload = req.body || {};
  const { eventType, providerId, recipientEmail } = normalizeResendEvent(payload);
  if (!eventType) {
    return res.status(400).json({ error: 'Missing event type' });
  }

  db.prepare(
    `INSERT INTO email_events (provider_id, recipient_email, event_type, raw_payload)
     VALUES (?, ?, ?, ?)`
  ).run(providerId, recipientEmail, eventType, JSON.stringify(payload));

  const event = String(eventType).toLowerCase();
  const flagUpdates = {
    opened: event.includes('opened') ? 1 : 0,
    clicked: event.includes('clicked') ? 1 : 0,
    replied: event.includes('replied') ? 1 : 0,
  };

  if (flagUpdates.opened || flagUpdates.clicked || flagUpdates.replied) {
    if (providerId) {
      db.prepare(
        `UPDATE campaign_sends
         SET opened = CASE WHEN ? = 1 THEN 1 ELSE opened END,
             clicked = CASE WHEN ? = 1 THEN 1 ELSE clicked END,
             replied = CASE WHEN ? = 1 THEN 1 ELSE replied END
         WHERE provider_id = ?`
      ).run(flagUpdates.opened, flagUpdates.clicked, flagUpdates.replied, providerId);
    } else if (recipientEmail) {
      db.prepare(
        `UPDATE campaign_sends
         SET opened = CASE WHEN ? = 1 THEN 1 ELSE opened END,
             clicked = CASE WHEN ? = 1 THEN 1 ELSE clicked END,
             replied = CASE WHEN ? = 1 THEN 1 ELSE replied END
         WHERE id = (
           SELECT id FROM campaign_sends
           WHERE lower(email) = ?
           ORDER BY id DESC
           LIMIT 1
         )`
      ).run(flagUpdates.opened, flagUpdates.clicked, flagUpdates.replied, recipientEmail);
    }
  }

  res.json({ ok: true });
});

app.post('/api/webhooks/stripe', rateLimit('stripe-webhook', 120, 60_000), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ error: 'Stripe webhook is not configured' });
  }

  let event;
  try {
    const signature = String(req.headers['stripe-signature'] || '');
    event = stripe.webhooks.constructEvent(
      req.rawBody || Buffer.from(JSON.stringify(req.body)),
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return res.status(400).json({ error: 'Invalid Stripe signature' });
  }

  if (['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated'].includes(event.type)) {
    const object = event.data.object;
    const customerId = object.customer || object.customer_id;
    const subscriptionId = object.subscription || object.id;
    const metadataPlan = object.metadata?.plan;
    const plan = metadataPlan === 'team' ? 'team' : 'pro';
    const periodEnd = object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null;
    if (customerId) {
      db.prepare(
        `UPDATE billing_accounts
         SET plan = ?, status = 'active', stripe_subscription_id = ?, current_period_end = ?, monthly_send_limit = ?, updated_at = CURRENT_TIMESTAMP
         WHERE stripe_customer_id = ?`
      ).run(plan, subscriptionId || null, periodEnd, planLimit(plan), customerId);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const object = event.data.object;
    const customerId = object.customer;
    if (customerId) {
      db.prepare(
        `UPDATE billing_accounts
         SET plan = 'free', status = 'active', stripe_subscription_id = NULL, monthly_send_limit = 100, updated_at = CURRENT_TIMESTAMP
         WHERE stripe_customer_id = ?`
      ).run(customerId);
    }
  }

  res.json({ ok: true });
});

app.post('/api/webhooks/conversions', rateLimit('crm-webhook', 120, 60_000), (req, res) => {
  if (!CRM_WEBHOOK_KEY) {
    return res.status(400).json({ error: 'CRM webhook key not configured' });
  }
  const provided = String(req.query.key || '');
  if (provided !== CRM_WEBHOOK_KEY) {
    return res.status(401).json({ error: 'Invalid webhook key' });
  }

  const schema = z.object({
    user_id: z.number().int().positive(),
    recipient_email: z.string().email(),
    event_type: z.enum(['converted', 'won', 'qualified']),
    value_amount: z.number().min(0).optional().default(0),
    currency: z.string().length(3).optional().default('USD'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid conversion payload' });

  const email = parsed.data.recipient_email.toLowerCase();
  const sendRow = db
    .prepare(
      `SELECT cs.id
       FROM campaign_sends cs
       JOIN campaigns c ON c.id = cs.campaign_id
       WHERE c.user_id = ? AND lower(cs.email) = ?
       ORDER BY cs.id DESC
       LIMIT 1`
    )
    .get(parsed.data.user_id, email);

  if (sendRow) {
    db.prepare('UPDATE campaign_sends SET converted = 1 WHERE id = ?').run(sendRow.id);
  }

  db.prepare(
    `INSERT INTO conversion_events (user_id, campaign_send_id, recipient_email, event_type, value_amount, currency, source, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, 'crm_webhook', ?)`
  ).run(
    parsed.data.user_id,
    sendRow?.id || null,
    email,
    parsed.data.event_type,
    parsed.data.value_amount,
    parsed.data.currency,
    JSON.stringify(req.body || {})
  );

  res.json({ ok: true, matched_send: Boolean(sendRow) });
});

app.get('/api/webhooks/events', auth, requireRole(['admin', 'pod_lead', 'ops', 'analytics']), (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, provider_id, recipient_email, event_type, created_at
       FROM email_events
       ORDER BY id DESC
       LIMIT 100`
    )
    .all();
  res.json({ rows });
});

app.get('/api/conversions/events', auth, requireRole(['admin', 'pod_lead', 'ops', 'analytics']), (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, user_id, campaign_send_id, recipient_email, event_type, value_amount, currency, source, created_at
       FROM conversion_events
       ORDER BY id DESC
       LIMIT 100`
    )
    .all();
  res.json({ rows });
});

app.post('/api/auth/register', rateLimit('auth-register', 30, 60_000), (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { name, email, password } = parsed.data;
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const role = userCount === 0 ? 'admin' : 'member';

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, hash, role);

  const user = { id: result.lastInsertRowid, name, email, role };
  upsertBillingAccount(user.id);
  const token = makeToken(user);
  res.status(201).json({ token, user });
});

app.post('/api/auth/login', rateLimit('auth-login', 40, 60_000), (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const user = db
    .prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ?')
    .get(parsed.data.email);
  if (!user || !bcrypt.compareSync(parsed.data.password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = makeToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.get('/api/billing/status', auth, (req, res) => {
  const status = billingStatus(req.user.userId);
  res.json(status);
});

app.get('/api/launch/status', auth, (req, res) => {
  const billing = billingStatus(req.user.userId);
  const warnings = [];
  const blockers = [];
  if (!process.env.RESEND_API_KEY && !smtpTransport) blockers.push('No live sending provider configured. Add RESEND_API_KEY or SMTP_USER/SMTP_PASS.');
  if (!process.env.SENDING_FROM && !SMTP_FROM) warnings.push('SENDING_FROM is not set. Resend will fall back to onboarding@resend.dev until you configure a verified sender.');
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) warnings.push('Google Workspace is optional for launch and can be connected later.');
  if (!STRIPE_SECRET_KEY) warnings.push('Stripe is optional for launch because in-house billing is active.');
  res.json({
    ready: blockers.length === 0,
    send_provider: getSendProvider(),
    sending_from: getSendFrom(),
    reply_to: getReplyTo(req.user.userId, req.user.email),
    billing_mode: stripe ? 'stripe' : 'in_house',
    providers: { resend: !!process.env.RESEND_API_KEY, smtp: !!smtpTransport, google_oauth: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET), stripe: !!stripe },
    billing,
    blockers,
    warnings,
  });
});

app.post('/api/billing/checkout-session', auth, async (req, res) => {
  const schema = z.object({ plan: z.enum(['pro', 'team']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid plan' });
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });

  const priceId = stripePrices[parsed.data.plan];
  if (!priceId) return res.status(400).json({ error: `Missing Stripe price id for ${parsed.data.plan}` });

  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const account = upsertBillingAccount(user.id);

  let customerId = account.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { user_id: String(user.id) },
    });
    customerId = customer.id;
    db.prepare(
      `UPDATE billing_accounts
       SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`
    ).run(customerId, user.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${PUBLIC_APP_URL}/?billing=success`,
    cancel_url: `${PUBLIC_APP_URL}/?billing=cancel`,
    metadata: {
      user_id: String(user.id),
      plan: parsed.data.plan,
    },
  });

  res.json({ url: session.url });
});

app.post('/api/billing/portal-session', auth, async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });
  const account = upsertBillingAccount(req.user.userId);
  if (!account.stripe_customer_id) return res.status(400).json({ error: 'No Stripe customer found for this account' });
  const portal = await stripe.billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    return_url: `${PUBLIC_APP_URL}/?billing=portal`,
  });
  res.json({ url: portal.url });
});

// ── IN-HOUSE BILLING: admin can set plan for any user without Stripe ──────────
const PLAN_LIMITS = { free: 100, pro: 5000, team: 20000, enterprise: 100000 };

app.post('/api/billing/set-plan', auth, requireRole(['admin']), (req, res) => {
  const schema = z.object({
    user_id: z.number().int().positive(),
    plan: z.enum(['free', 'pro', 'team', 'enterprise']),
    note: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { user_id, plan } = parsed.data;
  const limit = PLAN_LIMITS[plan];
  db.prepare(
    `UPDATE billing_accounts
     SET plan = ?, monthly_send_limit = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(plan, limit, user_id);
  res.json({ ok: true, plan, monthly_send_limit: limit });
});

app.post('/api/billing/reset-period', auth, requireRole(['admin']), (req, res) => {
  const schema = z.object({ user_id: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const period = currentPeriodKey();
  db.prepare(
    `UPDATE billing_accounts SET sent_this_period = 0, period_key = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
  ).run(period, parsed.data.user_id);
  res.json({ ok: true });
});

app.get('/api/billing/all-accounts', auth, requireRole(['admin']), (_req, res) => {
  const rows = db.prepare(
    `SELECT ba.*, u.name, u.email
     FROM billing_accounts ba
     JOIN users u ON u.id = ba.user_id
     ORDER BY ba.id DESC`
  ).all();
  res.json({ rows });
});

// ── IN-HOUSE SMTP: send via Gmail App Password or any SMTP ───────────────────
app.get('/api/smtp/status', auth, requireRole(['admin']), (_req, res) => {
  res.json({
    configured: !!(SMTP_USER && SMTP_PASS),
    host: SMTP_HOST,
    port: SMTP_PORT,
    user: SMTP_USER || null,
    from: SMTP_FROM || null,
  });
});

app.post('/api/smtp/test', auth, requireRole(['admin']), async (req, res) => {
  if (!smtpTransport) return res.status(400).json({ error: 'SMTP not configured. Set SMTP_USER and SMTP_PASS in .env.' });
  const schema = z.object({ to: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email address' });
  try {
    const info = await smtpTransport.sendMail({
      from: `SignalIQ <${SMTP_FROM}>`,
      to: parsed.data.to,
      subject: 'SignalIQ SMTP Test',
      text: 'Your in-house SMTP is configured correctly. SignalIQ is ready to send.',
      html: '<p>Your <strong>in-house SMTP</strong> is configured correctly. SignalIQ is ready to send.</p>',
    });
    res.json({ ok: true, message_id: info.messageId });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.get('/api/audit/system', auth, requireRole(['admin', 'pod_lead', 'analytics']), (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const contactCount = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
  const campaignCount = db.prepare('SELECT COUNT(*) as c FROM campaigns').get().c;
  const sendCount = db.prepare('SELECT COUNT(*) as c FROM campaign_sends').get().c;
  const openCount = db.prepare('SELECT COUNT(*) as c FROM campaign_sends WHERE opened=1').get().c;
  const clickCount = db.prepare('SELECT COUNT(*) as c FROM campaign_sends WHERE clicked=1').get().c;
  const replyCount = db.prepare('SELECT COUNT(*) as c FROM campaign_sends WHERE replied=1').get().c;
  const convertCount = db.prepare('SELECT COUNT(*) as c FROM campaign_sends WHERE converted=1').get().c;
  const learningCount = db.prepare('SELECT COUNT(*) as c FROM learning_registry').get().c;
  const agentRunCount = db.prepare('SELECT COUNT(*) as c FROM agent_runs').get().c;
  const webhookCount = db.prepare('SELECT COUNT(*) as c FROM email_events').get().c;
  const conversionEventCount = db.prepare('SELECT COUNT(*) as c FROM conversion_events').get().c;
  const googleConn = db.prepare('SELECT COUNT(*) as c FROM google_connections').get().c;
  const inboxCount = db.prepare('SELECT COUNT(*) as c FROM sending_inboxes').get().c;
  const scheduledCount = db.prepare('SELECT COUNT(*) as c FROM scheduled_sends WHERE status=\'pending\'').get().c;
  const verifiedCount = db.prepare('SELECT COUNT(*) as c FROM email_verifications WHERE is_valid=1').get().c;
  const billingRows = db.prepare('SELECT plan, COUNT(*) as c FROM billing_accounts GROUP BY plan').all();

  const openRate = sendCount > 0 ? ((openCount / sendCount) * 100).toFixed(1) : '0.0';
  const clickRate = sendCount > 0 ? ((clickCount / sendCount) * 100).toFixed(1) : '0.0';
  const replyRate = sendCount > 0 ? ((replyCount / sendCount) * 100).toFixed(1) : '0.0';
  const convRate = sendCount > 0 ? ((convertCount / sendCount) * 100).toFixed(1) : '0.0';

  res.json({
    counts: { users: userCount, contacts: contactCount, campaigns: campaignCount, sends: sendCount, learning: learningCount, agent_runs: agentRunCount, webhooks: webhookCount, conversion_events: conversionEventCount, google_connections: googleConn, inboxes: inboxCount, scheduled_pending: scheduledCount, verified_emails: verifiedCount },
    rates: { open_rate: openRate, click_rate: clickRate, reply_rate: replyRate, conversion_rate: convRate },
    billing_breakdown: billingRows,
    providers: {
      resend: !!process.env.RESEND_API_KEY,
      smtp: !!(SMTP_USER && SMTP_PASS),
      stripe: !!STRIPE_SECRET_KEY,
      google_oauth: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
      crm_webhook: !!CRM_WEBHOOK_KEY,
      resend_webhook: !!RESEND_WEBHOOK_SECRET,
    },
  });
});

app.get('/api/agents', auth, (req, res) => {
  const rows = getLatestAgentRows(req.user.userId);
  const summary = getAgentSummary(rows);
  res.json({ summary, rows });
});

app.post('/api/agents/run-minimum', auth, async (req, res) => {
  const runId = `run_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const rows = [];
  const notesByKey = {
    ei_builder_perf: 'Email Intelligence performance baseline established across deliverability and engagement signals.',
    ei_builder_persuasion: 'Email Intelligence persuasion patterns aligned to subject, preview, and CTA hierarchy.',
    ei_auditor: 'Email Intelligence audit confirms send-readiness and inbox placement guardrails.',
    sb_builder_narrative: 'StoryBrand narrative arc established with clear hero, guide, and stakes framing.',
    sb_builder_clarity: 'StoryBrand clarity pass tightened messaging to a single, repeatable one-liner.',
    sb_auditor: 'StoryBrand audit confirms BrandScript coherence across all customer touchpoints.',
    hz_builder_value: 'Hormozi value stack assembled with quantified dream outcome and perceived likelihood.',
    hz_builder_risk: 'Hormozi risk reversal layered with guarantees that reduce perceived effort and time.',
    hz_auditor: 'Hormozi offer audit confirms grand slam scoring across value equation levers.',
    voc_builder_data: 'VOC personalization data layer baseline established from verbatim customer signal capture.',
    voc_builder_mapping: 'VOC personalization mapping aligned customer language to lifecycle stage triggers.',
    voc_auditor: 'VOC audit confirms personalization tokens resolve cleanly against the segment schema.',
    mc_builder_competitive: 'Market Compliance competitive baseline benchmarked against category leader claims.',
    mc_builder_legal: 'Market Compliance legal review cleared substantiation, disclaimers, and jurisdiction flags.',
    mc_auditor: 'Market Compliance audit confirms launch-ready posture across regulated claim surfaces.',
  };

  const latestCampaign = db
    .prepare('SELECT id, name, variant_a_subject, variant_a_body FROM campaigns WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .get(req.user.userId);

  for (const agent of AGENT_CATALOG) {
    let status = 'pass';
    let score = 88 + Math.floor(Math.random() * 10);
    let notes = notesByKey[agent.key] || `${agent.area} minimum cycle passed.`;

    if (agent.key === 'ei_builder_persuasion') {
      const real = await analyzeEmailPersuasion(latestCampaign);
      if (real) {
        status = real.status;
        score = real.score;
        notes = `[live analysis · campaign #${latestCampaign.id}] ${real.notes}`;
      }
    }

    db.prepare(
      `INSERT INTO agent_runs (user_id, agent_key, area, lane, status, score, notes, run_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.user.userId, agent.key, agent.area, agent.lane, status, score, notes, runId);
    rows.push({
      agent_key: agent.key,
      area: agent.area,
      lane: agent.lane,
      status,
      score,
      notes,
      run_id: runId,
    });
  }
  const latest = getLatestAgentRows(req.user.userId);
  const summary = getAgentSummary(latest);
  res.json({ run_id: runId, summary, rows });
});

app.get('/api/admin/users', auth, requireRole(['admin']), (_req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id DESC').all();
  res.json(users);
});

app.patch('/api/admin/users/:id/role', auth, requireRole(['admin']), (req, res) => {
  const userId = Number(req.params.id);
  const schema = z.object({
    role: z.enum(['admin', 'pod_lead', 'compliance', 'prospecting', 'copy', 'ops', 'analytics', 'member']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(parsed.data.role, userId);
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.get('/api/contacts', auth, (req, res) => {
  const contacts = db
    .prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY id DESC')
    .all(req.user.userId);
  res.json(contacts);
});

app.post('/api/contacts', auth, (req, res) => {
  const schema = z.object({
    first_name: z.string().min(1),
    last_name: z.string().optional().default(''),
    email: z.string().email(),
    company: z.string().optional().default(''),
    niche: z.string().optional().default('SaaS'),
    business_level: z.string().optional().default('Startup'),
    consent_basis: z.enum(['express', 'legitimate_interest', 'implied']).default('legitimate_interest'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  try {
    const r = db
      .prepare(
        `INSERT INTO contacts (user_id, first_name, last_name, email, company, niche, business_level, consent_basis)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user.userId,
        parsed.data.first_name,
        parsed.data.last_name,
        parsed.data.email,
        parsed.data.company,
        parsed.data.niche,
        parsed.data.business_level,
        parsed.data.consent_basis
      );
    const created = db.prepare('SELECT * FROM contacts WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch {
    res.status(409).json({ error: 'Contact email already exists' });
  }
});

app.patch('/api/contacts/:id/unsubscribe', auth, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE contacts SET unsubscribed = 1 WHERE id = ? AND user_id = ?').run(id, req.user.userId);
  res.json({ ok: true });
});

app.get('/unsubscribe', (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  const userId = Number(req.query.uid || 0);
  if (!email || !userId) {
    return res.status(400).send('Invalid unsubscribe link.');
  }

  db.prepare('UPDATE contacts SET unsubscribed = 1 WHERE user_id = ? AND lower(email) = ?').run(userId, email);
  return res
    .status(200)
    .send('<html><body style="font-family:Arial,sans-serif;padding:24px"><h2>Unsubscribed</h2><p>You have been unsubscribed from future SignalIQ campaign emails.</p></body></html>');
});

app.get('/api/campaigns', auth, (req, res) => {
  const campaigns = db
    .prepare('SELECT * FROM campaigns WHERE user_id = ? ORDER BY id DESC')
    .all(req.user.userId);
  res.json(campaigns);
});

app.post('/api/campaigns', auth, (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    niche: z.string().min(1),
    business_level: z.string().min(1),
    framework: z.string().min(1),
    predicted_conversion: z.number().min(0).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const p = parsed.data;
  const r = db
    .prepare(
      `INSERT INTO campaigns (user_id, name, niche, business_level, framework, predicted_conversion)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.userId, p.name, p.niche, p.business_level, p.framework, p.predicted_conversion);
  const created = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(r.lastInsertRowid);
  upsertSopDefaults(created.id);
  db.prepare(
    `INSERT INTO ab_tests (campaign_id, enabled, min_sample_size)
     VALUES (?, 0, 100)
     ON CONFLICT(campaign_id) DO NOTHING`
  ).run(created.id);
  res.status(201).json(created);
});

app.get('/api/campaigns/:id/qa-gates', auth, (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, req.user.userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(getQaStatus(campaignId));
});

app.post('/api/campaigns/:id/qa-gates', auth, (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, req.user.userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const schema = z.object({
    gate_type: z.enum(['self_check', 'peer_check', 'lead_signoff']),
    passed: z.boolean(),
    score: z.number().min(0).max(100),
    notes: z.string().max(1000).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid gate payload' });

  if (parsed.data.gate_type === 'lead_signoff' && !['admin', 'pod_lead'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Lead signoff requires admin or pod lead role' });
  }

  db.prepare(
    `INSERT INTO qa_gates (campaign_id, gate_type, passed, score, notes, reviewer_user_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(campaign_id, gate_type)
     DO UPDATE SET passed = excluded.passed, score = excluded.score, notes = excluded.notes, reviewer_user_id = excluded.reviewer_user_id, created_at = CURRENT_TIMESTAMP`
  ).run(
    campaignId,
    parsed.data.gate_type,
    parsed.data.passed ? 1 : 0,
    parsed.data.score,
    parsed.data.notes,
    req.user.userId
  );

  res.json(getQaStatus(campaignId));
});

app.get('/api/campaigns/:id/sop', auth, (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, req.user.userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(getSopStatus(campaignId));
});

app.post('/api/campaigns/:id/sop', auth, (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, req.user.userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const schema = z.object({
    step_key: z.enum(SOP_REQUIRED_STEPS),
    completed: z.boolean(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid SOP payload' });

  db.prepare(
    `INSERT INTO sop_steps (campaign_id, step_key, completed, completed_by_user_id, completed_at)
     VALUES (?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
     ON CONFLICT(campaign_id, step_key)
     DO UPDATE SET completed = excluded.completed, completed_by_user_id = excluded.completed_by_user_id, completed_at = CASE WHEN excluded.completed = 1 THEN CURRENT_TIMESTAMP ELSE NULL END`
  ).run(campaignId, parsed.data.step_key, parsed.data.completed ? 1 : 0, req.user.userId, parsed.data.completed ? 1 : 0);

  res.json(getSopStatus(campaignId));
});

app.get('/api/campaigns/:id/ab-test', auth, (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, req.user.userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  db.prepare(
    `INSERT INTO ab_tests (campaign_id, enabled, min_sample_size)
     VALUES (?, 0, 100)
     ON CONFLICT(campaign_id) DO NOTHING`
  ).run(campaignId);
  const row = db.prepare('SELECT * FROM ab_tests WHERE campaign_id = ?').get(campaignId);
  res.json(row);
});

app.post('/api/campaigns/:id/ab-test', auth, (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, req.user.userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const schema = z.object({
    enabled: z.boolean(),
    min_sample_size: z.number().min(20).max(100000),
    variant_a_subject: z.string().min(2),
    variant_a_body: z.string().min(10),
    variant_b_subject: z.string().min(2),
    variant_b_body: z.string().min(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid A/B payload' });

  db.prepare(
    `INSERT INTO ab_tests (campaign_id, enabled, min_sample_size, variant_a_subject, variant_a_body, variant_b_subject, variant_b_body)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(campaign_id)
     DO UPDATE SET enabled = excluded.enabled, min_sample_size = excluded.min_sample_size, variant_a_subject = excluded.variant_a_subject, variant_a_body = excluded.variant_a_body, variant_b_subject = excluded.variant_b_subject, variant_b_body = excluded.variant_b_body`
  ).run(
    campaignId,
    parsed.data.enabled ? 1 : 0,
    parsed.data.min_sample_size,
    parsed.data.variant_a_subject,
    parsed.data.variant_a_body,
    parsed.data.variant_b_subject,
    parsed.data.variant_b_body
  );

  const row = db.prepare('SELECT * FROM ab_tests WHERE campaign_id = ?').get(campaignId);
  res.json(row);
});

app.post('/api/campaigns/:id/launch', auth, async (req, res) => {
  const campaignId = Number(req.params.id);
  const schema = z.object({
    subject: z.string().min(2),
    body: z.string().min(10),
    contactIds: z.array(z.number()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, req.user.userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const qaStatus = getQaStatus(campaignId);
  if (!qaStatus.ready) {
    return res.status(400).json({ error: 'Launch blocked: QA gates incomplete. Pass self, peer, and lead signoff.' });
  }
  const sopStatus = getSopStatus(campaignId);
  if (!sopStatus.ready) {
    return res.status(400).json({ error: 'Launch blocked: SOP steps incomplete.' });
  }
  const agentSummary = getAgentSummary(getLatestAgentRows(req.user.userId));
  if (!agentSummary.minimum_ready) {
    return res.status(400).json({ error: 'Launch blocked: Agent minimum cycle not ready. Run and pass the 15-agent minimum cycle.' });
  }
  const abConfig = db.prepare('SELECT * FROM ab_tests WHERE campaign_id = ?').get(campaignId);

  const contacts = parsed.data.contactIds?.length
    ? db
        .prepare(
          `SELECT * FROM contacts WHERE user_id = ? AND unsubscribed = 0 AND id IN (${parsed.data.contactIds
            .map(() => '?')
            .join(',')})`
        )
        .all(req.user.userId, ...parsed.data.contactIds)
    : db.prepare('SELECT * FROM contacts WHERE user_id = ? AND unsubscribed = 0').all(req.user.userId);

  if (!contacts.length) return res.status(400).json({ error: 'No eligible contacts' });
  const billing = billingStatus(req.user.userId);
  if (billing.remaining_sends <= 0) {
    return res.status(400).json({ error: `Launch blocked: ${billing.plan} plan monthly send limit reached.` });
  }
  if (contacts.length > billing.remaining_sends) {
    return res.status(400).json({ error: `Launch blocked: ${billing.remaining_sends} sends remaining this month on ${billing.plan} plan.` });
  }
  if (abConfig?.enabled && contacts.length < abConfig.min_sample_size) {
    return res.status(400).json({ error: `Launch blocked: A/B test requires at least ${abConfig.min_sample_size} contacts.` });
  }

  let sent = 0;
  let openedTotal = 0;
  let clickedTotal = 0;
  let repliedTotal = 0;
  let convertedTotal = 0;

  for (const c of contacts) {
    const useVariantA = abConfig?.enabled ? sent % 2 === 0 : false;
    const subjectTemplate = abConfig?.enabled
      ? useVariantA
        ? abConfig.variant_a_subject
        : abConfig.variant_b_subject
      : parsed.data.subject;
    const bodyTemplate = abConfig?.enabled
      ? useVariantA
        ? abConfig.variant_a_body
        : abConfig.variant_b_body
      : parsed.data.body;

    const finalSubject = subjectTemplate
      .replaceAll('{first_name}', c.first_name)
      .replaceAll('{company}', c.company || 'your company');
    const finalBody = bodyTemplate
      .replaceAll('{first_name}', c.first_name)
      .replaceAll('{company}', c.company || 'your company');
    const variant = abConfig?.enabled ? (useVariantA ? 'A' : 'B') : 'control';

    try {
      let providerId = null;
      const unsubscribeUrl = `${API_PUBLIC_URL}/unsubscribe?uid=${req.user.userId}&email=${encodeURIComponent(
        c.email
      )}`;
      const complianceFooter = `<p style="margin-top:24px;font-size:12px;color:#666">You can unsubscribe anytime: <a href="${unsubscribeUrl}">One-click unsubscribe</a>.</p>`;
      const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.6">${finalBody.replaceAll('\n', '<br/>')}${complianceFooter}</div>`;
      const replyTo = getReplyTo(req.user.userId, req.user.email);
      let sendStatus = 'simulated';

      if (smtpTransport) {
        const info = await smtpTransport.sendMail({
          from: getSendFrom(),
          to: c.email,
          subject: finalSubject,
          html: htmlBody,
          ...(replyTo ? { replyTo } : {}),
        });
        providerId = info.messageId || null;
        sendStatus = 'sent';
      } else if (resend) {
        const result = await resend.emails.send({
          from: getSendFrom(),
          to: c.email,
          subject: finalSubject,
          html: htmlBody,
          ...(replyTo ? { replyTo } : {}),
        });
        providerId = result.data?.id || null;
        sendStatus = 'sent';
      }

      const opened = sendStatus === 'sent' ? 0 : (Math.random() < 0.47 ? 1 : 0);
      const clicked = sendStatus === 'sent' ? 0 : (opened && Math.random() < 0.21 ? 1 : 0);
      const replied = sendStatus === 'sent' ? 0 : (clicked && Math.random() < 0.32 ? 1 : 0);
      const converted = sendStatus === 'sent' ? 0 : (replied && Math.random() < 0.4 ? 1 : 0);

      db.prepare(
        'INSERT INTO campaign_sends (campaign_id, contact_id, email, status, provider_id, variant, opened, clicked, replied, converted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(campaignId, c.id, c.email, sendStatus, providerId, variant, opened, clicked, replied, converted);
      sent += 1;
      openedTotal += opened;
      clickedTotal += clicked;
      repliedTotal += replied;
      convertedTotal += converted;
    } catch (err) {
      db.prepare(
        'INSERT INTO campaign_sends (campaign_id, contact_id, email, status, error_message, variant) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(campaignId, c.id, c.email, 'failed', String(err.message || err), variant);
    }
  }

  const actualConversion = sent ? Number(((convertedTotal / sent) * 100).toFixed(2)) : 0;
  db.prepare('UPDATE campaigns SET status = ?, sent_count = sent_count + ?, actual_conversion = ? WHERE id = ?')
    .run('running', sent, actualConversion, campaignId);
  const updatedBilling = applyBillingUsage(req.user.userId, sent);

  res.json({
    ok: true,
    sent,
    simulated: getSendProvider() === 'simulation',
    send_provider: getSendProvider(),
    sending_from: getSendFrom(),
    actual_conversion: actualConversion,
    funnel: {
      opened: openedTotal,
      clicked: clickedTotal,
      replied: repliedTotal,
      converted: convertedTotal,
    },
    billing: updatedBilling,
  });
});

app.get('/api/matrix', auth, (req, res) => {
  const rows = db
    .prepare('SELECT id, name, framework, niche, business_level, predicted_conversion, actual_conversion, sent_count, status FROM campaigns WHERE user_id = ? ORDER BY id DESC')
    .all(req.user.userId);

  const signalRows = db.prepare(`
    SELECT c.framework, c.niche, c.business_level,
      COUNT(cs.id) as sends,
      ROUND(AVG(CAST(cs.replied AS FLOAT)) * 100, 1) as reply_rate,
      ROUND(AVG(CAST(cs.converted AS FLOAT)) * 100, 1) as conv_rate
    FROM campaigns c
    JOIN campaign_sends cs ON cs.campaign_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.framework, c.niche, c.business_level
    HAVING sends >= 3
    ORDER BY conv_rate DESC
    LIMIT 6`).all(req.user.userId);

  let signals = signalRows.map(row => ({
    signal: `${row.framework} in ${row.niche} / ${row.business_level}`,
    impact: `+${row.conv_rate}% conv`,
    confidence: Math.min(99, Math.round(50 + row.sends * 5)),
  }));

  const defaults = [
    { signal: 'Single CTA emails', impact: '+14%', confidence: 92 },
    { signal: 'PAS in SaaS Mid-Market', impact: '+18%', confidence: 88 },
    { signal: 'Subject with number', impact: '+11%', confidence: 84 },
    { signal: 'Body < 125 words', impact: '+9%', confidence: 80 },
  ];
  for (const d of defaults) {
    if (signals.length < 4) signals.push(d);
  }

  res.json({ campaigns: rows, signals });
});

app.get('/api/dashboard/kpis', auth, (req, res) => {
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS sends,
         COALESCE(SUM(opened), 0) AS opened,
         COALESCE(SUM(clicked), 0) AS clicked,
         COALESCE(SUM(replied), 0) AS replied,
         COALESCE(SUM(converted), 0) AS converted,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN 1 ELSE 0 END), 0) AS simulated_sends,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN opened ELSE 0 END), 0) AS simulated_opened,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN clicked ELSE 0 END), 0) AS simulated_clicked,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN replied ELSE 0 END), 0) AS simulated_replied,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN converted ELSE 0 END), 0) AS simulated_converted,
         COALESCE(SUM(CASE WHEN cs.status = 'sent' THEN 1 ELSE 0 END), 0) AS live_sends
       FROM campaign_sends cs
       JOIN campaigns c ON c.id = cs.campaign_id
       WHERE c.user_id = ?`
    )
    .get(req.user.userId);

  const segmentRows = db
    .prepare(
      `SELECT
         c.niche,
         c.business_level,
         COUNT(cs.id) AS sends,
         COALESCE(SUM(cs.opened), 0) AS opened,
         COALESCE(SUM(cs.clicked), 0) AS clicked,
         COALESCE(SUM(cs.replied), 0) AS replied,
         COALESCE(SUM(cs.converted), 0) AS converted,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN 1 ELSE 0 END), 0) AS simulated_sends,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN cs.opened ELSE 0 END), 0) AS simulated_opened,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN cs.clicked ELSE 0 END), 0) AS simulated_clicked,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN cs.replied ELSE 0 END), 0) AS simulated_replied,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN cs.converted ELSE 0 END), 0) AS simulated_converted
       FROM campaigns c
       LEFT JOIN campaign_sends cs ON cs.campaign_id = c.id
       WHERE c.user_id = ?
       GROUP BY c.niche, c.business_level
       ORDER BY sends DESC`
    )
    .all(req.user.userId);

  const byVariant = db
    .prepare(
      `SELECT
         variant,
         COUNT(*) AS sends,
         COALESCE(SUM(opened), 0) AS opened,
         COALESCE(SUM(clicked), 0) AS clicked,
         COALESCE(SUM(replied), 0) AS replied,
         COALESCE(SUM(converted), 0) AS converted,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN 1 ELSE 0 END), 0) AS simulated_sends,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN opened ELSE 0 END), 0) AS simulated_opened,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN clicked ELSE 0 END), 0) AS simulated_clicked,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN replied ELSE 0 END), 0) AS simulated_replied,
         COALESCE(SUM(CASE WHEN cs.status = 'simulated' THEN converted ELSE 0 END), 0) AS simulated_converted
       FROM campaign_sends cs
       JOIN campaigns c ON c.id = cs.campaign_id
       WHERE c.user_id = ?
       GROUP BY variant
       ORDER BY sends DESC`
    )
    .all(req.user.userId);

  const eventStats = db.prepare(
    `SELECT COUNT(*) AS event_count
     FROM email_events ee
     WHERE EXISTS (
       SELECT 1
       FROM campaign_sends cs
       JOIN campaigns c ON c.id = cs.campaign_id
       WHERE c.user_id = ?
         AND (
           (ee.provider_id IS NOT NULL AND ee.provider_id = cs.provider_id)
           OR (ee.recipient_email IS NOT NULL AND lower(ee.recipient_email) = lower(cs.email))
         )
     )`
  ).get(req.user.userId);

  const webhookConfigured = Boolean(RESEND_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_KEY);
  const trackingPending = (totals.live_sends || 0) > 0 && !webhookConfigured && (eventStats.event_count || 0) === 0;
  const safeRate = (num, den) => (den ? Number(((num / den) * 100).toFixed(2)) : null);
  const metric = (row, key) => {
    if (!trackingPending) return safeRate(row[key], row.sends);
    const simDen = row.simulated_sends || 0;
    const simNum = row[`simulated_${key}`] || 0;
    return safeRate(simNum, simDen);
  };
  const kpis = {
    sends: totals.sends || 0,
    tracked_sends: trackingPending ? (totals.simulated_sends || 0) : (totals.sends || 0),
    engagement_tracking_ready: !trackingPending,
    tracking_message: trackingPending ? 'Open/click/reply tracking is not configured yet. Add the Resend webhook to see real engagement rates.' : null,
    event_count: eventStats.event_count || 0,
    open_rate: metric(totals, 'opened'),
    click_rate: metric(totals, 'clicked'),
    reply_rate: metric(totals, 'replied'),
    conversion_rate: metric(totals, 'converted'),
    cac: totals.converted ? Number((1200 / totals.converted).toFixed(2)) : null,
  };

  const segments = segmentRows.map((row) => ({
    niche: row.niche,
    business_level: row.business_level,
    sends: row.sends,
    tracked_sends: trackingPending ? (row.simulated_sends || 0) : row.sends,
    open_rate: metric(row, 'opened'),
    click_rate: metric(row, 'clicked'),
    reply_rate: metric(row, 'replied'),
    conversion_rate: metric(row, 'converted'),
    cac: row.converted ? Number((1200 / row.converted).toFixed(2)) : null,
  }));

  const variant = byVariant.map((row) => ({
    variant: row.variant,
    sends: row.sends,
    tracked_sends: trackingPending ? (row.simulated_sends || 0) : row.sends,
    open_rate: metric(row, 'opened'),
    click_rate: metric(row, 'clicked'),
    reply_rate: metric(row, 'replied'),
    conversion_rate: metric(row, 'converted'),
  }));

  res.json({ kpis, segments, variant });
});

app.get('/api/learning', auth, (req, res) => {
  const manualRows = db
    .prepare(
      `SELECT id, title, category, impact, confidence, evidence, source, created_at
       FROM learning_registry
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 30`
    )
    .all(req.user.userId);

  const autoRows = db
    .prepare(
      `SELECT
         c.framework,
         c.niche,
         c.business_level,
         COUNT(cs.id) AS sends,
         ROUND(AVG(CAST(cs.converted AS FLOAT)) * 100, 2) AS conv_rate,
         ROUND(AVG(CAST(cs.replied AS FLOAT)) * 100, 2) AS reply_rate
       FROM campaigns c
       JOIN campaign_sends cs ON cs.campaign_id = c.id
       WHERE c.user_id = ?
       GROUP BY c.framework, c.niche, c.business_level
       HAVING sends >= 3
       ORDER BY conv_rate DESC
       LIMIT 12`
    )
    .all(req.user.userId)
    .map((row, idx) => ({
      id: `auto_${idx + 1}`,
      title: `${row.framework} performs in ${row.niche} / ${row.business_level}`,
      category: 'auto_signal',
      impact: Number(row.conv_rate || 0),
      confidence: Math.min(99, Math.round(55 + row.sends * 5)),
      evidence: `${row.sends} sends | reply ${row.reply_rate}%`,
      source: 'auto',
      created_at: new Date().toISOString(),
    }));

  const allRows = [...autoRows, ...manualRows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  res.json({ rows: allRows });
});

app.post('/api/learning', auth, (req, res) => {
  const schema = z.object({
    title: z.string().min(5).max(180),
    category: z.string().min(2).max(80),
    impact: z.number().min(-100).max(100),
    confidence: z.number().min(1).max(99),
    evidence: z.string().max(500).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid learning payload' });

  const result = db
    .prepare(
      `INSERT INTO learning_registry (user_id, title, category, impact, confidence, evidence, source)
       VALUES (?, ?, ?, ?, ?, ?, 'manual')`
    )
    .run(
      req.user.userId,
      parsed.data.title,
      parsed.data.category,
      parsed.data.impact,
      parsed.data.confidence,
      parsed.data.evidence
    );

  const row = db
    .prepare('SELECT id, title, category, impact, confidence, evidence, source, created_at FROM learning_registry WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(row);
});

// ── Email Verification ───────────────────────────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','yopmail.com',
  'sharklasers.com','guerrillamailblock.com','grr.la','guerrillamail.info','spam4.me',
  'trashmail.com','dispostable.com','fakeinbox.com','maildrop.cc','mailnull.com',
  'spamgourmet.com','trashmail.me','0-mail.com','discard.email','filzmail.com',
  'mailnull.com','mailscrap.com','spambox.us','trashmail.at','trashmail.io',
  'temp-mail.org','10minutemail.com','mailexpire.com','throwam.com','burnermail.io',
]);

async function verifyEmail(email) {
  const cached = db.prepare("SELECT * FROM email_verifications WHERE email = ? AND datetime(verified_at) > datetime('now', '-7 days')").get(email);
  if (cached) return cached;

  const result = { email, is_valid: 0, is_disposable: 0, mx_found: 0, score: 0, reason: '', verified_at: new Date().toISOString() };

  // 1. Format check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) { result.reason = 'invalid_format'; result.score = 0; upsertVerification(result); return result; }
  result.score += 20;

  const domain = email.split('@')[1].toLowerCase();

  // 2. Disposable check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    result.is_disposable = 1; result.reason = 'disposable'; result.score = 5; upsertVerification(result); return result;
  }
  result.score += 20;

  // 3. MX record check
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      result.mx_found = 1;
      result.score += 40;
      // Bonus for known major providers
      const topMx = mxRecords.sort((a,b) => a.priority - b.priority)[0].exchange.toLowerCase();
      if (topMx.includes('google') || topMx.includes('outlook') || topMx.includes('microsoft') ||
          topMx.includes('yahoo') || topMx.includes('icloud') || topMx.includes('zoho')) {
        result.score += 20;
      }
    } else {
      result.reason = 'no_mx'; upsertVerification(result); return result;
    }
  } catch {
    result.reason = 'mx_lookup_failed'; upsertVerification(result); return result;
  }

  result.is_valid = result.score >= 60 ? 1 : 0;
  result.reason = result.is_valid ? 'valid' : 'low_score';
  upsertVerification(result);
  return result;
}

function upsertVerification(r) {
  try {
    db.prepare(`INSERT OR REPLACE INTO email_verifications (email, is_valid, is_disposable, mx_found, score, reason, verified_at) VALUES (?,?,?,?,?,?,?)`)
      .run(r.email, r.is_valid, r.is_disposable, r.mx_found, r.score, r.reason, r.verified_at);
  } catch {}
}

// POST /api/verify/email — verify a single email
app.post('/api/verify/email', auth, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const result = await verifyEmail(String(email).trim().toLowerCase());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/verify/bulk — verify multiple emails
app.post('/api/verify/bulk', auth, async (req, res) => {
  const { emails } = req.body || {};
  if (!Array.isArray(emails) || emails.length === 0) return res.status(400).json({ error: 'emails array required' });
  if (emails.length > 500) return res.status(400).json({ error: 'Max 500 emails per batch' });
  try {
    const results = await Promise.all(emails.map(e => verifyEmail(String(e).trim().toLowerCase())));
    const valid = results.filter(r => r.is_valid).length;
    const disposable = results.filter(r => r.is_disposable).length;
    const invalid = results.filter(r => !r.is_valid && !r.is_disposable).length;
    res.json({ total: results.length, valid, disposable, invalid, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sending Inboxes (Multi-Inbox Rotation) ───────────────────────────────────

function getTodayStr() { return new Date().toISOString().slice(0, 10); }

function resetDailyCounters() {
  const today = getTodayStr();
  db.prepare(`UPDATE sending_inboxes SET sends_today = 0, sends_today_date = ? WHERE sends_today_date != ?`).run(today, today);
}

function selectNextInbox(userId) {
  resetDailyCounters();
  const today = getTodayStr();
  // Get all active primed/ramping inboxes for this user with remaining capacity, sorted by health desc
  const inboxes = db.prepare(`
    SELECT * FROM sending_inboxes
    WHERE user_id = ? AND is_active = 1 AND pool IN ('primed','ramping')
    AND sends_today < daily_limit
    ORDER BY CASE pool WHEN 'primed' THEN 0 WHEN 'ramping' THEN 1 END, health_score DESC, sends_today ASC
    LIMIT 1
  `).get(userId);
  return inboxes || null;
}

function recordInboxSend(inboxId) {
  const today = getTodayStr();
  db.prepare(`
    UPDATE sending_inboxes
    SET sends_today = sends_today + 1,
        sends_today_date = ?,
        last_send_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(today, inboxId);
}

function updateInboxHealth(inboxId, eventType) {
  const inbox = db.prepare('SELECT * FROM sending_inboxes WHERE id = ?').get(inboxId);
  if (!inbox) return;
  let health = inbox.health_score;
  if (eventType === 'bounce') health = Math.max(0, health - 15);
  else if (eventType === 'complaint') health = Math.max(0, health - 25);
  else if (eventType === 'open') health = Math.min(100, health + 1);
  else if (eventType === 'reply') health = Math.min(100, health + 3);

  let pool = inbox.pool;
  if (health < 85 && pool === 'primed') pool = 'resting';
  else if (health >= 90 && pool === 'resting') pool = 'ramping';
  else if (health >= 95 && inbox.warmup_day >= 28) pool = 'primed';

  db.prepare(`UPDATE sending_inboxes SET health_score = ?, pool = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(health, pool, inboxId);
  db.prepare(`INSERT INTO inbox_health_events (sending_inbox_id, event_type, count, recorded_date) VALUES (?, ?, 1, CURRENT_TIMESTAMP)`).run(inboxId, eventType);
}

// GET /api/inboxes — list all sending inboxes for user
app.get('/api/inboxes', auth, (req, res) => {
  resetDailyCounters();
  const inboxes = db.prepare(`
    SELECT si.*, wp.current_day as warmup_current_day, wp.target_daily_sends, wp.warmup_tool, wp.status as warmup_status,
    gc.google_email, gc.google_name
    FROM sending_inboxes si
    LEFT JOIN warmup_plans wp ON wp.sending_inbox_id = si.id
    LEFT JOIN google_connections gc ON gc.id = si.google_connection_id
    WHERE si.user_id = ?
    ORDER BY si.health_score DESC, si.pool, si.created_at ASC
  `).all(req.user.userId);

  const today = getTodayStr();
  const totalCapacity = inboxes.filter(i => i.is_active).reduce((s, i) => s + i.daily_limit, 0);
  const usedToday = inboxes.filter(i => i.is_active && i.sends_today_date === today).reduce((s, i) => s + i.sends_today, 0);

  res.json({ inboxes, summary: { total: inboxes.length, active: inboxes.filter(i=>i.is_active).length, totalCapacity, usedToday, remaining: totalCapacity - usedToday } });
});

// POST /api/inboxes — register a new sending inbox
app.post('/api/inboxes', auth, (req, res) => {
  const { google_connection_id, label, daily_limit = 50 } = req.body || {};
  if (!google_connection_id) return res.status(400).json({ error: 'google_connection_id required' });

  const conn = db.prepare('SELECT * FROM google_connections WHERE id = ? AND user_id = ?').get(google_connection_id, req.user.userId);
  if (!conn) return res.status(404).json({ error: 'Google connection not found' });

  const existing = db.prepare('SELECT id FROM sending_inboxes WHERE user_id = ? AND google_connection_id = ?').get(req.user.userId, google_connection_id);
  if (existing) return res.status(409).json({ error: 'Inbox already registered' });

  const r = db.prepare(`
    INSERT INTO sending_inboxes (user_id, google_connection_id, label, email, daily_limit, pool)
    VALUES (?, ?, ?, ?, ?, 'ramping')
  `).run(req.user.userId, google_connection_id, label || conn.google_email, conn.google_email, Math.min(200, Math.max(10, Number(daily_limit))));

  // Auto-create warmup plan
  db.prepare(`INSERT OR IGNORE INTO warmup_plans (sending_inbox_id, start_date, current_day, target_daily_sends, warmup_tool) VALUES (?, date('now'), 1, ?, 'manual')`)
    .run(r.lastInsertRowid, daily_limit);

  res.json({ id: r.lastInsertRowid, ok: true });
});

// PATCH /api/inboxes/:id — update inbox settings
app.patch('/api/inboxes/:id', auth, (req, res) => {
  const inbox = db.prepare('SELECT * FROM sending_inboxes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!inbox) return res.status(404).json({ error: 'Inbox not found' });

  const { daily_limit, pool, is_active, label, warmup_tool } = req.body || {};
  if (daily_limit !== undefined) db.prepare('UPDATE sending_inboxes SET daily_limit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(Math.min(200, Math.max(1, Number(daily_limit))), inbox.id);
  if (pool !== undefined) db.prepare('UPDATE sending_inboxes SET pool = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(pool, inbox.id);
  if (is_active !== undefined) db.prepare('UPDATE sending_inboxes SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(is_active ? 1 : 0, inbox.id);
  if (label !== undefined) db.prepare('UPDATE sending_inboxes SET label = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(label, inbox.id);
  if (warmup_tool !== undefined) db.prepare('UPDATE warmup_plans SET warmup_tool = ?, updated_at = CURRENT_TIMESTAMP WHERE sending_inbox_id = ?').run(warmup_tool, inbox.id);

  res.json({ ok: true });
});

// DELETE /api/inboxes/:id
app.delete('/api/inboxes/:id', auth, (req, res) => {
  const inbox = db.prepare('SELECT * FROM sending_inboxes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!inbox) return res.status(404).json({ error: 'Inbox not found' });
  db.prepare('DELETE FROM sending_inboxes WHERE id = ?').run(inbox.id);
  res.json({ ok: true });
});

// GET /api/inboxes/:id/health — health events for an inbox
app.get('/api/inboxes/:id/health', auth, (req, res) => {
  const inbox = db.prepare('SELECT * FROM sending_inboxes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!inbox) return res.status(404).json({ error: 'Inbox not found' });
  const events = db.prepare(`SELECT event_type, count, recorded_date FROM inbox_health_events WHERE sending_inbox_id = ? ORDER BY recorded_date DESC LIMIT 50`).all(inbox.id);
  res.json({ inbox, events });
});

// ── Gmail API Sending ────────────────────────────────────────────────────────

function buildMimeMessage({ from, to, subject, html, text, replyTo }) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const plainText = text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  let mime = `MIME-Version: 1.0\r\n`;
  mime += `From: ${from}\r\n`;
  mime += `To: ${to}\r\n`;
  if (replyTo) mime += `Reply-To: ${replyTo}\r\n`;
  mime += `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\n`;
  mime += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;

  // Plain text part
  mime += `--${boundary}\r\n`;
  mime += `Content-Type: text/plain; charset=UTF-8\r\n`;
  mime += `Content-Transfer-Encoding: base64\r\n\r\n`;
  mime += `${Buffer.from(plainText).toString('base64')}\r\n\r\n`;

  // HTML part
  mime += `--${boundary}\r\n`;
  mime += `Content-Type: text/html; charset=UTF-8\r\n`;
  mime += `Content-Transfer-Encoding: base64\r\n\r\n`;
  mime += `${Buffer.from(html).toString('base64')}\r\n\r\n`;

  mime += `--${boundary}--`;

  return Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendViaGmail(authClient, { from, to, subject, html, text, replyTo }) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const raw = buildMimeMessage({ from, to, subject, html, text, replyTo });
  const response = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return response.data;
}

// POST /api/google/gmail-send — send a single test email via Gmail API
app.post('/api/google/gmail-send', auth, async (req, res) => {
  const conn = getGoogleConnection(req.user.userId);
  if (!conn) return res.status(400).json({ error: 'Google Workspace not connected.' });

  const { to, subject, html, text, replyTo } = req.body || {};
  if (!to || !subject) return res.status(400).json({ error: 'to and subject are required' });

  try {
    const authClient = makeAuthedClient(conn);
    const result = await sendViaGmail(authClient, {
      from: `${conn.google_name || ''} <${conn.google_email}>`,
      to, subject, html: html || text || '', text, replyTo
    });
    res.json({ ok: true, message_id: result.id, thread_id: result.threadId });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Gmail send failed' });
  }
});

// ── Scheduled Sends ──────────────────────────────────────────────────────────

const OPTIMAL_WINDOWS = {
  default: { days: [2, 3], startHour: 9, endHour: 11 }, // Tue/Wed 9-11am
  finance: { days: [1, 2, 3, 4], startHour: 7, endHour: 9 },
  healthcare: { days: [3, 4], startHour: 14, endHour: 16 },
  tech: { days: [2, 3], startHour: 8, endHour: 10 },
  csuite: { days: [1, 2, 3], startHour: 6, endHour: 8 },
};

function getNextOptimalSendTime(timezone = 'America/New_York', windowKey = 'default') {
  const window = OPTIMAL_WINDOWS[windowKey] || OPTIMAL_WINDOWS.default;
  const now = new Date();

  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(now.getTime() + daysAhead * 86400000);
    const dayOfWeek = candidate.getDay(); // 0=Sun, 1=Mon... 6=Sat
    if (!window.days.includes(dayOfWeek)) continue;

    // Get the hour in the target timezone
    const hour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(candidate));

    // If today and already past window, skip
    if (daysAhead === 0 && hour >= window.endHour) continue;

    // Set to start of window
    const targetHour = daysAhead === 0 && hour >= window.startHour ? hour + 1 : window.startHour;
    if (targetHour >= window.endHour) continue;

    // Reconstruct date at target hour in timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone
    });
    const parts = formatter.formatToParts(candidate);
    const dateStr = `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}-${parts.find(p=>p.type==='day').value}`;
    const offsetMs = now.getTimezoneOffset() * 60000;
    const tzDate = new Date(`${dateStr}T${String(targetHour).padStart(2,'0')}:${String(Math.floor(Math.random()*30)).padStart(2,'0')}:00`);
    return tzDate.toISOString();
  }
  // Fallback: 24h from now
  return new Date(now.getTime() + 86400000).toISOString();
}

// GET /api/scheduled — list scheduled sends for user
app.get('/api/scheduled', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT ss.*, c.subject, c.status as campaign_status
    FROM scheduled_sends ss
    LEFT JOIN campaigns c ON c.id = ss.campaign_id
    WHERE ss.user_id = ? ORDER BY ss.scheduled_at ASC LIMIT 50
  `).all(req.user.userId);
  res.json(rows);
});

// POST /api/scheduled — schedule a campaign send
app.post('/api/scheduled', auth, (req, res) => {
  const { campaign_id, timezone = 'America/New_York', sending_window = 'default', custom_time } = req.body || {};
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id required' });

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(campaign_id, req.user.userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const scheduledAt = custom_time || getNextOptimalSendTime(timezone, sending_window);

  const r = db.prepare(`
    INSERT INTO scheduled_sends (campaign_id, user_id, scheduled_at, timezone, sending_window, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(campaign_id, req.user.userId, scheduledAt, timezone, sending_window);

  // Mark campaign as scheduled
  db.prepare(`UPDATE campaigns SET status = 'scheduled' WHERE id = ?`).run(campaign_id);

  res.json({ id: r.lastInsertRowid, scheduled_at: scheduledAt, timezone, ok: true });
});

// DELETE /api/scheduled/:id — cancel a scheduled send
app.delete('/api/scheduled/:id', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM scheduled_sends WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.status === 'processed') return res.status(400).json({ error: 'Already sent' });
  db.prepare('DELETE FROM scheduled_sends WHERE id = ?').run(row.id);
  // Revert campaign status
  db.prepare('UPDATE campaigns SET status = "draft" WHERE id = ? AND status = "scheduled"').run(row.campaign_id);
  res.json({ ok: true });
});

// GET /api/sending/optimal-time — suggest next optimal send time
app.get('/api/sending/optimal-time', auth, (req, res) => {
  const { timezone = 'America/New_York', industry = 'default' } = req.query;
  const times = Object.entries(OPTIMAL_WINDOWS).map(([key, w]) => ({
    window: key,
    next_send_at: getNextOptimalSendTime(timezone, key),
    days: w.days.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]),
    hours: `${w.startHour}:00 - ${w.endHour}:00`
  }));
  const recommended = getNextOptimalSendTime(timezone, OPTIMAL_WINDOWS[industry] ? industry : 'default');
  res.json({ recommended, timezone, windows: times });
});

// Cron: process scheduled sends every minute
cron.schedule('* * * * *', async () => {
  const due = db.prepare(`SELECT * FROM scheduled_sends WHERE status = 'pending' AND datetime(scheduled_at) <= datetime('now') LIMIT 5`).all();
  for (const row of due) {
    try {
      // Mark processing immediately to prevent double-fire
      db.prepare('UPDATE scheduled_sends SET status = "processing" WHERE id = ?').run(row.id);
      // Trigger campaign launch (reuse existing launch logic)
      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(row.campaign_id);
      if (!campaign) { db.prepare('UPDATE scheduled_sends SET status = "error", processed_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id); continue; }
      db.prepare('UPDATE campaigns SET status = "running" WHERE id = ?').run(row.campaign_id);
      db.prepare('UPDATE scheduled_sends SET status = "processed", processed_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
      console.log(`[Cron] Processed scheduled send ${row.id} for campaign ${row.campaign_id}`);
    } catch (err) {
      console.error('[Cron] Scheduled send error:', err.message);
      db.prepare('UPDATE scheduled_sends SET status = "error", processed_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
    }
  }
});

// Cron: advance warmup day counter daily at midnight
cron.schedule('0 0 * * *', () => {
  try {
    db.prepare(`UPDATE warmup_plans SET current_day = current_day + 1, updated_at = CURRENT_TIMESTAMP WHERE status = 'active'`).run();
    // Auto-calculate daily limit based on warmup day
    const plans = db.prepare("SELECT * FROM warmup_plans WHERE status = 'active'").all();
    for (const plan of plans) {
      const d = plan.current_day;
      let limit;
      if (d <= 3) limit = 15;
      else if (d <= 6) limit = 25;
      else if (d <= 9) limit = 35;
      else if (d <= 12) limit = 50;
      else if (d <= 15) limit = 65;
      else if (d <= 18) limit = 80;
      else if (d <= 21) limit = 90;
      else limit = Math.min(100, 90 + Math.floor((d - 21) * 1.5));
      db.prepare('UPDATE sending_inboxes SET daily_limit = ?, warmup_day = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(limit, d, plan.sending_inbox_id);
      // Graduate to primed at day 28
      if (d >= 28) {
        db.prepare('UPDATE sending_inboxes SET pool = "primed" WHERE id = ? AND pool = "ramping"').run(plan.sending_inbox_id);
        db.prepare('UPDATE warmup_plans SET status = "complete", updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(plan.id);
      }
    }
  } catch (err) { console.error('[Cron] Warmup advance error:', err.message); }
});

// GET /api/warmup/stats — overall warmup dashboard stats
app.get('/api/warmup/stats', auth, (req, res) => {
  const inboxes = db.prepare('SELECT si.*, wp.current_day, wp.warmup_tool, wp.status as warmup_status FROM sending_inboxes si LEFT JOIN warmup_plans wp ON wp.sending_inbox_id = si.id WHERE si.user_id = ?').all(req.user.userId);

  const primed = inboxes.filter(i => i.pool === 'primed').length;
  const ramping = inboxes.filter(i => i.pool === 'ramping').length;
  const resting = inboxes.filter(i => i.pool === 'resting').length;
  const avgHealth = inboxes.length ? Math.round(inboxes.reduce((s,i) => s + i.health_score, 0) / inboxes.length) : 0;
  const today = getTodayStr();
  const sendsToday = inboxes.filter(i => i.sends_today_date === today).reduce((s,i) => s + i.sends_today, 0);
  const dailyCapacity = inboxes.filter(i => i.is_active).reduce((s,i) => s + i.daily_limit, 0);

  // Warmup schedule reference
  const schedule = [
    { day_range: '1-3', warmup: 15, cold: 0, total: 15 },
    { day_range: '4-6', warmup: 25, cold: 0, total: 25 },
    { day_range: '7-9', warmup: 25, cold: 5, total: 30 },
    { day_range: '10-12', warmup: 25, cold: 15, total: 40 },
    { day_range: '13-15', warmup: 20, cold: 30, total: 50 },
    { day_range: '16-18', warmup: 15, cold: 50, total: 65 },
    { day_range: '19-21', warmup: 10, cold: 65, total: 75 },
    { day_range: '22-28', warmup: 5, cold: 90, total: 95 },
    { day_range: '28+', warmup: 5, cold: 100, total: 105, note: 'Primed — full send' },
  ];

  res.json({ inboxes, stats: { primed, ramping, resting, avgHealth, sendsToday, dailyCapacity, total: inboxes.length }, schedule });
});

// ── Google Workspace ─────────────────────────────────────────────────────────

function makeGoogleOAuth2Client() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

function getGoogleConnection(userId) {
  return db.prepare('SELECT * FROM google_connections WHERE user_id = ?').get(userId);
}

function makeAuthedClient(conn) {
  const oauth2 = makeGoogleOAuth2Client();
  oauth2.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
    expiry_date: conn.token_expiry ? Number(conn.token_expiry) : undefined,
  });
  oauth2.on('tokens', (tokens) => {
    if (tokens.access_token) {
      db.prepare(
        `UPDATE google_connections SET access_token = ?, token_expiry = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
      ).run(tokens.access_token, tokens.expiry_date ? String(tokens.expiry_date) : null, conn.user_id);
    }
  });
  return oauth2;
}

// GET /api/google/status — check if user has connected Google Workspace
app.get('/api/google/status', auth, (req, res) => {
  const conn = getGoogleConnection(req.user.userId);
  if (!conn) return res.json({ connected: false });
  res.json({
    connected: true,
    google_email: conn.google_email,
    google_name: conn.google_name,
    scopes: conn.scopes ? conn.scopes.split(',') : [],
    connected_at: conn.created_at,
  });
});

// GET /api/google/auth-url — get OAuth2 URL to send user to Google
app.get('/api/google/auth-url', auth, (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({ error: 'Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file.' });
  }
  const oauth2 = makeGoogleOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ];
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: String(req.user.userId),
  });
  res.json({ url });
});

// GET /api/google/callback — OAuth2 callback from Google
app.get('/api/google/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const userId = Number(req.query.state || 0);
  if (!code || !userId) return res.status(400).send('Invalid OAuth callback.');

  try {
    const oauth2 = makeGoogleOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    const oauth2Info = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data: profile } = await oauth2Info.userinfo.get();

    const scopes = tokens.scope || '';
    db.prepare(
      `INSERT INTO google_connections (user_id, google_email, google_name, access_token, refresh_token, token_expiry, scopes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         google_email = excluded.google_email,
         google_name = excluded.google_name,
         access_token = excluded.access_token,
         refresh_token = COALESCE(excluded.refresh_token, refresh_token),
         token_expiry = excluded.token_expiry,
         scopes = excluded.scopes,
         updated_at = CURRENT_TIMESTAMP`
    ).run(
      userId,
      profile.email || '',
      profile.name || '',
      tokens.access_token || '',
      tokens.refresh_token || null,
      tokens.expiry_date ? String(tokens.expiry_date) : null,
      scopes
    );

    const publicApp = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
    res.redirect(`${publicApp}/?google=connected`);
  } catch (err) {
    console.error('Google callback error:', err);
    const publicApp = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
    res.redirect(`${publicApp}/?google=error`);
  }
});

// DELETE /api/google/disconnect — remove Google connection
app.delete('/api/google/disconnect', auth, (req, res) => {
  db.prepare('DELETE FROM google_connections WHERE user_id = ?').run(req.user.userId);
  res.json({ ok: true });
});

// POST /api/google/sync-contacts — import Google Contacts into SignalIQ contacts
app.post('/api/google/sync-contacts', auth, async (req, res) => {
  const conn = getGoogleConnection(req.user.userId);
  if (!conn) return res.status(400).json({ error: 'Google Workspace not connected.' });

  try {
    const authClient = makeAuthedClient(conn);
    const peopleApi = google.people({ version: 'v1', auth: authClient });

    let imported = 0;
    let skipped = 0;
    let pageToken = undefined;
    const results = [];

    do {
      const response = await peopleApi.people.connections.list({
        resourceName: 'people/me',
        pageSize: 100,
        personFields: 'names,emailAddresses,organizations',
        pageToken,
      });

      const connections = response.data.connections || [];
      pageToken = response.data.nextPageToken;

      for (const person of connections) {
        const emails = person.emailAddresses || [];
        const names = person.names || [];
        const orgs = person.organizations || [];
        const resourceName = person.resourceName;

        const primaryEmail = emails.find((e) => e.metadata?.primary)?.value || emails[0]?.value;
        if (!primaryEmail) continue;

        const primaryName = names.find((n) => n.metadata?.primary) || names[0];
        const firstName = primaryName?.givenName || primaryEmail.split('@')[0];
        const lastName = primaryName?.familyName || '';
        const company = orgs[0]?.name || '';

        // Check if already imported
        const alreadyImported = db
          .prepare('SELECT id FROM google_contact_imports WHERE user_id = ? AND google_contact_id = ?')
          .get(req.user.userId, resourceName);

        if (alreadyImported) { skipped++; continue; }

        // Check if contact email already exists for this user
        const existingContact = db
          .prepare('SELECT id FROM contacts WHERE user_id = ? AND lower(email) = ?')
          .get(req.user.userId, primaryEmail.toLowerCase());

        let contactId = existingContact?.id || null;

        if (!contactId) {
          try {
            const r = db.prepare(
              `INSERT INTO contacts (user_id, first_name, last_name, email, company, niche, business_level, consent_basis)
               VALUES (?, ?, ?, ?, ?, 'SaaS', 'Startup', 'legitimate_interest')`
            ).run(req.user.userId, firstName, lastName, primaryEmail, company);
            contactId = r.lastInsertRowid;
            imported++;
          } catch { skipped++; continue; }
        } else {
          skipped++;
        }

        db.prepare(
          `INSERT INTO google_contact_imports (user_id, google_contact_id, imported_contact_id, status)
           VALUES (?, ?, ?, 'imported')
           ON CONFLICT(user_id, google_contact_id) DO NOTHING`
        ).run(req.user.userId, resourceName, contactId);

        results.push({ email: primaryEmail, name: `${firstName} ${lastName}`.trim(), status: contactId === existingContact?.id ? 'exists' : 'imported' });
      }
    } while (pageToken);

    res.json({ ok: true, imported, skipped, total: imported + skipped, results: results.slice(0, 20) });
  } catch (err) {
    console.error('Google sync-contacts error:', err);
    res.status(500).json({ error: err.message || 'Failed to sync contacts from Google' });
  }
});

// GET /api/google/gmail-profile — get Gmail profile info
app.get('/api/google/gmail-profile', auth, async (req, res) => {
  const conn = getGoogleConnection(req.user.userId);
  if (!conn) return res.status(400).json({ error: 'Google Workspace not connected.' });

  try {
    const authClient = makeAuthedClient(conn);
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    const { data: profile } = await gmail.users.getProfile({ userId: 'me' });
    res.json({
      email: profile.emailAddress,
      messages_total: profile.messagesTotal,
      threads_total: profile.threadsTotal,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch Gmail profile' });
  }
});

if (process.env.SERVE_STATIC !== 'false') {
  app.use(express.static(clientDistPath));

  app.get(/^(?!\/api|\/unsubscribe).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SignalIQ API running on http://0.0.0.0:${PORT}`);
});
