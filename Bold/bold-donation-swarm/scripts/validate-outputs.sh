#!/bin/bash
# ============================================================
# BOLD Ministries — Output Validation Script
# Validates that agent outputs are well-formed JSON
# Usage: ./scripts/validate-outputs.sh [--stage research|copy|qc|post|all]
# ============================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

STAGE="${2:-all}"
ERRORS=0

validate_json() {
  local file="$1"
  local label="$2"

  if [ ! -f "$file" ]; then
    echo -e "${YELLOW}SKIP${NC} $label — file not found: $file"
    return 0
  fi

  if python3 -c "import json; json.load(open('$file'))" 2>/dev/null; then
    echo -e "${GREEN}PASS${NC} $label — valid JSON"
    return 0
  else
    echo -e "${RED}FAIL${NC} $label — invalid JSON: $file"
    ERRORS=$((ERRORS + 1))
    return 1
  fi
}

validate_html() {
  local file="$1"
  local label="$2"

  if [ ! -f "$file" ]; then
    echo -e "${YELLOW}SKIP${NC} $label — file not found: $file"
    return 0
  fi

  # Check for basic HTML structure
  if grep -q "<html" "$file" && grep -q "</html>" "$file"; then
    echo -e "${GREEN}PASS${NC} $label — valid HTML structure"
  else
    echo -e "${RED}FAIL${NC} $label — missing <html> tags: $file"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  # Check for 501c3 language (required on donation pages)
  if echo "$file" | grep -q "donation"; then
    if grep -qi "501(c)(3)\|501c3\|tax-deductible" "$file"; then
      echo -e "${GREEN}PASS${NC} $label — 501c3 language present"
    else
      echo -e "${RED}FAIL${NC} $label — MISSING 501c3 language (required)"
      ERRORS=$((ERRORS + 1))
    fi
  fi

  # Check Stripe key safety — secret key must never appear in HTML
  if grep -q "sk_live\|sk_test" "$file"; then
    echo -e "${RED}FAIL${NC} $label — STRIPE SECRET KEY FOUND IN HTML (critical security issue)"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}PASS${NC} $label — no Stripe secret key in HTML"
  fi

  return 0
}

echo ""
echo "============================================================"
echo "  BOLD Ministries — Output Validation"
echo "  Stage: $STAGE"
echo "============================================================"
echo ""

# Research stage
if [ "$STAGE" = "research" ] || [ "$STAGE" = "all" ]; then
  echo "── Research Outputs ──"
  validate_json "$PROJECT_ROOT/outputs/research/brief.json" "A1 Research Brief"
  validate_json "$PROJECT_ROOT/outputs/research/segments.json" "A2 Traffic Segments"
  echo ""
fi

# Copy stage
if [ "$STAGE" = "copy" ] || [ "$STAGE" = "all" ]; then
  echo "── Copy + Build Outputs ──"
  validate_json "$PROJECT_ROOT/outputs/copy/donation-page.json" "A3 Donation Copy"
  validate_html "$PROJECT_ROOT/outputs/pages/donation.html" "A4 Donation Page"
  validate_html "$PROJECT_ROOT/outputs/pages/thankyou.html" "A4 Thank You Page"
  echo ""
fi

# QC stage
if [ "$STAGE" = "qc" ] || [ "$STAGE" = "all" ]; then
  echo "── QC Outputs ──"
  validate_json "$PROJECT_ROOT/outputs/qc-reports/gate1.json" "A5 QC Gate Report"
  echo ""
fi

# Post-launch stage
if [ "$STAGE" = "post" ] || [ "$STAGE" = "all" ]; then
  echo "── Post-Launch Outputs ──"
  validate_json "$PROJECT_ROOT/outputs/copy/abandonment-popup.json" "A6 Abandonment Popup"
  validate_json "$PROJECT_ROOT/outputs/copy/thankyou-upsell.json" "A7 Thank You Upsell"
  validate_json "$PROJECT_ROOT/outputs/nurture/email-sequence.json" "A8 Nurture Sequence"
  validate_json "$PROJECT_ROOT/outputs/analytics/report.json" "A9 Analytics Report"
  echo ""
fi

# Summary
echo "============================================================"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}All validations passed.${NC}"
  exit 0
else
  echo -e "${RED}$ERRORS validation(s) failed.${NC}"
  exit 1
fi
