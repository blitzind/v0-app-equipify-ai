/** Apollo content quality benchmark harness (Phase 11F). */

import { buildApolloCallIntelligence } from "@/lib/growth/apollo/apollo-call-intelligence"
import { generateApolloVoiceDropScriptFromUnifiedContext } from "@/lib/growth/apollo/apollo-voice-drop-script-generation"
import { buildApolloVoiceDropIntelligenceFromUnifiedContext } from "@/lib/growth/apollo/apollo-voice-drop-intelligence-engine"
import { buildPersonalizedOutreachDraft } from "@/lib/growth/outreach/personalization/assemble-draft"
import { extractPersonalizationSignals } from "@/lib/growth/outreach/personalization/signal-extraction"
import {
  measureDuplicateRate,
  normalizeContentFingerprint,
} from "@/lib/growth/outreach/personalization/email-variation-engine"
import { buildPersonalizedSmsDraft } from "@/lib/growth/sms/personalization/assemble-sms-draft"
import { scoreSmsPersonalizationQuality } from "@/lib/growth/sms/personalization/sms-quality-scoring"

import {
  buildApolloContentFixtureBatch,
  type ApolloContentFixture,
} from "@/lib/growth/apollo/apollo-content-quality/apollo-content-fixtures"
import {
  APOLLO_CONTENT_QUALITY_QA_MARKER,
  type ApolloContentBenchmarkReport,
  type ApolloContentBenchmarkSample,
} from "@/lib/growth/apollo/apollo-content-quality/apollo-content-quality-types"
import { evaluateApolloCtaQuality } from "@/lib/growth/apollo/apollo-content-quality/evaluate-apollo-cta-quality"
import { evaluateApolloContentQuality } from "@/lib/growth/apollo/apollo-content-quality/evaluate-apollo-content-quality"
import { evaluateApolloResearchUtilization } from "@/lib/growth/apollo/apollo-content-quality/evaluate-apollo-research-utilization"
import { evaluateApolloSubjectQuality } from "@/lib/growth/apollo/apollo-content-quality/evaluate-apollo-subject-quality"

const EMAIL_COUNT = 100
const SMS_COUNT = 100
const VOICE_DROP_COUNT = 50
const CALL_PLAN_COUNT = 50

const DUPLICATE_OPENING_THRESHOLD_PCT = 10
const RESEARCH_UTILIZATION_THRESHOLD_PCT = 80
const WEAK_CTA_THRESHOLD_PCT = 15
const GENERIC_SUBJECT_THRESHOLD_PCT = 5

function extractOpeningFingerprint(body: string): string {
  const firstSentence = body.trim().split(/(?<=[.!?])\s+/)[0] ?? body
  return normalizeContentFingerprint(firstSentence, 10)
}

function extractCtaFingerprint(body: string): string {
  const sentences = body.trim().split(/(?<=[.!?])\s+/)
  const last = sentences[sentences.length - 1] ?? body
  return normalizeContentFingerprint(last, 8)
}

