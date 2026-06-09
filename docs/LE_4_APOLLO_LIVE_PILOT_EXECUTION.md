# LE-4 Apollo Live Pilot Execution (Vercel Production Runtime)

Execute the first **real** Apollo live pilot against the LE-3 seeded test company **inside Vercel Production**, where `process.env` has real Production secrets.

**Scope:** Apollo evidence capture only — no outreach, enrollment, or Voice Drop.

**Do not use `.env.local`.** Do not rely on `vercel env pull` for secrets — pulled sensitive values appear as `KEY=""` but are **not** empty in Production runtime.

---

## Prerequisites (Vercel Production)

Configure in **Vercel → Project → Settings → Environment Variables → Production** (already deployed):

| Variable | Required value |
|----------|----------------|
| `GROWTH_ENGINE_ENABLED` | `true` |
| `GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED` | `true` |
| `GROWTH_APOLLO_USE_MOCK` | `false` |
| `APOLLO_API_KEY` | *(secret — Vercel Production runtime only)* |
| `GROWTH_APOLLO_LIVE_BENCHMARK_ACK` | `1` |
| `GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED` | `true` |
| `GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID` | `ad4f77c7-e91a-494a-8cb8-44fa23533087` |
| `NEXT_PUBLIC_SUPABASE_URL` | production Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | production service role |

Seeded company: **Precision Biomedical Services** (`precisionbiomedicalservices.com`).

Redeploy after changing Production env vars.

---

## Step 1 — Readiness (Production runtime, no Apollo HTTP)

As a **platform admin** on the deployed Production app:

```http
GET /api/platform/growth/apollo-live-pilot/readiness
```

**Expected:**

- `readiness.ready_for_live_pilot: true`
- `readiness.api_key.configured: true` (source only — no key value returned)
- `safety.outreach_triggered_by_pilot: false`
- `runtime.vercel_env: "production"`

Certification (local, no live Apollo):

```bash
pnpm test:apollo-live-pilot-production-route
```

---

## Step 2 — Execute live pilot (Production runtime)

As a **platform admin** on Production:

```http
POST /api/platform/growth/apollo-live-pilot/execute
Content-Type: application/json

{ "confirm": "RUN_APOLLO_LIVE_PILOT" }
```

**Behavior:**

- Processes exactly **one** company (`GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID`)
- Reuses LE-2 / AI-4 live pilot runner (discovery → sync → canonical backfill only)
- Does **not** trigger outreach or enrollment
- Returns non-secret `evidence_bundle` JSON (save locally)

**Save response:**

```bash
# Example: copy evidence_bundle from POST response to local file
# ./evidence/apollo-ai-3-pilot.json
```

---

## Step 3 — Validate evidence locally

```bash
APOLLO_AI_3_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json pnpm test:apollo-integration-ai-3
APOLLO_AI_3_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json pnpm test:apollo-integration-ai-5
```

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

### Readiness shows `api_key.configured: false` on Production

Verify `APOLLO_API_KEY` (or `GROWTH_APOLLO_API_KEY`) is set for **Production** in Vercel and redeploy. Do **not** infer missing keys from local `vercel env pull` output.

### Execute returns 403 `gates_failed`

Check `blockers` in the response against the prerequisites table (mock off, ACK=1, AI-3 pilot enabled, candidate id set, kill switch off).

### Do not use `.env.local`

Local env files are not used by Production routes. Remove any local Apollo pilot blocks to avoid operator confusion.

---

## Immediate disable (Vercel Production)

```
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false
GROWTH_DISCOVERY_DISABLE_APOLLO=1
GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=false
```

---

## Related

- [LE_3_LIVE_PILOT_UNBLOCK.md](./LE_3_LIVE_PILOT_UNBLOCK.md)
- [LE_2_LIVE_EVIDENCE_EXECUTION.md](./LE_2_LIVE_EVIDENCE_EXECUTION.md)
- [APOLLO_INTEGRATION_AI_4.md](./APOLLO_INTEGRATION_AI_4.md)
