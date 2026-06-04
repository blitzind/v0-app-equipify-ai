/**
 * Replay post-ingestion pipeline for an inbound SMS without duplicating messages.
 *
 * Usage:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/replay-growth-sms-inbound-post-ingestion.ts SMdfbaba5a664187a6a16626ff2ccbfcf3
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapGrowthProductionEnv, parseGrowthProductionEnvFile } from "../lib/growth/qa/reply-flow-env-bootstrap"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const PROVIDER_MESSAGE_ID = process.argv[2]?.trim()
if (!PROVIDER_MESSAGE_ID) {
  console.error(
    "Usage: node -r ./scripts/server-only-shim.cjs --import tsx scripts/replay-growth-sms-inbound-post-ingestion.ts <providerMessageSid>",
  )
  process.exit(1)
}

function bootEnv() {
  const boot = bootstrapGrowthProductionEnv({ inheritProcessEnv: true })
  for (const file of boot.loadedFiles) {
    const p = resolve(process.cwd(), file)
    if (!existsSync(p)) continue
    for (const [k, v] of Object.entries(parseGrowthProductionEnvFile(p))) {
      const t = v.trim().replace(/\\+$/, "")
      if (!t || t.includes("$NEXT_PUBLIC")) continue
      if (k === "SUPABASE_SERVICE_ROLE_KEY" && !t.startsWith("eyJ")) continue
      process.env[k] = t
    }
  }
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/\\+$/, "")
  const payload = JSON.parse(Buffer.from(key.split(".")[1]!, "base64url").toString()) as { ref: string }
  const url = `https://${payload.ref}.supabase.co`
  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "00000000-0000-4000-8000-000000000000"
  return { url, key }
}

async function ensureSmsIngestionSourceConstraint(admin: ReturnType<typeof createClient>) {
  const probeKey = `constraint-probe:${Date.now()}`
  const { error } = await admin.schema("growth").from("reply_ingestion_events").insert({
    source: "sms_provider_webhook",
    dedupe_key: probeKey,
    received_at: new Date().toISOString(),
    processing_status: "pending",
  })
  if (!error) {
    await admin.schema("growth").from("reply_ingestion_events").delete().eq("dedupe_key", probeKey)
    return
  }
  if (!String(error.message).includes("reply_ingestion_events_source_check")) {
    throw new Error(error.message)
  }

  throw new Error(
    [
      "reply_ingestion_events.source check constraint blocks sms_provider_webhook.",
      "Apply supabase/migrations/20270704120000_growth_sms_reply_ingestion_source.sql, then re-run.",
    ].join(" "),
  )
}

async function main() {
  const { url, key } = bootEnv()
  const admin = createClient(url, key)

  await ensureSmsIngestionSourceConstraint(admin)

  const { replaySmsInboundPostIngestion } = await import("../lib/growth/sms/replay-sms-inbound-post-ingestion")
  const result = await replaySmsInboundPostIngestion(admin, {
    providerMessageId: PROVIDER_MESSAGE_ID,
    finalizeProviderEvent: true,
  })

  console.log(JSON.stringify({ ok: true, providerMessageId: PROVIDER_MESSAGE_ID, result }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
