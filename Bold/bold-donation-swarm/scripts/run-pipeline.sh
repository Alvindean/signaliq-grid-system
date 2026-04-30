#!/bin/bash
# ============================================================
# BOLD Ministries Donation Funnel — Swarm Pipeline Runner
# Nu Wav Media / Rank Marketing
# Usage: ./scripts/run-pipeline.sh --stage all|research|copy|qc|post|ongoing
# ============================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$PROJECT_ROOT/config/swarm.config.json"
LOG="$PROJECT_ROOT/tasks/run.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

STAGE_VAL="${2:-all}"

log()     { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"; }
success() { echo -e "${GREEN}✓ $1${NC}"; log "SUCCESS: $1"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; log "WARN: $1"; }
fail()    { echo -e "${RED}✗ $1${NC}"; log "ERROR: $1"; }
die()     { fail "$1"; exit 1; }
info()    { echo -e "${BLUE}→ $1${NC}"; log "INFO: $1"; }

echo ""
echo "============================================================"
echo "  BOLD Ministries Donation Funnel — Swarm Pipeline"
echo "  Nu Wav Media / Rank Marketing"
echo "  Stage: $STAGE_VAL"
echo "============================================================"
echo ""

# ── Helpers ──────────────────────────────────────────────────

run_agent() {
  local agent_id="$1"
  local prompt_file="$PROJECT_ROOT/agents/$2"
  local message="$3"
  local output_file="$4"

  if [ ! -f "$prompt_file" ]; then
    die "Agent prompt not found: $prompt_file"
  fi

  local system_prompt
  system_prompt=$(cat "$prompt_file")

  info "Running agent $agent_id..."

  # Use claude CLI in non-interactive print mode
  local result
  result=$(claude -p \
    --system-prompt "$system_prompt" \
    "$message" 2>&1)

  local exit_code=$?

  if [ $exit_code -ne 0 ]; then
    fail "Agent $agent_id failed (exit $exit_code)"
    echo "$result" >> "$LOG"
    return 1
  fi

  # Write output if output file specified
  if [ -n "$output_file" ]; then
    mkdir -p "$(dirname "$output_file")"
    echo "$result" > "$output_file"
  fi

  success "Agent $agent_id complete"
  return 0
}

# ── Environment check ────────────────────────────────────────

check_env() {
  info "Checking environment variables..."
  local missing=0
  local required_vars=(
    "ANTHROPIC_API_KEY"
    "STRIPE_SECRET_KEY"
    "STRIPE_PUBLISHABLE_KEY"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "VERCEL_TOKEN"
  )
  for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
      fail "Missing required env var: $var"
      missing=1
    fi
  done
  if [ $missing -eq 1 ]; then
    die "Fix missing env vars in .env before running pipeline"
  fi
  success "All required env vars present"
}

# ── Stage: Research (A1 + A2 in parallel) ────────────────────

run_research() {
  info "Stage 1 — Research (A1 + A2 running in parallel)"

  local a1_failed=0 a2_failed=0

  run_agent "A1" "a1-researcher.md" \
    "Run the researcher agent for BOLD Ministries. Produce a full donor intelligence brief as structured JSON. Include: donor personas, benchmark gift amounts, competitor audit, messaging angles, and urgency levers for the \$1M senior housing campaign in Rockdale County GA. Output valid JSON only." \
    "$PROJECT_ROOT/outputs/research/brief.json" &
  local PID_A1=$!

  run_agent "A2" "a2-traffic-qualifier.md" \
    "Run the traffic qualifier agent for BOLD Ministries. Define UTM taxonomy, 4 donor segments (church_community, local_resident, referral, cold_traffic), personalization rules, and Supabase visitors table schema. Output valid JSON only." \
    "$PROJECT_ROOT/outputs/research/segments.json" &
  local PID_A2=$!

  # Wait for both — don't exit on first failure
  wait $PID_A1 || a1_failed=1
  wait $PID_A2 || a2_failed=1

  if [ $a1_failed -eq 1 ]; then fail "A1 Researcher failed"; fi
  if [ $a2_failed -eq 1 ]; then fail "A2 Traffic Qualifier failed"; fi
  if [ $a1_failed -eq 1 ] || [ $a2_failed -eq 1 ]; then
    die "Research stage failed. Fix errors above and retry."
  fi

  # Validate outputs are valid JSON
  "$PROJECT_ROOT/scripts/validate-outputs.sh" --stage research || die "Research output validation failed"
}

# ── Stage: Copy + Build (A3 + A4 in parallel) ────────────────

run_copy_build() {
  info "Stage 2 — Copy + Build (A3 + A4 running in parallel)"

  if [ ! -f "$PROJECT_ROOT/outputs/research/brief.json" ]; then
    die "A1 output missing (outputs/research/brief.json). Run research stage first."
  fi
  if [ ! -f "$PROJECT_ROOT/outputs/research/segments.json" ]; then
    die "A2 output missing (outputs/research/segments.json). Run research stage first."
  fi

  local brief segments
  brief=$(cat "$PROJECT_ROOT/outputs/research/brief.json")
  segments=$(cat "$PROJECT_ROOT/outputs/research/segments.json")

  local a3_failed=0 a4_failed=0

  run_agent "A3" "a3-copywriter.md" \
    "Write all donation page and thank you page copy for BOLD Ministries. Use this research brief as your creative foundation:

$brief

Output valid JSON with keys: hero_headline, hero_subheadline, impact_statement, gift_tiers, urgency_block, social_proof, cta_button, footer_501c3, thankyou_headline, thankyou_impact, recurring_upsell, social_share." \
    "$PROJECT_ROOT/outputs/copy/donation-page.json" &
  local PID_A3=$!

  run_agent "A4" "a4-page-builder.md" \
    "Build the donation page and thank you page HTML for BOLD Ministries. Use these traffic segments for personalization:

$segments

Build: Stripe Payment Element, gift tier selector (\$25/\$50/\$100/\$250/\$500/\$1000), campaign progress bar (\$342K of \$1M), recurring gift checkbox, UTM capture to Supabase, mobile-first WCAG 2.1 AA. Vanilla HTML/CSS/JS only. Output the full HTML." \
    "$PROJECT_ROOT/outputs/pages/donation.html" &
  local PID_A4=$!

  wait $PID_A3 || a3_failed=1
  wait $PID_A4 || a4_failed=1

  if [ $a3_failed -eq 1 ]; then fail "A3 Copywriter failed"; fi
  if [ $a4_failed -eq 1 ]; then fail "A4 Page Builder failed"; fi
  if [ $a3_failed -eq 1 ] || [ $a4_failed -eq 1 ]; then
    die "Copy/Build stage failed. Fix errors above and retry."
  fi

  "$PROJECT_ROOT/scripts/validate-outputs.sh" --stage copy || die "Copy output validation failed"
}

# ── Stage: QC Gate (A5 — blocking) ───────────────────────────

run_qc() {
  info "Stage 3 — QC Gate (A5)"

  if [ ! -f "$PROJECT_ROOT/outputs/copy/donation-page.json" ]; then
    die "A3 output missing. Run copy stage first."
  fi
  if [ ! -f "$PROJECT_ROOT/outputs/pages/donation.html" ]; then
    die "A4 output missing. Run build stage first."
  fi

  local copy_json page_html
  copy_json=$(cat "$PROJECT_ROOT/outputs/copy/donation-page.json")
  page_html=$(cat "$PROJECT_ROOT/outputs/pages/donation.html")

  run_agent "A5" "a5-qc-gate.md" \
    "Run the full QC audit for BOLD Ministries donation funnel. Check all critical and warning items.

COPY JSON:
$copy_json

PAGE HTML:
$page_html

Return valid JSON with keys: verdict (APPROVED or BLOCKED), critical_checks (array), warning_checks (array), fix_list (array if blocked), overall_score (0-100)." \
    "$PROJECT_ROOT/outputs/qc-reports/gate1.json"

  if [ $? -ne 0 ]; then
    die "A5 QC Gate agent failed to run"
  fi

  # Check verdict
  local verdict
  verdict=$(python3 -c "
import json, sys
try:
    d = json.load(open('$PROJECT_ROOT/outputs/qc-reports/gate1.json'))
    print(d.get('verdict', 'UNKNOWN'))
except:
    print('PARSE_ERROR')
" 2>/dev/null || echo "PARSE_ERROR")

  if [ "$verdict" = "APPROVED" ]; then
    success "QC Gate — APPROVED FOR LAUNCH"
  elif [ "$verdict" = "PARSE_ERROR" ]; then
    warn "QC Gate — could not parse verdict from gate1.json. Review manually."
    warn "File: $PROJECT_ROOT/outputs/qc-reports/gate1.json"
  else
    fail "QC Gate — BLOCKED. Review fix list:"
    python3 -c "
import json
d = json.load(open('$PROJECT_ROOT/outputs/qc-reports/gate1.json'))
for fix in d.get('fix_list', []):
    print(f'  - {fix}')
" 2>/dev/null
    die "Fix issues and re-run: ./scripts/run-pipeline.sh --stage copy then --stage qc"
  fi
}

# ── Stage: Post-launch (A6 → A7 → A8 → A9 sequential) ──────

run_post_launch() {
  info "Stage 4 — Post-Launch Agents (sequential)"

  local agents=("a6-abandonment.md:A6" "a7-thankyou.md:A7" "a8-nurture.md:A8" "a9-analytics.md:A9")
  local messages=(
    "Build exit-intent popup copy and abandonment recovery sequences (SMS + email) for BOLD Ministries. Output valid JSON."
    "Build thank-you page copy, recurring gift upsell modal, and social share prompts for BOLD Ministries. Output valid JSON."
    "Write the 5-email donor nurture drip sequence for BOLD Ministries via Klaviyo. Output valid JSON with all 5 emails."
    "Set up analytics tracking schema and generate initial conversion report template for BOLD Ministries. Output valid JSON."
  )
  local outputs=(
    "$PROJECT_ROOT/outputs/copy/abandonment-popup.json"
    "$PROJECT_ROOT/outputs/copy/thankyou-upsell.json"
    "$PROJECT_ROOT/outputs/nurture/email-sequence.json"
    "$PROJECT_ROOT/outputs/analytics/report.json"
  )

  for i in "${!agents[@]}"; do
    local file="${agents[$i]%%:*}"
    local id="${agents[$i]##*:}"
    run_agent "$id" "$file" "${messages[$i]}" "${outputs[$i]}" || die "Agent $id failed"
  done
}

# ── Stage: Ongoing background agents ─────────────────────────

run_ongoing() {
  info "Stage 5 — Ongoing Agents (QC2 + R2)"
  warn "These are Dispatch-ready. Running manually until Dispatch is GA."

  run_agent "QC2" "qc2-ongoing.md" \
    "Run daily QC monitoring checks against the live BOLD Ministries donation funnel. Check Stripe payment failures, copy drift, broken links, complaints, email deliverability, and abandonment rate. Output valid JSON." \
    "$PROJECT_ROOT/outputs/qc-reports/ongoing.json" || die "QC2 failed"

  run_agent "R2" "r2-ongoing.md" \
    "Run weekly research for BOLD Ministries. Produce updated brief with seasonal giving intel, grant opportunities, competitor pulse, and donor persona refresh. Output valid JSON." \
    "$PROJECT_ROOT/outputs/research/weekly-brief.json" || die "R2 failed"
}

# ── Main ─────────────────────────────────────────────────────

source "$PROJECT_ROOT/.env" 2>/dev/null || warn ".env not found — using existing env vars"
check_env

case "$STAGE_VAL" in
  "all")
    run_research
    run_copy_build
    run_qc
    run_post_launch
    echo ""
    success "============ FULL PIPELINE COMPLETE ============"
    ;;
  "research")   run_research ;;
  "copy")       run_copy_build ;;
  "qc")         run_qc ;;
  "post")       run_post_launch ;;
  "ongoing")    run_ongoing ;;
  *)
    echo "Usage: $0 --stage [all|research|copy|qc|post|ongoing]"
    exit 1
    ;;
esac
