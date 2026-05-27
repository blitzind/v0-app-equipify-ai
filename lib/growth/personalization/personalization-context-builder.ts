import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveApprovedTemplateContent } from "@/lib/growth/content/dashboard"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchLeadMemoryProfileView } from "@/lib/growth/lead-memory/dashboard"
import {
  maskPersonalizationLeadLabel,
  sanitizePersonalizationEvidenceSnippet,
  type GrowthPersonalizationContext,
  type GrowthPersonalizationSource,
} from "@/lib/growth/personalization/personalization-types"
import { listGrowthLeadTimelineEvents } from "@/lib/growth/timeline-repository"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function buildPersonalizationContext(
  admin: SupabaseClient,
  input: {
    leadId: string
    contentTemplateVersionId?: string | null
    snippetIds?: string[]
  },
): Promise<GrowthPersonalizationContext> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("lead_not_found")

  const leadLabel = maskPersonalizationLeadLabel(input.leadId, lead.companyName)
  const sourcesUsed: GrowthPersonalizationSource[] = []

  const [memoryView, oppSignals, bookingSignals, engagement, timeline, threads] = await Promise.all([
    fetchLeadMemoryProfileView(admin, input.leadId).catch(() => null),
    admin
      .schema("growth")
      .from("opportunity_signals")
      .select("signal_type, evidence_snippet")
      .eq("lead_id", input.leadId)
      .order("detected_at", { ascending: false })
      .limit(8),
    admin
      .schema("growth")
      .from("booking_intent_signals")
      .select("intent_type, evidence_snippet")
      .eq("lead_id", input.leadId)
      .order("detected_at", { ascending: false })
      .limit(8),
    admin.schema("growth").from("engagement_scores").select("tier, replies, meetings").eq("lead_id", input.leadId).maybeSingle(),
    listGrowthLeadTimelineEvents(admin, { leadId: input.leadId, limit: 8 }),
    admin
      .schema("growth")
      .from("inbox_threads")
      .select("subject, classification")
      .eq("lead_id", input.leadId)
      .order("updated_at", { ascending: false })
      .limit(5),
  ])

  if (memoryView?.profile) sourcesUsed.push("relationship_memory")

  const topObjections =
    memoryView?.objections.slice(0, 3).map((entry) => sanitizePersonalizationEvidenceSnippet(entry.evidenceSnippet)) ?? []
  const topPreferences =
    memoryView?.preferences.slice(0, 3).map((entry) => sanitizePersonalizationEvidenceSnippet(entry.evidenceSnippet)) ?? []
  const committeeContext =
    memoryView?.committeeMembers.slice(0, 3).map((entry) => sanitizePersonalizationEvidenceSnippet(entry.evidenceSnippet)) ?? []

  const opportunitySignals = ((oppSignals.data ?? []) as Array<Record<string, unknown>>)
    .map((row) => sanitizePersonalizationEvidenceSnippet(asString(row.evidence_snippet) || asString(row.signal_type)))
    .filter(Boolean)
  if (opportunitySignals.length) sourcesUsed.push("opportunity_intelligence")

  const bookingSignalRows = ((bookingSignals.data ?? []) as Array<Record<string, unknown>>)
    .map((row) => sanitizePersonalizationEvidenceSnippet(asString(row.evidence_snippet) || asString(row.intent_type)))
    .filter(Boolean)
  if (bookingSignalRows.length) sourcesUsed.push("booking_intelligence")

  const engagementTier = asString((engagement.data as { tier?: string } | null)?.tier) || lead.engagementTier || null
  if (engagementTier) sourcesUsed.push("engagement_history")

  const inboxHistory = ((threads.data ?? []) as Array<Record<string, unknown>>)
    .map((row) => sanitizePersonalizationEvidenceSnippet(`${row.subject ?? ""} ${row.classification ?? ""}`))
    .filter(Boolean)

  const sequenceHistory = timeline
    .filter((event) => /sequence|outbound|reply/i.test(`${event.title} ${event.summary}`))
    .map((event) => sanitizePersonalizationEvidenceSnippet(`${event.title}: ${event.summary}`))

  const companySignals = [
    lead.estimatedEmployeeCount,
    lead.estimatedAnnualRevenue,
    lead.fleetSizeEstimate,
    lead.crmDetected,
    lead.fieldServiceStackDetected,
  ]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => sanitizePersonalizationEvidenceSnippet(entry))
  if (companySignals.length) sourcesUsed.push("company_signals")

  const buyingSignals = [
    ...(memoryView?.events.filter((event) => event.memoryCategory === "buying_signal").map((event) => event.evidenceSnippet) ?? []),
    ...opportunitySignals.filter((entry) => /budget|pricing|timeline|meeting/i.test(entry)),
  ].map((entry) => sanitizePersonalizationEvidenceSnippet(entry))
  if (buyingSignals.length) sourcesUsed.push("buying_signals")

  const territoryLabel = [lead.city, lead.state, lead.country].filter(Boolean).join(", ") || null
  if (territoryLabel) sourcesUsed.push("territory_intelligence")

  const websiteSignals = lead.websiteUrl
    ? [sanitizePersonalizationEvidenceSnippet(`Website on file for ${lead.companyName}.`)]
    : []
  if (websiteSignals.length) sourcesUsed.push("website_intelligence")

  let templateOverlay: string | null = null
  if (input.contentTemplateVersionId) {
    const resolved = await resolveApprovedTemplateContent(admin, {
      templateVersionId: input.contentTemplateVersionId,
      templateType: "sequence_email",
      mergeValues: {
        "lead.contact_name": lead.contactName ?? "[contact]",
        "lead.company_name": lead.companyName ?? "[company]",
        "lead.industry": lead.industry ?? "[industry]",
      },
    })
    if (resolved?.body) templateOverlay = resolved.body.slice(0, 1200)
  }

  if (committeeContext.length) sourcesUsed.push("committee_context")

  return {
    leadLabel,
    companyName: lead.companyName ?? leadLabel,
    industryLabel: lead.industry ?? null,
    relationshipStage: memoryView?.profile?.relationshipStage ?? lead.relationshipStrengthTier ?? null,
    relationshipSummary: memoryView?.profile?.summary ?? lead.relationshipSummary ?? null,
    topObjections,
    topPreferences,
    opportunitySignals,
    bookingSignals: bookingSignalRows,
    engagementTier,
    territoryLabel,
    websiteSignals,
    committeeContext,
    buyingSignals,
    companySignals,
    inboxHistory,
    sequenceHistory,
    templateOverlay,
    sourcesUsed: [...new Set(sourcesUsed)],
  }
}
