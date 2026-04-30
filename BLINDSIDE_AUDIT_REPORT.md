# Blindside Audit Report (Team of 3)

Date: 2026-04-07
Project: signaliq-grid-system

## Team 1: App Integrity Audit
Verdict: PASS

Evidence:
- Local root responds 200 on `http://localhost:3000/`.
- Local API responds on `http://localhost:3000/api/health` with `ok: true` and `resend: true`.
- Frontend build passes (`vite build`).
- Frontend lint passes (`eslint`).
- Database is readable with existing rows for users, contacts, campaigns.

## Team 2: Edge/Preview Audit
Verdict: FAIL (External)

Evidence:
- Public preview root returns `HTTP/2 500` with body `error code: 1101`.
- Public preview API route (`/api/health`) returns same `1101`.
- Alternate port URL (`3001-...bud.computer`) returns same `1101`.
- This behavior is uniform for every path, indicating failure before app route handling.

Assessment:
- The failure is in the preview edge worker/tunnel, not in application runtime.

## Team 3: Startup/Process Audit
Verdict: PASS

Evidence:
- Single Node process listening on `0.0.0.0:3000`.
- Server log confirms startup: `SignalIQ API running on http://0.0.0.0:3000`.
- Startup commands in `.orchids/orchids.json` are valid and deterministic:
  - Build frontend first.
  - Start backend server second.

## Root Cause
Preview tunnel/worker path is broken for this session URL. Local service is healthy and reachable; external edge path fails with Cloudflare `1101` regardless of endpoint.

## Required Fixes (Operational)
1. Regenerate or restart the Bud preview session for this workspace.
2. Re-issue a fresh preview URL for port `3000`.
3. Re-validate root and `/api/health` on the new URL.

## Local Validation Commands
- `curl -sI http://localhost:3000 | head`
- `curl -s http://localhost:3000/api/health`
- `curl -skI https://<new-preview-url>/ | head`
- `curl -sk https://<new-preview-url>/api/health`
