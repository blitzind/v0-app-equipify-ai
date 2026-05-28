# Voice / AI Communications — Environment Requirements

**Canonical operational guide** for Equipify Growth Engine voice infrastructure.

Related docs:

- [VOICE_DEPLOYMENT_CHECKLIST.md](./VOICE_DEPLOYMENT_CHECKLIST.md) — step-by-step rollout checklists
- [GROWTH_OUTBOUND_OPERATIONAL_READINESS.md](./GROWTH_OUTBOUND_OPERATIONAL_READINESS.md) — email/outbound transport (adjacent, not Twilio voice)
- `.env.local.example` — commented variable reference

---

## Overview

The voice platform is designed for **safe incremental production rollout**. Most capabilities default to **stub** or **deterministic** mode until credentials, feature flags, and schema are explicitly configured.

### Operating modes

| Mode | Description | Typical configuration |
| --- | --- | --- |
| **Stub / deterministic** | No live telephony or AI providers. Routes respond; UI shows readiness warnings. Safe for local dev and early preview. | Missing Twilio keys; feature flags off; `VOICE_*_PROVIDER=deterministic*` |
| **Partially connected** | Twilio webhooks or browser calling live; media/transcripts/AI still stub or scaffold. | Twilio creds + `GROWTH_ENGINE_ENABLED`; transcript provider unset |
| **Fully connected** | Live telephony + media + chosen transcript/AI providers + enabled phase flags. | All required creds, public origins, feature flags per phase |

### Production rollout philosophy

