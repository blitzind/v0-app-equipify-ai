/** AI Meeting Prep generator (M1-C) — deterministic synthesis from prep bundle. Client-safe. */

import type {
  AiMeetingPrepGeneratedArtifacts,
  AiMeetingPrepGeneratorInput,
} from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"
import { AI_MEETING_PREP_QA_MARKER } from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"

const ROLE_DISCOVERY_QUESTIONS: Record<string, string[]> = {
  Executive: [
    "What strategic outcomes would make this investment a priority this quarter?",
    "Who else must sign off before a purchase decision?",
  ],
  Operations: [
    "Where does the current workflow break down for your team today?",
    "What would success look like after the first 90 days?",
  ],
  Technical: [
    "What integration or reliability concerns should we address upfront?",
    "Who owns implementation and ongoing administration?",
  ],
  Financial: [
    "How is budget allocated for this category this year?",
    "What ROI threshold would justify moving forward?",
  ],
  "End User": [
    "Which daily tasks are most painful for frontline users?",
    "What would make adoption easy for the team?",
  ],
  Unknown: [
    "Can you help us map who owns budget, implementation, and final approval?",
    "What problem are you personally trying to solve with this conversation?",
  ],
}

function stableHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

export function buildAiMeetingPrepInputHash(input: AiMeetingPrepGeneratorInput): string {
  const payload = JSON.stringify({
    qa_marker: AI_MEETING_PREP_QA_MARKER,
    meeting_id: input.meeting_id,
    readiness: input.prep_bundle.readiness.score,
    objectives: input.prep_bundle.recommendedObjectives.map((item) => item.objective),
    risks: input.prep_bundle.openRisks.map((item) => item.id),
    account_playbook_id: input.account_playbook_context?.accountPlaybookId ?? null,
    reply_intent: input.reply_intelligence?.intent ?? null,
  })
  return stableHash(payload)
}

