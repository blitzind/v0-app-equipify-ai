# LE-3 Live Pilot Unblock & Test Company Seeding

Unblocks LE-2 live execution by fixing:

1. Apollo env setup clarity
2. Missing `discovery_candidates` test company

No Apollo HTTP during seed. No outreach. No enrollment.

---

## Step 1 — Apollo API key (local only)

Add to `.env.local` (never commit):

```bash
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true
GROWTH_APOLLO_USE_MOCK=false
APOLLO_API_KEY=your_apollo_key_here
# or GROWTH_APOLLO_API_KEY=...

GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1
GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=true
GROWTH_APOLLO_AI_3_OUTPUT_PATH=./evidence/apollo-ai-3-pilot.json
```

Verify (no secrets printed):

```bash
pnpm check:apollo-live-pilot-env-ai-4
```

---

## Step 2 — Seed one test company

Requires explicit operator ACK:

```bash
APOLLO_TEST_COMPANY_SEED_ACK=1 \
APOLLO_TEST_COMPANY_NAME="Precision Biomedical Services" \
APOLLO_TEST_COMPANY_DOMAIN="precisionbiomedicalservices.com" \
APOLLO_TEST_COMPANY_WEBSITE="https://precisionbiomedicalservices.com" \
pnpm seed:apollo-live-pilot-test-company
```

Or add to `.env.local` and run `pnpm seed:apollo-live-pilot-test-company`.

**Expected output:**

```json
{
  "ok": true,
  "created": true,
  "company_candidate_id": "<uuid>",
  "env_hint": "GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=<uuid>"
}
```

Copy `env_hint` into `.env.local`. Re-running seed is idempotent (no duplicate).

---

## Step 3 — Select seeded candidate

```bash
APOLLO_TEST_COMPANY_PREFER_SEEDED=1 pnpm select:apollo-live-pilot-test-company-ai-4
```

---

## Step 4 — Dry-run (no Apollo API)

```bash
pnpm dry-run:apollo-live-pilot-ai-4
```

When env + company are set, `ready_to_execute_live: true` (assuming API key configured).

---

## Step 5 — Live pilot (operator)

```bash
pnpm run:le-2-apollo-live-pilot
```

Produces `./evidence/apollo-ai-3-pilot.json`.

---

## Immediate disable / rollback

```bash
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false
GROWTH_DISCOVERY_DISABLE_APOLLO=1
```

Remove `GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED` to block pilot runner.

---

## Certification

```bash
pnpm test:le-3-live-pilot-unblock
```

---

## Related

- [LE_2_LIVE_EVIDENCE_EXECUTION.md](./LE_2_LIVE_EVIDENCE_EXECUTION.md)
- [APOLLO_INTEGRATION_AI_4.md](./APOLLO_INTEGRATION_AI_4.md)
