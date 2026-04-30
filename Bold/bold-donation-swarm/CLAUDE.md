# BOLD Ministries — Donation Funnel Swarm
## Claude Code Master Instructions

**Project:** 10-agent AI donation funnel for BOLD Ministries (boldministries.org)
**Owner:** Nu Wav Media / Rank Marketing — Alvin Warren
**Stack:** Anthropic API · Make.com · Stripe · GHL · Klaviyo · Vercel · Supabase
**Pattern:** 3×1 agent workflow → Research → Copy → QC → Build → Nurture → Optimize

---

## Read These First On Every Session

1. `tasks/todo.md` — current task list and status
2. `tasks/lessons.md` — mistakes made, patterns learned
3. `config/swarm.config.json` — all agent definitions and MCP bindings
4. `docs/specs/2025-04-07-swarm-design.md` — full architecture spec

---

## Agent Roster

| ID | Name | Layer | File |
|----|------|-------|------|
| A0 | Orchestrator | Control | `agents/a0-orchestrator.md` |
| A1 | Researcher | Pre-launch | `agents/a1-researcher.md` |
| A2 | Traffic Qualifier | Entry | `agents/a2-traffic-qualifier.md` |
| A3 | Funnel Copywriter | Copy | `agents/a3-copywriter.md` |
| A4 | Page Builder | Build | `agents/a4-page-builder.md` |
| A5 | QC Gate | Gate 1 | `agents/a5-qc-gate.md` |
| A6 | Abandonment Recovery | Layer 3 | `agents/a6-abandonment.md` |
| A7 | Thank You + Upsell | Layer 4 | `agents/a7-thankyou.md` |
| A8 | Donor Nurture | Layer 5 | `agents/a8-nurture.md` |
| A9 | Analytics Optimizer | Layer 6 | `agents/a9-analytics.md` |
| QC2 | Ongoing QC | Gate 2 | `agents/qc2-ongoing.md` |
| R2 | Ongoing Researcher | Ongoing | `agents/r2-ongoing.md` |

---

## Pipeline Execution Order

```
A1 (Research) + A2 (Traffic) → parallel
        ↓
A3 (Copy) + A4 (Page Builder) → parallel
        ↓
A5 (QC Gate) → BLOCK or PASS
        ↓
A6 (Abandonment) → A7 (Thank You) → A8 (Nurture)
        ↓
A9 (Analytics) → feedback → A0 (Orchestrator)
        ↓
QC2 + R2 → ongoing background (Dispatch-ready)
```

---

## Autonomous Agent Rules

- Enter plan mode for ANY task with 3+ steps
- Use subagents for parallel work — A1 and A2 always run in parallel
- Never mark complete without proving it works
- A5 QC Gate BLOCKS launch if any critical check fails — no exceptions
- Update `tasks/todo.md` as you go
- Log all corrections to `tasks/lessons.md`

---

## MCP Servers In Use

- `stripe` — payment form, gift tiers, recurring upsell
- `vercel` — deploy donation page and thank-you page
- `supabase` — donor CRM, event tracking, analytics store
- `make` — automation triggers (abandonment, nurture, GHL)
- `klaviyo` — email nurture sequences
- `gmail` — donor receipts and confirmation emails

---

## Environment Variables Required

```bash
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
VERCEL_TOKEN=
MAKE_WEBHOOK_ABANDONMENT=
MAKE_WEBHOOK_THANKYOU=
KLAVIYO_API_KEY=
GHL_API_KEY=
```

All vars live in `.env` — never commit this file.

---

## Output Directories

- `outputs/copy/` — all copywriter outputs (JSON)
- `outputs/pages/` — built HTML donation pages
- `outputs/qc-reports/` — QC audit reports (JSON)
- `outputs/nurture/` — email sequence drafts
- `outputs/analytics/` — conversion reports

---

## Key Constraints

- BOLD Ministries is a 501(c)(3) — all copy must include proper charitable giving language
- Stripe form must never store card data locally
- All donor data goes to Supabase — GDPR/CCPA compliant schema only
- QC Gate (A5) has veto power over launch — it cannot be bypassed
- Campaign: $1M capital campaign for senior housing in Rockdale County, GA