function subjectFingerprint(subject: string): string {
  return subject.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function runApolloContentBenchmarkHarness(input?: {
  fixtures?: ApolloContentFixture[]
}): ApolloContentBenchmarkReport {
  const fixtures = input?.fixtures ?? buildApolloContentFixtureBatch(EMAIL_COUNT)
  const samples: ApolloContentBenchmarkSample[] = []

  const openingFingerprints: string[] = []
  const subjectFingerprints: string[] = []
  const ctaFingerprints: string[] = []
  const researchScores: number[] = []
  const researchScoresWhenEvidence: number[] = []
  let weakCtaCount = 0
  let genericSubjectCount = 0

  const channelScoreSums = { email: 0, sms: 0, voice_drop: 0, call_plan: 0 }
  const channelCounts = { email: 0, sms: 0, voice_drop: 0, call_plan: 0 }

  for (let i = 0; i < EMAIL_COUNT; i += 1) {
    const fixture = fixtures[i % fixtures.length]
    const signals = extractPersonalizationSignals(fixture.packet)
    const { draft, strategy } = buildPersonalizedOutreachDraft({
      leadId: `${fixture.leadId}-email-${i}`,
      packet: fixture.packet,
      signals,
      generationType: fixture.generationType,
      maxWords: 120,
    })

    const explicitCta = strategy.ctaIntelligence?.legacyCta ?? undefined
    const quality = evaluateApolloContentQuality({
      channel: "email",
      subject: draft.subject,
      body: draft.body,
      packet: fixture.packet,
      strategy,
      unifiedContext: fixture.unifiedContext,
      explicitCta,
    })
    const research = evaluateApolloResearchUtilization({
      packet: fixture.packet,
      unifiedContext: fixture.unifiedContext,
      subject: draft.subject,
      body: draft.body,
      strategy,
    })
    const ctaQ = evaluateApolloCtaQuality({
      body: draft.body,
      explicitCta,
      companyName: fixture.packet.companyName,
    })
    const subjectQ = evaluateApolloSubjectQuality({
      subject: draft.subject,
      companyName: fixture.packet.companyName,
    })

    const openingFp = extractOpeningFingerprint(draft.body)
    const ctaFp = extractCtaFingerprint(draft.body)
    const subjFp = subjectFingerprint(draft.subject)

    openingFingerprints.push(openingFp)
    subjectFingerprints.push(subjFp)
    ctaFingerprints.push(ctaFp)
    researchScores.push(research.research_utilization_score)
    if (research.evidence_present) researchScoresWhenEvidence.push(research.research_utilization_score)
    if (ctaQ.is_weak) weakCtaCount += 1
    if (subjectQ.is_generic) genericSubjectCount += 1

    channelScoreSums.email += quality.quality_score
    channelCounts.email += 1

    samples.push({
      id: `email-${i}`,
      channel: "email",
      subject: draft.subject,
      body: draft.body,
      quality,
      opening_fingerprint: openingFp,
      cta_fingerprint: ctaFp,
      subject_fingerprint: subjFp,
      research,
    })
  }

  for (let i = 0; i < SMS_COUNT; i += 1) {
    const fixture = fixtures[i % fixtures.length]
    const { draft, audit } = buildPersonalizedSmsDraft({
      leadId: `${fixture.leadId}-sms-${i}`,
      context: {
        packet: fixture.packet,
        priorSmsPreviews: [],
        priorSmsCount: fixture.packet.priorTouchCount,
        shortForm: true,
      },
    })
    const smsQuality =
      audit.qualityScore ??
      scoreSmsPersonalizationQuality({
        draft,
        hookText: audit.openingHook.strategy,
        maxChars: 320,
        contextQuality: audit.contextQuality,
        memoryQuality: audit.memoryQuality,
      })
    const quality = evaluateApolloContentQuality({
      channel: "sms",
      body: draft.body,
      packet: fixture.packet,
      smsQuality,
    })
    channelScoreSums.sms += quality.quality_score
    channelCounts.sms += 1
    samples.push({ id: `sms-${i}`, channel: "sms", body: draft.body, quality })
  }

  for (let i = 0; i < VOICE_DROP_COUNT; i += 1) {
    const fixture = fixtures[i % fixtures.length]
    const voiceIntel = buildApolloVoiceDropIntelligenceFromUnifiedContext({
      unified_context: fixture.unifiedContext,
      fit_score: fixture.packet.fitScore,
    })
    const script = generateApolloVoiceDropScriptFromUnifiedContext({
      script_type: voiceIntel.recommended_script_type,
      unified_context: fixture.unifiedContext,
    })
    const quality = evaluateApolloContentQuality({
      channel: "voice_drop",
      body: script.full_script,
      packet: fixture.packet,
      unifiedContext: fixture.unifiedContext,
    })
    channelScoreSums.voice_drop += quality.quality_score
    channelCounts.voice_drop += 1
    samples.push({ id: `voice-${i}`, channel: "voice_drop", body: script.full_script, quality })
  }

  for (let i = 0; i < CALL_PLAN_COUNT; i += 1) {
    const fixture = fixtures[i % fixtures.length]
    const callIntel = buildApolloCallIntelligence(fixture.unifiedContext)
    const quality = evaluateApolloContentQuality({
      channel: "call_plan",
      body: callIntel.cta,
      packet: fixture.packet,
      callIntelligence: callIntel,
    })
    channelScoreSums.call_plan += quality.quality_score
    channelCounts.call_plan += 1
    samples.push({ id: `call-${i}`, channel: "call_plan", body: callIntel.opening_angle, quality })
  }

  const openingDup = measureDuplicateRate(openingFingerprints)
  const subjectDup = measureDuplicateRate(subjectFingerprints)
  const ctaDup = measureDuplicateRate(ctaFingerprints)

  const weakest_samples = [...samples]
    .sort((a, b) => a.quality.quality_score - b.quality.quality_score)
    .slice(0, 20)

  const threshold_notes: string[] = []
  const passes_opening = openingDup.duplicate_pct <= DUPLICATE_OPENING_THRESHOLD_PCT
  const passes_research =
    researchScoresWhenEvidence.length === 0 ||
    average(researchScoresWhenEvidence) >= RESEARCH_UTILIZATION_THRESHOLD_PCT
  const passes_weak_cta = (weakCtaCount / EMAIL_COUNT) * 100 <= WEAK_CTA_THRESHOLD_PCT
  const passes_generic_subject = (genericSubjectCount / EMAIL_COUNT) * 100 <= GENERIC_SUBJECT_THRESHOLD_PCT

  if (!passes_opening) {
    threshold_notes.push(
      `duplicate_openings ${openingDup.duplicate_pct}% exceeds ${DUPLICATE_OPENING_THRESHOLD_PCT}%`,
    )
  }
  if (!passes_research) {
    threshold_notes.push(
      `research_utilization ${Math.round(average(researchScoresWhenEvidence))}% below ${RESEARCH_UTILIZATION_THRESHOLD_PCT}%`,
    )
  }
  if (!passes_weak_cta) {
    threshold_notes.push(`weak_cta ${Math.round((weakCtaCount / EMAIL_COUNT) * 100)}% exceeds ${WEAK_CTA_THRESHOLD_PCT}%`)
  }
  if (!passes_generic_subject) {
    threshold_notes.push(
      `generic_subjects ${Math.round((genericSubjectCount / EMAIL_COUNT) * 100)}% exceeds ${GENERIC_SUBJECT_THRESHOLD_PCT}%`,
    )
  }

  return {
    qa_marker: APOLLO_CONTENT_QUALITY_QA_MARKER,
    generated_at: new Date().toISOString(),
    counts: {
      emails: EMAIL_COUNT,
      sms: SMS_COUNT,
      voice_drops: VOICE_DROP_COUNT,
      call_plans: CALL_PLAN_COUNT,
    },
    duplicate_opening_pct: openingDup.duplicate_pct,
    duplicate_subject_pct: subjectDup.duplicate_pct,
    duplicate_cta_pct: ctaDup.duplicate_pct,
    weak_cta_pct: Math.round((weakCtaCount / EMAIL_COUNT) * 100),
    generic_subject_pct: Math.round((genericSubjectCount / EMAIL_COUNT) * 100),
    research_utilization_avg: Math.round(average(researchScores)),
    research_utilization_when_evidence_pct: Math.round(average(researchScoresWhenEvidence)),
    channel_scores: {
      email: Math.round((channelScoreSums.email / channelCounts.email) * 10) / 10,
      sms: Math.round((channelScoreSums.sms / channelCounts.sms) * 10) / 10,
      voice_drop: Math.round((channelScoreSums.voice_drop / channelCounts.voice_drop) * 10) / 10,
      call_plan: Math.round((channelScoreSums.call_plan / channelCounts.call_plan) * 10) / 10,
    },
    weakest_samples,
    passes_thresholds: passes_opening && passes_research && passes_weak_cta && passes_generic_subject,
    threshold_notes,
  }
}
