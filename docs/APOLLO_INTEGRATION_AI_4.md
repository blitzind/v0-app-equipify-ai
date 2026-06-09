# Apollo Integration AI-4 — Live Pilot Execution Prep & Evidence Capture

Phase **AI-4** prepares operators to execute the **first real Apollo live pilot**, capture hardened evidence, and reach a production go/no-go decision. No new Apollo features, providers, outreach automation, or bulk enrollment.

## Prerequisites

Complete AI-1 through AI-3 certification (`pnpm test:apollo-integration-ai-1` … `ai-3`). Configure Apollo env in **Vercel Production** (see [LE_4_APOLLO_LIVE_PILOT_EXECUTION.md](./LE_4_APOLLO_LIVE_PILOT_EXECUTION.md)).

## 1. Environment setup

Configure in **Vercel → Production** (not `.env.local`):

```bash
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true
GROWTH_APOLLO_USE_MOCK=false
# APOLLO_API_KEY — Vercel secret only
GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1
GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=true
GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=ad4f77c7-e91a-494a-8cb8-44fa23533087
GROWTH_APOLLO_AI_3_OUTPUT_PATH=./evidence/apollo-ai-3-pilot.json

# Keep disabled for first pilot:
# GROWTH_APOLLO_ENRICH_EMAILS=false
# Do NOT set GROWTH_DISCOVERY_DISABLE_APOLLO=1
```

Validate readiness (no secrets printed):

```bash
vercel env run -e production -- pnpm check:apollo-live-pilot-env-ai-4
```

## 2. Select one test company

Two operator-seeded profiles are supported. **Precision Biomedical** remains valid for mapper/filter diagnostics; **Henry Schein** is recommended for stronger Apollo employee coverage.

### Strong B2B pilot company (recommended)

Seed + select Henry Schein (one company, no outreach):

```bash
APOLLO_TEST_COMPANY_SEED_ACK=1 \
APOLLO_TEST_COMPANY_NAME="Henry Schein" \
APOLLO_TEST_COMPANY_DOMAIN="henryschein.com" \
APOLLO_TEST_COMPANY_WEBSITE="https://www.henryschein.com" \
pnpm prepare:apollo-live-pilot-test-company:production
```

Preset shorthand:

```bash
APOLLO_TEST_COMPANY_SEED_ACK=1 APOLLO_TEST_COMPANY_PROFILE=henry_schein \
pnpm prepare:apollo-live-pilot-test-company:production
```

Copy the returned `env_hint` into **Vercel Production** as `GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID`, redeploy, then execute the live pilot.

### Weak/small company (mapper diagnostics)

**If none exist**, seed Precision Biomedical first (LE-3):

```bash
APOLLO_TEST_COMPANY_SEED_ACK=1 \
APOLLO_TEST_COMPANY_NAME="Precision Biomedical Services" \
APOLLO_TEST_COMPANY_DOMAIN="precisionbiomedicalservices.com" \
APOLLO_TEST_COMPANY_WEBSITE="https://precisionbiomedicalservices.com" \
pnpm seed:apollo-live-pilot-test-company:production
```

Add the returned `GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID` to **Vercel Production**.

Auto-select a suitable seeded company by domain:

```bash
APOLLO_TEST_COMPANY_DOMAIN=henryschein.com \
APOLLO_TEST_COMPANY_PREFER_SEEDED=1 \
pnpm select:apollo-live-pilot-test-company-ai-4:production
```

Or validate a specific candidate:

```bash
APOLLO_AI_4_COMPANY_CANDIDATE_ID=<uuid> pnpm select:apollo-live-pilot-test-company-ai-4:production
```

Copy the returned `company_candidate_id` into `GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID`. **One company only** — no bulk selection.

## 3. Dry-run (no Apollo API calls)

Confirm gates, caps, and credit risk before live execution:

```bash
pnpm dry-run:apollo-live-pilot-ai-4
```

Dry-run confirms:

- Target company name and UUID
- Mock vs live mode
- Enrichment disabled (recommended)
- Max 1 company, contact/API caps
- Estimated credit risk
- Blockers before live run

## 4. Execute live pilot

When env check and dry-run show **ready**:

```bash
GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=true \
GROWTH_APOLLO_USE_MOCK=false \
GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1 \
GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=<company-uuid> \
GROWTH_APOLLO_AI_3_OUTPUT_PATH=./evidence/apollo-ai-3-pilot.json \
pnpm run:apollo-live-pilot-ai-3
```

Or set vars in `.env.local` and run:

```bash
pnpm run:apollo-live-pilot-ai-3
```

## 5. Validate evidence

```bash
APOLLO_AI_3_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json pnpm test:apollo-integration-ai-3
```

Also run AI-4 prep certification:

```bash
pnpm test:apollo-integration-ai-4
```

## Evidence file location

Default path: **`./evidence/apollo-ai-3-pilot.json`**

The AI-4 hardened bundle includes:

| Field | Content |
|-------|---------|
| `target_company` | Company name, UUID, domain |
| `runtime` | Duration, API calls, credits, errors |
| `discovery` | Raw/mapped/stored counts |
| `canonical_matching` | Match/create/dedupe/reject |
| `readiness_funnel` | Imported → sequence-ready |
| `contact_quality_summary` | Decision makers, email/phone, composite score |
| `cost_per_company` / `cost_projections` | Cost model |
| `go_no_go` | AI-3 final verdict |
| `evidence` | Full AI-2 evidence payload |
| `certification` | Full AI-3 certification |
| `operator_commands` | Copy/paste command blocks |

Optional markdown report: `./evidence/apollo-ai-3-certification.md` (or `GROWTH_APOLLO_AI_3_REPORT_PATH`).

## 6. Rollback / disable

Immediate disable (kill switch):

```bash
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false
GROWTH_DISCOVERY_DISABLE_APOLLO=1
```

Remove or unset `GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED`. Mock mode for local dev:

```bash
GROWTH_APOLLO_USE_MOCK=true
```

## Safety controls (enforced)

| Control | Status |
|---------|--------|
| Mock mode never calls Apollo HTTP | Enforced in Apollo client |
| Live pilot requires `GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1` | Enforced in runner |
| Single company per run | Enforced in pilot runner |
| Enrichment disabled unless explicit ACK | Enforced in activation |
| Bulk enrollment blocked | Always `false` in AI-3 go/no-go |
| No outreach from pilot | Discovery/sync only — no send jobs |

## Operator workflow summary

```bash
# 1. Env readiness
pnpm check:apollo-live-pilot-env-ai-4

# 2. Pick one company
pnpm select:apollo-live-pilot-test-company-ai-4
# → set GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID

# 3. Dry-run
pnpm dry-run:apollo-live-pilot-ai-4

# 4. Live pilot
pnpm run:apollo-live-pilot-ai-3

# 5. Validate
APOLLO_AI_3_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json pnpm test:apollo-integration-ai-3
pnpm test:apollo-integration-ai-4
```

## Related docs

- [APOLLO_INTEGRATION_AI_3.md](./APOLLO_INTEGRATION_AI_3.md)
- [APOLLO_INTEGRATION_AI_2_LIVE_PILOT_CHECKLIST.md](./APOLLO_INTEGRATION_AI_2_LIVE_PILOT_CHECKLIST.md)
- [APOLLO_INTEGRATION_AI_2.md](./APOLLO_INTEGRATION_AI_2.md)

## Current status

**Live pilot evidence: PENDING** — run steps 1–5 above with real Apollo credentials to unlock production approval.
