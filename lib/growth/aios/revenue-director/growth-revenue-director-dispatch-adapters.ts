/** GE-AI-3C — Revenue Director dispatch adapters (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  publishCommunicationPlanGeneratedEvent,
  requestGrowthCommunicationPlan,
} from "@/lib/growth/aios/communication/growth-communication-engine-service"
import { runAutonomousOutreachPreparationManualRequest } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service"
import { runAutonomousQualificationManualEvaluation } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-service"
import { runAutonomousResearchManualRefresh } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-service"
import type { GrowthRevenueDirectorWorkflowRequestRecord } from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"
import type {
  GrowthRevenueDirectorDispatchAdapterResult,
  GrowthRevenueDirectorDispatchableRequestType,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-types"
import { resolveDispatchTargetAgent } from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-types"

const HUMAN_APPROVAL_CENTER_ROUTE = "/growth/os/approvals"

export async function runRevenueDirectorDispatchAdapter(
  admin: SupabaseClient,
  input: {
    organizationId: string
    request: GrowthRevenueDirectorWorkflowRequestRecord
    occurredAt: string
  },
): Promise<GrowthRevenueDirectorDispatchAdapterResult> {
  const requestType = input.request.requestType as GrowthRevenueDirectorDispatchableRequestType
  const targetAgent = resolveDispatchTargetAgent(requestType)
  if (!targetAgent) {
    throw new Error("dispatch_adapter_not_found")
  }

  switch (requestType) {
    case "run_research": {
      if (!input.request.leadId) throw new Error("lead_id_required")
      await runAutonomousResearchManualRefresh(admin, {
        organizationId: input.organizationId,
        leadId: input.request.leadId,
        generatedAt: input.occurredAt,
      })
      return {
        ok: true,
        targetAgent,
        requestType,
        references: [
          {
            kind: "lead",
            id: input.request.leadId,
            label: "Research Agent manual refresh",
          },
        ],
        completed: true,
        sendOccurred: false,
        transportBlocked: true,
        summary: "Research Agent refresh dispatched — no provider outbound.",
      }
    }
    case "rerun_qualification": {
      if (!input.request.leadId) throw new Error("lead_id_required")
      await runAutonomousQualificationManualEvaluation(admin, {
        organizationId: input.organizationId,
        leadId: input.request.leadId,
        generatedAt: input.occurredAt,
      })
      return {
        ok: true,
        targetAgent,
        requestType,
        references: [
          {
            kind: "lead",
            id: input.request.leadId,
            label: "Qualification Agent evaluation",
          },
        ],
        completed: true,
        sendOccurred: false,
        transportBlocked: true,
        summary: "Qualification Agent evaluation dispatched — no transport.",
      }
    }
    case "request_communication_plan": {
      const subjectType = input.request.leadId
        ? "lead"
        : input.request.objectiveId
          ? "objective"
          : input.request.missionId
            ? "mission"
            : null
      const subjectId =
        input.request.leadId ?? input.request.objectiveId ?? input.request.missionId ?? null
      if (!subjectType || !subjectId) throw new Error("communication_subject_required")

      const plan = requestGrowthCommunicationPlan({
        organizationId: input.organizationId,
        subject: { type: subjectType, id: subjectId },
        generatedAt: input.occurredAt,
      })
      await publishCommunicationPlanGeneratedEvent(admin, {
        organizationId: input.organizationId,
        plan,
        generatedAt: input.occurredAt,
      })
      return {
        ok: true,
        targetAgent,
        requestType,
        references: [
          {
            kind: "communication_plan",
            id: plan.id,
            label: plan.recommendedStrategy,
            route: plan.routeHints[0]?.href ?? null,
          },
        ],
        completed: true,
        sendOccurred: false,
        transportBlocked: true,
        summary: "Communication Engine plan generated — planning only, no send.",
      }
    }
    case "generate_outreach": {
      if (!input.request.leadId) throw new Error("lead_id_required")
      const readModel = await runAutonomousOutreachPreparationManualRequest(admin, {
        organizationId: input.organizationId,
        leadId: input.request.leadId,
        generatedAt: input.occurredAt,
      })
      const latestRun = readModel.recentRuns.find((row) => row.leadId === input.request.leadId)
      return {
        ok: true,
        targetAgent,
        requestType,
        references: [
          {
            kind: "outreach_preparation_run",
            id: latestRun?.runId ?? input.request.leadId,
            label: latestRun?.packageId ?? "Outreach preparation package",
          },
        ],
        completed: latestRun?.outcome === "completed",
        sendOccurred: false,
        transportBlocked: true,
        summary: "Outreach Preparation Agent dispatched — draft only, pending human approval.",
      }
    }
    case "review_approval_queue": {
      return {
        ok: true,
        targetAgent,
        requestType,
        references: [
          {
            kind: "route",
            id: HUMAN_APPROVAL_CENTER_ROUTE,
            label: "Human Approval Center",
            route: input.request.route ?? HUMAN_APPROVAL_CENTER_ROUTE,
          },
        ],
        completed: true,
        sendOccurred: false,
        transportBlocked: true,
        summary: "Routed operator to Human Approval Center — no workflow execution.",
      }
    }
    default:
      throw new Error("dispatch_adapter_not_found")
  }
}
