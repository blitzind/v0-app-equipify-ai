/**
 * GE-AIOS-16X — Client-safe Home runtime presentation (no internal engine names).
 */

import type { GrowthHomeLeadPoolSummary } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import { relationshipStageLabel } from "@/lib/growth/lead-memory/memory-types"
import {
  AVA_OPERATING_PHASE_LABELS,
  AVA_OPERATING_PHASE_ORDER,
  type AvaOperatingPhaseEntry,
} from "@/lib/growth/operating-rhythm/types"
import type { AvaRelationshipGraphContext } from "@/lib/growth/relationship/relationship-graph-types"
import type {
  RelationshipLeadSnapshot,
  RelationshipLeadSnapshotMap,
} from "@/lib/growth/relationship/relationship-lead-snapshot-types"
import { buildSpecialistTeamStatus } from "@/lib/growth/specialists/bridges/work-manager-bridge"
import type { AvaSpecialistTeamStatus } from "@/lib/growth/specialists/types"
import type { AvaSpecialistId } from "@/lib/growth/specialists/types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import type { GrowthHomeWaitingOnYouItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

export const GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER =
  "ge-aios-16x-home-runtime-integration-v1" as const

export const GROWTH_HOME_CANONICAL_RUNTIME_CLEANUP_17E_QA_MARKER =
  "ge-aios-17e-home-canonical-runtime-cleanup-v1" as const

export const HOME_RUNTIME_EMPTY_WORK_MESSAGE = "I'm getting today's work organized." as const
export const HOME_RUNTIME_EMPTY_MEMORY_MESSAGE =
  "I'll start learning from outcomes as work progresses." as const
export const HOME_RUNTIME_EMPTY_PROGRESS_MESSAGE =
  "I'm lining up today's operating rhythm as work comes in." as const

const SPECIALIST_DISPLAY_NAMES: Record<AvaSpecialistId, string> = {
  sales: "Sales Specialist",
  marketing: "Marketing Specialist",
  customer_success: "Customer Success Specialist",
  service: "Service Specialist",
  finance: "Finance Specialist",
}

const STUB_SPECIALIST_AVAILABILITY: Partial<Record<AvaSpecialistId, string>> = {
  marketing: "Available when marketing is enabled",
  customer_success: "Available when customer success is enabled",
  service: "Available when service is enabled",
  finance: "Available when finance is enabled",
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US")
}

export function buildHomeRelationshipScaleLine(
  leadPool: GrowthHomeLeadPoolSummary | null | undefined,
  context?: {
    relationshipSnapshotCount?: number
    leadsNeedingAction?: number
  },
): string | null {
  if (leadPool && !leadPool.degraded) {
    const visible = leadPool.visible_count
    const total = leadPool.total_estimated_count
    const snapshots = leadPool.relationship_snapshot_count

    if (total != null && total > visible) {
      return `I'm managing ${formatCount(visible)} visible relationships, with about ${formatCount(total)} total in the pipeline.`
    }

    if (leadPool.has_more) {
      return `I'm planning from the first ${formatCount(visible)} relationships. More are available as we continue scaling.`
    }

    if (visible > 0 && snapshots > 0) {
      return `Relationship context is available for ${formatCount(snapshots)} active account${snapshots === 1 ? "" : "s"}.`
    }

    if (visible > 0) {
      return `I'm currently managing ${formatCount(visible)} active relationship${visible === 1 ? "" : "s"}.`
    }
  }

  const snapshotCount = Math.max(
    context?.relationshipSnapshotCount ?? 0,
    leadPool?.relationship_snapshot_count ?? 0,
  )
  if (snapshotCount > 0) {
    return `Relationship context is available for ${formatCount(snapshotCount)} active account${snapshotCount === 1 ? "" : "s"}.`
  }

  const attention = Math.max(context?.leadsNeedingAction ?? 0, 0)
  if (attention > 0) {
    return `I'm tracking ${formatCount(attention)} relationship${attention === 1 ? "" : "s"} that need attention right now.`
  }

  return null
}

