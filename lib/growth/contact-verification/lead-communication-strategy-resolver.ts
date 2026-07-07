/**
 * GE-AIOS-SDR-1A — Lead-side communication strategy resolver.
 * Builds canonical IRE bundle from GrowthLead contact + engagement signals.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { CommunicationStrategyTouchHistory } from "@/lib/growth/contact-verification/communication-strategy-types"
import {
  resolveNativeRevenueDecisionAuthoritativeBundle,
  type NativeRevenueDecisionAuthoritativeBundle,
} from "@/lib/growth/contact-verification/native-revenue-decision-adapter"
import { isNativeRevenueDecisionEngineEnabled } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import { buildProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import { loadIreHistoricalLearning } from "@/lib/growth/revenue-workflow/load-ire-historical-learning"
import type { GrowthLead } from "@/lib/growth/types"

export type LeadCommunicationStrategyBundle = {
  enabled: boolean
  bundle: NativeRevenueDecisionAuthoritativeBundle | null
}

function buildLeadContactIntelligence(lead: GrowthLead): GrowthProspectSearchContactIntelligence | null {
  const name = lead.contactName?.trim()
  const email = lead.contactEmail?.trim()
  const phone = lead.contactPhone?.trim()
  if (!name && !email && !phone) return null

  return buildProspectSearchContactIntelligence({
    company_id: lead.id,
    contacts: [
      {
        id: lead.primaryDecisionMakerId ?? lead.id,
        full_name: name ?? "Primary contact",
        title: null,
        confidence: lead.engagementScore ?? 70,
        source_evidence: [{ claim: "Lead record", evidence: "growth_lead", source: "lead" }],
        role_type: "decision_maker",
        recommended_priority: 1,
        email: email ?? null,
        phone: phone ?? null,
        verification_status: email ? "verified" : "pending",
        outreach_ready: Boolean(email || phone),
      },
    ],
    committee_completeness: lead.decisionMakerStatus === "present" ? 67 : 33,
    schema_ready: true,
    source_labels: ["lead"],
  })
}

export function buildLeadCommunicationStrategyTouchHistory(
  lead: GrowthLead,
): CommunicationStrategyTouchHistory {
  const metadata = lead.metadata ?? {}
  const emailSentCount =
    typeof metadata.outboundEmailCount === "number" ? metadata.outboundEmailCount : undefined
  const emailReplyCount =
    typeof metadata.inboundReplyCount === "number" ? metadata.inboundReplyCount : undefined
  const smsSentCount = typeof metadata.smsSentCount === "number" ? metadata.smsSentCount : undefined
  const smsReplyCount = typeof metadata.smsReplyCount === "number" ? metadata.smsReplyCount : undefined
  const voiceDropSent = metadata.voiceDropSent === true
  const linkedinTaskCreated = metadata.linkedinTaskCreated === true
  const positiveReply = metadata.positiveReply === true || lead.contactTemperature === "hot"
  const negativeReply =
    metadata.negativeReply === true ||
    lead.callDisposition === "not_interested" ||
    lead.callDisposition === "wrong_number"
  const callAttempted = lead.callAttemptCount > 0
  const callConnected = lead.connectedCallCount > 0
  const callNoAnswer =
    callAttempted && !callConnected && lead.callDisposition !== "connected"

  return {
    emailSentCount,
    emailReplyCount,
    lastEmailNoReply:
      (emailSentCount ?? 0) > 0 && (emailReplyCount ?? 0) === 0 ? true : undefined,
    daysSinceLastEmail:
      typeof metadata.daysSinceLastEmail === "number" ? metadata.daysSinceLastEmail : undefined,
    callAttempted: callAttempted || undefined,
    callConnected: callConnected || undefined,
    callNoAnswer: callNoAnswer || undefined,
    voiceDropSent: voiceDropSent || lead.voicemailCount > 0 || undefined,
    hoursSinceVoiceDrop:
      typeof metadata.hoursSinceVoiceDrop === "number" ? metadata.hoursSinceVoiceDrop : undefined,
    smsSentCount,
    smsReplyCount,
    linkedinTaskCreated,
    positiveReply: positiveReply || undefined,
    negativeReply: negativeReply || undefined,
    engagementScore: lead.engagementScore ?? undefined,
    sequenceActive: lead.workflowHealth === "active" ? true : undefined,
  }
}

export async function resolveLeadCommunicationStrategyBundle(
  lead: GrowthLead,
  options?: { organizationId?: string | null; admin?: SupabaseClient },
): Promise<LeadCommunicationStrategyBundle> {
  if (!isNativeRevenueDecisionEngineEnabled()) {
    return { enabled: false, bundle: null }
  }

  const intelligence = buildLeadContactIntelligence(lead)
  if (!intelligence?.has_contacts) {
    return { enabled: true, bundle: null }
  }

  const organizationId = options?.organizationId ?? null
  const historicalLearning =
    options?.admin && organizationId
      ? await loadIreHistoricalLearning({
          admin: options.admin,
          organizationId,
          leadId: lead.id,
          email: lead.contactEmail,
        })
      : []

  const bundle = await resolveNativeRevenueDecisionAuthoritativeBundle({
    buildInput: {
      companyId: lead.id,
      organizationId,
      companyName: lead.companyName,
      website: lead.website,
      intelligence,
      touchHistory: buildLeadCommunicationStrategyTouchHistory(lead),
      historicalLearning,
    },
  })

  return { enabled: true, bundle }
}
