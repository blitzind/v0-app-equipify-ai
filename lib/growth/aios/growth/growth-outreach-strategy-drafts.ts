/**
 * GE-AIOS-OUTREACH-QUALITY-1A / CONVERSATION-INTELLIGENCE-1B — Channel drafts from Sales Strategy Brief.
 * One brief → one consistent story. Customer-facing copy = elite human SDR voice.
 */

import type { GrowthAutonomousOutreachPreparedAssetSummary } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  assertOutreachCopyQuality,
  countWords,
  type GrowthOutreachSalesStrategyBrief,
} from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import {
  reviewConsultantDiscoveryQuality,
} from "@/lib/growth/aios/growth/growth-outreach-consultant-discovery-intelligence"
import {
  reviewRevenueStrategyQuality,
} from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import {
  buildCuriousQuestion,
  buildEliteHumanProspectDrafts,
  extractEliteHumanDraftContext,
  humanizeObservation,
  reviewEliteHumanCommunication,
  reviewHumanAuthenticity,
} from "@/lib/growth/aios/growth/growth-outreach-elite-human-communication"
import { reviewOutreachDraftCopy } from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import {
  finalizeProductionCustomerFacingCopy,
  normalizeProductionPunctuation,
  reviewOperatorExecutionGuideConstitution,
  reviewProductionHumanCommunicationConstitution,
} from "@/lib/growth/aios/growth/growth-send-plane-1a-constitution"
import { applyCanonicalIdentityToCopy } from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b"
import { seedGeneratedAssetVersionMetadata } from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"

export type GrowthOutreachStrategyDerivedDrafts = {
  email: {
    subject: string
    preview: string
    opening: string
    body: string
    cta: string
    full: string
    wordCount: number
  }
  linkedIn: string
  sms: string
  callGuide: string
  voicemail: string
  meetingRequest: string
  personalizedVideo: string
  followUpSequence: string
  qualityFailures: string[]
}

function firstName(name: string | null): string | null {
  if (!name?.trim()) return null
  return name.trim().split(/\s+/)[0] ?? null
}

function buildRelationshipAwareFollowUpSequence(input: {
  company: string
  dmFirst: string | null
  observation: string
  question: string
  safeRecall: Array<{ naturalPhrase: string; topic: string }>
  relationshipGoal: string | null
}): string {
  const greeting = input.dmFirst ? `Hi ${input.dmFirst}` : "Hi"
  const recallLine = input.safeRecall[1]?.naturalPhrase ?? input.safeRecall[0]?.naturalPhrase ?? null
  const goalLine = input.relationshipGoal ? `Goal: ${input.relationshipGoal}` : null

  return [
    `Day 3: Continue the thread:`,
    recallLine
      ? `${greeting}. ${recallLine}. Still the right focus?`
      : `${greeting}. Different angle on ${input.company}: ${input.observation} Still relevant?`,
    ``,
    `Day 7: One question only:`,
    input.question,
    ``,
    `Day 14: New angle:`,
    recallLine
      ? `${greeting}. One more thought on ${input.safeRecall[0]?.topic ?? input.company}. Worth a reply?`
      : `Still curious about ${input.company}'s service ops, or bad timing?`,
    ``,
    `Day 21: Respectful close:`,
    goalLine
      ? `Unless ${input.relationshipGoal?.toLowerCase()} is still on your radar, I'll step back for now.`
      : `Unless you want the conversation, I'll step back for now.`,
  ].join("\n")
}

