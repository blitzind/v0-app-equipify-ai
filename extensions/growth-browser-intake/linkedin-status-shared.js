/** LinkedIn lead status badge helpers — keep aligned with lib/growth/browser-intake/linkedin-lead-status-badge.ts */

const EXTENSION_STATUS_BADGE_LABELS = {
  not_added: "Not added",
  already_added: "Already added",
  needs_review: "Needs review",
  verified: "Verified",
  company_captured_only: "Company captured only",
}

const PAGE_STATUS_BADGE_LABELS = {
  not_added: "Not in Equipify",
  already_added: "Added to Equipify",
  needs_review: "Needs review",
  verified: "Verified lead",
  company_captured_only: "Company captured only",
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
  return "neutral"
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

window.EquipifyGrowthLinkedInStatus = {
  EXTENSION_STATUS_BADGE_LABELS,
  PAGE_STATUS_BADGE_LABELS,
  resolveLinkedInLeadStatusBadge,
  formatLinkedInLeadMatchSummary,
  linkedInLeadStatusBadgeTone,
  resolveStatusFromLookup,
}
