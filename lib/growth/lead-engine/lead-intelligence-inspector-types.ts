/** Lead Pipeline — operator-facing Lead Engine qualification workflow (Prompt 32). Client-safe. */

import { growthProspectSearchHref } from "@/lib/growth/navigation/growth-prospect-search-paths"
import { resolveGrowthFeatureBasePath } from "@/lib/growth/navigation/growth-workspace-base-path"

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

export type LeadIntelligenceOperatorWorkflowStep = {
  id: string
  label: string
  href: string
}

/** Admin-canonical workflow steps — prefer resolveLeadIntelligenceOperatorWorkflowSteps in UI. */
export const LEAD_INTELLIGENCE_OPERATOR_WORKFLOW_STEPS: LeadIntelligenceOperatorWorkflowStep[] = [
  { id: "prospect_search", label: "Prospect Search", href: "/admin/growth/search" },
  { id: "discover_contacts", label: "Discover Contacts", href: "/admin/growth/search" },
  { id: "lead_inbox", label: "Push to Revenue Queue", href: "/admin/growth/queue" },
  { id: "operator_guidance", label: "Review Operator Guidance", href: "/admin/growth/queue" },
  { id: "lead_engine", label: GROWTH_LEAD_PIPELINE_LABEL, href: "/admin/growth/leads/lead-engine" },
  { id: "outreach", label: "Outreach", href: "/admin/growth/leads/queue" },
]

export function resolveLeadIntelligenceOperatorWorkflowSteps(
  pathname: string | null | undefined,
): LeadIntelligenceOperatorWorkflowStep[] {
  const base = resolveGrowthFeatureBasePath(pathname)
  const prospectSearch = growthProspectSearchHref(pathname)
  return [
    { id: "prospect_search", label: "Prospect Search", href: prospectSearch },
    { id: "discover_contacts", label: "Discover Contacts", href: prospectSearch },
    { id: "lead_inbox", label: "Push to Revenue Queue", href: `${base}/leads/research` },
    { id: "operator_guidance", label: "Review Operator Guidance", href: `${base}/leads/research` },
    { id: "lead_engine", label: GROWTH_LEAD_PIPELINE_LABEL, href: `${base}/leads/lead-engine` },
    { id: "outreach", label: "Outreach", href: `${base}/leads/queue` },
  ]
}

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
