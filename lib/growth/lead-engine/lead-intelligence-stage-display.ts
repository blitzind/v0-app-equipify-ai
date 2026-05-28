/** Lead Intelligence Inspector — stage UX states and operator summaries. Client-safe. */

import type { GrowthLeadEngineOrchestratorStageResult } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthLeadEnginePipelineStageId } from "@/lib/growth/lead-engine/workspace-types"

export const LEAD_INTELLIGENCE_STAGE_UX_STATES = [
  "awaiting_input",
  "queued",
  "running",
  "evidence_ready",
  "needs_review",
  "blocked",
  "confidence_low",
  "completed",
] as const

export type LeadIntelligenceStageUxState = (typeof LEAD_INTELLIGENCE_STAGE_UX_STATES)[number]

export type LeadIntelligenceConfidenceBand = "high" | "medium" | "low" | "unknown"

export type LeadIntelligenceStageOperatorSummary = {
  executiveSummary: string
  keyFindings: string[]
  confidencePercent: number | null
  confidenceBand: LeadIntelligenceConfidenceBand
  confidenceReasoning: string[]
  risksAndMissingData: string[]
  recommendedAction: string
  evidenceCount: number
  signalChips: string[]
  operatorGuidance: string | null
}

export type LeadIntelligenceStageDisplayContext = {
  hasRun: boolean
  loading: boolean
  runStatus: string | null
  completedStageIds: string[]
  currentStageId: string | null
  isSampleMode: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function pushString(lines: string[], value: unknown) {
  if (typeof value === "string" && value.trim()) lines.push(value.trim())
}

function pushStrings(lines: string[], values: unknown[], limit = 6) {
  for (const v of values.slice(0, limit)) {
    if (typeof v === "string" && v.trim()) lines.push(v.trim())
  }
}

export function normalizeStageConfidencePercent(confidence: number | null): number | null {
  if (confidence == null || Number.isNaN(confidence)) return null
  if (confidence <= 1) return Math.round(confidence * 100)
  return Math.round(Math.min(100, confidence))
}

export function resolveConfidenceBand(percent: number | null): LeadIntelligenceConfidenceBand {
  if (percent == null) return "unknown"
  if (percent >= 80) return "high"
  if (percent >= 55) return "medium"
  return "low"
}

export function countStageEvidenceItems(stage: GrowthLeadEngineOrchestratorStageResult): number {
  let count = stage.evidence?.items.length ?? 0
  count += stage.attribution.length
  const parsed = asRecord(stage.parsed)
  if (parsed) {
    count += asArray(parsed.source_evidence).length
    count += asArray(parsed.source_attribution).length
    count += asArray(parsed.verification_source_attribution).length
    for (const contact of asArray(parsed.contact_candidates)) {
      const c = asRecord(contact)
      count += asArray(c?.source_evidence).length
    }
  }
  return count
}

export function resolveLeadIntelligenceStageUxState(
  stage: GrowthLeadEngineOrchestratorStageResult,
  ctx: LeadIntelligenceStageDisplayContext,
): LeadIntelligenceStageUxState {
  if (ctx.loading && ctx.currentStageId === stage.stage_id) return "running"
  if (ctx.loading && !ctx.hasRun && stage.status === "pending") return "queued"

  if (stage.status === "pending") {
    if (!ctx.hasRun) return "awaiting_input"
    const stageOrder = [
      "icp_targeting",
      "company_discovery",
      "decision_maker_hypothesis",
      "contact_research",
      "verification_triage",
      "account_brief",
      "outreach_personalization",
      "lead_score",
      "human_approval",
      "revenue_execution",
    ]
    const idx = stageOrder.indexOf(stage.stage_id)
    const priorIncomplete = stageOrder
      .slice(0, idx)
      .some((id) => !ctx.completedStageIds.includes(id))
    if (priorIncomplete) return "queued"
    return "awaiting_input"
  }

  if (stage.status === "failed" || stage.fatal || stage.status === "skipped") return "blocked"
  if (stage.human_review_required) return "needs_review"

  const confidencePercent = normalizeStageConfidencePercent(stage.confidence)
  if (confidencePercent != null && confidencePercent < 55) return "confidence_low"

  const evidenceCount = countStageEvidenceItems(stage)
  if (stage.status === "completed" && evidenceCount > 0) return "evidence_ready"
  if (stage.status === "completed") return "completed"

  return "blocked"
}

export const LEAD_INTELLIGENCE_STAGE_UX_STATE_META: Record<
  LeadIntelligenceStageUxState,
  { label: string; helperText: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  awaiting_input: {
    label: "Awaiting input",
    helperText: "Run the pipeline to execute this stage.",
    tone: "neutral",
  },
  queued: {
    label: "Queued",
    helperText: "Waiting for upstream stages to complete.",
    tone: "info",
  },
  running: {
    label: "Running",
    helperText: "Stage is executing now.",
    tone: "info",
  },
  evidence_ready: {
    label: "Evidence ready",
    helperText: "Structured intelligence available for operator review.",
    tone: "success",
  },
  needs_review: {
    label: "Needs review",
    helperText: "Human operator should validate before outreach.",
    tone: "warning",
  },
  blocked: {
    label: "Blocked",
    helperText: "Stage failed or was skipped — review diagnostics.",
    tone: "danger",
  },
  confidence_low: {
    label: "Low confidence",
    helperText: "Evidence is thin — enrich or verify before acting.",
    tone: "warning",
  },
  completed: {
    label: "Completed",
    helperText: "Stage finished — review summary and evidence.",
    tone: "success",
  },
}

function buildGenericSummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
): LeadIntelligenceStageOperatorSummary {
  const confidencePercent = normalizeStageConfidencePercent(stage.confidence)
  const findings: string[] = []
  if (stage.evidence?.summary) findings.push(stage.evidence.summary)
  for (const item of stage.evidence?.items.slice(0, 4) ?? []) {
    findings.push(item.claim ? `${item.claim}: ${item.evidence}` : item.evidence)
  }
  if (!findings.length && stage.parse_message) findings.push(stage.parse_message)

  return {
    executiveSummary: stage.evidence?.summary ?? `${stage.label} completed.`,
    keyFindings: findings.length ? findings : ["Review evidence panel for stage outputs."],
    confidencePercent,
    confidenceBand: resolveConfidenceBand(confidencePercent),
    confidenceReasoning: stage.diagnostics.slice(0, 3),
    risksAndMissingData: stage.warnings,
    recommendedAction: stage.human_review_required
      ? "Review flagged items before outreach."
      : "Proceed to next pipeline stage.",
    evidenceCount: countStageEvidenceItems(stage),
    signalChips: [],
    operatorGuidance: null,
  }
}

function buildIcpTargetingSummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
  root: Record<string, unknown>,
): LeadIntelligenceStageOperatorSummary {
  const rules = asRecord(root.qualification_rules)
  const roles = asRecord(root.target_roles)
  const weights = asRecord(root.fit_scoring_weights)
  const confidenceRules = asRecord(root.confidence_rules)

  const findings: string[] = []
  pushString(findings, root.icp_summary)
  pushStrings(findings, asArray(rules?.must_have))
  pushStrings(findings, asArray(root.pain_point_patterns))
  pushStrings(findings, asArray(root.buying_trigger_patterns))

  const chips: string[] = []
  pushStrings(chips, asArray(roles?.primary), 3)
  pushStrings(chips, asArray(root.pain_point_patterns), 2)

  const risks: string[] = []
  pushStrings(risks, asArray(rules?.disqualifiers))
  if (confidenceRules?.low_fit) risks.push(String(confidenceRules.low_fit))

  const weightEntries = weights
    ? Object.entries(weights)
        .sort(([, a], [, b]) => Number(b) - Number(a))
        .slice(0, 3)
        .map(([k, v]) => `${k.replace(/_/g, " ")} ${v}%`)
    : []

  return {
    executiveSummary:
      typeof root.icp_summary === "string"
        ? root.icp_summary
        : "ICP targeting rules computed from operator input.",
    keyFindings: findings.length ? findings : ["ICP qualification rules generated."],
    confidencePercent: normalizeStageConfidencePercent(stage.confidence) ?? 75,
    confidenceBand: "medium",
    confidenceReasoning: weightEntries.length
      ? [`Top scoring dimensions: ${weightEntries.join(", ")}`]
      : ["Deterministic ICP rules from operator context."],
    risksAndMissingData: risks.length ? risks : ["No company-specific fit score until discovery runs."],
    recommendedAction: "Run company discovery to validate ICP match against account evidence.",
    evidenceCount: countStageEvidenceItems(stage),
    signalChips: chips,
    operatorGuidance: "ICP stage sets targeting rules — it does not score a specific company yet.",
  }
}

function buildCompanyDiscoverySummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
  root: Record<string, unknown>,
): LeadIntelligenceStageOperatorSummary {
  const profile = asRecord(root.company_profile)
  const fit = asRecord(root.fit_assessment)
  const signals = asRecord(root.signals)
  const next = asRecord(root.recommended_next_step)

  const findings: string[] = []
  if (profile?.company_name) findings.push(`Company: ${profile.company_name}`)
  if (profile?.industry) findings.push(`Industry: ${profile.industry}`)
  if (fit?.fit_tier) findings.push(`Fit tier: ${fit.fit_tier}${fit.fit_score != null ? ` (${fit.fit_score})` : ""}`)
  pushStrings(findings, asArray(signals?.pain_signals))
  pushStrings(findings, asArray(signals?.growth_signals))
  pushStrings(findings, asArray(signals?.technology_signals))

  const chips: string[] = []
  pushStrings(chips, asArray(signals?.positive_fit_signals), 2)
  pushStrings(chips, asArray(signals?.buying_triggers), 2)
  if (profile?.business_model) chips.push(String(profile.business_model))

  const risks = [
    ...asArray(fit?.missing_evidence).filter((v): v is string => typeof v === "string"),
    ...asArray(signals?.negative_fit_signals).filter((v): v is string => typeof v === "string"),
  ]

  const fitConfidence =
    typeof fit?.confidence === "number" ? normalizeStageConfidencePercent(fit.confidence) : null

  return {
    executiveSummary:
      typeof profile?.company_name === "string"
        ? `${profile.company_name} — ${profile.industry ?? "industry unknown"} with ${fit?.fit_tier ?? "unscored"} ICP fit.`
        : "Company profile extracted from available evidence.",
    keyFindings: findings,
    confidencePercent: fitConfidence ?? normalizeStageConfidencePercent(stage.confidence),
    confidenceBand: resolveConfidenceBand(fitConfidence ?? normalizeStageConfidencePercent(stage.confidence)),
    confidenceReasoning: asArray(fit?.matched_icp_rules).filter((v): v is string => typeof v === "string"),
    risksAndMissingData: risks.length ? risks : stage.warnings,
    recommendedAction:
      typeof next?.action === "string"
        ? `${next.action.replace(/_/g, " ")} — ${next.reason ?? ""}`.trim()
        : "Proceed to decision-maker hypothesis.",
    evidenceCount: countStageEvidenceItems(stage),
    signalChips: chips,
    operatorGuidance: risks.length
      ? "Partial discovery — treat missing evidence as confidence penalties."
      : null,
  }
}

function buildDecisionMakerSummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
  root: Record<string, unknown>,
): LeadIntelligenceStageOperatorSummary {
  const committee = asRecord(root.buying_committee)
  const strategy = asRecord(root.recommended_targeting_strategy)
  const completeness = asRecord(root.committee_completeness)
  const confidence = asRecord(root.confidence_assessment)

  const primary = asArray(committee?.primary_targets)
  const secondary = asArray(committee?.secondary_targets)

  const findings: string[] = []
  if (strategy?.primary_motion) {
    findings.push(`Primary motion: ${strategy.primary_motion} — ${strategy.reason ?? ""}`.trim())
  }
  for (const row of primary.slice(0, 3)) {
    const r = asRecord(row)
    if (r?.role) {
      findings.push(
        `Primary buyer role: ${r.role}${r.confidence != null ? ` (${Math.round(Number(r.confidence) * 100)}% confidence)` : ""} — ${r.reason ?? "ICP-aligned"}`,
      )
    }
  }
  for (const row of secondary.slice(0, 2)) {
    const r = asRecord(row)
    if (r?.role) findings.push(`Influencer: ${r.role}`)
  }

  const chips = primary
    .map((row) => asRecord(row)?.role)
    .filter((v): v is string => typeof v === "string")
    .slice(0, 4)

  const risks = asArray(completeness?.critical_missing_roles).filter(
    (v): v is string => typeof v === "string",
  )
  for (const row of asArray(committee?.avoid_roles)) {
    const r = asRecord(row)
    if (r?.role) risks.push(`Avoid: ${r.role}`)
  }

  const score =
    typeof confidence?.score === "number" ? Math.round(confidence.score) : normalizeStageConfidencePercent(stage.confidence)

  return {
    executiveSummary:
      "Role hypotheses only — no invented contacts. Buying committee inferred from ICP and company profile.",
    keyFindings: findings.length ? findings : ["Buying committee roles hypothesized."],
    confidencePercent: score,
    confidenceBand: resolveConfidenceBand(score),
    confidenceReasoning: asArray(confidence?.reasoning).filter((v): v is string => typeof v === "string"),
    risksAndMissingData: risks.length ? risks : ["Contact names require contact research stage."],
    recommendedAction: "Run contact research to find evidenced people matching these roles.",
    evidenceCount: countStageEvidenceItems(stage),
    signalChips: chips,
    operatorGuidance: "Do not outreach to invented names — use role hypotheses to guide discovery.",
  }
}

function buildContactResearchSummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
  root: Record<string, unknown>,
): LeadIntelligenceStageOperatorSummary {
  const contacts = asArray(root.contact_candidates)
  const coverage = asRecord(root.coverage)
  const quality = asRecord(root.research_quality)

  const findings: string[] = []
  findings.push(`${contacts.length} contact candidate(s) discovered`)
  if (coverage?.committee_completion != null) {
    findings.push(`Committee coverage: ${coverage.committee_completion}%`)
  }
  for (const row of contacts.slice(0, 3)) {
    const c = asRecord(row)
    if (!c) continue
    const name = c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(" ")
    const conf = c.confidence != null ? ` (${Math.round(Number(c.confidence) * 100)}%)` : ""
    findings.push(`${name || "Contact"} — ${c.job_title ?? "title unknown"}${conf}`)
  }
  pushStrings(findings, asArray(coverage?.missing_roles).map((r) => `Missing role: ${r}`))

  const chips: string[] = []
  pushStrings(chips, asArray(coverage?.primary_roles_found))

  const risks: string[] = []
  if (contacts.length === 0) risks.push("No contacts discovered — manual research required")
  pushStrings(risks, asArray(quality?.reasoning))

  const qualityScore = typeof quality?.score === "number" ? Math.round(quality.score) : null

  return {
    executiveSummary:
      contacts.length > 0
        ? `${contacts.length} evidenced contact(s) with role alignment — review before outreach.`
        : "No evidenced contacts found — enrichment or manual review required.",
    keyFindings: findings,
    confidencePercent: qualityScore ?? normalizeStageConfidencePercent(stage.confidence),
    confidenceBand: resolveConfidenceBand(qualityScore ?? normalizeStageConfidencePercent(stage.confidence)),
    confidenceReasoning: asArray(quality?.reasoning).filter((v): v is string => typeof v === "string"),
    risksAndMissingData: [...risks, ...stage.warnings],
    recommendedAction:
      contacts.length > 0
        ? "Review contacts and send to verification triage."
        : "Request enrichment or add manual contacts in Lead Inbox.",
    evidenceCount: countStageEvidenceItems(stage),
    signalChips: chips,
    operatorGuidance: "Operator actions: review contacts, request enrichment, send to verification.",
  }
}

function buildVerificationSummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
  root: Record<string, unknown>,
): LeadIntelligenceStageOperatorSummary {
  const disposition = root.disposition
  const email = asRecord(root.email_verification_signals)
  const duplicate = asRecord(root.duplicate_detection_readiness)

  const findings: string[] = []
  if (disposition) findings.push(`Disposition: ${disposition}`)
  if (root.verification_confidence != null) {
    findings.push(`Verification confidence: ${Math.round(Number(root.verification_confidence) * 100)}%`)
  }
  if (email?.status) findings.push(`Email: ${email.status} — ${email.evidence ?? ""}`.trim())
  if (root.contact_completeness != null) {
    findings.push(`Contact completeness: ${Math.round(Number(root.contact_completeness) * 100)}%`)
  }
  if (root.risk_score != null) findings.push(`Risk score: ${root.risk_score}`)

  const reasonCodes = asArray(root.verification_reason_codes).filter((v): v is string => typeof v === "string")
  const chips = [...reasonCodes.slice(0, 4)]
  if (disposition === "validated") chips.unshift("validated")
  if (disposition === "risky") chips.unshift("risky")
  if (disposition === "reject") chips.unshift("reject")

  const risks: string[] = []
  if (duplicate?.ready === false && duplicate.reason) risks.push(String(duplicate.reason))
  if (disposition === "reject") risks.push("Outreach blocked — verification rejected")
  if (disposition === "risky") risks.push("Elevated outreach risk — human review recommended")
  pushStrings(risks, reasonCodes.filter((c) => c.includes("STALE") || c.includes("RISK")))

  const conf =
    typeof root.verification_confidence === "number"
      ? normalizeStageConfidencePercent(root.verification_confidence)
      : normalizeStageConfidencePercent(stage.confidence)

  return {
    executiveSummary: `Trust evaluation: ${disposition ?? "pending"} — risk and duplicate signals assessed.`,
    keyFindings: findings.length ? findings : ["Verification triage completed."],
    confidencePercent: conf,
    confidenceBand: resolveConfidenceBand(conf),
    confidenceReasoning: reasonCodes.map((c) => c.replace(/_/g, " ").toLowerCase()),
    risksAndMissingData: risks.length ? risks : stage.warnings,
    recommendedAction:
      disposition === "validated"
        ? "Proceed to account brief — contacts pass trust threshold."
        : disposition === "risky"
          ? "Hold outreach — operator override or additional verification required."
          : "Blocked — resolve verification issues before continuing.",
    evidenceCount: countStageEvidenceItems(stage),
    signalChips: chips,
    operatorGuidance: "Operator may override with documented reason in Lead Inbox.",
  }
}

function buildAccountBriefSummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
  root: Record<string, unknown>,
): LeadIntelligenceStageOperatorSummary {
  const findings: string[] = []
  pushString(findings, root.company_summary)
  pushString(findings, root.why_this_account)
  pushString(findings, root.recommended_angle)
  pushStrings(findings, asArray(root.recommended_value_props))
  for (const row of asArray(root.pain_points).slice(0, 3)) {
    const p = asRecord(row)
    if (p?.claim) findings.push(`Pain: ${p.claim}`)
  }
  for (const row of asArray(root.buying_signals).slice(0, 2)) {
    const b = asRecord(row)
    if (b?.claim) findings.push(`Buying signal: ${b.claim}`)
  }

  const chips: string[] = []
  pushStrings(chips, asArray(root.recommended_value_props), 3)
  if (root.recommended_cta) chips.push("CTA ready")

  const risks: string[] = []
  if (root.risk_summary) risks.push(String(root.risk_summary))
  if (root.human_review_required) risks.push("Human review flagged on brief")

  const conf =
    typeof root.research_confidence === "number"
      ? normalizeStageConfidencePercent(root.research_confidence)
      : normalizeStageConfidencePercent(stage.confidence)

  return {
    executiveSummary:
      typeof root.company_summary === "string"
        ? root.company_summary
        : "Sales-ready account brief synthesized from upstream evidence.",
    keyFindings: findings.length ? findings : ["Account brief generated."],
    confidencePercent: conf,
    confidenceBand: resolveConfidenceBand(conf),
    confidenceReasoning: [String(root.evidence_summary ?? "Evidence chain from discovery through verification")],
    risksAndMissingData: risks,
    recommendedAction: typeof root.recommended_cta === "string" ? root.recommended_cta : "Use brief for discovery call prep.",
    evidenceCount: countStageEvidenceItems(stage),
    signalChips: chips,
    operatorGuidance: "Sales-ready before first contact — all claims should trace to evidence panel.",
  }
}

function buildOutreachPersonalizationSummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
  root: Record<string, unknown>,
): LeadIntelligenceStageOperatorSummary {
  const findings: string[] = []
  pushString(findings, root.personalization_summary)
  pushString(findings, root.recommended_cta_strategy)
  for (const row of asArray(root.recommended_talking_points).slice(0, 3)) {
    const t = asRecord(row)
    if (t?.claim) findings.push(`Talking point: ${t.claim}`)
  }
  pushStrings(findings, asArray(root.recommended_business_outcomes))
  pushStrings(findings, asArray(root.recommended_channel_priority).map((c) => `Channel: ${c}`))

  const chips: string[] = []
  pushStrings(chips, asArray(root.recommended_channel_priority))
  pushStrings(chips, asArray(root.recommended_social_proof_types))

  const conf =
    typeof root.personalization_confidence === "number"
      ? normalizeStageConfidencePercent(root.personalization_confidence)
      : normalizeStageConfidencePercent(stage.confidence)

  return {
    executiveSummary:
      typeof root.personalization_summary === "string"
        ? root.personalization_summary
        : "Outreach personalization drafts — operator review required before send.",
    keyFindings: findings.length ? findings : ["Personalization angles drafted from account brief."],
    confidencePercent: conf,
    confidenceBand: resolveConfidenceBand(conf),
    confidenceReasoning: [String(root.evidence_summary ?? "Derived from account brief evidence")],
    risksAndMissingData: root.human_review_required ? ["Human review required — do not auto-send"] : stage.warnings,
    recommendedAction: "Review messaging drafts in Lead Inbox before any outbound execution.",
    evidenceCount: countStageEvidenceItems(stage),
    signalChips: chips,
    operatorGuidance: "Draft only — no autonomous outreach or campaign creation.",
  }
}

function buildLeadScoreSummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
  root: Record<string, unknown>,
): LeadIntelligenceStageOperatorSummary {
  const breakdown = asRecord(root.score_breakdown)
  const components = asArray(breakdown?.components)
  const penalties = asArray(breakdown?.risk_penalties)

  const findings: string[] = []
  if (root.lead_score != null) findings.push(`Lead score: ${root.lead_score}${root.lead_grade ? ` (grade ${root.lead_grade})` : ""}`)
  if (root.priority_level) findings.push(`Priority: ${root.priority_level}`)
  pushString(findings, root.score_explanation)
  if (root.fit_score != null) findings.push(`Fit: ${root.fit_score}`)
  if (root.intent_score != null) findings.push(`Intent/urgency: ${root.intent_score}`)
  if (root.contactability_score != null) findings.push(`Readiness/contactability: ${root.contactability_score}`)
  if (root.verification_score != null) findings.push(`Verification: ${root.verification_score}`)
  if (root.risk_score != null) findings.push(`Risk: ${root.risk_score}`)

  for (const row of components.slice(0, 4)) {
    const c = asRecord(row)
    if (c?.component) findings.push(`${String(c.component).replace(/_/g, " ")}: ${c.score} (weight ${c.weight})`)
  }

  const positiveContributors = components
    .map((row) => asRecord(row))
    .filter((c) => c && Number(c.score) >= 70)
    .map((c) => `${String(c!.component).replace(/_/g, " ")} +${c!.contribution ?? c!.score}`)

  const chips = [
    root.lead_grade ? `Grade ${root.lead_grade}` : null,
    root.priority_level ? String(root.priority_level) : null,
    root.recommended_next_action ? String(root.recommended_next_action).replace(/_/g, " ") : null,
  ].filter((v): v is string => Boolean(v))

  const risks = [
    ...penalties.map((row) => {
      const p = asRecord(row)
      return p ? `${p.code}: -${p.penalty} (${p.evidence})` : null
    }),
    ...asArray(root.disqualification_reasons).filter((v): v is string => typeof v === "string"),
  ].filter((v): v is string => Boolean(v))

  return {
    executiveSummary:
      typeof root.score_explanation === "string"
        ? root.score_explanation
        : `Lead scored ${root.lead_score ?? "—"} with transparent component breakdown.`,
    keyFindings: findings,
    confidencePercent: typeof root.lead_score === "number" ? Math.round(Number(root.lead_score)) : normalizeStageConfidencePercent(stage.confidence),
    confidenceBand: resolveConfidenceBand(typeof root.lead_score === "number" ? Math.round(Number(root.lead_score)) : normalizeStageConfidencePercent(stage.confidence)),
    confidenceReasoning: positiveContributors.length
      ? [`Positive contributors: ${positiveContributors.join(", ")}`]
      : ["Component-weighted deterministic score."],
    risksAndMissingData: risks.length ? risks : stage.warnings,
    recommendedAction:
      typeof root.recommended_next_action === "string"
        ? root.recommended_next_action.replace(/_/g, " ")
        : "Route to human approval.",
    evidenceCount: countStageEvidenceItems(stage),
    signalChips: chips,
    operatorGuidance: "Score explains routing — not an autonomous approval.",
  }
}

function buildHumanApprovalSummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
  root: Record<string, unknown>,
): LeadIntelligenceStageOperatorSummary {
  const findings: string[] = []
  if (root.approval_status) findings.push(`Status: ${root.approval_status}`)
  pushString(findings, root.approval_summary)
  pushStrings(findings, asArray(root.approval_reason_codes).map((c) => String(c).replace(/_/g, " ")))
  pushStrings(findings, asArray(root.required_review_areas).map((a) => `Review: ${a}`))
  pushStrings(findings, asArray(root.recommended_human_actions))

  for (const row of asArray(root.approval_blockers)) {
    const b = asRecord(row)
    if (b?.code) findings.push(`Blocker: ${b.code} — ${b.message ?? ""}`.trim())
  }

  const chips = asArray(root.approval_reason_codes)
    .filter((v): v is string => typeof v === "string")
    .slice(0, 4)
  if (root.approval_status) chips.unshift(String(root.approval_status))

  const conf =
    typeof root.approval_confidence === "number"
      ? normalizeStageConfidencePercent(root.approval_confidence)
      : normalizeStageConfidencePercent(stage.confidence)

  const risks: string[] = []
  if (root.approval_status === "blocked") risks.push("Approval blocked — resolve blockers")
  if (root.escalation_required) risks.push(String(root.escalation_reason ?? "Escalation required"))
  pushStrings(risks, asArray(root.approval_blockers).map((row) => {
    const b = asRecord(row)
    return b?.message ? String(b.message) : null
  }))

  return {
    executiveSummary:
      typeof root.approval_summary === "string"
        ? root.approval_summary
        : "Final operational review checkpoint — human decision required.",
    keyFindings: findings.length ? findings : ["Approval routing computed."],
    confidencePercent: conf,
    confidenceBand: resolveConfidenceBand(conf),
    confidenceReasoning: asArray(root.approval_reason_codes).filter((v): v is string => typeof v === "string"),
    risksAndMissingData: risks.length ? risks : stage.warnings,
    recommendedAction: "Operator checklist: approve, hold, request more research, or reject in Lead Inbox.",
    evidenceCount: countStageEvidenceItems(stage),
    signalChips: chips,
    operatorGuidance: "No autonomous approval — operator must explicitly decide.",
  }
}

function buildRevenueExecutionSummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
  root: Record<string, unknown>,
): LeadIntelligenceStageOperatorSummary {
  const findings: string[] = []
  if (root.execution_status) findings.push(`Execution status: ${root.execution_status}`)
  if (root.execution_readiness != null) findings.push(`Readiness: ${root.execution_readiness}%`)
  if (root.recommended_execution_path) findings.push(`Path: ${String(root.recommended_execution_path).replace(/_/g, " ")}`)
  pushStrings(findings, asArray(root.recommended_channels).map((c) => `Channel: ${c}`))
  pushString(findings, root.recommended_followup_strategy)
  for (const row of asArray(root.recommended_sequence_steps).slice(0, 3)) {
    const s = asRecord(row)
    if (s?.channel) findings.push(`Step ${s.step_order}: ${s.channel} — ${s.action_category ?? ""}`)
  }

  const blockers = asArray(root.execution_blockers)
  for (const row of blockers) {
    const b = asRecord(row)
    if (b?.code) findings.push(`Blocker: ${b.code}`)
  }

  const chips: string[] = []
  pushStrings(chips, asArray(root.recommended_channels))
  if (root.recommended_sequence) chips.push(String(root.recommended_sequence).replace(/_/g, " "))
  if (root.recommended_owner_type) chips.push(String(root.recommended_owner_type))

  const conf =
    typeof root.execution_confidence === "number"
      ? normalizeStageConfidencePercent(root.execution_confidence)
      : normalizeStageConfidencePercent(stage.confidence)

  return {
    executiveSummary:
      typeof root.evidence_summary === "string"
        ? root.evidence_summary
        : "Revenue execution readiness — sequences, calls, and follow-up strategy.",
    keyFindings: findings.length ? findings : ["Execution plan drafted."],
    confidencePercent: conf,
    confidenceBand: resolveConfidenceBand(conf),
    confidenceReasoning: [
      root.human_execution_required ? "Human execution required — no auto-launch" : "Execution guidance only",
    ],
    risksAndMissingData: blockers.length
      ? blockers.map((row) => {
          const b = asRecord(row)
          return b?.message ? String(b.message) : String(b?.code ?? "blocker")
        })
      : stage.warnings,
    recommendedAction:
      typeof root.recommended_handoff === "string"
        ? `${root.recommended_handoff.replace(/_/g, " ")} — assign owner in Lead Inbox`
        : "Review sequence readiness and launch manually from Growth Engine.",
    evidenceCount: countStageEvidenceItems(stage),
    signalChips: chips,
    operatorGuidance:
      "Integrates with calls, meetings, sequences, and opportunities — operator launches all motions.",
  }
}

