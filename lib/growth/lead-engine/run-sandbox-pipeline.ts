import { parseGrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-parser"
import { GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_QA_MARKER } from "@/lib/growth/lead-engine/account-brief-types"
import { parseGrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-parse"
import { GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_QA_MARKER } from "@/lib/growth/lead-engine/company-discovery-types"
import { parseGrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-parse"
import { GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_QA_MARKER } from "@/lib/growth/lead-engine/contact-research-types"
import { parseGrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-parse"
import { GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_QA_MARKER } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import { parseGrowthLeadEngineHumanApprovalFromUpstream } from "@/lib/growth/lead-engine/human-approval-parser"
import { GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_QA_MARKER } from "@/lib/growth/lead-engine/human-approval-types"
import { parseGrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-parse"
import { GROWTH_LEAD_ENGINE_ICP_TARGETING_QA_MARKER } from "@/lib/growth/lead-engine/icp-targeting-types"
import { parseGrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-parser"
import { GROWTH_LEAD_ENGINE_LEAD_SCORE_QA_MARKER } from "@/lib/growth/lead-engine/lead-score-types"
import { parseGrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-parser"
import { GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_QA_MARKER } from "@/lib/growth/lead-engine/outreach-personalization-types"
import { parseGrowthLeadEngineRevenueExecutionFromUpstream } from "@/lib/growth/lead-engine/revenue-execution-parser"
import { GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_QA_MARKER } from "@/lib/growth/lead-engine/revenue-execution-types"
import {
  buildSandboxAccountBriefStub,
  buildSandboxCompanyDiscoveryStub,
  buildSandboxContactResearchStub,
  buildSandboxDecisionMakerStub,
  buildSandboxHumanApprovalStub,
  buildSandboxIcpTargetingStub,
  buildSandboxLeadScoreStub,
  buildSandboxOutreachPersonalizationStub,
  buildSandboxRevenueExecutionStub,
  buildSandboxVerificationTriageStub,
} from "@/lib/growth/lead-engine/sandbox-stubs"
import { parseGrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-parser"
import { GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_QA_MARKER } from "@/lib/growth/lead-engine/verification-triage-types"
import {
  GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER,
  type GrowthLeadEnginePipelineStageId,
  type GrowthLeadEnginePipelineStageResult,
  type GrowthLeadEngineSandboxInput,
  type GrowthLeadEngineSandboxPipelineResult,
} from "@/lib/growth/lead-engine/workspace-types"

type StageDefinition = {
  stageId: GrowthLeadEnginePipelineStageId
  label: string
  qaMarker: string
}

export const GROWTH_LEAD_ENGINE_PIPELINE_STAGES: StageDefinition[] = [
  { stageId: "icp_targeting", label: "ICP Targeting", qaMarker: GROWTH_LEAD_ENGINE_ICP_TARGETING_QA_MARKER },
  {
    stageId: "company_discovery",
    label: "Company Discovery",
    qaMarker: GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_QA_MARKER,
  },
  {
    stageId: "decision_maker_hypothesis",
    label: "Decision Maker Hypothesis",
    qaMarker: GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_QA_MARKER,
  },
  {
    stageId: "contact_research",
    label: "Contact Research",
    qaMarker: GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_QA_MARKER,
  },
  {
    stageId: "verification_triage",
    label: "Verification Triage",
    qaMarker: GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_QA_MARKER,
  },
  { stageId: "account_brief", label: "Account Brief", qaMarker: GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_QA_MARKER },
  {
    stageId: "outreach_personalization",
    label: "Outreach Personalization",
    qaMarker: GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_QA_MARKER,
  },
  { stageId: "lead_score", label: "Lead Score", qaMarker: GROWTH_LEAD_ENGINE_LEAD_SCORE_QA_MARKER },
  {
    stageId: "human_approval",
    label: "Human Approval",
    qaMarker: GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_QA_MARKER,
  },
  {
    stageId: "revenue_execution",
    label: "Revenue Execution",
    qaMarker: GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_QA_MARKER,
  },
]

function extractStageInsights(
  stageId: GrowthLeadEnginePipelineStageId,
  parsed: unknown,
): {
  confidence: number | null
  evidenceSummary: string | null
  humanReviewRequired: boolean | null
} {
  if (!parsed || typeof parsed !== "object") {
    return { confidence: null, evidenceSummary: null, humanReviewRequired: null }
  }
  const row = parsed as Record<string, unknown>

  switch (stageId) {
    case "icp_targeting":
      return {
        confidence: null,
        evidenceSummary: typeof row.icp_summary === "string" ? row.icp_summary : null,
        humanReviewRequired: null,
      }
    case "company_discovery": {
      const fit = row.fit_assessment as Record<string, unknown> | undefined
      return {
        confidence: typeof fit?.confidence === "number" ? fit.confidence : null,
        evidenceSummary:
          Array.isArray(row.source_evidence) && row.source_evidence.length > 0
            ? `${row.source_evidence.length} source evidence entries`
            : null,
        humanReviewRequired: null,
      }
    }
    case "decision_maker_hypothesis": {
      const assessment = row.confidence_assessment as Record<string, unknown> | undefined
      const score = typeof assessment?.score === "number" ? assessment.score / 100 : null
      return {
        confidence: score,
        evidenceSummary:
          typeof assessment?.reasoning !== "undefined"
            ? JSON.stringify(assessment?.reasoning)
            : null,
        humanReviewRequired: null,
      }
    }
    case "contact_research": {
      const quality = row.research_quality as Record<string, unknown> | undefined
      return {
        confidence: typeof quality?.score === "number" ? quality.score / 100 : null,
        evidenceSummary: `${Array.isArray(row.contact_candidates) ? row.contact_candidates.length : 0} contact candidates`,
        humanReviewRequired: null,
      }
    }
    case "verification_triage":
      return {
        confidence:
          typeof row.verification_confidence === "number" ? row.verification_confidence : null,
        evidenceSummary:
          typeof row.disposition === "string" ? `Disposition: ${row.disposition}` : null,
        humanReviewRequired:
          typeof row.human_review_required === "boolean" ? row.human_review_required : null,
      }
    case "account_brief":
      return {
        confidence: typeof row.research_confidence === "number" ? row.research_confidence : null,
        evidenceSummary: typeof row.evidence_summary === "string" ? row.evidence_summary : null,
        humanReviewRequired:
          typeof row.human_review_required === "boolean" ? row.human_review_required : null,
      }
    case "outreach_personalization":
      return {
        confidence:
          typeof row.personalization_confidence === "number"
            ? row.personalization_confidence
            : null,
        evidenceSummary: typeof row.evidence_summary === "string" ? row.evidence_summary : null,
        humanReviewRequired:
          typeof row.human_review_required === "boolean" ? row.human_review_required : null,
      }
    case "lead_score":
      return {
        confidence: typeof row.lead_score === "number" ? row.lead_score / 100 : null,
        evidenceSummary: typeof row.score_explanation === "string" ? row.score_explanation : null,
        humanReviewRequired:
          typeof row.human_review_required === "boolean" ? row.human_review_required : null,
      }
    case "human_approval":
      return {
        confidence: typeof row.approval_confidence === "number" ? row.approval_confidence : null,
        evidenceSummary: typeof row.evidence_summary === "string" ? row.evidence_summary : null,
        humanReviewRequired:
          typeof row.human_review_required === "boolean" ? row.human_review_required : null,
      }
    case "revenue_execution":
      return {
        confidence: typeof row.execution_confidence === "number" ? row.execution_confidence : null,
        evidenceSummary: typeof row.evidence_summary === "string" ? row.evidence_summary : null,
        humanReviewRequired:
          typeof row.human_execution_required === "boolean" ? row.human_execution_required : null,
      }
    default:
      return { confidence: null, evidenceSummary: null, humanReviewRequired: null }
  }
}

function runStage(
  def: StageDefinition,
  rawJson: string,
  parse: (raw: string) => { ok: true; output: unknown } | { ok: false; message: string },
): GrowthLeadEnginePipelineStageResult {
  const parsedResult = parse(rawJson)
  const insights = parsedResult.ok
    ? extractStageInsights(def.stageId, parsedResult.output)
    : { confidence: null, evidenceSummary: null, humanReviewRequired: null }

  return {
    stageId: def.stageId,
    label: def.label,
    qaMarker: def.qaMarker,
    status: parsedResult.ok ? "ok" : "error",
    rawJson,
    parsed: parsedResult.ok ? parsedResult.output : null,
    parseOk: parsedResult.ok,
    parseMessage: parsedResult.ok ? null : parsedResult.message,
    confidence: insights.confidence,
    evidenceSummary: insights.evidenceSummary,
    humanReviewRequired: insights.humanReviewRequired,
  }
}

/** Fixture dry-run: stub JSON per stage → parser chain (no LLM / no outbound). */
export function runGrowthLeadEngineSandboxPipeline(
  input: GrowthLeadEngineSandboxInput,
): GrowthLeadEngineSandboxPipelineResult {
  const stages: GrowthLeadEnginePipelineStageResult[] = []

  const icpRaw = buildSandboxIcpTargetingStub(input)
  const icpStage = runStage(
    GROWTH_LEAD_ENGINE_PIPELINE_STAGES[0],
    icpRaw,
    parseGrowthLeadEngineIcpTargetingOutput,
  )
  stages.push(icpStage)
  if (!icpStage.parseOk || !icpStage.parsed) {
    return finalizeResult(input, stages)
  }
  const icp = icpStage.parsed

  const companyRaw = buildSandboxCompanyDiscoveryStub(input, icp)
  const companyStage = runStage(
    GROWTH_LEAD_ENGINE_PIPELINE_STAGES[1],
    companyRaw,
    parseGrowthLeadEngineCompanyDiscoveryOutput,
  )
  stages.push(companyStage)
  if (!companyStage.parseOk || !companyStage.parsed) {
    return finalizeResult(input, stages)
  }
  const company = companyStage.parsed

  const dmRaw = buildSandboxDecisionMakerStub(company)
  const dmStage = runStage(
    GROWTH_LEAD_ENGINE_PIPELINE_STAGES[2],
    dmRaw,
    parseGrowthLeadEngineDecisionMakerHypothesisOutput,
  )
  stages.push(dmStage)
  if (!dmStage.parseOk || !dmStage.parsed) {
    return finalizeResult(input, stages)
  }

  const contactRaw = buildSandboxContactResearchStub(input, company)
  const contactStage = runStage(
    GROWTH_LEAD_ENGINE_PIPELINE_STAGES[3],
    contactRaw,
    parseGrowthLeadEngineContactResearchOutput,
  )
  stages.push(contactStage)
  if (!contactStage.parseOk || !contactStage.parsed) {
    return finalizeResult(input, stages)
  }
  const contact = contactStage.parsed

  const verificationRaw = buildSandboxVerificationTriageStub(input, contact)
  const verificationStage = runStage(
    GROWTH_LEAD_ENGINE_PIPELINE_STAGES[4],
    verificationRaw,
    parseGrowthLeadEngineVerificationTriageOutput,
  )
  stages.push(verificationStage)
  if (!verificationStage.parseOk || !verificationStage.parsed) {
    return finalizeResult(input, stages)
  }
  const verification = verificationStage.parsed

  const briefRaw = buildSandboxAccountBriefStub(input, company)
  const briefStage = runStage(
    GROWTH_LEAD_ENGINE_PIPELINE_STAGES[5],
    briefRaw,
    (raw) => parseGrowthLeadEngineAccountBriefOutput(raw, { verificationDisposition: verification.disposition }),
  )
  stages.push(briefStage)
  if (!briefStage.parseOk || !briefStage.parsed) {
    return finalizeResult(input, stages)
  }
  const brief = briefStage.parsed

  const personalizationRaw = buildSandboxOutreachPersonalizationStub(brief)
  const personalizationStage = runStage(
    GROWTH_LEAD_ENGINE_PIPELINE_STAGES[6],
    personalizationRaw,
    parseGrowthLeadEngineOutreachPersonalizationOutput,
  )
  stages.push(personalizationStage)
  if (!personalizationStage.parseOk || !personalizationStage.parsed) {
    return finalizeResult(input, stages)
  }

  const leadScoreRaw = buildSandboxLeadScoreStub()
  const leadScoreStage = runStage(
    GROWTH_LEAD_ENGINE_PIPELINE_STAGES[7],
    leadScoreRaw,
    (raw) =>
      parseGrowthLeadEngineLeadScoreOutput(raw, {
        upstream: {
          verificationDisposition: verification.disposition,
          accountBriefHumanReview: brief.human_review_required,
          personalizationHumanReview: personalizationStage.parsed
            ? (personalizationStage.parsed as { human_review_required?: boolean }).human_review_required
            : false,
        },
      }),
  )
  stages.push(leadScoreStage)
  if (!leadScoreStage.parseOk || !leadScoreStage.parsed) {
    return finalizeResult(input, stages)
  }
  const leadScore = leadScoreStage.parsed

  const approvalRaw = buildSandboxHumanApprovalStub()
  const approvalStage = runStage(
    GROWTH_LEAD_ENGINE_PIPELINE_STAGES[8],
    approvalRaw,
    (raw) =>
      parseGrowthLeadEngineHumanApprovalFromUpstream(raw, {
        verificationTriage: verification,
        leadScore,
      }),
  )
  stages.push(approvalStage)
  if (!approvalStage.parseOk || !approvalStage.parsed) {
    return finalizeResult(input, stages)
  }
  const approval = approvalStage.parsed

  const executionRaw = buildSandboxRevenueExecutionStub()
  const executionStage = runStage(
    GROWTH_LEAD_ENGINE_PIPELINE_STAGES[9],
    executionRaw,
    (raw) =>
      parseGrowthLeadEngineRevenueExecutionFromUpstream(raw, {
        humanApproval: approval,
        leadScore,
        verificationTriage: verification,
        outreachPersonalization: personalizationStage.parsed ?? undefined,
      }),
  )
  stages.push(executionStage)

  return finalizeResult(input, stages)
}

function finalizeResult(
  input: GrowthLeadEngineSandboxInput,
  stages: GrowthLeadEnginePipelineStageResult[],
): GrowthLeadEngineSandboxPipelineResult {
  const completedCount = stages.filter((s) => s.status === "ok").length
  const errorCount = stages.filter((s) => s.status === "error").length

  for (const def of GROWTH_LEAD_ENGINE_PIPELINE_STAGES) {
    if (!stages.some((s) => s.stageId === def.stageId)) {
      stages.push({
        stageId: def.stageId,
        label: def.label,
        qaMarker: def.qaMarker,
        status: "pending",
        rawJson: "",
        parsed: null,
        parseOk: false,
        parseMessage: "Skipped — upstream stage failed.",
        confidence: null,
        evidenceSummary: null,
        humanReviewRequired: null,
      })
    }
  }

  stages.sort(
    (a, b) =>
      GROWTH_LEAD_ENGINE_PIPELINE_STAGES.findIndex((s) => s.stageId === a.stageId) -
      GROWTH_LEAD_ENGINE_PIPELINE_STAGES.findIndex((s) => s.stageId === b.stageId),
  )

  return {
    qaMarker: GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER,
    mode: "fixture_dry_run",
    input,
    stages,
    completedCount,
    errorCount,
  }
}
