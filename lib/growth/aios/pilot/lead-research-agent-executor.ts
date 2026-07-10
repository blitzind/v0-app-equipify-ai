/** GE-AIOS-4A — Research agent executor for research_company Work Orders (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { routeCanonicalProspectResearch } from "@/lib/growth/research/growth-canonical-research-route"
import {
  mapProspectRunToLegacyResearchResult,
  mapProspectRunToLegacyResearchRun,
} from "@/lib/growth/research/growth-canonical-research-legacy-adapter"
import { GROWTH_CANONICAL_RESEARCH_23_QA_MARKER } from "@/lib/growth/research/growth-canonical-research-types"
import {
  claimAiOsWorkOrder,
  heartbeatAiOsAgentRuntime,
  registerAiOsAgentRuntime,
} from "@/lib/growth/aios/ai-agent-runtime-service"
import {
  fetchActiveAiOsAgentLeaseForWorkOrder,
  fetchAiOsAgentRegistration,
  updateAiOsAgentLease,
} from "@/lib/growth/aios/ai-agent-runtime-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { publishLeadResearchPilotStepEvent } from "@/lib/growth/aios/pilot/lead-research-pilot-observability"
import {
  fetchAiWorkOrderById,
  updateAiWorkOrderRow,
} from "@/lib/growth/aios/ai-work-order-repository"
import { transitionAiWorkOrder } from "@/lib/growth/aios/ai-work-order-service"
import type { AiWorkOrder } from "@/lib/growth/aios/ai-work-order-types"
import { LEAD_RESEARCH_PILOT_RESEARCH_AGENT_INSTANCE_ID } from "@/lib/growth/aios/pilot/lead-research-pilot-types"
import { publishGrowthLeadResearchWorkflowStatus } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { qualifyGrowthLeadResearch } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { assessGrowthLeadResearchOpportunity } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import type { GrowthLeadResearchIntelligenceOutput } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import type { GrowthLeadResearchQualificationOutput } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { scheduleAvaAutonomyCompletionForLead } from "@/lib/growth/mission-center/growth-ava-autonomy-completion-service"

async function ensureResearchAgentRegistration(
  admin: SupabaseClient,
  input: { organizationId: string },
) {
  const registration = await registerAiOsAgentRuntime(admin, {
    organizationId: input.organizationId,
    agentKey: "research",
    instanceId: LEAD_RESEARCH_PILOT_RESEARCH_AGENT_INSTANCE_ID,
    seedDefaultCapabilities: true,
  })

  await heartbeatAiOsAgentRuntime(admin, {
    organizationId: input.organizationId,
    agentRegistrationId: registration.registration.id,
    runtimeStatus: "idle",
    healthStatus: "healthy",
    metadata: { source: "lead_research_pilot" },
  })

  return registration.registration
}

async function completeResearchAgentLease(
  admin: SupabaseClient,
  input: { organizationId: string; workOrderId: string },
) {
  const lease = await fetchActiveAiOsAgentLeaseForWorkOrder(admin, input)
  if (!lease) return

  await updateAiOsAgentLease(admin, {
    organizationId: input.organizationId,
    leaseId: lease.id,
    patch: {
      status: "released",
      released_at: new Date().toISOString(),
      release_reason: "work_order_completed",
    },
  })

  const registration = await fetchAiOsAgentRegistration(admin, {
    organizationId: input.organizationId,
    registrationId: lease.agentRegistrationId,
  })
  if (registration) {
    await heartbeatAiOsAgentRuntime(admin, {
      organizationId: input.organizationId,
      agentRegistrationId: registration.id,
      runtimeStatus: "idle",
      healthStatus: "healthy",
    })
  }
}

export async function executeResearchCompanyWorkOrderViaAiOs(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workOrderId: string
    leadId: string
    createdBy?: string | null
  },
): Promise<{
  workOrder: AiWorkOrder
  researchRunId: string | null
  qualification: GrowthLeadResearchQualificationOutput | null
  intelligence: GrowthLeadResearchIntelligenceOutput | null
  workflowTerminalStatus: "qualified" | "blocked" | "failed" | "research_complete" | "assessed"
}> {
  let workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("growth_lead_not_found")

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "agent_claim",
    status: "running",
  })

  const registration = await ensureResearchAgentRegistration(admin, {
    organizationId: input.organizationId,
  })

  const claim = await claimAiOsWorkOrder(admin, {
    organizationId: input.organizationId,
    agentRegistrationId: registration.id,
    workOrderId: workOrder.id,
    metadata: { pilot: "lead_research" },
  })
  workOrder = claim.workOrder

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "agent_claim",
    status: "completed",
    detail: `Lease ${claim.lease.id}`,
  })

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "company_research",
    status: "running",
  })

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "company_research",
    status: "running",
    metadata: { qa_marker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER },
  })

  const canonical = await routeCanonicalProspectResearch({
    admin,
    organizationId: input.organizationId,
    leadId: input.leadId,
    trigger: "manual",
    force: true,
    runQualification: false,
  })

  if (!canonical.ok) {
    throw new Error(canonical.message || canonical.code)
  }

  const researchRun = mapProspectRunToLegacyResearchRun(canonical.run, {
    createdBy: input.createdBy ?? null,
    triggerKind: "manual",
  })
  const researchResult = mapProspectRunToLegacyResearchResult(canonical.run)

  workOrder = await updateAiWorkOrderRow(admin, {
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    patch: {
      payload: {
        ...workOrder.payload,
        website_fetch_status: researchRun.websiteFetchStatus,
        website_excerpt: researchRun.websiteTextExcerpt,
        website_url: researchRun.websiteUrl,
        research_output_contract: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
        prospect_research_run_id: canonical.run.id,
      },
    },
  })

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "company_research",
    status: "completed",
    detail: canonical.run.id,
  })

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "save_research",
    status: "running",
  })

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "save_research",
    status: "completed",
    detail: researchRun.id,
  })

  const runStatus = researchRun.status === "succeeded" ? "succeeded" : "partial"

  await publishGrowthLeadResearchWorkflowStatus(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    researchRunId: researchRun.id,
    workflowStatus: "research_complete",
    detail: researchRun.id,
  })

  const qualificationResult = qualifyGrowthLeadResearch({
    result: researchResult,
    researchRunStatus: runStatus,
  })

  await publishGrowthLeadResearchWorkflowStatus(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    researchRunId: researchRun.id,
    workflowStatus: qualificationResult.terminalStatus,
    qualification: qualificationResult.qualification,
    detail: qualificationResult.qualification.recommendedNextAction,
  })

  let intelligence: GrowthLeadResearchIntelligenceOutput | null = null
  let workflowTerminalStatus:
    | "qualified"
    | "blocked"
    | "failed"
    | "research_complete"
    | "assessed" = qualificationResult.terminalStatus

  if (qualificationResult.terminalStatus === "qualified") {
    intelligence = assessGrowthLeadResearchOpportunity({
      result: researchResult,
      qualification: qualificationResult.qualification,
    })

    await publishGrowthLeadResearchWorkflowStatus(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      missionId: workOrder.missionId,
      workOrderId: workOrder.id,
      researchRunId: researchRun.id,
      workflowStatus: "assessed",
      qualification: qualificationResult.qualification,
      opportunityAssessment: intelligence.opportunityAssessment,
      nextBestAction: intelligence.nextBestAction,
      evidenceSummary: intelligence.evidenceSummary,
      executionPlan: intelligence.executionPlan,
      detail: intelligence.nextBestAction.label,
    })

    workflowTerminalStatus = "assessed"

    scheduleAvaAutonomyCompletionForLead(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
    })
  }

  const completed = await transitionAiWorkOrder(admin, {
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    toStatus: "completed",
    actingAgent: "research",
    reason: "lead_research_pilot_complete",
    result: {
      research_run_id: researchRun.id,
      prospect_research_run_id: canonical.run.id,
      qa_marker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
    },
  })
  workOrder = completed.workOrder

  await completeResearchAgentLease(admin, {
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
  })

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "work_order_complete",
    status: "completed",
  })

  return {
    workOrder,
    researchRunId: researchRun.id,
    qualification: qualificationResult.qualification,
    intelligence,
    workflowTerminalStatus,
  }
}
