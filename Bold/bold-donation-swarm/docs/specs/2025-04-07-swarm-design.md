# BOLD Ministries Donation Funnel Swarm — Design Spec
## Date: 2025-04-07 | Author: Nu Wav Media / Rank Marketing

---

## Overview

A 10-agent AI swarm that builds, launches, and optimizes a donation funnel for BOLD Ministries (boldministries.org), a 501(c)(3) nonprofit in Conyers, GA running a $1M capital campaign for affordable senior housing.

## Architecture

Pattern: 3×1 agent workflow — Research → Build → QC → Post-Conversion → Optimize

## Agent Pipeline

```
[A1 Researcher] ──┐
                   ├──→ [A3 Copywriter] ──┐
[A2 Traffic]   ──┘                         ├──→ [A5 QC Gate] ──→ LAUNCH
                   ├──→ [A4 Page Builder] ──┘
                   
POST-LAUNCH:
[A6 Abandonment] → [A7 Thank You] → [A8 Nurture] → [A9 Analytics] → [A0 Feedback]

ONGOING (Dispatch-ready):
[QC2 Daily Monitor] + [R2 Weekly Researcher]
```

## Model Assignment Rationale

| Agent | Model | Reason |
|-------|-------|--------|
| A0 Orchestrator | claude-opus-4-5 | Complex routing decisions, pipeline state |
| A1 Researcher | claude-sonnet-4-5 | Deep research, structured output |
| A2 Traffic Qualifier | claude-haiku-4-5 | Simple schema task |
| A3 Copywriter | claude-sonnet-4-5 | Creative writing quality |
| A4 Page Builder | claude-sonnet-4-5 | Code generation quality |
| A5 QC Gate | claude-opus-4-5 | Critical judgment, veto power |
| A6–A7 | claude-haiku-4-5 | Simpler templated outputs |
| A8 Nurture | claude-sonnet-4-5 | 5 full emails need quality |
| A9 Analytics | claude-sonnet-4-5 | Data interpretation |
| QC2 + R2 | haiku / sonnet | Background monitoring tasks |

## Data Flow

Visitor → Donation Page (Vercel) → Stripe → Supabase → Make.com → GHL/Klaviyo

## Success Metrics

- Checkout completion rate > 25%
- Average gift > $85
- Recurring upsell > 15%
- Nurture email open rate > 35%
- Campaign progress: $342K → $1M by Dec 31, 2025
