/** Growth Engine SR-2B-1 — Personalized Share Pages types (client-safe). */

import type { GrowthSharePageBookingRenderModel } from "@/lib/growth/share-pages/share-page-booking-attribution"

export type { GrowthSharePageBookingRenderModel }

export const GROWTH_SHARE_PAGES_QA_MARKER = "share-pages-sr2-v1" as const

export const GROWTH_SHARE_PAGES_CONFIRM = "RUN_GROWTH_SHARE_PAGES_CERTIFICATION" as const

export const GROWTH_SHARE_PAGES_MIGRATION =
  "20270826120000_growth_engine_share_pages_foundation.sql" as const

export const GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER = "share-pages-analytics-sr2b3-v1" as const

export const GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION =
  "20270826120100_growth_engine_share_pages_analytics.sql" as const

export const GROWTH_SHARE_PAGES_ANALYTICS_CONFIRM = "RUN_GROWTH_SHARE_PAGES_ANALYTICS_CERTIFICATION" as const

export const GROWTH_SHARE_PAGES_BOOKING_QA_MARKER = "share-pages-booking-sr2b4-v1" as const

export const GROWTH_SHARE_PAGES_BOOKING_MIGRATION =
  "20270826120200_growth_engine_share_pages_booking_attribution.sql" as const

export const GROWTH_SHARE_PAGES_BOOKING_CONFIRM = "RUN_GROWTH_SHARE_PAGES_BOOKING_CERTIFICATION" as const

export const GROWTH_SHARE_PAGE_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "expired",
  "revoked",
  "archived",
] as const

export type GrowthSharePageStatus = (typeof GROWTH_SHARE_PAGE_STATUSES)[number]

export const GROWTH_SHARE_PAGE_SOURCE_CHANNELS = [
  "email",
  "sms",
  "voice",
  "call",
  "linkedin",
  "sequence",
  "manual",
  "other",
] as const

export type GrowthSharePageSourceChannel = (typeof GROWTH_SHARE_PAGE_SOURCE_CHANNELS)[number]

export const GROWTH_SHARE_PAGE_HERO_MEDIA_TYPES = ["none", "image", "video"] as const

export type GrowthSharePageHeroMediaType = (typeof GROWTH_SHARE_PAGE_HERO_MEDIA_TYPES)[number]

export const GROWTH_SHARE_PAGE_PUBLIC_THEME_MODES = ["system", "light", "dark"] as const

export type GrowthSharePagePublicThemeMode = (typeof GROWTH_SHARE_PAGE_PUBLIC_THEME_MODES)[number]

export const GROWTH_SHARE_PAGE_EVENT_TYPES = [
  "SHARE_PAGE_VIEWED",
  "SHARE_PAGE_SESSION_STARTED",
  "SHARE_PAGE_SCROLL_25",
  "SHARE_PAGE_SCROLL_50",
  "SHARE_PAGE_SCROLL_75",
  "SHARE_PAGE_SCROLL_100",
  "SHARE_PAGE_CTA_CLICKED",
  "SHARE_PAGE_BOOKING_STARTED",
  "SHARE_PAGE_BOOKING_COMPLETED",
  "SHARE_PAGE_RESOURCE_OPENED",
] as const

export type GrowthSharePageEventType = (typeof GROWTH_SHARE_PAGE_EVENT_TYPES)[number]

export type GrowthSharePageTheme = {
  brandColor: string
  accentColor: string
  logoUrl: string | null
  heroImageUrl: string | null
  publicThemeMode: GrowthSharePagePublicThemeMode
  footerNote: string | null
  pageBackground?: string
  pageText?: string
  surfaceColor?: string
  buttonBackground?: string
  buttonText?: string
  headerBackground?: string
  headerText?: string
}

export type GrowthSharePageCTA = {
  id: string
  label: string
  kind: "primary" | "secondary" | "link"
  action: "book_meeting" | "open_url" | "download_resource" | "reply_email"
  destinationUrl: string | null
  resourceId: string | null
  trackingKey: string
}

export type GrowthSharePageResource = {
  id: string
  title: string
  description: string | null
  kind: "pdf" | "link" | "case_study" | "one_pager"
  url: string
  thumbnailUrl: string | null
}

