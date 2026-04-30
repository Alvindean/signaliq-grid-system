const API_URL = import.meta.env.VITE_API_URL || '';

export type User = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'pod_lead' | 'compliance' | 'prospecting' | 'copy' | 'ops' | 'analytics' | 'member';
};

export type Contact = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  niche: string;
  business_level: string;
  consent_basis: 'express' | 'legitimate_interest' | 'implied';
  unsubscribed: number;
};

export type Campaign = {
  id: number;
  name: string;
  niche: string;
  business_level: string;
  framework: string;
  predicted_conversion: number;
  actual_conversion: number | null;
  status: 'draft' | 'running';
  sent_count: number;
};

export type QaGate = {
  gate_type: 'self_check' | 'peer_check' | 'lead_signoff';
  passed: number;
  score: number;
  notes: string;
  reviewer_user_id: number;
  created_at: string;
};

export type QaStatus = {
  rows: QaGate[];
  ready: boolean;
};

export type SopStep = {
  step_key: string;
  completed: number;
  completed_by_user_id: number | null;
  completed_at: string | null;
};

export type SopStatus = {
  rows: SopStep[];
  completed: number;
  required: number;
  ready: boolean;
};

export type AbTest = {
  campaign_id: number;
  enabled: number;
  min_sample_size: number;
  variant_a_subject: string | null;
  variant_a_body: string | null;
  variant_b_subject: string | null;
  variant_b_body: string | null;
};

export type DashboardKpi = {
  sends: number;
  tracked_sends?: number;
  engagement_tracking_ready?: boolean;
  tracking_message?: string | null;
  event_count?: number;
  open_rate: number | null;
  click_rate: number | null;
  reply_rate: number | null;
  conversion_rate: number | null;
  cac: number | null;
};

export type DashboardSegment = {
  niche: string;
  business_level: string;
  sends: number;
  tracked_sends?: number;
  open_rate: number | null;
  click_rate: number | null;
  reply_rate: number | null;
  conversion_rate: number | null;
  cac: number | null;
};

export type DashboardVariant = {
  variant: string;
  sends: number;
  tracked_sends?: number;
  open_rate: number | null;
  click_rate: number | null;
  reply_rate: number | null;
  conversion_rate: number | null;
};

export type AgentRow = {
  agent_key: string;
  area: string;
  lane: 'build' | 'audit';
  status: 'pass' | 'fail' | 'not_run';
  score: number;
  notes: string;
  run_id: string | null;
  created_at?: string | null;
};

export type AgentSummary = {
  total: number;
  passed: number;
  failed: number;
  all_audits_passed: boolean;
  minimum_ready: boolean;
};

export type LearningRow = {
  id: number | string;
  title: string;
  category: string;
  impact: number;
  confidence: number;
  evidence: string;
  source: 'auto' | 'manual';
  created_at: string;
};

export type BillingStatus = {
  plan: 'free' | 'pro' | 'team';
  status: string;
  monthly_send_limit: number;
  sent_this_period: number;
  remaining_sends: number;
  period_key: string;
  current_period_end: string | null;
};

export type GoogleStatus = {
  connected: boolean;
  google_email?: string;
  google_name?: string;
  scopes?: string[];
  connected_at?: string;
};

export type GoogleSyncResult = {
  ok: boolean;
  imported: number;
  skipped: number;
  total: number;
  results: { email: string; name: string; status: string }[];
};

export type GmailProfile = {
  email: string;
  messages_total: number;
  threads_total: number;
};

export type LaunchStatus = {
  ready: boolean;
  send_provider: 'smtp' | 'resend' | 'simulation';
  sending_from: string;
  billing_mode: 'stripe' | 'in_house';
  providers: { resend: boolean; smtp: boolean; google_oauth: boolean; stripe: boolean };
  billing: BillingStatus;
  blockers: string[];
  warnings: string[];
};

