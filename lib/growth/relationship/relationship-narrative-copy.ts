/** GE-AIOS-15D — Relationship-aware narrative copy (client-safe). */

import type { AvaRelationshipGraphContext } from "@/lib/growth/relationship/relationship-graph-types"
import { relationshipStageLabel } from "@/lib/growth/lead-memory/memory-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function daysSince(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.floor((nowMs - parsed) / (1000 * 60 * 60 * 24)))
}

export function formatRelationshipStageClause(graph: AvaRelationshipGraphContext | null | undefined): string | null {
  if (!graph?.relationship_stage) return null
  return relationshipStageLabel(graph.relationship_stage).toLowerCase()
}

export function buildRelationshipContextClause(
  graph: AvaRelationshipGraphContext | null | undefined,
  companyName?: string | null,
  nowMs = Date.now(),
): string | null {
  if (!graph) return null

  const company = asString(companyName) || "this account"
  const stage = formatRelationshipStageClause(graph)
  const hasConversation = Boolean(
    graph.latest_conversation_thread_id || graph.conversation_thread_id || graph.latest_reply_at,
  )

  if (graph.waiting_on_operator && graph.next_best_action) {
    const nba = graph.next_best_action.replace(/_/g, " ")
    return `${company} is ${stage ?? "in progress"} and waiting for ${nba}.`
  }

  if (hasConversation && graph.latest_reply_at) {
    const days = daysSince(graph.latest_reply_at, nowMs)
    const replyAge =
      days == null ? "recently" : days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`
    if (graph.waiting_on_customer) {
      return `${company} replied ${replyAge}, and I'm waiting on the customer.`
    }
    return `${company} replied ${replyAge}${stage ? ` — relationship stage: ${stage}` : ""}.`
  }

  if (stage && !hasConversation) {
    return `I don't have conversation history for ${company} yet, so I'm still in the ${stage} stage.`
  }

  if (stage && graph.next_best_action) {
    return `${company} is ${stage} — next best action: ${graph.next_best_action.replace(/_/g, " ")}.`
  }

  if (stage) {
    return `${company} is in the ${stage} stage.`
  }

  return null
}

export function buildSalesSpecialistRelationshipSuffix(
  graph: AvaRelationshipGraphContext | null | undefined,
  nowMs = Date.now(),
): string {
  const parts: string[] = []
  const stage = formatRelationshipStageClause(graph)
  if (stage) parts.push(`${stage} relationship`)

  const hasConversation = Boolean(graph?.latest_conversation_thread_id || graph?.latest_reply_at)
  if (graph?.latest_reply_at) {
    const days = daysSince(graph.latest_reply_at, nowMs)
    if (days != null) {
      parts.push(`last reply ${days === 0 ? "today" : `${days}d ago`}`)
    }
  } else if (!hasConversation && graph?.relationship_stage) {
    parts.push("no conversation yet")
  }

  if (graph?.waiting_on_customer) parts.push("waiting on customer")
  if (graph?.waiting_on_operator) parts.push("waiting on operator")

  if (graph?.next_best_action) {
    parts.push(`next: ${graph.next_best_action.replace(/_/g, " ")}`)
  }

  return parts.length > 0 ? ` (${parts.join(", ")})` : ""
}
