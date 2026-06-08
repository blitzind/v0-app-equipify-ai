# Voice Drop Sequence — VD-3 Live Certification Checklist

Use this checklist for **one controlled live sequence certification**. Do not run live Twilio calls in CI.

## Preconditions

### Required environment variables

```bash
VOICE_DROP_ENABLED=true
VOICE_DROP_PROVIDER=twilio
VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED=true
VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VOICE_FROM_NUMBER=...
```

Confirm:

- `VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED` remains `true` in code (no bulk autonomous sends).
- Sequence execution still requires human approval on the execution job.

### Required campaign state

- [ ] Voice Drop campaign exists in admin UI (`/admin/growth/voice/voice-drops`)
- [ ] Campaign `approvalStatus = approved`
- [ ] Campaign `status` is `approved`, `scheduled`, or `running`
- [ ] Message template reviewed and compliant

### Required sequence pattern state

- [ ] Open Sequence Builder (`/admin/growth/sequences/builder`)
- [ ] Select **Multichannel with Voice Drop (template)** pattern
- [ ] Link approved campaign to Voice Drop step (step 2)
- [ ] Click **Save & activate pattern**
- [ ] Pattern `is_active = true`

### Required test lead

- [ ] Lead has valid E.164 mobile number (your test handset)
- [ ] Lead has `promoted_organization_id` set
- [ ] Lead is not suppressed, disqualified, or archived
- [ ] Lead has no conflicting active enrollment

## Execution steps

1. [ ] Enroll test lead in `multichannel_with_voice_drop` pattern
2. [ ] Confirm enrollment step 2 channel is `voice_drop` with `voice_drop_campaign_id` populated
3. [ ] Advance sequence until Voice Drop step is due (or use QA force-due if available)
4. [ ] Confirm execution job created with `channel = voice_drop`
5. [ ] Approve execution job in Sequence Execution console (`/admin/growth/sequences/execution`)
6. [ ] Run approved job (or wait for solo-approval cron if enabled)

## Expected provider behavior

- [ ] Twilio outbound call created (check delivery evidence panel)
- [ ] AMD runs (`DetectMessageEnd`)
- [ ] TwiML plays message on machine/voicemail
- [ ] Human answer suppresses playback (hangup)
- [ ] Status callback received and persisted

## Expected database rows

| Table | Expected |
|-------|----------|
| `growth.sequence_execution_jobs` | Job `status = sent`, voice drop linkage columns populated |
| `voice.voice_drop_recipients` | Recipient row for test phone with sequence metadata |
| `voice.voice_drop_delivery_attempts` | Attempt with provider delivery id |
| `growth.lead_timeline_events` | `voice_drop_queued`, `voice_drop_attempted`, terminal event |
| `growth.sequence_enrollment_channel_events` | `voice_drop_delivered` or engagement signal on success |
| `growth.multi_channel_activity_timeline_events` | Delivered/answered signal when finalized |

## Expected UI evidence

- [ ] Sequence Execution dashboard shows Voice Drop metrics increment
- [ ] Lead timeline shows voice drop events with campaign/attempt linkage
- [ ] Voice Drop delivery evidence panel shows attempt timeline for campaign

## Immediate disable / rollback

1. Set `VOICE_DROP_ENABLED=false` and redeploy/restart workers
2. Pause sequence enrollment for test lead
3. Set pattern `is_active=false` in Sequence Builder (or SQL update)
4. Cancel pending voice_drop execution jobs from execution console
5. Pause Voice Drop campaign in admin UI

## Post-certification

- [ ] Document call SID, attempt id, and timeline event ids
- [ ] Remove test lead from active enrollment if no further testing needed
- [ ] Leave `VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED=true` only in certified environments
