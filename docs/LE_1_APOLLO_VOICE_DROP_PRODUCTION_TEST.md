# LE-1 Apollo + Voice Drop Final Production Test

Live Execution Phase **LE-1** validates the real-world production workflow connecting Apollo acquisition with the certified outbound execution stack.

**No new features.** Assessment and evidence capture only — no bulk enrollment, no automated outreach at scale.

## Workflow overview

```
Apollo live pilot (AI-4)
  → AI-3 / AI-5 certification
  → sequence-ready contact validation
  → manual enrollment (one contact)
  → non-voice channel validation (email/SMS)
  → controlled Voice Drop live test (optional)
  → LE-1 final production readiness verdict
```

---

## Step 1 — Apollo live pilot

Configure `.env.local` per [APOLLO_INTEGRATION_AI_4.md](./APOLLO_INTEGRATION_AI_4.md), then:

```bash
pnpm check:apollo-live-pilot-env-ai-4
pnpm select:apollo-live-pilot-test-company-ai-4
# → set GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID in .env.local

pnpm dry-run:apollo-live-pilot-ai-4
pnpm run:apollo-live-pilot-ai-3

APOLLO_AI_3_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json pnpm test:apollo-integration-ai-3
APOLLO_AI_5_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json pnpm test:apollo-integration-ai-5
```

Capture from evidence:

- contacts returned / mapped
- sequence-ready count
- channel readiness (email, SMS, Voice Drop, calling)
- AI-3 and AI-5 verdicts

---

## Step 2 — Validate sequence-ready contact path

From `./evidence/apollo-ai-3-pilot.json`, confirm one contact satisfies:

| Check | Requirement |
|-------|-------------|
| Canonical person | matched/created/deduped |
| Canonical company | matched/created |
| Research | automated flow confirmed |
| Scoring | fit score present |
| Contactability | email or phone |
| Sequence ready | `readiness_funnel.sequence_ready >= 1` |

LE-1 harness validates this automatically from evidence.

---

## Step 3 — Manual sequence enrollment

Enroll **one** sequence-ready contact via Sequence Builder / enrollment UI.

Requirements:

- Approved sequence pattern
- Operator approval required
- `bulk_enrollment: false`
- One contact only

Capture evidence JSON:

```bash
# ./evidence/le-1-manual-enrollment.json
```

```json
{
  "qa_marker": "le-1-manual-enrollment-v1",
  "enrolled_at": "2026-06-09T12:00:00.000Z",
  "lead_id": "<lead-uuid>",
  "enrollment_id": "<enrollment-uuid>",
  "pattern_id": "<pattern-uuid>",
  "company_candidate_id": "<company-candidate-uuid>",
  "canonical_person_id": "<person-uuid>",
  "operator_approved": true,
  "bulk_enrollment": false,
  "contacts_enrolled": 1
}
```

---

## Step 4 — Non-voice channels (safer first)

Validate email/SMS path **without sending** unless explicitly approved:

- Email execution job created (queued, not sent)
- SMS eligibility evaluated
- Approval workflow verified
- Timeline event emitted

```json
{
  "qa_marker": "le-1-non-voice-channel-v1",
  "validated_at": "2026-06-09T12:30:00.000Z",
  "lead_id": "<lead-uuid>",
  "enrollment_id": "<enrollment-uuid>",
  "email_job_created": true,
  "email_execution_job_id": "<job-uuid>",
  "sms_eligibility_evaluated": true,
  "sms_eligible": true,
  "approval_workflow_verified": true,
  "timeline_event_emitted": true,
  "timeline_event_ids": ["..."],
  "send_executed": false
}
```

**`send_executed` must be `false`** unless operator explicitly approved a live send.

---

## Step 5 — Controlled Voice Drop live test

Only after Steps 1–4 validate. Use internal/test-safe number per [VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md](./VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md).

Validate chain:

```
voice_drop step → approved job → Twilio call → AMD → TwiML playback
→ status callback → delivery evidence → timeline → engagement signal
```

```json
{
  "qa_marker": "le-1-voice-drop-live-v1",
  "validated_at": "2026-06-09T13:00:00.000Z",
  "callSid": "CA...",
  "recipientId": "...",
  "deliveryAttemptId": "...",
  "enrollmentId": "...",
  "campaignId": "...",
  "leadId": "...",
  "timelineEventIds": ["..."],
  "channelEventIds": ["..."],
  "amd_detected": true,
  "twiml_playback_confirmed": true,
  "status_callback_received": true,
  "delivery_status": "delivered"
}
```

Also re-run: `VOICE_DROP_VD_4_EVIDENCE_JSON=... pnpm test:voice-drop-sequence-vd-4`

Set `APOLLO_VD4_LIVE_CERTIFIED=true` after VD-4 sign-off.

---

## Step 6 — LE-1 certification

```bash
APOLLO_AI_5_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json \
LE_1_MANUAL_ENROLLMENT_EVIDENCE_JSON=./evidence/le-1-manual-enrollment.json \
LE_1_NON_VOICE_CHANNEL_EVIDENCE_JSON=./evidence/le-1-non-voice-channels.json \
LE_1_VOICE_DROP_EVIDENCE_JSON=./evidence/le-1-voice-drop-live.json \
APOLLO_VD4_LIVE_CERTIFIED=true \
VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true \
pnpm test:le-1-apollo-voice-drop-production
```

Generates:

- `docs/LE_1_CERTIFICATION_REPORT.md`
- `docs/LE_1_PRODUCTION_READINESS_REPORT.md` (when Apollo evidence loaded)

---

## Step 7 — Rollback / kill switch validation

Verified automatically by LE-1 harness (simulated env, no mutations):

| Kill switch | Effect |
|-------------|--------|
| `GROWTH_DISCOVERY_DISABLE_APOLLO=1` | Apollo discovery skipped |
| `GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false` | Apollo master off |
| `VOICE_DROP_ENABLED=false` | Voice Drop infrastructure disabled |

Sequence execution remains blocked without human job approval.

---

## Final verdict meanings

| Verdict | Meaning |
|---------|---------|
| `approved` | Live Apollo + enrollment + non-voice + Voice Drop evidence complete |
| `conditionally_approved` | Apollo + enrollment validated; complete Voice Drop / channel evidence for full sign-off |
| `rejected` | Mock/malformed evidence or thresholds not met |

---

## Related docs

- [APOLLO_INTEGRATION_AI_4.md](./APOLLO_INTEGRATION_AI_4.md)
- [APOLLO_INTEGRATION_AI_5.md](./APOLLO_INTEGRATION_AI_5.md)
- [VOICE_DROP_OPERATIONS_RUNBOOK.md](./VOICE_DROP_OPERATIONS_RUNBOOK.md)
- [VOICE_DROP_APOLLO_READINESS_ASSESSMENT.md](./VOICE_DROP_APOLLO_READINESS_ASSESSMENT.md)

## Current status

**LE-1 live execution: PENDING** — complete Steps 1–6 with real Apollo credentials and controlled Voice Drop test.