export function buildHomeDefaultOperatingRhythmPhases(hour = new Date().getHours()): AvaOperatingPhaseEntry[] {
  const isMorning = hour >= 5 && hour < 12
  return AVA_OPERATING_PHASE_ORDER.map((id, index) => ({
    id,
    label: AVA_OPERATING_PHASE_LABELS[id],
    status: isMorning && index === 0 ? "active" : "pending",
    summary: null,
  }))
}

export function buildHomeDefaultSpecialistTeamStatus(): AvaSpecialistTeamStatus[] {
  return buildSpecialistTeamStatus([])
}

/** @deprecated GE-AIOS-17E — replaced by Ava Daily Activity Narrative on Home hero. */
export function buildHomeRuntimeBriefingIntro(input: {
  leadPool?: GrowthHomeLeadPoolSummary | null
  leadsNeedingAction?: number
  pendingApprovals?: number
  activeWork?: AvaWorkItem | null
  waitingCount?: number
  relationshipSnapshotCount?: number
  hasWorkPlan?: boolean
  statusLabel?: string | null
}): string[] {
  const lines: string[] = []
  const scaleLine = buildHomeRelationshipScaleLine(input.leadPool, {
    relationshipSnapshotCount: input.relationshipSnapshotCount,
    leadsNeedingAction: input.leadsNeedingAction,
  })
  if (scaleLine) lines.push(scaleLine)

  const attention = Math.max(input.leadsNeedingAction ?? 0, 0)
  if (attention > 0 && !scaleLine?.includes(formatCount(attention))) {
    lines.push(
      `I found ${formatCount(attention)} relationship${attention === 1 ? "" : "s"} that need attention on this page.`,
    )
  }

  const active = input.activeWork
  if (active) {
    const company = asString(active.company_name)
    const focus = company ? `${company}` : active.title.replace(/\.$/, "")
    const stage = formatWorkItemRelationshipStage(active.relationship_graph)
    if (stage && /approval|outreach|review/i.test(active.title)) {
      lines.push(`I'm focused on ${focus} because they're ${stage} and waiting for outreach approval.`)
    } else if (stage) {
      lines.push(`I'm currently focused on ${focus} (${stage}).`)
    } else {
      lines.push(`I'm currently focused on ${focus}.`)
    }
  } else if (!input.hasWorkPlan && asString(input.statusLabel)) {
    lines.push(HOME_RUNTIME_EMPTY_WORK_MESSAGE)
  }

  const waiting = Math.max(input.waitingCount ?? 0, input.pendingApprovals ?? 0, 0)
  if (waiting > 0) {
    lines.push(
      `Before I continue, I need your approval on ${formatCount(waiting)} item${waiting === 1 ? "" : "s"}.`,
    )
  }

  return lines.slice(0, 4)
}

export function formatWorkItemRelationshipStage(
  graph: AvaRelationshipGraphContext | null | undefined,
): string | null {
  if (!graph?.relationship_stage) return null
  return relationshipStageLabel(graph.relationship_stage).toLowerCase()
}

export function formatAssignedSpecialistLabel(
  specialistId: AvaSpecialistId | null | undefined,
): string | null {
  if (!specialistId) return null
  return SPECIALIST_DISPLAY_NAMES[specialistId] ?? null
}

export type HomeWorkItemPresentation = {
  id: string
  title: string
  href: string | null
  companyName: string | null
  specialistLabel: string | null
  relationshipStage: string | null
  nextAction: string | null
  whyItMatters: string | null
}

