# Voice / AI Communications — Deployment Checklist

Operational checklists for rolling out Equipify voice infrastructure safely.

**Canonical env reference:** [VOICE_ENVIRONMENT_REQUIREMENTS.md](./VOICE_ENVIRONMENT_REQUIREMENTS.md)

---

## Local development checklist

### Prerequisites

- [ ] `.env.local` copied from `.env.local.example`
- [ ] Supabase local or linked project with voice migrations applied
- [ ] `GROWTH_ENGINE_ENABLED=true` (optional until testing voice routes)
- [ ] `GROWTH_ENGINE_AI_ORG_ID` set to valid org UUID
- [ ] `EQUIPIFY_PLATFORM_ADMIN_EMAILS` includes your dev email

### Twilio local testing

- [ ] `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` from Twilio trial account
- [ ] ngrok (or similar) tunnel to `localhost:3000`
- [ ] Twilio Console webhook URLs point to ngrok origin + `/api/twilio/voice/incoming` (AI operator stub) or `/api/voice/inbound/twilio` (full routing)
- [ ] `TWILIO_WEBHOOK_SKIP_SIGNATURE_VALIDATION=true` or `VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION=true` **only on local machine** — remove before any shared/preview deploy
- [ ] Place test inbound call; verify TwiML response in Twilio debugger

### Browser calling (local)

- [ ] `TWILIO_TWIML_APP_SID` configured
- [ ] HTTPS or localhost (WebRTC requirement)
- [ ] Platform admin → voice browser calling readiness shows token probe result
- [ ] Microphone permission granted in browser

### Media / transcripts (local)

- [ ] `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN` set to ngrok HTTPS origin if testing streams
- [ ] `VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED=true` OR accept scaffold-only mode locally
- [ ] Transcript provider vars optional for stub dev

### AI phases (local)

- [ ] Keep all `VOICE_*_ENABLED` flags **false** until explicitly testing a phase
- [ ] Copilot defaults to `deterministic_template` — safe for local UI testing

---

## Vercel Preview checklist

### Core env (Preview project settings)

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_SITE_URL=https://<preview-deployment>.vercel.app`
- [ ] `GROWTH_ENGINE_ENABLED=true`
- [ ] `GROWTH_ENGINE_AI_ORG_ID`
- [ ] `EQUIPIFY_PLATFORM_ADMIN_EMAILS`
- [ ] **Do not** set `VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION`
- [ ] **Do not** set `GROWTH_TRANSPORT_SIMULATE` or `GROWTH_INBOX_SYNC_SIMULATE` unless intentionally testing (build warns)

### Twilio preview

- [ ] Twilio trial number voice URL → `https://<preview>/api/twilio/voice/incoming` (AI operator) or `https://<preview>/api/voice/inbound/twilio` (full routing)
- [ ] Status callback → `https://<preview>/api/voice/webhooks/twilio`
- [ ] Recording callback → `https://<preview>/api/voice/webhooks/twilio/recording`
- [ ] Twilio Debugger shows **200** on webhook POSTs (not 401/403/503)
- [ ] Update Twilio URLs after each preview deployment if using branch-specific URLs

### Incremental phase testing (preview)

