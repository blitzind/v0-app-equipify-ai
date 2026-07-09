/** GE-AIOS-14A — Sales Specialist (active revenue growth work). */

import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import type { AvaSpecialistDefinition } from "@/lib/growth/specialists/types"

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
  const action = item.title.replace(/\.$/, "").toLowerCase()
  if (item.type === "research") return `Researching companies — ${action}.`
  if (item.type === "qualification") return `Qualifying opportunities — ${action}.`
  if (item.type === "outreach") return `Preparing outreach — ${action}.`
  if (item.type === "meeting") return `Preparing meetings — ${action}.`
  if (item.type === "reply") return `Following up on replies — ${action}.`
  if (item.type === "approval") return `Waiting on outreach approval — ${action}.`
  return `Continuing sales work — ${action}.`
}