export function generateAiMeetingPrep(input: AiMeetingPrepGeneratorInput): AiMeetingPrepGeneratedArtifacts {
  const bundle = input.prep_bundle
  const account = input.account_playbook_context ?? bundle.accountPlaybookContext
  const decisionMakers = input.decision_makers ?? bundle.decisionMakers
  const companyName = bundle.companySnapshot.companyName
  const readinessScore = input.meeting_readiness?.score ?? bundle.readiness.score
  const readinessLabel = input.meeting_readiness?.label ?? bundle.readiness.label
  const topObjective =
    account?.accountLevelObjective?.objective ??
    bundle.recommendedObjectives[0]?.objective ??
    "Validate fit and secure a clear next step."

  const stakeholderAnalysis =
    account?.stakeholderFocus.map((focus) => ({
      role_category: focus.roleCategory,
      contact_name: focus.members[0]?.fullName ?? null,
      title: focus.members[0]?.title ?? null,
      talking_points: [
        ...focus.focusAreas.map((area) => `Lead with ${area.toLowerCase()}.`),
        ...focus.messagingThemes.map((theme) => `Use messaging theme: ${theme}.`),
      ],
      messaging_themes: focus.messagingThemes,
    })) ??
    decisionMakers.slice(0, 4).map((dm) => ({
      role_category: dm.title?.includes("CEO") ? "Executive" : "Unknown",
      contact_name: dm.name,
      title: dm.title,
      talking_points: [
        `Confirm priorities with ${dm.name}.`,
        dm.isPrimary ? "Validate authority and next-step ownership." : "Map influence on the buying committee.",
      ],
      messaging_themes: [],
    }))

  const likelyObjections = bundle.openRisks.slice(0, 5).map((risk) => ({
    objection: risk.label,
    response_angle:
      risk.priority === "Critical" || risk.priority === "High"
        ? "Acknowledge directly, anchor on evidence, and propose a concrete validation step."
        : "Clarify scope and confirm whether this is a blocker or a discovery gap.",
    evidence: risk.reason,
  }))

  if (input.conversation_intelligence?.competitor_mentions?.length) {
    for (const competitor of input.conversation_intelligence.competitor_mentions.slice(0, 2)) {
      likelyObjections.push({
        objection: `Incumbent or competitor: ${competitor}`,
        response_angle: "Position differentiation without disparaging; ask what is working and what is not.",
        evidence: "Conversation intelligence competitor mention",
      })
    }
  }

  const discoveryQuestions = new Set<string>()
  for (const focus of account?.stakeholderFocus ?? []) {
    for (const question of ROLE_DISCOVERY_QUESTIONS[focus.roleCategory] ?? ROLE_DISCOVERY_QUESTIONS.Unknown) {
      discoveryQuestions.add(question)
    }
  }
  if (discoveryQuestions.size === 0) {
    discoveryQuestions.add("What prompted you to take this meeting now?")
    discoveryQuestions.add("What would need to be true for you to move forward after this conversation?")
  }
  if (input.reply_intelligence?.intent === "pricing_question") {
    discoveryQuestions.add("Which budget cycle or approval path should we align with?")
  }

  const competitiveRisks: string[] = []
  if ((input.conversation_intelligence?.competitor_pressure ?? 0) >= 30) {
    competitiveRisks.push(
      `Competitor pressure detected (${input.conversation_intelligence?.competitor_pressure}%) — expect comparison questions.`,
    )
  }
  for (const risk of bundle.openRisks.filter((item) => item.id === "competitor_risk")) {
    competitiveRisks.push(risk.reason)
  }
  if (account?.coverageStatus === "Weak") {
    competitiveRisks.push("Single-thread risk — competitor may already own another stakeholder.")
  }

  const suggestedAgenda: AiMeetingPrepGeneratedArtifacts["suggested_agenda"] = [
    {
      segment: "Opening & context",
      duration_minutes: 5,
      objective: `Align on why ${companyName} is evaluating options now.`,
    },
    {
      segment: "Discovery",
      duration_minutes: 15,
      objective: topObjective,
    },
  ]

  if (stakeholderAnalysis.length > 1) {
    suggestedAgenda.push({
      segment: "Stakeholder alignment",
      duration_minutes: 10,
      objective: "Map decision process, implementation owner, and approval path.",
    })
  }

  suggestedAgenda.push({
    segment: "Solution fit & next step",
    duration_minutes: 10,
    objective: account?.accountLevelObjective?.objective ?? "Confirm fit and propose a concrete next step.",
  })

  const executiveBrief = [
    `${companyName} meeting prep (${readinessLabel}, ${readinessScore}% ready).`,
    account?.committeeStrategy
      ? `Account strategy: ${account.committeeStrategy}`
      : bundle.researchSummary.summary
        ? `Research: ${bundle.researchSummary.summary}`
        : null,
    input.reply_intelligence?.intent
      ? `Latest reply signal: ${input.reply_intelligence.intent.replace(/_/g, " ")}.`
      : null,
    input.opportunity_readiness?.tier
      ? `Opportunity readiness: ${input.opportunity_readiness.tier}.`
      : null,
    "Human review required — no autonomous outreach, booking, or opportunity creation.",
  ]
    .filter(Boolean)
    .join(" ")

  const recommendedOutcome =
    input.reply_intelligence?.intent === "meeting_request" ||
    input.reply_intelligence?.intent === "demo_request"
      ? "Leave with a confirmed demo follow-up owner and proposed time window."
      : account?.coverageStatus === "Weak"
        ? "Identify at least one additional stakeholder and schedule a follow-up discovery call."
        : readinessScore >= 70
          ? "Advance to a qualified next step with explicit owner, timeline, and success criteria."
          : "Strengthen qualification and confirm whether there is a real opportunity to pursue."

  const confidenceBase = readinessScore / 100
  const accountBoost = account?.confidenceScore ?? 0
  const replyBoost =
    input.reply_intelligence?.intent === "meeting_request" ||
    input.reply_intelligence?.intent === "demo_request"
      ? 0.08
      : 0.03
  const confidenceScore = Math.min(
    1,
    Math.round((confidenceBase * 0.7 + accountBoost * 0.2 + replyBoost) * 100) / 100,
  )

  const reasoning = [
    `Generated from deterministic meeting prep bundle (${AI_MEETING_PREP_QA_MARKER}).`,
    `Readiness ${readinessScore}/100; ${bundle.openRisks.length} risk(s); ${bundle.recommendedObjectives.length} objective(s).`,
    account
      ? `Account playbook ${account.playbookKey ?? "linked"} with ${account.committeeCoverageScore}/100 committee coverage.`
      : "No account playbook context linked.",
  ].join(" ")

  return {
    executive_brief: executiveBrief,
    meeting_objective: topObjective,
    suggested_agenda: suggestedAgenda,
    stakeholder_analysis: stakeholderAnalysis,
    likely_objections: likelyObjections,
    discovery_questions: [...discoveryQuestions].slice(0, 8),
    competitive_risks: competitiveRisks.slice(0, 5),
    recommended_outcome: recommendedOutcome,
    confidence_score: confidenceScore,
    reasoning,
  }
}
