/**
 * Production SMS inbound certification validation (temporary).
 * Run: tsx scripts/_tmp-sms-cert-validate.ts [leadId] [conversationId] [threadId] [sinceIso]
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapGrowthProductionEnv, parseGrowthProductionEnvFile } from "../lib/growth/qa/reply-flow-env-bootstrap"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const LEAD_ID = process.argv[2] ?? "93f1ba3e-b722-459f-9c58-4beae093d6b5"
const CONVERSATION_ID = process.argv[3] ?? "61463283-a4d3-48ba-a78a-24f7c11edf52"
const THREAD_ID = process.argv[4] ?? "79635015-f5c5-4667-ad30-c3fd767715fa"
const SINCE = process.argv[5] ?? new Date(Date.now() - 48 * 3600_000).toISOString()

type CheckResult = { name: string; status: "PASS" | "FAIL" | "WARN"; detail: string }

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

function countDuplicates<T>(rows: T[], keyFn: (row: T) => string | null | undefined): string[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k} (${n}x)`)
}

async function main() {
  const { url, key } = bootEnv()
  const admin = createClient(url, key)
  const checks: CheckResult[] = []

  const { data: conversation } = await admin
    .schema("growth")
    .from("sms_conversations")
    .select("id,lead_id,participant_e164,inbox_thread_id,message_count,last_message_at,last_message_preview")
    .eq("id", CONVERSATION_ID)
    .maybeSingle()

  const { data: thread } = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("id,lead_id,subject,provider_family,reply_count,last_message_at")
    .eq("id", THREAD_ID)
    .maybeSingle()

  const { data: outbound } = await admin
    .schema("growth")
    .from("sms_messages")
    .select("id,status,body,provider_message_id,direction,created_at")
    .eq("conversation_id", CONVERSATION_ID)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })

  const { data: inboundAll } = await admin
    .schema("growth")
    .from("sms_messages")
    .select("id,body,provider_message_id,direction,from_e164,to_e164,created_at")
    .eq("conversation_id", CONVERSATION_ID)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })

  const latestInbound = inboundAll?.[0] ?? null
  const yesInbound =
    inboundAll?.find((m) => /\byes\b/i.test(String(m.body ?? ""))) ??
    latestInbound

  const { data: providerEvents } = latestInbound?.provider_message_id
    ? await admin
        .schema("growth")
        .from("sms_provider_events")
        .select("id,event_type,processing_status,provider_message_id,received_at,processed_at")
        .eq("provider_message_id", latestInbound.provider_message_id)
        .order("received_at", { ascending: false })
    : { data: [] as Record<string, unknown>[] }

  const { data: inboxMessages } = await admin
    .schema("growth")
    .from("inbox_messages")
    .select("id,direction,body_preview,provider_message_id,created_at")
    .eq("thread_id", THREAD_ID)
    .order("created_at", { ascending: false })

  const { data: ingestion } = await admin
    .schema("growth")
    .from("reply_ingestion_events")
    .select("id,source,channel,provider_message_id,created_at,payload")
    .eq("lead_id", LEAD_ID)
    .gte("created_at", SINCE)
    .order("created_at", { ascending: false })

  const smsIngestion = (ingestion ?? []).filter((row) => {
    const source = String((row as { source?: string }).source ?? "")
    return source === "sms_provider_webhook" || source.includes("sms")
  })

  const { data: replies } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("id,classification,classification_v2,intent,confidence,body_excerpt,body_preview,received_at,channel")
    .eq("lead_id", LEAD_ID)
    .gte("received_at", SINCE)
    .order("received_at", { ascending: false })

  const { data: timeline } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id,event_type,title,summary,occurred_at,created_at")
    .eq("lead_id", LEAD_ID)
    .gte("occurred_at", SINCE)
    .order("occurred_at", { ascending: false })

  const { data: memoryEvents } = await admin
    .schema("growth")
    .from("lead_memory_events")
    .select("id,event_kind,summary,created_at")
    .eq("lead_id", LEAD_ID)
    .gte("created_at", SINCE)
    .order("created_at", { ascending: false })

  const { data: memoryProfile } = await admin
    .schema("growth")
    .from("lead_memory_profiles")
    .select("id,relationship_stage,interaction_count,updated_at,last_interaction_at")
    .eq("lead_id", LEAD_ID)
    .maybeSingle()

  const { data: deliveryAttempts } = await admin
    .schema("growth")
    .from("sms_delivery_attempts")
    .select("id,status,provider_message_id,sent_at,delivered_at,created_at")
    .eq("lead_id", LEAD_ID)
    .order("created_at", { ascending: false })
    .limit(5)

  // --- Checks ---

  checks.push({
    name: "Conversation exists and linked to lead",
    status: conversation?.lead_id === LEAD_ID ? "PASS" : "FAIL",
    detail: conversation
      ? `conversation ${CONVERSATION_ID} lead=${conversation.lead_id}`
      : "conversation not found",
  })

  checks.push({
    name: "Conversation ↔ inbox thread bridge",
    status:
      conversation?.inbox_thread_id === THREAD_ID && thread?.lead_id === LEAD_ID ? "PASS" : "FAIL",
    detail: `conversation.inbox_thread_id=${conversation?.inbox_thread_id ?? "null"} expected=${THREAD_ID}`,
  })

  checks.push({
    name: "Outbound SMS recorded (sms_messages)",
    status: (outbound?.length ?? 0) > 0 ? "PASS" : "FAIL",
    detail: `${outbound?.length ?? 0} outbound message(s); latest: ${outbound?.[0]?.provider_message_id ?? "none"}`,
  })

  checks.push({
    name: "Inbound SMS recorded (sms_messages)",
    status: (inboundAll?.length ?? 0) > 0 ? "PASS" : "FAIL",
    detail: latestInbound
      ? `body="${latestInbound.body}" sid=${latestInbound.provider_message_id} at=${latestInbound.created_at}`
      : "no inbound messages",
  })

  const yesReply = yesInbound && /\byes\b/i.test(String(yesInbound.body ?? ""))
  checks.push({
    name: "Inbound YES reply content",
    status: yesReply ? "PASS" : latestInbound ? "WARN" : "FAIL",
    detail: yesInbound
      ? `body="${yesInbound.body}" from=${yesInbound.from_e164}`
      : "no inbound to validate YES",
  })

  checks.push({
    name: "Twilio webhook (sms_provider_events)",
    status:
      (providerEvents?.length ?? 0) > 0 &&
      providerEvents?.some((e) => {
        const status = String((e as { processing_status?: string }).processing_status ?? "")
        return status === "processed" || status === "duplicate"
      })
        ? "PASS"
        : "FAIL",
    detail:
      providerEvents?.length
        ? providerEvents
            .map(
              (e) =>
                `${(e as { event_type?: string }).event_type}/${(e as { processing_status?: string }).processing_status}`,
            )
            .join(", ")
        : "no provider events for latest inbound SID",
  })

  const inboundInbox = (inboxMessages ?? []).filter((m) => m.direction === "inbound")
  checks.push({
    name: "Inbox bridge (inbox_messages inbound)",
    status: inboundInbox.length > 0 ? "PASS" : "FAIL",
    detail: `${inboundInbox.length} inbound inbox message(s); latest preview="${inboundInbox[0]?.body_preview ?? "none"}"`,
  })

  checks.push({
    name: "Reply ingestion (reply_ingestion_events)",
    status: smsIngestion.length > 0 ? "PASS" : "FAIL",
    detail: `${smsIngestion.length} SMS ingestion event(s) since ${SINCE}`,
  })

  checks.push({
    name: "Outbound reply record (outbound_replies)",
    status: (replies?.length ?? 0) > 0 ? "PASS" : "FAIL",
    detail: replies?.[0]
      ? `classification=${replies[0].classification_v2 ?? replies[0].classification} intent=${replies[0].intent} excerpt="${replies[0].body_excerpt ?? replies[0].body_preview}"`
      : "no outbound_replies since window",
  })

  const replyTimeline = (timeline ?? []).filter((e) =>
    /reply|sms|ingest|positive|interest/i.test(String(e.event_type ?? "") + String(e.title ?? "")),
  )
  checks.push({
    name: "Lead timeline events",
    status: replyTimeline.length > 0 ? "PASS" : "FAIL",
    detail: replyTimeline.length
      ? replyTimeline.map((e) => `${e.event_type}: ${e.title}`).join(" | ")
      : `${timeline?.length ?? 0} timeline events (none reply/SMS typed)`,
  })

  checks.push({
    name: "Lead memory events",
    status: (memoryEvents?.length ?? 0) > 0 ? "PASS" : "FAIL",
    detail: memoryEvents?.[0]
      ? `${memoryEvents[0].event_kind}: ${memoryEvents[0].summary}`
      : "no memory events since window",
  })

  checks.push({
    name: "Lead memory profile updated",
    status: memoryProfile?.updated_at ? "PASS" : "FAIL",
    detail: memoryProfile
      ? `stage=${memoryProfile.relationship_stage} interactions=${memoryProfile.interaction_count} updated=${memoryProfile.updated_at}`
      : "no memory profile",
  })

  const dupProviderSids = countDuplicates(inboundAll ?? [], (r) => r.provider_message_id)
  const dupSmsMessages = dupProviderSids.length === 0 ? "PASS" : "FAIL"
  checks.push({
    name: "Duplicate prevention — sms_messages (unique provider SID)",
    status: dupSmsMessages,
    detail: dupProviderSids.length ? `duplicates: ${dupProviderSids.join(", ")}` : "all inbound SIDs unique",
  })

  const dupIngestionIds = countDuplicates(smsIngestion, (r) =>
    String((r as { provider_message_id?: string }).provider_message_id ?? ""),
  )
  checks.push({
    name: "Duplicate prevention — reply_ingestion_events",
    status: dupIngestionIds.length === 0 ? "PASS" : "FAIL",
    detail: dupIngestionIds.length
      ? `duplicate provider_message_id: ${dupIngestionIds.join(", ")}`
      : `${smsIngestion.length} ingestion event(s), no duplicate provider SIDs`,
  })

  const dupInboxProvider = countDuplicates(inboxMessages ?? [], (r) => r.provider_message_id)
  checks.push({
    name: "Duplicate prevention — inbox_messages (provider_message_id)",
    status: dupInboxProvider.length === 0 ? "PASS" : "FAIL",
    detail: dupInboxProvider.length
      ? `duplicates: ${dupInboxProvider.join(", ")}`
      : "no duplicate provider_message_id in thread",
  })

  const dupReplies = countDuplicates(replies ?? [], (r) =>
    String(r.body_excerpt ?? r.body_preview ?? r.id),
  )
  checks.push({
    name: "Duplicate prevention — outbound_replies (recent window)",
    status: dupReplies.length === 0 ? "PASS" : "WARN",
    detail: dupReplies.length ? `possible dupes: ${dupReplies.join(", ")}` : `${replies?.length ?? 0} reply row(s)`,
  })

  const failed = checks.filter((c) => c.status === "FAIL")
  const warned = checks.filter((c) => c.status === "WARN")
  const overall = failed.length === 0 ? (warned.length ? "PASS_WITH_WARNINGS" : "PASS") : "FAIL"

  console.log("\n═══════════════════════════════════════════════════════════")
  console.log("  SMS INBOUND CERTIFICATION REPORT")
  console.log("═══════════════════════════════════════════════════════════")
  console.log(`Lead:         ${LEAD_ID}`)
  console.log(`Conversation: ${CONVERSATION_ID}`)
  console.log(`Inbox thread: ${THREAD_ID}`)
  console.log(`Window since: ${SINCE}`)
  console.log(`Overall:      ${overall}`)
  console.log("───────────────────────────────────────────────────────────")

  for (const check of checks) {
    const icon = check.status === "PASS" ? "✓" : check.status === "WARN" ? "!" : "✗"
    console.log(`${icon} [${check.status}] ${check.name}`)
    console.log(`    ${check.detail}`)
  }

  console.log("───────────────────────────────────────────────────────────")
  console.log("Evidence summary:")
  console.log(`  Outbound SMS: ${outbound?.length ?? 0}`)
  console.log(`  Inbound SMS:  ${inboundAll?.length ?? 0}`)
  console.log(`  Inbox msgs:   ${inboxMessages?.length ?? 0} (${inboundInbox.length} inbound)`)
  console.log(`  Provider evt: ${providerEvents?.length ?? 0}`)
  console.log(`  Ingestion:    ${smsIngestion.length}`)
  console.log(`  Replies:      ${replies?.length ?? 0}`)
  console.log(`  Timeline:     ${timeline?.length ?? 0}`)
  console.log(`  Memory evt:   ${memoryEvents?.length ?? 0}`)
  console.log(`  Delivery:     ${deliveryAttempts?.length ?? 0} attempt(s)`)
  console.log("═══════════════════════════════════════════════════════════\n")

  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
