/** GE-LEADS-CANONICAL-3A — Revenue Queue field compatibility registry (client-safe). */

export const GROWTH_REVENUE_QUEUE_FIELD_COMPATIBILITY_QA_MARKER =
  "growth-revenue-queue-field-compatibility-v1" as const

export type RevenueQueueFieldCategory = "A" | "B" | "C" | "D"

export type RevenueQueueFieldCompatibilityEntry = {
  field: string
  category: RevenueQueueFieldCategory
  legacy_source: string
  canonical_source: string
  migration_note: string
}

/** Static audit registry — consumed by projection cert and migration planning. */
export const REVENUE_QUEUE_FIELD_COMPATIBILITY: RevenueQueueFieldCompatibilityEntry[] = [
  {
    field: "growth_lead_id / card.id",
    category: "A",
    legacy_source: "metadata.growth_lead_id on lead_inbox",
    canonical_source: "growth.leads.id",
    migration_note: "After flip, card links use canonical id directly.",
  },
  {
    field: "company_name",
    category: "A",
    legacy_source: "lead_inbox.company_name",
    canonical_source: "growth.leads.company_name",
    migration_note: "Direct column.",
  },
  {
    field: "domain",
    category: "A",
    legacy_source: "lead_inbox.domain",
    canonical_source: "growth.leads.website (parsed host)",
    migration_note: "Parse website URL to domain label.",
  },
  {
    field: "contact_name / email / phone",
    category: "A",
    legacy_source: "lead_inbox PII columns",
    canonical_source: "growth.leads contact_* columns",
    migration_note: "Direct columns; PII gating unchanged.",
  },
  {
    field: "owner_id",
    category: "A",
    legacy_source: "lead_inbox.owner_id",
    canonical_source: "growth.leads.assigned_to",
    migration_note: "Direct column.",
  },
  {
    field: "created_at / updated_at",
    category: "A",
    legacy_source: "lead_inbox timestamps",
    canonical_source: "growth.leads.created_at / updated_at",
    migration_note: "Prefer engagement_last_activity_at for last activity when set.",
  },
  {
    field: "utm_source / utm_campaign",
    category: "A",
    legacy_source: "lead_inbox utm_*",
    canonical_source: "growth.leads.source_channel / source_campaign",
    migration_note: "Direct attribution columns.",
  },
  {
    field: "intent_score / lead_score",
    category: "C",
    legacy_source: "lead_inbox.intent_score + lead_engine metadata",
    canonical_source: "growth.leads.score + engagement_score + metadata.lead_engine_run",
    migration_note: "Reuse extractLeadEngineOutputsFromRun when run blob present.",
  },
  {
    field: "candidate_priority",
    category: "C",
    legacy_source: "lead_inbox.candidate_priority",
    canonical_source: "growth.leads.research_priority mapped to inbox priority",
    migration_note: "critical→urgent, high→high, normal→normal, low→low.",
  },
  {
    field: "candidate_confidence",
    category: "C",
    legacy_source: "lead_inbox.candidate_confidence",
    canonical_source: "opportunity_readiness_confidence / conversation_confidence",
    migration_note: "Use strongest available confidence signal.",
  },
  {
    field: "status (queue sections)",
    category: "C",
    legacy_source: "lead_inbox.status enum",
    canonical_source: "growth.leads.status mapped to inbox display status",
    migration_note: "Mapping layer required — enums differ.",
  },
  {
    field: "pipeline_status",
    category: "C",
    legacy_source: "lead_inbox.pipeline_status",
    canonical_source: "growth.leads.workflow_health + status",
    migration_note: "Derived; not a native leads column.",
  },
  {
    field: "human_review_required",
    category: "C",
    legacy_source: "lead_inbox.human_review_required",
    canonical_source: "workflow_health=blocked OR lead status=new",
    migration_note: "Daily work queue blocked state can refine.",
  },
  {
    field: "recommended_motion / urgency / owner",
    category: "C",
    legacy_source: "metadata.operator_handoff OR computeOperatorHandoffPriorityHints",
    canonical_source: "metadata.operator_handoff OR hints from lead metadata + IRE columns",
    migration_note: "Reuse computeOperatorHandoffPriorityHints with synthetic inbox context.",
  },
  {
    field: "next_best_action",
    category: "A",
    legacy_source: "handoff hints",
    canonical_source: "growth.leads.next_best_action",
    migration_note: "Native IRE column supersedes handoff string when present.",
  },
  {
    field: "buying_stage / search_intent / company_match",
    category: "B",
    legacy_source: "lead_inbox.metadata summaries",
    canonical_source: "growth.leads.metadata summaries (when copied at intake)",
    migration_note: "Sibling tables still keyed by lead_inbox_id — see missing deps.",
  },
  {
    field: "session_count / visit_count",
    category: "C",
    legacy_source: "lead_inbox columns",
    canonical_source: "intent pixel join OR metadata intent summaries",
    migration_note: "Requires growth_lead_id FK on intent tables (future migration).",
  },
  {
    field: "candidate_type",
    category: "D",
    legacy_source: "lead_inbox.candidate_type",
    canonical_source: "—",
    migration_note: "Intent-bridge artifact; replace with engagement signals.",
  },
  {
    field: "intent_session_id / visitor_key / dedupe_hash",
    category: "D",
    legacy_source: "lead_inbox intake bridge",
    canonical_source: "—",
    migration_note: "Inbox dedupe only; not needed on canonical queue.",
  },
  {
    field: "candidate_evidence / candidate_attribution",
    category: "C",
    legacy_source: "lead_inbox JSON arrays",
    canonical_source: "timeline events + source_channel metadata",
    migration_note: "Evidence count derived from metadata or timeline length.",
  },
]

