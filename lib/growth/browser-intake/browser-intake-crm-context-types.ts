/** Browser extension CRM context types — client-safe. */

import type { GrowthLinkedInLeadStatusBadge } from "@/lib/growth/browser-intake/linkedin-lead-status-badge"

export const GROWTH_BROWSER_INTAKE_CRM_CONTEXT_QA_MARKER =
  "growth-browser-intake-crm-context-v1" as const

export type GrowthBrowserIntakeCrmContextOwner = {
  user_id: string | null
  display_name: string | null
  email: string | null
}

export type GrowthBrowserIntakeCrmContextActivity = {
  at: string | null
  summary: string | null
}

export type GrowthBrowserIntakeCrmContextNextAction = {
  key: string | null
  label: string | null
  reason: string | null
}

export type GrowthBrowserIntakeCrmContextOpportunity = {
  id: string | null
  stage_key: string | null
  stage_label: string | null
  status_summary: string | null
  last_activity_at: string | null
}

export type GrowthBrowserIntakeCrmContextLinks = {
  lead: string
  company: string
  opportunity: string | null
}

export type GrowthBrowserIntakeCrmContextTimelineEvent = {
  occurred_at: string
  event_type: string | null
  title: string | null
  summary: string | null
}

export type GrowthBrowserIntakeCrmContextRelationshipContact = {
  lead_id: string
  name: string
  title: string | null
  status: string | null
}

export type GrowthBrowserIntakeCrmContextRelationshipMap = {
  contacts: GrowthBrowserIntakeCrmContextRelationshipContact[]
  related_leads: GrowthBrowserIntakeCrmContextRelationshipContact[]
}

export type GrowthBrowserIntakeCrmContextEmailDiscoveryContact = {
  person_id: string
  name: string
  title: string | null
  verified_email: string | null
  has_verified_email: boolean
  discovery_status: string
  can_discover: boolean
}

export type GrowthBrowserIntakeCrmContext = {
  lead_id: string
  company_name: string
  contact_name: string | null
  lead_status: string
  lead_status_label: string
  owner: GrowthBrowserIntakeCrmContextOwner | null
  last_activity: GrowthBrowserIntakeCrmContextActivity
  next_action: GrowthBrowserIntakeCrmContextNextAction
  lead_score: number | null
  opportunity: GrowthBrowserIntakeCrmContextOpportunity | null
  company_contacts_count: number
  related_leads_count: number
  status_badge: GrowthLinkedInLeadStatusBadge
  status_badge_label: string
  match_summary: string | null
  lead_notes: string | null
  timeline_preview: GrowthBrowserIntakeCrmContextTimelineEvent[]
  company_relationship_map: GrowthBrowserIntakeCrmContextRelationshipMap
  canonical_company_id: string | null
  email_discovery_contacts: GrowthBrowserIntakeCrmContextEmailDiscoveryContact[]
  links: GrowthBrowserIntakeCrmContextLinks
}

export function formatGrowthLeadStatusLabel(status: string | null | undefined): string {
  const key = (status ?? "").trim()
  if (!key) return "Unknown"
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function formatGrowthBrowserIntakeActivityWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
