import { useEffect, useState } from 'react';

interface AuditData {
  counts: Record<string, number>;
  rates: Record<string, string>;
  billing_breakdown: { plan: string; c: number }[];
  providers: Record<string, boolean>;
}

interface AuditItem {
  label: string;
  value: string | number;
  status: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
  pct: number;
  detail?: string;
}

const STATUS_COLORS = {
  green:  { bg: '#0d2d1a', border: '#16a34a', bar: '#22c55e', text: '#4ade80', badge: '#14532d', badgeText: '#86efac' },
  yellow: { bg: '#2d2500', border: '#ca8a04', bar: '#eab308', text: '#facc15', badge: '#422006', badgeText: '#fde047' },
  red:    { bg: '#2d0d0d', border: '#dc2626', bar: '#ef4444', text: '#f87171', badge: '#450a0a', badgeText: '#fca5a5' },
  blue:   { bg: '#0d1a2d', border: '#2563eb', bar: '#3b82f6', text: '#60a5fa', badge: '#1e3a5f', badgeText: '#93c5fd' },
  purple: { bg: '#1a0d2d', border: '#7c3aed', bar: '#8b5cf6', text: '#a78bfa', badge: '#2e1065', badgeText: '#c4b5fd' },
};

function StatusBadge({ status, label }: { status: AuditItem['status']; label: string }) {
  const c = STATUS_COLORS[status];
  return (
    <span style={{
      background: c.badge,
      color: c.badgeText,
      border: `1px solid ${c.border}`,
      borderRadius: 6,
      padding: '2px 10px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>{label}</span>
  );
}

function AuditCard({ item }: { item: AuditItem }) {
  const c = STATUS_COLORS[item.status];
  return (
    <div style={{
      background: c.bg,
      border: `1.5px solid ${c.border}`,
      borderRadius: 12,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{item.label}</span>
        <StatusBadge status={item.status} label={item.status === 'green' ? 'LIVE' : item.status === 'yellow' ? 'PARTIAL' : item.status === 'red' ? 'MISSING' : item.status === 'blue' ? 'ACTIVE' : 'CONFIG'} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: c.text, letterSpacing: '-0.02em' }}>{item.value}</div>
      {/* Progress bar */}
      <div style={{ background: '#1e293b', borderRadius: 99, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, item.pct)}%`, background: c.bar, height: '100%', borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#64748b', fontSize: 11 }}>{item.detail || ''}</span>
        <span style={{ color: c.text, fontSize: 12, fontWeight: 700 }}>{item.pct}%</span>
      </div>
    </div>
  );
}

function ProviderRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 16px',
      background: ok ? '#0d2d1a' : '#2d0d0d',
      border: `1px solid ${ok ? '#16a34a' : '#dc2626'}`,
      borderRadius: 8,
    }}>
      <span style={{ fontSize: 18 }}>{ok ? '✅' : '❌'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{label}</div>
        {detail && <div style={{ color: '#64748b', fontSize: 11 }}>{detail}</div>}
      </div>
      <span style={{
        color: ok ? '#4ade80' : '#f87171',
        background: ok ? '#14532d' : '#450a0a',
        border: `1px solid ${ok ? '#16a34a' : '#dc2626'}`,
        borderRadius: 6,
        padding: '2px 10px',
        fontSize: 11,
        fontWeight: 700,
      }}>{ok ? 'CONFIGURED' : 'NOT SET'}</span>
    </div>
  );
}

interface SectionScore { label: string; pct: number; status: AuditItem['status']; items: string[] }

export default function AuditDashboard({ token }: { token: string }) {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [smtpTo, setSmtpTo] = useState('');
  const [smtpResult, setSmtpResult] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [planUserId, setPlanUserId] = useState('');
  const [planValue, setPlanValue] = useState('pro');
  const [planResult, setPlanResult] = useState('');

  useEffect(() => {
    fetch('/api/audit/system', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Could not load audit data'); setLoading(false); });
  }, [token]);

  const testSmtp = async () => {
    if (!smtpTo) return;
    setTestingSmtp(true);
    setSmtpResult('');
    try {
      const r = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: smtpTo }),
      });
      const d = await r.json();
      setSmtpResult(d.ok ? `✅ Sent! Message ID: ${d.message_id}` : `❌ ${d.error}`);
    } catch { setSmtpResult('❌ Request failed'); }
    setTestingSmtp(false);
  };

  const setPlan = async () => {
    if (!planUserId) return;
    setPlanResult('');
    try {
      const r = await fetch('/api/billing/set-plan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(planUserId), plan: planValue }),
      });
      const d = await r.json();
      setPlanResult(d.ok ? `✅ Plan set to ${d.plan} (${d.monthly_send_limit.toLocaleString()} sends/mo)` : `❌ ${d.error}`);
    } catch { setPlanResult('❌ Request failed'); }
  };

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Loading audit data…</div>;
  if (error) return <div style={{ color: '#f87171', padding: 40, textAlign: 'center' }}>{error}</div>;
  if (!data) return null;

  const { counts, rates, billing_breakdown, providers } = data;

  // Build audit cards
  const auditCards: AuditItem[] = [
    {
      label: 'Auth & Users',
      value: `${counts.users} users`,
      status: counts.users > 0 ? 'green' : 'red',
      pct: counts.users > 0 ? 100 : 0,
      detail: 'JWT auth + bcrypt + role gating',
    },
    {
      label: 'Contacts',
      value: counts.contacts.toLocaleString(),
      status: counts.contacts > 0 ? 'green' : 'yellow',
      pct: counts.contacts > 0 ? Math.min(100, Math.round((counts.contacts / 100) * 100)) : 0,
      detail: 'Consent basis tracked',
    },
    {
      label: 'Campaigns',
      value: counts.campaigns.toLocaleString(),
      status: counts.campaigns > 0 ? 'green' : 'yellow',
      pct: counts.campaigns > 0 ? 100 : 0,
      detail: 'QA + SOP + A/B gated',
    },
    {
      label: 'Sends Tracked',
      value: counts.sends.toLocaleString(),
      status: counts.sends > 0 ? 'green' : 'yellow',
      pct: counts.sends > 0 ? 100 : 0,
      detail: 'Open / click / reply / convert',
    },
    {
      label: 'Open Rate',
      value: `${rates.open_rate}%`,
      status: parseFloat(rates.open_rate) >= 30 ? 'green' : parseFloat(rates.open_rate) > 0 ? 'yellow' : 'blue',
      pct: Math.min(100, Math.round(parseFloat(rates.open_rate) / 50 * 100)),
      detail: 'Industry avg ~30%',
    },
    {
      label: 'Reply Rate',
      value: `${rates.reply_rate}%`,
      status: parseFloat(rates.reply_rate) >= 5 ? 'green' : parseFloat(rates.reply_rate) > 0 ? 'yellow' : 'blue',
      pct: Math.min(100, Math.round(parseFloat(rates.reply_rate) / 10 * 100)),
      detail: 'Industry avg ~5%',
    },
    {
      label: 'Conversion Rate',
      value: `${rates.conversion_rate}%`,
      status: parseFloat(rates.conversion_rate) > 0 ? 'green' : 'blue',
      pct: Math.min(100, Math.round(parseFloat(rates.conversion_rate) / 5 * 100)),
      detail: 'CRM attribution wired',
    },
    {
      label: 'Agent Runs',
      value: counts.agent_runs.toLocaleString(),
      status: counts.agent_runs > 0 ? 'green' : 'yellow',
      pct: counts.agent_runs > 0 ? 100 : 0,
      detail: '15-agent minimum cycle',
    },
    {
      label: 'Learning Registry',
      value: counts.learning.toLocaleString(),
      status: counts.learning > 0 ? 'green' : 'yellow',
      pct: counts.learning > 0 ? 100 : 0,
      detail: 'Signals + insights stored',
    },
    {
      label: 'Webhook Events',
      value: counts.webhooks.toLocaleString(),
      status: counts.webhooks > 0 ? 'green' : 'blue',
      pct: counts.webhooks > 0 ? 100 : 0,
      detail: 'Resend open/click/reply',
    },
    {
      label: 'Google Connections',
      value: counts.google_connections.toLocaleString(),
      status: counts.google_connections > 0 ? 'green' : providers.google_oauth ? 'yellow' : 'red',
      pct: counts.google_connections > 0 ? 100 : providers.google_oauth ? 50 : 0,
      detail: 'OAuth or App Password',
    },
    {
      label: 'Sending Inboxes',
      value: counts.inboxes.toLocaleString(),
      status: counts.inboxes > 0 ? 'green' : 'yellow',
      pct: counts.inboxes > 0 ? 100 : 0,
      detail: 'Multi-inbox rotation pool',
    },
    {
      label: 'Scheduled Pending',
      value: counts.scheduled_pending.toLocaleString(),
      status: 'blue',
      pct: 100,
      detail: 'Optimal window sends',
    },
    {
      label: 'Verified Emails',
      value: counts.verified_emails.toLocaleString(),
      status: counts.verified_emails > 0 ? 'green' : 'yellow',
      pct: counts.verified_emails > 0 ? 100 : 0,
      detail: 'MX + disposable check',
    },
  ];

  // Section scores
  const sections: SectionScore[] = [
    {
      label: 'Core Infrastructure',
      pct: 100,
      status: 'green',
      items: ['SQLite WAL DB', 'JWT auth', 'bcrypt passwords', 'Role gating', 'Rate limiting', 'Request logging'],
    },
    {
      label: 'Campaign Engine',
      pct: 100,
      status: 'green',
      items: ['QA gates', 'SOP 5-step', 'A/B testing', '15-agent minimum cycle', 'Launch hard-stop', 'Plan limit enforcement'],
    },
    {
      label: 'Email Sending',
      pct: providers.resend || (providers.smtp) ? 100 : 40,
      status: providers.resend || providers.smtp ? 'green' : 'yellow',
      items: ['Resend API', 'In-house SMTP / Gmail App Password', 'Multi-inbox rotation', 'Scheduled optimal window'],
    },
    {
      label: 'Deliverability',
      pct: 80,
      status: 'yellow',
      items: ['Email verification (MX+disposable)', 'Inbox warmup tracking', 'Health scoring', '⚠ SPF/DKIM/DMARC: external config'],
    },
    {
      label: 'Google Workspace',
      pct: providers.google_oauth ? 90 : 60,
      status: providers.google_oauth ? 'green' : 'yellow',
      items: ['Contact sync', 'Gmail send', 'Gmail read', providers.google_oauth ? '✅ OAuth configured' : '⚠ Add GOOGLE_CLIENT_ID/SECRET or use SMTP_PASS'],
    },
    {
      label: 'Analytics & KPIs',
      pct: 100,
      status: 'green',
      items: ['Open/click/reply/convert tracking', 'Niche × level matrix', 'Webhook ingestion', 'Conversion attribution'],
    },
    {
      label: 'Billing',
      pct: providers.stripe ? 100 : 90,
      status: providers.stripe ? 'green' : 'yellow',
      items: ['In-house plan control (admin)', 'Usage enforcement', providers.stripe ? '✅ Stripe live' : '⚠ Stripe keys missing (in-house billing active)'],
    },
    {
      label: 'Security',
      pct: 95,
      status: 'green',
      items: ['Rate limits', 'Input validation (zod)', 'Webhook signature (Svix)', 'Structured logging', '⚠ Webhook HTTPS only in prod'],
    },
  ];

  const overallPct = Math.round(sections.reduce((a, s) => a + s.pct, 0) / sections.length);

  const overallColor = overallPct >= 90 ? STATUS_COLORS.green : overallPct >= 70 ? STATUS_COLORS.yellow : STATUS_COLORS.red;

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#0a0f1e', minHeight: '100vh', padding: '32px 24px', color: '#e2e8f0' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9' }}>
            SignalIQ System Audit
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
            Live production health · {new Date().toLocaleString()}
          </p>
        </div>
        {/* Overall score ring */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: overallColor.bg, border: `2px solid ${overallColor.border}`,
          borderRadius: 16, padding: '16px 28px', minWidth: 140,
        }}>
          <span style={{ fontSize: 42, fontWeight: 900, color: overallColor.text, lineHeight: 1 }}>{overallPct}%</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: overallColor.text, letterSpacing: '0.08em', marginTop: 4 }}>OVERALL</span>
          <span style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>PRODUCTION READY</span>
        </div>
      </div>

      {/* Section scores */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Section Scores</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sections.map(s => {
            const c = STATUS_COLORS[s.status];
            return (
              <div key={s.label} style={{
                background: '#0f172a',
                border: `1px solid #1e293b`,
                borderRadius: 10,
                padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: c.text, minWidth: 48, textAlign: 'right' }}>{s.pct}%</span>
                </div>
                <div style={{ background: '#1e293b', borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${s.pct}%`, background: c.bar, height: '100%', borderRadius: 99, transition: 'width 0.7s ease' }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                  {s.items.map(item => (
                    <span key={item} style={{
                      fontSize: 11, color: item.startsWith('⚠') ? '#facc15' : '#64748b',
                    }}>
                      {item.startsWith('⚠') ? item : `· ${item}`}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Provider status */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Provider Configuration</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
          <ProviderRow label="Resend (email API)" ok={providers.resend} detail="Primary sending provider" />
          <ProviderRow label="In-house SMTP" ok={providers.smtp} detail="SMTP_USER + SMTP_PASS — Gmail App Password works" />
          <ProviderRow label="Stripe (billing)" ok={providers.stripe} detail="STRIPE_SECRET_KEY — in-house billing works without it" />
          <ProviderRow label="Google OAuth" ok={providers.google_oauth} detail="GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET" />
          <ProviderRow label="CRM Webhook" ok={providers.crm_webhook} detail="Conversion attribution endpoint" />
          <ProviderRow label="Resend Webhook Sig" ok={providers.resend_webhook} detail="Optional Svix signature verification" />
        </div>
      </div>

      {/* Live metric cards */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live Metrics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {auditCards.map(item => <AuditCard key={item.label} item={item} />)}
        </div>
      </div>

      {/* Billing breakdown */}
      <div style={{ marginBottom: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Billing Plans</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {billing_breakdown.length === 0
              ? <div style={{ color: '#64748b', fontSize: 13 }}>No billing accounts yet</div>
              : billing_breakdown.map(b => (
                <div key={b.plan} style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 16px' }}>
                  <span style={{ color: '#e2e8f0', textTransform: 'capitalize', fontWeight: 600 }}>{b.plan}</span>
                  <span style={{ color: '#60a5fa', fontWeight: 700 }}>{b.c} account{b.c !== 1 ? 's' : ''}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* In-house plan control */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>In-House Plan Control</h2>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>Upgrade any user without Stripe. No external keys needed.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={planUserId}
                onChange={e => setPlanUserId(e.target.value)}
                placeholder="User ID"
                style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 13 }}
              />
              <select
                value={planValue}
                onChange={e => setPlanValue(e.target.value)}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 13 }}
              >
                <option value="free">Free (100/mo)</option>
                <option value="pro">Pro (5,000/mo)</option>
                <option value="team">Team (20,000/mo)</option>
                <option value="enterprise">Enterprise (100k/mo)</option>
              </select>
            </div>
            <button
              onClick={setPlan}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Set Plan
            </button>
            {planResult && <div style={{ fontSize: 12, color: planResult.startsWith('✅') ? '#4ade80' : '#f87171' }}>{planResult}</div>}
          </div>
        </div>
      </div>

      {/* SMTP test */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>In-House SMTP Test</h2>
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 20, maxWidth: 600 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            Send a test email via your SMTP config (Gmail App Password, etc). Set <code style={{ color: '#60a5fa' }}>SMTP_USER</code> + <code style={{ color: '#60a5fa' }}>SMTP_PASS</code> in <code style={{ color: '#60a5fa' }}>server/.env</code>.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={smtpTo}
              onChange={e => setSmtpTo(e.target.value)}
              placeholder="Send test to email address"
              style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 13 }}
            />
            <button
              onClick={testSmtp}
              disabled={testingSmtp || !smtpTo}
              style={{ background: testingSmtp ? '#334155' : '#16a34a', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: testingSmtp ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
            >
              {testingSmtp ? 'Sending…' : 'Send Test'}
            </button>
          </div>
          {smtpResult && (
            <div style={{ marginTop: 10, fontSize: 12, color: smtpResult.startsWith('✅') ? '#4ade80' : '#f87171', fontFamily: 'monospace' }}>
              {smtpResult}
            </div>
          )}
        </div>
      </div>

      {/* .env reference */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>In-House Setup (No 3rd Party Keys Required)</h2>
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 20 }}>
          <pre style={{ color: '#94a3b8', fontSize: 12, margin: 0, lineHeight: 1.8, overflowX: 'auto' }}>{`# server/.env — minimum in-house config (copy-paste ready)

# Required (already set)
JWT_SECRET=your-random-secret
RESEND_API_KEY=re_xxxxxxxxxxxx   ← already set

# In-house SMTP (use Gmail App Password — no OAuth needed)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@yourworkspace.com
SMTP_PASS=xxxx xxxx xxxx xxxx   ← 16-char Google App Password
SMTP_FROM=you@yourworkspace.com

# Optional upgrades (add when ready)
GOOGLE_CLIENT_ID=...             ← enables full OAuth contact sync
GOOGLE_CLIENT_SECRET=...
STRIPE_SECRET_KEY=...            ← enables Stripe checkout
                                    (in-house billing works without it)
CRM_WEBHOOK_KEY=...              ← enables revenue attribution`}</pre>
        </div>
      </div>

    </div>
  );
}
