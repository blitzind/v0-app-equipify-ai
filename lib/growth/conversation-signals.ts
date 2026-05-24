import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthConversationObjectionKey,
  GrowthConversationSignal,
  GrowthLeadConversationInput,
} from "@/lib/growth/conversation-types"
import { GROWTH_CONVERSATION_OBJECTION_KEYS } from "@/lib/growth/conversation-types"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import { listGrowthOutboundRepliesForLead } from "@/lib/growth/outbound/reply-repository"
import type { GrowthLead } from "@/lib/growth/types"

const COMPETITOR_PATTERNS = [
  { name: "ServiceTitan", pattern: /\bservicetitan\b/i },
  { name: "Housecall Pro", pattern: /\bhousecall\s*pro\b/i },
  { name: "Jobber", pattern: /\bjobber\b/i },
  { name: "FieldEdge", pattern: /\bfield\s*edge\b/i },
  { name: "Salesforce", pattern: /\bsalesforce\b/i },
  { name: "HubSpot", pattern: /\bhubspot\b/i },
]

function classifyObjection(text: string): string | null {
  const lower = text.toLowerCase()
  if (/\b(budget|price|cost|expensive|afford)\b/.test(lower)) return "budget"
  if (/\b(timing|later|next quarter|not now|too busy)\b/.test(lower)) return "timing"
  if (/\b(already (use|using|have)|current vendor|incumbent)\b/.test(lower)) return "already_using_solution"
  if (/\b(boss|decision|approval|sign.?off|stakeholder)\b/.test(lower)) return "authority"
  if (/\b(implement|rollout|migration|onboard)\b/.test(lower)) return "implementation"
  if (/\b(priority|not a priority|back burner)\b/.test(lower)) return "priority"
  if (/\b(feature|missing|doesn.t|lack)\b/.test(lower)) return "feature_gap"
  if (/\b(not interested|no thanks|pass)\b/.test(lower)) return "other"
  return null
}

function detectCompetitors(text: string): string[] {
  const found: string[] = []
  for (const { name, pattern } of COMPETITOR_PATTERNS) {
    if (pattern.test(text)) found.push(name)
  }
  return found
}

function urgencyFromText(text: string): number {
  const lower = text.toLowerCase()
  if (/\b(asap|urgent|immediately|today|this week)\b/.test(lower)) return 4
  if (/\b(soon|quick|fast|deadline)\b/.test(lower)) return 3
  if (/\b(when can|timeline|schedule)\b/.test(lower)) return 2
  return 0
}

function buyingIntentFromText(text: string): number {
  const lower = text.toLowerCase()
  if (/\b(ready to buy|sign|contract|purchase|move forward)\b/.test(lower)) return 5
  if (/\b(pricing|demo|trial|proposal|quote)\b/.test(lower)) return 4
  if (/\b(interested|learn more|tell me more)\b/.test(lower)) return 3
  if (/\b(maybe|considering|exploring)\b/.test(lower)) return 2
  return 0
}

function sentimentFromText(text: string): number {
  const lower = text.toLowerCase()
  if (/\b(thank|great|love|excited|perfect|yes)\b/.test(lower)) return 2
  if (/\b(frustrated|angry|disappointed|unhappy|terrible)\b/.test(lower)) return -3
  if (/\b(concern|worried|unsure|hesitant)\b/.test(lower)) return -1
  if (/\b(no|not interested|stop)\b/.test(lower)) return -2
  return 0
}

