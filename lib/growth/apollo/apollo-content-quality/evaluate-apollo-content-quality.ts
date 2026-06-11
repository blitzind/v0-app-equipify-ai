/** Unified Apollo content quality scoring (Phase 11E). */

import type { ApolloUnifiedPersonalizationContext } from "@/lib/growth/apollo/apollo-unified-personalization-context"
import type { ApolloCallIntelligence } from "@/lib/growth/apollo/apollo-call-intelligence"
import { countWords } from "@/lib/growth/outreach/personalization/message-variability"
import type {
  OutreachContextPacket,
  SelectedMessageStrategy,
} from "@/lib/growth/outreach/personalization/personalization-types"
import type { SmsQualityScore } from "@/lib/growth/sms/personalization/sms-personalization-types"

import { evaluateApolloCtaQuality } from "@/lib/growth/apollo/apollo-content-quality/evaluate-apollo-cta-quality"
import { evaluateApolloResearchUtilization } from "@/lib/growth/apollo/apollo-content-quality/evaluate-apollo-research-utilization"
import { evaluateApolloSubjectQuality } from "@/lib/growth/apollo/apollo-content-quality/evaluate-apollo-subject-quality"
import type {
  ApolloContentChannel,
  ApolloContentQualityResult,
} from "@/lib/growth/apollo/apollo-content-quality/apollo-content-quality-types"

function toTenPoint(score: number): number {
  return Math.round((score / 10) * 10) / 10
}

function readabilityScore(body: string): number {
  const words = countWords(body)
  if (words === 0) return 0
  if (words >= 35 && words <= 120) return 90
  if (words < 25) return 65
  if (words > 150) return 55
  return 75
}

function uniquenessScore(body: string, companyName: string): number {
  const lower = body.toLowerCase()
  const companyHits = (lower.match(new RegExp(companyName.toLowerCase(), "g")) ?? []).length
  if (companyHits > 3) return 45
  if (/quick note|touching base|checking in/i.test(body)) return 30
  return 85
}

export function evaluateApolloEmailContentQuality(input: {
  subject: string
  body: string
  packet: OutreachContextPacket
  strategy?: SelectedMessageStrategy
  unifiedContext?: ApolloUnifiedPersonalizationContext | null
  explicitCta?: string | null
}): ApolloContentQualityResult {
  const issues: string[] = []
  const subjectQ = evaluateApolloSubjectQuality({
    subject: input.subject,
    companyName: input.packet.companyName,
    evidence: input.packet.researchPainPoints[0] ?? null,
    priorSubjects: input.packet.priorOutboundSubjects,
    category: input.strategy?.subjectIntelligence?.category,
  })
  const ctaQ = evaluateApolloCtaQuality({
    body: input.body,
    explicitCta: input.explicitCta,
    evidence: input.packet.researchPainPoints[0] ?? null,
    companyName: input.packet.companyName,
  })
  const research = evaluateApolloResearchUtilization({
    packet: input.packet,
    unifiedContext: input.unifiedContext,
    subject: input.subject,
    body: input.body,
    strategy: input.strategy,
  })

  if (subjectQ.is_generic) issues.push("generic_subject")
  if (ctaQ.is_weak) issues.push("weak_cta")
  if (research.evidence_present && research.research_utilization_score < 80) {
    issues.push("low_research_utilization")
  }

  const personalization = Math.round(
    (subjectQ.personalization + uniquenessScore(input.body, input.packet.companyName)) / 2,
  )

  const breakdown = {
    personalization,
    research_utilization: research.research_utilization_score,
    cta_quality: ctaQ.score,
    readability: readabilityScore(input.body),
    uniqueness: uniquenessScore(input.body, input.packet.companyName),
  }

  const quality_score = toTenPoint(
    breakdown.personalization * 0.25 +
      breakdown.research_utilization * 0.25 +
      breakdown.cta_quality * 0.25 +
      breakdown.readability * 0.125 +
      breakdown.uniqueness * 0.125,
  )

  return { channel: "email", quality_score, quality_breakdown: breakdown, issues }
}