export type GrowthSharePagePersonalizationContext = {
  prospectName: string
  companyName: string
  headline: string
  personalizedMessage: string
  whyReachingOut: string
  companyObservations: string[]
  researchSummary: string | null
  accountPlaybookSummary: string | null
  suggestedCta: GrowthSharePageCTA | null
  nextBestMessage: string | null
  bookingLink: string | null
  resources: GrowthSharePageResource[]
  sourcesUsed: string[]
  evidenceCoverageScore: number
  researchConfidence: number | null
  generatedAt: string
}

export type GrowthSharePageEngagementSummary = {
  viewCount: number
  uniqueSessionCount: number
  ctaClickCount: number
  bookingStartedCount: number
  bookingCompletedCount: number
  resourceOpenCount: number
  maxScrollDepthPct: number
  avgDurationMs: number
  lastActivityAt: string | null
}

export type GrowthSharePage = {
  id: string
  organizationId: string
  leadId: string
  companyId: string | null
  campaignId: string | null
  enrollmentId: string | null
  sequenceStepId: string | null
  sequenceEnrollmentStepId: string | null
  sequenceExecutionJobId: string | null
  sourceChannel: GrowthSharePageSourceChannel
  status: GrowthSharePageStatus
  tokenPrefix: string
  publishedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  archivedAt: string | null
  firstViewedAt: string | null
  lastViewedAt: string | null
  maxViews: number | null
  engagementSummary: GrowthSharePageEngagementSummary
  personalizationSnapshot: GrowthSharePagePersonalizationContext | Record<string, unknown>
  personalizationContextVersion: number
  sourcesUsed: string[]
  evidenceCoverageScore: number | null
  theme: GrowthSharePageTheme
  headline: string
  subheadline: string | null
  heroMessage: string
  whyReachingOut: string | null
  companyObservations: string[]
  ctaConfig: GrowthSharePageCTA[]
  resources: GrowthSharePageResource[]
  bookingPageId: string | null
  heroMediaType: GrowthSharePageHeroMediaType
  heroMediaUrl: string | null
  heroMediaThumbnailUrl: string | null
  voiceAssetId: string | null
  videoAssetId: string | null
  sharePageTemplateId: string | null
  sharePageTemplateVersionId: string | null
  templateBlocksSnapshot: unknown[] | Record<string, unknown> | null
  createdBy: string | null
  approvedBy: string | null
  approvedAt: string | null
  requiresHumanReview: true
  createdAt: string
  updatedAt: string
}

export type GrowthSharePageView = {
  id: string
  sharePageId: string
  leadId: string
  sessionKey: string
  visitorFingerprintHash: string | null
  startedAt: string
  lastActivityAt: string
  endedAt: string | null
  durationMs: number
  maxScrollDepthPct: number
  pageUrl: string
  referrer: string | null
  utm: Record<string, string>
  deviceMetadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthSharePageEvent = {
  id: string
  sharePageId: string
  sharePageViewId: string | null
  leadId: string
  eventType: GrowthSharePageEventType
  eventLabel: string
  metadata: Record<string, unknown>
  occurredAt: string
  createdAt: string
}

export type GrowthSharePageCreateInput = {
  organizationId: string
  leadId: string
  companyId?: string | null
  campaignId?: string | null
  enrollmentId?: string | null
  sequenceStepId?: string | null
  sequenceEnrollmentStepId?: string | null
  sequenceExecutionJobId?: string | null
  sourceChannel?: GrowthSharePageSourceChannel
  status?: Extract<GrowthSharePageStatus, "draft" | "pending_review">
  expiresAt?: string | null
  maxViews?: number | null
  personalizationSnapshot?: GrowthSharePagePersonalizationContext | Record<string, unknown>
  personalizationContextVersion?: number
  sourcesUsed?: string[]
  evidenceCoverageScore?: number | null
  theme?: Partial<GrowthSharePageTheme>
  headline?: string
  subheadline?: string | null
  heroMessage?: string
  whyReachingOut?: string | null
  companyObservations?: string[]
  ctaConfig?: GrowthSharePageCTA[]
  resources?: GrowthSharePageResource[]
  bookingPageId?: string | null
  heroMediaType?: GrowthSharePageHeroMediaType
  heroMediaUrl?: string | null
  heroMediaThumbnailUrl?: string | null
  voiceAssetId?: string | null
  videoAssetId?: string | null
  sharePageTemplateId?: string | null
  sharePageTemplateVersionId?: string | null
  templateBlocksSnapshot?: unknown[] | Record<string, unknown> | null
  createdBy?: string | null
}

export type GrowthSharePageCreateResult = {
  page: GrowthSharePage
  publicToken: string
  previewToken: string
}

export type GrowthSharePageUpdateInput = {
  status?: Extract<GrowthSharePageStatus, "draft" | "pending_review">
  expiresAt?: string | null
  maxViews?: number | null
  personalizationSnapshot?: GrowthSharePagePersonalizationContext | Record<string, unknown>
  personalizationContextVersion?: number
  sourcesUsed?: string[]
  evidenceCoverageScore?: number | null
  theme?: Partial<GrowthSharePageTheme>
  headline?: string
  subheadline?: string | null
  heroMessage?: string
  whyReachingOut?: string | null
  companyObservations?: string[]
  ctaConfig?: GrowthSharePageCTA[]
  resources?: GrowthSharePageResource[]
  bookingPageId?: string | null
  heroMediaType?: GrowthSharePageHeroMediaType
  heroMediaUrl?: string | null
  heroMediaThumbnailUrl?: string | null
  voiceAssetId?: string | null
  videoAssetId?: string | null
}

export type GrowthSharePageAnalyticsSummary = {
  sharePageId: string
  leadId: string
  status: GrowthSharePageStatus
  viewCount: number
  uniqueSessionCount: number
  eventCounts: Partial<Record<GrowthSharePageEventType, number>>
  engagementSummary: GrowthSharePageEngagementSummary
  firstViewedAt: string | null
  lastViewedAt: string | null
  lastEventAt: string | null
}

export const GROWTH_SHARE_PAGE_STATUS_LABELS: Record<GrowthSharePageStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  expired: "Expired",
  revoked: "Revoked",
  archived: "Archived",
}

