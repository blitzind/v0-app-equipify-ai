# LE-4 Apollo Live Pilot Execution (Vercel Production Env)

Execute the first **real** Apollo live pilot against the LE-3 seeded test company.

**Scope:** Apollo evidence capture only — no outreach, enrollment, or Voice Drop.

**Env source:** Vercel Production only. **Do not use `.env.local`.**

---

## Prerequisites (Vercel Production)

Configure in **Vercel → Project → Settings → Environment Variables → Production** (already deployed):

| Variable | Required value |
|----------|----------------|
| `GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED` | `true` |
| `GROWTH_APOLLO_USE_MOCK` | `false` |
| `APOLLO_API_KEY` | *(secret — Vercel only)* |
| `GROWTH_APOLLO_LIVE_BENCHMARK_ACK` | `1` |
| `GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED` | `true` |
| `GROWTH_APOLLO_AI_3_OUTPUT_PATH` | `./evidence/apollo-ai-3-pilot.json` |
| `GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID` | `ad4f77c7-e91a-494a-8cb8-44fa23533087` |
| `NEXT_PUBLIC_SUPABASE_URL` | production Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | production service role |

Seeded company: **Precision Biomedical Services** (`precisionbiomedicalservices.com`).

Redeploy after changing Production env vars. Re-save any variable that shows as empty in preflight.

---

## Production env wrapper (required)

Production commands use `scripts/vercel-production-env-run.ts`:

1. Pulls Vercel Production env to a **temporary file** (never `.env.local`)
2. Temporarily hides `.env.local` / `.env.local.active` so nothing shadows Vercel secrets
3. Runs your command with injected env

You should **not** see `Loaded env from .../.env.local`.

---

## Step 1 — Preflight (no Apollo HTTP)

```bash
pnpm check:apollo-live-pilot-env-ai-4:production
pnpm select:apollo-live-pilot-test-company-ai-4:production
pnpm dry-run:apollo-live-pilot-ai-4:production
```

Or manually:

```bash
node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- pnpm check:apollo-live-pilot-env-ai-4
```

**Expected:**

- `Vercel Production env loaded from temporary pull (...)` — not `.env.local`
- `Ready for live pilot: YES`
- Seeded company selected
- Dry-run: `Ready to execute live: YES`, `will_call_apollo_api: false`

---

## Step 2 — Execute live pilot

```bash
pnpm run:le-2-apollo-live-pilot:production
```

Runs: env check → company select → dry-run → live Apollo pilot → AI-3 + AI-5 certification.

**Output:** `./evidence/apollo-ai-3-pilot.json`

---

## Step 3 — Validate evidence summary

From `apollo-ai-3-pilot.json` (bundle `evidence` object if wrapped):

| Metric | Path |
|--------|------|
| API calls | `runtime.api_calls` |
| Contacts returned | `discovery.raw_contacts_returned` |
| Contacts stored | `discovery.candidates_stored` |
| Canonical company | `canonical_matching.company` |
| Canonical persons | `canonical_matching.person` |
| Sequence-ready | `readiness_funnel.sequence_ready` |
| Errors | `runtime.errors` |

---

## Troubleshooting

### Still reports `APOLLO_API_KEY` missing

Vercel pull returns `APOLLO_API_KEY=""` when the Production value was saved empty (known CLI/dashboard issue). Re-save the variable in Vercel Production, redeploy, and re-run preflight.

### Do not use `.env.local`

Remove any local Apollo pilot block from `.env.local`. Production commands ignore it, but it can confuse operators.

---

## Immediate disable (Vercel Production)

```bash
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false
GROWTH_DISCOVERY_DISABLE_APOLLO=1
```

Remove or set `GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=false`.

---

## Related

- [LE_3_LIVE_PILOT_UNBLOCK.md](./LE_3_LIVE_PILOT_UNBLOCK.md)
- [LE_2_LIVE_EVIDENCE_EXECUTION.md](./LE_2_LIVE_EVIDENCE_EXECUTION.md)
- [APOLLO_INTEGRATION_AI_4.md](./APOLLO_INTEGRATION_AI_4.md)
