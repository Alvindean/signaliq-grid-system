import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BookOpen, ClipboardCheck, CreditCard, Lightbulb, LogOut, Mail, Rocket, ShieldCheck, Users, Globe, FlaskConical } from 'lucide-react';
import './App.css';
import AuditDashboard from './AuditDashboard';
import {
  type AgentRow,
  type AgentSummary,
  api,
  type AbTest,
  type Campaign,
  type Contact,
  type DashboardKpi,
  type DashboardSegment,
  type DashboardVariant,
  type LearningRow,
  type BillingStatus,
  type LaunchStatus,
  type QaStatus,
  type SopStatus,
  type User,
  type GoogleStatus,
  type GoogleSyncResult,
  type GmailProfile,
  type SendingInbox,
  type InboxSummary,
  type WarmupStats,
  type EmailVerification,
  type BulkVerifyResult,
  type ScheduledSend,
  type OptimalTimeResult,
} from './api';

type TabKey = 'overview' | 'contacts' | 'campaigns' | 'library' | 'learning' | 'kpis' | 'ops' | 'agents' | 'billing' | 'team' | 'matrix' | 'google' | 'inboxes' | 'warmup' | 'scheduled' | 'verify' | 'audit';
type Role = User['role'];

const niches = ['SaaS', 'Fintech', 'Healthcare', 'E-commerce', 'Agency', 'Real Estate', 'Manufacturing'];
const levels = ['Startup', 'SMB', 'Mid-Market', 'Enterprise'];
const frameworks = ['AIDA', 'PAS', 'BAB', 'PASTOR', '4P', 'STAR', 'StoryBrand', 'Hormozi'];
const roles: Role[] = ['admin', 'pod_lead', 'compliance', 'prospecting', 'copy', 'ops', 'analytics', 'member'];
const defaultAbForm = {
  enabled: false,
  min_sample_size: 100,
  variant_a_subject: 'Quick idea for {company}, {first_name}',
  variant_a_body:
    'Hi {first_name},\n\nWe noticed {company} is scaling in your segment. We have a focused idea that can improve qualified replies by 25% in 30 days.\n\nOpen to a 12-minute walkthrough this week?',
  variant_b_subject: 'Idea to lift replies at {company}',
  variant_b_body:
    'Hi {first_name},\n\nWe built a short outreach sequence that is currently lifting replies in companies like {company}.\n\nOpen to reviewing a 12-minute plan?',
};
const sopLabels: Record<string, string> = {
  sop_intake: 'SOP-01 Intake and Goal Definition',
  sop_compliance: 'SOP-02 Compliance Verification',
  sop_segment_validation: 'SOP-03 Prospect Qualification',
  sop_copy_review: 'SOP-04 Copy Review Loop',
  sop_launch_checklist: 'SOP-05 Launch Approval Checklist',
};

const playbooks = [
  {
    id: 'saas-pas',
    niche: 'SaaS',
    framework: 'PAS',
    level: 'Startup',
    title: 'SaaS Founder Pain-to-Plan',
    subject: 'Quick growth idea for {company}, {first_name}',
    body:
      'Hi {first_name},\n\nMost SaaS teams like {company} hit a plateau when outbound messaging sounds generic. We built a sequence that improves qualified replies without adding more SDR hours.\n\nWould you be open to a 12-minute walkthrough this week?',
  },
  {
    id: 'agency-aida',
    niche: 'Agency',
    framework: 'AIDA',
    level: 'SMB',
    title: 'Agency Pipeline Lift',
    subject: 'Pipeline lift concept for {company}',
    body:
      'Hi {first_name},\n\nWe noticed agencies in your stage are leaving high-intent leads in follow-up gaps. We built a lightweight system that increases replies while preserving brand tone.\n\nOpen to seeing the exact structure?',
  },
  {
    id: 'fintech-storybrand',
    niche: 'Fintech',
    framework: 'StoryBrand',
    level: 'Mid-Market',
    title: 'Fintech Trust Narrative',
    subject: 'A trust-first outreach story for {company}',
    body:
      'Hi {first_name},\n\nFintech teams win when messaging reduces perceived risk fast. We use a story sequence that positions your team as the guide and removes buyer friction in the first two touches.\n\nWould you like the playbook outline?',
  },
  {
    id: 'healthcare-hormozi',
    niche: 'Healthcare',
    framework: 'Hormozi',
    level: 'Enterprise',
    title: 'Healthcare Value Equation',
    subject: 'Outcome-focused offer angle for {company}',
    body:
      'Hi {first_name},\n\nWe mapped an outreach offer for healthcare operators that raises perceived value while lowering implementation effort for prospects. The result is higher reply quality and faster deal velocity.\n\nCan I share the 3-part offer structure?',
  },
];

function scorePrediction(niche: string, level: string, framework: string) {
  const base = niche === 'SaaS' ? 4.2 : niche === 'Agency' ? 3.8 : 3.4;
  const levelBoost = level === 'Enterprise' ? -0.6 : level === 'Mid-Market' ? 0.3 : 0.8;
  const fwBoost = framework === 'PAS' ? 0.7 : framework === 'PASTOR' ? 0.6 : 0.4;
  return Number(Math.max(0.8, Math.min(9.9, base + levelBoost + fwBoost)).toFixed(2));
}

function scoreCopy(subject: string, body: string): { score: number; label: string; color: string; issues: string[] } {
  const issues: string[] = [];
  let score = 100;
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  if (words < 50) { score -= 25; issues.push(`Body too short (${words} words, aim 100-125)`); }
  else if (words < 100) { score -= 10; issues.push(`Body a little short (${words} words, aim 100-125)`); }
  else if (words > 175) { score -= 15; issues.push(`Body too long (${words} words, trim to 125)`); }
  else if (words > 125) { score -= 5; issues.push(`Body slightly long (${words} words)`); }
  const subjectWords = subject.trim().split(/\s+/).filter(Boolean).length;
  if (subjectWords < 3) { score -= 15; issues.push('Subject too short (aim 4–7 words)'); }
  else if (subjectWords > 10) { score -= 10; issues.push('Subject too long (aim 4–7 words)'); }
  const tokens = (body.match(/\{[a-z_]+\}/g) || []).length;
  if (tokens === 0) { score -= 15; issues.push('No personalisation tokens ({first_name}, {company})'); }
  else if (tokens === 1) { score -= 5; issues.push('Add 1 more personalisation token'); }
  const questions = (body.match(/\?/g) || []).length;
  if (questions === 0) { score -= 15; issues.push('No CTA question detected'); }
  else if (questions > 2) { score -= 10; issues.push('Too many questions, use exactly 1 CTA'); }
  const spamWords = ['free', 'guarantee', 'limited time', 'act now', 'click here', 'buy now', 'urgent'];
  const bodyLower = body.toLowerCase();
  const spamHits = spamWords.filter((w) => bodyLower.includes(w) || subject.toLowerCase().includes(w));
  if (spamHits.length) { score -= spamHits.length * 10; issues.push(`Spam words: ${spamHits.join(', ')}`); }
  const final = Math.max(0, Math.min(100, score));
  const label = final >= 90 ? 'Elite' : final >= 80 ? 'Strong' : final >= 60 ? 'Needs Work' : 'Weak';
  const color = final >= 80 ? 'var(--accent)' : final >= 60 ? '#f0a500' : 'var(--danger)';
  return { score: final, label, color, issues };
}

function titleRole(role: Role) {
  return role.replaceAll('_', ' ').replace(/\b\w/g, (v) => v.toUpperCase());
}

