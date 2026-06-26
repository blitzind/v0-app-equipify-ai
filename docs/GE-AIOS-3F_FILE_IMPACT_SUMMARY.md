# GE-AIOS-3F — File Impact Summary

**Phase:** GE-AIOS-3F  
**Scope:** GE-AIOS 2A–3E (Growth / AI OS only)  
**Date:** 2026-06-25

---

## Artifact counts

| Category | Count |
|----------|------:|
| `lib/growth/aios/` library files | 84 |
| Supabase migrations (`*aios*`) | 9 |
| Cert scripts (`test-ge-aios-*`) | 15 (+ 1 stack meta cert) |
| Phase docs (`GE-AIOS-*`) | 30 |
| Platform API routes (`ai-os/`) | 3 |
| Growth UI pages/components (`ai-os/`) | 2 |

---

## Primary directories (new / untracked in working tree)

```
lib/growth/aios/                          # Full AI OS service layer
supabase/migrations/202710011*.sql        # 2A–2J migrations
supabase/migrations/20271001200000_*.sql  # 3A migration
scripts/test-ge-aios-*.ts                 # Phase + stack certs
docs/GE-AIOS-*                            # Per-phase cert + audit docs
docs/MASTER_CONTEXT_DOCUMENT.md           # Living engineering state
docs/AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md
app/api/platform/growth/ai-os/            # Planning review API only
app/(growth)/growth/ai-os/                # Planning review UI
components/growth/ai-os/                  # Planning review panel
```

---

## Core boundary

| Area | Modified by GE-AIOS? |
|------|---------------------|
| `public.work_orders` (Equipify Core) | **No** |
| `public.invoices`, `public.quotes` | **No** |
| Core app routes / UI | **No** |
| `lib/ai/providers` | **Read-only** via `ai-provider-core-bridge.ts` only |

---

## Unrelated working-tree changes (exclude from GE-AIOS commit)

The following modified files are **outside** GE-AIOS scope and should not be bundled into an AI OS commit:

- `app/api/platform/growth/media-assets/*`
- `components/growth/media-library/*`, booking pages, share pages, prospect-search UX
- `lib/growth/media-library/*`
- `middleware.ts`, `public/downloads/*`, unrelated test scripts

---

## API surface introduced

| Route | Methods | Executes? |
|-------|---------|-----------|
| `/api/platform/growth/ai-os/missions/[missionId]/planning` | GET | No — read-only |
| `…/planning/preview` | POST | No — dry_run only |
| `…/planning/approve` | POST | Creates issued WOs only; no `executing`, no outbound |

No other AI OS HTTP routes exist in this batch.

---

**Not committed / not deployed** per phase policy.
