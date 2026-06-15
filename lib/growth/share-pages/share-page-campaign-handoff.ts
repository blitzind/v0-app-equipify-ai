/** Growth Engine SR-2B-6 — Share page campaign/sequence handoff readiness (client-safe). */

import { buildSharePagePublicUrl } from "@/lib/growth/share-pages/share-page-token"
import type { GrowthSharePageSourceChannel } from "@/lib/growth/share-pages/share-page-types"

export const GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER = "share-pages-campaign-handoff-sr2b6-v1" as const

export const GROWTH_SHARE_PAGES_E2E_QA_MARKER = "share-pages-e2e-sr2b6-v1" as const

export const GROWTH_SHARE_PAGES_E2E_CONFIRM = "RUN_GROWTH_SHARE_PAGES_E2E_CERTIFICATION" as const

export const GROWTH_SHARE_PAGES_CONSOLIDATED_QA_MARKER = "share-pages-consolidated-sr2b6-v1" as const

export type SharePageCreationCandidate = {
  leadId: string
  organizationId: string
  companyId: string | null
  campaignId: string | null
  enrollmentId: string | null
  sequenceStepId: string | null
  sequenceExecutionJobId: string | null
  sourceChannel: GrowthSharePageSourceChannel
  bookingPageId: string | null
  status: "pending_review"
  buildContext: true
  requiresHumanReview: true
  autoCreateEnabled: false
  autonomousExecutionEnabled: false
  outreachExecution: false
  enrollmentExecution: false
  qaMarker: typeof GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER
}

export type SharePageCampaignReadinessResult = {
  ready: boolean
  blockers: string[]
  warnings: string[]
  requiresHumanReview: true
  autoCreateEnabled: false
  autonomousExecutionEnabled: false
  outreachExecution: false
  enrollmentExecution: false
  qaMarker: typeof GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER
}

export type SharePageSequenceStepLink = {
  href: string | null
  pathTemplate: string
  requiresPublishedPage: true
  requiresHumanApproval: true
  tokenRequired: boolean
  utm: Record<string, string>
  qaMarker: typeof GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER
}

function asTrimmed(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function canCreateSharePageForLead(input: {
  leadId: string | null | undefined
  organizationId: string | null | undefined
  leadStatus?: string | null
  existingActiveSharePageCount?: number
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  const leadId = asTrimmed(input.leadId)
  const organizationId = asTrimmed(input.organizationId)

  if (!leadId) reasons.push("lead_id_required")
  else if (!isUuid(leadId)) reasons.push("lead_id_invalid")

  if (!organizationId) reasons.push("organization_id_required")
  else if (!isUuid(organizationId)) reasons.push("organization_id_invalid")

  const leadStatus = asTrimmed(input.leadStatus).toLowerCase()
  if (leadStatus && ["archived", "disqualified", "lost"].includes(leadStatus)) {
    reasons.push(`lead_status_blocked:${leadStatus}`)
  }

  if ((input.existingActiveSharePageCount ?? 0) > 10) {
    reasons.push("excessive_active_share_pages_for_lead")
  }

  return { ok: reasons.length === 0, reasons }
}

export function buildSharePageCreationCandidate(input: {
  leadId: string
  organizationId: string
  companyId?: string | null
  campaignId?: string | null
  enrollmentId?: string | null
  sequenceStepId?: string | null
  sequenceExecutionJobId?: string | null
  sourceChannel?: GrowthSharePageSourceChannel
  bookingPageId?: string | null
}): SharePageCreationCandidate {
  const eligibility = canCreateSharePageForLead({
    leadId: input.leadId,
    organizationId: input.organizationId,
  })
  if (!eligibility.ok) {
    throw new Error(`share_page_candidate_ineligible:${eligibility.reasons.join(",")}`)
  }

  return {
    leadId: input.leadId.trim(),
    organizationId: input.organizationId.trim(),
    companyId: input.companyId?.trim() || null,
    campaignId: input.campaignId?.trim() || null,
    enrollmentId: input.enrollmentId?.trim() || null,
    sequenceStepId: input.sequenceStepId?.trim() || null,
    sequenceExecutionJobId: input.sequenceExecutionJobId?.trim() || null,
    sourceChannel: input.sourceChannel ?? "sequence",
    bookingPageId: input.bookingPageId?.trim() || null,
    status: "pending_review",
    buildContext: true,
    requiresHumanReview: true,
    autoCreateEnabled: false,
    autonomousExecutionEnabled: false,
    outreachExecution: false,
    enrollmentExecution: false,
    qaMarker: GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER,
  }
}

export function validateSharePageCampaignReadiness(input: {
  organizationId: string | null | undefined
  leadId: string | null | undefined
  campaignId?: string | null
  enrollmentId?: string | null
  bookingPageId?: string | null
  bookingPageEnabled?: boolean
  schemaReady?: boolean
  hasLeadRecord?: boolean
}): SharePageCampaignReadinessResult {
  const blockers: string[] = []
  const warnings: string[] = []

  const eligibility = canCreateSharePageForLead({
    leadId: input.leadId,
    organizationId: input.organizationId,
  })

  if (!eligibility.ok) blockers.push(...eligibility.reasons)

  if (input.hasLeadRecord === false) blockers.push("lead_record_missing")
  if (input.schemaReady === false) blockers.push("share_pages_schema_not_ready")

  const campaignId = asTrimmed(input.campaignId)
  if (campaignId && !isUuid(campaignId)) blockers.push("campaign_id_invalid")

  const enrollmentId = asTrimmed(input.enrollmentId)
  if (enrollmentId && !isUuid(enrollmentId)) blockers.push("enrollment_id_invalid")

  const bookingPageId = asTrimmed(input.bookingPageId)
  if (bookingPageId) {
    if (!isUuid(bookingPageId)) blockers.push("booking_page_id_invalid")
    if (input.bookingPageEnabled === false) warnings.push("booking_page_disabled")
  } else {
    warnings.push("booking_page_not_linked")
  }

  warnings.push("manual_create_and_human_approval_required")
  warnings.push("auto_create_on_enrollment_not_enabled")

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    requiresHumanReview: true,
    autoCreateEnabled: false,
    autonomousExecutionEnabled: false,
    outreachExecution: false,
    enrollmentExecution: false,
    qaMarker: GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER,
  }
}

export function buildSharePageLinkForSequenceStep(input: {
  publicToken?: string | null
  baseUrl?: string
  sequenceStepId?: string | null
  enrollmentId?: string | null
  campaignId?: string | null
}): SharePageSequenceStepLink {
  const token = asTrimmed(input.publicToken)
  const utm: Record<string, string> = {
    utm_source: "sequence",
    utm_medium: "share_page",
  }
  if (input.campaignId?.trim()) utm.utm_campaign = input.campaignId.trim()
  if (input.enrollmentId?.trim()) utm.utm_content = input.enrollmentId.trim()
  if (input.sequenceStepId?.trim()) utm.utm_term = input.sequenceStepId.trim()

  const baseHref = token ? buildSharePagePublicUrl(token, input.baseUrl) : null
  const href =
    baseHref &&
    `${baseHref}${baseHref.includes("?") ? "&" : "?"}${new URLSearchParams(utm).toString()}`

  return {
    href,
    pathTemplate: "/p/{public_token}",
    requiresPublishedPage: true,
    requiresHumanApproval: true,
    tokenRequired: !token,
    utm,
    qaMarker: GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER,
  }
}
