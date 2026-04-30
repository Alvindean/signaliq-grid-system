# BOLD Ministries Donation Swarm — Task Tracker
## Updated: 2026-04-07

---

## Sprint 1 — Foundation (Complete)

- [x] Project scaffolded — directory structure created
- [x] CLAUDE.md master instructions written
- [x] swarm.config.json defined with all 12 agents
- [x] All 12 agent prompt files created
- [x] .env.example created and documented (all 6 gift tier price IDs)
- [x] Supabase schema migration written (migrations/001_initial_schema.sql)
- [ ] Stripe products + price IDs configured (requires Stripe dashboard)
- [ ] Make.com webhooks created — abandonment, thankyou, QC alert (requires Make dashboard)
- [ ] Klaviyo flow skeleton created (requires Klaviyo dashboard)
- [x] run-pipeline.sh script written — correct claude CLI syntax, parallel agent support
- [x] validate-outputs.sh script written — JSON/HTML validation, 501c3 checks, Stripe key safety
- [x] .gitignore fixed — output dirs tracked via .gitkeep
- [x] swarm.config.json debugged — A4 dependency fix, campaign deadline updated to 2026

---

## Sprint 2 — Core Pipeline (Next)

- [ ] Fill .env with real API keys
- [ ] Apply Supabase migration (migrations/001_initial_schema.sql)
- [ ] A1 Researcher — run and validate output brief.json
- [ ] A2 Traffic Qualifier — run and validate segments.json
- [ ] A3 Copywriter — run with A1 brief, validate copy output
- [ ] A4 Page Builder — build donation.html and thankyou.html
- [ ] A5 QC Gate — full audit, get APPROVED verdict
- [ ] Deploy to Vercel — confirm live URLs
- [ ] End-to-end test: visitor → donate → thank you → email receipt

---

## Sprint 3 — Post-Launch Agents

- [ ] A6 Abandonment Recovery — exit intent popup + GHL SMS sequence
- [ ] A7 Thank You + Upsell — Stripe recurring + social share
- [ ] A8 Donor Nurture — Klaviyo 5-email sequence live
- [ ] A9 Analytics — Supabase tracking live, first report generated

---

## Sprint 4 — Ongoing Agents (Dispatch-Ready)

- [ ] QC2 Ongoing — daily monitoring job tested
- [ ] R2 Ongoing Researcher — weekly brief job tested
- [ ] Document Dispatch migration plan for QC2 + R2

---

## Blocked / Requires Human Action

- [ ] Stripe: Create 6 products + prices ($25/$50/$100/$250/$500/$1000), drop price IDs in .env
- [ ] Make.com: Create 3 webhooks (abandonment, thankyou, QC alert), drop URLs in .env
- [ ] Klaviyo: Create donor list + abandoned list, drop IDs in .env
- [ ] BOLD Ministries: Get actual EIN number for 501c3 footer
- [ ] GHL: Get API key + location ID

---

## Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2025-04-07 | Vanilla HTML/CSS/JS for pages | No framework = faster load, easier QC |
| 2025-04-07 | claude-opus-4-5 for A0 + A5 | Orchestrator and QC need strongest reasoning |
| 2025-04-07 | claude-haiku-4-5 for A2, A6, A7 | Simpler tasks, cost efficiency |
| 2025-04-07 | Supabase for donor CRM | Already in Nu Wav stack, MCP connected |
| 2026-04-07 | Campaign deadline → 2026-12-31 | Original 2025 deadline was past |
| 2026-04-07 | A4 depends_on includes A3 | A4 needs A3 copy for final page assembly |

---

## Bugs Found & Fixed (2026-04-07)

| Bug | Fix |
|-----|-----|
| run-pipeline.sh used non-existent claude CLI flags (--agent, --system, --output, --context) | Rewrote to use `claude -p` with `--system-prompt` |
| `set -e` + background processes = orphaned agent on first failure | Removed set -e, added manual error tracking per PID |
| .env.example missing $50 and $250 tier price IDs | Added STRIPE_PRICE_ID_50 and STRIPE_PRICE_ID_250 |
| swarm.config.json A4 depends_on only listed a2, but prompt needs a3 output too | Updated to depends_on: [a2, a3] |
| Campaign deadline 2025-12-31 already past | Updated to 2026-12-31 |
| .gitignore excluded outputs/ entirely — empty dirs not tracked | Changed to outputs/**/* with .gitkeep exception |
| No output validation — invalid JSON would silently pass | Created validate-outputs.sh with JSON, HTML, 501c3, and Stripe key checks |
