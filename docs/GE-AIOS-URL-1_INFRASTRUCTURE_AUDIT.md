# GE-AIOS-URL-1 — Public Route Namespace Infrastructure Audit

**Phase:** GE-AIOS-URL-1 — Rename AI OS public routes to `/growth/os`  
**Product name:** Equipify AI OS (unchanged)  
**Date:** 2026-06-25

---

## Scope

URL cleanup only. Public UI routes move from `/growth/ai-os/*` to `/growth/os/*`.

**Unchanged (by design):**

- API namespace: `/api/platform/growth/ai-os/*`
- Folders: `components/growth/ai-os/`, `lib/growth/aios/`
- Services, types, events, migrations, internal identifiers

---

## File impact

| Path | Role |
|------|------|
| `lib/growth/aios/ai-os-public-routes.ts` | Canonical + legacy base paths; href builders; legacy→canonical mapper |
| `lib/growth/aios/ai-os-mission-route-params.ts` | Re-exports href builders from public-routes |
| `app/(growth)/growth/os/**` | Canonical UI pages (planning review, lead-research pilot) |
| `app/(growth)/growth/ai-os/**` | Permanent redirect pages (index, catch-all, mission, pilot) |
| `next.config.mjs` | Permanent redirects `/growth/ai-os` → `/growth/os` |
| `components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx` | Uses `buildAiOsMissionPlanningHref` (canonical `/growth/os/...`) |

---

## Route map

| Legacy (redirect) | Canonical |
|-------------------|-----------|
| `/growth/ai-os` | `/growth/os` |
| `/growth/ai-os/missions/[missionId]/planning` | `/growth/os/missions/[missionId]/planning` |
| `/growth/ai-os/pilot/lead-research/[leadId]` | `/growth/os/pilot/lead-research/[leadId]` |
| `/growth/ai-os/*` (catch-all) | `/growth/os/*` |

Redirects are implemented in **both** `next.config.mjs` and App Router pages (`RedirectType.permanent`).

---

## Audit findings

| Check | Result |
|-------|--------|
| No component emits hard-coded `/growth/ai-os/` public hrefs | PASS |
| API consumers still use `/api/platform/growth/ai-os/` | PASS (intentional) |
| Erroneous root `app(growth)/` folder removed | PASS |
| Canonical pages live under `app/(growth)/growth/os/` | PASS |
| Equipify Core untouched | PASS |

---

## Certification

```bash
pnpm test:ge-aios-url-1-public-route-namespace-foundation
```
