/**
 * AVA-HOME-REVIEW-QUEUE-1B — Outreach review queue presentation (client-safe).
 * Maps existing Home projections into a CRM-style operator queue. No business logic changes.
 */

import type { GrowthCanonicalOperatorApprovalPackagePreview } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import type { GrowthSupervisedAvaHomeNeedsInformationItem, GrowthSupervisedAvaHomeReadyItem } from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a-types"
import { isConsumerEmailDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import { normalizeWebsiteDomain } from "@/lib/growth/import/normalize"
import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthHomeSimplifiedProgressCard } from "@/lib/growth/home/growth-home-simplification-1a"
import { buildCustomerPackageReviewHref } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"

export const GROWTH_HOME_REVIEW_QUEUE_1B_QA_MARKER =
  "ava-home-review-queue-1b-outreach-queue-v1" as const

export const GROWTH_HOME_REVIEW_QUEUE_TITLE = "Outreach Review Queue" as const
export const GROWTH_HOME_REVIEW_QUEUE_SUBTITLE =
  "Scan, preview, and approve prepared outreach without leaving Home." as const
export const GROWTH_HOME_REVIEW_QUEUE_NO_WEBSITE_LABEL = "No verified website" as const
export const GROWTH_HOME_REVIEW_QUEUE_REVIEW_OUTREACH_CTA = "Review Outreach" as const

export type GrowthHomeReviewQueueRowStatus =
  | "recommended"
  | "needs_review"
  | "approved"
  | "blocked"

export type GrowthHomeReviewQueueWebsiteDisplay = {
  rootDomain: string | null
  href: string | null
  canonicalUrl: string | null
  label: string
}

export type GrowthHomeReviewQueueRow = {
  id: string
  packageId: string
  leadId: string
  companyName: string
  primaryContact: string | null
  website: GrowthHomeReviewQueueWebsiteDisplay
  fitPercent: number | null
  status: GrowthHomeReviewQueueRowStatus
  statusLabel: string
  subject: string | null
  rationale: string | null
  reviewHref: string
  editHref: string
  packageSource?: GrowthCanonicalOperatorApprovalPackagePreview["packageSource"]
  selectable: boolean
  selectableForSend: boolean
  generationStatus: "draft" | "approved" | "unknown"
}

export type GrowthHomeReviewQueuePresentation = {
  qaMarker: typeof GROWTH_HOME_REVIEW_QUEUE_1B_QA_MARKER
  rows: GrowthHomeReviewQueueRow[]
  recommendedCount: number
  needsReviewCount: number
  packagesPrepared: number
  awaitingReviewCount: number
  approvedCount: number
  reviewOutreachHref: string | null
}

export type GrowthHomeReviewQueueDailyBrief = {
  qaMarker: typeof GROWTH_HOME_REVIEW_QUEUE_1B_QA_MARKER
  accomplishmentLine: string | null
  packagesPreparedLine: string | null
  recommendSendLine: string | null
  needsAdditionalReviewLine: string | null
  primaryActionHref: string | null
  primaryActionLabel: string
}

export function resolveVerifiedWebsiteDisplay(
  website: string | null | undefined,
): GrowthHomeReviewQueueWebsiteDisplay {
  const raw = website?.trim()
  if (!raw) {
    return {
      rootDomain: null,
      href: null,
      canonicalUrl: null,
      label: GROWTH_HOME_REVIEW_QUEUE_NO_WEBSITE_LABEL,
    }
  }

  const rootDomain = normalizeWebsiteDomain(raw)
  if (!rootDomain || isConsumerEmailDomain(rootDomain)) {
    return {
      rootDomain: null,
      href: null,
      canonicalUrl: null,
      label: GROWTH_HOME_REVIEW_QUEUE_NO_WEBSITE_LABEL,
    }
  }

  const canonicalUrl = raw.includes("://") ? raw : `https://${rootDomain}`
  return {
    rootDomain,
    href: canonicalUrl,
    canonicalUrl,
    label: rootDomain,
  }
}