export const DEFAULT_GROWTH_SHARE_PAGE_THEME: GrowthSharePageTheme = {
  brandColor: "#059669",
  accentColor: "#047857",
  logoUrl: null,
  heroImageUrl: null,
  publicThemeMode: "system",
  footerNote: null,
}

export const EMPTY_GROWTH_SHARE_PAGE_ENGAGEMENT_SUMMARY: GrowthSharePageEngagementSummary = {
  viewCount: 0,
  uniqueSessionCount: 0,
  ctaClickCount: 0,
  bookingStartedCount: 0,
  bookingCompletedCount: 0,
  resourceOpenCount: 0,
  maxScrollDepthPct: 0,
  avgDurationMs: 0,
  lastActivityAt: null,
}

export const GROWTH_SHARE_PAGE_PUBLIC_ACCESS_REASONS = [
  "granted",
  "not_found",
  "invalid_token",
  "unpublished",
  "expired",
  "revoked",
  "archived",
] as const

export type GrowthSharePagePublicAccessReason = (typeof GROWTH_SHARE_PAGE_PUBLIC_ACCESS_REASONS)[number]

export type GrowthSharePagePublicAccessResult = {
  access: GrowthSharePagePublicAccessReason
  page: GrowthSharePage | null
}

export type GrowthSharePageRenderModel = {
  sharePageId: string
  publicToken: string | null
  prospectName: string
  companyName: string
  headline: string
  subheadline: string | null
  heroMessage: string
  whyReachingOut: string | null
  companyObservations: string[]
  ctaConfig: GrowthSharePageCTA[]
  resources: GrowthSharePageResource[]
  theme: GrowthSharePageTheme
  heroMediaType: GrowthSharePageHeroMediaType
  heroMediaUrl: string | null
  heroMediaThumbnailUrl: string | null
  voiceAssetId: string | null
  videoAssetId: string | null
  previewMode: boolean
  booking: GrowthSharePageBookingRenderModel | null
}

export const GROWTH_SHARE_PAGES_SSR_QA_MARKER = "share-pages-ssr-sr2b2-v1" as const

export const GROWTH_SHARE_PAGE_THEME_QA_MARKER = "growth-share-page-theme-gs-share-7b-v1" as const

export const GROWTH_SHARE_PAGE_OPERATOR_DEFAULT_THEME: Required<
  Pick<
    GrowthSharePageTheme,
    | "pageBackground"
    | "pageText"
    | "surfaceColor"
    | "buttonBackground"
    | "buttonText"
    | "headerBackground"
    | "headerText"
    | "brandColor"
    | "accentColor"
  >
