/** GS-AI-PLAYBOOK-3A — Normalize enrichment inputs into ranked signals (client-safe). */

import {
  classifyAccountIntelligenceSignal,
  GROWTH_ACCOUNT_INTELLIGENCE_SOURCE_BASE_CONFIDENCE,
  GROWTH_ACCOUNT_INTELLIGENCE_SOURCE_PRECEDENCE,
  mapSnapshotCategoryToSignalCategory,
  mapSnapshotSourceToAccountSource,
} from "@/lib/growth/account-intelligence/growth-account-intelligence-signals"
import type {
  GrowthAccountIntelligenceCertainty,
  GrowthAccountIntelligenceInput,
  GrowthAccountIntelligenceNormalizedSignal,
  GrowthAccountIntelligenceSourceType,
} from "@/lib/growth/account-intelligence/growth-account-intelligence-types"

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))]
}

function normalizeClaim(text: string): string {
  return text
    .replace(/^(Summary|Website|Service focus|Observed|Hiring signal|Contact role|Site excerpt|Enrichment):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function claimKey(text: string): string {
  return normalizeClaim(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function resolveCertainty(confidence: number, verificationStatus?: string | null): GrowthAccountIntelligenceCertainty {
  if (verificationStatus === "verified" || confidence >= 85) return "verified"
  if (verificationStatus === "probable" || confidence >= 60) return "likely"
  return "unknown"
}

function pushRawSignal(
  bucket: GrowthAccountIntelligenceNormalizedSignal[],
  input: {
    claim: string
    source: GrowthAccountIntelligenceSourceType
    category?: ReturnType<typeof classifyAccountIntelligenceSignal>
    confidence?: number
    certainty?: GrowthAccountIntelligenceCertainty
    freshness?: string | null
    fieldKey?: string | null
    verificationStatus?: string | null
  },
): void {
  const claim = normalizeClaim(input.claim)
  if (!claim || claim.length < 8) return
  if (/\b(may|might|could|appears to|likely|probably|estimate)\b/i.test(claim) && input.source !== "research") {
    return
  }

  const confidence =
    input.confidence ??
    GROWTH_ACCOUNT_INTELLIGENCE_SOURCE_BASE_CONFIDENCE[input.source]
  const certainty =
    input.certainty ?? resolveCertainty(confidence, input.verificationStatus)

  bucket.push({
    id: `${input.source}:${claimKey(claim)}`,
    category: input.category ?? classifyAccountIntelligenceSignal(claim),
    claim,
    source: input.source,
    sourcePrecedence: GROWTH_ACCOUNT_INTELLIGENCE_SOURCE_PRECEDENCE[input.source],
    confidence,
    certainty,
    freshness: input.freshness ?? null,
    fieldKey: input.fieldKey ?? null,
  })
}

function pushFromStrings(
  bucket: GrowthAccountIntelligenceNormalizedSignal[],
  values: string[] | undefined,
  source: GrowthAccountIntelligenceSourceType,
  freshness?: string | null,
): void {
  for (const value of uniqueStrings(values ?? [])) {
    pushRawSignal(bucket, { claim: value, source, freshness })
  }
}

function pushCrmMetadata(
  bucket: GrowthAccountIntelligenceNormalizedSignal[],
  metadata: Record<string, string | string[] | null | undefined> | undefined,
  freshness?: string | null,
): void {
  if (!metadata) return
  for (const [key, raw] of Object.entries(metadata)) {
    if (Array.isArray(raw)) {
      pushFromStrings(
        bucket,
        raw.filter((entry): entry is string => typeof entry === "string"),
        "crm_metadata",
        freshness,
      )
      continue
    }
    if (typeof raw === "string" && raw.trim()) {
      pushRawSignal(bucket, {
        claim: raw,
        source: "crm_metadata",
        fieldKey: key,
        freshness,
        certainty: "verified",
      })
    }
  }
}

function pushLeadMetadata(
  bucket: GrowthAccountIntelligenceNormalizedSignal[],
  metadata: Record<string, unknown> | undefined,
  freshness?: string | null,
): void {
  if (!metadata) return
  const allowedKeys = [
    "crmDetected",
    "fieldServiceStackDetected",
    "estimatedEmployeeCount",
    "estimatedAnnualRevenue",
    "fleetSizeEstimate",
    "description",
    "company_description",
  ]
  for (const key of allowedKeys) {
    const raw = metadata[key]
    if (typeof raw === "string" && raw.trim()) {
      const label =
        key === "crmDetected"
          ? `CRM detected: ${raw}`
          : key === "fieldServiceStackDetected"
            ? `Field service stack detected: ${raw}`
            : key === "estimatedEmployeeCount"
              ? `Employee estimate (metadata): ${raw}`
              : key === "estimatedAnnualRevenue"
                ? `Revenue estimate (metadata): ${raw}`
                : key === "fleetSizeEstimate"
                  ? `Fleet size estimate (metadata): ${raw}`
                  : raw
      pushRawSignal(bucket, {
        claim: label,
        source: "crm_metadata",
        fieldKey: key,
        freshness,
        certainty: key.includes("estimate") ? "likely" : "verified",
        confidence: key.includes("estimate") ? 72 : 90,
      })
    }
  }
}

function pushSnapshots(
  bucket: GrowthAccountIntelligenceNormalizedSignal[],
  input: GrowthAccountIntelligenceInput,
): void {
  for (const snapshot of input.intelligenceSnapshots ?? []) {
    const source = mapSnapshotSourceToAccountSource(snapshot.source)
    const category = mapSnapshotCategoryToSignalCategory(snapshot.category)
    const confidence = Math.round(snapshot.confidence * 100)
    pushRawSignal(bucket, {
      claim: `${snapshot.key}: ${snapshot.value}`,
      source,
      category,
      confidence,
      verificationStatus: snapshot.verificationStatus,
      freshness: snapshot.observedAt ?? input.observedAt ?? null,
      fieldKey: snapshot.key,
    })
  }
}

export function normalizeAccountIntelligenceSignals(
  input: GrowthAccountIntelligenceInput,
): GrowthAccountIntelligenceNormalizedSignal[] {
  const raw: GrowthAccountIntelligenceNormalizedSignal[] = []
  const freshness = input.observedAt ?? null

  pushCrmMetadata(raw, input.crmMetadata, freshness)
  pushLeadMetadata(raw, input.leadMetadata, freshness)

  if (input.companySummary?.trim()) {
    pushRawSignal(raw, {
      claim: input.companySummary,
      source: "research",
      category: "summary",
      confidence: input.researchConfidence ?? 86,
      freshness,
    })
  }
  if (input.websiteSummary?.trim()) {
    pushRawSignal(raw, {
      claim: input.websiteSummary,
      source: "research",
      category: "website",
      confidence: input.researchConfidence ?? 84,
      freshness,
    })
  }

  pushFromStrings(raw, input.researchFindings, "research", freshness)
  pushFromStrings(raw, input.outreachAngles?.map((entry) => `Observed: ${entry}`), "research", freshness)
  pushFromStrings(
    raw,
    input.equipmentServiceIndicators?.map((entry) => `Service focus: ${entry}`),
    "research",
    freshness,
  )
  pushFromStrings(raw, input.enrichmentFindings, "research", freshness)
  pushFromStrings(raw, input.researchSignals, "research", freshness)
  pushFromStrings(raw, input.leadSignals, "research", freshness)
  pushFromStrings(raw, input.hiringSignals?.map((entry) => `Hiring signal: ${entry}`), "research", freshness)

  if (input.websiteText?.trim()) {
    pushRawSignal(raw, {
      claim: `Site excerpt: ${input.websiteText.slice(0, 240)}`,
      source: "website_crawl",
      category: "website",
      freshness,
    })
  }
  pushFromStrings(raw, input.websiteFindings, "website_crawl", freshness)
  pushFromStrings(raw, input.websiteSignals, "website_crawl", freshness)

  pushFromStrings(raw, input.discoveryFindings, "discovery", freshness)
  pushFromStrings(raw, input.apolloFindings, "apollo", freshness)
  pushFromStrings(raw, input.publicIndicators, "public_indicator", freshness)

  for (const fact of uniqueStrings(input.verifiedFacts ?? [])) {
    pushRawSignal(raw, {
      claim: fact,
      source: "crm_metadata",
      certainty: "verified",
      confidence: 94,
      freshness,
    })
  }

  if (input.decisionMakerTitle?.trim()) {
    pushRawSignal(raw, {
      claim: `Contact role: ${input.decisionMakerTitle}`,
      source: "crm_metadata",
      category: "summary",
      certainty: "verified",
      confidence: 90,
      freshness,
    })
  }

  if (input.companySize?.trim()) {
    pushRawSignal(raw, {
      claim: `Company size (metadata): ${input.companySize}`,
      source: "crm_metadata",
      category: "summary",
      certainty: "likely",
      confidence: 72,
      freshness,
    })
  }

  pushSnapshots(raw, input)

  return dedupeAccountIntelligenceSignals(raw)
}

export function dedupeAccountIntelligenceSignals(
  signals: GrowthAccountIntelligenceNormalizedSignal[],
): GrowthAccountIntelligenceNormalizedSignal[] {
  const byKey = new Map<string, GrowthAccountIntelligenceNormalizedSignal>()

  for (const signal of signals) {
    const key = `${signal.category}:${claimKey(signal.claim)}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, signal)
      continue
    }
    const existingScore = existing.sourcePrecedence * 1000 + existing.confidence
    const candidateScore = signal.sourcePrecedence * 1000 + signal.confidence
    if (candidateScore < existingScore) {
      byKey.set(key, signal)
    }
  }

  return [...byKey.values()].sort((left, right) => {
    const leftScore = left.sourcePrecedence * 1000 + left.confidence
    const rightScore = right.sourcePrecedence * 1000 + right.confidence
    return leftScore - rightScore
  })
}

export function filterAccountIntelligenceSignalsByCertainty(
  signals: GrowthAccountIntelligenceNormalizedSignal[],
  minCertainty: GrowthAccountIntelligenceCertainty,
): GrowthAccountIntelligenceNormalizedSignal[] {
  const rank: Record<GrowthAccountIntelligenceCertainty, number> = {
    verified: 2,
    likely: 1,
    unknown: 0,
  }
  return signals.filter((signal) => rank[signal.certainty] >= rank[minCertainty])
}
