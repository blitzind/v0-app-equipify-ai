/** Lead Pipeline — operator-facing Lead Engine qualification workflow (Prompt 32). Client-safe. */

export const GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER =
  "growth-lead-intelligence-inspector-v2" as const

export const GROWTH_LEAD_PIPELINE_IA_QA_MARKER = "growth-lead-pipeline-ia-v1" as const

export const GROWTH_LEAD_PIPELINE_LABEL = "Lead Pipeline" as const

export const GROWTH_LEAD_PIPELINE_SUBTITLE =
  "Operator-facing lead qualification and enrichment workflow before outreach execution." as const

/** Legacy command palette / bookmark aliases — route unchanged. */
export const GROWTH_LEAD_PIPELINE_LEGACY_ALIASES = [
  "Lead Intelligence Inspector",
  "lead inspector",
  "lead-engine",
  "pipeline",
  "Run Lead Research",
] as const

export const LEAD_INTELLIGENCE_OPERATOR_WORKFLOW_STEPS = [
  { id: "prospect_search", label: "Prospect Search", href: "/admin/growth/search" },
  { id: "discover_contacts", label: "Discover Contacts", href: "/admin/growth/search" },
  { id: "lead_inbox", label: "Push to Revenue Queue", href: "/admin/growth/queue" },
  { id: "operator_guidance", label: "Review Operator Guidance", href: "/admin/growth/queue" },
  { id: "lead_engine", label: GROWTH_LEAD_PIPELINE_LABEL, href: "/admin/growth/leads/lead-engine" },
  { id: "outreach", label: "Outreach", href: "/admin/growth/leads/queue" },
] as const

export type LeadIntelligenceSystemStatusId =
  | "intent_pixel"
  | "prospect_discovery"
  | "company_discovery"
  | "contact_discovery"
  | "buying_stage"
  | "verification"
  | "provider_cache"

export type LeadIntelligenceSystemStatusRow = {
  id: LeadIntelligenceSystemStatusId
  label: string
  status: "ready" | "fixture" | "inactive"
  detail: string
  href?: string
  qaMarker?: string
}
