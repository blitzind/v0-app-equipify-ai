# LE-2 Live Evidence Execution & Revenue Validation

**Stop building. Start executing.** This phase captures the real evidence chain identified in the GE-1 audit.

No new product features — only operator execution of existing workflows and evidence JSON capture.

---

## Prerequisites

Configure `.env.local`:

```bash
# Apollo (required for steps 1–2)
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true
GROWTH_APOLLO_USE_MOCK=false
APOLLO_API_KEY=...
GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1
GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=true
GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=   # from company selector
GROWTH_APOLLO_AI_3_OUTPUT_PATH=./evidence/apollo-ai-3-pilot.json

# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Email (step 4 — connected mailbox, no simulate)
# GROWTH_TRANSPORT_SIMULATE must NOT be true

# Voice Drop (step 5)
VOICE_DROP_ENABLED=true
VOICE_DROP_PROVIDER=twilio
VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED=true
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VOICE_FROM_NUMBER=+1...
VOICE_MEDIA_STREAM_PUBLIC_ORIGIN=https://your-deployed-app.example
VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true
APOLLO_VD4_LIVE_CERTIFIED=true   # after VD-4 live call
```

Ensure at least one suitable `growth.discovery_candidates` row exists (domain, not suppressed).

---

## Step 1–2 — Apollo live pilot + certification

```bash
pnpm run:le-2-apollo-live-pilot
```

Or manually:

```bash
pnpm check:apollo-live-pilot-env-ai-4
pnpm select:apollo-live-pilot-test-company-ai-4
pnpm dry-run:apollo-live-pilot-ai-4
pnpm run:apollo-live-pilot-ai-3

APOLLO_AI_3_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json pnpm test:apollo-integration-ai-3
APOLLO_AI_5_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json pnpm test:apollo-integration-ai-5
```

**Output:** `./evidence/apollo-ai-3-pilot.json`

---

## Step 3 — Manual sequence enrollment

1. Open sequence-ready contact from pilot evidence (`readiness_funnel.sequence_ready >= 1`)
2. Verify canonical person/company, score, compliance in Prospect Search / Lead Engine
3. Enroll **one** contact via Sequence Builder (approved pattern, operator approval)
4. Save evidence → `./evidence/le-1-manual-enrollment.json`

Template: `evidence/templates/le-1-manual-enrollment.template.json`

---

## Step 4a — Non-voice pre-send validation (no send yet)

Capture job creation + approval workflow without executing send:

→ `./evidence/le-1-non-voice-channels.json` (`send_executed: false`)

Template: `evidence/templates/le-1-non-voice-channels.template.json`

---

## Step 4b — One approved email send

1. Approve execution job in `/admin/growth/sequences/execution`
2. Verify timeline + engagement events
3. Capture delivery evidence (transport message ID)

→ `./evidence/le-2-email-execution.json` (`send_executed: true`)

Template: `evidence/templates/le-2-email-execution.template.json`

---

## Step 5 — Voice Drop live certification

Follow [VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md](./VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md).

One approved Voice Drop to test-safe number. Capture:

→ `./evidence/vd-4-live-evidence.json`

Template: `evidence/templates/vd-4-live-evidence.template.json`

Re-run: `VOICE_DROP_VD_4_EVIDENCE_JSON=./evidence/vd-4-live-evidence.json pnpm test:voice-drop-sequence-vd-4`

---

## Step 6–7 — LE-1 + LE-2 final validation

```bash
LE_1_MANUAL_ENROLLMENT_EVIDENCE_JSON=./evidence/le-1-manual-enrollment.json \
LE_1_NON_VOICE_CHANNEL_EVIDENCE_JSON=./evidence/le-1-non-voice-channels.json \
LE_2_EMAIL_EXECUTION_EVIDENCE_JSON=./evidence/le-2-email-execution.json \
LE_2_VOICE_DROP_EVIDENCE_JSON=./evidence/vd-4-live-evidence.json \
APOLLO_AI_5_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json \
APOLLO_VD4_LIVE_CERTIFIED=true \
VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true \
pnpm test:le-1-apollo-voice-drop-production

pnpm validate:le-2-live-evidence
```

**Outputs:**

- `docs/LE_2_LIVE_EVIDENCE_VALIDATION_REPORT.md`
- `evidence/le-2-validation-report.json`

---

## Final verdict meanings

| Verdict | Meaning |
|---------|---------|
| `approved` | Full live chain: Apollo + enrollment + email + Voice Drop |
| `conditionally_approved` | Apollo + enrollment + email live; Voice Drop pending |
| `rejected` | Missing/invalid/mock evidence |

---

## Current execution status

Run `pnpm validate:le-2-live-evidence` to see live blockers for this environment.
