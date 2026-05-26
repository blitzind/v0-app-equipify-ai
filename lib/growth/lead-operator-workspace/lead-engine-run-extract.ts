import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineHumanApprovalOutput } from "@/lib/growth/lead-engine/human-approval-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"
import type { GrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-types"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthLeadEngineRevenueExecutionOutput } from "@/lib/growth/lead-engine/revenue-execution-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"
import type { GrowthLeadEnginePipelineStageId } from "@/lib/growth/lead-engine/workspace-types"

export type GrowthLeadEngineExtractedOutputs = {
  icpTargeting?: GrowthLeadEngineIcpTargetingOutput
  companyDiscovery?: GrowthLeadEngineCompanyDiscoveryOutput
  decisionMakerHypothesis?: GrowthLeadEngineDecisionMakerHypothesisOutput
  contactResearch?: GrowthLeadEngineContactResearchOutput
  verificationTriage?: GrowthLeadEngineVerificationTriageOutput
  accountBrief?: GrowthLeadEngineAccountBriefOutput
  outreachPersonalization?: GrowthLeadEngineOutreachPersonalizationOutput
  leadScore?: GrowthLeadEngineLeadScoreOutput
  humanApproval?: GrowthLeadEngineHumanApprovalOutput
  revenueExecution?: GrowthLeadEngineRevenueExecutionOutput
}

function stageParsed<T>(run: GrowthLeadEnginePipelineRun, stageId: GrowthLeadEnginePipelineStageId): T | undefined {
  const stage = run.stage_results.find((s) => s.stage_id === stageId)
  if (!stage?.parse_ok || !stage.parsed) return undefined
  return stage.parsed as T
}

export function extractLeadEngineOutputsFromRun(
  run: GrowthLeadEnginePipelineRun,
): GrowthLeadEngineExtractedOutputs {
  return {
    icpTargeting: stageParsed(run, "icp_targeting"),
    companyDiscovery: stageParsed(run, "company_discovery"),
    decisionMakerHypothesis: stageParsed(run, "decision_maker_hypothesis"),
    contactResearch: stageParsed(run, "contact_research"),
    verificationTriage: stageParsed(run, "verification_triage"),
    accountBrief: stageParsed(run, "account_brief"),
    outreachPersonalization: stageParsed(run, "outreach_personalization"),
    leadScore: stageParsed(run, "lead_score"),
    humanApproval: stageParsed(run, "human_approval"),
    revenueExecution: stageParsed(run, "revenue_execution"),
  }
}