export function buildLeadIntelligenceStageOperatorSummary(
  stage: GrowthLeadEngineOrchestratorStageResult,
): LeadIntelligenceStageOperatorSummary {
  if (stage.status === "pending" || !stage.parsed) {
    return {
      executiveSummary: "",
      keyFindings: [],
      confidencePercent: null,
      confidenceBand: "unknown",
      confidenceReasoning: [],
      risksAndMissingData: [],
      recommendedAction: "",
      evidenceCount: 0,
      signalChips: [],
      operatorGuidance: null,
    }
  }

  const root = asRecord(stage.parsed)
  if (!root) return buildGenericSummary(stage)

  switch (stage.stage_id as GrowthLeadEnginePipelineStageId) {
    case "icp_targeting":
      return buildIcpTargetingSummary(stage, root)
    case "company_discovery":
      return buildCompanyDiscoverySummary(stage, root)
    case "decision_maker_hypothesis":
      return buildDecisionMakerSummary(stage, root)
    case "contact_research":
      return buildContactResearchSummary(stage, root)
    case "verification_triage":
      return buildVerificationSummary(stage, root)
    case "account_brief":
      return buildAccountBriefSummary(stage, root)
    case "outreach_personalization":
      return buildOutreachPersonalizationSummary(stage, root)
    case "lead_score":
      return buildLeadScoreSummary(stage, root)
    case "human_approval":
      return buildHumanApprovalSummary(stage, root)
    case "revenue_execution":
      return buildRevenueExecutionSummary(stage, root)
    default:
      return buildGenericSummary(stage)
  }
}

export type LeadIntelligenceEvidenceItem = {
  id: string
  claim: string
  evidence: string
  source: string
  confidencePercent: number | null
  kind: "evidence" | "attribution" | "signal"
}

export function collectLeadIntelligenceEvidenceItems(
  stage: GrowthLeadEngineOrchestratorStageResult,
): LeadIntelligenceEvidenceItem[] {
  const items: LeadIntelligenceEvidenceItem[] = []
  let idx = 0

  for (const row of stage.evidence?.items ?? []) {
    items.push({
      id: `${stage.stage_id}-ev-${idx++}`,
      claim: row.claim || "Claim",
      evidence: row.evidence,
      source: row.source,
      confidencePercent: null,
      kind: "evidence",
    })
  }

  for (const row of stage.attribution) {
    items.push({
      id: `${stage.stage_id}-attr-${idx++}`,
      claim: `${row.source} · ${row.section}`,
      evidence: row.evidence,
      source: row.signal,
      confidencePercent: normalizeStageConfidencePercent(row.confidence),
      kind: "attribution",
    })
  }

  const parsed = asRecord(stage.parsed)
  if (parsed) {
    for (const row of asArray(parsed.source_evidence)) {
      const e = asRecord(row)
      if (!e) continue
      items.push({
        id: `${stage.stage_id}-src-${idx++}`,
        claim: String(e.claim ?? "Source evidence"),
        evidence: String(e.evidence ?? ""),
        source: String(e.source ?? "upstream"),
        confidencePercent: e.confidence != null ? normalizeStageConfidencePercent(Number(e.confidence)) : null,
        kind: "evidence",
      })
    }
    for (const row of asArray(parsed.source_attribution)) {
      const a = asRecord(row)
      if (!a) continue
      items.push({
        id: `${stage.stage_id}-psa-${idx++}`,
        claim: `${a.source} · ${a.section}`,
        evidence: String(a.evidence ?? ""),
        source: String(a.signal ?? ""),
        confidencePercent: a.confidence != null ? normalizeStageConfidencePercent(Number(a.confidence)) : null,
        kind: "attribution",
      })
    }
  }

  return items
}