export function buildHomeWorkItemPresentation(item: AvaWorkItem): HomeWorkItemPresentation {
  const graph = item.relationship_graph
  const nextAction =
    asString(graph?.next_best_action?.replace(/_/g, " ")) ||
    asString(item.next_action?.replace(/_/g, " ")) ||
    null

  const whyParts: string[] = []
  if (asString(item.description)) whyParts.push(asString(item.description))
  if (graph?.next_best_action_reason) whyParts.push(asString(graph.next_best_action_reason))
  if (graph?.blocked_reason) whyParts.push(asString(graph.blocked_reason))
  if (graph?.waiting_on_operator) whyParts.push("Waiting on your decision before I can continue.")
  if (graph?.waiting_on_customer) whyParts.push("Waiting on the customer to respond.")

  return {
    id: item.id,
    title: item.title,
    href: item.href,
    companyName: asString(item.company_name) || null,
    specialistLabel: formatAssignedSpecialistLabel(item.assigned_specialist),
    relationshipStage: formatWorkItemRelationshipStage(graph),
    nextAction,
    whyItMatters: whyParts.find(Boolean) ?? item.routing_reason ?? null,
  }
}

export function buildStubSpecialistStatusLabel(input: {
  specialistId: AvaSpecialistId
  activeCount: number
  fallbackLabel: string
}): string {
  if (input.activeCount > 0) return input.fallbackLabel
  return STUB_SPECIALIST_AVAILABILITY[input.specialistId] ?? "No active work yet"
}

