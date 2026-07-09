/** GE-AIOS-15B — Relationship canonicalization (canonical export). */

export {
  GROWTH_RELATIONSHIP_GRAPH_QA_MARKER,
  GROWTH_RELATIONSHIP_GRAPH_15D_QA_MARKER,
  buildRelationshipGraphContext,
  hasRelationshipGraphBinding,
  type AvaRelationshipGraphContext,
  type RelationshipGraphBindingInput,
} from "@/lib/growth/relationship/relationship-graph-types"

export {
  GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
  type RelationshipLeadSnapshot,
  type RelationshipLeadSnapshotMap,
} from "@/lib/growth/relationship/relationship-lead-snapshot-types"

export {
  enrichRelationshipGraphWithSnapshot,
  relationshipSnapshotToGraphBinding,
  buildRelationshipLeadSnapshotsFromResearchLoop,
  mergeRelationshipLeadSnapshotMaps,
} from "@/lib/growth/relationship/project-relationship-graph-enrichment"

export {
  buildRelationshipContextClause,
  buildSalesSpecialistRelationshipSuffix,
  formatRelationshipStageClause,
} from "@/lib/growth/relationship/relationship-narrative-copy"

export {
  parseLeadIdFromHref,
  parseLeadIdFromSourceId,
  parsePersonIdFromHref,
  parseConversationThreadIdFromHref,
  parseOpportunityIdFromHref,
  readCanonicalCompanyIdFromMetadata,
  readPersonIdFromMetadata,
} from "@/lib/growth/relationship/parse-relationship-graph-refs"

export {
  attachRelationshipGraphToCandidate,
  resolveRelationshipGraphFromCandidate,
} from "@/lib/growth/relationship/resolve-relationship-graph-from-candidate"

export {
  GROWTH_RELATIONSHIP_SCALE_QA_MARKER,
  GROWTH_HOME_WORKLOAD_SCALE_15F_QA_MARKER,
  GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  GROWTH_REVENUE_QUEUE_BATCH_LIMIT,
  GROWTH_DAILY_WORK_QUEUE_LEAD_BATCH_LIMIT,
  GROWTH_RELATIONSHIP_CALL_QUEUE_BATCH_LIMIT,
  GROWTH_RESEARCH_QUEUE_BATCH_LIMIT,
  GROWTH_PROSPECT_SEARCH_OVERLAY_BATCH_LIMIT,
  GROWTH_INBOX_OPERATOR_BATCH_LIMIT,
  GROWTH_HOME_RELATIONSHIP_SNAPSHOT_AUX_ROW_LIMIT,
  GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT,
  GROWTH_SALES_WORKLOAD_CAP_REGISTRY,
  clampRelationshipBatchLimit,
} from "@/lib/growth/relationship/relationship-scale-limits"

export {
  GROWTH_INTAKE_RELATIONSHIP_BINDING_QA_MARKER,
  GROWTH_INTAKE_GRAPH_BINDING_15C_QA_MARKER,
  buildIntakeRelationshipBindingIntent,
  extractRelationshipGraphFromLeadMetadata,
  mergeIntakeRelationshipBindingMetadata,
  type IntakeRelationshipBindingIntent,
  type IntakeRelationshipBindingSource,
  type IntakeRelationshipBindingStatus,
  type IntakeRelationshipGraphMetadataContract,
} from "@/lib/growth/relationship/intake-relationship-graph-binding"

export {
  GROWTH_LEGACY_BUYING_COMMITTEE_QUARANTINE_QA_MARKER,
  GROWTH_CANONICAL_BUYING_COMMITTEE_TABLES,
  GROWTH_LEGACY_BUYING_COMMITTEE_TABLES,
  isLegacyBuyingCommitteeWriteQuarantined,
  legacyBuyingCommitteeWriteBlockedReason,
} from "@/lib/growth/relationship/legacy-buying-committee-quarantine"