export function generateOutreachDraftsFromSalesStrategyBrief(input: {
  brief: GrowthOutreachSalesStrategyBrief
  senderName?: string | null
}): GrowthOutreachStrategyDerivedDrafts {
  const brief = input.brief
  const company = brief.companyName
  const canonicalIdentity = brief.canonicalDisplayIdentity ?? null
  const dmFirst = firstName(brief.decisionMakerAnalysis.name)
  const ctx = extractEliteHumanDraftContext(input)
  const human = buildEliteHumanProspectDrafts(ctx)

  const observation = humanizeObservation({
    insight: ctx.insight,
    equipment: ctx.equipment,
    companyName: company,
    industry: ctx.industry,
    selectedObservation: ctx.selectedObservation,
    seed: brief.leadId,
  })
  const question = buildCuriousQuestion({
    outcome: ctx.outcome,
    equipment: ctx.equipment,
    curiousPosture: ctx.curiousPosture,
    seed: brief.leadId,
    selectedObservation: ctx.selectedObservation,
    recommendedFirstQuestion: ctx.recommendedFirstQuestion,
  })

  const greeting = ctx.greeting
  const emailBody = human.emailBody
  const opening = emailBody.split("\n\n")[0] ?? greeting
  const ctaLine = emailBody.includes("?") && !/happy to compare/i.test(emailBody) ? "" : "Happy to compare notes if useful. No pitch."
  const transportBody = finalizeProductionCustomerFacingCopy(emailBody, canonicalIdentity)
  const transportSubject = finalizeProductionCustomerFacingCopy(human.subject, canonicalIdentity)
  const transportPreview = finalizeProductionCustomerFacingCopy(human.preview, canonicalIdentity)
  const emailFull = `Subject: ${transportSubject}\nPreview: ${transportPreview}\n\n${transportBody}`

  const discoveryFromConsultant =
    brief.consultantDiscoveryIntelligence?.rankedDiscoveryQuestions
      .slice(0, 3)
      .map((row) => row.question) ?? []
  const discovery =
    discoveryFromConsultant.length >= 2
      ? discoveryFromConsultant
      : brief.sellerTruth?.discoveryQuestions?.slice(0, 3) ??
        [
          question.replace(/\?$/, "") + "?",
          "Where does work still fall through the cracks?",
          "What would a cleaner week look like for your team?",
        ]

  const callGuide = normalizeProductionPunctuation(
    applyCanonicalIdentityToCopy(
      [
        `Opening: "${greeting.replace(",", "")}. ${observation}"`,
        `Earn curiosity: "${question}"`,
        `Conversation objective: ${brief.conversationObjective}`,
        `Operator note (internal): ${brief.conversationJustification ?? brief.primaryHook}`,
        `Relationship stage: ${brief.relationshipStage ?? "Cold"}`,
        `Discovery questions:`,
        ...discovery.map((q, index) => `${index + 1}. ${q}`),
        `Likely objections:`,
        ...brief.objections.map((row) => `• ${row.objection} → ${row.response}`),
        `Do not discuss:`,
        ...(brief.conversationStrategy?.doNotDiscuss
          .filter((row) => !/^Never say:|^Avoid wording:/i.test(row))
          .slice(0, 4)
          .map((row) => `• ${row}`) ?? [
          "• Do not pitch a product tour before confirming the workflow problem.",
        ]),
        brief.sellerTruth?.neverSay?.length || brief.sellerTruth?.wordsToAvoid?.length
          ? "• Follow approved profile never-say / words-to-avoid list (see Seller Truth)."
          : null,
        `Desired outcome: One thoughtful reply or a redirect to the right owner.`,
        `Follow-up: Summarize what you heard. Don't chase.`,
      ]
        .filter(Boolean)
        .join("\n"),
      canonicalIdentity,
    ),
  )

  const videoMissing = brief.missingPersonalizationOpportunities.some((row) =>
    /email|phone|decision maker|contact/i.test(row),
  )
  const personalizedVideo = videoMissing
    ? "Video draft requires additional personalization before recording."
    : normalizeProductionPunctuation(
        applyCanonicalIdentityToCopy(
          [
            `Opening: "${greeting.replace(",", "")}. Short note on ${company}."`,
            `Talking points (operator):`,
            `• Observation: ${observation}`,
            `• Question: ${question}`,
            ctx.outcome ? `• Outcome focus: ${ctx.outcome}` : null,
            `• Do not lead with product. Earn the conversation first.`,
            `Closing: "If useful, grab a time. If not, no chase."`,
          ]
            .filter(Boolean)
            .join("\n"),
          canonicalIdentity,
        ),
      )

  const voicemail = finalizeProductionCustomerFacingCopy(
    [
      greeting.replace(",", ""),
      observation.split(/[.!?]/)[0]?.trim() ? `${observation.split(/[.!?]/)[0]?.trim()}.` : observation,
      question,
    ]
      .filter(Boolean)
      .join(" "),
    canonicalIdentity,
  )

  const meetingRequest = finalizeProductionCustomerFacingCopy(
    [
      greeting,
      brief.recommendedCta || question,
    ].join(" "),
    canonicalIdentity,
  )

  const followUpSequence = finalizeProductionCustomerFacingCopy(
    buildRelationshipAwareFollowUpSequence({
      company,
      dmFirst,
      observation,
      question,
      safeRecall: brief.relationshipAssessment?.safeRecall ?? [],
      relationshipGoal: brief.relationshipAssessment?.relationshipGoal.label ?? null,
    }),
    canonicalIdentity,
  )

  const finalizedLinkedIn = finalizeProductionCustomerFacingCopy(human.linkedIn, canonicalIdentity)
  const finalizedSms = finalizeProductionCustomerFacingCopy(human.sms, canonicalIdentity)

  const prospectFacing = [
    emailFull,
    finalizedLinkedIn,
    finalizedSms,
    voicemail,
    meetingRequest,
    followUpSequence,
  ]
  const qualityFailures = [
    ...assertOutreachCopyQuality(emailFull),
    ...assertOutreachCopyQuality(finalizedLinkedIn),
    ...assertOutreachCopyQuality(finalizedSms),
    ...assertOutreachCopyQuality(callGuide),
    ...assertOutreachCopyQuality(personalizedVideo),
    ...assertOutreachCopyQuality(followUpSequence),
    ...assertOutreachCopyQuality(voicemail),
    ...assertOutreachCopyQuality(meetingRequest),
    ...reviewOutreachDraftCopy(emailFull),
    ...reviewOutreachDraftCopy(finalizedLinkedIn),
    ...reviewOutreachDraftCopy(finalizedSms),
    ...reviewHumanAuthenticity(emailFull, company),
    ...reviewHumanAuthenticity(finalizedLinkedIn, company),
    ...reviewHumanAuthenticity(finalizedSms, company),
    ...reviewProductionHumanCommunicationConstitution(transportBody, company, canonicalIdentity),
    ...reviewProductionHumanCommunicationConstitution(transportSubject, company, canonicalIdentity),
    ...reviewProductionHumanCommunicationConstitution(finalizedLinkedIn, company, canonicalIdentity),
    ...reviewProductionHumanCommunicationConstitution(finalizedSms, company, canonicalIdentity),
    ...reviewProductionHumanCommunicationConstitution(voicemail, company, canonicalIdentity),
    ...reviewProductionHumanCommunicationConstitution(meetingRequest, company, canonicalIdentity),
    ...reviewOperatorExecutionGuideConstitution(callGuide, canonicalIdentity),
    ...reviewOperatorExecutionGuideConstitution(personalizedVideo, canonicalIdentity),
    ...(brief.consultantDiscoveryIntelligence
      ? reviewConsultantDiscoveryQuality({
          discovery: brief.consultantDiscoveryIntelligence,
          prospectFacingQuestion: question,
        })
      : ["consultant_discovery:not_applied"]),
    ...reviewRevenueStrategyQuality(brief.revenueStrategyIntelligence ?? null),
  ]

  const banned = [
    ...(brief.sellerTruth?.wordsToAvoid ?? []),
    ...(brief.sellerTruth?.neverSay ?? []),
  ]
  for (const phrase of banned) {
    const pattern = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    for (const text of prospectFacing) {
      if (pattern.test(text)) qualityFailures.push(`seller_never_say:${phrase}`)
    }
  }

  return {
    email: {
      subject: transportSubject,
      preview: human.preview,
      opening,
      body: transportBody,
      cta: ctaLine,
      full: emailFull,
      wordCount: countWords(transportBody),
    },
    linkedIn: finalizedLinkedIn,
    sms: finalizedSms,
    callGuide,
    voicemail,
    meetingRequest,
    personalizedVideo,
    followUpSequence,
    qualityFailures,
  }
}