function resolveFitPercent(lead: GrowthLead | null | undefined): number | null {
  if (typeof lead?.score !== "number" || !Number.isFinite(lead.score)) return null
  const score = lead.score
  if (score <= 1) return Math.round(score * 100)
  return Math.round(Math.min(100, Math.max(0, score)))
}

function mapPackageStatus(input: {
  pkg: GrowthCanonicalOperatorApprovalPackagePreview
  supervisedReady?: GrowthSupervisedAvaHomeReadyItem | null
}): { status: GrowthHomeReviewQueueRowStatus; statusLabel: string; generationStatus: "draft" | "approved" | "unknown" } {
  const label = input.pkg.statusLabel.trim().toLowerCase()
  if (/approved|authorized/.test(label)) {
    return { status: "approved", statusLabel: "Approved", generationStatus: "approved" }
  }
  if (/needs|hold|blocked|information|attention/.test(label)) {
    return { status: "needs_review", statusLabel: "Needs Review", generationStatus: "unknown" }
  }
  if (input.supervisedReady) {
    return { status: "recommended", statusLabel: "Recommended", generationStatus: "draft" }
  }
  return { status: "recommended", statusLabel: input.pkg.statusLabel || "Recommended", generationStatus: "draft" }
}

function buildRowFromPackage(input: {
  pkg: GrowthCanonicalOperatorApprovalPackagePreview
  lead?: GrowthLead | null
  supervisedReady?: GrowthSupervisedAvaHomeReadyItem | null
}): GrowthHomeReviewQueueRow {
  const statusMeta = mapPackageStatus({ pkg: input.pkg, supervisedReady: input.supervisedReady })
  const subject = input.supervisedReady?.subject ?? input.pkg.channelLabel ?? null
  const rationale = input.supervisedReady?.rationale ?? input.pkg.operatorDetail ?? null

  return {
    id: `queue:${input.pkg.packageId}`,
    packageId: input.pkg.packageId,
    leadId: input.pkg.leadId,
    companyName: input.pkg.companyName,
    primaryContact: input.supervisedReady?.contactName ?? input.pkg.decisionMaker,
    website: resolveVerifiedWebsiteDisplay(input.lead?.website),
    fitPercent: resolveFitPercent(input.lead),
    status: statusMeta.status,
    statusLabel: statusMeta.statusLabel,
    subject,
    rationale,
    reviewHref: input.pkg.reviewHref,
    editHref: input.pkg.reviewHref,
    packageSource: input.pkg.packageSource,
    selectable: statusMeta.status === "recommended" || statusMeta.status === "approved",
    selectableForSend: statusMeta.status === "approved",
    generationStatus: statusMeta.generationStatus,
  }
}

function buildRowFromNeedsInformation(input: {
  item: GrowthSupervisedAvaHomeNeedsInformationItem
  lead?: GrowthLead | null
}): GrowthHomeReviewQueueRow {
  return {
    id: `queue-needs:${input.item.leadId}`,
    packageId: input.item.leadId,
    leadId: input.item.leadId,
    companyName: input.item.companyName,
    primaryContact: null,
    website: resolveVerifiedWebsiteDisplay(input.lead?.website),
    fitPercent: resolveFitPercent(input.lead),
    status: "needs_review",
    statusLabel: "Needs Review",
    subject: null,
    rationale: input.item.rationale,
    reviewHref: input.item.reviewHref,
    editHref: input.item.reviewHref,
    selectable: false,
    selectableForSend: false,
    generationStatus: "unknown",
  }
}

