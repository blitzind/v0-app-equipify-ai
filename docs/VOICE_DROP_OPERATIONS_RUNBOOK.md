# Voice Drop Operations Runbook

Operational guide for Equipify Growth Engine Voice Drops (Twilio AMD + TwiML). No bulk autonomous sends — every sequence step requires human approval.

## When to use Voice Drops

Use Voice Drops as one step in an approved multichannel sequence when:

- The lead has a valid mobile number and is not suppressed
- A Voice Drop campaign is **approved** and linked to the sequence pattern step
- Compliance orchestration passes for the recipient phone
- The organization accepts voicemail-only outreach (human answers suppress playback)

Do **not** use Voice Drops for Apollo-imported leads until VD-4 live certification is complete and Apollo readiness sign-off is recorded.

## Prerequisites

### Environment (production / staging)

```bash
VOICE_DROP_ENABLED=true
VOICE_DROP_PROVIDER=twilio
VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED=true
VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VOICE_FROM_NUMBER=...
VOICE_MEDIA_STREAM_PUBLIC_ORIGIN=https://your-app.example   # or NEXT_PUBLIC_SITE_URL
```

Verify with:

```bash
pnpm test:voice-drop-sequence-vd-4
```

### Code safety gates (must remain true)

- `VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED = true` — no bulk autonomous outbound
- `VOICE_DROP_APPROVAL_REQUIRED = true` — campaigns require approval workflow
- Sequence execution jobs require operator approval before send

### Twilio webhooks

Twilio must reach these HTTPS endpoints on your deployed origin:

| Callback | Path |
|----------|------|
| TwiML (AMD → playback) | `POST /api/voice/webhooks/twilio/voice-drop/twiml` |
| Status (delivery evidence) | `POST /api/voice/webhooks/twilio/voice-drop/status` |

Query params include `organizationId` and `recipientId`. Do not disable signature validation in production.

## Operator workflow

### 1. Create and approve a Voice Drop campaign

1. Open **Admin → Growth → Voice Drops** (`/admin/growth/voice/voice-drops`)
2. Create campaign with reviewed message template
3. Submit for approval; wait until `approvalStatus = approved`
4. Set campaign status to `approved`, `scheduled`, or `running`

### 2. Link campaign to sequence pattern

1. Open **Sequence Builder** (`/admin/growth/sequences/builder`)
2. Select **Multichannel with Voice Drop (template)** or a custom pattern with a `voice_drop` step
3. Choose an **approved** campaign for the Voice Drop step
4. **Save & activate pattern** (`is_active = true`)

Enrollment preflight blocks patterns with unlinked Voice Drop steps.

### 3. Enroll leads (controlled rollout)

1. Enroll one lead at a time during initial rollout
2. Confirm lead has E.164 phone, org linkage, and no active conflicting enrollment
3. Monitor **Sequence Execution** console (`/admin/growth/sequences/execution`)

### 4. Approve and run execution job

1. When the Voice Drop step is due, an execution job appears with `channel = voice_drop`
2. Review lead context, campaign message, and compliance status
3. **Approve** the job (solo-approval cron may auto-run after approval depending on org settings)
4. Do not approve multiple Voice Drop jobs in parallel during certification

### 5. Verify delivery

Check in order:

1. **Voice Drop delivery evidence panel** — CallSid, AnsweredBy, status timeline
2. **Lead timeline** — `voice_drop_queued`, `voice_drop_attempted`, terminal event
3. **Sequence dashboard metrics** — Voice Drops Queued / Delivered / Failed
4. **Enrollment channel events** — `voice_drop_delivered` or `voice_drop_answered`

## Fatigue and blocking rules

Voice Drops are skipped or blocked when:

| Condition | Layer | Behavior |
|-----------|-------|----------|
| Voice drop within 7 days (same phone) | Server fatigue + channel rules | Skip step |
| SMS within 24h | Channel rules | Skip step |
| Call within 12h | Channel rules | Skip step |
| Outside call hours | Server fatigue | Block send |
| Opt-out / suppression | Server fatigue | Block send |
| Compliance failure | Server fatigue | Block send |
| `VOICE_DROP_ENABLED=false` | Provider gate | Fail attempt |
| Uncertified Twilio env | Provider gate | Fail attempt |

## Failure handling

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Job stuck in failed | Gate / compliance / invalid phone | Read `failureReason` on job and attempt row |
| No CallSid | Provider blocked or Twilio error | Check env vars and Twilio logs |
| CallSid but no terminal status | Webhook unreachable | Verify public origin and Twilio debugger |
| Human answered | Expected AMD behavior | Record as `human_answered_no_voicemail_drop` — not a system error |
| Invalid number | Bad lead phone | Fix lead data; do not retry blindly |

## Immediate rollback

1. Set `VOICE_DROP_ENABLED=false` and redeploy
2. Pause Voice Drop campaign in admin UI
3. Deactivate sequence pattern in Sequence Builder
4. Cancel pending `voice_drop` execution jobs
5. Pause test enrollments

## Monitoring checklist (daily during rollout)

- [ ] Sequence dashboard Voice Drop metrics vs. Twilio console volume
- [ ] Failed attempts with `failureReason` spikes
- [ ] Webhook 4xx/5xx rates on voice-drop routes
- [ ] Compliance block rate by organization
- [ ] Operator approval queue depth

## Certification commands

```bash
pnpm test:voice-drop-twilio-vd-1a
pnpm test:voice-drop-twilio-vd-1b
pnpm test:voice-drop-sequence-vd-2
pnpm test:voice-drop-sequence-vd-3
pnpm test:voice-drop-sequence-vd-4
```

Live checklist: [VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md](./VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md)

Apollo rollout: [VOICE_DROP_APOLLO_READINESS_ASSESSMENT.md](./VOICE_DROP_APOLLO_READINESS_ASSESSMENT.md)