export function summarizeStrategyDerivedAssetsForPackage(
  drafts: GrowthOutreachStrategyDerivedDrafts,
): GrowthAutonomousOutreachPreparedAssetSummary[] {
  return [
    seedGeneratedAssetVersionMetadata({
      channel: "email",
      label: "Email",
      preview: drafts.email.full.slice(0, 1600),
      draftOnly: true,
    }),
    seedGeneratedAssetVersionMetadata({
      channel: "linkedin",
      label: "LinkedIn",
      preview: drafts.linkedIn.slice(0, 800),
      draftOnly: true,
    }),
    seedGeneratedAssetVersionMetadata({
      channel: "call",
      label: "Call guide",
      preview: drafts.callGuide.slice(0, 1600),
      draftOnly: true,
    }),
    seedGeneratedAssetVersionMetadata({
      channel: "sms",
      label: "SMS",
      preview: drafts.sms.slice(0, 400),
      draftOnly: true,
    }),
    seedGeneratedAssetVersionMetadata({
      channel: "sendr",
      label: "Personalized Video",
      preview: drafts.personalizedVideo.slice(0, 800),
      draftOnly: true,
    }),
    seedGeneratedAssetVersionMetadata({
      channel: "follow_up",
      label: "Follow-up sequence",
      preview: drafts.followUpSequence.slice(0, 1600),
      draftOnly: true,
    }),
    seedGeneratedAssetVersionMetadata({
      channel: "voicemail",
      label: "Voicemail",
      preview: drafts.voicemail.slice(0, 800),
      draftOnly: true,
    }),
    seedGeneratedAssetVersionMetadata({
      channel: "meeting_request",
      label: "Meeting request",
      preview: drafts.meetingRequest.slice(0, 800),
      draftOnly: true,
    }),
  ]
}
