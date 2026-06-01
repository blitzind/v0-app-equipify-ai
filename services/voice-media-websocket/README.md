# Voice Media Websocket Service (Production)

Standalone Node.js service that terminates **Twilio Media Streams** WebSocket connections and forwards frames into the existing Equipify `media-session-service` pipeline (Deepgram bridge + transcript persistence).

This service exists because **Vercel serverless cannot hold persistent WebSocket connections**. The main Next.js app on Vercel continues to handle Twilio webhooks and TwiML; this service only ingests media streams.

## Hosting recommendation: Railway

**Railway** was chosen because it requires the least additional code:

- Native WebSocket support on the public HTTPS URL (Twilio uses `wss://`)
- Dockerfile-only deploy (no platform-specific SDK)
- Automatic `PORT` injection and `/health` checks via `railway.toml`
- No Fly.io `fly.toml`, Render blueprint, or VPS provisioning scripts needed

Alternatives:

| Platform | Effort | WebSocket | Notes |
| --- | --- | --- | --- |
| **Railway** | **Lowest** | Yes | Use this repo's `Dockerfile` + `railway.toml` |
| Render | Low | Yes | Swap health check config; same Docker image |
| Fly.io | Medium | Yes | Requires `fly.toml` + scale settings |
| VPS | High | Yes (manual) | You manage TLS, systemd, updates |

## Architecture

```
PSTN → Twilio (TwiML <Start><Stream>) → wss://<this-service>/api/voice/media/twilio
                                              ↓
                                    media-session-service
                                              ↓
                                    Deepgram bridge (in-process)
                                              ↓
                                    voice_transcript_segments (Supabase)
```

**Vercel app** (unchanged):

- `/api/voice/inbound/twilio` — inbound routing + TwiML with stream URL
- `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN` — must point at **this service's public URL**

## Files

| File | Purpose |
| --- | --- |
| `services/voice-media-websocket/server.ts` | Production entrypoint |
| `services/voice-media-websocket/bootstrap.ts` | HTTP server, health, graceful shutdown, logging |
| `services/voice-media-websocket/Dockerfile` | Container image (build from repo root) |
| `services/voice-media-websocket/railway.toml` | Railway deploy config |
| `scripts/voice-media-websocket-dev-server.ts` | Local dev (same bootstrap) |
| `lib/voice/media-streaming/twilio-media-websocket-server.ts` | WSS upgrade handler |

## Environment variables

Set these on **Railway** (and locally for dev):

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Service role key (server only — never expose publicly) |
| `GROWTH_ENGINE_AI_ORG_ID` | **Yes** | Org UUID used to resolve inbound `voice_calls` by `callSid` |
| `DEEPGRAM_API_KEY` | **Yes (prod)** | Live transcription bridge |
| `PORT` | Auto on Railway | Listen port (Railway injects this) |
| `NODE_ENV` | Recommended | `production` |

**Set on Vercel** (main app — not this service):

| Variable | Value |
| --- | --- |
| `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN` | `https://<your-railway-service>.up.railway.app` |

Optional:

| Variable | Default | Description |
| --- | --- | --- |
| `VOICE_MEDIA_WEBSOCKET_PORT` | `8080` | Local dev port if `PORT` unset |
| `VOICE_TRANSCRIPT_PROVIDER` | `stub` | Readiness UI on Vercel; runtime uses Deepgram when key present |

Do **not** set `VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED=true` on Vercel for this architecture — streams terminate on Railway, not Vercel.

## Railway deployment steps

### 1. Create the service