function formatRate(value: number | null | undefined) {
  return value == null ? '—' : `${value}%`;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [signals, setSignals] = useState<{ signal: string; impact: string; confidence: number }[]>([]);
  const [tab, setTab] = useState<TabKey>('overview');

  const [users, setUsers] = useState<User[]>([]);
  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  const [segmentRows, setSegmentRows] = useState<DashboardSegment[]>([]);
  const [variantRows, setVariantRows] = useState<DashboardVariant[]>([]);
  const [agentRows, setAgentRows] = useState<AgentRow[]>([]);
  const [agentSummary, setAgentSummary] = useState<AgentSummary | null>(null);
  const [runningAgents, setRunningAgents] = useState(false);
  const [learningRows, setLearningRows] = useState<LearningRow[]>([]);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleSyncResult, setGoogleSyncResult] = useState<GoogleSyncResult | null>(null);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [gmailProfile, setGmailProfile] = useState<GmailProfile | null>(null);

  // Multi-inbox state
  const [inboxes, setInboxes] = useState<SendingInbox[]>([]);
  const [inboxSummary, setInboxSummary] = useState<InboxSummary | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxAddLoading, setInboxAddLoading] = useState(false);

  // Warmup state
  const [warmupStats, setWarmupStats] = useState<WarmupStats | null>(null);
  const [warmupLoading, setWarmupLoading] = useState(false);

  // Email verification state
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<EmailVerification | null>(null);
  const [bulkVerifyInput, setBulkVerifyInput] = useState('');
  const [bulkVerifyResult, setBulkVerifyResult] = useState<BulkVerifyResult | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Scheduled sends state
  const [scheduledSends, setScheduledSends] = useState<ScheduledSend[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [optimalTime, setOptimalTime] = useState<OptimalTimeResult | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ campaign_id: '', timezone: 'America/New_York', sending_window: 'default' });

  // Gmail test send state
  const [gmailTestForm, setGmailTestForm] = useState({ to: '', subject: '', html: '' });
  const [gmailSendLoading, setGmailSendLoading] = useState(false);
  const [gmailSendResult, setGmailSendResult] = useState<{ ok: boolean; message_id: string } | null>(null);

  const [learningForm, setLearningForm] = useState({
    title: '',
    category: 'conversion_pattern',
    impact: 10,
    confidence: 80,
    evidence: '',
  });

  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [qaStatus, setQaStatus] = useState<QaStatus | null>(null);
  const [sopStatus, setSopStatus] = useState<SopStatus | null>(null);
  const [abTest, setAbTest] = useState<AbTest | null>(null);

  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [contactForm, setContactForm] = useState<{
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    niche: string;
    business_level: string;
    consent_basis: 'express' | 'legitimate_interest' | 'implied';
  }>({
    first_name: '',
    last_name: '',
    email: '',
    company: '',
    niche: 'SaaS',
    business_level: 'Startup',
    consent_basis: 'legitimate_interest' as const,
  });

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    niche: 'SaaS',
    business_level: 'Startup',
    framework: 'PAS',
  });

  const [abForm, setAbForm] = useState(defaultAbForm);
  const [launchForm, setLaunchForm] = useState({
    subject: 'Quick idea for {company}, {first_name}',
    body: 'Hi {first_name},\n\nWe noticed {company} is scaling in your segment. We have a focused idea that can improve qualified replies by 25% in 30 days.\n\nOpen to a 12-minute walkthrough this week?',
  });

  const [launching, setLaunching] = useState<number | null>(null);
  const [launchWizardStep, setLaunchWizardStep] = useState(1);

  const predicted = useMemo(
    () => scorePrediction(campaignForm.niche, campaignForm.business_level, campaignForm.framework),
    [campaignForm]
  );

  const copyScore = useMemo(() => scoreCopy(launchForm.subject, launchForm.body), [launchForm]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );
  const wizardChecks = useMemo(() => {
    const copyReady = copyScore.score >= 80;
    const qaReady = Boolean(qaStatus?.ready);
    const sopReady = Boolean(sopStatus?.ready);
    const agentReady = Boolean(agentSummary?.minimum_ready);
    return { copyReady, qaReady, sopReady, agentReady };
  }, [copyScore.score, qaStatus?.ready, sopStatus?.ready, agentSummary?.minimum_ready]);

  const loadAll = useCallback(async () => {
    const [contactList, campaignList, matrix, dashboard, learning, billing, launch] = await Promise.all([
      api.getContacts(),
      api.getCampaigns(),
      api.matrix(),
      api.dashboard(),
      api.getLearning(),
      api.getBillingStatus(),
      api.getLaunchStatus(),
    ]);
    const agentState = await api.agents();
    setContacts(contactList);
    setCampaigns(campaignList);
    setSignals(matrix.signals);
    setKpi(dashboard.kpis);
    setSegmentRows(dashboard.segments);
    setVariantRows(dashboard.variant);
    setLearningRows(learning.rows);
    setBillingStatus(billing);
    setLaunchStatus(launch);
    setAgentRows(agentState.rows);
    setAgentSummary(agentState.summary);

    if (!selectedCampaignId && campaignList.length > 0) {
      setSelectedCampaignId(campaignList[0].id);
    }
  }, [selectedCampaignId]);

  const loadWorkflow = useCallback(async (campaignId: number) => {
    const [qa, sop, ab] = await Promise.all([api.getQaGates(campaignId), api.getSop(campaignId), api.getAbTest(campaignId)]);
    setQaStatus(qa);
    setSopStatus(sop);
    setAbTest(ab);
    setAbForm({
      enabled: Boolean(ab.enabled),
      min_sample_size: ab.min_sample_size,
      variant_a_subject: ab.variant_a_subject || defaultAbForm.variant_a_subject,
      variant_a_body: ab.variant_a_body || defaultAbForm.variant_a_body,
      variant_b_subject: ab.variant_b_subject || defaultAbForm.variant_b_subject,
      variant_b_body: ab.variant_b_body || defaultAbForm.variant_b_body,
    });
  }, []);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .me()
      .then(async (me) => {
        setUser(me);
        await loadAll();
        if (me.role === 'admin') {
          const allUsers = await api.listUsers();
          setUsers(allUsers);
        }
        // Load Google status non-blocking
        api.getGoogleStatus().then((gs) => {
          setGoogleStatus(gs);
          if (gs.connected) {
            api.getGmailProfile().then(setGmailProfile).catch(() => {});
          }
        }).catch(() => {});
        // Handle OAuth redirect params
        const params = new URLSearchParams(window.location.search);
        if (params.get('google') === 'connected') {
          window.history.replaceState({}, '', window.location.pathname);
          api.getGoogleStatus().then(setGoogleStatus).catch(() => {});
        }
      })
      .catch(() => api.clearToken())
      .finally(() => setLoading(false));
  }, [loadAll]);

  useEffect(() => {
    if (!selectedCampaignId || !user) {
      return;
    }
    if (tab === 'ops' || tab === 'campaigns') {
      void loadWorkflow(selectedCampaignId).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load workflow controls');
      });
    }
  }, [selectedCampaignId, tab, user, loadWorkflow]);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const response =
        mode === 'login'
          ? await api.login(authForm.email, authForm.password)
          : await api.register(authForm.name, authForm.email, authForm.password);
      api.setToken(response.token);
      setUser(response.user);
      await loadAll();
      if (response.user.role === 'admin') {
        const allUsers = await api.listUsers();
        setUsers(allUsers);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.addContact(contactForm);
      setContactForm({
        first_name: '',
        last_name: '',
        email: '',
        company: '',
        niche: contactForm.niche,
        business_level: contactForm.business_level,
        consent_basis: contactForm.consent_basis,
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact');
    }
  }

  async function addCampaign(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.addCampaign({ ...campaignForm, predicted_conversion: predicted });
      setCampaignForm({
        name: '',
        niche: campaignForm.niche,
        business_level: campaignForm.business_level,
        framework: campaignForm.framework,
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    }
  }

  async function saveGate(gateType: 'self_check' | 'peer_check' | 'lead_signoff', passed: boolean) {
    if (!selectedCampaignId) return;
    setError('');
    try {
      const updated = await api.saveQaGate(selectedCampaignId, {
        gate_type: gateType,
        passed,
        score: passed ? 92 : 55,
        notes: passed ? 'Approved by reviewer.' : 'Needs revision before launch.',
      });
      setQaStatus(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save QA gate');
    }
  }

  async function toggleSopStep(stepKey: string, completed: boolean) {
    if (!selectedCampaignId) return;
    setError('');
    try {
      const updated = await api.saveSopStep(selectedCampaignId, { step_key: stepKey, completed });
      setSopStatus(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save SOP step');
    }
  }

  async function saveAbTest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCampaignId) return;
    setError('');
    try {
      const saved = await api.saveAbTest(selectedCampaignId, abForm);
      setAbTest(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save A/B test');
    }
  }

  async function launchCampaign(campaignId: number) {
    setError('');
    setLaunching(campaignId);
    try {
      await api.launchCampaign(campaignId, { subject: launchForm.subject, body: launchForm.body });
      await loadAll();
      if (campaignId === selectedCampaignId) {
        await loadWorkflow(campaignId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
    } finally {
      setLaunching(null);
    }
  }

  async function runMinimumAgentCycle() {
    setError('');
    setRunningAgents(true);
    try {
      const result = await api.runAgentsMinimum();
      setAgentRows(result.rows);
      setAgentSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run minimum agent cycle');
    } finally {
      setRunningAgents(false);
    }
  }

  async function addLearningEntry(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.addLearning(learningForm);
      setLearningForm({
        title: '',
        category: learningForm.category,
        impact: learningForm.impact,
        confidence: learningForm.confidence,
        evidence: '',
      });
      const updated = await api.getLearning();
      setLearningRows(updated.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add learning entry');
    }
  }

  async function startCheckout(plan: 'pro' | 'team') {
    if (!launchStatus?.providers.stripe) { setError("Stripe is not configured yet. Use the in-house billing controls in System Audit for today's launch."); return; }
    setError('');
    setBillingLoading(true);
    try {
      const session = await api.createCheckoutSession(plan);
      window.location.href = session.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setBillingLoading(false);
    }
  }

  async function openBillingPortal() {
    if (!launchStatus?.providers.stripe) { setError('Stripe billing portal is not configured yet.'); return; }
    setError('');
    setBillingLoading(true);
    try {
      const session = await api.createPortalSession();
      window.location.href = session.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setBillingLoading(false);
    }
  }

  function applyPlaybook(playbookId: string) {
    const playbook = playbooks.find((item) => item.id === playbookId);
    if (!playbook) return;
    setCampaignForm((state) => ({ ...state, niche: playbook.niche, framework: playbook.framework }));
    setLaunchForm({ subject: playbook.subject, body: playbook.body });
    setTab('campaigns');
  }

  async function changeRole(targetUserId: number, role: Role) {
    setError('');
    try {
      await api.setUserRole(targetUserId, role);
      const allUsers = await api.listUsers();
      setUsers(allUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  }

  async function loadGoogleStatus() {
    try {
      const status = await api.getGoogleStatus();
      setGoogleStatus(status);
      if (status.connected) {
        const profile = await api.getGmailProfile().catch(() => null);
        setGmailProfile(profile);
      }
    } catch { /* non-critical */ }
  }

  async function connectGoogle() {
    setError('');
    setGoogleConnecting(true);
    try {
      const { url } = await api.getGoogleAuthUrl();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Google OAuth');
      setGoogleConnecting(false);
    }
  }

  async function disconnectGoogle() {
    setError('');
    try {
      await api.disconnectGoogle();
      setGoogleStatus({ connected: false });
      setGmailProfile(null);
      setGoogleSyncResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Google');
    }
  }

  async function syncGoogleContacts() {
    setError('');
    setGoogleSyncing(true);
    setGoogleSyncResult(null);
    try {
      const result = await api.syncGoogleContacts();
      setGoogleSyncResult(result);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync Google contacts');
    } finally {
      setGoogleSyncing(false);
    }
  }

  // ── Multi-Inbox Handlers ──────────────────────────────────────────────────
  async function loadInboxes() {
    setInboxLoading(true);
    try {
      const data = await api.getInboxes();
      setInboxes(data.inboxes);
      setInboxSummary(data.summary);
    } catch { /* non-critical */ } finally { setInboxLoading(false); }
  }

  async function registerInbox() {
    if (!googleStatus?.connected) { setError('Connect Google Workspace first'); return; }
    setInboxAddLoading(true);
    try {
      await api.addInbox({ google_connection_id: 1, label: googleStatus.google_email || '', daily_limit: 50 });
      await loadInboxes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register inbox');
    } finally { setInboxAddLoading(false); }
  }

  async function toggleInbox(id: number, active: boolean) {
    try { await api.updateInbox(id, { is_active: active ? 1 : 0 }); await loadInboxes(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update inbox'); }
  }

  async function updateInboxLimit(id: number, limit: number) {
    try { await api.updateInbox(id, { daily_limit: limit }); await loadInboxes(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update inbox limit'); }
  }

  async function removeInbox(id: number) {
    try { await api.deleteInbox(id); await loadInboxes(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to remove inbox'); }
  }

  // ── Warmup Handlers ───────────────────────────────────────────────────────
  async function loadWarmup() {
    setWarmupLoading(true);
    try { const data = await api.getWarmupStats(); setWarmupStats(data); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load warmup'); } finally { setWarmupLoading(false); }
  }

  // ── Email Verify Handlers ─────────────────────────────────────────────────
  async function verifySingle() {
    if (!verifyInput.trim()) return;
    setVerifyLoading(true); setVerifyResult(null);
    try { const r = await api.verifyEmail(verifyInput.trim()); setVerifyResult(r); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to verify email'); } finally { setVerifyLoading(false); }
  }

  async function verifyBulk() {
    if (!bulkVerifyInput.trim()) return;
    setVerifyLoading(true); setBulkVerifyResult(null);
    try {
      const emails = bulkVerifyInput.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
      const r = await api.verifyBulk(emails);
      setBulkVerifyResult(r);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to verify emails'); } finally { setVerifyLoading(false); }
  }

  // ── Scheduled Sends Handlers ──────────────────────────────────────────────
  async function loadScheduled() {
    setScheduledLoading(true);
    try {
      const rows = await api.getScheduled();
      setScheduledSends(rows);
      const ot = await api.getOptimalTime(scheduleForm.timezone, 'default');
      setOptimalTime(ot);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load scheduled sends'); } finally { setScheduledLoading(false); }
  }

  async function scheduleCampaign() {
    if (!scheduleForm.campaign_id) { setError('Select a campaign to schedule'); return; }
    try {
      await api.schedulesCampaign({
        campaign_id: Number(scheduleForm.campaign_id),
        timezone: scheduleForm.timezone,
        sending_window: scheduleForm.sending_window,
      });
      await loadScheduled();
      await loadAll();
      setScheduleForm(f => ({ ...f, campaign_id: '' }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to schedule'); }
  }

  async function cancelScheduled(id: number) {
    try { await api.cancelScheduled(id); await loadScheduled(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to cancel scheduled send'); }
  }

  // ── Gmail Test Send ───────────────────────────────────────────────────────
  async function sendGmailTest() {
    if (!gmailTestForm.to || !gmailTestForm.subject) { setError('To and Subject required'); return; }
    setGmailSendLoading(true); setGmailSendResult(null);
    try {
      const r = await api.gmailSend({ to: gmailTestForm.to, subject: gmailTestForm.subject, html: gmailTestForm.html || gmailTestForm.subject });
      setGmailSendResult(r);
    } catch (err) { setError(err instanceof Error ? err.message : 'Gmail send failed'); } finally { setGmailSendLoading(false); }
  }

  if (loading) return <div className="screen">Loading SignalIQ...</div>;

  if (!user) {
    return (
      <div className="screen auth-bg">
        <div className="auth-card">
          <h1>SignalIQ</h1>
          <p>Outreach intelligence that predicts, sends, and learns.</p>
          <form onSubmit={submitAuth} className="stack">
            {mode === 'register' && (
              <input
                placeholder="Full name"
                value={authForm.name}
                onChange={(e) => setAuthForm((state) => ({ ...state, name: e.target.value }))}
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={authForm.email}
              onChange={(e) => setAuthForm((state) => ({ ...state, email: e.target.value }))}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) => setAuthForm((state) => ({ ...state, password: e.target.value }))}
              required
            />
            <button type="submit">{mode === 'login' ? 'Login' : 'Create account'}</button>
            <button type="button" className="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Need an account?' : 'Already have an account?'}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>SignalIQ</h2>
        <p>
          {user.name}
          <br />
          <small>{titleRole(user.role)}</small>
        </p>
        <nav>
          <button onClick={() => setTab('overview')} className={tab === 'overview' ? 'active' : ''}>
            <Activity size={16} />Overview
          </button>
          <button onClick={() => setTab('contacts')} className={tab === 'contacts' ? 'active' : ''}>
            <Users size={16} />Contacts
          </button>
          <button onClick={() => setTab('campaigns')} className={tab === 'campaigns' ? 'active' : ''}>
            <Rocket size={16} />Campaigns
          </button>
          <button onClick={() => setTab('library')} className={tab === 'library' ? 'active' : ''}>
            <BookOpen size={16} />Playbooks
          </button>
          <button onClick={() => setTab('learning')} className={tab === 'learning' ? 'active' : ''}>
            <Lightbulb size={16} />Learning
          </button>
          <button onClick={() => setTab('kpis')} className={tab === 'kpis' ? 'active' : ''}>
            <BarChart3 size={16} />KPI Dashboard
          </button>
          <button onClick={() => setTab('ops')} className={tab === 'ops' ? 'active' : ''}>
            <ClipboardCheck size={16} />Workflow Ops
          </button>
          <button onClick={() => setTab('agents')} className={tab === 'agents' ? 'active' : ''}>
            <ShieldCheck size={16} />Agent Control
          </button>
          <button onClick={() => setTab('billing')} className={tab === 'billing' ? 'active' : ''}>
            <CreditCard size={16} />Billing
          </button>
          <button onClick={() => setTab('audit')} className={tab === 'audit' ? 'active' : ''}>
            <FlaskConical size={16} />System Audit
          </button>
          <button onClick={() => setTab('matrix')} className={tab === 'matrix' ? 'active' : ''}>
            <Activity size={16} />Conversion Matrix
          </button>
          <button onClick={() => { setTab('google'); loadGoogleStatus(); }} className={tab === 'google' ? 'active' : ''}>
            <Globe size={16} />
            Google Workspace
            {googleStatus?.connected && <span className="gws-dot" />}
          </button>
          <button onClick={() => { setTab('inboxes'); loadInboxes(); }} className={tab === 'inboxes' ? 'active' : ''}>
            <Mail size={16} />Sending Inboxes
          </button>
          <button onClick={() => { setTab('warmup'); loadWarmup(); }} className={tab === 'warmup' ? 'active' : ''}>
            <Activity size={16} />Warm-Up Dashboard
          </button>
          <button onClick={() => { setTab('scheduled'); loadScheduled(); }} className={tab === 'scheduled' ? 'active' : ''}>
            <Rocket size={16} />Scheduled Sends
          </button>
          <button onClick={() => setTab('verify')} className={tab === 'verify' ? 'active' : ''}>
            <ShieldCheck size={16} />Email Verifier
          </button>
          {user.role === 'admin' && (
            <button onClick={() => setTab('team')} className={tab === 'team' ? 'active' : ''}>
              <Users size={16} />Team Roles
            </button>
          )}
        </nav>
        <button
          className="logout"
          onClick={() => {
            api.clearToken();
            setUser(null);
          }}
        >
          <LogOut size={16} />Logout
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>Top 1% Outreach OS</h1>
            <p>Compliant, predictive, and execution-ready.</p>
          </div>
          <div className="chips">
            <span>
              <ShieldCheck size={14} />GDPR/CASL Guard
            </span>
            <span>
              <Mail size={14} />Resend Connected
            </span>
            {googleStatus?.connected && (
              <span style={{ borderColor: 'rgba(66,133,244,0.5)', color: '#4285f4' }}>
                <Globe size={14} />{googleStatus.google_email}
              </span>
            )}
          </div>
        </header>

        {error && <p className="error banner">{error}</p>}

        {tab === 'overview' && (
          <section className="overview-grid">
            {launchStatus && (
              <article className="card onboarding-card" style={{ gridColumn: '1 / -1', border: `1px solid ${launchStatus.ready ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`, background: launchStatus.ready ? 'linear-gradient(180deg, rgba(16,185,129,0.08), rgba(15,23,42,0.92))' : 'linear-gradient(180deg, rgba(239,68,68,0.08), rgba(15,23,42,0.92))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ marginBottom: 6 }}>{launchStatus.ready ? 'Launch Mode: Ready Today' : 'Launch Mode: Blocked'}</h3>
                    <p className="hint">Sending via <strong>{launchStatus.send_provider.toUpperCase()}</strong> · From <code>{launchStatus.sending_from}</code> · Billing <strong>{launchStatus.billing_mode === 'stripe' ? 'Stripe' : 'In-House'}</strong></p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`badge ${launchStatus.providers.resend || launchStatus.providers.smtp ? 'badge-agent-pass' : 'badge-failed'}`}>Sending {launchStatus.providers.resend || launchStatus.providers.smtp ? 'Live' : 'Off'}</span>
                    <span className={`badge ${launchStatus.providers.stripe ? 'badge-agent-pass' : 'badge-running'}`}>Stripe {launchStatus.providers.stripe ? 'On' : 'Optional'}</span>
                    <span className={`badge ${launchStatus.providers.google_oauth ? 'badge-agent-pass' : 'badge-running'}`}>Google {launchStatus.providers.google_oauth ? 'On' : 'Later'}</span>
                  </div>
                </div>
                {!!launchStatus.blockers.length && <p className="error" style={{ marginTop: 12 }}>{launchStatus.blockers.join(' ')}</p>}
                {!!launchStatus.warnings.length && (
                  <ul className="signals" style={{ marginTop: 12 }}>
                    {launchStatus.warnings.slice(0, 3).map((warning) => (
                      <li key={warning}><span>{warning}</span></li>
                    ))}
                  </ul>
                )}
              </article>
            )}
            {/* Onboarding guide */}
            {(contacts.length === 0 || campaigns.length === 0) && (
              <article className="card onboarding-card" style={{ gridColumn: '1 / -1' }}>
                <h3>Get Started: 4 Steps to Your First Launch</h3>
                <div className="onboarding-steps">
                  {[
                    { label: 'Add a contact', done: contacts.length > 0, tab: 'contacts' },
                    { label: 'Create a campaign', done: campaigns.length > 0, tab: 'campaigns' },
                    { label: 'Complete SOP + QA gates', done: Boolean(campaigns.length && agentSummary?.minimum_ready), tab: 'ops' },
                    { label: 'Launch your first send', done: Boolean(kpi && kpi.sends > 0), tab: 'campaigns' },
                  ].map((step, i) => (
                    <button
                      key={i}
                      className={`onboarding-step${step.done ? ' done' : ''}`}
                      onClick={() => setTab(step.tab as TabKey)}
                    >
                      <span className="step-num">{step.done ? 'OK' : i + 1}</span>
                      <span>{step.label}</span>
                    </button>
                  ))}
                </div>
              </article>
            )}

            {/* Hero stat cards */}
            <article className="card stat-card">
              <p className="hint">Contacts</p>
              <strong>{contacts.length}</strong>
              <span className="stat-sub">{contacts.filter(c => !c.unsubscribed).length} active</span>
            </article>
            <article className="card stat-card">
              <p className="hint">Campaigns</p>
              <strong>{campaigns.length}</strong>
              <span className="stat-sub">{campaigns.filter(c => c.status === 'running').length} live</span>
            </article>
            <article className="card stat-card">
              <p className="hint">Total Sends</p>
              <strong>{kpi?.sends ?? 0}</strong>
              <span className="stat-sub">Open: {formatRate(kpi?.open_rate)}</span>
            </article>
            <article className="card stat-card">
              <p className="hint">Reply Rate</p>
              <strong>{formatRate(kpi?.reply_rate)}</strong>
              <span className="stat-sub">Click: {formatRate(kpi?.click_rate)}</span>
            </article>
            <article className="card stat-card">
              <p className="hint">Conversion</p>
              <strong>{formatRate(kpi?.conversion_rate)}</strong>
              <span className="stat-sub">{kpi?.cac ? `CAC $${kpi.cac}` : 'No converts yet'}</span>
            </article>
            <article className="card stat-card">
              <p className="hint">Agent Gate</p>
              <strong className={agentSummary?.minimum_ready ? 'text-accent' : 'text-danger'}>
                {agentSummary?.minimum_ready ? 'READY' : 'BLOCKED'}
              </strong>
              <span className="stat-sub">{agentSummary?.passed ?? 0}/15 passed</span>
            </article>

            {kpi?.tracking_message && (
              <article className="card onboarding-card" style={{ gridColumn: '1 / -1', border: '1px solid rgba(245, 158, 11, 0.35)', background: 'linear-gradient(180deg, rgba(245,158,11,0.08), rgba(15,23,42,0.92))' }}>
                <h3 style={{ marginBottom: 6 }}>Engagement Tracking Pending</h3>
                <p className="hint">{kpi.tracking_message}</p>
                <p className="hint" style={{ marginTop: 6 }}>Live sends: {kpi.sends} · Tracked sends: {kpi.tracked_sends ?? 0} · Events received: {kpi.event_count ?? 0}</p>
              </article>
            )}

            {/* Learning Signals */}
            <article className="card" style={{ gridColumn: 'span 3' }}>
              <h3>Intelligence Signals</h3>
              <ul className="signals">
                {signals.map((s) => (
                  <li key={s.signal}>
                    <span>{s.signal}</span>
                    <b>{s.impact}</b>
                    <small>{s.confidence}% confidence</small>
                  </li>
                ))}
                {!signals.length && <li><span>No signals yet, launch campaigns to start learning.</span></li>}
              </ul>
            </article>

            {/* Campaign status */}
            <article className="card" style={{ gridColumn: 'span 3' }}>
              <h3>Campaign Status</h3>
              {campaigns.length === 0 ? (
                <div className="empty-state">
                  <p>No campaigns yet.</p>
                  <button onClick={() => setTab('campaigns')}>Create First Campaign →</button>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Segment</th><th>Predicted</th><th>Actual</th><th>Status</th></tr></thead>
                    <tbody>
                      {campaigns.slice(0, 5).map((c) => (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td><small>{c.niche} / {c.business_level}</small></td>
                          <td>{c.predicted_conversion}%</td>
                          <td>{c.actual_conversion ? `${c.actual_conversion}%` : '-'}</td>
                          <td>
                            <span className={`badge badge-${c.status}`}>{c.status}</span>
                            {c.sent_count > 0 && <small style={{ marginLeft: 6 }}>{c.sent_count} sent</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        )}

        {tab === 'contacts' && (
          <section className="grid split">
            <article className="card">
              <h3>Add Contact</h3>
              <form onSubmit={addContact} className="stack">
                <input
                  placeholder="First name"
                  value={contactForm.first_name}
                  onChange={(e) => setContactForm((state) => ({ ...state, first_name: e.target.value }))}
                  required
                />
                <input
                  placeholder="Last name"
                  value={contactForm.last_name}
                  onChange={(e) => setContactForm((state) => ({ ...state, last_name: e.target.value }))}
                />
                <input
                  placeholder="Work email"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((state) => ({ ...state, email: e.target.value }))}
                  required
                />
                <input
                  placeholder="Company"
                  value={contactForm.company}
                  onChange={(e) => setContactForm((state) => ({ ...state, company: e.target.value }))}
                />
                <select
                  value={contactForm.niche}
                  onChange={(e) => setContactForm((state) => ({ ...state, niche: e.target.value }))}
                >
                  {niches.map((niche) => (
                    <option key={niche}>{niche}</option>
                  ))}
                </select>
                <select
                  value={contactForm.business_level}
                  onChange={(e) => setContactForm((state) => ({ ...state, business_level: e.target.value }))}
                >
                  {levels.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
                <select
                  value={contactForm.consent_basis}
                  onChange={(e) =>
                    setContactForm((state) => ({
                      ...state,
                      consent_basis: e.target.value as 'express' | 'legitimate_interest' | 'implied',
                    }))
                  }
                >
                  <option value="legitimate_interest">Legitimate Interest</option>
                  <option value="express">Express Consent</option>
                  <option value="implied">Implied Consent</option>
                </select>
                <button type="submit">Add Contact</button>
              </form>
            </article>
            <article className="card">
              <h3>Contact List</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Segment</th>
                      <th>Consent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact.id}>
                        <td>
                          {contact.first_name} {contact.last_name}
                        </td>
                        <td>{contact.email}</td>
                        <td>
                          {contact.niche} / {contact.business_level}
                        </td>
                        <td>{contact.consent_basis}</td>
                      </tr>
                    ))}
                    {!contacts.length && (
                      <tr>
                        <td colSpan={4}>No contacts yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {tab === 'campaigns' && (
          <section className="grid campaign-grid">
            <article className="card">
              <h3>Create Campaign</h3>
              <form onSubmit={addCampaign} className="stack">
                <input
                  placeholder="Campaign name"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm((state) => ({ ...state, name: e.target.value }))}
                  required
                />
                <select
                  value={campaignForm.niche}
                  onChange={(e) => setCampaignForm((state) => ({ ...state, niche: e.target.value }))}
                >
                  {niches.map((niche) => (
                    <option key={niche}>{niche}</option>
                  ))}
                </select>
                <select
                  value={campaignForm.business_level}
                  onChange={(e) => setCampaignForm((state) => ({ ...state, business_level: e.target.value }))}
                >
                  {levels.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
                <select
                  value={campaignForm.framework}
                  onChange={(e) => setCampaignForm((state) => ({ ...state, framework: e.target.value }))}
                >
                  {frameworks.map((framework) => (
                    <option key={framework}>{framework}</option>
                  ))}
                </select>
                <p className="hint">
                  Predicted conversion: <strong>{predicted}%</strong>
                </p>
                <button type="submit">Create Campaign</button>
              </form>
            </article>

            <article className="card">
              <h3>Copy Intelligence Scorer</h3>
              <p className="hint">Write your email copy below, score updates live. Aim for 80+.</p>
              <div className="stack">
                <input
                  placeholder="Subject line"
                  value={launchForm.subject}
                  onChange={(e) => setLaunchForm((s) => ({ ...s, subject: e.target.value }))}
                />
                <textarea
                  rows={6}
                  placeholder="Email body..."
                  value={launchForm.body}
                  onChange={(e) => setLaunchForm((s) => ({ ...s, body: e.target.value }))}
                />
                <div className="copy-score-bar">
                  <div className="copy-score-track">
                    <div
                      className="copy-score-fill"
                      style={{ width: `${copyScore.score}%`, background: copyScore.color }}
                    />
                  </div>
                  <span className="copy-score-label" style={{ color: copyScore.color }}>
                    {copyScore.score}/100 - {copyScore.label}
                  </span>
                </div>
                {copyScore.issues.length > 0 && (
                  <ul className="copy-issues">
                    {copyScore.issues.map((issue) => (
                      <li key={issue}>Alert: {issue}</li>
                    ))}
                  </ul>
                )}
                {copyScore.score >= 80 && (
                  <p className="hint" style={{ color: 'var(--accent)' }}>Copy is launch-ready. This subject + body will be used for all launches.</p>
                )}
              </div>
            </article>

            <article className="card" style={{ gridColumn: '1 / -1' }}>
              <h3>Launch Queue</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Segment</th>
                      <th>Pred.</th>
                      <th>Actual</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => (
                      <tr key={campaign.id}>
                        <td>{campaign.name}</td>
                        <td><small>{campaign.niche} / {campaign.business_level}</small></td>
                        <td>{campaign.predicted_conversion}%</td>
                        <td>{campaign.actual_conversion ? `${campaign.actual_conversion}%` : '-'}</td>
                        <td>
                          <span className={`badge badge-${campaign.status}`}>{campaign.status}</span>
                          {campaign.sent_count > 0 && <small style={{ marginLeft: 6 }}>{campaign.sent_count} sent</small>}
                        </td>
                        <td>
                          <button onClick={() => { setSelectedCampaignId(campaign.id); setLaunchWizardStep(1); }}>
                            Use In Wizard
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!campaigns.length && (
                      <tr>
                        <td colSpan={6}>
                          <div className="empty-state">No campaigns yet. Create one on the left.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="card" style={{ gridColumn: '1 / -1' }}>
              <h3>Launch Wizard</h3>
              <p className="hint">Follow each step in order. Launch unlocks only when all gates pass.</p>
              <div className="wizard-steps">
                <button className={`wizard-step ${launchWizardStep >= 1 ? 'active' : ''}`} onClick={() => setLaunchWizardStep(1)}>1. Select campaign</button>
                <button className={`wizard-step ${launchWizardStep >= 2 ? 'active' : ''}`} onClick={() => setLaunchWizardStep(2)}>2. Copy quality</button>
                <button className={`wizard-step ${launchWizardStep >= 3 ? 'active' : ''}`} onClick={() => setLaunchWizardStep(3)}>3. QA gates</button>
                <button className={`wizard-step ${launchWizardStep >= 4 ? 'active' : ''}`} onClick={() => setLaunchWizardStep(4)}>4. SOP checks</button>
                <button className={`wizard-step ${launchWizardStep >= 5 ? 'active' : ''}`} onClick={() => setLaunchWizardStep(5)}>5. Agent cycle</button>
                <button className={`wizard-step ${launchWizardStep >= 6 ? 'active' : ''}`} onClick={() => setLaunchWizardStep(6)}>6. Confirm launch</button>
              </div>

              <div className="wizard-panel">
                {launchWizardStep === 1 && (
                  <div className="stack">
                    <label className="hint">Campaign</label>
                    <select
                      value={selectedCampaignId || ''}
                      onChange={(e) => setSelectedCampaignId(Number(e.target.value))}
                    >
                      {!campaigns.length && <option value="">No campaigns</option>}
                      {campaigns.map((campaign) => (
                        <option value={campaign.id} key={campaign.id}>{campaign.name}</option>
                      ))}
                    </select>
                    <button disabled={!selectedCampaignId} onClick={() => setLaunchWizardStep(2)}>Continue</button>
                  </div>
                )}

                {launchWizardStep === 2 && (
                  <div className="stack">
                    <p className="hint">Copy score is <strong style={{ color: copyScore.color }}>{copyScore.score}/100</strong>.</p>
                    <p className="hint">{wizardChecks.copyReady ? 'Copy quality meets launch threshold.' : 'Improve copy score to at least 80 before launch.'}</p>
                    <button disabled={!wizardChecks.copyReady} onClick={() => setLaunchWizardStep(3)}>Continue</button>
                  </div>
                )}

                {launchWizardStep === 3 && (
                  <div className="stack">
                    <p className="hint">QA status: <strong>{wizardChecks.qaReady ? 'Ready' : 'Blocked'}</strong></p>
                    <p className="hint">Complete all QA gates in Workflow Ops.</p>
                    <button disabled={!wizardChecks.qaReady} onClick={() => setLaunchWizardStep(4)}>Continue</button>
                  </div>
                )}

                {launchWizardStep === 4 && (
                  <div className="stack">
                    <p className="hint">SOP status: <strong>{wizardChecks.sopReady ? 'Ready' : 'Blocked'}</strong></p>
                    <p className="hint">Complete all SOP checklist items in Workflow Ops.</p>
                    <button disabled={!wizardChecks.sopReady} onClick={() => setLaunchWizardStep(5)}>Continue</button>
                  </div>
                )}

                {launchWizardStep === 5 && (
                  <div className="stack">
                    <p className="hint">Agent cycle status: <strong>{wizardChecks.agentReady ? 'Ready' : 'Blocked'}</strong></p>
                    <p className="hint">Run the 15-agent minimum cycle in Agent Control until launch gate is ready.</p>
                    <button disabled={!wizardChecks.agentReady} onClick={() => setLaunchWizardStep(6)}>Continue</button>
                  </div>
                )}

                {launchWizardStep === 6 && (
                  <div className="stack">
                    <p className="hint">Everything is ready. Confirm launch for selected campaign.</p>
                    <button
                      disabled={
                        !selectedCampaignId ||
                        launching === selectedCampaignId ||
                        !wizardChecks.copyReady ||
                        !wizardChecks.qaReady ||
                        !wizardChecks.sopReady ||
                        !wizardChecks.agentReady
                      }
                      onClick={() => selectedCampaignId && launchCampaign(selectedCampaignId)}
                    >
                      {selectedCampaignId && launching === selectedCampaignId ? 'Sending...' : 'Launch Campaign'}
                    </button>
                  </div>
                )}
              </div>
            </article>
          </section>
        )}

        {tab === 'library' && (
          <section className="grid">
            <article className="card">
              <h3>Prompt Playbook Library</h3>
              <p className="hint">Load proven templates by niche/framework directly into the Copy Intelligence scorer.</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Playbook</th>
                      <th>Niche</th>
                      <th>Framework</th>
                      <th>Level</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playbooks.map((playbook) => (
                      <tr key={playbook.id}>
                        <td>{playbook.title}</td>
                        <td>{playbook.niche}</td>
                        <td>{playbook.framework}</td>
                        <td>{playbook.level}</td>
                        <td>
                          <button onClick={() => applyPlaybook(playbook.id)}>Load to Scorer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {tab === 'learning' && (
          <section className="grid split">
            <article className="card">
              <h3>Learning Registry</h3>
              <p className="hint">Auto-signals from campaign data plus manual learning entries.</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Impact</th>
                      <th>Confidence</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learningRows.map((row) => (
                      <tr key={`${row.source}-${row.id}`}>
                        <td>{row.title}</td>
                        <td>{row.category}</td>
                        <td>{row.impact > 0 ? `+${row.impact}` : row.impact}%</td>
                        <td>{row.confidence}%</td>
                        <td><span className={`badge ${row.source === 'auto' ? 'badge-lane-build' : 'badge-draft'}`}>{row.source}</span></td>
                      </tr>
                    ))}
                    {!learningRows.length && (
                      <tr>
                        <td colSpan={5}>No learning entries yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
            <article className="card">
              <h3>Add Manual Learning</h3>
              <form className="stack" onSubmit={addLearningEntry}>
                <input
                  placeholder="Insight title"
                  value={learningForm.title}
                  onChange={(e) => setLearningForm((state) => ({ ...state, title: e.target.value }))}
                  required
                />
                <input
                  placeholder="Category"
                  value={learningForm.category}
                  onChange={(e) => setLearningForm((state) => ({ ...state, category: e.target.value }))}
                  required
                />
                <input
                  type="number"
                  placeholder="Impact %"
                  value={learningForm.impact}
                  onChange={(e) => setLearningForm((state) => ({ ...state, impact: Number(e.target.value) }))}
                />
                <input
                  type="number"
                  min={1}
                  max={99}
                  placeholder="Confidence"
                  value={learningForm.confidence}
                  onChange={(e) => setLearningForm((state) => ({ ...state, confidence: Number(e.target.value) }))}
                />
                <textarea
                  placeholder="Evidence"
                  value={learningForm.evidence}
                  onChange={(e) => setLearningForm((state) => ({ ...state, evidence: e.target.value }))}
                />
                <button type="submit">Save Learning</button>
              </form>
            </article>
          </section>
        )}

        {tab === 'kpis' && (
          <section className="grid split">
            <article className="card">
              <h3>Core KPIs</h3>
              <div className="grid cards3">
                <div>
                  <p className="hint">Open Rate</p>
                  <strong>{formatRate(kpi?.open_rate)}</strong>
                </div>
                <div>
                  <p className="hint">Reply Rate</p>
                  <strong>{formatRate(kpi?.reply_rate)}</strong>
                </div>
                <div>
                  <p className="hint">CAC</p>
                  <strong>{kpi?.cac ? `$${kpi.cac}` : '-'}</strong>
                </div>
              </div>
              <p className="hint">Click: {formatRate(kpi?.click_rate)} | Conversion: {formatRate(kpi?.conversion_rate)}</p>
            </article>
            <article className="card">
              <h3>Variant Performance</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Variant</th>
                      <th>Sends</th>
                      <th>Open</th>
                      <th>Reply</th>
                      <th>Conv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variantRows.map((variant) => (
                      <tr key={variant.variant}>
                        <td>{variant.variant}</td>
                        <td>{variant.sends}</td>
                        <td>{formatRate(variant.open_rate)}</td>
                        <td>{formatRate(variant.reply_rate)}</td>
                        <td>{formatRate(variant.conversion_rate)}</td>
                      </tr>
                    ))}
                    {!variantRows.length && (
                      <tr>
                        <td colSpan={5}>No variant data yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
            <article className="card">
              <h3>Segment KPI Table</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Segment</th>
                      <th>Sends</th>
                      <th>Open</th>
                      <th>Reply</th>
                      <th>Conv</th>
                      <th>CAC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segmentRows.map((segment) => (
                      <tr key={`${segment.niche}-${segment.business_level}`}>
                        <td>
                          {segment.niche} / {segment.business_level}
                        </td>
                        <td>{segment.sends}</td>
                        <td>{formatRate(segment.open_rate)}</td>
                        <td>{formatRate(segment.reply_rate)}</td>
                        <td>{formatRate(segment.conversion_rate)}</td>
                        <td>{segment.cac ? `$${segment.cac}` : '-'}</td>
                      </tr>
                    ))}
                    {!segmentRows.length && (
                      <tr>
                        <td colSpan={6}>No segment data yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {tab === 'ops' && (
          <section className="grid split">
            <article className="card">
              <h3>Campaign Workflow Controls</h3>
              <select
                value={selectedCampaignId || ''}
                onChange={(e) => setSelectedCampaignId(Number(e.target.value))}
                disabled={!campaigns.length}
              >
                {!campaigns.length && <option value="">No campaigns</option>}
                {campaigns.map((campaign) => (
                  <option value={campaign.id} key={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
              {selectedCampaign && (
                <p className="hint">
                  Selected: {selectedCampaign.name} ({selectedCampaign.niche}/{selectedCampaign.business_level})
                </p>
              )}
            </article>

            <article className="card">
              <h3>QA Gates (A/B/C)</h3>
              <p className="hint">Launch unlocks only when all three gates pass.</p>
              <div className="stack">
                <button onClick={() => saveGate('self_check', true)}>Pass Self Check</button>
                <button onClick={() => saveGate('peer_check', true)}>Pass Peer Check</button>
                <button onClick={() => saveGate('lead_signoff', true)}>Pass Lead Signoff</button>
              </div>
              <p className="hint">QA Ready: {qaStatus?.ready ? 'Yes' : 'No'}</p>
              <ul className="signals">
                {(qaStatus?.rows || []).map((row) => (
                  <li key={row.gate_type}>
                    <span>{row.gate_type}</span>
                    <b>{row.passed ? 'Passed' : 'Not Passed'}</b>
                    <small>Score {row.score}</small>
                  </li>
                ))}
              </ul>
            </article>

            <article className="card">
              <h3>SOP Checklist</h3>
              <p className="hint">All SOP steps must be completed before launch.</p>
              <div className="stack">
                {(sopStatus?.rows || []).map((row) => (
                  <label key={row.step_key} className="hint" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(row.completed)}
                      onChange={(e) => toggleSopStep(row.step_key, e.target.checked)}
                    />
                    {sopLabels[row.step_key] || row.step_key}
                  </label>
                ))}
              </div>
              <p className="hint">
                SOP Progress: {sopStatus?.completed || 0}/{sopStatus?.required || 0}
              </p>
            </article>

            <article className="card">
              <h3>A/B Test Setup</h3>
              <form onSubmit={saveAbTest} className="stack">
                <label className="hint" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={abForm.enabled}
                    onChange={(e) => setAbForm((state) => ({ ...state, enabled: e.target.checked }))}
                  />
                  Enable A/B split
                </label>
                <input
                  type="number"
                  min={20}
                  value={abForm.min_sample_size}
                  onChange={(e) => setAbForm((state) => ({ ...state, min_sample_size: Number(e.target.value) }))}
                  placeholder="Minimum sample size"
                />
                <input
                  value={abForm.variant_a_subject}
                  onChange={(e) => setAbForm((state) => ({ ...state, variant_a_subject: e.target.value }))}
                  placeholder="Variant A subject"
                />
                <textarea
                  value={abForm.variant_a_body}
                  onChange={(e) => setAbForm((state) => ({ ...state, variant_a_body: e.target.value }))}
                  placeholder="Variant A body"
                />
                <input
                  value={abForm.variant_b_subject}
                  onChange={(e) => setAbForm((state) => ({ ...state, variant_b_subject: e.target.value }))}
                  placeholder="Variant B subject"
                />
                <textarea
                  value={abForm.variant_b_body}
                  onChange={(e) => setAbForm((state) => ({ ...state, variant_b_body: e.target.value }))}
                  placeholder="Variant B body"
                />
                <button type="submit">Save A/B Config</button>
              </form>
              <p className="hint">A/B Enabled: {abTest?.enabled ? 'Yes' : 'No'}</p>
            </article>
          </section>
        )}

        {tab === 'agents' && (
          <section className="grid">
            <article className="card">
              <h3>Pre-Launch Readiness Cycle</h3>
              <p className="hint">
                15 framework-aligned readiness checks across Email Intelligence, StoryBrand, Hormozi Offer, VOC Personalization, and Market Compliance. Pass at least 12/15 with all 5 audits clean before launching a campaign.
              </p>
              <p className="hint" style={{ opacity: 0.7, fontSize: '0.85em' }}>
                Most checks are framework-based scaffolding. <strong>Email Intelligence (Persuasion)</strong> upgrades to real Claude-powered analysis once a campaign with subject/body content exists and <code>ANTHROPIC_API_KEY</code> is configured server-side.
              </p>
              <div className="grid cards3">
                <div>
                  <p className="hint">Passed</p>
                  <strong>{agentSummary?.passed || 0}</strong>
                </div>
                <div>
                  <p className="hint">Auditors</p>
                  <strong>{agentSummary?.all_audits_passed ? 'PASS' : 'BLOCKED'}</strong>
                </div>
                <div>
                  <p className="hint">Launch Gate</p>
                  <strong>{agentSummary?.minimum_ready ? 'READY' : 'NOT READY'}</strong>
                </div>
              </div>
              <button onClick={runMinimumAgentCycle} disabled={runningAgents}>
                {runningAgents ? 'Running minimum cycle...' : 'Run Minimum Cycle'}
              </button>
            </article>
            <article className="card">
              <h3>Agent Status Grid</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Area</th>
                      <th>Lane</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentRows.map((row) => (
                      <tr key={row.agent_key}>
                        <td><code style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{row.agent_key}</code></td>
                        <td>{row.area}</td>
                        <td><span className={`badge badge-lane-${row.lane}`}>{row.lane}</span></td>
                        <td><span className={`badge badge-agent-${row.status}`}>{row.status}</span></td>
                        <td>
                          {row.score > 0 && (
                            <div className="score-bar-mini">
                              <div className="score-fill-mini" style={{ width: `${row.score}%`, background: row.score >= 85 ? 'var(--accent)' : row.score >= 70 ? '#f0a500' : 'var(--danger)' }} />
                              <span>{row.score}</span>
                            </div>
                          )}
                        </td>
                        <td><small>{row.notes}</small></td>
                      </tr>
                    ))}
                    {!agentRows.length && (
                      <tr>
                        <td colSpan={6}>No agent runs yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {tab === 'billing' && (
          <section className="grid split">
            <article className="card">
              <h3>Billing and Plan</h3>
              <p className="hint">Current plan controls monthly send limits and team capabilities.</p>
              <div className="grid cards3">
                <div>
                  <p className="hint">Plan</p>
                  <strong>{billingStatus?.plan?.toUpperCase() || 'FREE'}</strong>
                </div>
                <div>
                  <p className="hint">Limit</p>
                  <strong>{billingStatus?.monthly_send_limit || 100}</strong>
                </div>
                <div>
                  <p className="hint">Remaining</p>
                  <strong>{billingStatus?.remaining_sends ?? 100}</strong>
                </div>
              </div>
              <p className="hint">Used this period: {billingStatus?.sent_this_period ?? 0} | Period: {billingStatus?.period_key || '-'}</p>
              <div className="stack" style={{ marginTop: '10px' }}>
                <button disabled={billingLoading || !launchStatus?.providers.stripe} onClick={() => startCheckout('pro')}>Upgrade to Pro</button>
                <button disabled={billingLoading || !launchStatus?.providers.stripe} onClick={() => startCheckout('team')}>Upgrade to Team</button>
                <button className="ghost" disabled={billingLoading || !launchStatus?.providers.stripe} onClick={openBillingPortal}>Manage Billing</button>
                {!launchStatus?.providers.stripe && <p className="hint">Stripe is optional today. Use the System Audit tab for in-house plan control.</p>}
              </div>
            </article>
            <article className="card">
              <h3>Webhook Setup</h3>
              <p className="hint">Configure these in providers for live metrics + billing sync:</p>
              <ul className="signals">
                <li>
                  <span>Resend Events</span>
                  <small><code>{`${window.location.origin}/api/webhooks/resend`}</code></small>
                </li>
                <li>
                  <span>Stripe Events</span>
                  <small><code>{`${window.location.origin}/api/webhooks/stripe`}</code></small>
                </li>
                <li>
                  <span>CRM Conversions</span>
                  <small><code>{`${window.location.origin}/api/webhooks/conversions?key=...`}</code></small>
                </li>
              </ul>
            </article>
          </section>
        )}

        {tab === 'audit' && (
          <AuditDashboard token={localStorage.getItem('signaliq_token') || ''} />
        )}

        {tab === 'team' && user.role === 'admin' && (
          <section className="grid">
            <article className="card">
              <h3>Role-Based Team Access</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((member) => (
                      <tr key={member.id}>
                        <td>{member.name}</td>
                        <td>{member.email}</td>
                        <td>{titleRole(member.role)}</td>
                        <td>
                          <select
                            value={member.role}
                            onChange={(e) => changeRole(member.id, e.target.value as Role)}
                          >
                            {roles.map((role) => (
                              <option key={role} value={role}>
                                {titleRole(role)}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {!users.length && (
                      <tr>
                        <td colSpan={4}>No users loaded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {tab === 'matrix' && (
          <section className="grid split">
            <article className="card">
              <h3>Predicted vs Actual</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Predicted</th>
                      <th>Actual</th>
                      <th>Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => {
                      const delta = campaign.actual_conversion ? campaign.actual_conversion - campaign.predicted_conversion : null;
                      return (
                        <tr key={campaign.id}>
                          <td>{campaign.name}</td>
                          <td>{campaign.predicted_conversion}%</td>
                          <td>{campaign.actual_conversion ? `${campaign.actual_conversion}%` : '-'}</td>
                          <td>{delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}%` : '-'}</td>
                        </tr>
                      );
                    })}
                    {!campaigns.length && (
                      <tr>
                        <td colSpan={4}>No data yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
            <article className="card">
              <h3>Learning Signals</h3>
              <ul className="signals">
                {signals.map((signal) => (
                  <li key={signal.signal}>
                    <span>{signal.signal}</span>
                    <b>{signal.impact}</b>
                    <small>{signal.confidence}% confidence</small>
                  </li>
                ))}
                {!signals.length && <li>No signals yet.</li>}
              </ul>
            </article>
          </section>
        )}
        {tab === 'google' && (
          <section className="grid split">
            {/* Connection Card */}
            <article className="card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} style={{ color: '#4285f4' }} />
                Google Workspace
              </h3>
              {!googleStatus?.connected ? (
                <div className="stack">
                  <p className="hint">Connect your Google Workspace account to import contacts, sync Gmail activity, and send campaigns from your own domain.</p>
                  <div className="gws-features">
                    {[
                      { label: 'Google Contacts Import', desc: 'Sync your Google contacts directly into SignalIQ' },
                      { label: 'Gmail Sending', desc: 'Send campaigns from your own Gmail / Workspace address' },
                      { label: 'Profile Personalization', desc: 'Enrich contacts with Google profile data' },
                    ].map((f) => (
                      <div key={f.label} className="gws-feature">
                        <strong>{f.label}</strong>
                        <p className="hint">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="gws-setup-box">
                    <p className="hint" style={{ fontSize: '0.82rem' }}>
                      Google Workspace is optional for today's launch. You can launch immediately with Resend or SMTP, then add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> later.
                    </p>
                  </div>
                  <button onClick={connectGoogle} disabled={googleConnecting} style={{ background: 'linear-gradient(90deg, #4285f4, #34a853)' }}>
                    {googleConnecting ? 'Redirecting to Google...' : 'Connect Google Workspace'}
                  </button>
                </div>
              ) : (
                <div className="stack">
                  <div className="gws-connected-badge">
                    <div className="gws-dot-large" />
                    <div>
                      <strong>{googleStatus.google_name}</strong>
                      <p className="hint">{googleStatus.google_email}</p>
                    </div>
                  </div>
                  <p className="hint">Connected since {googleStatus.connected_at ? new Date(googleStatus.connected_at).toLocaleDateString() : 'recently'}</p>
                  <div className="gws-scopes">
                    {(googleStatus.scopes || []).map((s) => {
                      const label = s.includes('contacts') ? 'Contacts' : s.includes('gmail.send') ? 'Gmail Send' : s.includes('gmail') ? 'Gmail Read' : s.includes('profile') ? 'Profile' : s.includes('email') ? 'Email' : s.split('/').pop() || s;
                      return <span key={s} className="gws-scope-chip">{label}</span>;
                    })}
                  </div>
                  <button className="ghost" onClick={disconnectGoogle}>Disconnect Google</button>
                </div>
              )}
            </article>

            {/* Contacts Sync Card */}
            <article className="card">
              <h3>Google Contacts Sync</h3>
              {!googleStatus?.connected ? (
                <p className="hint">Connect Google Workspace first to import contacts.</p>
              ) : (
                <div className="stack">
                  <p className="hint">Import your Google Workspace contacts into SignalIQ. New contacts are added; existing emails are skipped.</p>
                  <button
                    onClick={syncGoogleContacts}
                    disabled={googleSyncing}
                    style={{ background: 'linear-gradient(90deg, #34a853, #4285f4)' }}
                  >
                    {googleSyncing ? 'Syncing contacts...' : 'Sync Google Contacts'}
                  </button>
                  {googleSyncResult && (
                    <div className="gws-sync-result">
                      <div className="grid cards3" style={{ gap: '10px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <p className="hint">Imported</p>
                          <strong style={{ color: 'var(--accent)' }}>{googleSyncResult.imported}</strong>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p className="hint">Skipped</p>
                          <strong style={{ color: 'var(--muted)' }}>{googleSyncResult.skipped}</strong>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p className="hint">Total</p>
                          <strong>{googleSyncResult.total}</strong>
                        </div>
                      </div>
                      {googleSyncResult.results.length > 0 && (
                        <div className="table-wrap" style={{ marginTop: '10px' }}>
                          <table>
                            <thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>
                            <tbody>
                              {googleSyncResult.results.map((r) => (
                                <tr key={r.email}>
                                  <td>{r.name}</td>
                                  <td><small>{r.email}</small></td>
                                  <td>
                                    <span className={`badge ${r.status === 'imported' ? 'badge-running' : 'badge-draft'}`}>{r.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </article>

            {/* Gmail Profile Card */}
            {googleStatus?.connected && gmailProfile && (
              <article className="card">
                <h3>Gmail Account</h3>
                <div className="grid cards3" style={{ gap: '10px' }}>
                  <div>
                    <p className="hint">Address</p>
                    <strong style={{ fontSize: '1rem' }}>{gmailProfile.email}</strong>
                  </div>
                  <div>
                    <p className="hint">Messages</p>
                    <strong>{gmailProfile.messages_total?.toLocaleString()}</strong>
                  </div>
                  <div>
                    <p className="hint">Threads</p>
                    <strong>{gmailProfile.threads_total?.toLocaleString()}</strong>
                  </div>
                </div>
                <p className="hint" style={{ marginTop: '12px' }}>Gmail sending is available once connected. Set <code>SENDING_FROM</code> in your .env to use your Gmail address for outreach campaigns.</p>
              </article>
            )}

            {/* Setup Guide */}
            <article className="card">
              <h3>Setup Guide</h3>
              <ol className="gws-guide">
                <li>
                  <strong>Create a Google Cloud Project</strong>
                  <p className="hint">Go to console.cloud.google.com → New Project</p>
                </li>
                <li>
                  <strong>Enable APIs</strong>
                  <p className="hint">Enable: People API, Gmail API, Google+ API</p>
                </li>
                <li>
                  <strong>Create OAuth 2.0 Credentials</strong>
                  <p className="hint">APIs & Services → Credentials → Create OAuth client ID (Web Application)</p>
                </li>
                <li>
                  <strong>Add Redirect URI</strong>
                  <p className="hint"><code style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}>{`${window.location.origin}/api/google/callback`}</code></p>
                </li>
                <li>
                  <strong>Add to .env</strong>
                  <p className="hint"><code>GOOGLE_CLIENT_ID=your_client_id</code><br /><code>GOOGLE_CLIENT_SECRET=your_secret</code></p>
                </li>
                <li>
                  <strong>Restart server and click Connect</strong>
                  <p className="hint">You'll be redirected to Google to authorize access</p>
                </li>
              </ol>
            </article>
          </section>
        )}

        {/* ── Sending Inboxes Tab ─────────────────────────────────────────── */}
        {tab === 'inboxes' && (
          <section className="grid split">
            {/* Summary card */}
            <article className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Mail size={18} style={{ color: 'var(--accent)' }} />
                Multi-Inbox Rotation
                {inboxSummary && (
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <span className="badge badge-agent-pass">Cap: {inboxSummary.totalCapacity}/day</span>
                    <span className="badge badge-running">Used: {inboxSummary.usedToday} today</span>
                    <span className="badge badge-draft">Remaining: {inboxSummary.remaining}</span>
                  </div>
                )}
              </h3>
              <p className="hint" style={{ marginBottom: 12 }}>
                Each connected inbox sends independently. The system auto-selects the healthiest inbox with available capacity (primed &gt; ramping, highest health score first).
              </p>
              {!googleStatus?.connected ? (
                <div className="empty-state"><p>Connect Google Workspace first to register sending inboxes.</p></div>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={registerInbox} disabled={inboxAddLoading} style={{ background: 'linear-gradient(90deg,#4285f4,#34a853)' }}>
                    {inboxAddLoading ? 'Registering...' : '+ Register Connected Inbox'}
                  </button>
                  <button className="ghost" onClick={loadInboxes} disabled={inboxLoading}>Refresh</button>
                </div>
              )}
            </article>

            {inboxLoading && <article className="card"><p className="hint">Loading inboxes...</p></article>}

            {inboxes.length === 0 && !inboxLoading && (
              <article className="card" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-state">
                  <p>No sending inboxes registered yet.</p>
                  <p className="hint">Connect Google Workspace and click "Register Connected Inbox" to add your first inbox.</p>
                </div>
              </article>
            )}

            {inboxes.map(inbox => (
              <article key={inbox.id} className="card" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ fontSize: '1rem' }}>{inbox.label || inbox.email}</strong>
                    <p className="hint" style={{ marginTop: 2 }}>{inbox.google_email || inbox.email}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className={`badge ${inbox.pool === 'primed' ? 'badge-agent-pass' : inbox.pool === 'ramping' ? 'badge-running' : 'badge-draft'}`}>{inbox.pool}</span>
                    <span className={`badge ${inbox.is_active ? 'badge-agent-pass' : 'badge-agent-fail'}`}>{inbox.is_active ? 'active' : 'paused'}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, margin: '12px 0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p className="hint" style={{ fontSize: '0.78rem' }}>Health</p>
                    <div className="copy-score-bar" style={{ margin: '4px 0' }}>
                      <div className="copy-score-track"><div className="copy-score-fill" style={{ width: `${inbox.health_score}%`, background: inbox.health_score >= 85 ? '#1a7f37' : inbox.health_score >= 60 ? '#b08a00' : '#cf2929' }} /></div>
                    </div>
                    <strong style={{ color: inbox.health_score >= 85 ? '#1a7f37' : inbox.health_score >= 60 ? '#b08a00' : '#cf2929' }}>{inbox.health_score}%</strong>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p className="hint" style={{ fontSize: '0.78rem' }}>Today</p>
                    <strong>{inbox.sends_today} / {inbox.daily_limit}</strong>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p className="hint" style={{ fontSize: '0.78rem' }}>Warmup Day</p>
                    <strong>{inbox.warmup_day || inbox.warmup_current_day || 0}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="hint" style={{ fontSize: '0.8rem' }}>Daily cap:</label>
                  <input type="number" min={1} max={200} defaultValue={inbox.daily_limit} style={{ width: 70 }}
                    onBlur={e => updateInboxLimit(inbox.id, Number(e.target.value))} />
                  <button className="ghost" onClick={() => toggleInbox(inbox.id, !inbox.is_active)} style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                    {inbox.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button className="ghost" onClick={() => removeInbox(inbox.id)} style={{ fontSize: '0.8rem', padding: '4px 10px', color: 'var(--danger)' }}>Remove</button>
                </div>
              </article>
            ))}

            {/* Multi-inbox scaling guide */}
            <article className="card" style={{ gridColumn: '1 / -1' }}>
              <h3>Inbox Scaling Formula</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Daily New Prospects</th><th>Sequence Touches</th><th>Safe Sends/Inbox</th><th>Inboxes Needed</th><th>Est. Monthly Cost</th></tr></thead>
                  <tbody>
                    {[
                      [50, 3, 50, 3, '~$54'],
                      [150, 3, 75, 6, '~$108'],
                      [300, 4, 90, 14, '~$252'],
                      [500, 4, 100, 20, '~$360'],
                      [1000, 5, 100, 50, '~$900'],
                    ].map(r => (
                      <tr key={String(r[0])}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}/day</td><td>{r[3]} inboxes</td><td>{r[4]}/mo</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {/* ── Warm-Up Dashboard Tab ─────────────────────────────────────────── */}
        {tab === 'warmup' && (
          <section className="grid split">
            {/* Stats header */}
            {warmupStats && (
              <article className="card" style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} style={{ color: 'var(--accent)' }} />Warm-Up Dashboard</h3>
                <div className="overview-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 12 }}>
                  {[
                    { label: 'Primed Inboxes', value: warmupStats.stats.primed, color: '#1a7f37' },
                    { label: 'Ramping', value: warmupStats.stats.ramping, color: '#4285f4' },
                    { label: 'Resting', value: warmupStats.stats.resting, color: '#b08a00' },
                    { label: 'Avg Health Score', value: `${warmupStats.stats.avgHealth}%`, color: warmupStats.stats.avgHealth >= 85 ? '#1a7f37' : '#b08a00' },
                    { label: 'Sends Today', value: warmupStats.stats.sendsToday, color: 'var(--accent)' },
                    { label: 'Daily Capacity', value: `${warmupStats.stats.dailyCapacity}/day`, color: 'var(--fg)' },
                    { label: 'Total Inboxes', value: warmupStats.stats.total, color: 'var(--fg)' },
                  ].map(s => (
                    <div key={s.label} className="stat-card">
                      <div className="stat-sub">{s.label}</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {warmupLoading && <article className="card"><p className="hint">Loading warmup data...</p></article>}

            {/* Per-inbox warmup progress */}
            {warmupStats && warmupStats.inboxes.length > 0 && (
              <article className="card">
                <h3>Inbox Warmup Progress</h3>
                {warmupStats.inboxes.map(inbox => {
                  const day = inbox.warmup_current_day || inbox.warmup_day || 0;
                  const progress = Math.min(100, Math.round((day / 28) * 100));
                  return (
                    <div key={inbox.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div>
                          <strong style={{ fontSize: '0.9rem' }}>{inbox.label || inbox.email}</strong>
                          <span className={`badge ${inbox.pool === 'primed' ? 'badge-agent-pass' : inbox.pool === 'ramping' ? 'badge-running' : 'badge-draft'}`} style={{ marginLeft: 8 }}>{inbox.pool}</span>
                        </div>
                        <span className="hint" style={{ fontSize: '0.8rem' }}>Day {day} / 28</span>
                      </div>
                      <div className="copy-score-bar"><div className="copy-score-track"><div className="copy-score-fill" style={{ width: `${progress}%` }} /></div></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span className="hint" style={{ fontSize: '0.78rem' }}>Daily limit: {inbox.daily_limit} sends</span>
                        <span className="hint" style={{ fontSize: '0.78rem' }}>Health: {inbox.health_score}%</span>
                      </div>
                    </div>
                  );
                })}
              </article>
            )}

            {/* Warmup schedule reference */}
            {warmupStats && (
              <article className="card">
                <h3>4-Week Ramp Schedule</h3>
                <p className="hint" style={{ marginBottom: 12 }}>Industry-validated warmup protocol. Skipping costs 67% higher bounce rates.</p>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Days</th><th>Warmup Sends</th><th>Cold Sends</th><th>Total/Day</th></tr></thead>
                    <tbody>
                      {warmupStats.schedule.map(r => (
                        <tr key={r.day_range}>
                          <td>Day {r.day_range}</td>
                          <td style={{ color: '#4285f4' }}>{r.warmup}</td>
                          <td style={{ color: 'var(--accent)' }}>{r.cold}</td>
                          <td><strong>{r.total}</strong>{r.note ? <span className="badge badge-agent-pass" style={{ marginLeft: 6 }}>{r.note}</span> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {/* Gmail test send */}
            {googleStatus?.connected && (
              <article className="card">
                <h3>Gmail Send Test</h3>
                <p className="hint" style={{ marginBottom: 12 }}>Send a live test email via your connected Gmail to verify the API is working.</p>
                <div className="stack">
                  <input placeholder="To: recipient@example.com" value={gmailTestForm.to} onChange={e => setGmailTestForm(f => ({...f, to: e.target.value}))} />
                  <input placeholder="Subject" value={gmailTestForm.subject} onChange={e => setGmailTestForm(f => ({...f, subject: e.target.value}))} />
                  <textarea placeholder="HTML body (optional)" rows={3} value={gmailTestForm.html} onChange={e => setGmailTestForm(f => ({...f, html: e.target.value}))} />
                  <button onClick={sendGmailTest} disabled={gmailSendLoading} style={{ background: 'linear-gradient(90deg,#4285f4,#34a853)' }}>
                    {gmailSendLoading ? 'Sending...' : 'Send Test via Gmail API'}
                  </button>
                  {gmailSendResult && (
                    <div className="gws-connected-badge">
                      <div className="gws-dot-large" />
                      <div><strong>Sent!</strong><p className="hint">Message ID: {gmailSendResult.message_id}</p></div>
                    </div>
                  )}
                </div>
              </article>
            )}

            {(!warmupStats || warmupStats.inboxes.length === 0) && !warmupLoading && (
              <article className="card" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-state">
                  <p>No inboxes registered for warmup tracking.</p>
                  <p className="hint">Go to Sending Inboxes and register a Google Workspace inbox to start warmup tracking.</p>
                  <button onClick={() => setTab('inboxes')}>Go to Sending Inboxes →</button>
                </div>
              </article>
            )}
          </section>
        )}

        {/* ── Scheduled Sends Tab ─────────────────────────────────────────── */}
        {tab === 'scheduled' && (
          <section className="grid split">
            {/* Optimal time card */}
            <article className="card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Rocket size={18} style={{ color: 'var(--accent)' }} />Smart Send Scheduler</h3>
              <p className="hint" style={{ marginBottom: 12 }}>
                Automatically schedules campaigns at peak engagement windows. Tue/Wed 9–11am in recipient timezone delivers 38–44% open rates vs. 15–20% for unoptimized sends.
              </p>
              <div className="stack">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="hint">Campaign</label>
                    <select value={scheduleForm.campaign_id} onChange={e => setScheduleForm(f => ({...f, campaign_id: e.target.value}))}>
                      <option value="">Select campaign...</option>
                      {campaigns.filter(c => c.status === 'draft').map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="hint">Timezone</label>
                    <select value={scheduleForm.timezone} onChange={e => setScheduleForm(f => ({...f, timezone: e.target.value}))}>
                      <option value="America/New_York">US Eastern</option>
                      <option value="America/Chicago">US Central</option>
                      <option value="America/Denver">US Mountain</option>
                      <option value="America/Los_Angeles">US Pacific</option>
                      <option value="Europe/London">UK/GMT</option>
                      <option value="Europe/Berlin">Europe/CET</option>
                      <option value="Asia/Singapore">Singapore</option>
                      <option value="Australia/Sydney">Sydney</option>
                    </select>
                  </div>
                  <div>
                    <label className="hint">Send Window</label>
                    <select value={scheduleForm.sending_window} onChange={e => setScheduleForm(f => ({...f, sending_window: e.target.value}))}>
                      <option value="default">Default (Tue/Wed 9-11am) — Recommended</option>
                      <option value="tech">Tech/SaaS (Tue-Wed 8-10am)</option>
                      <option value="finance">Finance (Mon-Thu 7-9am)</option>
                      <option value="healthcare">Healthcare (Wed-Thu 2-4pm)</option>
                      <option value="csuite">C-Suite (Mon-Wed 6-8am)</option>
                    </select>
                  </div>
                </div>
                {optimalTime && (
                  <div className="gws-setup-box">
                    <strong style={{ fontSize: '0.85rem' }}>Next optimal send:</strong>
                    <p className="hint">{new Date(optimalTime.recommended).toLocaleString()} ({scheduleForm.timezone})</p>
                  </div>
                )}
                <button onClick={scheduleCampaign} disabled={!scheduleForm.campaign_id} style={{ background: 'linear-gradient(90deg,var(--accent),#34a853)' }}>
                  Schedule Campaign at Optimal Time
                </button>
              </div>
            </article>

            {/* Timing benchmark table */}
            <article className="card">
              <h3>Optimal Timing Data (10M+ Sends)</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Window</th><th>Open Rate Index</th><th>Reply Index</th></tr></thead>
                  <tbody>
                    {[
                      ['Tue 9-11am', '1.42x', '1.38x'],
                      ['Wed 9-11am', '1.35x', '1.29x'],
                      ['Thu 9-11am', '1.28x', '1.22x'],
                      ['Tue 1-2pm', '1.21x', '1.15x'],
                      ['Mon (any)', '0.82x', '0.71x'],
                      ['Fri PM', '0.64x', '0.53x'],
                      ['Weekend', '0.41x', '0.38x'],
                    ].map(r => (
                      <tr key={r[0]}>
                        <td>{r[0]}</td>
                        <td style={{ color: parseFloat(r[1]) >= 1.2 ? '#1a7f37' : parseFloat(r[1]) >= 1.0 ? 'var(--fg)' : 'var(--danger)' }}><strong>{r[1]}</strong></td>
                        <td style={{ color: parseFloat(r[2]) >= 1.2 ? '#1a7f37' : parseFloat(r[2]) >= 1.0 ? 'var(--fg)' : 'var(--danger)' }}>{r[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            {/* Scheduled queue */}
            <article className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Scheduled Queue
                <button className="ghost" onClick={loadScheduled} disabled={scheduledLoading} style={{ fontSize: '0.8rem', padding: '4px 10px' }}>Refresh</button>
              </h3>
              {scheduledSends.length === 0 ? (
                <div className="empty-state"><p>No scheduled sends. Select a draft campaign above and schedule it.</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Campaign</th><th>Scheduled At</th><th>Timezone</th><th>Window</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {scheduledSends.map(s => (
                        <tr key={s.id}>
                          <td><strong>{s.subject || `Campaign #${s.campaign_id}`}</strong></td>
                          <td>{new Date(s.scheduled_at).toLocaleString()}</td>
                          <td><small>{s.timezone}</small></td>
                          <td>{s.sending_window}</td>
                          <td>
                            <span className={`badge ${s.status === 'processed' ? 'badge-agent-pass' : s.status === 'pending' ? 'badge-running' : s.status === 'error' ? 'badge-agent-fail' : 'badge-draft'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td>
                            {s.status === 'pending' && (
                              <button className="ghost" onClick={() => cancelScheduled(s.id)} style={{ fontSize: '0.78rem', padding: '3px 8px', color: 'var(--danger)' }}>Cancel</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        )}

        {/* ── Email Verifier Tab ───────────────────────────────────────────── */}
        {tab === 'verify' && (
          <section className="grid split">
            {/* Single verify */}
            <article className="card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={18} style={{ color: 'var(--accent)' }} />Single Email Verify</h3>
              <p className="hint" style={{ marginBottom: 12 }}>Format check + disposable domain detection + live MX record lookup. Results cached 7 days.</p>
              <div className="stack">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input placeholder="email@company.com" value={verifyInput} onChange={e => setVerifyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && verifySingle()} style={{ flex: 1 }} />
                  <button onClick={verifySingle} disabled={verifyLoading || !verifyInput.trim()}>
                    {verifyLoading ? '...' : 'Verify'}
                  </button>
                </div>
                {verifyResult && (
                  <div style={{ padding: 12, borderRadius: 10, border: `1px solid ${verifyResult.is_valid ? 'rgba(26,127,55,0.3)' : 'rgba(207,41,41,0.3)'}`, background: verifyResult.is_valid ? 'rgba(26,127,55,0.06)' : 'rgba(207,41,41,0.06)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '1.5rem' }}>{verifyResult.is_valid ? '✅' : '❌'}</span>
                      <div>
                        <strong>{verifyResult.is_valid ? 'Valid' : 'Invalid'} — Score: {verifyResult.score}/100</strong>
                        <p className="hint" style={{ margin: 0 }}>{verifyResult.reason}</p>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                      {[
                        { label: 'Format', pass: verifyResult.score > 0 },
                        { label: 'Not Disposable', pass: !verifyResult.is_disposable },
                        { label: 'MX Found', pass: !!verifyResult.mx_found },
                      ].map(c => (
                        <div key={c.label} style={{ textAlign: 'center' }}>
                          <div style={{ color: c.pass ? '#1a7f37' : '#cf2929', fontSize: '1.2rem' }}>{c.pass ? '✓' : '✗'}</div>
                          <p className="hint" style={{ fontSize: '0.78rem' }}>{c.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>

            {/* Bulk verify */}
            <article className="card">
              <h3>Bulk Email Verifier</h3>
              <p className="hint" style={{ marginBottom: 12 }}>Paste up to 500 emails (one per line, or comma/semicolon separated). Bad emails increase bounce rate and tank domain reputation.</p>
              <div className="stack">
                <textarea
                  placeholder={'email1@company.com\nemail2@corp.io\nemail3@business.com'}
                  rows={6} value={bulkVerifyInput} onChange={e => setBulkVerifyInput(e.target.value)}
                />
                <button onClick={verifyBulk} disabled={verifyLoading || !bulkVerifyInput.trim()} style={{ background: 'linear-gradient(90deg,var(--accent),#4285f4)' }}>
                  {verifyLoading ? 'Verifying...' : `Verify ${bulkVerifyInput.split(/[\n,;]+/).filter(Boolean).length} Emails`}
                </button>
                {bulkVerifyResult && (
                  <div>
                    <div className="overview-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 12 }}>
                      {[
                        { label: 'Total', value: bulkVerifyResult.total, color: 'var(--fg)' },
                        { label: 'Valid', value: bulkVerifyResult.valid, color: '#1a7f37' },
                        { label: 'Invalid', value: bulkVerifyResult.invalid, color: '#cf2929' },
                        { label: 'Disposable', value: bulkVerifyResult.disposable, color: '#b08a00' },
                      ].map(s => (
                        <div key={s.label} className="stat-card">
                          <div className="stat-sub">{s.label}</div>
                          <strong style={{ fontSize: '1.6rem', color: s.color }}>{s.value}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="table-wrap" style={{ maxHeight: 240, overflowY: 'auto' }}>
                      <table>
                        <thead><tr><th>Email</th><th>Valid</th><th>Score</th><th>Reason</th></tr></thead>
                        <tbody>
                          {bulkVerifyResult.results.map(r => (
                            <tr key={r.email}>
                              <td><small>{r.email}</small></td>
                              <td><span className={`badge ${r.is_valid ? 'badge-agent-pass' : 'badge-agent-fail'}`}>{r.is_valid ? 'valid' : 'invalid'}</span></td>
                              <td>{r.score}</td>
                              <td><small className="hint">{r.reason}</small></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </article>

            {/* Deliverability guide */}
            <article className="card" style={{ gridColumn: '1 / -1' }}>
              <h3>Deliverability Benchmarks (2026)</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Metric</th><th>Bad</th><th>Average</th><th>Good</th><th>Elite (Top 10%)</th></tr></thead>
                  <tbody>
                    {[
                      ['Open Rate', '<15%', '20-30%', '35-45%', '50%+'],
                      ['Reply Rate', '<1%', '2-3%', '4-7%', '8%+'],
                      ['Bounce Rate', '>5%', '2-5%', '1-2%', '<1%'],
                      ['Spam Complaint', '>0.3%', '0.1-0.3%', '<0.1%', '<0.05%'],
                      ['Unsubscribe Rate', '>1%', '0.3-0.8%', '0.1-0.3%', '<0.1%'],
                      ['List Validity', '<60%', '70-80%', '85-92%', '95%+'],
                    ].map(r => (
                      <tr key={r[0]}><td><strong>{r[0]}</strong></td><td style={{ color: '#cf2929' }}>{r[1]}</td><td>{r[2]}</td><td style={{ color: '#1a7f37' }}>{r[3]}</td><td style={{ color: '#4285f4', fontWeight: 700 }}>{r[4]}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

      </main>
      <nav className="mobile-nav">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Home</button>
        <button className={tab === 'campaigns' ? 'active' : ''} onClick={() => setTab('campaigns')}>Launch</button>
        <button className={tab === 'ops' ? 'active' : ''} onClick={() => setTab('ops')}>Ops</button>
        <button className={tab === 'agents' ? 'active' : ''} onClick={() => setTab('agents')}>Agents</button>
        <button className={tab === 'kpis' ? 'active' : ''} onClick={() => setTab('kpis')}>KPI</button>
      </nav>
    </div>
  );
}