export function evaluateApolloSmsContentQuality(input: {
  body: string
  packet: OutreachContextPacket
  smsQuality?: SmsQualityScore
}): ApolloContentQualityResult {
  const ctaQ = evaluateApolloCtaQuality({
    body: input.body,
    companyName: input.packet.companyName,
    evidence: input.packet.researchPainPoints[0] ?? null,
  })
  const sms = input.smsQuality

  const breakdown = {
    personalization: sms?.specificity ?? 60,
    clarity: sms?.conversationalTone ?? 70,
    cta: ctaQ.score,
    brevity: sms?.charFit ?? (input.body.length <= 160 ? 90 : 70),
  }

  const issues: string[] = []
  if (ctaQ.is_weak) issues.push("weak_cta")

  const quality_score = toTenPoint(
    breakdown.personalization * 0.3 +
      breakdown.clarity * 0.25 +
      breakdown.cta * 0.25 +
      breakdown.brevity * 0.2,
  )

  return { channel: "sms", quality_score, quality_breakdown: breakdown, issues }
}

export function evaluateApolloVoiceDropContentQuality(input: {
  script: string
  packet: OutreachContextPacket
  unifiedContext?: ApolloUnifiedPersonalizationContext | null
}): ApolloContentQualityResult {
  const research = evaluateApolloResearchUtilization({
    packet: input.packet,
    unifiedContext: input.unifiedContext,
    body: input.script,
  })

  const conversational =
    input.script.includes("?") || /\b(hi|hey|this is)\b/i.test(input.script) ? 85 : 65
  const personalization =
    input.packet.decisionMakerName &&
    input.script.toLowerCase().includes(input.packet.decisionMakerName!.toLowerCase().split(/\s+/)[0]!)
      ? 90
      : 60

  const breakdown = {
    personalization,
    evidence_usage: research.research_utilization_score,
    conversational_quality: conversational,
  }

  const issues: string[] = []
  if (research.evidence_present && research.research_utilization_score < 70) {
    issues.push("low_evidence_usage")
  }

  const quality_score = toTenPoint(
    breakdown.personalization * 0.35 +
      breakdown.evidence_usage * 0.35 +
      breakdown.conversational_quality * 0.3,
  )

  return { channel: "voice_drop", quality_score, quality_breakdown: breakdown, issues }
}

export function evaluateApolloCallPlanContentQuality(input: {
  callIntelligence: ApolloCallIntelligence
  packet: OutreachContextPacket
}): ApolloContentQualityResult {
  const intel = input.callIntelligence
  const evidenceCount = intel.evidence_sources.length
  const evidenceQuality = Math.min(100, evidenceCount * 22 + (intel.likely_pain_points.length > 0 ? 20 : 0))
  const objectionHandling = intel.objection_handling.length >= 2 ? 88 : 55
  const meetingProgression = /\b(review|walkthrough|schedule|call|next step)\b/i.test(intel.cta) ? 85 : 50

  const breakdown = {
    evidence_quality: evidenceQuality,
    objection_handling: objectionHandling,
    meeting_progression: meetingProgression,
  }

  const issues: string[] = []
  if (evidenceCount < 2) issues.push("thin_evidence")
  if (meetingProgression < 70) issues.push("weak_meeting_cta")

  const quality_score = toTenPoint(
    breakdown.evidence_quality * 0.4 +
      breakdown.objection_handling * 0.3 +
      breakdown.meeting_progression * 0.3,
  )

  return { channel: "call_plan", quality_score, quality_breakdown: breakdown, issues }
}

export function evaluateApolloContentQuality(input: {
  channel: ApolloContentChannel
  body: string
  subject?: string
  packet: OutreachContextPacket
  strategy?: SelectedMessageStrategy
  unifiedContext?: ApolloUnifiedPersonalizationContext | null
  explicitCta?: string | null
  smsQuality?: SmsQualityScore
  callIntelligence?: ApolloCallIntelligence
}): ApolloContentQualityResult {
  switch (input.channel) {
    case "email":
      return evaluateApolloEmailContentQuality({
        subject: input.subject ?? "",
        body: input.body,
        packet: input.packet,
        strategy: input.strategy,
        unifiedContext: input.unifiedContext,
        explicitCta: input.explicitCta,
      })
    case "sms":
      return evaluateApolloSmsContentQuality({
        body: input.body,
        packet: input.packet,
        smsQuality: input.smsQuality,
      })
    case "voice_drop":
      return evaluateApolloVoiceDropContentQuality({
        script: input.body,
        packet: input.packet,
        unifiedContext: input.unifiedContext,
      })
    case "call_plan":
      if (!input.callIntelligence) {
        return {
          channel: "call_plan",
          quality_score: 0,
          quality_breakdown: {},
          issues: ["missing_call_intelligence"],
        }
      }
      return evaluateApolloCallPlanContentQuality({
        callIntelligence: input.callIntelligence,
        packet: input.packet,
      })
    default:
      return {
        channel: input.channel,
        quality_score: 0,
        quality_breakdown: {},
        issues: ["unknown_channel"],
      }
  }
}