export async function fetchGrowthLeadConversationInput(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<GrowthLeadConversationInput> {
  const now = new Date()
  const since180d = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()
  const signals: GrowthConversationSignal[] = []
  const replyLatenciesMs: number[] = []

  const emailSummary = await fetchGrowthLeadEmailEventSummary(admin, lead.id, lead.contactEmail)

  const replies = await listGrowthOutboundRepliesForLead(admin, lead.id, 50)
  for (const reply of replies) {
    const text = reply.bodyPreview ?? ""
    const occurredAt = reply.receivedAt
    if (!occurredAt || occurredAt < since180d) continue

    const classification = reply.classification ?? "unclassified"
    let points = 5
    if (classification === "interested") points = 18
    else if (classification === "objection") points = -8
    else if (classification === "not_interested") points = -20
    else if (classification === "out_of_office") points = 2

    signals.push({
      kind: `email_reply_${classification}`,
      label: `Email reply (${classification.replace(/_/g, " ")})`,
      points,
      occurredAt,
      source: "email",
      text,
    })

    const objectionKey = classifyObjection(text)
    if (objectionKey) {
      signals.push({
        kind: `objection_${objectionKey}`,
        label: `Objection: ${objectionKey.replace(/_/g, " ")}`,
        points: -6,
        occurredAt,
        source: "email",
        text,
      })
    }

    for (const competitor of detectCompetitors(text)) {
      signals.push({
        kind: `competitor_${competitor.toLowerCase().replace(/\s+/g, "_")}`,
        label: `Competitor mention: ${competitor}`,
        points: -4,
        occurredAt,
        source: "email",
        text,
      })
    }

    const urgency = urgencyFromText(text)
    if (urgency > 0) {
      signals.push({
        kind: "urgency_detected",
        label: urgency >= 4 ? "High urgency language" : "Urgency language",
        points: urgency * 3,
        occurredAt,
        source: "email",
        text,
      })
    }

    const buying = buyingIntentFromText(text)
    if (buying > 0) {
      signals.push({
        kind: "buying_intent",
        label: buying >= 4 ? "Strong buying intent" : "Buying intent signal",
        points: buying * 2,
        occurredAt,
        source: "email",
        text,
      })
    }

    const sentiment = sentimentFromText(text)
    if (sentiment !== 0) {
      signals.push({
        kind: sentiment > 0 ? "positive_sentiment" : "negative_sentiment",
        label: sentiment > 0 ? "Positive sentiment" : "Negative sentiment",
        points: sentiment * 4,
        occurredAt,
        source: "email",
        text,
      })
    }
  }

  const { data: sentEvents } = await admin
    .schema("growth")
    .from("message_events")
    .select("occurred_at")
    .eq("lead_id", lead.id)
    .eq("event_type", "sent")
    .gte("occurred_at", since180d)
    .order("occurred_at", { ascending: false })

  for (const reply of replies) {
    if (!reply.receivedAt) continue
    const sentBefore = (sentEvents ?? [])
      .map((row) => row.occurred_at as string)
      .filter((sentAt) => sentAt <= reply.receivedAt)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
    if (sentBefore) {
      replyLatenciesMs.push(Date.parse(reply.receivedAt) - Date.parse(sentBefore))
    }
  }

  const { data: callSessions } = await admin
    .schema("growth")
    .from("call_copilot_sessions")
    .select(
      "id, started_at, ended_at, status, suggested_disposition, post_call_summary, detected_objections, live_notes",
    )
    .eq("lead_id", lead.id)
    .gte("created_at", since180d)
    .order("created_at", { ascending: false })

  for (const session of callSessions ?? []) {
    if (session.status === "discarded") continue
    const occurredAt = (session.ended_at ?? session.started_at ?? since180d) as string
    const disposition = session.suggested_disposition as string | null
    let points = 10
    if (disposition === "interested") points = 22
    else if (disposition === "follow_up_later") points = 8
    else if (disposition === "not_a_fit") points = -18
    else if (disposition === "no_answer" || disposition === "left_voicemail") points = 2

    const summaryText =
      (session.post_call_summary as string | null) ?? (session.live_notes as string | null)

    signals.push({
      kind: `call_${disposition ?? "completed"}`,
      label: `Call: ${(disposition ?? "completed").replace(/_/g, " ")}`,
      points,
      occurredAt,
      source: "call",
      text: summaryText,
    })

    if (summaryText) {
      for (const competitor of detectCompetitors(summaryText)) {
        signals.push({
          kind: `competitor_${competitor.toLowerCase().replace(/\s+/g, "_")}`,
          label: `Competitor mention (call): ${competitor}`,
          points: -5,
          occurredAt,
          source: "call",
          text: summaryText,
        })
      }
    }

    const detectedObjections = Array.isArray(session.detected_objections)
      ? (session.detected_objections as Array<{ input?: string; capturedAt?: string; frameworkKey?: string }>)
      : []
    for (const objection of detectedObjections) {
      const capturedAt = objection.capturedAt ?? occurredAt
      const objectionKey =
        objection.frameworkKey && GROWTH_CONVERSATION_OBJECTION_KEYS.includes(
          objection.frameworkKey as GrowthConversationObjectionKey,
        )
          ? objection.frameworkKey
          : classifyObjection(objection.input ?? "")
      if (!objectionKey) continue
      signals.push({
        kind: `objection_${objectionKey}`,
        label: `Call objection: ${String(objectionKey).replace(/_/g, " ")}`,
        points: -8,
        occurredAt: capturedAt,
        source: "call",
        text: objection.input ?? null,
      })
    }
  }

  if (lead.notes?.trim()) {
    signals.push({
      kind: "manual_notes",
      label: "Rep notes on file",
      points: 4,
      occurredAt: lead.updatedAt,
      source: "notes",
      text: lead.notes,
    })
  }

  signals.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))

  return {
    leadId: lead.id,
    isSuppressed: lead.contactTemperature === "suppressed" || emailSummary.isSuppressed,
    notInterested:
      lead.status === "disqualified" ||
      replies.some((reply) => reply.classification === "not_interested"),
    notes: lead.notes,
    signals,
    replyLatenciesMs,
    previousScore: lead.conversationPreviousScore,
    previousTrend: lead.conversationTrend,
    relationshipTrend: lead.relationshipTrend,
    now,
  }
}
