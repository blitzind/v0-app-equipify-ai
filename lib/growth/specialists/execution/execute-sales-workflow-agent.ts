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
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
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

export async function executeSalesWorkflowAgent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workItem: AvaWorkItem
    delegation: Extract<SalesSpecialistDelegationResult, { delegated: true }>
    generatedAt: string
  },
): Promise<ExecuteSalesWorkflowAgentResult> {
  const { workflow_agent: workflowAgent, workItem } = input
  const leadId = extractLeadIdFromWorkItem(workItem)

  switch (workflowAgent) {
    case "research_agent": {
      if (!leadId) {
        return { executed: false, workflow_agent: workflowAgent, skip_reason: "lead_id_required" }
      }
      const execution = await executeGrowthLeadProspectResearch({
        admin: input.admin,
        organizationId: input.organizationId,
        leadId,
        trigger: "sales_loop",
        generatedAt: input.generatedAt,
        runQualification: true,
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