> = {
  pageBackground: "#f8fafc",
  pageText: "#0f172a",
  surfaceColor: "#ffffff",
  brandColor: "#2563eb",
  accentColor: "#2563eb",
  buttonBackground: "#f59e0b",
  buttonText: "#111827",
  headerBackground: "#07111f",
  headerText: "#ffffff",
}

const SHARE_PAGE_HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function normalizeSharePageThemeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  if (!SHARE_PAGE_HEX_COLOR.test(trimmed)) return fallback
  return trimmed.length === 4
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
    : trimmed
}

export function hasSharePageExtendedTheme(theme: GrowthSharePageTheme): boolean {
  return Boolean(
    theme.pageBackground ||
      theme.pageText ||
      theme.surfaceColor ||
      theme.buttonBackground ||
      theme.buttonText ||
      theme.headerBackground ||
      theme.headerText,
  )
}

export function parseSharePageExtendedTheme(
  source: Partial<GrowthSharePageTheme> | null | undefined,
  fallback = GROWTH_SHARE_PAGE_OPERATOR_DEFAULT_THEME,
): GrowthSharePageTheme {
  const base = { ...DEFAULT_GROWTH_SHARE_PAGE_THEME, ...fallback, ...(source ?? {}) }
  return {
    brandColor: normalizeSharePageThemeColor(source?.brandColor, base.brandColor),
    accentColor: normalizeSharePageThemeColor(source?.accentColor, base.accentColor),
    logoUrl: typeof source?.logoUrl === "string" && source.logoUrl.trim() ? source.logoUrl.trim() : null,
    heroImageUrl:
      typeof source?.heroImageUrl === "string" && source.heroImageUrl.trim() ? source.heroImageUrl.trim() : null,
    publicThemeMode:
      source?.publicThemeMode === "light" || source?.publicThemeMode === "dark" || source?.publicThemeMode === "system"
        ? source.publicThemeMode
        : DEFAULT_GROWTH_SHARE_PAGE_THEME.publicThemeMode,
    footerNote: typeof source?.footerNote === "string" && source.footerNote.trim() ? source.footerNote.trim() : null,
    pageBackground: normalizeSharePageThemeColor(source?.pageBackground, base.pageBackground!),
    pageText: normalizeSharePageThemeColor(source?.pageText, base.pageText!),
    surfaceColor: normalizeSharePageThemeColor(source?.surfaceColor, base.surfaceColor!),
    buttonBackground: normalizeSharePageThemeColor(source?.buttonBackground, base.buttonBackground!),
    buttonText: normalizeSharePageThemeColor(source?.buttonText, base.buttonText!),
    headerBackground: normalizeSharePageThemeColor(source?.headerBackground, base.headerBackground!),
    headerText: normalizeSharePageThemeColor(source?.headerText, base.headerText!),
  }
}

export function sharePageExtendedThemeCssVars(theme: GrowthSharePageTheme): Record<string, string> {
  const resolved = parseSharePageExtendedTheme(theme)
  return {
    ["--share-brand-color" as string]: resolved.brandColor,
    ["--share-accent-color" as string]: resolved.accentColor,
    ["--share-page-bg" as string]: resolved.pageBackground ?? resolved.brandColor,
    ["--share-page-text" as string]: resolved.pageText ?? "#0f172a",
    ["--share-surface" as string]: resolved.surfaceColor ?? "#ffffff",
    ["--share-button-bg" as string]: resolved.buttonBackground ?? resolved.brandColor,
    ["--share-button-text" as string]: resolved.buttonText ?? "#ffffff",
    ["--share-header-bg" as string]: resolved.headerBackground ?? resolved.brandColor,
    ["--share-header-text" as string]: resolved.headerText ?? "#ffffff",
  }
}

export type SharePageQuickTemplate = {
  id: string
  label: string
  description: string
  headline: string
  heroMessage: string
  whyReachingOut: string
  companyObservations: string[]
  ctaLabel: string
  footerNote?: string
}

