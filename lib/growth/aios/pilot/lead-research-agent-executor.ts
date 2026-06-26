/** GE-AIOS-4A — Research agent executor for research_company Work Orders (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { applyGrowthLeadResearchEnrichment } from "@/lib/growth/apply-lead-research-enrichment"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { growthLeadResearchInputHash } from "@/lib/growth/research-input-hash"
import {
  growthLeadResearchModelSchema,
  mapGrowthLeadResearchModelToResult,
} from "@/lib/growth/research-schema"
import {
  finishGrowthLeadResearchRun,
  insertGrowthLeadResearchRun,
} from "@/lib/growth/research-repository"
import { fetchLeadWebsite } from "@/lib/growth/research-website-fetch"
import { assembleAiContextForWorkOrder } from "@/lib/growth/aios/ai-context-assembly-service"
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
import { invokeAiOsProviderWithContextPackage } from "@/lib/growth/aios/ai-provider-service"
import { LEAD_RESEARCH_PILOT_PROVIDER_PURPOSE } from "@/lib/growth/aios/pilot/lead-research-pilot-types"
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

function normalizeResearchProviderPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw
  const record = { ...(raw as Record<string, unknown>) }
  if (Array.isArray(record.decision_maker_candidates)) {
    record.decision_maker_candidates = record.decision_maker_candidates.filter(
      (candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate),
    )
  }
  return record
}

function parseProviderJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) throw new Error("ai_provider_empty_response")

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf("{")
    const end = candidate.lastIndexOf("}")
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1))
    }
    throw new Error("ai_provider_invalid_json")
  }
}

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
  const startedAt = Date.now()
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

  const websiteFetch = await fetchLeadWebsite(lead.website)
  workOrder = await updateAiWorkOrderRow(admin, {
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    patch: {
      payload: {
        ...workOrder.payload,
        website_fetch_status: websiteFetch.status,
        website_excerpt: websiteFetch.excerpt,
        website_url: websiteFetch.normalizedUrl,
        research_output_contract: "growth_lead_research_v3",
      },
    },
  })

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "context_assembly",
    status: "running",
  })

  const assembly = await assembleAiContextForWorkOrder(admin, {
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    source: "lead_research_pilot_executor",
  })

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "context_assembly",
    status: "completed",
    detail: assembly.contextPackage.id,
    metadata: { context_package_id: assembly.contextPackage.id, reused: assembly.reused },
  })

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "ai_provider",
    status: "running",
  })

  const providerResult = await invokeAiOsProviderWithContextPackage(admin, {
    organizationId: input.organizationId,
    contextPackage: assembly.contextPackage,
    purpose: LEAD_RESEARCH_PILOT_PROVIDER_PURPOSE,
    source: "lead_research_pilot_executor",
  })

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "ai_provider",
    status: "completed",
    detail: providerResult.requestId,
    metadata: {
      provider_id: providerResult.response.providerId,
      model_id: providerResult.response.modelId,
    },
  })

  const parsedModel = growthLeadResearchModelSchema.parse(
    normalizeResearchProviderPayload(parseProviderJson(providerResult.response.text)),
  )
  const researchResult = mapGrowthLeadResearchModelToResult(parsedModel)

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "company_research",
    status: "completed",
  })

  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    stepId: "save_research",
    status: "running",
  })

  const inputHash = growthLeadResearchInputHash({
    companyName: lead.companyName,
    website: lead.website,
    contactName: lead.contactName,
    regenerate: false,
  })

  let researchRun = await insertGrowthLeadResearchRun(admin, {
    lead,
    triggerKind: "manual",
    inputHash,
    websiteUrl: websiteFetch.normalizedUrl,
    createdBy: input.createdBy ?? null,
  })

  researchRun =
    (await finishGrowthLeadResearchRun(admin, researchRun.id, {
      status: websiteFetch.status === "ok" || websiteFetch.status === "skipped" ? "succeeded" : "partial",
      result: researchResult,
      researchConfidence: researchResult.researchConfidence,
      equipifyFitScore: researchResult.equipifyFitScore,
      websiteUrl: websiteFetch.normalizedUrl,
      websiteFetchStatus: websiteFetch.status,
      websiteTextExcerpt: websiteFetch.excerpt,
      sourceUrls: researchResult.sourceUrls,
      modelTask: "ai_os_pilot_research_company",
      modelProvider: providerResult.response.providerId,
      modelName: providerResult.response.modelId,
      durationMs: Date.now() - startedAt,
    })) ?? researchRun

  await applyGrowthLeadResearchEnrichment(admin, {
    lead,
    result: researchResult,
    createdBy: input.createdBy ?? null,
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

  const runStatus =
    websiteFetch.status === "ok" || websiteFetch.status === "skipped" ? "succeeded" : "partial"

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
  }

  const completed = await transitionAiWorkOrder(admin, {
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    toStatus: "completed",
    actingAgent: "research",
    reason: "lead_research_pilot_complete",
    result: {
      research_run_id: researchRun.id,
      provider_request_id: providerResult.requestId,
      context_package_id: assembly.contextPackage.id,
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
