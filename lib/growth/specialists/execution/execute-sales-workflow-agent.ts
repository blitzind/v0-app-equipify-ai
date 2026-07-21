/** GE-AIOS-18A — Sales Specialist → existing workflow agent execution (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAutonomousMeetingPilotCycle } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-service"
import { runAutonomousOutreachPreparationManualRequest } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service"
import { runAutonomousQualificationManualEvaluation } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-service"
import { executeGrowthLeadProspectResearch } from "@/lib/growth/research/growth-lead-research-execution-service"
import {
  mapMeetingRunToSalesOutcome,
  mapOutreachRunToSalesOutcome,
  mapProspectResearchExecutionToSalesOutcome,
  mapQualificationRunToSalesOutcome,
} from "@/lib/growth/specialists/execution/sales-outcome-mappers"
import type {
  SalesOutcome,
  SalesSpecialistDelegationResult,
  SalesWorkflowAgentKind,
} from "@/lib/growth/specialists/execution/sales-outcome-types"
import {
  evaluateCanonicalExecutionAuthorityForLead,
} from "@/lib/growth/aios/execution/growth-canonical-execution-authority-server-1a"
import { isCanonicalExecutionAllowed } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-1a"
import { mapAslWorkflowAgentToActionKind } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-action-policy-1a"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { assertGrowthPipelinePromotionIntegrity } from "@/lib/growth/draft-factory/growth-pipeline-promotion-integrity-2a"
import { logGrowthEngine } from "@/lib/growth/access"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

export type ExecuteSalesWorkflowAgentResult =
  | { executed: true; outcome: SalesOutcome; workflow_agent: SalesWorkflowAgentKind }
  | { executed: false; workflow_agent: SalesWorkflowAgentKind; skip_reason: string }

function findLatestRunForLead<T extends { leadId: string; completedAt: string }>(
  runs: T[],
  leadId: string,
): T | null {
  return (
    runs
      .filter((run) => run.leadId === leadId)
      .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))[0] ?? null
  )
}

export const GE_AIOS_LIVE_7C_ASL_DELEGATION_REPAIR_QA_MARKER =
  "ge-aios-live-7c-asl-delegation-research-execution-repair-v1" as const

export const GE_AIOS_HOTFIX_LIVE_8B_1_RESEARCH_ADMIN_REPAIR_QA_MARKER =
  "ge-aios-hotfix-live-8b-1-research-admin-repair-v1" as const

export async function executeSalesWorkflowAgent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workItem: AvaWorkItem
    delegation: Extract<SalesSpecialistDelegationResult, { delegated: true }>
    generatedAt: string
  },
): Promise<ExecuteSalesWorkflowAgentResult> {
  const { workItem, delegation } = input
  const { workflow_agent: workflowAgent } = delegation
  const leadId = extractLeadIdFromWorkItem(workItem)

  if (
    leadId &&
    (workflowAgent === "research_agent" || workflowAgent === "qualification_agent")
  ) {
    const authority = await evaluateCanonicalExecutionAuthorityForLead(admin, {
      organizationId: input.organizationId,
      leadId,
      actionKind: mapAslWorkflowAgentToActionKind(workflowAgent),
      generatedAt: input.generatedAt,
      bypassDecisionCache: true,
    })
    if (!isCanonicalExecutionAllowed(authority)) {
      return {
        executed: false,
        workflow_agent: workflowAgent,
        skip_reason:
          authority.disposition === "deferred"
            ? `execution_authority_deferred:${authority.reasonCode}`
            : `execution_authority_blocked:${authority.reasonCode}`,
      }
    }
  }

  switch (workflowAgent) {
    case "research_agent": {
      if (!leadId) {
        return { executed: false, workflow_agent: workflowAgent, skip_reason: "lead_id_required" }
      }
      const execution = await executeGrowthLeadProspectResearch({
        admin,
        organizationId: input.organizationId,
        leadId,
        trigger: "sales_loop",
        generatedAt: input.generatedAt,
        runQualification: true,
        aslWorkItemId: workItem.id,
      })
      const outcome = mapProspectResearchExecutionToSalesOutcome(execution, {
        workItemId: workItem.id,
        leadId,
      })
      if (!outcome) {
        return {
          executed: false,
          workflow_agent: workflowAgent,
          skip_reason:
            execution.ok === false
              ? execution.code === "research_not_needed" || execution.code === "research_fresh"
                ? "research_skipped"
                : execution.code
              : execution.outcome === "active"
                ? "research_in_progress"
                : "research_not_completed",
        }
      }
      return {
        executed: true,
        workflow_agent: workflowAgent,
        outcome,
      }
    }
    case "qualification_agent": {
      if (!leadId) {
        return { executed: false, workflow_agent: workflowAgent, skip_reason: "lead_id_required" }
      }
      const readModel = await runAutonomousQualificationManualEvaluation(admin, {
        organizationId: input.organizationId,
        leadId,
        generatedAt: input.generatedAt,
      })
      const latestRun = findLatestRunForLead(readModel.recentRuns, leadId)
      const outcome = latestRun ? mapQualificationRunToSalesOutcome(latestRun) : null
      if (!outcome) {
        return {
          executed: false,
          workflow_agent: workflowAgent,
          skip_reason:
            latestRun?.outcome === "skipped"
              ? latestRun.skipReason ?? "qualification_skipped"
              : "qualification_not_completed",
        }
      }
      return {
        executed: true,
        workflow_agent: workflowAgent,
        outcome: { ...outcome, work_item_id: workItem.id },
      }
    }
    case "outreach_agent": {
      if (!leadId) {
        return { executed: false, workflow_agent: workflowAgent, skip_reason: "lead_id_required" }
      }
      const lead = await fetchGrowthLeadById(admin, leadId).catch(() => null)
      const outboundIntegrity = assertGrowthPipelinePromotionIntegrity({
        organizationId: input.organizationId,
        leadId,
        metadata: lead?.metadata ?? null,
        boundary: "outbound",
      })
      if (!outboundIntegrity.ok) {
        logGrowthEngine("growth_pipeline_promotion_integrity_violation", {
          qa_marker: outboundIntegrity.qaMarker,
          organization_id: input.organizationId,
          lead_id: leadId,
          boundary: outboundIntegrity.boundary,
          violation: outboundIntegrity.violation,
          admission_state: outboundIntegrity.admissionState,
          diagnostic: outboundIntegrity.diagnostic,
        })
        return {
          executed: false,
          workflow_agent: workflowAgent,
          skip_reason: `promotion_integrity:${outboundIntegrity.violation ?? "blocked"}`,
        }
      }
      const readModel = await runAutonomousOutreachPreparationManualRequest(admin, {
        organizationId: input.organizationId,
        leadId,
        generatedAt: input.generatedAt,
      })
      const latestRun = findLatestRunForLead(readModel.recentRuns, leadId)
      const outcome = latestRun ? mapOutreachRunToSalesOutcome(latestRun) : null
      if (!outcome) {
        return {
          executed: false,
          workflow_agent: workflowAgent,
          skip_reason:
            latestRun?.outcome === "skipped"
              ? latestRun.skipReason ?? "outreach_skipped"
              : "outreach_not_completed",
        }
      }
      return {
        executed: true,
        workflow_agent: workflowAgent,
        outcome: { ...outcome, work_item_id: workItem.id },
      }
    }
    case "meeting_agent": {
      const readModel = await runAutonomousMeetingPilotCycle(admin, {
        organizationId: input.organizationId,
        generatedAt: input.generatedAt,
        maxRuns: 1,
      })
      const latestRun = readModel.recentRuns[0] ?? null
      if (leadId && latestRun && latestRun.leadId !== leadId) {
        return {
          executed: false,
          workflow_agent: workflowAgent,
          skip_reason: "meeting_cycle_selected_different_lead",
        }
      }
      const outcome = latestRun ? mapMeetingRunToSalesOutcome(latestRun) : null
      if (!outcome) {
        return {
          executed: false,
          workflow_agent: workflowAgent,
          skip_reason:
            latestRun?.outcome === "skipped"
              ? latestRun.skipReason ?? "meeting_skipped"
              : "meeting_not_completed",
        }
      }
      return {
        executed: true,
        workflow_agent: workflowAgent,
        outcome: { ...outcome, work_item_id: workItem.id },
      }
    }
    default:
      return {
        executed: false,
        workflow_agent: workflowAgent,
        skip_reason: "unsupported_workflow_agent",
      }
  }
}
