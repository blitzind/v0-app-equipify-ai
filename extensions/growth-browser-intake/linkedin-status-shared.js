/** LinkedIn lead status badge helpers — keep aligned with lib/growth/browser-intake/linkedin-lead-status-badge.ts */

const EXTENSION_STATUS_BADGE_LABELS = {
  not_added: "Not added",
  already_added: "Already added",
  needs_review: "Needs review",
  verified: "Verified",
  company_captured_only: "Company captured only",
}

const PAGE_STATUS_BADGE_LABELS = {
  not_added: "Not In Equipify",
  already_added: "In Equipify",
  needs_review: "Needs Review",
  verified: "Verified Lead",
  company_captured_only: "Company Only",
  existing_customer: "Existing Customer",
  existing_opportunity: "Existing Opportunity",
}

const PROSPECT_DISPLAY_BADGES = {
  not_added: { label: "Not In Equipify", emoji: "⚪", tone: "neutral" },
  already_added: { label: "In Equipify", emoji: "🟢", tone: "good" },
  needs_review: { label: "Needs Review", emoji: "🟡", tone: "warn" },
  verified: { label: "Verified Lead", emoji: "🟢", tone: "good" },
  company_captured_only: { label: "Company Only", emoji: "🔵", tone: "info" },
  existing_customer: { label: "Existing Customer", emoji: "🔵", tone: "customer" },
  existing_opportunity: { label: "Existing Opportunity", emoji: "🟣", tone: "opportunity" },
}

function resolveLinkedInLeadStatusBadge(input) {
  if (!input.matched || input.confidence < 0.7) return "not_added"
  if (input.capture_type === "company_only") return "company_captured_only"
  if (input.review_status === "needs_review") return "needs_review"
  if (input.verification_status === "verified") return "verified"
  return "already_added"
}

function formatLinkedInLeadMatchSummary(input) {
  const label = (input.match_label ?? input.rule ?? "match").trim()
  const confidence =
    typeof input.confidence === "number" ? Math.round(input.confidence * 100) : null
  return confidence == null ? label : `${label} · ${confidence}% confidence`
}

function linkedInLeadStatusBadgeTone(badge) {
  if (badge === "verified" || badge === "already_added") return "good"
  if (badge === "needs_review") return "warn"
  if (badge === "company_captured_only") return "info"
  if (badge === "existing_customer") return "customer"
  if (badge === "existing_opportunity") return "opportunity"
  return "neutral"
}

function isCustomerLeadStatus(status) {
  const key = (status ?? "").toLowerCase()
  return key.includes("customer") && !key.includes("former")
}

function isFormerCustomerLeadStatus(status) {
  const key = (status ?? "").toLowerCase()
  return key.includes("former") && key.includes("customer")
}

function deriveProspectBadgeKey(crmPayload) {
  const context = crmPayload?.context ?? null
  const baseBadge = crmPayload?.status_badge ?? context?.status_badge ?? "not_added"

  if (context?.opportunity?.id) return "existing_opportunity"
  if (isCustomerLeadStatus(context?.lead_status)) return "existing_customer"

  return baseBadge
}

function resolveProspectDisplayBadge(crmPayload) {
  const key = deriveProspectBadgeKey(crmPayload)
  const preset = PROSPECT_DISPLAY_BADGES[key] ?? PROSPECT_DISPLAY_BADGES.not_added
  const context = crmPayload?.context ?? null

  return {
    key,
    label: crmPayload?.status_badge_label ?? context?.status_badge_label ?? preset.label,
    displayLabel: preset.label,
    emoji: preset.emoji,
    tone: linkedInLeadStatusBadgeTone(key),
    matchSummary: context?.match_summary ?? null,
  }
}

function resolveStatusFromLookup(lookup) {
  const best = lookup?.best_match ?? null
  if (!best || best.confidence < 0.7) {
    return {
      badge: "not_added",
      extensionLabel: EXTENSION_STATUS_BADGE_LABELS.not_added,
      pageLabel: PAGE_STATUS_BADGE_LABELS.not_added,
      tone: "neutral",
      match: null,
      matchSummary: null,
    }
  }

  const badge =
    best.status_badge ??
    resolveLinkedInLeadStatusBadge({
      matched: true,
      confidence: best.confidence,
      capture_type: best.capture_type,
      review_status: best.review_status,
      verification_status: best.verification_status,
    })

  return {
    badge,
    extensionLabel: best.status_badge_label ?? EXTENSION_STATUS_BADGE_LABELS[badge],
    pageLabel: PAGE_STATUS_BADGE_LABELS[badge] ?? EXTENSION_STATUS_BADGE_LABELS[badge],
    tone: linkedInLeadStatusBadgeTone(badge),
    match: best,
    matchSummary:
      best.match_summary ??
      formatLinkedInLeadMatchSummary({
        match_label: best.match_label,
        rule: best.rule,
        confidence: best.confidence,
      }),
  }
}

function formatCompanyRelationshipStatus(crmPayload) {
  const context = crmPayload?.context ?? null
  if (!context) return "Not Added"
  if (isFormerCustomerLeadStatus(context.lead_status)) return "Former Customer"
  if (isCustomerLeadStatus(context.lead_status)) return "Customer"
  if (context.opportunity?.id) return "Opportunity"
  if (context.lead_id) return "Lead"
  return "Not Added"
}

window.EquipifyGrowthLinkedInStatus = {
  EXTENSION_STATUS_BADGE_LABELS,
  PAGE_STATUS_BADGE_LABELS,
  PROSPECT_DISPLAY_BADGES,
  resolveLinkedInLeadStatusBadge,
  formatLinkedInLeadMatchSummary,
  linkedInLeadStatusBadgeTone,
  deriveProspectBadgeKey,
  resolveProspectDisplayBadge,
  resolveStatusFromLookup,
  formatCompanyRelationshipStatus,
  isCustomerLeadStatus,
  isFormerCustomerLeadStatus,
}