function parseLeadIdFromWaitingItem(item: GrowthHomeWaitingOnYouItem): string | null {
  const href = item.href ?? ""
  const match = href.match(/\/growth\/leads\/([^/?#]+)/i)
  if (match?.[1]) return decodeURIComponent(match[1])
  const idMatch = item.id.match(
    /(?:queue-(?:blocked|waiting|approval)-)?([0-9a-f-]{36})/i,
  )
  return idMatch?.[1] ?? null
}

function isGenericWaitingLabel(label: string): boolean {
  const normalized = label.toLowerCase().trim()
  return (
    /\baccount waiting\b/.test(normalized) ||
    /\baccount blocked\b/.test(normalized) ||
    /\bneeds decision\b/.test(normalized) ||
    /\breview next step for this account\b/.test(normalized) ||
    /\breview waiting work\b/.test(normalized) ||
    /^account blocked$/i.test(label.trim()) ||
    /^account waiting$/i.test(label.trim())
  )
}

function inferApprovalActionFromWaitingItem(item: GrowthHomeWaitingOnYouItem): string | null {
  const combined = `${item.label} ${item.detail ?? ""}`.toLowerCase()
  if (/outreach/.test(combined)) return "outreach"
  if (/qualif/.test(combined)) return "qualification"
  if (/approve/.test(combined)) {
    const match = item.label.match(/approve\s+([a-z][\w\s-]+?)(?:\s+for|\s*$)/i)
    if (match?.[1]) return match[1].trim().replace(/_/g, " ")
    return "approval"
  }
  if (/blocked/.test(combined)) return "blocked work"
  if (/review/.test(combined)) return "next step"
  return null
}

function resolveWaitingCompanyName(
  item: GrowthHomeWaitingOnYouItem,
  leadId: string | null,
  companyNamesByLeadId?: Record<string, string | null>,
): string | null {
  if (leadId && companyNamesByLeadId?.[leadId]?.trim()) {
    return companyNamesByLeadId[leadId]!.trim()
  }
  return extractCompanyFromWaitingLabel(item.label)
}

function buildGenericWaitingLabel(
  item: GrowthHomeWaitingOnYouItem,
  companyName: string | null,
  snapshot: RelationshipLeadSnapshot | null,
): GrowthHomeWaitingOnYouItem {
  const action =
    snapshot?.next_best_action?.replace(/_/g, " ") ?? inferApprovalActionFromWaitingItem(item)
  const stage = snapshot?.relationship_stage
    ? relationshipStageLabel(snapshot.relationship_stage).toLowerCase()
    : null

  if (companyName && action) {
    return {
      ...item,
      label: `Review ${action} for ${companyName}`,
      detail:
        item.detail ||
        asString(snapshot?.next_best_action_reason) ||
        asString(snapshot?.conversation_timeline_summary) ||
        "Open this item to continue.",
    }
  }

  if (companyName) {
    return {
      ...item,
      label: stage ? `Review next step for ${companyName} (${stage})` : `Review next step for ${companyName}`,
      detail:
        item.detail ||
        asString(snapshot?.next_best_action_reason) ||
        asString(snapshot?.conversation_timeline_summary) ||
        "Open this item to continue.",
    }
  }

  if (action) {
    return {
      ...item,
      label: `Review ${action}`,
      detail: item.detail || "Open this item to continue.",
    }
  }

  return {
    ...item,
    label: "Review pending approval",
    detail: item.detail || "Open this item to continue.",
  }
}

export function enrichGrowthHomeWaitingOnYouItem(
  item: GrowthHomeWaitingOnYouItem,
  snapshotsById?: RelationshipLeadSnapshotMap,
  companyNamesByLeadId?: Record<string, string | null>,
): GrowthHomeWaitingOnYouItem {
  const leadId = parseLeadIdFromWaitingItem(item)
  const snapshot = leadId ? snapshotsById?.[leadId] ?? null : null
  const companyName = resolveWaitingCompanyName(item, leadId, companyNamesByLeadId)

  if (snapshot) {
    const name = companyName ?? null
    if (/approve|approval|outreach|review/i.test(item.label)) {
      const action = snapshot.next_best_action?.replace(/_/g, " ") ?? "outreach"
      return {
        ...item,
        label: name ? `Review ${action} for ${name}` : `Review ${action}`,
        detail:
          item.detail ||
          asString(snapshot.next_best_action_reason) ||
          asString(snapshot.conversation_timeline_summary) ||
          "",
      }
    }
    if (/qualif/i.test(item.label)) {
      return {
        ...item,
        label: name ? `Approve qualification for ${name}` : "Approve qualification",
        detail: item.detail || asString(snapshot.next_best_action_reason) || "",
      }
    }
    if (/blocked/i.test(item.label)) {
      return {
        ...item,
        label: name ? `Review blocked work for ${name}` : "Review blocked work",
        detail: item.detail || asString(snapshot.blocked_reason) || "",
      }
    }
    if (isGenericWaitingLabel(item.label)) {
      return buildGenericWaitingLabel(item, name, snapshot)
    }
  }

  if (isGenericWaitingLabel(item.label)) {
    return buildGenericWaitingLabel(item, companyName, snapshot)
  }

  if (/^Approve account /i.test(item.label)) {
    return {
      ...item,
      label: item.label.replace(/^Approve account /i, "Approve "),
    }
  }

  if (/business understanding|business profile/i.test(item.label + (item.detail ?? ""))) {
    return {
      ...item,
      label: "Review business understanding",
      detail: item.detail ?? "Confirm how I should position your business in outreach.",
    }
  }

  return item
}

function extractCompanyFromWaitingLabel(label: string): string | null {
  const blocked = label.match(/^(.+?)\s+blocked$/i)
  if (blocked?.[1] && !/^account$/i.test(blocked[1])) return blocked[1].trim()
  const waiting = label.match(/^(.+?)\s+waiting$/i)
  if (waiting?.[1] && !/^account$/i.test(waiting[1])) return waiting[1].trim()
  const approve = label.match(/^Approve\s+(.+?)\s+/i)
  if (approve?.[1] && !/^account$/i.test(approve[1])) return approve[1].trim()
  return null
}

export function enrichGrowthHomeWaitingOnYouItems(
  items: GrowthHomeWaitingOnYouItem[] | null | undefined,
  snapshotsById?: RelationshipLeadSnapshotMap,
  companyNamesByLeadId?: Record<string, string | null>,
): GrowthHomeWaitingOnYouItem[] {
  return (items ?? []).map((item) =>
    enrichGrowthHomeWaitingOnYouItem(item, snapshotsById, companyNamesByLeadId),
  )
}