/** Fields that cannot yet be populated from growth.leads without schema/work migrations. */
export const REVENUE_QUEUE_MISSING_PROJECTION_DEPENDENCIES = [
  {
    field: "session_count / visit_count (intent pixel)",
    blocker: "Intent pixel visit history resolves via lead_inbox site_key + visitor_key",
    smallest_migration: "Add growth_lead_id to intent session/store tables OR copy counts into leads.metadata at intake.",
  },
  {
    field: "buying_stage_assessments table rows",
    blocker: "growth.buying_stage_assessments.lead_inbox_id FK — no growth_lead_id column",
    smallest_migration: "Add nullable growth_lead_id + backfill from inbox metadata.growth_lead_id.",
  },
  {
    field: "search_intent_signals table rows",
    blocker: "growth.search_intent_signals.lead_inbox_id FK",
    smallest_migration: "Add nullable growth_lead_id + resolver retarget.",
  },
  {
    field: "company_identification_matches table rows",
    blocker: "Matches linked via lead_inbox_id in workspace builder",
    smallest_migration: "Add growth_lead_id FK or resolve via canonical company_id on lead.",
  },
  {
    field: "inbox workflow actions (claim/approve/archive)",
    blocker: "POST /lead-inbox/[id]/actions mutates lead_inbox.status",
    smallest_migration: "Dual-write actions to growth.leads status + metadata queue_state during transition.",
  },
  {
    field: "card navigation id",
    blocker: "Dashboard links to /leads/{inbox_id} today",
    smallest_migration: "Flip href to growth_lead_id after cert passes; interim dual-route support.",
  },
] as const

export const REVENUE_QUEUE_CARD_PARITY_FIELDS = [
  "company_name",
  "domain",
  "lead_score",
  "intent_score",
  "candidate_priority",
  "recommended_motion",
  "recommended_urgency",
  "recommended_owner",
  "owner_id",
  "status",
  "human_review_required",
  "candidate_confidence",
  "buying_stage",
  "evidence_strength",
  "is_purchase_ready",
  "is_high_intent_visitor",
  "needs_review",
] as const

export type RevenueQueueCardParityField = (typeof REVENUE_QUEUE_CARD_PARITY_FIELDS)[number]
