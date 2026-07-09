/** GE-AIOS-14A — Specialist → Work Manager bridge. */

import { getSpecialistById } from "@/lib/growth/specialists/registry/specialist-registry"
import { routeWorkItem } from "@/lib/growth/specialists/router/route-work-item"
import { buildLivingSpecialistIdleLabel } from "@/lib/growth/home/growth-home-living-experience-18e"
import { buildStubSpecialistStatusLabel } from "@/lib/growth/home/growth-home-runtime-presenter"
import type { AvaWorkItem, AvaWorkManagerResult } from "@/lib/growth/work-manager/types"

export function assignSpecialistsToWorkItems(workItems: AvaWorkItem[]): AvaWorkItemWithSpecialist[] {
  return workItems.map((item) => {
    const route = routeWorkItem(item)
    return {
      ...item,
      assigned_specialist: route.specialist_id,
      specialist_confidence: route.confidence,
      routing_reason: route.reason,
      relationship_graph: item.relationship_graph
        ? {
            ...item.relationship_graph,
            assigned_specialist: route.specialist_id,
            decision_score: item.decision_score,
          }
        : null,
    }
  })
}

export function buildSpecialistContributions(items: AvaWorkItemWithSpecialist[]): AvaSpecialistContribution[] {
  return items.map((item) => {
    const specialist = getSpecialistById(item.assigned_specialist)
    return {
      specialist_id: item.assigned_specialist,
      specialist_name: specialist.definition.name,
      work_item_id: item.id,
      confidence: item.specialist_confidence,
      routing_reason: item.routing_reason,
      summary: specialist.summarizeContribution(item),
      stub: specialist.definition.stub,
    }
  })
}

export function buildSpecialistTeamStatus(
  items: AvaWorkItemWithSpecialist[],
  options?: { workManagerResult?: AvaWorkManagerResult | null },
): AvaSpecialistTeamStatus[] {
  const definitions = [
    getSpecialistById("sales"),
    getSpecialistById("marketing"),
    getSpecialistById("customer_success"),
    getSpecialistById("service"),
    getSpecialistById("finance"),
  ]

  return definitions.map((specialist) => {
    const assigned = items.filter((row) => row.assigned_specialist === specialist.definition.id)
    const active = assigned.filter((row) => row.status === "working" || row.status === "ready" || row.status === "planned")

    let status_label = specialist.definition.stub
      ? buildStubSpecialistStatusLabel({
          specialistId: specialist.definition.id,
          activeCount: active.length,
          fallbackLabel: "Preparing work for when this capability is enabled",
        })
      : "No active work yet"

    if (!specialist.definition.stub) {
      if (specialist.definition.id === "sales" && active.some((row) => row.type === "research")) {
        status_label = "Researching companies"
      } else if (specialist.definition.id === "sales" && active.some((row) => row.type === "outreach")) {
        status_label = "Preparing outreach"
      } else if (
        specialist.definition.id === "sales" &&
        active.some((row) => row.type === "approval" || row.status === "blocked")
      ) {
        status_label = "Waiting for your approval"
      } else if (specialist.definition.id === "sales" && active.some((row) => row.type === "reply")) {
        status_label = "Following up on replies"
      } else if (specialist.definition.id === "sales" && active.length > 0) {
        status_label = "Working sales pipeline"
      } else if (specialist.definition.id === "customer_success" && active.length > 0) {
        status_label = "Monitoring customers"
      } else if (specialist.definition.id === "marketing" && active.length > 0) {
        status_label = "Identifying campaign opportunities"
      } else if (specialist.definition.id === "finance" && active.length > 0) {
        status_label = "Reviewing invoices and payments"
      } else if (specialist.definition.id === "service" && active.length > 0) {
        status_label = "Reviewing schedules and work orders"
      } else if (active.length === 0) {
        const approvalWaiting = Boolean(
          options?.workManagerResult?.operator_queue.some((row) => row.type === "approval"),
        )
        const hasResearchWork = items.some(
          (row) =>
            row.assigned_specialist === specialist.definition.id &&
            (row.type === "research" || row.status === "ready" || row.status === "planned"),
        )
        status_label = buildLivingSpecialistIdleLabel({
          specialistId: specialist.definition.id,
          activeCount: 0,
          isStub: false,
          hasApprovalWaiting: specialist.definition.id === "sales" && approvalWaiting,
          hasResearchWork: specialist.definition.id === "sales" && hasResearchWork,
        })
      }
    }

    return {
      specialist_id: specialist.definition.id,
      specialist_name: specialist.definition.name,
      status_label,
      active_count: active.length,
      is_stub: specialist.definition.stub,
    }
  })
}

export function applySpecialistRoutingToWorkManagerResult(
  result: AvaWorkManagerResult,
  routedItems: AvaWorkItemWithSpecialist[],
): AvaWorkManagerResult {
  const byId = new Map(routedItems.map((row) => [row.id, row]))

  const mapItem = (item: AvaWorkItem): AvaWorkItem => byId.get(item.id) ?? item

  return {
    ...result,
    active_work: result.active_work ? mapItem(result.active_work) : null,
    blocked: result.blocked.map(mapItem),
    completed_today: result.completed_today.map(mapItem),
    deferred: result.deferred.map(mapItem),
    operator_queue: result.operator_queue.map(mapItem),
    all_work_items: result.all_work_items.map(mapItem),
  }
}
