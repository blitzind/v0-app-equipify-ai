# GE-AIOS-URL-1 — Public Route Namespace Certification

**Phase:** GE-AIOS-URL-1 — Rename AI OS public routes to `/growth/os`  
**Verdict:** **PASS (local)**  
**Date:** 2026-06-25

---

## Certification command

```bash
pnpm test:ge-aios-url-1-public-route-namespace-foundation
```

---

## Verified

| Requirement | Result |
|-------------|--------|
| Canonical public base path `/growth/os` | PASS |
| Legacy base path `/growth/ai-os` maps to canonical | PASS |
| `buildAiOsMissionPlanningHref` emits `/growth/os/missions/.../planning` | PASS |
| `buildAiOsPilotLeadResearchHref` emits `/growth/os/pilot/lead-research/...` | PASS |
| Canonical pages under `app/(growth)/growth/os/` | PASS |
| Legacy App Router redirects (permanent) | PASS |
| `next.config.mjs` permanent redirects | PASS |
| No legacy public hrefs in link sources | PASS |
| API paths unchanged (`/api/platform/growth/ai-os/`) | PASS |
| Equipify Core untouched | PASS |

---

## Regression (AI OS stack)

```bash
pnpm test:ge-aios-url-1-public-route-namespace-foundation
pnpm test:ge-aios-runtime-1-mission-planning-route-guard-foundation
pnpm test:ge-aios-3e-executive-mission-planning-review-foundation
pnpm test:ge-aios-5a-executive-planning-report-foundation
pnpm test:ge-aios-4a-lead-research-pilot-foundation
pnpm test:ge-aios-3f-stack-certification-foundation
```

---

## Deploy notes

- No migrations required.
- No feature flags.
- Bookmarks to `/growth/ai-os/*` continue working via permanent redirects.
