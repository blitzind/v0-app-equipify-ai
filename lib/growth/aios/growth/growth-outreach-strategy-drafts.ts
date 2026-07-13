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

export type GrowthOutreachStrategyDerivedDrafts = {
  email: {
    subject: string
    preview: string
    opening: string
    body: string
    cta: string
    signature: string
    full: string
    wordCount: number
  }
  linkedIn: string
  sms: string
  callGuide: string
  personalizedVideo: string
  followUpSequence: string
  qualityFailures: string[]
}

function firstName(name: string | null): string | null {
  if (!name?.trim()) return null
  return name.trim().split(/\s+/)[0] ?? null
}

export function generateOutreachDraftsFromSalesStrategyBrief(input: {
  brief: GrowthOutreachSalesStrategyBrief
  senderName?: string | null
}): GrowthOutreachStrategyDerivedDrafts {
  const brief = input.brief
  const company = brief.companyName
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
  const sender = ctx.sender
  const signature = `— ${sender}`
  const emailBody = human.emailBody
  const opening = emailBody.split("\n\n")[0] ?? greeting
  const ctaLine = emailBody.includes("?") && !/happy to compare/i.test(emailBody) ? "" : "Happy to compare notes if useful — no pitch."
  const emailFull = `Subject: ${human.subject}\nPreview: ${human.preview}\n\n${emailBody}`

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

  const callGuide = [
    `Opening: "${greeting.replace(",", "")} — ${observation}"`,
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
    `Follow-up: Summarize what you heard — don't chase.`,
  ]
    .filter(Boolean)
    .join("\n")

  const videoMissing = brief.missingPersonalizationOpportunities.some((row) =>
    /email|phone|decision maker|contact/i.test(row),
  )
  const personalizedVideo = videoMissing
    ? "Video draft requires additional personalization before recording."
    : [
        `Opening: "${greeting.replace(",", "")} — short note on ${company}."`,
        `Talking points (operator):`,
        `• Observation: ${observation}`,
        `• Question: ${question}`,
        ctx.outcome ? `• Outcome focus: ${ctx.outcome}` : null,
        `• Do not lead with product — earn the conversation first.`,
        `Closing: "If useful, grab a time — if not, no chase."`,
      ]
        .filter(Boolean)
        .join("\n")

  const followUpSequence = [
    `Day 3 — New angle:`,
    `${dmFirst ? `Hi ${dmFirst}` : "Hi"} — different angle on ${company}: ${observation} Still relevant?`,
    ``,
    `Day 7 — One question only:`,
    question,
    ``,
    `Day 14 — Soft bump:`,
    `Still curious about ${company}'s service ops — or bad timing?`,
    ``,
    `Day 21 — Close the loop:`,
    `Closing my loop on this unless you want the conversation.`,
  ].join("\n")

  const prospectFacing = [emailFull, human.linkedIn, human.sms]
  const qualityFailures = [
    ...assertOutreachCopyQuality(emailFull),
    ...assertOutreachCopyQuality(human.linkedIn),
    ...assertOutreachCopyQuality(human.sms),
    ...assertOutreachCopyQuality(callGuide),
    ...assertOutreachCopyQuality(personalizedVideo),
    ...assertOutreachCopyQuality(followUpSequence),
    ...reviewOutreachDraftCopy(emailFull),
    ...reviewOutreachDraftCopy(human.linkedIn),
    ...reviewOutreachDraftCopy(human.sms),
    ...reviewHumanAuthenticity(emailFull, company),
    ...reviewHumanAuthenticity(human.linkedIn, company),
    ...reviewHumanAuthenticity(human.sms, company),
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
      subject: human.subject,
      preview: human.preview,
      opening,
      body: emailBody,
      cta: ctaLine,
      signature,
      full: emailFull,
      wordCount: countWords(emailBody),
    },
    linkedIn: human.linkedIn,
    sms: human.sms,
    callGuide,
    personalizedVideo,
    followUpSequence,
    qualityFailures,
  }
}

export function summarizeStrategyDerivedAssetsForPackage(
  drafts: GrowthOutreachStrategyDerivedDrafts,
): GrowthAutonomousOutreachPreparedAssetSummary[] {
  return [
    {
      channel: "email",
      label: "Email",
      preview: drafts.email.full.slice(0, 1600),
      draftOnly: true,
    },
    {
      channel: "linkedin",
      label: "LinkedIn",
      preview: drafts.linkedIn.slice(0, 800),
      draftOnly: true,
    },
    {
      channel: "call",
      label: "Call guide",
      preview: drafts.callGuide.slice(0, 1600),
      draftOnly: true,
    },
    {
      channel: "sms",
      label: "SMS",
      preview: drafts.sms.slice(0, 400),
      draftOnly: true,
    },
    {
      channel: "sendr",
      label: "Personalized Video",
      preview: drafts.personalizedVideo.slice(0, 800),
      draftOnly: true,
    },
    {
      channel: "follow_up",
      label: "Follow-up sequence",
      preview: drafts.followUpSequence.slice(0, 1600),
      draftOnly: true,
    },
  ]
}