export const GROWTH_SHARE_PAGE_QUICK_TEMPLATES: SharePageQuickTemplate[] = [
  {
    id: "equipment_service_demo",
    label: "Equipment Service Demo",
    description: "Demo outreach for commercial equipment service teams.",
    headline: "A personalized walkthrough for {{company.name}}",
    heroMessage:
      "Hi {{lead.first_name}} — I put together a short overview of how Equipify helps equipment service teams dispatch smarter and keep customers informed.",
    whyReachingOut: "Your team likely juggles dispatch, scheduling, and customer updates across multiple tools.",
    companyObservations: ["Dispatch & routing", "Scheduling & capacity", "Customer portal", "Equipment tracking"],
    ctaLabel: "Schedule Demo",
  },
  {
    id: "roofing_restoration",
    label: "Roofing & Restoration",
    description: "For roofing and restoration operators.",
    headline: "How {{company.name}} can streamline field operations",
    heroMessage:
      "Hi {{lead.first_name}} — here's a tailored look at how service businesses like yours coordinate crews, photos, and customer updates in one place.",
    whyReachingOut: "Restoration teams need fast coordination between estimators, crews, and homeowners.",
    companyObservations: ["Job documentation", "Crew coordination", "Customer updates", "Photo capture"],
    ctaLabel: "Book a walkthrough",
  },
  {
    id: "hvac_service_demo",
    label: "HVAC Service Demo",
    description: "HVAC install and service workflows.",
    headline: "Equipify for {{company.name}}",
    heroMessage:
      "Hi {{lead.first_name}} — this page summarizes how HVAC teams use Equipify for scheduling, dispatch, and customer communication.",
    whyReachingOut: "Seasonal demand makes capacity planning and technician routing especially important.",
    companyObservations: ["Technician routing", "Maintenance plans", "Customer notifications", "Job costing"],
    ctaLabel: "Schedule Demo",
  },
  {
    id: "general_field_service",
    label: "General Field Service Demo",
    description: "Default field service outreach page.",
    headline: "Personalized overview for {{company.name}}",
    heroMessage:
      "Hi {{lead.first_name}} — I recorded a quick overview of how Equipify helps field service teams run day-to-day operations.",
    whyReachingOut: "Most teams we talk to want fewer spreadsheets and clearer customer communication.",
    companyObservations: ["Dispatch", "Scheduling", "Invoicing handoff", "Customer portal"],
    ctaLabel: "Schedule a call",
  },
  {
    id: "proposal_follow_up",
    label: "Proposal Follow-Up",
    description: "Follow up after sending a proposal or quote.",
    headline: "Following up on your Equipify overview",
    heroMessage:
      "Hi {{lead.first_name}} — wanted to share a concise recap and answer any questions about the proposal we discussed.",
    whyReachingOut: "Happy to clarify pricing, rollout, or how your team would adopt the platform.",
    companyObservations: ["Implementation timeline", "Team training", "Integrations", "Support"],
    ctaLabel: "Book follow-up",
  },
  {
    id: "re_engagement",
    label: "Re-engagement",
    description: "Re-open a stalled conversation.",
    headline: "Checking back in with {{company.name}}",
    heroMessage:
      "Hi {{lead.first_name}} — sharing an updated overview in case timing is better now for a quick conversation.",
    whyReachingOut: "No pressure — this page is here whenever your team is ready to revisit operations software.",
    companyObservations: ["What's changed since we last spoke", "New product updates", "Customer stories"],
    ctaLabel: "Pick a time",
  },
  {
    id: "customer_portal_walkthrough",
    label: "Customer Portal Walkthrough",
    description: "Highlight customer-facing portal capabilities.",
    headline: "Customer portal walkthrough for {{company.name}}",
    heroMessage:
      "Hi {{lead.first_name}} — here's how your customers would experience scheduling, updates, and service history through Equipify.",
    whyReachingOut: "A modern portal reduces phone tag and improves customer satisfaction.",
    companyObservations: ["Self-service scheduling", "Job status updates", "Document sharing", "Branded experience"],
    ctaLabel: "See it live",
  },
  {
    id: "meeting_follow_up",
    label: "Meeting Follow-Up",
    description: "Recap after a discovery call or demo.",
    headline: "Recap from our conversation",
    heroMessage:
      "Hi {{lead.first_name}} — thanks for the time today. Here's a recap of what we covered and suggested next steps for {{company.name}}.",
    whyReachingOut: "Let me know if you'd like to involve additional stakeholders on a follow-up call.",
    companyObservations: ["Key takeaways", "Open questions", "Recommended next steps", "Resources"],
    ctaLabel: "Schedule next steps",
  },
]

export function getSharePageQuickTemplate(id: string): SharePageQuickTemplate | null {
  return GROWTH_SHARE_PAGE_QUICK_TEMPLATES.find((template) => template.id === id) ?? null
}
