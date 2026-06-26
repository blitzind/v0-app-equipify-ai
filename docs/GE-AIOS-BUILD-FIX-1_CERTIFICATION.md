# GE-AIOS-BUILD-FIX-1 — Vercel Build Import Chain Fix

**Date:** 2026-06-25  
**Verdict:** **PASS**

---

## Root cause

`ai-decision-execution-bridge-service.ts` imported `fetchAiDecisionEngineRuntime` from `ai-decision-engine-service.ts`, but that symbol is **not exported** from the service module (only used internally; public surface is `getAiDecisionEngineRuntimeState`).

Turbopack failed static analysis on any route that transitively loaded the bridge (e.g. planning preview → mission planning → work order service → dynamic bridge import; pilot → work order service; QA/cron bundles that shared the broken module graph).

---

## Fix

Import `fetchAiDecisionEngineRuntime` from `ai-decision-engine-repository.ts` (its canonical home). Keep `runAiDecisionEngineForWorkOrder` from `ai-decision-engine-service.ts`.

**File changed:** `lib/growth/aios/ai-decision-execution-bridge-service.ts` (import split only)

---

## Behavior unchanged

- Same repository function, same runtime row read, same degraded-mode gate logic
- No logic, schema, or API contract changes
- Pure helpers remain in `ai-decision-execution-bridge-types.ts` (unchanged)
- `ai-work-order-service.ts` still dynamic-imports the bridge only on `executing` transitions

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm run build` (with Supabase env) | **PASS** |
| `pnpm test:ge-aios-3f-stack-certification-foundation` | **PASS** (15/15 phase certs) |
| Equipify Core touched | **No** |

---

**Not committed / not deployed** unless explicitly requested.
