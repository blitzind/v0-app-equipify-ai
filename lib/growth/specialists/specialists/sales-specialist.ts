/** GE-AIOS-14A / GE-AIOS-15B — Sales Specialist (active revenue growth work). */

import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import type { AvaSpecialistDefinition } from "@/lib/growth/specialists/types"
import { buildSalesSpecialistRelationshipSuffix } from "@/lib/growth/relationship/relationship-narrative-copy"

export const SALES_SPECIALIST: AvaSpecialistDefinition = {
  id: "sales",
  name: "Sales Specialist",
  domain: "revenue_growth",
  capabilities: [
    "company research",
    "qualification",
    "outreach preparation",
    "meeting preparation",
    "follow-up planning",
  ],
  stub: false,
}

const SALES_WORK_TYPES = new Set([
  "research",
  "qualification",
  "outreach",
  "meeting",
  "reply",
  "approval",
])

export function salesSpecialistAcceptsWork(item: AvaWorkItem): boolean {
  if (SALES_WORK_TYPES.has(item.type)) return true
  if (item.type === "mission" && /research|qualif|outreach|pipeline|lead|company/i.test(item.title)) return true
  return false
}

export function salesSpecialistEstimateConfidence(item: AvaWorkItem): number {
  let confidence = 72
  if (item.type === "research") confidence += 10
  if (item.type === "qualification") confidence += 8
  if (item.type === "outreach") confidence += 6
  if (typeof item.confidence === "number") {
    confidence = Math.round(confidence * 0.6 + item.confidence * 0.4)
  }
  return Math.min(98, Math.max(55, confidence))
}

export function salesSpecialistSummarizeContribution(item: AvaWorkItem): string {
  const graph = item.relationship_graph
  const relationshipLabel = buildSalesSpecialistRelationshipSuffix(graph)

  const action = item.title.replace(/\.$/, "").toLowerCase()
  if (item.type === "research") {
    return graph && !graph.latest_conversation_thread_id && !graph.latest_reply_at
      ? `Researching ${item.company_name ?? "companies"} — no conversation yet${relationshipLabel}.`
      : `Researching companies — ${action}${relationshipLabel}.`
  }
  if (item.type === "qualification") return `Qualifying opportunities — ${action}${relationshipLabel}.`
  if (item.type === "outreach") {
    return graph?.waiting_on_operator
      ? `Waiting on outreach approval — ${action}${relationshipLabel}.`
      : `Preparing outreach — ${action}${relationshipLabel}.`
  }
  if (item.type === "meeting") return `Preparing meetings — ${action}${relationshipLabel}.`
  if (item.type === "reply") {
    return graph?.waiting_on_customer
      ? `Following up — ${action}; waiting on customer${relationshipLabel}.`
      : `Following up on replies — ${action}${relationshipLabel}.`
  }
  if (item.type === "approval") return `Waiting on outreach approval — ${action}${relationshipLabel}.`
  return `Continuing sales work — ${action}${relationshipLabel}.`
}
