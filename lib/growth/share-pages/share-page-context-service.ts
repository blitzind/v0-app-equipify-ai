import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAccountPlaybookEngine } from "@/lib/growth/apollo/apollo-account-playbook-engine"
import { fetchGrowthBookingPageById } from "@/lib/growth/booking/booking-page-repository"
import type {
  GrowthSharePageCTA,
  GrowthSharePagePersonalizationContext,
  GrowthSharePageResource,
} from "@/lib/growth/share-pages/share-page-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import { computeGrowthLeadNextBestAction } from "@/lib/growth/next-best-action"
import { GROWTH_NEXT_BEST_ACTION_LABELS } from "@/lib/growth/nba-types"
import { buildPersonalizationContext } from "@/lib/growth/personalization/personalization-context-builder"
import { sanitizePersonalizationEvidenceSnippet } from "@/lib/growth/personalization/personalization-types"
import { fetchLatestUsableGrowthLeadResearchRun } from "@/lib/growth/research-repository"

export type BuildGrowthSharePageContextInput = {
  leadId: string
  companyId?: string | null
  campaignId?: string | null
  enrollmentId?: string | null
  bookingPageId?: string | null
  contentTemplateVersionId?: string | null
  snippetIds?: string[]
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function computeEvidenceCoverageScore(sourceCount: number): number {
  return Math.min(100, Math.max(0, Math.round(sourceCount * 12)))
}

function buildDefaultHeadline(prospectName: string, companyName: string, angle: string | null): string {
  if (angle) return sanitizePersonalizationEvidenceSnippet(angle, 120)
  if (prospectName && companyName) {
    return sanitizePersonalizationEvidenceSnippet(`A personalized note for ${prospectName} at ${companyName}`, 120)
  }
  return sanitizePersonalizationEvidenceSnippet(`A personalized note for ${companyName}`, 120)
}

function buildSuggestedCta(input: {
  nbaAction: string
  nbaLabel: string
  bookingLink: string | null
}): GrowthSharePageCTA | null {
  if (input.bookingLink) {
    return {
      id: "cta-book-meeting",
      label: "Book a discovery call",
      kind: "primary",
      action: "book_meeting",
      destinationUrl: input.bookingLink,
      resourceId: null,
      trackingKey: "book_meeting",
    }
  }

  if (/call|demo|schedule|meeting/i.test(input.nbaAction)) {
    return {
      id: "cta-follow-up",
      label: input.nbaLabel,
      kind: "primary",
      action: "reply_email",
      destinationUrl: null,
      resourceId: null,
      trackingKey: "nba_follow_up",
    }
  }

  return null
}

async function resolveBookingLink(
  admin: SupabaseClient,
  input: { bookingPageId?: string | null; enrollmentId?: string | null; campaignId?: string | null },
): Promise<string | null> {
  if (!input.bookingPageId) return null
  const bookingPage = await fetchGrowthBookingPageById(admin, input.bookingPageId)
  if (!bookingPage?.enabled) return null

  const base = `https://app.equipify.ai/book/${encodeURIComponent(bookingPage.slug)}`
  const url = new URL(base)
  url.searchParams.set("utm_source", "share_page")
  if (input.enrollmentId) url.searchParams.set("utm_campaign", input.enrollmentId)
  if (input.campaignId) url.searchParams.set("utm_content", input.campaignId)
  return url.toString()
}

async function resolveAccountPlaybookSummary(
  admin: SupabaseClient,
  input: { leadId: string; companyId?: string | null },
): Promise<string | null> {
  if (!input.companyId) return null

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("full_name, title, email, phone")
    .eq("company_id", input.companyId)
    .limit(6)

  const members = (contacts ?? []).map((row) => ({
    full_name: asString(row.full_name) || "Contact",
    title: asString(row.title) || null,
    email: asString(row.email) || null,
    phone: asString(row.phone) || null,
  }))

  if (members.length === 0) return null

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  const result = runAccountPlaybookEngine({
    canonical_company_id: input.companyId,
    company_profile: {
      company_name: lead?.companyName ?? "Account",
      summary: lead?.relationshipSummary ?? null,
      fit_score: lead?.score,
      research_score: lead?.researchPriority ? Number(lead.researchPriority) : null,
    },
    buying_committee_members: members,
    channel_availability: {
      email: members.some((member) => Boolean(member.email)),
      phone: members.some((member) => Boolean(member.phone)),
      sms: false,
      linkedin: false,
      voice_drop: false,
    },
    qualification_data: {
      qualification_score: lead?.opportunityReadinessScore ?? 0,
      buying_committee_coverage: members.length >= 3 ? 0.8 : members.length >= 1 ? 0.4 : 0,
      buying_committee_present: members.length > 0,
    },
  })

  return sanitizePersonalizationEvidenceSnippet(result.reasoning, 280)
}

export async function buildGrowthSharePageContext(
  admin: SupabaseClient,
  input: BuildGrowthSharePageContextInput,
): Promise<GrowthSharePagePersonalizationContext> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("lead_not_found")

  const [personalization, latestRun, emailSummary] = await Promise.all([
    buildPersonalizationContext(admin, {
      leadId: input.leadId,
      contentTemplateVersionId: input.contentTemplateVersionId ?? null,
      snippetIds: input.snippetIds,
    }),
    lead.latestResearchRunId ? fetchLatestUsableGrowthLeadResearchRun(admin, input.leadId) : Promise.resolve(null),
    fetchGrowthLeadEmailEventSummary(admin, input.leadId, lead.contactEmail),
  ])

  const prospectName = lead.contactName?.trim() || "there"
  const companyName = lead.companyName?.trim() || personalization.companyName
  const bookingLink = await resolveBookingLink(admin, input)
  const accountPlaybookSummary = await resolveAccountPlaybookSummary(admin, {
    leadId: input.leadId,
    companyId: input.companyId ?? null,
  })

  const nba = computeGrowthLeadNextBestAction({
    status: lead.status,
    score: lead.score,
    website: lead.website,
    websiteFetchStatus: latestRun?.websiteFetchStatus ?? null,
    lastResearchedAt: lead.lastResearchedAt,
    latestResearchRunId: lead.latestResearchRunId,
    contactPhone: lead.contactPhone,
    callDisposition: lead.callDisposition,
    followUpAt: lead.followUpAt,
    recommendedNextAction:
      lead.prospectRecommendedNextAction ?? latestRun?.result?.recommendedNextAction ?? null,
    prospectRecommendedNextAction: lead.prospectRecommendedNextAction,
    lastProspectResearchedAt: lead.lastProspectResearchedAt,
    latestProspectResearchRunId: lead.latestProspectResearchRunId,
    decisionMakerStatus: lead.decisionMakerStatus,
    primaryDecisionMakerPhone: null,
    emailSummary,
    engagementTier: lead.engagementTier,
    engagementLastActivityAt: lead.engagementLastActivityAt,
    engagementDormancyExemptUntil: lead.engagementDormancyExemptUntil,
    relationshipStrengthTier: lead.relationshipStrengthTier,
    relationshipTrend: lead.relationshipTrend,
    opportunityReadinessTier: lead.opportunityReadinessTier,
    opportunityBlockerKeys: lead.opportunityBlockers.map((blocker) => blocker.key),
    revenueProbabilityTier: lead.revenueProbabilityTier,
    revenueProbabilityScore: lead.revenueProbabilityScore,
    revenueProbabilityPreviousScore: lead.revenueProbabilityPreviousScore,
    revenueTrajectory: lead.revenueTrajectory,
    executivePriorityTier: lead.executivePriorityTier,
    operationalCapacityTier: lead.operationalCapacityTier,
    capacityPressureLevel: lead.capacityPressureLevel,
    operationalConstraintKeys: lead.operationalConstraints.map((entry) => entry.key),
    isProtectedOpportunity: false,
    workflowHealth: lead.workflowHealth,
    conversationHealthTier: lead.conversationHealthTier,
    conversationSentiment: lead.conversationSentiment,
    conversationUrgencyLevel: lead.conversationUrgencyLevel,
    conversationBuyingIntent: lead.conversationBuyingIntent,
    conversationCompetitorPressure: lead.conversationCompetitorPressure,
    conversationMomentum: lead.conversationMomentum,
    conversationTrend: lead.conversationTrend,
    recommendedSequencePatternId: lead.recommendedSequencePatternId,
    recommendedSequenceConfidence: lead.recommendedSequenceConfidence,
    sequenceFatigueRisk: lead.sequenceFatigueRisk,
  })

  const outreachAngle = personalization.outreachAngles[0] ?? null
  const headline = buildDefaultHeadline(prospectName, companyName, outreachAngle)
  const personalizedMessage =
    personalization.templateOverlay?.trim() ||
    personalization.companySummary?.trim() ||
    sanitizePersonalizationEvidenceSnippet(
      `Hi ${prospectName}, we put together a brief overview based on what we know about ${companyName}.`,
      480,
    )

  const whyReachingOut =
    personalization.bookingSignals[0] ||
    personalization.opportunitySignals[0] ||
    personalization.researchPainPoints[0] ||
    sanitizePersonalizationEvidenceSnippet(
      "We noticed signals that suggest now may be a good time to connect about equipment service operations.",
      280,
    )

  const companyObservations = [
    ...personalization.companySignals.slice(0, 3),
    ...personalization.websiteSignals.slice(0, 2),
    ...personalization.hiringSignals.slice(0, 2),
  ]
    .map((entry) => sanitizePersonalizationEvidenceSnippet(entry))
    .filter(Boolean)
    .slice(0, 6)

  const sourcesUsed = [
    ...personalization.sourcesUsed,
    ...(accountPlaybookSummary ? ["account_playbook"] : []),
  ]

  const resources: GrowthSharePageResource[] = []
  if (personalization.companySummary) {
    resources.push({
      id: "resource-company-summary",
      title: `${companyName} overview`,
      description: "Research-backed company summary",
      kind: "one_pager",
      url: "#",
      thumbnailUrl: null,
    })
  }

  const suggestedCta = buildSuggestedCta({
    nbaAction: nba.action,
    nbaLabel: GROWTH_NEXT_BEST_ACTION_LABELS[nba.action] ?? nba.label,
    bookingLink,
  })

  return {
    prospectName,
    companyName,
    headline,
    personalizedMessage,
    whyReachingOut,
    companyObservations,
    researchSummary: personalization.companySummary,
    accountPlaybookSummary,
    suggestedCta,
    nextBestMessage: sanitizePersonalizationEvidenceSnippet(nba.reason, 280),
    bookingLink,
    resources,
    sourcesUsed: [...new Set(sourcesUsed)],
    evidenceCoverageScore: computeEvidenceCoverageScore(sourcesUsed.length),
    researchConfidence: personalization.researchConfidence,
    generatedAt: new Date().toISOString(),
  }
}
