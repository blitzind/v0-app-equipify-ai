/** GE-AIOS-8A-1/8A-2 — Evidence Engine exports (client-safe types and utilities). */

export {
  GROWTH_EVIDENCE_ENGINE_PHASE,
  GROWTH_EVIDENCE_ENGINE_QA_MARKER,
  GROWTH_EVIDENCE_ENGINE_SCHEMA_MIGRATION,
  EVIDENCE_ENGINE_RUN_STATUSES,
  EVIDENCE_ENGINE_PROVIDERS,
  EVIDENCE_ENGINE_DECISION_TIERS,
  EVIDENCE_ENGINE_LIFECYCLE_STATUSES,
  EVIDENCE_ENGINE_EVIDENCE_TYPES,
  EVIDENCE_ENGINE_FACT_CATEGORIES,
  EVIDENCE_ENGINE_TRIGGERS,
  EVIDENCE_ENGINE_CONTRADICTION_SEVERITIES,
  isEvidenceEngineProvider,
  isEvidenceEngineDecisionTier,
  decisionTierRank,
  isLowerTrustDecisionTier,
  type EvidenceEngineProvider,
  type EvidenceEngineDecisionTier,
  type EvidenceEngineLifecycleStatus,
  type EvidenceEngineEvidenceType,
  type EvidenceEngineFactCategory,
  type EvidenceEngineTrigger,
  type EvidenceEngineContradictionSeverity,
  type EvidenceEngineConfidence,
  type AvaEvidenceItem,
  type AvaFact,
  type AvaContradiction,
  type EvidenceCollectionResult,
  type EvidenceProviderRawItem,
  type EvidenceProviderCollectionOutput,
  type EvidenceEngineRunInput,
  type EvidenceEngineRunResult,
  type EvidenceEngineRunStatus,
} from "@/lib/growth/evidence-engine/evidence-engine-types"

export {
  EVIDENCE_ENGINE_EXTRACTION_VERSION,
  buildEvidenceEngineInputHash,
} from "@/lib/growth/evidence-engine/evidence-engine-input-hash"

export {
  buildEvidenceEngineSnapshotPayload,
  isReviewableSnapshot,
  type EvidenceEngineSnapshotPayload,
  type EvidenceEngineSnapshotRecord,
} from "@/lib/growth/evidence-engine/evidence-engine-snapshot"

export {
  EVIDENCE_CONFIDENCE_MIN,
  EVIDENCE_CONFIDENCE_MAX,
  EVIDENCE_FRESHNESS_HALF_LIFE_MS,
  EVIDENCE_CONTRADICTION_PENALTY,
  EVIDENCE_STALE_PENALTY_CAP,
  calculateOverallEvidenceConfidence,
  buildEvidenceConfidence,
  defaultFreshnessConfidence,
  applyStaleEvidencePenalty,
  applyContradictionPenalty,
  mergeFactConfidence,
  type EvidenceConfidenceDimensions,
} from "@/lib/growth/evidence-engine/evidence-confidence"

export {
  normalizeFactKey,
  normalizeProviderCollection,
  normalizeEvidenceCollectionResult,
  mergeNormalizedFacts,
  mergeEvidenceItems,
  assertNoUnsupportedActions,
} from "@/lib/growth/evidence-engine/evidence-normalizer"

export {
  detectEvidenceContradictions,
  type ContradictionDetectionResult,
} from "@/lib/growth/evidence-engine/evidence-contradiction-detector"

export {
  EVIDENCE_ENGINE_BUSINESS_PAGE_TYPES,
  EVIDENCE_ENGINE_BUSINESS_SEED_PATHS,
  classifyBusinessWebsitePageType,
  businessPagePriority,
  type EvidenceEngineBusinessPageType,
} from "@/lib/growth/evidence-engine/providers/website-business-page-classifier"

export { extractBusinessEvidenceFromHtml } from "@/lib/growth/evidence-engine/providers/website-business-extractor"