export function buildGrowthHomeReviewQueuePresentation(input: {
  packages: GrowthCanonicalOperatorApprovalPackagePreview[]
  needsInformation?: GrowthSupervisedAvaHomeNeedsInformationItem[]
  leadsById?: Map<string, GrowthLead>
  supervisedReadyByLeadId?: Map<string, GrowthSupervisedAvaHomeReadyItem>
  reviewOutreachHref?: string | null
}): GrowthHomeReviewQueuePresentation {
  const leadsById = input.leadsById ?? new Map<string, GrowthLead>()
  const supervisedReadyByLeadId = input.supervisedReadyByLeadId ?? new Map<string, GrowthSupervisedAvaHomeReadyItem>()

  const rows: GrowthHomeReviewQueueRow[] = []
  for (const pkg of input.packages) {
    rows.push(
      buildRowFromPackage({
        pkg,
        lead: leadsById.get(pkg.leadId),
        supervisedReady: supervisedReadyByLeadId.get(pkg.leadId) ?? null,
      }),
    )
  }

  for (const item of input.needsInformation ?? []) {
    if (rows.some((row) => row.leadId === item.leadId)) continue
    rows.push(
      buildRowFromNeedsInformation({
        item,
        lead: leadsById.get(item.leadId),
      }),
    )
  }

  const recommendedCount = rows.filter((row) => row.status === "recommended").length
  const needsReviewCount = rows.filter((row) => row.status === "needs_review").length
  const approvedCount = rows.filter((row) => row.status === "approved").length

  return {
    qaMarker: GROWTH_HOME_REVIEW_QUEUE_1B_QA_MARKER,
    rows,
    recommendedCount,
    needsReviewCount,
    packagesPrepared: rows.filter((row) => row.status !== "needs_review").length,
    awaitingReviewCount: recommendedCount,
    approvedCount,
    reviewOutreachHref:
      input.reviewOutreachHref ??
      rows.find((row) => row.selectable)?.reviewHref ??
      (rows[0] ? buildCustomerPackageReviewHref(rows[0].leadId) : null),
  }
}

export function buildGrowthHomeReviewQueueDailyBrief(input: {
  companiesReviewedToday?: number
  queue: GrowthHomeReviewQueuePresentation
}): GrowthHomeReviewQueueDailyBrief {
  const reviewed = Math.max(0, input.companiesReviewedToday ?? 0)
  const prepared = input.queue.packagesPrepared
  const recommendSend = input.queue.recommendedCount + input.queue.approvedCount
  const needsReview = input.queue.needsReviewCount

  const accomplishmentLine =
    reviewed > 0
      ? `Today I reviewed ${reviewed} ${reviewed === 1 ? "company" : "companies"}.`
      : prepared > 0
        ? `I've prepared ${prepared} outreach ${prepared === 1 ? "package" : "packages"} for your review.`
        : null

  const packagesPreparedLine =
    prepared > 0
      ? `I prepared ${prepared} outreach ${prepared === 1 ? "package" : "packages"}.`
      : null

  const recommendSendLine =
    recommendSend > 0
      ? `I recommend sending ${recommendSend}.`
      : null

  const needsAdditionalReviewLine =
    needsReview > 0
      ? `${needsReview} ${needsReview === 1 ? "needs" : "need"} additional review.`
      : null

  return {
    qaMarker: GROWTH_HOME_REVIEW_QUEUE_1B_QA_MARKER,
    accomplishmentLine,
    packagesPreparedLine,
    recommendSendLine,
    needsAdditionalReviewLine,
    primaryActionHref: input.queue.reviewOutreachHref,
    primaryActionLabel: GROWTH_HOME_REVIEW_QUEUE_REVIEW_OUTREACH_CTA,
  }
}

export function buildGrowthHomeReviewQueueProgressCards(input: {
  companiesReviewedToday?: number
  packagesPrepared?: number
  awaitingReview?: number
  approvedCount?: number
  emailsSentToday?: number
  activeOutreachCount?: number
}): GrowthHomeSimplifiedProgressCard[] {
  const cards: GrowthHomeSimplifiedProgressCard[] = []

  if ((input.companiesReviewedToday ?? 0) > 0) {
    cards.push({
      id: "companies-reviewed",
      label: "Companies Reviewed",
      value: String(input.companiesReviewedToday),
    })
  }
  if ((input.packagesPrepared ?? 0) > 0) {
    cards.push({
      id: "packages-prepared",
      label: "Packages Prepared",
      value: String(input.packagesPrepared),
    })
  }
  if ((input.awaitingReview ?? 0) > 0) {
    cards.push({
      id: "awaiting-review",
      label: "Awaiting Review",
      value: String(input.awaitingReview),
    })
  }
  if ((input.approvedCount ?? 0) > 0) {
    cards.push({ id: "approved", label: "Approved", value: String(input.approvedCount) })
  }
  if ((input.emailsSentToday ?? 0) > 0) {
    cards.push({ id: "sent-today", label: "Sent Today", value: String(input.emailsSentToday) })
  }
  if ((input.activeOutreachCount ?? 0) > 0) {
    cards.push({
      id: "active-outreach",
      label: "Active Outreach",
      value: String(input.activeOutreachCount),
    })
  }

  return cards.slice(0, 6)
}

