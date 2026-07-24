/**
 * AVA-COMPANY-INTELLIGENCE-INTEGRATION-1A — Legacy prospect interpretation audit.
 *
 * Classifications for Ava's prior interpretation / outreach reasoning stack.
 * Do not delete broad production code in this milestone — bypass for the new path.
 */

export type AvaLegacyAuditAction =
  | "KEEP AS EVIDENCE GATHERER"
  | "KEEP AS HARD BUSINESS RULE"
  | "BYPASS"
  | "MIGRATE TO COMPANY INTELLIGENCE"
  | "MIGRATE TO AVA LAYER 3"
  | "REMOVE LATER"

export type AvaLegacyAuditItem = {
  module: string
  path: string
  action: AvaLegacyAuditAction
  notes: string
}

export const AVA_LEGACY_INTERPRETATION_AUDIT: AvaLegacyAuditItem[] = [
  {
    module: "Website / page crawl + companyEvidence_v22",
    path: "lib/growth/research/company-evidence/*",
    action: "KEEP AS EVIDENCE GATHERER",
    notes: "Layer 1 evidence. Feeds Company Intelligence; not Ava judgment.",
  },
  {
    module: "DataMoon import / lead metadata",
    path: "lib/growth/datamoon-* / lead.metadata",
    action: "KEEP AS EVIDENCE GATHERER",
    notes: "External evidence connector for CI and contact enrichment.",
  },
  {
    module: "Decision-maker repository",
    path: "lib/growth/decision-maker-repository.ts",
    action: "KEEP AS EVIDENCE GATHERER",
    notes: "Contact facts only; Ava selects among supplied contacts.",
  },
  {
    module: "Opt-out / suppression / outbound auth",
    path: "lib/growth/outbound/* + compliance gates",
    action: "KEEP AS HARD BUSINESS RULE",
    notes: "Software-authoritative. GPT must not override. Outbound stays disabled.",
  },
  {
    module: "Approved-draft immutability / persistence / audit",
    path: "lib/growth/ai-copilot-repository.ts + package review",
    action: "KEEP AS HARD BUSINESS RULE",
    notes: "Workflow controls remain outside GPT judgment.",
  },
  {
    module: "industry-classifier.ts",
    path: "lib/growth/research/industry-classifier.ts",
    action: "BYPASS",
    notes: "Not supplied to Ava CI reasoning. Remove later after production validation.",
  },
  {
    module: "website-maturity-score.ts",
    path: "lib/growth/research/website-maturity-score.ts",
    action: "BYPASS",
    notes: "UX scoring misleads sales judgment. Absent from new model context.",
  },
  {
    module: "pain-signal-detector.ts",
    path: "lib/growth/research/pain-signal-detector.ts",
    action: "BYPASS",
    notes: "Synthetic pains replaced by CI operationalChallenges.",
  },
  {
    module: "research-summary-builder.ts",
    path: "lib/growth/research/research-summary-builder.ts",
    action: "BYPASS",
    notes: "Score-sentence summaries replaced by CI executiveSummary.",
  },
  {
    module: "pitch-angle-generator.ts",
    path: "lib/growth/research/pitch-angle-generator.ts",
    action: "MIGRATE TO AVA LAYER 3",
    notes: "Sales angle now from GPT Ava reasoning (strongestAngle).",
  },
  {
    module: "company-evidence-mission-comparison.ts",
    path: "lib/growth/research/company-evidence/company-evidence-mission-comparison.ts",
    action: "BYPASS",
    notes: "Equipify-mission scoring mixed seller reasoning into understanding.",
  },
  {
    module: "company-evidence-quality-score.ts",
    path: "lib/growth/research/company-evidence/company-evidence-quality-score.ts",
    action: "KEEP AS EVIDENCE GATHERER",
    notes: "May remain as collection health; must not enter Ava model context.",
  },
  {
    module: "qualifyGrowthLeadResearch / opportunity assessment",
    path: "lib/growth/aios/growth/growth-lead-research-*",
    action: "BYPASS",
    notes: "Fit/qualification scores not used by Ava CI reasoning path.",
  },
  {
    module: "context-packet-builder.ts",
    path: "lib/growth/outreach/personalization/context-packet-builder.ts",
    action: "BYPASS",
    notes: "Fat personalization packet with scores/angles. New path does not call it.",
  },
  {
    module: "growth-outreach-sales-strategy-brief.ts",
    path: "lib/growth/aios/growth/growth-outreach-sales-strategy-brief.ts",
    action: "MIGRATE TO AVA LAYER 3",
    notes: "Strategy brief judgment superseded by runAvaReasoning for this path.",
  },
  {
    module: "recommended-next-action / refinement rewrite stages",
    path: "lib/growth/outreach/personalization/* + rewrite pipelines",
    action: "BYPASS",
    notes: "Deterministic rewrite chain bypassed; one GPT judgment call.",
  },
  {
    module: "AVA-SIMPLE-OUTREACH context (research re-assembly)",
    path: "lib/growth/ava-direct-outreach/ava-direct-outreach-context-builder.ts",
    action: "MIGRATE TO COMPANY INTELLIGENCE",
    notes: "Legacy lean path still re-assembles research. New path uses CI document.",
  },
  {
    module: "AVA-SIMPLE-OUTREACH service",
    path: "lib/growth/ava-direct-outreach/ava-direct-outreach-service.ts",
    action: "MIGRATE TO AVA LAYER 3",
    notes: "Live route unchanged this milestone. New path is runEquipifyAvaReasoning.",
  },
  {
    module: "ensureCompanyIntelligenceForGrowthLead (supervised Ava path)",
    path: "lib/fuzor/company-intelligence/ensure-company-intelligence-for-growth-lead.ts",
    action: "BYPASS",
    notes: "AVA-DIRECT-PRODUCTION-CUTOVER-1A: no longer prerequisite for live supervised Ava reasoning.",
  },
  {
    module: "runAvaReasoning via CI document (supervised cutover)",
    path: "lib/growth/ava-reasoning/equipify-supervised-cutover-service.ts (legacy)",
    action: "BYPASS",
    notes: "Replaced by website → runEquipifyAvaDirectReasoning single pass.",
  },
  {
    module: "Fuzor Company Intelligence",
    path: "lib/fuzor/company-intelligence",
    action: "KEEP AS EVIDENCE GATHERER",
    notes: "Optional post-reasoning memory via ava-direct understanding wrapper; not on critical path.",
  },
  {
    module: "Approved Business Profile / seller truth loader",
    path: "lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts",
    action: "KEEP AS EVIDENCE GATHERER",
    notes: "Equipify Knowledge Base source for deployment adapter (not renamed).",
  },
]