export type SendingInbox = {
  id: number;
  user_id: number;
  google_connection_id: number;
  label: string;
  email: string;
  daily_limit: number;
  sends_today: number;
  sends_today_date: string;
  warmup_day: number;
  health_score: number;
  pool: 'primed' | 'ramping' | 'resting';
  is_active: number;
  last_send_at: string | null;
  warmup_current_day?: number;
  warmup_tool?: string;
  warmup_status?: string;
  google_email?: string;
  google_name?: string;
};

export type InboxSummary = {
  total: number;
  active: number;
  totalCapacity: number;
  usedToday: number;
  remaining: number;
};

export type WarmupStats = {
  inboxes: SendingInbox[];
  stats: {
    primed: number;
    ramping: number;
    resting: number;
    avgHealth: number;
    sendsToday: number;
    dailyCapacity: number;
    total: number;
  };
  schedule: { day_range: string; warmup: number; cold: number; total: number; note?: string }[];
};

export type EmailVerification = {
  email: string;
  is_valid: number;
  is_disposable: number;
  mx_found: number;
  score: number;
  reason: string;
};

export type BulkVerifyResult = {
  total: number;
  valid: number;
  disposable: number;
  invalid: number;
  results: EmailVerification[];
};

export type ScheduledSend = {
  id: number;
  campaign_id: number;
  scheduled_at: string;
  timezone: string;
  sending_window: string;
  status: 'pending' | 'processing' | 'processed' | 'error';
  subject?: string;
  campaign_status?: string;
};

export type OptimalTimeResult = {
  recommended: string;
  timezone: string;
  windows: { window: string; next_send_at: string; days: string[]; hours: string }[];
};