Test one layer at a time per [rollout order](./VOICE_ENVIRONMENT_REQUIREMENTS.md#recommended-production-rollout-order):

- [ ] Observability readiness API returns schema ready
- [ ] Compliance readiness (if enabled)
- [ ] Browser calling token readiness = `ready`
- [ ] Media stream diagnostics show active session (if testing)
- [ ] Transcript provider readiness = `ready` (not `stub_only`)
- [ ] Receptionist / copilot / outbound — enable flags individually

---

## Vercel Production checklist

### Build guards (automatic)

Production build runs `scripts/verify-growth-production-runtime.ts`. Confirm:

- [ ] `GROWTH_PROVIDER_CREDENTIALS_PEPPER` set to strong unique secret (not dev fallback)
- [ ] `GROWTH_TRANSPORT_SIMULATE` is **unset** or not `true`
- [ ] `GROWTH_INBOX_SYNC_SIMULATE` is **unset** or not `true`
- [ ] Build log contains `[growth-runtime-guard] production build checks passed`

### Core production env

- [ ] All Supabase vars (production project)
- [ ] `NEXT_PUBLIC_SITE_URL=https://app.equipify.ai` (or production domain)
- [ ] `GROWTH_ENGINE_ENABLED=true`
- [ ] `GROWTH_ENGINE_AI_ORG_ID` (production internal org)
- [ ] `EQUIPIFY_PLATFORM_ADMIN_EMAILS` (production ops emails)
- [ ] `CRON_SECRET` (Growth crons — adjacent but required for outbound stack)
- [ ] `GROWTH_PROVIDER_CREDENTIALS_PEPPER`

### Dangerous flags — production verification

- [ ] `VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION` is **absent** or explicitly `false`
- [ ] `GROWTH_TRANSPORT_SIMULATE` is **absent**
- [ ] `GROWTH_INBOX_SYNC_SIMULATE` is **absent**
- [ ] No dev-only simulation flags in Vercel Production env group

### Voice phase flags (production)

Enable incrementally — do not enable all at once:

- [ ] `VOICE_OBSERVABILITY_ENABLED=true` (first)
- [ ] `VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true` (early)
- [ ] Twilio + browser calling vars (before AI)
- [ ] Media + transcript vars (before AI that depends on transcripts)
- [ ] AI flags only after prior layers verified

---

## Twilio Console checklist

- [ ] Account SID and Auth Token stored in Vercel (never in repo)
- [ ] TwiML App created with correct Voice URL
- [ ] API Key created (recommended for browser JWT — separate from auth token)
- [ ] Phone number voice configuration points to inbound webhook
- [ ] Status callback URL configured on number or TwiML App
- [ ] Recording callback URL set if recording enabled
- [ ] Media Stream URL uses `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN` when behind proxy

**Webhook paths:**

```
POST {ORIGIN}/api/twilio/voice/incoming
POST {ORIGIN}/api/voice/inbound/twilio
POST {ORIGIN}/api/voice/webhooks/twilio
POST {ORIGIN}/api/voice/webhooks/twilio/recording
GET/POST {ORIGIN}/api/voice/media/twilio
```

---

## Webhook verification checklist

- [ ] Place inbound test call from mobile phone
- [ ] Twilio Debugger → request to inbound route → **200**
- [ ] No **401** (signature failure — check auth token and public URL)
- [ ] No **403** (`GROWTH_ENGINE_ENABLED` off)
- [ ] No **503** (missing service role key)
- [ ] Call status events appear in voice timeline / observability
- [ ] Hangup triggers status callback to `/api/voice/webhooks/twilio`

---

## Media stream verification checklist

- [ ] `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN` matches Twilio-reachable HTTPS/WSS origin
- [ ] `VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED=true` OR external WS proxy documented and running
- [ ] Readiness panel: `twilioMediaStreamsReadiness` = `ready`
- [ ] Readiness panel: `websocketReadiness` ≠ `upgrade_requires_proxy` (unless proxy intentional)
- [ ] Active call creates row in `voice.voice_media_sessions`
- [ ] Timeline events recorded in `voice.voice_media_timeline_events`

---

## Transcript verification checklist

- [ ] `VOICE_TRANSCRIPT_PROVIDER` set to intended provider
- [ ] Matching API key present in Vercel env
- [ ] Readiness: `transcriptProviderReadiness` = `ready` (not `missing_credentials` or `stub_only`)
- [ ] Test call produces segments in `voice.voice_transcript_segments`
- [ ] Call workspace shows live or post-call transcript text
- [ ] Fallback: unset provider → stub mode still completes call without crash

---

## Receptionist verification checklist

- [ ] `VOICE_AI_RECEPTIONIST_ENABLED=true` only in target environment
- [ ] Start with `VOICE_AI_RECEPTIONIST_PROVIDER=deterministic`
- [ ] Inbound call routes through receptionist flow when configured
- [ ] After-hours and FAQ paths return bounded responses
- [ ] Scaffold provider (deepgram/openai/elevenlabs) falls back to deterministic when key missing
- [ ] No autonomous outbound triggered (compile-time guard)

---

## Outbound AI verification checklist

- [ ] `VOICE_AI_OUTBOUND_ENABLED=true` only after supervisor training
- [ ] Approval workflow required before any AI outbound session
- [ ] `VOICE_AI_OUTBOUND_PROVIDER=deterministic` for initial production
- [ ] DNC / suppression checks pass before dial
- [ ] Autonomous dial flags cannot be enabled via env (verify in readiness snapshot)

---

## Observability verification checklist

- [ ] `VOICE_OBSERVABILITY_ENABLED=true`
- [ ] Voice infrastructure settings panel loads without schema errors
- [ ] Call timeline events visible for test calls
- [ ] Alert foundations show `autonomousRemediationDisabled: true`
- [ ] Platform admin can inspect readiness snapshots per phase

---

## Rollback guidance

### Disable a voice phase quickly

Set the phase flag to `false` (or remove) in Vercel env and redeploy:

```
VOICE_AI_RECEPTIONIST_ENABLED=false
VOICE_AI_OUTBOUND_ENABLED=false
VOICE_DROP_ENABLED=false
```

Core telephony (inbound webhooks) continues if Twilio vars remain — only the AI layer stops.

### Disable all voice platform access

```
GROWTH_ENGINE_ENABLED=false
```

Returns **403** on voice routes — emergency kill switch without removing Twilio config.

### Roll back Twilio webhooks

Point Twilio number to previous TwiML URL or disable voice URL temporarily. No app redeploy required for webhook-only rollback.

### Roll back media/transcripts

- Remove or unset `VOICE_TRANSCRIPT_PROVIDER` → falls back to stub
- Calls continue; transcript ingestion stops

### Roll back browser calling

- Remove `TWILIO_TWIML_APP_SID` from env → tokens return stub mode
- Inbound PSTN calls unaffected

---

## Safe disable guidance

| Goal | Action |
| --- | --- |
| Stop AI suggestions only | Keep copilot on `deterministic_template`; no flag change needed |
| Stop receptionist | `VOICE_AI_RECEPTIONIST_ENABLED=false` |
| Stop outbound AI | `VOICE_AI_OUTBOUND_ENABLED=false` |
| Stop media ingestion | Unset transcript provider; media sessions remain scaffold-safe |
| Stop all voice APIs | `GROWTH_ENGINE_ENABLED=false` |
| Prevent forged webhooks | Ensure `VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION` is never `true` in prod |

---

## Cache clear / redeploy notes

**Redeploy required when changing:**

- `NEXT_PUBLIC_SITE_URL`
- `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN`
- Any `VOICE_*` feature flag or provider selection
- Twilio credential rotation

**After redeploy:**

1. Update Twilio Console webhook URLs if deployment URL changed (preview branches).
2. Place test inbound call.
3. Check platform admin voice readiness panels.
4. Verify build log passed growth runtime guard.

**Vercel cache:** Standard redeploy is sufficient. No special cache purge needed for voice env vars — they are injected at build/runtime from Vercel env, not baked into static assets (except `NEXT_PUBLIC_*` which require redeploy to propagate).

**Preview vs Production env groups:** Use separate Twilio numbers and API keys where possible. Never copy `VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION=true` from local `.env.local` into Vercel.

---

## Manual QA sign-off template

| Layer | Environment | Tester | Date | Pass |
| --- | --- | --- | --- | --- |
| Build guard | Production | | | ☐ |
| Inbound webhook | Preview | | | ☐ |
| Inbound webhook | Production | | | ☐ |
| Browser calling | Preview | | | ☐ |
| Media stream | Preview | | | ☐ |
| Transcripts | Preview | | | ☐ |
| Observability | Production | | | ☐ |
| Compliance | Production | | | ☐ |
| Receptionist | Preview | | | ☐ |
| Copilot (deterministic) | Production | | | ☐ |
| Outbound AI (supervised) | Preview | | | ☐ |