export function filterSelectableRecommendedRows(rows: GrowthHomeReviewQueueRow[]): GrowthHomeReviewQueueRow[] {
  return rows.filter((row) => row.selectable && row.status === "recommended")
}

export function shouldUseReviewQueuePrimarySurface(input: {
  queue: GrowthHomeReviewQueuePresentation
}): boolean {
  return input.queue.rows.length > 0
}

export function shouldHideSingleCompanyFocus(input: {
  queue: GrowthHomeReviewQueuePresentation
}): boolean {
  return input.queue.rows.length >= 2 || input.queue.awaitingReviewCount >= 1
}

export type GrowthHomeReviewQueueClientErrorCode =
  | "package_requires_reapproval"
  | "recipient_missing"
  | "mailbox_unavailable"
  | "already_sent"
  | "review_package_unavailable"
  | "approval_package_source_mismatch"
  | "approval_generation_not_found"
  | "unknown"

const ERROR_MESSAGES: Record<GrowthHomeReviewQueueClientErrorCode, string> = {
  package_requires_reapproval: "Package requires reapproval before it can be sent.",
  recipient_missing: "Recipient missing — open the package to choose a contact.",
  mailbox_unavailable: "Mailbox unavailable — check your connected sender mailbox.",
  already_sent: "Already sent — this package is no longer in your review queue.",
  review_package_unavailable: "Review package unavailable — refresh Home and try again.",
  approval_package_source_mismatch: "Review package unavailable — open the account review drawer.",
  approval_generation_not_found: "Review package unavailable — the recommendation may have moved.",
  unknown: "Something went wrong — refresh and try again.",
}

export function mapReviewQueueClientError(input: {
  error?: string | null
  message?: string | null
  status?: number
}): string {
  const code = input.error?.trim() as GrowthHomeReviewQueueClientErrorCode | undefined
  if (code && code in ERROR_MESSAGES) return ERROR_MESSAGES[code]

  const message = input.message?.trim().toLowerCase() ?? ""
  if (/reapprov|stale|binding/.test(message)) return ERROR_MESSAGES.package_requires_reapproval
  if (/recipient|contact/.test(message)) return ERROR_MESSAGES.recipient_missing
  if (/mailbox|sender/.test(message)) return ERROR_MESSAGES.mailbox_unavailable
  if (/already sent|sent_at/.test(message)) return ERROR_MESSAGES.already_sent
  if (/failed to fetch/i.test(message)) return ERROR_MESSAGES.review_package_unavailable
  if (input.status === 404) return ERROR_MESSAGES.review_package_unavailable
  if (input.status === 409) return ERROR_MESSAGES.approval_package_source_mismatch

  return input.message?.trim() || ERROR_MESSAGES.unknown
}

export function buildLeadsByIdMap(leads: GrowthLead[] | null | undefined): Map<string, GrowthLead> {
  const map = new Map<string, GrowthLead>()
  for (const lead of leads ?? []) {
    if (lead.id) map.set(lead.id, lead)
  }
  return map
}

export function buildSupervisedReadyByLeadIdMap(
  items: GrowthSupervisedAvaHomeReadyItem[] | null | undefined,
): Map<string, GrowthSupervisedAvaHomeReadyItem> {
  const map = new Map<string, GrowthSupervisedAvaHomeReadyItem>()
  for (const item of items ?? []) {
    map.set(item.leadId, item)
  }
  return map
}
