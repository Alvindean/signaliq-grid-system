# Preview 500 Debug Report

## Summary
The application is healthy locally, but all Bud public preview URLs for this workspace currently fail with Cloudflare `1101` before requests reach the local server.

## Three-Agent Findings

### Agent 1 — App Health
- `http://127.0.0.1:3000/` returns `200`
- `http://127.0.0.1:3000/api/health` returns `200`
- Express logs show local requests only and no public preview requests

### Agent 2 — Preview Metadata
- `.bud/bud.json` and `.orchids/orchids.json` were normalized
- Server binds to `0.0.0.0:3000`
- Client can also run on `0.0.0.0:5173`

### Agent 3 — Tunnel Control Test
- A plain Python static server on `:8081` returns `200` locally
- The corresponding Bud preview URL on `8081` still returns `500`
- This isolates the failure to the Bud/Cloudflare preview worker for this workspace, not the app

## Conclusion
Repo-side code is not the remaining blocker. The public preview layer is failing upstream.