1. **Enable observability and compliance surfaces first** — verify schema, logging, and operator visibility before AI features.
2. **Connect telephony incrementally** — inbound webhooks → browser calling → media streams → transcripts.
3. **Turn on AI phases one at a time** — receptionist, copilot, outbound each have separate flags and provider gates.
4. **Never bypass signature validation or simulation flags in production** — see [Dangerous Flags](#dangerous-flags).
5. **Autonomous outbound cannot be enabled via env** — compile-time constants enforce operator control.

Readiness for each phase is visible in platform admin voice settings (`/admin/growth/voice/*`) and via readiness API routes under `app/api/platform/growth/voice/**`.

---

## Required Core Production Vars

### Supabase

| Variable | Secret? | Local | Preview | Production |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Required | Required | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Required | Required | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Required for voice webhooks | Required | Required |

**If missing:** Voice webhook routes return **503** (`server_config`). Media stream org resolution and call persistence fail.

### Growth Engine gates

| Variable | Secret? | Required for voice? | If missing / off |
| --- | --- | --- | --- |
| `GROWTH_ENGINE_ENABLED` | No | **Yes** | All `/api/voice/*` and platform voice routes return **403** (`feature_disabled`) |
| `GROWTH_ENGINE_AI_ORG_ID` | No (UUID) | **Yes** for platform voice APIs | Platform routes **400** `org_not_configured`; media streams cannot resolve org |

Set `GROWTH_ENGINE_ENABLED=true` only after voice schema migrations are applied.

### Platform admin access

| Variable | Secret? | Notes |
| --- | --- | --- |
| `EQUIPIFY_PLATFORM_ADMIN_EMAILS` | No | Comma-separated allowlist for platform admin UI and voice settings |

Aliases accepted: `PLATFORM_ADMIN_EMAILS`, `PLATFORM_ADMIN_EMAIL` (prefer `EQUIPIFY_PLATFORM_ADMIN_EMAILS`).

**If missing:** Voice infrastructure settings panels are inaccessible; voice APIs still work for configured webhooks if other vars are set.

### Credential peppers (Growth outbound — adjacent)

| Variable | Secret? | Production |
| --- | --- | --- |
| `GROWTH_PROVIDER_CREDENTIALS_PEPPER` | **Secret** | **Required** (alias: `GROWTH_PROVIDER_SECRET_PEPPER`) |
| `CRON_SECRET` | **Secret** | **Required** for Growth crons |

These are enforced by `scripts/verify-growth-production-runtime.ts` at build time. See [Runtime Verification](#runtime-verification).

### Public site URL

| Variable | Secret? | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public | Used for Twilio webhook URL construction and redirects |
| `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN` | Public | Overrides origin for Twilio Media Stream WSS URL when behind proxy |

**If `NEXT_PUBLIC_SITE_URL` is unset:** Webhook helpers fall back to `https://your-deployment.example` — Twilio console must use real deployment URLs.

---

## Twilio Configuration

### Required Twilio variables

| Variable | Secret? | Required for | If missing |
| --- | --- | --- | --- |
| `TWILIO_ACCOUNT_SID` | Semi-public | Webhook validation, tokens, media | Signature validation fails (**401**); stub mode |
| `TWILIO_AUTH_TOKEN` | **Secret** | Webhook validation, REST API | Same as above |
| `TWILIO_TWIML_APP_SID` | Semi-public | **Browser outbound calling** | Browser tokens issued in stub mode |
| `TWILIO_API_KEY_SID` | **Secret** | Optional | Falls back to `TWILIO_ACCOUNT_SID` for JWT signing |
| `TWILIO_API_KEY_SECRET` | **Secret** | Optional | Falls back to `TWILIO_AUTH_TOKEN` |
| `TWILIO_VOICE_FROM_NUMBER` | Public (E.164) | Conference / transfer dial-out | Transfer readiness `missing_credentials` |
| `TWILIO_PHONE_NUMBER` | Public | Optional alias | Used if `TWILIO_VOICE_FROM_NUMBER` unset |

### Browser calling

| Variable | Values | Selection logic |
| --- | --- | --- |
| `VOICE_BROWSER_CALLING_PROVIDER` | `twilio` \| `telnyx` \| `sip` \| `stub` | Explicit value wins; else auto-`twilio` if `TWILIO_ACCOUNT_SID` + `TWILIO_TWIML_APP_SID`; else **stub** |

Telnyx and SIP providers are scaffold-only today.

**TwiML App setup:**

1. Create a TwiML App in Twilio Console.
2. Set Voice Request URL to `{ORIGIN}/api/twilio/voice/incoming` (AI operator stub) or `{ORIGIN}/api/voice/inbound/twilio` (full Growth inbound routing).
3. Copy App SID to `TWILIO_TWIML_APP_SID`.

### Webhook routes (exact paths)

Configure these in Twilio Console using your deployment origin (`https://app.equipify.ai` or preview URL):

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/twilio/voice/incoming` | POST | **AI operator inbound stub** — greeting TwiML while realtime streaming is wired |
| `/api/voice/inbound/twilio` | POST | Full inbound call routing → TwiML response |
| `/api/voice/webhooks/twilio` | POST | Call status callbacks |
| `/api/voice/webhooks/twilio/recording` | POST | Recording completion callbacks |
| `/api/voice/media/twilio` | GET/POST | Media Streams ingestion / WebSocket upgrade |

URL builders: `lib/voice/call-control/urls.ts`

**Example production URLs:**

```
https://app.equipify.ai/api/twilio/voice/incoming
https://app.equipify.ai/api/voice/inbound/twilio
https://app.equipify.ai/api/voice/webhooks/twilio
https://app.equipify.ai/api/voice/webhooks/twilio/recording
https://app.equipify.ai/api/voice/media/twilio
```

Inbound handler sets `statusCallback` to `{ORIGIN}/api/voice/webhooks/twilio`.

### Media stream setup

| Variable | Purpose |
| --- | --- |
| `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN` | Public HTTPS/WSS origin Twilio uses for `<Stream>` URL (required when app sits behind proxy or origin differs from request host) |
| `VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED` | Set `true` to allow WebSocket upgrade on media route; otherwise **426** and readiness warns `upgrade_requires_proxy` |

### Outbound calling setup

Browser outbound uses Twilio Voice SDK + TwiML App. Native dialer / Google Voice bridge has **no env vars** — manual operator flow only.

### Voice drop scaffold

| Variable | Values | Notes |
| --- | --- | --- |
| `VOICE_DROP_ENABLED` | `true` / false (default off) | Feature gate |
| `VOICE_DROP_PROVIDER` | `stub` (default), `twilio`, `ringless_future` | Twilio requires `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`; ringless is scaffold |

Autonomous voice drop outbound is **compile-time disabled** — see [Dangerous Flags](#dangerous-flags).

### Common Twilio failures

| Symptom | Likely cause |
| --- | --- |
| **401** on webhooks | Wrong `TWILIO_AUTH_TOKEN` or signature validation mismatch (check public URL vs Twilio config) |
| **503** on webhooks | Missing `SUPABASE_SERVICE_ROLE_KEY` |
| Browser token stub | Missing `TWILIO_TWIML_APP_SID` or account credentials |
| Media stream not connecting | `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN` wrong; WSS not enabled; Vercel needs external WS proxy or `VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED=true` |
| Calls connect but no transcripts | Transcript provider unset or API key missing — falls back to stub |

**Redeploy required when:** changing `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN`, `NEXT_PUBLIC_SITE_URL`, or any Twilio webhook target URL. Update Twilio Console **and** redeploy so TwiML builders emit correct URLs.

---

## Media Streaming + Transcript Providers

### Provider selection

`VOICE_TRANSCRIPT_PROVIDER` + matching API key determines active provider (`lib/voice/transcripts/providers/types.ts`):

| `VOICE_TRANSCRIPT_PROVIDER` | Required key | Result if key missing |
| --- | --- | --- |
| `deepgram` | `DEEPGRAM_API_KEY` | Falls through to **stub** |
| `assemblyai` | `ASSEMBLYAI_API_KEY` | Falls through to **stub** |
| `openai_realtime` | `OPENAI_API_KEY` | Falls through to **stub** |
| `none` | — | Transcript ingestion disabled |
| *(unset)* | — | **stub** |

Even when a provider is selected with valid keys, implementations may run in **stubMode** until live streaming wiring is complete for that provider. Readiness UI reflects `stub_only` vs `ready`.

### Deepgram

```
VOICE_TRANSCRIPT_PROVIDER=deepgram
DEEPGRAM_API_KEY=your_deepgram_api_key
```

Also used by Growth realtime browser mic streaming when session config selects Deepgram.

### AssemblyAI

```
VOICE_TRANSCRIPT_PROVIDER=assemblyai
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
```

### OpenAI Realtime (transcript scaffold)

```
VOICE_TRANSCRIPT_PROVIDER=openai_realtime
OPENAI_API_KEY=sk-...
```

Placeholder only — returns scaffold session refs; not full live transcription yet.

### Fallback / stub behavior

- Missing provider config → **stub** transcript provider (deterministic segment handling).
- Provider timeout or failure → logged; session continues in degraded mode.
- `VOICE_TRANSCRIPT_PROVIDER=none` → explicit disable (no segments ingested).

### Production-safe rollout order (media + transcripts)

1. Apply voice media migrations (`voice_media_sessions`, `voice_transcript_sessions`, etc.).
2. Configure Twilio + verify inbound call completes.
3. Set `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN` to production WSS-capable origin.
4. Enable WebSocket upgrade or external proxy.
5. Set transcript provider + API key in **preview** first; verify readiness panel shows `ready`.
6. Promote to production with same vars.

---

## AI Provider Setup

### What is live vs scaffold-only

| Surface | Default | Live when | Scaffold / fallback |
| --- | --- | --- | --- |
| **AI Copilot** | `deterministic_template` | `VOICE_AI_COPILOT_PROVIDER=openai` + `VOICE_AI_COPILOT_OPENAI_ENABLED=true` + `OPENAI_API_KEY` | OpenAI path validates JSON but deterministic drafts remain authoritative until prompt wiring approved; timeout → deterministic |
| **Conversation intelligence** | `deterministic_rules` | `VOICE_INTELLIGENCE_PROVIDER=openai` + `VOICE_INTELLIGENCE_OPENAI_ENABLED=true` + `OPENAI_API_KEY` | OpenAI returns empty insights scaffold; rules provider is production default |
| **AI Receptionist** | disabled + `deterministic` | `VOICE_AI_RECEPTIONIST_ENABLED=true` + provider + API key | deepgram/openai_realtime/elevenlabs are scaffolds; missing key → deterministic fallback |
| **AI Outbound** | disabled + `deterministic` | `VOICE_AI_OUTBOUND_ENABLED=true` + provider + API key | Same scaffold pattern; approval-gated workflows |
| **Voice drops** | disabled + `stub` | `VOICE_DROP_ENABLED=true` + `VOICE_DROP_PROVIDER=twilio` + Twilio creds | ringless_future is scaffold |
| **Growth realtime (call workspace)** | Per-session DB config | `DEEPGRAM_API_KEY` / `ASSEMBLYAI_API_KEY` / `OPENAI_API_KEY` per selected provider | Autonomous audio actions forbidden by compile-time invariant |

Passive intelligence (conversation, retention, revenue, relationship memory) runs without phase feature flags but **never executes autonomous actions**.

### OpenAI (shared)

| Variable | Used by |
| --- | --- |
| `OPENAI_API_KEY` | Copilot, intelligence, receptionist/outbound scaffolds, openai_realtime transcript placeholder, Growth AI copilot, Growth OpenAI realtime bridge |

Never expose to the browser.

### AI Copilot

```
VOICE_AI_COPILOT_PROVIDER=deterministic_template   # safe default
# VOICE_AI_COPILOT_PROVIDER=openai
# VOICE_AI_COPILOT_OPENAI_ENABLED=true
# OPENAI_API_KEY=sk-...
```

### Conversation intelligence

```
VOICE_INTELLIGENCE_PROVIDER=deterministic_rules   # safe default
# VOICE_INTELLIGENCE_PROVIDER=openai
# VOICE_INTELLIGENCE_OPENAI_ENABLED=true
```

### AI Receptionist

```
VOICE_AI_RECEPTIONIST_ENABLED=false                 # safe default
VOICE_AI_RECEPTIONIST_PROVIDER=deterministic
# VOICE_AI_RECEPTIONIST_PROVIDER=deepgram|openai_realtime|elevenlabs
# DEEPGRAM_API_KEY= / OPENAI_API_KEY= / ELEVENLABS_API_KEY=
```

### AI Outbound

```
VOICE_AI_OUTBOUND_ENABLED=false                     # safe default
VOICE_AI_OUTBOUND_PROVIDER=deterministic
```

Supervised, approval-gated. Autonomous dial/send cannot be enabled via env.

### ElevenLabs (scaffold)

```
# ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

Used only when receptionist/outbound provider mode is `elevenlabs` and key is present.

---

## Dangerous Flags

### NEVER enable in production

| Flag | Risk | Build guard? |
| --- | --- | --- |
| `TWILIO_WEBHOOK_SKIP_SIGNATURE_VALIDATION=true` | Accepts forged Twilio webhooks — full telephony compromise | **No** — manual discipline only |
| `VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION=true` | Same as above (legacy alias) | **No** — manual discipline only |
| `GROWTH_TRANSPORT_SIMULATE=true` | Fake outbound email sends | **Yes** — production build fails |
| `GROWTH_INBOX_SYNC_SIMULATE=true` | No live mailbox polling | **Yes** — production build fails |
| Dev fallback `GROWTH_PROVIDER_CREDENTIALS_PEPPER` | Weak credential encryption | **Yes** — production build fails |
| `GROWTH_WEBHOOK_SIMULATION=true` | Bypasses Growth **email** webhook signatures (not Twilio voice) | No — dev-oriented |

### Autonomous safeguards (compile-time — not env-configurable)

These TypeScript constants are `true` / empty arrays and **cannot be overridden** by environment variables:

| Constant | Area |
| --- | --- |
| `VOICE_AI_COPILOT_AUTONOMOUS_ACTIONS_DISABLED` | Copilot |
| `VOICE_AI_RECEPTIONIST_AUTONOMOUS_OUTBOUND_DISABLED` | Receptionist |
| `VOICE_AI_OUTBOUND_AUTONOMOUS_*_DISABLED` | Outbound AI |
| `VOICE_MISSED_CALL_RECOVERY_AUTONOMOUS_OUTBOUND_DISABLED` | Missed call recovery |
| `VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED` | Voice drops |
| `VOICE_COMPLIANCE_AUTONOMOUS_OUTBOUND_DISABLED` | Compliance orchestration |
| `VOICE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED` | Conversation intelligence |
| `VOICE_OBSERVABILITY_AUTONOMOUS_REMEDIATION_DISABLED` | Observability |
| `VOICE_WORKFLOW_AUTONOMOUS_EXECUTION_DISABLED` | Workflow orchestration |
| `VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED` | Multichannel intelligence |
| `OPENAI_REALTIME_AUTONOMOUS_AUDIO_FORBIDDEN` | Growth realtime |
| `REALTIME_PROVIDER_AUTONOMOUS_ACTIONS = []` | Growth realtime providers |
| `NATIVE_DIALER_AUTONOMOUS_ACTIONS = []` | Native dialer bridge |

Phase test scripts assert these invariants (e.g. `scripts/test-voice-ai-receptionist-phase-4a.ts`).

---

## Feature Flag Matrix

| Feature | Required vars | Safe default | Production recommendation |
| --- | --- | --- | --- |
| **Voice platform gate** | `GROWTH_ENGINE_ENABLED`, `GROWTH_ENGINE_AI_ORG_ID`, `SUPABASE_SERVICE_ROLE_KEY` | Off / unset | Enable after schema applied |
| **Twilio inbound webhooks** | Twilio SID + auth token, site URL | Stub | Configure webhooks in preview first |
| **Browser calling** | + `TWILIO_TWIML_APP_SID`, optional API key pair | Stub | Enable after inbound verified |
| **Media streaming** | Twilio creds, `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN`, WS upgrade or proxy | Stub | Enable after browser calling stable |
| **Transcripts** | `VOICE_TRANSCRIPT_PROVIDER` + provider API key | stub | Start with Deepgram in preview |
| **AI receptionist** | `VOICE_AI_RECEPTIONIST_ENABLED=true`, provider vars | **false** / deterministic | Enable only with operator playbook |
| **AI copilot** | `VOICE_AI_COPILOT_*`, optional OpenAI | deterministic_template | OpenAI optional; deterministic is safe default |
| **Conversation intelligence** | `VOICE_INTELLIGENCE_*` | deterministic_rules | Rules provider for production v1 |
| **AI outbound** | `VOICE_AI_OUTBOUND_ENABLED=true` | **false** | Supervised rollout only |
| **Voice drops** | `VOICE_DROP_ENABLED=true`, `VOICE_DROP_PROVIDER` | **false** / stub | Scaffold until compliance review |
| **Missed call recovery** | `VOICE_MISSED_CALL_RECOVERY_ENABLED=true` | **false** | After receptionist stable |
| **Compliance orchestration** | `VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true` | **false** | Enable early in rollout (phase 4C) |
| **Observability** | `VOICE_OBSERVABILITY_ENABLED=true` | **false** | **Enable first** in production voice rollout |
| **Workflow orchestration** | `VOICE_WORKFLOW_ORCHESTRATION_ENABLED=true` | **false** | After observability + compliance |
| **Multichannel intelligence** | `VOICE_MULTICHANNEL_INTELLIGENCE_ENABLED=true` | **false** | Last AI comms phase |

Passive slices (conversation intelligence overlays, retention/revenue intelligence, relationship memory) do not require phase flags but still respect autonomous-disabled constants.

---

## Recommended Production Rollout Order

### 1. Observability (`VOICE_OBSERVABILITY_ENABLED=true`)

Verify schema, timeline events, and operator dashboards. No provider keys required.

### 2. Compliance (`VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true`)

Confirm DNC, consent, and suppression surfaces before increasing call volume.

### 3. Browser calling

Configure Twilio Voice SDK credentials + TwiML App. Test token issuance in preview readiness panel.

### 4. Media streaming

Set public origin, verify Twilio `<Stream>` connects. Check `voice_media_sessions` rows persist.

### 5. Transcripts

Enable one provider (recommend Deepgram first) in preview. Verify segments in call workspace.

### 6. AI receptionist

Enable flag in preview with `deterministic` provider first, then evaluate scaffold providers.

### 7. AI copilot

Keep `deterministic_template` in production until OpenAI prompt wiring is approved.

### 8. Workflow orchestration

Enable after observability shows stable call + transcript pipeline.

### 9. Outbound supervision

Enable `VOICE_AI_OUTBOUND_ENABLED` only with approval workflows and operator training.

### 10. Voice drops

Last — scaffold providers; autonomous delivery disabled at compile time.

### Why incremental rollout matters

Each layer depends on the previous: webhooks → media → transcripts → AI. Enabling all flags at once makes failures hard to isolate (Twilio vs WS vs provider vs AI). Test each layer in **Vercel Preview** with Twilio trial numbers before promoting env vars to production.

---

## Runtime Verification

### `scripts/verify-growth-production-runtime.ts`

Runs automatically before `next build` (`package.json` `"build"` script).

**Production detection:**

- `VERCEL_ENV === "production"`, or
- `NODE_ENV === "production"` and not a Vercel build

**Checks (production only — exit 1 on failure):**

| Check | Violation |
| --- | --- |
| `GROWTH_PROVIDER_CREDENTIALS_PEPPER` not dev fallback | Build blocked |
| `GROWTH_TRANSPORT_SIMULATE !== true` | Build blocked |
| `GROWTH_INBOX_SYNC_SIMULATE !== true` | Build blocked |

**Non-production:** logs warnings, does not fail build.

**Does NOT verify:** any `VOICE_*` vars, Twilio keys, transcript/AI providers, or `VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION`. Those require manual checklist discipline.

**Runtime enforcement:** `assertGrowthProductionRuntimeSafe()` also throws on live outbound send/cron paths when simulation flags or dev pepper are active (`lib/growth/runtime/runtime-guards.ts`).

### Manual voice production verification

Use [VOICE_DEPLOYMENT_CHECKLIST.md](./VOICE_DEPLOYMENT_CHECKLIST.md) for Twilio, media, and AI layers not covered by the build script.

---

## Environment matrix summary

| Concern | Local dev | Vercel Preview | Vercel Production |
| --- | --- | --- | --- |
| `GROWTH_ENGINE_ENABLED` | Optional | Recommended | Required for voice |
| Twilio webhooks | ngrok + skip sig validation **dev only** | Trial number + real validation | Production number + real validation |
| `TWILIO_WEBHOOK_SKIP_SIGNATURE_VALIDATION` | May use locally | **Never** | **Never** |
| `VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION` | May use locally (alias) | **Never** | **Never** |
| Simulate flags | Allowed (warnings) | Allowed (warnings) | **Build fails** |
| AI feature flags | Off by default | Enable per phase for testing | Enable incrementally |
| Credential pepper | Dev fallback OK | Set real pepper | **Required** real pepper |

---

## Schema migrations

Voice features require applied Supabase migrations under `supabase/migrations/` (voice schema). Foundation migration referenced in `.env.local.example`: `20270527140000` (Phase 1A). Media streaming: `20270606120000`. Apply all voice migrations before enabling production traffic.

Verify schema via platform admin voice readiness panels or `lib/voice/schema-health.ts` diagnostics.
