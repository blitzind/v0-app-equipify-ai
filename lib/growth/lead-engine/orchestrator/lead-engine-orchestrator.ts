import "server-only"

import { randomUUID } from "node:crypto"
import { performance } from "node:perf_hooks"
import { parseGrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-parser"
import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import { parseGrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-parse"
import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import { parseGrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-parse"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import { parseGrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-parse"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import { parseGrowthLeadEngineHumanApprovalFromUpstream } from "@/lib/growth/lead-engine/human-approval-parser"
import type { GrowthLeadEngineHumanApprovalOutput } from "@/lib/growth/lead-engine/human-approval-types"
import { parseGrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-parse"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"
import { parseGrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-parser"
import type { GrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-types"
import {
  GROWTH_LEAD_ENGINE_ORCHESTRATOR_QA_MARKER,
  type GrowthLeadEngineOrchestratorStageResult,
  type GrowthLeadEnginePipelineAttributionEntry,
  type GrowthLeadEnginePipelineEvidenceEntry,
  type GrowthLeadEnginePipelineRun,
  type GrowthLeadEnginePipelineStatus,
  type GrowthLeadEngineStageCompletionStatus,
} from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import { parseGrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-parser"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import { parseGrowthLeadEngineRevenueExecutionFromUpstream } from "@/lib/growth/lead-engine/revenue-execution-parser"
import type { GrowthLeadEngineRevenueExecutionOutput } from "@/lib/growth/lead-engine/revenue-execution-types"
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
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"
import { fetchLeadEngineStageProviderResultsSync } from "@/lib/growth/lead-engine/providers/provider-registry"
import {
  GROWTH_LEAD_ENGINE_PROVIDER_ADAPTER_QA_MARKER,
  toPublicProviderResponse,
  type GrowthLeadEngineProviderMode,
} from "@/lib/growth/lead-engine/providers/provider-types"
import type { GrowthLeadEngineStageProviderPublicResult } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import { LEAD_ENGINE_STAGE_UI } from "@/lib/growth/lead-engine/lead-engine-stage-ui"
import type { GrowthLeadEnginePipelineStageId, GrowthLeadEngineSandboxInput } from "@/lib/growth/lead-engine/workspace-types"

export type LeadEnginePipelineOptions = {
  /** When set, providers run before each stage (failures isolated; parsers still use fixture stubs). */
  providerMode?: GrowthLeadEngineProviderMode
  admin?: import("@supabase/supabase-js").SupabaseClient | null
}

export type LeadEngineOrchestratorStageDefinition = {
  stageId: GrowthLeadEnginePipelineStageId
  label: string
  shortLabel: string
  qaMarker: string
}

/** Server-side stage order — sourced from client-safe UI metadata. */
export const LEAD_ENGINE_ORCHESTRATOR_STAGES: LeadEngineOrchestratorStageDefinition[] =
  LEAD_ENGINE_STAGE_UI.map((stage) => ({
    stageId: stage.stageKey,
    label: stage.label,
    shortLabel: stage.shortLabel,
    qaMarker: stage.qaMarker,
  }))

type UpstreamBag = {
  icp?: GrowthLeadEngineIcpTargetingOutput
  company?: GrowthLeadEngineCompanyDiscoveryOutput
  decisionMaker?: GrowthLeadEngineDecisionMakerHypothesisOutput
  contact?: GrowthLeadEngineContactResearchOutput
  verification?: GrowthLeadEngineVerificationTriageOutput
  brief?: GrowthLeadEngineAccountBriefOutput
  personalization?: GrowthLeadEngineOutreachPersonalizationOutput
  leadScore?: GrowthLeadEngineLeadScoreOutput
  approval?: GrowthLeadEngineHumanApprovalOutput
  execution?: GrowthLeadEngineRevenueExecutionOutput
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function extractAttributionFromParsed(
  stageId: GrowthLeadEnginePipelineStageId,
  parsed: unknown,
): GrowthLeadEnginePipelineAttributionEntry[] {
  const row = asRecord(parsed)
  if (!row) return []

  const buckets: unknown[] = []
  if (Array.isArray(row.source_attribution)) buckets.push(...row.source_attribution)
  if (Array.isArray(row.verification_source_attribution)) {
    buckets.push(...row.verification_source_attribution)
  }

  return buckets
    .map((entry) => {
      const item = asRecord(entry)
      if (!item) return null
      const source = String(item.source ?? "").trim()
      const section = String(item.section ?? item.channel ?? stageId).trim()
      const signal = String(item.signal ?? "").trim()
      const evidence = String(item.evidence ?? "").trim()
      let confidence = typeof item.confidence === "number" ? item.confidence : 0
      if (confidence > 1) confidence = confidence / 100
      if (!source || !evidence) return null
      return {
        stage_id: stageId,
        source,
        section,
        signal: signal || section,
        evidence,
        confidence: Math.max(0, Math.min(1, confidence)),
      }
    })
    .filter((entry): entry is GrowthLeadEnginePipelineAttributionEntry => entry !== null)
}

function extractEvidenceFromParsed(
  stageId: GrowthLeadEnginePipelineStageId,
  parsed: unknown,
): GrowthLeadEnginePipelineEvidenceEntry | null {
  const row = asRecord(parsed)
  if (!row) return null

  const summary =
    (typeof row.evidence_summary === "string" && row.evidence_summary) ||
    (typeof row.score_explanation === "string" && row.score_explanation) ||
    (typeof row.approval_summary === "string" && row.approval_summary) ||
    (typeof row.icp_summary === "string" && row.icp_summary) ||
    ""

  const items: Array<{ claim: string; evidence: string; source: string }> = []

  for (const key of ["source_evidence", "pain_points", "growth_signals", "buying_signals"]) {
    const arr = row[key]
    if (!Array.isArray(arr)) continue
    for (const entry of arr) {
      const item = asRecord(entry)
      if (!item) continue
      const claim = String(item.claim ?? "").trim()
      const evidence = String(item.evidence ?? "").trim()
      const source = String(item.source ?? key).trim()
      if (claim || evidence) items.push({ claim, evidence, source })
    }
  }

  if (!summary && items.length === 0) return null
  return { stage_id: stageId, summary: summary || `${items.length} evidence items`, items }
}

function extractStageConfidence(stageId: GrowthLeadEnginePipelineStageId, parsed: unknown): number | null {
  const row = asRecord(parsed)
  if (!row) return null

  switch (stageId) {
    case "company_discovery": {
      const fit = asRecord(row.fit_assessment)
      return typeof fit?.confidence === "number" ? fit.confidence : null
    }
    case "decision_maker_hypothesis": {
      const assessment = asRecord(row.confidence_assessment)
      return typeof assessment?.score === "number" ? assessment.score / 100 : null
    }
    case "contact_research": {
      const quality = asRecord(row.research_quality)
      return typeof quality?.score === "number" ? quality.score / 100 : null
    }
    case "verification_triage":
      return typeof row.verification_confidence === "number" ? row.verification_confidence : null
    case "account_brief":
      return typeof row.research_confidence === "number" ? row.research_confidence : null
    case "outreach_personalization":
      return typeof row.personalization_confidence === "number" ? row.personalization_confidence : null
    case "lead_score":
      return typeof row.lead_score === "number" ? row.lead_score / 100 : null
    case "human_approval":
      return typeof row.approval_confidence === "number" ? row.approval_confidence : null
    case "revenue_execution":
      return typeof row.execution_confidence === "number" ? row.execution_confidence : null
    default:
      return null
  }
}

function extractHumanReview(stageId: GrowthLeadEnginePipelineStageId, parsed: unknown): boolean | null {
  const row = asRecord(parsed)
  if (!row) return null
  if (typeof row.human_review_required === "boolean") return row.human_review_required
  if (stageId === "revenue_execution" && typeof row.human_execution_required === "boolean") {
    return row.human_execution_required
  }
  return null
}

function evaluateStageWarnings(
  stageId: GrowthLeadEnginePipelineStageId,
  parsed: unknown,
  attribution: GrowthLeadEnginePipelineAttributionEntry[],
): string[] {
  const warnings: string[] = []
  const row = asRecord(parsed)
  if (!row) return warnings

  if (attribution.length < 2) {
    warnings.push(`${stageId}: low attribution (${attribution.length} entries)`)
  }

  if (stageId === "verification_triage" && row.disposition === "risky") {
    warnings.push("Verification triage disposition is risky.")
  }

  if (stageId === "account_brief" && typeof row.brief_completeness === "number" && row.brief_completeness < 60) {
    warnings.push(`Account brief completeness low (${row.brief_completeness}).`)
  }

  if (
    stageId === "outreach_personalization" &&
    typeof row.personalization_completeness === "number" &&
    row.personalization_completeness < 60
  ) {
    warnings.push(`Personalization completeness low (${row.personalization_completeness}).`)
  }

  if (stageId === "lead_score" && row.recommended_next_action === "enrich_more") {
    warnings.push("Lead score recommends enrichment before outreach.")
  }

  if (stageId === "human_approval" && row.approval_status === "conditional") {
    warnings.push("Human approval is conditional — reviewer decision needed.")
  }

  if (stageId === "revenue_execution" && row.execution_status === "waiting") {
    warnings.push("Revenue execution is waiting on upstream gates.")
  }

  return warnings
}

function evaluateStageFatal(
  stageId: GrowthLeadEnginePipelineStageId,
  parsed: unknown,
  parseOk: boolean,
  parseMessage: string | null,
): string | null {
  if (!parseOk) {
    return parseMessage ?? `Parser enforcement failed at ${stageId}.`
  }

  const row = asRecord(parsed)
  if (!row) return null

  if (stageId === "verification_triage" && row.disposition === "reject") {
    return "Verification triage disposition is reject — pipeline stopped."
  }

  if (stageId === "human_approval" && row.approval_status === "blocked") {
    return "Human approval status is blocked — pipeline stopped."
  }

  return null
}

function buildStageDiagnostics(
  stageId: GrowthLeadEnginePipelineStageId,
  durationMs: number,
  parsed: unknown,
  parseOk: boolean,
): string[] {
  const diagnostics = [`Stage ${stageId} completed in ${durationMs}ms`, `Parser enforcement: ${parseOk ? "pass" : "fail"}`]
  const row = asRecord(parsed)
  if (!row) return diagnostics

  if (stageId === "verification_triage" && typeof row.disposition === "string") {
    diagnostics.push(`Verification disposition: ${row.disposition}`)
  }
  if (stageId === "human_approval" && typeof row.approval_status === "string") {
    diagnostics.push(`Approval status: ${row.approval_status}`)
  }
  if (stageId === "revenue_execution" && typeof row.execution_status === "string") {
    diagnostics.push(`Execution status: ${row.execution_status}`)
  }
  if (stageId === "lead_score" && typeof row.lead_grade === "string") {
    diagnostics.push(`Lead grade: ${row.lead_grade} (score ${row.lead_score})`)
  }

  return diagnostics
}

function buildRawJson(
  stageId: GrowthLeadEnginePipelineStageId,
  input: GrowthLeadEngineSandboxInput,
  upstream: UpstreamBag,
): string {
  switch (stageId) {
    case "icp_targeting":
      return buildSandboxIcpTargetingStub(input)
    case "company_discovery":
      return buildSandboxCompanyDiscoveryStub(input, upstream.icp!)
    case "decision_maker_hypothesis":
      return buildSandboxDecisionMakerStub(upstream.company!)
    case "contact_research":
      return buildSandboxContactResearchStub(input, upstream.company!)
    case "verification_triage":
      return buildSandboxVerificationTriageStub(input, upstream.contact!)
    case "account_brief":
      return buildSandboxAccountBriefStub(input, upstream.company!)
    case "outreach_personalization":
      return buildSandboxOutreachPersonalizationStub(upstream.brief!)
    case "lead_score":
      return buildSandboxLeadScoreStub()
    case "human_approval":
      return buildSandboxHumanApprovalStub()
    case "revenue_execution":
      return buildSandboxRevenueExecutionStub()
    default:
      return "{}"
  }
}

function parseStage(
  stageId: GrowthLeadEnginePipelineStageId,
  raw: string,
  upstream: UpstreamBag,
): { ok: true; output: unknown } | { ok: false; message: string } {
  switch (stageId) {
    case "icp_targeting":
      return parseGrowthLeadEngineIcpTargetingOutput(raw)
    case "company_discovery":
      return parseGrowthLeadEngineCompanyDiscoveryOutput(raw)
    case "decision_maker_hypothesis":
      return parseGrowthLeadEngineDecisionMakerHypothesisOutput(raw)
    case "contact_research":
      return parseGrowthLeadEngineContactResearchOutput(raw)
    case "verification_triage":
      return parseGrowthLeadEngineVerificationTriageOutput(raw)
    case "account_brief":
      return parseGrowthLeadEngineAccountBriefOutput(raw, {
        verificationDisposition: upstream.verification?.disposition ?? null,
      })
    case "outreach_personalization":
      return parseGrowthLeadEngineOutreachPersonalizationOutput(raw)
    case "lead_score":
      return parseGrowthLeadEngineLeadScoreOutput(raw, {
        upstream: {
          verificationDisposition: upstream.verification?.disposition ?? null,
          accountBriefHumanReview: upstream.brief?.human_review_required,
          personalizationHumanReview: upstream.personalization?.human_review_required,
        },
      })
    case "human_approval":
      return parseGrowthLeadEngineHumanApprovalFromUpstream(raw, {
        verificationTriage: upstream.verification,
        leadScore: upstream.leadScore,
      })
    case "revenue_execution":
      return parseGrowthLeadEngineRevenueExecutionFromUpstream(raw, {
        humanApproval: upstream.approval,
        leadScore: upstream.leadScore,
        verificationTriage: upstream.verification,
        outreachPersonalization: upstream.personalization,
      })
    default:
      return { ok: false, message: `Unknown stage ${stageId}` }
  }
}

function assignUpstream(stageId: GrowthLeadEnginePipelineStageId, output: unknown, bag: UpstreamBag): void {
  switch (stageId) {
    case "icp_targeting":
      bag.icp = output as GrowthLeadEngineIcpTargetingOutput
      break
    case "company_discovery":
      bag.company = output as GrowthLeadEngineCompanyDiscoveryOutput
      break
    case "decision_maker_hypothesis":
      bag.decisionMaker = output as GrowthLeadEngineDecisionMakerHypothesisOutput
      break
    case "contact_research":
      bag.contact = output as GrowthLeadEngineContactResearchOutput
      break
    case "verification_triage":
      bag.verification = output as GrowthLeadEngineVerificationTriageOutput
      break
    case "account_brief":
      bag.brief = output as GrowthLeadEngineAccountBriefOutput
      break
    case "outreach_personalization":
      bag.personalization = output as GrowthLeadEngineOutreachPersonalizationOutput
      break
    case "lead_score":
      bag.leadScore = output as GrowthLeadEngineLeadScoreOutput
      break
    case "human_approval":
      bag.approval = output as GrowthLeadEngineHumanApprovalOutput
      break
    case "revenue_execution":
      bag.execution = output as GrowthLeadEngineRevenueExecutionOutput
      break
  }
}

function validateUpstreamReady(stageId: GrowthLeadEnginePipelineStageId, bag: UpstreamBag): string | null {
  const requirements: Partial<Record<GrowthLeadEnginePipelineStageId, (keyof UpstreamBag)[]>> = {
    company_discovery: ["icp"],
    decision_maker_hypothesis: ["icp", "company"],
    contact_research: ["icp", "company", "decisionMaker"],
    verification_triage: ["icp", "company", "decisionMaker", "contact"],
    account_brief: ["icp", "company", "decisionMaker", "contact", "verification"],
    outreach_personalization: ["icp", "company", "decisionMaker", "contact", "verification", "brief"],
    lead_score: ["icp", "company", "decisionMaker", "contact", "verification", "brief", "personalization"],
    human_approval: ["icp", "company", "decisionMaker", "contact", "verification", "brief", "personalization", "leadScore"],
    revenue_execution: [
      "icp",
      "company",
      "decisionMaker",
      "contact",
      "verification",
      "brief",
      "personalization",
      "leadScore",
      "approval",
    ],
  }

  const required = requirements[stageId]
  if (!required) return null
  for (const key of required) {
    if (!bag[key]) return `Missing required upstream output: ${key} before ${stageId}.`
  }
  return null
}

function skippedStage(def: LeadEngineOrchestratorStageDefinition, reason: string): GrowthLeadEngineOrchestratorStageResult {
  return {
    stage_id: def.stageId,
    label: def.label,
    short_label: def.shortLabel,
    qa_marker: def.qaMarker,
    status: "skipped",
    duration_ms: 0,
    raw_json: "",
    parsed: null,
    parse_ok: false,
    parse_message: reason,
    confidence: null,
    human_review_required: null,
    attribution: [],
    evidence: null,
    diagnostics: [reason],
    fatal: false,
    warnings: [],
  }
}

function computePipelineConfidence(stages: GrowthLeadEngineOrchestratorStageResult[]): number {
  const values = stages
    .map((s) => s.confidence)
    .filter((v): v is number => v != null && v > 0)
  if (values.length === 0) return 0
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length
  return Number(Math.max(0, Math.min(1, avg)).toFixed(3))
}

function buildExecutionSummary(
  status: GrowthLeadEnginePipelineStatus,
  completed: GrowthLeadEnginePipelineStageId[],
  fatalErrors: string[],
  warnings: string[],
  durationMs: number,
): string {
  const parts = [
    `Pipeline ${status} in ${durationMs}ms.`,
    `${completed.length}/${LEAD_ENGINE_ORCHESTRATOR_STAGES.length} stages completed.`,
  ]
  if (fatalErrors.length > 0) parts.push(`Fatal: ${fatalErrors[0]}`)
  if (warnings.length > 0) parts.push(`${warnings.length} warning(s).`)
  parts.push("Fixture dry-run — no LLM providers or outbound execution.")
  return parts.join(" ")
}

function mapPublicProviderResults(
  responses: ReturnType<typeof toPublicProviderResponse>[],
): GrowthLeadEngineStageProviderPublicResult[] {
  return responses.map((r) => ({
    provider_name: r.provider_name,
    provider_type: r.provider_type,
    request_id: r.request_id,
    status: r.status,
    confidence: r.confidence,
    source_attribution_count: r.source_attribution.length,
    raw_payload_retained: r.raw_payload_retained,
    warnings: r.warnings,
    errors: r.errors,
  }))
}

function upstreamBagToRecord(bag: UpstreamBag): Record<string, unknown> {
  return {
    icp: bag.icp,
    company: bag.company,
    decisionMaker: bag.decisionMaker,
    contact: bag.contact,
    verification: bag.verification,
    brief: bag.brief,
    personalization: bag.personalization,
    leadScore: bag.leadScore,
    approval: bag.approval,
    execution: bag.execution,
  }
}

/** Execute Lead Engine prompts 1–10 sequentially with parser enforcement (fixture mode). */
export function runLeadEnginePipeline(
  input: GrowthLeadEngineSandboxInput,
  options?: LeadEnginePipelineOptions,
): GrowthLeadEnginePipelineRun {
  const providerMode = options?.providerMode ?? null
  const runId = randomUUID()
  const pipelineStart = performance.now()
  const upstream: UpstreamBag = {}
  const stageResults: GrowthLeadEngineOrchestratorStageResult[] = []
  const completedStages: GrowthLeadEnginePipelineStageId[] = []
  const fatalErrors: string[] = []
  const warningMessages: string[] = []
  const pipelineDiagnostics: string[] = []
  const evidenceChain: GrowthLeadEnginePipelineEvidenceEntry[] = []
  const attributionChain: GrowthLeadEnginePipelineAttributionEntry[] = []

  let pipelineStatus: GrowthLeadEnginePipelineStatus = "running"
  let failedStage: GrowthLeadEnginePipelineStageId | null = null
  let currentStage: GrowthLeadEnginePipelineStageId | null = null
  let stopped = false

  for (const def of LEAD_ENGINE_ORCHESTRATOR_STAGES) {
    if (stopped) {
      stageResults.push(skippedStage(def, "Skipped — upstream fatal failure."))
      continue
    }

    currentStage = def.stageId
    const missingUpstream = validateUpstreamReady(def.stageId, upstream)
    if (missingUpstream) {
      fatalErrors.push(missingUpstream)
      failedStage = def.stageId
      pipelineStatus = "stopped_fatal"
      stageResults.push({
        ...skippedStage(def, missingUpstream),
        fatal: true,
      })
      stopped = true
      continue
    }

    const stageStart = performance.now()

    let providerResultsSync: GrowthLeadEngineStageProviderPublicResult[] | undefined
    if (providerMode) {
      try {
        const bundle = fetchLeadEngineStageProviderResultsSync(
          providerMode,
          input,
          def.stageId,
          upstreamBagToRecord(upstream),
        )
        providerResultsSync = mapPublicProviderResults(bundle.public_responses)
        for (const response of bundle.responses) {
          if (response.status === "failed") {
            warningMessages.push(
              `${def.stageId}: provider ${response.provider_type} failed (isolated): ${response.errors[0] ?? "unknown"}`,
            )
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        warningMessages.push(`${def.stageId}: provider fetch error (isolated): ${message}`)
      }
    }

    const rawJson = buildRawJson(def.stageId, input, upstream)
    const parsedResult = parseStage(def.stageId, rawJson, upstream)
    const durationMs = Math.round(performance.now() - stageStart)

    const attribution = parsedResult.ok
      ? extractAttributionFromParsed(def.stageId, parsedResult.output)
      : []
    const evidence = parsedResult.ok ? extractEvidenceFromParsed(def.stageId, parsedResult.output) : null
    const warnings = parsedResult.ok
      ? evaluateStageWarnings(def.stageId, parsedResult.output, attribution)
      : []
    const fatalMessage = evaluateStageFatal(def.stageId, parsedResult.ok ? parsedResult.output : null, parsedResult.ok, parsedResult.ok ? null : parsedResult.message)

    warningMessages.push(...warnings)
    attributionChain.push(...attribution)
    if (evidence) evidenceChain.push(evidence)

    const status: GrowthLeadEngineStageCompletionStatus = parsedResult.ok
      ? "completed"
      : "failed"

    const stageResult: GrowthLeadEngineOrchestratorStageResult = {
      stage_id: def.stageId,
      label: def.label,
      short_label: def.shortLabel,
      qa_marker: def.qaMarker,
      status,
      duration_ms: durationMs,
      raw_json: rawJson,
      parsed: parsedResult.ok ? parsedResult.output : null,
      parse_ok: parsedResult.ok,
      parse_message: parsedResult.ok ? null : parsedResult.message,
      confidence: parsedResult.ok ? extractStageConfidence(def.stageId, parsedResult.output) : null,
      human_review_required: parsedResult.ok ? extractHumanReview(def.stageId, parsedResult.output) : null,
      attribution,
      evidence,
      diagnostics: buildStageDiagnostics(def.stageId, durationMs, parsedResult.ok ? parsedResult.output : null, parsedResult.ok),
      fatal: fatalMessage != null,
      warnings,
      provider_results: providerResultsSync,
    }

    stageResults.push(stageResult)
    pipelineDiagnostics.push(...stageResult.diagnostics)

    if (!parsedResult.ok) {
      fatalErrors.push(fatalMessage ?? parsedResult.message)
      failedStage = def.stageId
      pipelineStatus = "stopped_fatal"
      stopped = true
      continue
    }

    assignUpstream(def.stageId, parsedResult.output, upstream)
    completedStages.push(def.stageId)

    if (fatalMessage) {
      fatalErrors.push(fatalMessage)
      failedStage = def.stageId
      pipelineStatus = "stopped_fatal"
      stopped = true
    }
  }

  const executionDurationMs = Math.round(performance.now() - pipelineStart)

  if (!stopped && completedStages.length === LEAD_ENGINE_ORCHESTRATOR_STAGES.length) {
    pipelineStatus = "completed"
  } else if (!stopped && failedStage) {
    pipelineStatus = "failed"
  }

  const humanReviewRequired = stageResults.some((s) => s.human_review_required === true)

  return {
    run_id: runId,
    qa_marker: GROWTH_LEAD_ENGINE_ORCHESTRATOR_QA_MARKER,
    mode: "fixture_dry_run",
    provider_mode: providerMode,
    provider_adapter_qa_marker: providerMode ? GROWTH_LEAD_ENGINE_PROVIDER_ADAPTER_QA_MARKER : null,
    pipeline_status: pipelineStatus,
    current_stage: currentStage,
    completed_stages: completedStages,
    failed_stage: failedStage,
    execution_duration_ms: executionDurationMs,
    pipeline_confidence: computePipelineConfidence(stageResults),
    human_review_required: humanReviewRequired,
    stage_results: stageResults,
    pipeline_diagnostics: pipelineDiagnostics,
    pipeline_evidence_chain: evidenceChain,
    pipeline_attribution_chain: attributionChain,
    fatal_errors: fatalErrors,
    warning_messages: [...new Set(warningMessages)],
    execution_summary: buildExecutionSummary(
      pipelineStatus,
      completedStages,
      fatalErrors,
      warningMessages,
      executionDurationMs,
    ),
    input,
  }
}
