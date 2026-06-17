/** Client-safe call communication read model for Inbox convergence (Phase 7K). */

import type { NativeCallWorkspaceSessionPublicView, NativeDialerQueueItemPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import type { OperatorInboxItem } from "@/lib/growth/operator-inbox/operator-inbox-types"
import {
  growthWorkspaceCallWorkspaceHref,
  growthWorkspaceCallsCoachingHref,
} from "@/lib/growth/navigation/growth-call-notification-links"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export { growthWorkspaceCallWorkspaceHref, growthWorkspaceCallsCoachingHref }

export const GROWTH_INBOX_CALL_COMMUNICATION_READ_MODEL_QA_MARKER =
  "growth-inbox-call-communication-read-model-v1" as const

export const GROWTH_INBOX_CALL_COMMUNICATION_KINDS = [
  "call_follow_up",
  "callback_requested",
  "voicemail",
  "missed_call",
] as const

export type GrowthInboxCallCommunicationKind = (typeof GROWTH_INBOX_CALL_COMMUNICATION_KINDS)[number]

export const GROWTH_INBOX_CALL_QUEUE_VIEWS = [
  "call_follow_up",
  "callback_requested",
  "voicemail",
] as const

export type GrowthInboxCallQueueView = (typeof GROWTH_INBOX_CALL_QUEUE_VIEWS)[number]

export const GROWTH_INBOX_CALL_QUEUE_VIEW_LABELS: Record<GrowthInboxCallQueueView, string> = {
  call_follow_up: "Call Follow-Ups",
  callback_requested: "Callbacks",
  voicemail: "Voicemails",
}

export const GROWTH_INBOX_CALL_COMMUNICATION_KIND_LABELS: Record<GrowthInboxCallCommunicationKind, string> = {
  call_follow_up: "Call follow-up",
  callback_requested: "Callback requested",
  voicemail: "Voicemail",
  missed_call: "Missed call",
}

export type GrowthInboxCallCommunicationItem = {
  qaMarker: typeof GROWTH_INBOX_CALL_COMMUNICATION_READ_MODEL_QA_MARKER
  id: string
  kind: GrowthInboxCallCommunicationKind
  leadId: string
  companyName: string
  title: string
  summary: string
  priorityScore: number
  occurredAt: string
  ctaHref: string
  source: "native_dialer_queue" | "native_call_session" | "operator_inbox"
  sourceRef: string
}

export function isGrowthInboxCallQueueView(view: string): view is GrowthInboxCallQueueView {
  return (GROWTH_INBOX_CALL_QUEUE_VIEWS as readonly string[]).includes(view)
}

function mapDialerQueueKind(item: NativeDialerQueueItemPublicView): GrowthInboxCallCommunicationKind {
  if (item.queueMode === "callback") return "callback_requested"
  if (item.queueMode === "missed_callback") return "missed_call"
  if (/voicemail/i.test(item.reason)) return "voicemail"
  return "call_follow_up"
}

export function adaptNativeDialerQueueItem(
  item: NativeDialerQueueItemPublicView,
): GrowthInboxCallCommunicationItem {
  const kind = mapDialerQueueKind(item)
  return {
    qaMarker: GROWTH_INBOX_CALL_COMMUNICATION_READ_MODEL_QA_MARKER,
    id: `dialer-queue:${item.id}`,
    kind,
    leadId: item.leadId,
    companyName: item.companyName ?? item.contactName ?? "Lead",
    title: item.companyName ?? item.contactName ?? "Call queue item",
    summary: item.reason,
    priorityScore: item.priorityScore,
    occurredAt: item.callbackDueAt ?? new Date().toISOString(),
    ctaHref: growthWorkspaceCallWorkspaceHref({
      leadId: item.leadId,
      phone: item.phoneNumber,
      queueItemId: item.id,
      dialMode: item.queueMode,
    }),
    source: "native_dialer_queue",
    sourceRef: item.id,
  }
}

export function adaptNativeCallSession(
  session: NativeCallWorkspaceSessionPublicView,
): GrowthInboxCallCommunicationItem | null {
  if (session.status !== "missed" && session.status !== "no_answer") return null
  return {
    qaMarker: GROWTH_INBOX_CALL_COMMUNICATION_READ_MODEL_QA_MARKER,
    id: `call-session:${session.id}`,
    kind: "missed_call",
    leadId: session.leadId ?? "",
    companyName: session.companyName ?? session.contactName ?? "Lead",
    title: session.companyName ?? session.contactName ?? "Missed call",
    summary: session.safeSummary || `Call ${session.status.replace(/_/g, " ")}`,
    priorityScore: 60,
    occurredAt: session.endedAt ?? session.startedAt,
    ctaHref: growthWorkspaceCallWorkspaceHref({ leadId: session.leadId, phone: session.phoneNumber }),
    source: "native_call_session",
    sourceRef: session.id,
  }
}

export function adaptOperatorInboxCallItem(item: OperatorInboxItem): GrowthInboxCallCommunicationItem | null {
  if (!item.lead_id) return null
  const haystack = `${item.title} ${item.description} ${item.reasoning.join(" ")}`.toLowerCase()
  let kind: GrowthInboxCallCommunicationKind | null = null
  if (/voicemail/.test(haystack)) kind = "voicemail"
  else if (/callback|call back|missed/.test(haystack)) kind = "callback_requested"
  else if (/call follow|follow-up|follow up|manual_call|call task|call-now/.test(haystack)) kind = "call_follow_up"
  else if (item.source === "human_approval" && /call/.test(haystack)) kind = "call_follow_up"
  if (!kind) return null

  return {
    qaMarker: GROWTH_INBOX_CALL_COMMUNICATION_READ_MODEL_QA_MARKER,
    id: `operator-inbox:${item.item_id}`,
    kind,
    leadId: item.lead_id,
    companyName: item.company_name ?? "Lead",
    title: item.title,
    summary: item.description,
    priorityScore: item.confidence,
    occurredAt: item.occurred_at,
    ctaHref:
      item.cta_href?.replace("/admin/growth/calls/workspace", growthWorkspaceCallWorkspaceHref()) ??
      growthWorkspaceCallWorkspaceHref({ leadId: item.lead_id }),
    source: "operator_inbox",
    sourceRef: item.source_ref,
  }
}

export function mergeGrowthInboxCallCommunicationItems(
  items: GrowthInboxCallCommunicationItem[],
): GrowthInboxCallCommunicationItem[] {
  const byKey = new Map<string, GrowthInboxCallCommunicationItem>()
  for (const item of items) {
    if (!item.leadId) continue
    const key = `${item.kind}:${item.leadId}:${item.sourceRef}`
    const existing = byKey.get(key)
    if (!existing || item.priorityScore > existing.priorityScore) byKey.set(key, item)
  }
  return [...byKey.values()].sort((a, b) => b.priorityScore - a.priorityScore)
}

export function filterCallCommunicationsByQueueView(
  items: GrowthInboxCallCommunicationItem[],
  view: GrowthInboxCallQueueView,
): GrowthInboxCallCommunicationItem[] {
  switch (view) {
    case "callback_requested":
      return items.filter((item) => item.kind === "callback_requested" || item.kind === "missed_call")
    case "voicemail":
      return items.filter((item) => item.kind === "voicemail")
    case "call_follow_up":
      return items.filter((item) => item.kind === "call_follow_up")
    default:
      return items
  }
}

export function countCallCommunicationsByQueueView(
  items: GrowthInboxCallCommunicationItem[],
): Record<GrowthInboxCallQueueView, number> {
  return GROWTH_INBOX_CALL_QUEUE_VIEWS.reduce(
    (counts, view) => {
      counts[view] = filterCallCommunicationsByQueueView(items, view).length
      return counts
    },
    {} as Record<GrowthInboxCallQueueView, number>,
  )
}

export type GrowthInboxCallCommunicationMetrics = {
  callbacks: number
  voicemails: number
  missedCalls: number
  callFollowUps: number
}

export function deriveGrowthInboxCallCommunicationMetrics(
  items: GrowthInboxCallCommunicationItem[],
): GrowthInboxCallCommunicationMetrics {
  return {
    callbacks: items.filter((item) => item.kind === "callback_requested").length,
    voicemails: items.filter((item) => item.kind === "voicemail").length,
    missedCalls: items.filter((item) => item.kind === "missed_call").length,
    callFollowUps: items.filter((item) => item.kind === "call_follow_up").length,
  }
}
