/** GE-AIOS-14A — Deterministic work-item routing to specialists. */

import { AVA_SPECIALIST_REGISTRY } from "@/lib/growth/specialists/registry/specialist-registry"
import type { AvaSpecialistId, AvaSpecialistRouteResult } from "@/lib/growth/specialists/types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

const ROUTING_PRIORITY: AvaSpecialistId[] = [
  "finance",
  "service",
  "customer_success",
  "marketing",
  "sales",
]

function routeByKeywords(item: AvaWorkItem): AvaSpecialistId | null {
  const title = item.title.toLowerCase()
  if (/invoice|collection|payment|forecast|billing|reconcile|accounts receivable/.test(title)) return "finance"
  if (/work order|dispatch|scheduling|schedule|sla|field service|technician/.test(title)) return "service"
  if (/renewal|customer health|expansion|adoption|retention|account health/.test(title)) return "customer_success"
  if (/campaign|social|content|audience|marketing|ad recommendation/.test(title)) return "marketing"
  return null
}

function routeByWorkType(item: AvaWorkItem): AvaSpecialistId {
  switch (item.type) {
    case "research":
    case "qualification":
    case "outreach":
    case "meeting":
    case "reply":
    case "approval":
      return "sales"
    case "mission":
      return /campaign|marketing|social|content|audience/.test(item.title.toLowerCase()) ? "marketing" : "sales"
    case "business_understanding":
      return "sales"
    case "wait":
      return "sales"
    default:
      return "sales"
  }
}

function buildRoutingReason(item: AvaWorkItem, specialistId: AvaSpecialistId): string {
  const specialist = AVA_SPECIALIST_REGISTRY.find((row) => row.definition.id === specialistId)
  const name = specialist?.definition.name ?? "Sales Specialist"

  if (specialistId === "sales") {
    if (item.type === "research") return `${name} owns company research.`
    if (item.type === "qualification") return `${name} owns qualification.`
    if (item.type === "outreach") return `${name} owns outreach preparation.`
    if (item.type === "meeting") return `${name} owns meeting preparation.`
    if (item.type === "reply") return `${name} owns follow-up planning.`
    return `${name} owns revenue growth work.`
  }

  if (specialistId === "marketing") return `${name} owns campaign and audience strategy.`
  if (specialistId === "finance") return `${name} owns invoice and payment follow-up.`
  if (specialistId === "customer_success") return `${name} owns customer health and renewals.`
  if (specialistId === "service") return `${name} owns scheduling and dispatch work.`
  return `${name} is the best match for this work item.`
}

export function routeWorkItem(item: AvaWorkItem): AvaSpecialistRouteResult {
  const keywordMatch = routeByKeywords(item)
  const specialistId = keywordMatch ?? routeByWorkType(item)
  const handler = AVA_SPECIALIST_REGISTRY.find((row) => row.definition.id === specialistId) ?? AVA_SPECIALIST_REGISTRY[0]
  const accepts = handler.acceptsWork(item)
  const fallbackId = accepts ? specialistId : "sales"
  const fallbackHandler = AVA_SPECIALIST_REGISTRY.find((row) => row.definition.id === fallbackId) ?? handler

  return {
    specialist_id: fallbackId,
    confidence: fallbackHandler.estimateConfidence(item),
    reason: buildRoutingReason(item, fallbackId),
  }
}

export function routeWorkItems(items: AvaWorkItem[]): AvaSpecialistRouteResult[] {
  return items.map((item) => routeWorkItem(item))
}

export function resolveDefaultSpecialistOrder(): AvaSpecialistId[] {
  return ROUTING_PRIORITY
}