/** AVA-PERSISTED-OPERATOR-VALIDATION-1A — exact deletion candidates after rollback checkpoint. */
export const AVA_LEGACY_DELETE_AFTER_ROLLBACK_CHECKPOINT: AvaLegacyAuditItem[] = [
  {
    module: "industry-classifier",
    path: "lib/growth/research/industry-classifier.ts",
    action: "BYPASS",
    notes: "Deterministic industry labeling. Risk: low if no non-Ava consumers remain.",
  },
  {
    module: "website-maturity-score",
    path: "lib/growth/research/website-maturity-score.ts",
    action: "BYPASS",
    notes: "UX scoring only. Risk: verify Home/research UI does not require before delete.",
  },
  {
    module: "pain-signal-detector",
    path: "lib/growth/research/pain-signal-detector.ts",
    action: "BYPASS",
    notes: "Synthetic pain inference. Risk: research summary consumers may still import.",
  },
  {
    module: "research-summary-builder",
    path: "lib/growth/research/research-summary-builder.ts",
    action: "BYPASS",
    notes: "Score-sentence summaries. Risk: Discovery/research panels may still display.",
  },
  {
    module: "pitch-angle-generator",
    path: "lib/growth/research/pitch-angle-generator.ts",
    action: "BYPASS",
    notes: "Deterministic pitch angles. Risk: legacy personalization may reference.",
  },
  {
    module: "company-evidence-mission-comparison",
    path: "lib/growth/research/company-evidence/company-evidence-mission-comparison.ts",
    action: "BYPASS",
    notes: "Mission fit scoring. Risk: company evidence pipeline coupling.",
  },
  {
    module: "context-packet-builder",
    path: "lib/growth/outreach/personalization/context-packet-builder.ts",
    action: "BYPASS",
    notes: "Fat personalization packet. Risk: draft-factory / 5F path may still call.",
  },
  {
    module: "growth-outreach-sales-strategy-brief",
    path: "lib/growth/aios/growth/growth-outreach-sales-strategy-brief.ts",
    action: "MIGRATE TO AVA LAYER 3",
    notes: "Strategy brief superseded for supervised Ava. Risk: other orchestration paths.",
  },
  {
    module: "AVA-SIMPLE-OUTREACH context builder",
    path: "lib/growth/ava-direct-outreach/ava-direct-outreach-context-builder.ts",
    action: "MIGRATE TO COMPANY INTELLIGENCE",
    notes: "Legacy lean re-assembly. Risk: runAvaDirectOutreach still importable.",
  },
  {
    module: "AVA-SIMPLE-OUTREACH service",
    path: "lib/growth/ava-direct-outreach/ava-direct-outreach-service.ts",
    action: "MIGRATE TO AVA LAYER 3",
    notes: "Superseded by equipify-supervised-cutover-service. Risk: old scripts/tests reference.",
  },
  {
    module: "ensureCompanyIntelligenceForGrowthLead (Ava prerequisite)",
    path: "lib/fuzor/company-intelligence/ensure-company-intelligence-for-growth-lead.ts",
    action: "BYPASS",
    notes: "Do NOT delete CI platform — only remove Ava-path mandatory ensure wiring after rollback.",
  },
  {
    module: "Personalization rewrite / refinement stages",
    path: "lib/growth/outreach/personalization/* + rewrite pipelines",
    action: "BYPASS",
    notes: "Multi-stage rewrite chain. Risk: sequence enrollment / draft-factory still uses 5F engine.",
  },
  {
    module: "qualifyGrowthLeadResearch / opportunity assessment scoring",
    path: "lib/growth/aios/growth/growth-lead-research-*",
    action: "BYPASS",
    notes: "Fit/qualification scores. Risk: Home metrics and research UX may still surface.",
  },
]

/** Immediate bypass for the validation / new Ava CI path. */
export function modulesToBypassImmediately(): AvaLegacyAuditItem[] {
  return AVA_LEGACY_INTERPRETATION_AUDIT.filter((i) => i.action === "BYPASS")
}

/** Delete only after supervised production equivalence is proven. */
export function modulesToDeleteAfterValidation(): AvaLegacyAuditItem[] {
  return AVA_LEGACY_INTERPRETATION_AUDIT.filter(
    (i) =>
      i.action === "BYPASS" ||
      i.path.includes("industry-classifier") ||
      i.path.includes("website-maturity") ||
      i.path.includes("pain-signal") ||
      i.path.includes("pitch-angle") ||
      i.path.includes("mission-comparison"),
  )
}
