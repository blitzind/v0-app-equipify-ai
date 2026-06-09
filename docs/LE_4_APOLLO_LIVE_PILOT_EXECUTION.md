# LE-4 Apollo Live Pilot Execution (Vercel Production Env)

Execute the first **real** Apollo live pilot against the LE-3 seeded test company.

**Scope:** Apollo evidence capture only — no outreach, enrollment, or Voice Drop.

**Env source:** Vercel Production only. Do **not** use `.env.local` for this workflow.

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

Redeploy after changing Production env vars.

---

## Step 1 — Preflight (no Apollo HTTP)

From repo root, with Vercel CLI linked to the project:

```bash
vercel env run -e production -- pnpm check:apollo-live-pilot-env-ai-4
vercel env run -e production -- env APOLLO_TEST_COMPANY_PREFER_SEEDED=1 pnpm select:apollo-live-pilot-test-company-ai-4
vercel env run -e production -- pnpm dry-run:apollo-live-pilot-ai-4
```

**Expected:**

- `Ready for live pilot: YES`
- Seeded company selected (`ad4f77c7-e91a-494a-8cb8-44fa23533087`)
- `Ready to execute live: YES`
- `will_call_apollo_api: false` during dry-run

Optional pulled files (fallback only, not `.env.local`):

- `.env.production.local`
- `.env.vercel.production` (`vercel env pull production`)

---

## Step 2 — Execute live pilot

**Primary command:**

```bash
vercel env run -e production -- pnpm run:le-2-apollo-live-pilot
```

This runs: env check → company select → dry-run → live Apollo pilot → AI-3 + AI-5 certification.

**Output:** `./evidence/apollo-ai-3-pilot.json` (and `apollo-ai-3-certification.md`).

Manual steps (same env injection):

```bash
vercel env run -e production -- pnpm run:apollo-live-pilot-ai-3

vercel env run -e production -- env \
  APOLLO_AI_3_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json \
  pnpm test:apollo-integration-ai-3

vercel env run -e production -- env \
  APOLLO_AI_5_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json \
  pnpm test:apollo-integration-ai-5
```

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

AI-3 / AI-5 tests print go/no-go verdicts when the evidence file exists.

---

## Immediate disable (Vercel Production)

Set in Vercel Production and redeploy:

```bash
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false
GROWTH_DISCOVERY_DISABLE_APOLLO=1
```

Remove or set `GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=false`.

---

## Troubleshooting

### `APOLLO_API_KEY` missing under `vercel env run`

Non-secret vars load correctly; sensitive vars must be injected by `vercel env run` (not `vercel env pull` — pulled files use `""` placeholders).

If preflight still reports API key missing:

1. Confirm `APOLLO_API_KEY` exists in Vercel → Production (re-save if value was pasted empty).
2. Redeploy after changes.
3. Re-run: `vercel env run -e production -- pnpm check:apollo-live-pilot-env-ai-4`

Pilot scripts **do not read `.env.local`**. Optional fallback files: `.env.production.local`, `.env.vercel.production` (non-secret keys only).

---

## Related

- [LE_3_LIVE_PILOT_UNBLOCK.md](./LE_3_LIVE_PILOT_UNBLOCK.md) — seed test company
- [LE_2_LIVE_EVIDENCE_EXECUTION.md](./LE_2_LIVE_EVIDENCE_EXECUTION.md) — full evidence chain
- [APOLLO_INTEGRATION_AI_4.md](./APOLLO_INTEGRATION_AI_4.md) — env + dry-run reference
