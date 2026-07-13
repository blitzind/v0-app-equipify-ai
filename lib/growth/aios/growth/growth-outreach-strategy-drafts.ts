/**
 * GE-AIOS-OUTREACH-QUALITY-1A — Channel drafts derived from Sales Strategy Brief (client-safe).
 * One brief → one consistent story across email, LinkedIn, SMS, call, video, follow-ups.
 */

import type { GrowthAutonomousOutreachPreparedAssetSummary } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  assertOutreachCopyQuality,
  countWords,
  type GrowthOutreachSalesStrategyBrief,
} from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"

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

function evidencePhrase(brief: GrowthOutreachSalesStrategyBrief): string | null {
  const detail = brief.evidence[0]?.detail?.trim()
  if (!detail) return null
  if (detail.length > 110) return `${detail.slice(0, 107).trim()}…`
  return detail
}

function problemPhrase(brief: GrowthOutreachSalesStrategyBrief): string | null {
  return brief.businessProblems[0]?.replace(/\.$/, "") ?? null
}

export function generateOutreachDraftsFromSalesStrategyBrief(input: {
  brief: GrowthOutreachSalesStrategyBrief
  senderName?: string | null
}): GrowthOutreachStrategyDerivedDrafts {
  const brief = input.brief
  const company = brief.companyName
  const dmFirst = firstName(brief.decisionMakerAnalysis.name)
  const greeting = dmFirst ? `Hi ${dmFirst},` : "Hi,"
  const problem = problemPhrase(brief)
  const evidence = evidencePhrase(brief)
  const cta = brief.recommendedCta
  const sender = input.senderName?.trim() || "Ava"
  const justification = brief.conversationJustification || brief.primaryHook
  const discovery =
    brief.sellerTruth?.discoveryQuestions?.slice(0, 3) ??
    [
      `How do you currently handle ${problem?.toLowerCase() ?? "day-to-day service coordination"}?`,
      "Where does work still fall through the cracks?",
      "What would a cleaner week look like for your team?",
    ]

  const subject = problem
    ? `${company} — ${problem.split(" ").slice(0, 6).join(" ")}`
    : `${company} service operations`

  const preview = (brief.primaryHook || justification).slice(0, 90)

  const opening = evidence
    ? `${greeting}\n\nWhile reviewing ${company}, ${evidence.charAt(0).toLowerCase()}${evidence.slice(1)} stood out.`
    : `${greeting}\n\nI've been looking at how ${company} runs service work.`

  const middle = [
    justification,
    brief.businessValue,
    `If useful, the next step is a ${cta.toLowerCase()} — specifically about ${brief.recommendedConversation.charAt(0).toLowerCase()}${brief.recommendedConversation.slice(1)}`,
  ]
    .filter(Boolean)
    .join(" ")

  const ctaLine = `Open to a ${cta.toLowerCase()} this week or next?`
  const signature = `— ${sender}`

  let emailBody = `${opening}\n\n${middle}\n\n${ctaLine}\n\n${signature}`
  const words = emailBody.split(/\s+/).filter(Boolean)
  if (words.length > 148) {
    emailBody = `${words.slice(0, 145).join(" ")}\n\n${ctaLine}\n\n${signature}`
  }

  const emailFull = `Subject: ${subject}\nPreview: ${preview}\n\n${emailBody}`

  const linkedIn = [
    dmFirst ? `Hi ${dmFirst} —` : "Hi —",
    evidence
      ? `your ${company} footprint around ${evidence.toLowerCase()} caught my attention.`
      : `${company}'s service footprint caught my attention.`,
    problem
      ? `Curious how you're handling ${problem.toLowerCase()} these days?`
      : `Curious what service operations looks like for you this quarter?`,
  ].join(" ")

  let sms = dmFirst
    ? `Hi ${dmFirst}, it's ${sender}. Quick question on ${company}'s service ops${problem ? ` — ${problem.toLowerCase()}` : ""}. Open to a short ${cta.toLowerCase()}?`
    : `Hi, it's ${sender}. Quick question on ${company} service ops. Open to a short ${cta.toLowerCase()}?`
  if (sms.length > 300) sms = `${sms.slice(0, 297).trim()}…`

  const callGuide = [
    `Opening: "${greeting.replace(",", "")}, thanks for taking a minute — I was looking at ${company}${evidence ? ` and ${evidence.toLowerCase()}` : ""}."`,
    `Conversation objective: ${brief.conversationObjective}`,
    `Conversation justification: ${justification}`,
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
    `Desired outcome: Agreement on whether a ${cta.toLowerCase()} is worth scheduling.`,
    `Follow-up: Send a short note summarizing what you heard; do not push a product tour.`,
  ]
    .filter(Boolean)
    .join("\n")

  const videoMissing = brief.missingPersonalizationOpportunities.some((row) =>
    /email|phone|decision maker|contact/i.test(row),
  )
  const personalizedVideo = videoMissing
    ? "Video draft requires additional personalization before recording."
    : [
        `Opening: "${greeting.replace(",", "")} — I put together a short note on ${company}."`,
        `Talking points:`,
        `• Justification: ${justification}`,
        `• Hook: ${brief.primaryHook}`,
        problem ? `• Problem focus: ${problem}` : null,
        `• Value: ${brief.businessValue}`,
        `• Ask: a ${cta.toLowerCase()}`,
        `Closing: "If this is useful, grab a time — if not, no chase."`,
      ]
        .filter(Boolean)
        .join("\n")

  const followUpSequence = [
    `Day 3 — New angle: ${brief.trustBuilders[0] ?? brief.businessValue}`,
    `Hi${dmFirst ? ` ${dmFirst}` : ""} — following my note on ${company}. One thing I keep hearing from similar teams: ${problem?.toLowerCase() ?? "service handoffs create quiet delay"}. Worth a ${cta.toLowerCase()}?`,
    ``,
    `Day 7 — Proof / clarity:`,
    `Sharing a sharper question rather than a pitch: ${brief.recommendedConversation} If there's a better owner for that, point me there.`,
    ``,
    `Day 14 — Soft bump:`,
    `Still curious whether ${company} is actively tightening service workflows this quarter. Happy to keep this to ${cta.toLowerCase()} and leave a clean no if timing is wrong.`,
    ``,
    `Day 21 — Close the loop:`,
    `I'll close the loop on my side unless you want the conversation. Either way, appreciate your time.`,
  ].join("\n")

  const qualityFailures = [
    ...assertOutreachCopyQuality(emailFull),
    ...assertOutreachCopyQuality(linkedIn),
    ...assertOutreachCopyQuality(sms),
    ...assertOutreachCopyQuality(callGuide),
    ...assertOutreachCopyQuality(personalizedVideo),
    ...assertOutreachCopyQuality(followUpSequence),
  ]

  // Also block seller wordsToAvoid / neverSay when present.
  const banned = [
    ...(brief.sellerTruth?.wordsToAvoid ?? []),
    ...(brief.sellerTruth?.neverSay ?? []),
  ]
  for (const phrase of banned) {
    const pattern = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    for (const text of [emailFull, linkedIn, sms, callGuide, personalizedVideo, followUpSequence]) {
      if (pattern.test(text)) qualityFailures.push(`seller_never_say:${phrase}`)
    }
  }

  return {
    email: {
      subject,
      preview,
      opening,
      body: emailBody,
      cta: ctaLine,
      signature,
      full: emailFull,
      wordCount: countWords(emailBody),
    },
    linkedIn,
    sms,
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