1. Open [Railway](https://railway.app) → New Project → **Deploy from GitHub repo**
2. Select this repository
3. Add a **new service** → Settings → **Build** → Builder: **Dockerfile**
4. Dockerfile path: `services/voice-media-websocket/Dockerfile`

### 2. Configure environment

In Railway → Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROWTH_ENGINE_AI_ORG_ID=<uuid>
DEEPGRAM_API_KEY=<key>
NODE_ENV=production
```

Use the **same values** as production Vercel where applicable.

### 3. Generate public domain

1. Railway → Service → **Settings** → **Networking** → **Generate Domain**
2. Note the URL, e.g. `https://voice-media-websocket-production.up.railway.app`

### 4. Point Vercel at Railway

In Vercel production env:

```
VOICE_MEDIA_STREAM_PUBLIC_ORIGIN=https://voice-media-websocket-production.up.railway.app
```

Redeploy Vercel so inbound TwiML emits:

`wss://voice-media-websocket-production.up.railway.app/api/voice/media/twilio`

### 5. Verify health

```bash
curl -sS https://<railway-domain>/health | jq
curl -sS https://<railway-domain>/ready | jq
```

Expected: `"ok": true`, `"checks"` all true, `"supabaseReachable": true`.

### 6. Place test call

See Manual QA checklist below.

## Local development

```bash
# Terminal 1 — websocket service
pnpm voice:media-websocket-dev

# Terminal 2 — tunnel (example)
ngrok http 3001

# .env.local
VOICE_MEDIA_STREAM_PUBLIC_ORIGIN=https://<ngrok-id>.ngrok-free.app
DEEPGRAM_API_KEY=...
GROWTH_ENGINE_AI_ORG_ID=...
```

Production local smoke test:

```bash
pnpm voice:media-websocket-production
```

## HTTP endpoints

| Path | Purpose |
| --- | --- |
| `GET /health` | Liveness (Railway health check) |
| `GET /ready` | Readiness (+ Supabase probe) |
| `GET /api/voice/media/twilio` | Compatibility metadata |
| `WS /api/voice/media/twilio` | Twilio Media Streams ingestion |

## Graceful shutdown

On `SIGTERM` / `SIGINT` (Railway deploys send `SIGTERM`):

1. Stop accepting new HTTP connections
2. Close active WebSocket clients with code `1001`
3. Wait up to 30s for WSS shutdown
4. Exit

## Reconnect handling

Twilio may reconnect media streams during a call. Existing in-repo logic handles this:

- `stream-session-registry.ts` — `allowReconnect: true` on duplicate stream SIDs
- `deepgram-twilio-realtime-bridge.ts` — Deepgram WS reconnect (up to 2 attempts)
- `twilio-media-websocket-server.ts` — tracks active connections for observability

No coaching or transcript logic was modified.

## Estimated monthly cost (Railway)

| Plan | Estimate | Notes |
| --- | --- | --- |
| Hobby + usage | **~$5–8/mo** | Small always-on container, light call volume |
| Pro team | **~$20+/mo** | Higher availability / support |

Actual cost depends on connection minutes and egress. A typical SMB call center with moderate inbound volume usually stays under **$10/mo** on Railway Hobby.

Render Starter (~$7/mo) and Fly.io shared CPU (~$5–6/mo) are comparable if you prefer those platforms — use the same Docker image.

## Manual QA checklist

### Pre-flight

- [ ] `GET /health` returns `200` with `"ok": true`
- [ ] `GET /ready` returns `200` with `"supabaseReachable": true`
- [ ] Railway logs show `startup_complete` with correct `websocketPath`
- [ ] Vercel `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN` matches Railway public URL
- [ ] Vercel redeployed after origin change

### Inbound call

- [ ] Place PSTN call → browser rings → answer (routing unchanged)
- [ ] Railway logs: `voice_stream_connected`
- [ ] Railway logs: `voice_media_websocket_frame` with `event: start`
- [ ] Railway logs: `voice_media_stream_started`
- [ ] Railway logs: `voice_deepgram_stream_open`
- [ ] Railway logs: `voice_transcript_interim` during speech

### Database

- [ ] `voice.voice_media_sessions` row with `stream_status = active`
- [ ] `voice.voice_transcript_sessions` row with `transcript_status = active`
- [ ] `voice.voice_transcript_segments` rows accumulating

### UI (Vercel app)

- [ ] Call workspace live transcript shows **Connected**
- [ ] Segments appear within a few seconds of speaking

### Shutdown / redeploy

- [ ] Railway redeploy sends `SIGTERM` without corrupting active call (best-effort)
- [ ] New deploy accepts new stream connections after startup

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Twilio stream never connects | `VOICE_MEDIA_STREAM_PUBLIC_ORIGIN` wrong or Vercel not redeployed |
| `organization_unresolved` / WS close 1008 | `GROWTH_ENGINE_AI_ORG_ID` mismatch or no `voice_calls` row for `callSid` |
| Media session but no transcript | `DEEPGRAM_API_KEY` missing on Railway service |
| Health OK but no segments | Check Railway logs for `voice_transcript_failed` |
