/** Stable outreach performance attribution from generation audit (Phase 4.6B). Client-safe. */

import type { OutreachPersonalizationAudit } from "@/lib/growth/outreach/personalization/personalization-types"
import type {
  OutreachOpenerStrategyKey,
  OutreachPerformanceAttributionRecord,
} from "@/lib/growth/outreach/performance/performance-types"

const RESEARCH_SUBJECT_SOURCES = new Set([
  "website_finding",
  "website_summary",
  "outreach_angle",
  "research_pain_point",
  "company_summary",
  "industry_context",
  "lead_engine_angle",
  "lead_engine_pain",
])

const RESEARCH_OPENER_SOURCES = new Set([
  "website_finding",
  "website_summary",
  "outreach_angle",
  "research_pain_point",
  "company_summary",
  "industry_context",
  "lead_engine_angle",
  "lead_engine_pain",
])

function stableHash(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function resolveOpenerStrategy(audit: OutreachPersonalizationAudit): OutreachOpenerStrategyKey {
  const openingBlock = audit.selectedBlocks.find((block) => block.key === "opening")
  if (openingBlock?.blockId === "opening_memory_backed" || audit.memoryOpener) return "memory_backed"
  if (openingBlock?.blockId === "opening_research_backed" || audit.researchOpener) return "research_backed"
  return "generic"
}

function resolveOpenerEvidenceSource(audit: OutreachPersonalizationAudit): string | null {
  if (audit.memoryOpener?.source) return audit.memoryOpener.source
  if (audit.researchOpener?.source) return audit.researchOpener.source
  return null
}

function buildSubjectStrategyKey(audit: OutreachPersonalizationAudit): string {
  const category = audit.subjectIntelligence?.category ?? "unknown"
  const source = audit.subjectIntelligence?.evidenceSource ?? "unknown"
  return `${category}:${source}`
}

function buildCtaStrategyKey(audit: OutreachPersonalizationAudit): string {
  const category = audit.ctaIntelligence?.category ?? "unknown"
  const source = audit.ctaIntelligence?.evidenceSource ?? "unknown"
  return `${category}:${source}`
}

export function buildOutreachPerformanceAttributionId(input: {
  variationKey: string
  subjectStrategyKey: string
  openerStrategyKey: OutreachOpenerStrategyKey
  openerEvidenceSource: string | null
  ctaStrategyKey: string
  generationType: string
}): string {
  const material = [
    input.generationType,
    input.variationKey,
    input.subjectStrategyKey,
    input.openerStrategyKey,
    input.openerEvidenceSource ?? "none",
    input.ctaStrategyKey,
  ].join("|")
  return `opa-v1-${stableHash(material)}`
}

export function buildOutreachPerformanceAttributionRecord(input: {
  audit: OutreachPersonalizationAudit
  generationId?: string | null
  leadId?: string | null
  recordedAt?: string
}): OutreachPerformanceAttributionRecord {
  const audit = input.audit
  const openerStrategyKey = resolveOpenerStrategy(audit)
  const openerEvidenceSource = resolveOpenerEvidenceSource(audit)
  const subjectStrategyKey = buildSubjectStrategyKey(audit)
  const ctaStrategyKey = buildCtaStrategyKey(audit)
  const subjectEvidenceSource = audit.subjectIntelligence?.evidenceSource ?? "legacy_template"
  const subjectMemoryAware = audit.subjectIntelligence?.category === "memory_aware"
  const subjectResearchBacked = RESEARCH_SUBJECT_SOURCES.has(subjectEvidenceSource)

  const attributionId = buildOutreachPerformanceAttributionId({
    variationKey: audit.variationKey,
    subjectStrategyKey,
    openerStrategyKey,
    openerEvidenceSource,
    ctaStrategyKey,
    generationType: audit.generationType,
  })

  return {
    attributionId,
    generationId: input.generationId ?? null,
    leadId: input.leadId ?? null,
    generationType: audit.generationType,
    strategyVersion: audit.strategyVersion,
    variationKey: audit.variationKey,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    subjectStrategyKey,
    subjectCategory: audit.subjectIntelligence?.category ?? "legacy_fallback",
    subjectEvidenceSource,
    subjectQualityScore: audit.subjectIntelligence?.qualityScore.overall ?? null,
    subjectMemoryAware,
    subjectResearchBacked,
    openerStrategyKey,
    openerEvidenceSource,
    openerResearchConfidenceTier: audit.researchOpener?.confidenceTier ?? null,
    openerMemoryBacked: openerStrategyKey === "memory_backed",
    openerResearchBacked:
      openerStrategyKey === "research_backed" ||
      Boolean(openerEvidenceSource && RESEARCH_OPENER_SOURCES.has(openerEvidenceSource)),
    openerGeneric: openerStrategyKey === "generic",
    ctaStrategyKey,
    ctaCategory: audit.ctaIntelligence?.category ?? "question_based",
    ctaEvidenceSource: audit.ctaIntelligence?.evidenceSource ?? "legacy_template",
    ctaQualityScore: audit.ctaIntelligence?.qualityScore.overall ?? null,
    contextUtilizationPercentage: audit.contextQuality?.utilizationPercentage ?? null,
    memoryUtilizationPercentage: audit.memoryQuality?.memoryUtilizationPercentage ?? null,
    researchConfidence: audit.contextPacket.researchConfidence,
    memoryCoverageScore: audit.contextPacket.memoryCoverageScore,
    leadEngineGuidanceUsed: Boolean(audit.contextPacket.leadEngineGuidance),
    contextSourcesUsed: audit.contextQuality?.contextSourcesUsed ?? [],
    memorySignalsUsed: audit.memoryQuality?.memorySignalsUsed ?? [],
  }
}
