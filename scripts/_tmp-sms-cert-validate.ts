import { createClient } from "@supabase/supabase-js"
import { bootstrapGrowthProductionEnv, parseGrowthProductionEnvFile } from "../lib/growth/qa/reply-flow-env-bootstrap"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const LEAD_ID = process.argv[2] ?? "30098b98-f162-4fe1-adf4-e339a8669dc7"
const CONVERSATION_ID = process.argv[3] ?? "95a9ffa9-5d3c-4fb0-a9ca-fe82616d15fb"
const THREAD_ID = process.argv[4] ?? "e77864fb-a17c-4e65-baa8-52e085eb7963"
const SINCE = process.argv[5] ?? new Date(Date.now() - 24 * 3600_000).toISOString()

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
  return { url: `https://${payload.ref}.supabase.co`, key }
}

async function main() {
  const { url, key } = bootEnv()
  const admin = createClient(url, key)

  const { data: attempts } = await admin.schema("growth").from("sms_delivery_attempts").select("id,status,provider_message_id,sent_at,delivered_at,created_at").eq("lead_id", LEAD_ID).order("created_at", { ascending: false }).limit(3)
  const { data: outbound } = await admin.schema("growth").from("sms_messages").select("id,status,body,provider_message_id,created_at").eq("conversation_id", CONVERSATION_ID).eq("direction", "outbound").order("created_at", { ascending: false }).limit(3)
  const { data: inbound } = await admin.schema("growth").from("sms_messages").select("id,body,provider_message_id,created_at").eq("conversation_id", CONVERSATION_ID).eq("direction", "inbound").order("created_at", { ascending: false }).limit(3)
  const { data: inbox } = await admin.schema("growth").from("inbox_messages").select("id,direction,body_preview,created_at").eq("thread_id", THREAD_ID).order("created_at", { ascending: false }).limit(5)
  const { data: thread } = await admin.schema("growth").from("inbox_threads").select("*").eq("id", THREAD_ID).maybeSingle()
  const { data: ingestion } = await admin.schema("growth").from("reply_ingestion_events").select("id,source,channel,created_at").eq("lead_id", LEAD_ID).gte("created_at", SINCE).order("created_at", { ascending: false }).limit(5)
  const { data: replies } = await admin.schema("growth").from("outbound_replies").select("id,classification,intent,confidence,body_excerpt,received_at").eq("lead_id", LEAD_ID).gte("received_at", SINCE).order("received_at", { ascending: false }).limit(3)
  const { data: timeline } = await admin.schema("growth").from("lead_timeline_events").select("id,event_type,title,occurred_at").eq("lead_id", LEAD_ID).gte("occurred_at", SINCE).order("occurred_at", { ascending: false }).limit(5)
  const { data: memoryEvents } = await admin.schema("growth").from("lead_memory_events").select("id,event_kind,summary,created_at").eq("lead_id", LEAD_ID).gte("created_at", SINCE).order("created_at", { ascending: false }).limit(5)
  const { data: memoryProfile } = await admin.schema("growth").from("lead_memory_profiles").select("id,relationship_stage,interaction_count,updated_at").eq("lead_id", LEAD_ID).maybeSingle()

  const latestInbound = inbound?.[0]
  let webhookEvents: unknown[] = []
  if (latestInbound?.provider_message_id) {
    const { data } = await admin.schema("growth").from("sms_provider_events").select("id,event_type,processing_status,received_at").eq("provider_message_id", latestInbound.provider_message_id)
    webhookEvents = data ?? []
  }

  console.log(JSON.stringify({
    leadId: LEAD_ID,
    conversationId: CONVERSATION_ID,
    threadId: THREAD_ID,
    since: SINCE,
    deliveryAttempts: attempts,
    outboundMessages: outbound,
    inboundMessages: inbound,
    inboxMessages: inbox,
    thread,
    inboundValidation: latestInbound ? {
      webhook: webhookEvents.length ? "PASS" : "FAIL",
      webhookEvents,
      replyIngestion: ingestion?.length ? "PASS" : "FAIL",
      ingestion,
      outboundReplies: replies?.length ? "PASS" : "FAIL",
      replies,
      timeline: timeline?.length ? "PASS" : "FAIL",
      timeline,
      memoryEvents: memoryEvents?.length ? "PASS" : "FAIL",
      memoryEvents,
      memoryProfile,
    } : { status: "NO_INBOUND_YET" },
  }, null, 2))
}

main()
