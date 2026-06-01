/**
 * Supabase PostgREST diagnostics regression checks.
 * Run: pnpm test:voice-supabase-rest-diagnostics
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  classifySupabaseRestEndpoint,
  isHtmlSupabaseRestResponse,
  sanitizeSupabaseRestResponsePreview,
  sanitizeSupabaseRestUrl,
} from "../lib/voice/repository/supabase-rest-diagnostics"

assert.equal(
  sanitizeSupabaseRestUrl("https://abc.supabase.co/rest/v1/voice_transcript_sessions?select=*"),
  "https://abc.supabase.co/rest/v1/voice_transcript_sessions",
)

assert.equal(
  classifySupabaseRestEndpoint("https://abc.supabase.co/rest/v1/voice_transcript_sessions"),
  "postgrest",
)

const htmlPreview = "<!DOCTYPE html><html><body>Cloudflare Ray ID: abc</body></html>"
assert.equal(isHtmlSupabaseRestResponse("text/html", htmlPreview), true)

const jwtBody = "token eyJabcdefghij.defghijklmnop.ghijklmnopqrst and ".padEnd(260, "x")
const sanitized = sanitizeSupabaseRestResponsePreview(jwtBody)
assert.ok(sanitized.includes("[REDACTED_JWT]"))
assert.ok(sanitized.length <= 201)

const repositorySource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/repository/voice-media-streaming-repository.ts"),
  "utf8",
)
assert.match(repositorySource, /executeVoiceMediaRepositoryQuery/)
assert.match(repositorySource, /findActiveTranscriptSessionForMedia/)

const bootstrapSource = fs.readFileSync(
  path.join(process.cwd(), "services/voice-media-websocket/bootstrap.ts"),
  "utf8",
)
assert.match(bootstrapSource, /createVoiceMediaStreamingServiceRoleClient/)

const diagnosticsSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/repository/supabase-rest-diagnostics.ts"),
  "utf8",
)
assert.match(diagnosticsSource, /voice_supabase_rest_anomaly/)
assert.match(diagnosticsSource, /bodyPreview/)
assert.match(diagnosticsSource, /contentType/)

console.log("voice-supabase-rest-diagnostics checks passed")