function getToken() {
  return localStorage.getItem('signaliq_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export const api = {
  setToken(token: string) {
    localStorage.setItem('signaliq_token', token);
  },
  clearToken() {
    localStorage.removeItem('signaliq_token');
  },
  getToken,

  health: () => request<{ ok: boolean; resend: boolean }>('/api/health'),
  me: () => request<User>('/api/me'),

  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  listUsers: () => request<User[]>('/api/admin/users'),
  setUserRole: (id: number, role: User['role']) =>
    request<User>(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  getContacts: () => request<Contact[]>('/api/contacts'),
  addContact: (payload: Omit<Contact, 'id' | 'unsubscribed'>) =>
    request<Contact>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCampaigns: () => request<Campaign[]>('/api/campaigns'),
  addCampaign: (payload: {
    name: string;
    niche: string;
    business_level: string;
    framework: string;
    predicted_conversion: number;
  }) =>
    request<Campaign>('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  launchCampaign: (id: number, payload: { subject: string; body: string; contactIds?: number[] }) =>
    request<{
      ok: boolean;
      sent: number;
      simulated: boolean;
      actual_conversion: number;
      funnel: { opened: number; clicked: number; replied: number; converted: number };
    }>(
      `/api/campaigns/${id}/launch`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  getQaGates: (campaignId: number) => request<QaStatus>(`/api/campaigns/${campaignId}/qa-gates`),
  saveQaGate: (
    campaignId: number,
    payload: { gate_type: 'self_check' | 'peer_check' | 'lead_signoff'; passed: boolean; score: number; notes: string }
  ) =>
    request<QaStatus>(`/api/campaigns/${campaignId}/qa-gates`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSop: (campaignId: number) => request<SopStatus>(`/api/campaigns/${campaignId}/sop`),
  saveSopStep: (campaignId: number, payload: { step_key: string; completed: boolean }) =>
    request<SopStatus>(`/api/campaigns/${campaignId}/sop`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAbTest: (campaignId: number) => request<AbTest>(`/api/campaigns/${campaignId}/ab-test`),
  saveAbTest: (
    campaignId: number,
    payload: {
      enabled: boolean;
      min_sample_size: number;
      variant_a_subject: string;
      variant_a_body: string;
      variant_b_subject: string;
      variant_b_body: string;
    }
  ) =>
    request<AbTest>(`/api/campaigns/${campaignId}/ab-test`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  matrix: () => request<{ campaigns: Campaign[]; signals: { signal: string; impact: string; confidence: number }[] }>('/api/matrix'),
  dashboard: () =>
    request<{ kpis: DashboardKpi; segments: DashboardSegment[]; variant: DashboardVariant[] }>('/api/dashboard/kpis'),
  agents: () => request<{ summary: AgentSummary; rows: AgentRow[] }>('/api/agents'),
  runAgentsMinimum: () =>
    request<{ run_id: string; summary: AgentSummary; rows: AgentRow[] }>('/api/agents/run-minimum', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getLearning: () => request<{ rows: LearningRow[] }>('/api/learning'),
  addLearning: (payload: { title: string; category: string; impact: number; confidence: number; evidence: string }) =>
    request<LearningRow>('/api/learning', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getBillingStatus: () => request<BillingStatus>('/api/billing/status'),
  getLaunchStatus: () => request<LaunchStatus>('/api/launch/status'),
  createCheckoutSession: (plan: 'pro' | 'team') =>
    request<{ url: string }>('/api/billing/checkout-session', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),
  createPortalSession: () =>
    request<{ url: string }>('/api/billing/portal-session', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  getGoogleStatus: () => request<GoogleStatus>('/api/google/status'),
  getGoogleAuthUrl: () => request<{ url: string }>('/api/google/auth-url'),
  disconnectGoogle: () => request<{ ok: boolean }>('/api/google/disconnect', { method: 'DELETE' }),
  syncGoogleContacts: () => request<GoogleSyncResult>('/api/google/sync-contacts', { method: 'POST', body: JSON.stringify({}) }),
  getGmailProfile: () => request<GmailProfile>('/api/google/gmail-profile'),

  // Gmail Send
  gmailSend: (payload: { to: string; subject: string; html: string; replyTo?: string }) =>
    request<{ ok: boolean; message_id: string; thread_id: string }>('/api/google/gmail-send', {
      method: 'POST', body: JSON.stringify(payload),
    }),

  // Multi-inbox / Sending Inboxes
  getInboxes: () => request<{ inboxes: SendingInbox[]; summary: InboxSummary }>('/api/inboxes'),
  addInbox: (payload: { google_connection_id: number; label?: string; daily_limit?: number }) =>
    request<{ id: number; ok: boolean }>('/api/inboxes', { method: 'POST', body: JSON.stringify(payload) }),
  updateInbox: (id: number, payload: Partial<{ daily_limit: number; pool: string; is_active: number; label: string; warmup_tool: string }>) =>
    request<{ ok: boolean }>(`/api/inboxes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteInbox: (id: number) => request<{ ok: boolean }>(`/api/inboxes/${id}`, { method: 'DELETE' }),

  // Warmup
  getWarmupStats: () => request<WarmupStats>('/api/warmup/stats'),

  // Email Verification
  verifyEmail: (email: string) => request<EmailVerification>('/api/verify/email', {
    method: 'POST', body: JSON.stringify({ email }),
  }),
  verifyBulk: (emails: string[]) => request<BulkVerifyResult>('/api/verify/bulk', {
    method: 'POST', body: JSON.stringify({ emails }),
  }),

  // Scheduled Sends
  getScheduled: () => request<ScheduledSend[]>('/api/scheduled'),
  schedulesCampaign: (payload: { campaign_id: number; timezone?: string; sending_window?: string; custom_time?: string }) =>
    request<{ id: number; scheduled_at: string; timezone: string; ok: boolean }>('/api/scheduled', {
      method: 'POST', body: JSON.stringify(payload),
    }),
  cancelScheduled: (id: number) => request<{ ok: boolean }>(`/api/scheduled/${id}`, { method: 'DELETE' }),
  getOptimalTime: (timezone?: string, industry?: string) =>
    request<OptimalTimeResult>(`/api/sending/optimal-time?timezone=${encodeURIComponent(timezone || 'America/New_York')}&industry=${industry || 'default'}`),
};
