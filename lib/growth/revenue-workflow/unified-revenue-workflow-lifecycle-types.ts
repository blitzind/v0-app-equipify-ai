/** GE-LAUNCH-1C — Material lead change events that trigger unified workflow re-evaluation (client-safe). */

export const MATERIAL_LEAD_CHANGE_EVENTS = [
  "email_verified",
  "phone_verified",
  "identity_merged",
  "duplicate_resolved",
  "better_contact_discovered",
  "executive_discovered",
  "decision_maker_discovered",
  "buying_committee_expanded",
  "enrichment_completed",
  "website_analysis_completed",
  "industry_identified",
  "revenue_identified",
  "suppression_removed",
  "suppression_added",
  "lead_status_promoted",
  "qualification_updated",
  "positive_reply",
  "negative_reply",
  "meeting_booked",
  "meeting_cancelled",
  "meeting_completed",
  "revenue_outcome_recorded",
  "learning_observation_added",
  "operator_verify_email",
  "operator_refresh_intelligence",
  "operator_rerun_research",
  "operator_discover_contacts",
  "operator_rerun_verification",
  "operator_refresh_buying_committee",
] as const

export type MaterialLeadChangeEvent = (typeof MATERIAL_LEAD_CHANGE_EVENTS)[number]

export const GROWTH_UNIFIED_REVENUE_WORKFLOW_LIFECYCLE_QA_MARKER =
  "unified-revenue-workflow-lifecycle-v1" as const

export function mergeMaterialLeadChangeEvents(
  existing: Set<MaterialLeadChangeEvent>,
  incoming: MaterialLeadChangeEvent | MaterialLeadChangeEvent[],
): MaterialLeadChangeEvent[] {
  for (const event of Array.isArray(incoming) ? incoming : [incoming]) {
    existing.add(event)
  }
  return [...existing]
}
