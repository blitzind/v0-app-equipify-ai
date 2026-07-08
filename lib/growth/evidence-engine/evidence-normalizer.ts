/** GE-AIOS-8A-1 — Normalize provider output into canonical evidence and facts (client-safe). */

import {
  applyStaleEvidencePenalty,
  buildEvidenceConfidence,
  defaultFreshnessConfidence,
  mergeFactConfidence,
} from "@/lib/growth/evidence-engine/evidence-confidence"
import type {
  AvaEvidenceItem,
  AvaFact,
  EvidenceCollectionResult,
  EvidenceEngineDecisionTier,
  EvidenceEngineLifecycleStatus,
  EvidenceEngineProvider,
  EvidenceProviderCollectionOutput,
  EvidenceProviderRawItem,
} from "@/lib/growth/evidence-engine/evidence-engine-types"
import {
  decisionTierRank,
  isLowerTrustDecisionTier,
  type EvidenceEngineDecisionTier,
} from "@/lib/growth/evidence-engine/evidence-engine-types"

const FACT_KEY_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*)*$/

export function normalizeFactKey(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  const normalized = trimmed
    .replace(/[^a-z0-9._]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/\._/g, ".")
    .replace(/_\./g, ".")

  if (!normalized || !FACT_KEY_PATTERN.test(normalized)) {
    return `unknown.${normalized || "fact"}`
  }
  return normalized
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `fact-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function assertSupportedDecisionTier(tier: EvidenceEngineDecisionTier): void {
  if (tier === "fallback_assumption") {
    throw new Error("Fallback assumptions are prohibited in GE-AIOS-8A-1 foundation phase.")
  }
}

function rawItemToEvidence(
  organizationId: string,
  item: EvidenceProviderRawItem,
  evidenceId: string,
  extractedAt: string,
): AvaEvidenceItem {
  assertSupportedDecisionTier(item.decision_tier)

  const freshness = item.freshness_confidence ?? defaultFreshnessConfidence(extractedAt)
  const confidence = buildEvidenceConfidence({
    evidence_confidence: item.evidence_confidence ?? 0.7,
    extraction_confidence: item.extraction_confidence ?? 0.7,
    verification_confidence: item.verification_confidence ?? (isLowerTrustDecisionTier(item.decision_tier) ? 0.4 : 0.75),
    freshness_confidence: freshness,
  })

  const lifecycle: EvidenceEngineLifecycleStatus = isLowerTrustDecisionTier(item.decision_tier)
    ? "needs_review"
    : "active"

  return {
    evidence_id: evidenceId,
    organization_id: organizationId,
    provider: item.provider,
    decision_tier: item.decision_tier,
    lifecycle_status: lifecycle,
    evidence_type: item.evidence_type,
    value_text: item.value_text,
    value_json: item.value_json ?? null,
    source_url: item.source_url,
    page_title: item.page_title,
    raw_excerpt: item.raw_excerpt,
    confidence: applyStaleEvidencePenalty(confidence, extractedAt),
    extracted_at: extractedAt,
    verified_at: null,
    expires_at: null,
    metadata: {
      ...(item.metadata ?? {}),
      normalized_fact_key: normalizeFactKey(item.fact_key),
    },
  }
}

function groupRawItemsByFactKey(
  items: EvidenceProviderRawItem[],
): Map<string, EvidenceProviderRawItem[]> {
  const groups = new Map<string, EvidenceProviderRawItem[]>()
  for (const item of items) {
    const key = normalizeFactKey(item.fact_key)
    const bucket = groups.get(key) ?? []
    bucket.push(item)
    groups.set(key, bucket)
  }
  return groups
}

function pickPrimaryRawItem(items: EvidenceProviderRawItem[]): EvidenceProviderRawItem {
  return [...items].sort((a, b) => {
    const tierDelta = decisionTierRank(a.decision_tier) - decisionTierRank(b.decision_tier)
    if (tierDelta !== 0) return tierDelta
    return b.value_text.length - a.value_text.length
  })[0]!
}

function buildFactFromEvidence(
  organizationId: string,
  factKey: string,
  category: EvidenceProviderRawItem["category"],
  evidenceItems: AvaEvidenceItem[],
  extractedAt: string,
): AvaFact {
  const supportingIds = evidenceItems.map((item) => item.evidence_id)
  const primary = evidenceItems[0]!

  return {
    fact_id: createId(),
    organization_id: organizationId,
    fact_key: factKey,
    category,
    value_text: primary.value_text,
    value_json: primary.value_json,
    lifecycle_status: evidenceItems.some((item) => item.lifecycle_status === "needs_review")
      ? "needs_review"
      : "active",
    confidence: mergeFactConfidence(evidenceItems.map((item) => item.confidence)),
    supporting_evidence_ids: supportingIds,
    contradicting_evidence_ids: [],
    first_seen_at: extractedAt,
    last_seen_at: extractedAt,
    last_verified_at: null,
    deprecated_at: null,
    metadata: {
      evidence_count: evidenceItems.length,
      primary_decision_tier: primary.decision_tier,
    },
  }
}

export function normalizeProviderCollection(
  output: EvidenceProviderCollectionOutput,
): Pick<EvidenceCollectionResult, "evidence" | "facts" | "warnings"> {
  const extractedAt = new Date().toISOString()
  const evidence: AvaEvidenceItem[] = []
  const facts: AvaFact[] = []
  const warnings = [...output.warnings]

  for (const item of output.raw_items) {
    if (item.provider === "fallback" || item.decision_tier === "fallback_assumption") {
      warnings.push(`Rejected fallback evidence for fact_key=${item.fact_key}`)
      continue
    }
    if (item.decision_tier === "ai_reasoning") {
      warnings.push(`Rejected ai_inference evidence in foundation phase for fact_key=${item.fact_key}`)
      continue
    }
  }

  const acceptedItems = output.raw_items.filter(
    (item) =>
      item.provider !== "fallback" &&
      item.decision_tier !== "fallback_assumption" &&
      item.decision_tier !== "ai_reasoning" &&
      item.provider !== "ai_inference",
  )

  const evidenceByFactKey = new Map<string, AvaEvidenceItem[]>()

  for (const item of acceptedItems) {
    const factKey = normalizeFactKey(item.fact_key)
    const evidenceId = createId()
    const evidenceItem = rawItemToEvidence(output.organization_id, item, evidenceId, extractedAt)
    evidence.push(evidenceItem)

    const bucket = evidenceByFactKey.get(factKey) ?? []
    bucket.push(evidenceItem)
    evidenceByFactKey.set(factKey, bucket)
  }

  for (const [factKey, groupedItems] of groupRawItemsByFactKey(acceptedItems)) {
    const linkedEvidence = evidenceByFactKey.get(factKey) ?? []
    if (linkedEvidence.length === 0) {
      warnings.push(`Skipped fact without evidence: ${factKey}`)
      continue
    }

    const primaryRaw = pickPrimaryRawItem(groupedItems)
    facts.push(
      buildFactFromEvidence(
        output.organization_id,
        factKey,
        primaryRaw.category,
        linkedEvidence,
        extractedAt,
      ),
    )
  }

  for (const fact of facts) {
    if (fact.supporting_evidence_ids.length === 0) {
      throw new Error(`Fact ${fact.fact_key} must reference at least one evidence item.`)
    }
  }

  return { evidence, facts, warnings }
}

export function normalizeEvidenceCollectionResult(input: {
  organization_id: string
  provider: EvidenceEngineProvider
  evidence: AvaEvidenceItem[]
  facts: AvaFact[]
  contradictions: EvidenceCollectionResult["contradictions"]
  warnings: string[]
  diagnostics: Record<string, unknown>
}): EvidenceCollectionResult {
  for (const fact of input.facts) {
    if (fact.supporting_evidence_ids.length === 0) {
      throw new Error(`Fact ${fact.fact_key} is missing supporting evidence.`)
    }
    const evidenceIds = new Set(input.evidence.map((item) => item.evidence_id))
    for (const evidenceId of fact.supporting_evidence_ids) {
      if (!evidenceIds.has(evidenceId)) {
        throw new Error(`Fact ${fact.fact_key} references unknown evidence_id ${evidenceId}.`)
      }
    }
  }

  return {
    organization_id: input.organization_id,
    provider: input.provider,
    evidence: input.evidence,
    facts: input.facts,
    contradictions: input.contradictions,
    warnings: input.warnings,
    diagnostics: input.diagnostics,
  }
}

export function mergeNormalizedFacts(facts: AvaFact[]): AvaFact[] {
  const byKey = new Map<string, AvaFact>()

  for (const fact of facts) {
    const existing = byKey.get(fact.fact_key)
    if (!existing) {
      byKey.set(fact.fact_key, fact)
      continue
    }

    const mergedSupporting = [...new Set([...existing.supporting_evidence_ids, ...fact.supporting_evidence_ids])]
    const mergedContradicting = [
      ...new Set([...existing.contradicting_evidence_ids, ...fact.contradicting_evidence_ids]),
    ]

    const existingTierRank =
      typeof existing.metadata.primary_decision_tier === "string"
        ? decisionTierRank(existing.metadata.primary_decision_tier as EvidenceEngineDecisionTier)
        : Number.MAX_SAFE_INTEGER
    const factTierRank =
      typeof fact.metadata.primary_decision_tier === "string"
        ? decisionTierRank(fact.metadata.primary_decision_tier as EvidenceEngineDecisionTier)
        : Number.MAX_SAFE_INTEGER

    const primary = existingTierRank <= factTierRank ? existing : fact

    byKey.set(fact.fact_key, {
      ...primary,
      supporting_evidence_ids: mergedSupporting,
      contradicting_evidence_ids: mergedContradicting,
      last_seen_at: primary.last_seen_at >= fact.last_seen_at ? primary.last_seen_at : fact.last_seen_at,
      confidence: mergeFactConfidence([existing.confidence, fact.confidence]),
      metadata: {
        ...existing.metadata,
        ...fact.metadata,
        merged_fact_count: mergedSupporting.length,
      },
    })
  }

  return [...byKey.values()]
}

export function mergeEvidenceItems(evidence: AvaEvidenceItem[]): AvaEvidenceItem[] {
  const byId = new Map<string, AvaEvidenceItem>()
  for (const item of evidence) {
    byId.set(item.evidence_id, item)
  }
  return [...byId.values()]
}

export function assertNoUnsupportedActions(input: {
  evidence: AvaEvidenceItem[]
  facts: AvaFact[]
}): void {
  for (const item of input.evidence) {
    if (item.decision_tier === "fallback_assumption" || item.provider === "fallback") {
      throw new Error("Unsupported fallback evidence must not produce facts or actions.")
    }
  }

  for (const fact of input.facts) {
    if (fact.supporting_evidence_ids.length === 0) {
      throw new Error(`Unsupported fact without evidence: ${fact.fact_key}`)
    }
  }
}
