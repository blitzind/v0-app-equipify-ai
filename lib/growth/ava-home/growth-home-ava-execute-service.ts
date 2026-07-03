/** GE-AVA-HOME-EXECUTION-1A — Ava Home safe lead execution service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import { listAiWorkOrders } from "@/lib/growth/aios/ai-work-order-repository"
import { isAiWorkOrderTerminalStatus } from "@/lib/growth/aios/ai-work-order-types"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import {
  fetchLeadResearchPilotObservation,
} from "@/lib/growth/aios/pilot/lead-research-pilot-observability"
import {
  scheduleLeadResearchPilotForProspect,
} from "@/lib/growth/aios/pilot/lead-research-pilot-orchestrator"
import { isLeadResearchPilotEnabled } from "@/lib/growth/aios/pilot/lead-research-pilot-config"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import type {
  GrowthHomeAvaExecuteAction,
  GrowthHomeAvaExecuteStatus,
} from "@/lib/growth/ava-home/growth-home-ava-execute-api-contract"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  buildOpportunityIntelligenceViewModel,
} from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-aggregator"
import { fetchActiveProspectResearchRun } from "@/lib/growth/research/research-repository"
import { runUnifiedRevenueWorkflowAfterIntake } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-intake-runner"

export type GrowthHomeAvaExecuteInput = {
  admin: SupabaseClient
  organizationId: string
  leadId: string
  action: GrowthHomeAvaExecuteAction
  reason?: string | null
  actor?: { userId: string | null; email?: string | null }
}

export type GrowthHomeAvaExecuteResult = {
  status: GrowthHomeAvaExecuteStatus
  skipReason?: string | null
  auditEventId?: string | null
  workflow?: Record<string, unknown> | null
  research?: {
    missionId?: string | null
    workOrderId?: string | null
    researchRunId?: string | null
    workflowStatus?: string | null
  } | null
  viewModel?: Awaited<ReturnType<typeof buildOpportunityIntelligenceViewModel>>
  researchStatus?: {
    available: boolean
    workflowStatus: string | null
    updatedAt: string | null
    researchRunId: string | null
  }
}

type ActiveLeadResearchState = {
  active: boolean
  status: GrowthHomeAvaExecuteStatus
  workflowStatus?: string | null
  missionId?: string | null
  workOrderId?: string | null
  researchRunId?: string | null
  detail?: string | null
}

async function resolveActiveLeadResearchState(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
): Promise<ActiveLeadResearchState> {
  const activeRun = await fetchActiveProspectResearchRun(admin, input.leadId)
  if (activeRun) {
    return {
      active: true,
      status: activeRun.status === "queued" ? "queued" : "running",
      researchRunId: activeRun.id,
      workflowStatus: activeRun.status,
      detail: "prospect_research_run_active",
    }
  }

  const workflowSnapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })
  if (workflowSnapshot?.workflowStatus === "scheduled") {
    return {
      active: true,
      status: "queued",
      workflowStatus: workflowSnapshot.workflowStatus,
      researchRunId: workflowSnapshot.researchRunId,
      detail: "workflow_scheduled",
    }
  }
  if (workflowSnapshot?.workflowStatus === "researching") {
    return {
      active: true,
      status: "running",
      workflowStatus: workflowSnapshot.workflowStatus,
      researchRunId: workflowSnapshot.researchRunId,
      detail: "workflow_researching",
    }
  }

  const workOrders = await listAiWorkOrders(admin, {
    organizationId: input.organizationId,
    workOrderType: "research_company",
    limit: 50,
  })
  const activeWorkOrder = workOrders.find(
    (row) =>
      row.entityType === "lead" &&
      row.entityId === input.leadId &&
      !isAiWorkOrderTerminalStatus(row.status),
  )
  if (activeWorkOrder) {
    return {
      active: true,
      status: "running",
      workOrderId: activeWorkOrder.id,
      missionId: activeWorkOrder.missionId,
      workflowStatus: activeWorkOrder.status,
      detail: "research_work_order_active",
    }
  }

  const observation = await fetchLeadResearchPilotObservation(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })
  if (observation.steps.some((step) => step.status === "running")) {
    return {
      active: true,
      status: "running",
      missionId: observation.missionId,
      workOrderId: observation.workOrderId,
      researchRunId: observation.researchRunId,
      workflowStatus: observation.workflowStatus ?? null,
      detail: "pilot_step_running",
    }
  }

  return { active: false, status: "completed" }
}

async function publishAvaHomeExecuteAuditEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    action: GrowthHomeAvaExecuteAction
    phase: "requested" | "completed" | "skipped" | "failed"
    status: GrowthHomeAvaExecuteStatus
    actorUserId?: string | null
    reason?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<string | null> {
  const eventType = {
    requested: "growth.ava_home.execute_requested",
    completed: "growth.ava_home.execute_completed",
    skipped: "growth.ava_home.execute_skipped",
    failed: "growth.ava_home.execute_failed",
  }[input.phase]

  const result = await publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType,
    category: "system",
    producer: "ava_home_dashboard",
    source: "ge-ava-home-execution-1a",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      action: input.action,
      execution_status: input.status,
      actor_user_id: input.actorUserId ?? null,
      reason: input.reason ?? null,
      ...(input.metadata ?? {}),
    },
  })

  return result.event.id
}

function buildResearchStatus(
  snapshot: Awaited<ReturnType<typeof fetchLatestGrowthLeadResearchWorkflowSnapshot>>,
): GrowthHomeAvaExecuteResult["researchStatus"] {
  return snapshot
    ? {
        available: true,
        workflowStatus: snapshot.workflowStatus,
        updatedAt: snapshot.updatedAt,
        researchRunId: snapshot.researchRunId,
      }
    : { available: false, workflowStatus: null, updatedAt: null, researchRunId: null }
}

export async function executeGrowthHomeAvaSafeAction(
  input: GrowthHomeAvaExecuteInput,
): Promise<GrowthHomeAvaExecuteResult> {
  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) {
    throw new Error("lead_not_found")
  }

  await publishAvaHomeExecuteAuditEvent(input.admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    action: input.action,
    phase: "requested",
    status: "queued",
    actorUserId: input.actor?.userId ?? null,
    reason: input.reason ?? null,
  })

  try {
    if (input.action === "run_unified_intake") {
      const intakeRun = await runUnifiedRevenueWorkflowAfterIntake({
        admin: input.admin,
        organizationId: input.organizationId ?? getGrowthEngineAiOrgId(),
        actor: input.actor,
        source: "manual",
        leadId: input.leadId,
        company: {
          name: lead.companyName,
          website: lead.website,
        },
        contact: {
          name: lead.contactName,
          email: lead.contactEmail,
          phone: lead.contactPhone,
        },
        metadata: {
          externalRef: lead.externalRef,
          avaHomeExecute: true,
          reason: input.reason ?? null,
        },
      })

      if (intakeRun.skipped) {
        const auditEventId = await publishAvaHomeExecuteAuditEvent(input.admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          action: input.action,
          phase: "skipped",
          status: "skipped",
          actorUserId: input.actor?.userId ?? null,
          reason: intakeRun.skipReason ?? null,
        })
        return {
          status: "skipped",
          skipReason: intakeRun.skipReason ?? null,
          auditEventId,
          workflow: null,
        }
      }

      const auditEventId = await publishAvaHomeExecuteAuditEvent(input.admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
        action: input.action,
        phase: "completed",
        status: "completed",
        actorUserId: input.actor?.userId ?? null,
        metadata: {
          lead_id: intakeRun.workflow?.leadId ?? input.leadId,
          approval_required: intakeRun.workflow?.approvalRequired ?? true,
        },
      })

      return {
        status: "completed",
        auditEventId,
        workflow: intakeRun.workflow ? { ...intakeRun.workflow } : null,
      }
    }

    if (input.action === "start_research") {
      if (!isLeadResearchPilotEnabled()) {
        const auditEventId = await publishAvaHomeExecuteAuditEvent(input.admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          action: input.action,
          phase: "skipped",
          status: "skipped",
          actorUserId: input.actor?.userId ?? null,
          reason: "lead_research_pilot_disabled",
        })
        return {
          status: "skipped",
          skipReason: "lead_research_pilot_disabled",
          auditEventId,
        }
      }

      const active = await resolveActiveLeadResearchState(input.admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
      })
      if (active.active) {
        const auditEventId = await publishAvaHomeExecuteAuditEvent(input.admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          action: input.action,
          phase: "skipped",
          status: active.status,
          actorUserId: input.actor?.userId ?? null,
          reason: active.detail ?? "research_already_active",
          metadata: {
            mission_id: active.missionId ?? null,
            work_order_id: active.workOrderId ?? null,
            research_run_id: active.researchRunId ?? null,
          },
        })
        return {
          status: active.status,
          skipReason: active.detail ?? "research_already_active",
          auditEventId,
          research: {
            missionId: active.missionId ?? null,
            workOrderId: active.workOrderId ?? null,
            researchRunId: active.researchRunId ?? null,
            workflowStatus: active.workflowStatus ?? null,
          },
        }
      }

      scheduleLeadResearchPilotForProspect(input.admin, {
        leadId: input.leadId,
        organizationId: input.organizationId,
        createdBy: input.actor?.userId ?? null,
        source: "ava_home_dashboard",
      })

      const auditEventId = await publishAvaHomeExecuteAuditEvent(input.admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
        action: input.action,
        phase: "completed",
        status: "queued",
        actorUserId: input.actor?.userId ?? null,
        reason: input.reason ?? null,
      })

      logGrowthEngine("ava_home_start_research_queued", {
        leadId: input.leadId,
        actorEmail: input.actor?.email ?? null,
      })

      return {
        status: "queued",
        auditEventId,
        research: {
          workflowStatus: "scheduled",
        },
      }
    }

    const viewModel = await buildOpportunityIntelligenceViewModel({
      admin: input.admin,
      leadId: input.leadId,
      organizationId: input.organizationId,
    })
    const researchSnapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(input.admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
    })

    const auditEventId = await publishAvaHomeExecuteAuditEvent(input.admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      action: input.action,
      phase: "completed",
      status: "completed",
      actorUserId: input.actor?.userId ?? null,
      reason: input.reason ?? null,
    })

    return {
      status: "completed",
      auditEventId,
      viewModel: viewModel ?? undefined,
      researchStatus: buildResearchStatus(researchSnapshot),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const auditEventId = await publishAvaHomeExecuteAuditEvent(input.admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      action: input.action,
      phase: "failed",
      status: "failed",
      actorUserId: input.actor?.userId ?? null,
      reason: message.slice(0, 500),
    }).catch(() => null)

    logGrowthEngine("ava_home_execute_failed", {
      leadId: input.leadId,
      action: input.action,
      message: message.slice(0, 500),
    })

    throw Object.assign(new Error(message), { auditEventId, status: "failed" as const })
  }
}
