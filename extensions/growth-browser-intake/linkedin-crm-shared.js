/** CRM context rendering helpers for extension UI — client-safe mirror. */

function formatWhen(value) {
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

function formatOwner(owner) {
  if (!owner) return "Unassigned"
  return owner.display_name || owner.email || "Assigned"
}

function formatScore(score) {
  if (score == null || Number.isNaN(Number(score))) return "—"
  return String(score)
}

function formatOpportunity(opportunity) {
  if (!opportunity) return "No opportunity"
  const parts = [opportunity.stage_label || opportunity.stage_key].filter(Boolean)
  if (opportunity.status_summary && !parts.includes(opportunity.status_summary)) {
    parts.push(opportunity.status_summary)
  }
  return parts.join(" · ") || "No opportunity"
}

function crmContextRows(context) {
  if (!context) return []
  return [
    { label: "Lead status", value: context.lead_status_label || context.lead_status || "—" },
    { label: "Owner", value: formatOwner(context.owner) },
    { label: "Last activity", value: context.last_activity?.summary || "—" },
    { label: "Last activity at", value: formatWhen(context.last_activity?.at) },
    { label: "Next action", value: context.next_action?.label || "—" },
    { label: "Lead score", value: formatScore(context.lead_score) },
    { label: "Opportunity", value: formatOpportunity(context.opportunity) },
    {
      label: "Company contacts",
      value: String(context.company_contacts_count ?? 0),
    },
  ]
}

function badgeToneFromStatus(badge) {
  if (badge === "verified" || badge === "already_added") return "good"
  if (badge === "needs_review") return "warn"
  if (badge === "company_captured_only") return "info"
  return "neutral"
}

window.EquipifyGrowthCrmContext = {
  formatWhen,
  formatOwner,
  formatScore,
  formatOpportunity,
  crmContextRows,
  badgeToneFromStatus,
}
