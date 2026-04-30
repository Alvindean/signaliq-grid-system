# BOLD Ministries Swarm — Lessons Log

This file is updated after every correction. Claude Code reads it at session start.

---

## Pattern Library

### Swarm Execution
- Always run A1 + A2 in parallel — never fire sequentially, wastes time
- A5 QC Gate cannot be bypassed even if Orchestrator thinks copy is good
- If A3 copy fails QC twice in a row, escalate to human review — don't loop endlessly

### File Handling
- All agent outputs go to outputs/ subdirectories — never write to root
- brief.json from A1 is the single source of truth for all copy decisions
- deployed-urls.json must be written before A5 can run its Stripe UX check

### API Calls
- Anthropic API calls from Page Builder — use claude-haiku-4-5 for draft, sonnet for final
- Stripe Payment Element requires publishable key client-side only — never expose secret key
- Supabase anon key is safe client-side — service role key is server-side only

### 501c3 Compliance
- Every donation page must include: "BOLD Ministries is a 501(c)(3) nonprofit organization. Donations are tax-deductible to the extent allowed by law."
- Never include language that implies goods/services in exchange for donation
- EIN should appear in footer: consult client for exact EIN before going live

---

## Mistakes to Avoid

_Log entries added here after corrections during builds._

| Date | Mistake | Pattern | Prevention |
|------|---------|---------|------------|
| 2026-04-07 | Pipeline script used non-existent claude CLI flags | CLI syntax | Always verify CLI flags against `claude --help` before scripting |
| 2026-04-07 | `set -e` killed script before waiting on parallel agents | Bash error handling | Never use `set -e` with background processes — track exit codes manually |
| 2026-04-07 | .env.example missing 2 of 6 gift tier price IDs | Config completeness | Cross-check .env vars against swarm.config.json gift_tiers array |
| 2026-04-07 | A4 config said depends_on [a2] but prompt requires A3 output | Dependency mismatch | Agent prompt dependencies must match config dependencies exactly |
| 2026-04-07 | Campaign deadline set to 2025 (already past) | Stale dates | Always validate dates against current date at session start |
