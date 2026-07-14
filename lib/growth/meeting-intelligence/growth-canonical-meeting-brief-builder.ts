/**
 * GE-AIOS-MEETING-INTELLIGENCE-1A — Canonical meeting brief builder (client-safe).
 * Synthesizes existing subsystem outputs into one battle plan — never rediscovers them.
 */

import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import { enrichOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import type { GrowthOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import type { GrowthOutreachRelationshipAssessment } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"
import type { GrowthLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-types"
import type { GrowthMeetingPrepBundle } from "@/lib/growth/meeting-intelligence/meeting-prep-types"
import {
  GROWTH_AIOS_MEETING_INTELLIGENCE_1A_QA_MARKER,
  type GrowthCanonicalMeetingAgendaStep,
  type GrowthCanonicalMeetingBrief,
  type GrowthCanonicalMeetingCommitmentItem,
  type GrowthCanonicalMeetingObjectionPrep,
  type GrowthCanonicalMeetingOpportunityProgression,
  type GrowthCanonicalMeetingPostMeetingOutcomes,
  type GrowthCanonicalMeetingStakeholder,
} from "@/lib/growth/meeting-intelligence/growth-canonical-meeting-brief-types"
import type { GrowthCallWorkspacePostCallClosure } from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"

const ROLE_QUESTIONS: Record<string, string[]> = {
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
  "Service Director": [
    "How are depot-to-field handoffs coordinated today?",
    "What would a reliable workflow look like for your technicians?",
  ],
  Unknown: [
    "Can you help us map who owns budget, implementation, and final approval?",
    "What problem are you personally trying to solve with this conversation?",
  ],
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 12): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].slice(0, limit)
}

function inferRoleCategory(title: string | null): string {
  const text = (title ?? "").toLowerCase()
  if (/ceo|president|owner|chief|executive/.test(text)) return "Executive"
  if (/director|vp|vice/.test(text)) return "Service Director"
  if (/operations|service manager|field/.test(text)) return "Operations"
  if (/finance|cfo|procurement/.test(text)) return "Financial"
  if (/engineer|technical|it/.test(text)) return "Technical"
  return "Unknown"
}

function buildStakeholders(input: {
  prepBundle: GrowthMeetingPrepBundle
  relationshipAssessment: GrowthOutreachRelationshipAssessment | null
}): GrowthCanonicalMeetingStakeholder[] {
  const account = input.prepBundle.accountPlaybookContext
  if (account?.stakeholderFocus?.length) {
    return account.stakeholderFocus.slice(0, 6).map((focus, index) => {
      const member = focus.members[0]
      const roleCategory = focus.roleCategory
      return {
        contactId: null,
        name: member?.fullName ?? roleCategory,
        role: member?.title ?? roleCategory,
        influence: index === 0 ? "high" : "medium",
        relationship: input.relationshipAssessment?.relationshipStory?.summary ?? null,
        likelyPriorities: focus.focusAreas,
        likelyConcerns: focus.messagingThemes,
        likelyObjections: [],
        questionsTheyShouldAnswer: ROLE_QUESTIONS[roleCategory] ?? ROLE_QUESTIONS.Unknown,
        discussionLead: index === 0,
      }
    })
  }

  return input.prepBundle.decisionMakers.slice(0, 6).map((dm, index) => {
    const roleCategory = inferRoleCategory(dm.title)
    return {
      contactId: dm.id,
      name: dm.name,
      role: dm.title,
      influence: dm.isPrimary ? "high" : dm.confidence != null && dm.confidence >= 70 ? "medium" : "unknown",
      relationship: dm.isPrimary ? "Primary contact" : null,
      likelyPriorities: dm.title ? [`Validate priorities for ${dm.title}.`] : ["Confirm operational priorities."],
      likelyConcerns: [],
      likelyObjections: [],
      questionsTheyShouldAnswer: ROLE_QUESTIONS[roleCategory] ?? ROLE_QUESTIONS.Unknown,
      discussionLead: dm.isPrimary || index === 0,
    }
  })
}

function buildDynamicAgenda(input: {
  prepBundle: GrowthMeetingPrepBundle
  businessObjective: string
  hasCommitments: boolean
  relationshipStage: string | null
  meetingType: string | null
}): GrowthCanonicalMeetingAgendaStep[] {
  const steps: GrowthCanonicalMeetingAgendaStep[] = [
    {
      step: "Opening",
      purpose: "Confirm why we are meeting and align on the outcome for today.",
      durationHint: "3 min",
    },
  ]

  if (input.hasCommitments) {
    steps.push({
      step: "Verify commitments",
      purpose: "Confirm promised follow-ups and close any open loops before new discovery.",
      durationHint: "5 min",
    })
  }

  if (input.relationshipStage && /early|new|cold/i.test(input.relationshipStage)) {
    steps.push({
      step: "Establish context",
      purpose: "Ground the conversation in their operational reality before proposing solutions.",
      durationHint: "5 min",
    })
  } else {
    steps.push({
      step: "Confirm priorities",
      purpose: "Validate what changed since the last conversation and what still matters most.",
      durationHint: "5 min",
    })
  }

  steps.push(
    {
      step: "Operational discovery",
      purpose: input.businessObjective,
      durationHint: "12 min",
    },
    {
      step: "Validate assumptions",
      purpose: "Test whether our understanding of their workflow and constraints is accurate.",
      durationHint: "8 min",
    },
  )

  if (/workflow|process|operations|depot|field/i.test(input.businessObjective)) {
    steps.push({
      step: "Discuss workflow",
      purpose: "Map the depot-to-field or service coordination pain in their own words.",
      durationHint: "10 min",
    })
  }

  steps.push(
    {
      step: "Address concerns",
      purpose: "Surface objections early and respond with evidence, not pressure.",
      durationHint: "8 min",
    },
    {
      step: "Agree next step",
      purpose: "Leave with a concrete commitment, owner, and timeline.",
      durationHint: "5 min",
    },
  )

  return steps
}

function buildObjectionPrep(input: {
  prepBundle: GrowthMeetingPrepBundle
  enrichedObjections: Array<{ objection: string; response: string }>
  competitiveNotes: string[]
  memoryObjections: string[]
}): GrowthCanonicalMeetingObjectionPrep[] {
  const rows: GrowthCanonicalMeetingObjectionPrep[] = []

  for (const risk of input.prepBundle.openRisks.slice(0, 4)) {
    rows.push({
      objection: risk.label,
      whyLikely: risk.reason,
      evidence: [risk.reason],
      suggestedResponse:
        risk.priority === "Critical" || risk.priority === "High"
          ? "Acknowledge directly, anchor on evidence, and propose a concrete validation step."
          : "Clarify scope and confirm whether this is a blocker or a discovery gap.",
      followUpQuestion: "What would need to be true for this concern to be resolved?",
      avoidSaying: ["Dismiss the concern", "Push for a decision before validation"],
    })
  }

  for (const row of input.enrichedObjections.slice(0, 4)) {
    rows.push({
      objection: row.objection,
      whyLikely: "Surfaced from conversation intelligence and prior engagement.",
      evidence: [],
      suggestedResponse: row.response,
      followUpQuestion: "Can you walk me through how that shows up day to day?",
      avoidSaying: ["Argue against their experience", "Over-promise without evidence"],
    })
  }

  for (const objection of input.memoryObjections.slice(0, 3)) {
    rows.push({
      objection,
      whyLikely: "Previously recorded in canonical human memory.",
      evidence: [objection],
      suggestedResponse: "Acknowledge what you heard before and ask what has changed since then.",
      followUpQuestion: "Is this still the main concern, or has the priority shifted?",
      avoidSaying: ["Pretend it was never raised"],
    })
  }

  const defaults = [
    {
      objection: "Already have software",
      whyLikely: input.competitiveNotes.length
        ? "Incumbent or field service stack detected."
        : "Common in equipment service accounts.",
      evidence: input.competitiveNotes,
      suggestedResponse:
        "Explore where the current stack breaks down rather than replacing it on day one.",
      followUpQuestion: "Where does the current system fail your technicians in the field?",
      avoidSaying: ["Trash the incumbent vendor", "Claim rip-and-replace is required"],
    },
    {
      objection: "Timing / too busy",
      whyLikely: "Operational teams are often in reactive mode.",
      evidence: input.prepBundle.signals.slice(0, 2),
      suggestedResponse: "Anchor on a small, low-lift validation step instead of a big project conversation.",
      followUpQuestion: "What would make the timing work for a focused follow-up?",
      avoidSaying: ["Pressure for an immediate decision"],
    },
  ]

  for (const row of defaults) {
    if (rows.length >= 8) break
    if (rows.some((existing) => existing.objection === row.objection)) continue
    rows.push(row)
  }

  return rows.slice(0, 8)
}

function buildCommitments(input: {
  memoryCommitments: string[]
  promisedFollowUps: string[]
  packagePurpose: string | null
}): GrowthCanonicalMeetingCommitmentItem[] {
  const rows: GrowthCanonicalMeetingCommitmentItem[] = []

  for (const commitment of input.memoryCommitments) {
    rows.push({
      commitment,
      source: "canonical_human_memory",
      status: "pending_verification",
      dueAt: null,
    })
  }

  for (const followUp of input.promisedFollowUps) {
    rows.push({
      commitment: followUp,
      source: "promised_follow_up",
      status: "open",
      dueAt: null,
    })
  }

  if (input.packagePurpose && /checklist|promised|workflow/i.test(input.packagePurpose)) {
    rows.push({
      commitment: input.packagePurpose,
      source: "growth_5f_package",
      status: "open",
      dueAt: null,
    })
  }

  return rows.slice(0, 10)
}

export function buildGrowthCanonicalMeetingOpportunityProgression(input: {
  prepBundle: GrowthMeetingPrepBundle
  canonicalDecision: GrowthCanonicalDecisionResolution | null
  missingEvidence: string[]
}): GrowthCanonicalMeetingOpportunityProgression {
  const stage =
    input.prepBundle.buyingStage.stage ??
    input.canonicalDecision?.decision.primaryAction ??
    "discovery"

  const mustHappenNext = uniqueStrings([
    input.canonicalDecision?.decision.title,
    input.prepBundle.recommendedObjectives[0]?.objective,
    input.prepBundle.researchSummary.recommendedNextAction,
    input.prepBundle.canonicalRecommendedNextAction,
    ...input.prepBundle.readiness.missing.map((row) => `Close gap: ${row}`),
  ], 6)

  const readiness = input.prepBundle.readiness.score
  const committee = input.prepBundle.accountPlaybookContext?.coverageStatus
  let advanceProbability = Math.min(95, Math.max(25, readiness))
  if (committee === "Weak") advanceProbability -= 12
  if (committee === "Strong") advanceProbability += 8
  if (input.canonicalDecision?.decision.primaryAction === "prepare_meeting") advanceProbability += 5

  return {
    currentStage: String(stage),
    mustHappenNext,
    advanceProbability: Math.round(advanceProbability),
    missingEvidence: input.missingEvidence,
    exitCriteria: uniqueStrings([
      "Clear next step with owner and date",
      "Primary stakeholder priorities validated",
      "Open commitments verified or closed",
      input.prepBundle.recommendedObjectives[0]?.objective,
    ], 5),
  }
}

export function mapPostCallClosureToMeetingOutcomes(
  closure: GrowthCallWorkspacePostCallClosure | null,
): GrowthCanonicalMeetingPostMeetingOutcomes | null {
  if (!closure) return null

  const objectiveAchieved =
    closure.recommendedNextAction?.advancesRelationshipGoal === true ||
    closure.buyingSignals.length > 0 ||
    closure.meetingIntelligenceUpdated === true

  return {
    meetingObjectiveAchieved: objectiveAchieved,
    commitmentsCompleted: closure.commitments.length === 0,
    relationshipImproved: closure.relationshipChange.length > 0,
    opportunityAdvanced: closure.buyingSignals.length > 0 || closure.followUpRequired,
    stakeholdersConfirmed: closure.committeeSignals.length > 0,
    proposalReady: /proposal|pricing|commercial/i.test(
      [closure.followUpReason, closure.meetingSummary].filter(Boolean).join(" "),
    ),
  }
}

export type BuildGrowthCanonicalMeetingBriefInput = {
  generatedAt: string
  prepBundle: GrowthMeetingPrepBundle
  salesStrategyBrief: GrowthOutreachSalesStrategyBrief | null
  leadMemory: GrowthLeadMemoryInfluenceContext | null
  relationshipAssessment: GrowthOutreachRelationshipAssessment | null
  canonicalDecision: GrowthCanonicalDecisionResolution | null
  postCallClosure?: GrowthCallWorkspacePostCallClosure | null
  agendaStepIndex?: number | null
}

export function buildGrowthCanonicalMeetingBrief(
  input: BuildGrowthCanonicalMeetingBriefInput,
): GrowthCanonicalMeetingBrief {
  const bundle = input.prepBundle
  const enriched = input.salesStrategyBrief
    ? enrichOutreachSalesStrategyBrief({
        brief: input.salesStrategyBrief,
        website: null,
        contactTitle: input.salesStrategyBrief.decisionMakerAnalysis.title,
        equipmentServiced: [],
        learningWeights: null,
        relationshipStrengthTier: null,
        opportunityReadinessScore: null,
        decisionMakers: [
          {
            name: input.salesStrategyBrief.decisionMakerAnalysis.name,
            title: input.salesStrategyBrief.decisionMakerAnalysis.title,
            isPrimary: true,
          },
        ],
        buyingCommitteeSnapshot: null,
        communicationChannelHint: "meeting",
        relationshipAssessment: input.relationshipAssessment,
        leadMemory: input.leadMemory,
        institutionalLearning: input.salesStrategyBrief.institutionalLearning ?? null,
      })
    : null

  const businessObjective =
    bundle.recommendedObjectives[0]?.objective ??
    bundle.accountPlaybookContext?.accountLevelObjective?.objective ??
    enriched?.revenueStrategyIntelligence?.primaryBusinessPressure ??
    bundle.researchSummary.pitchAngle ??
    "Validate the operational problem and secure agreement on the next step."

  const relationshipObjective =
    input.relationshipAssessment?.relationshipGoal?.label ??
    input.relationshipAssessment?.relationshipStory?.summary ??
    input.leadMemory?.relationshipSummary ??
    "Increase trust by proving we understand their workflow before proposing change."

  const meetingObjective =
    bundle.meeting.title?.trim() ||
    bundle.canonicalDecision?.decision.title ||
    businessObjective

  const stakeholders = buildStakeholders({
    prepBundle: bundle,
    relationshipAssessment: input.relationshipAssessment,
  })

  const memoryCommitments = input.leadMemory?.commitmentSummaries ?? []
  const promisedFollowUps = uniqueStrings([
    ...memoryCommitments,
    ...(enriched?.trustBuilders ?? []),
    bundle.canonicalRecommendedNextAction,
  ])

  const competitiveConsiderations = uniqueStrings([
    bundle.companySnapshot.industry ? `Industry: ${bundle.companySnapshot.industry}` : null,
    ...bundle.signals.filter((signal) => /servicemax|competitor|incumbent|stack|crm/i.test(signal)),
    ...(input.salesStrategyBrief?.businessProblems ?? []),
  ])

  const evidenceToReference = uniqueStrings([
    ...bundle.recommendedObjectives.flatMap((row) => row.evidence),
    ...bundle.researchSummary.painSignals,
    ...bundle.signals,
    enriched?.primaryHook,
    enriched?.consultantDiscoveryIntelligence?.consultantHypothesis,
    input.leadMemory?.relationshipSummary,
  ], 10)

  const questionsToAsk = uniqueStrings([
    ...(enriched?.consultantDiscoveryIntelligence?.rankedDiscoveryQuestions.map((row) => row.question) ?? []),
    ...stakeholders.flatMap((row) => row.questionsTheyShouldAnswer),
    enriched?.consultantDiscoveryIntelligence?.recommendedFirstQuestion,
  ], 10)

  const agenda = buildDynamicAgenda({
    prepBundle: bundle,
    businessObjective,
    hasCommitments: memoryCommitments.length > 0 || promisedFollowUps.length > 0,
    relationshipStage: input.relationshipAssessment?.relationshipGoal?.current ?? null,
    meetingType: bundle.meeting.title,
  })

  const agendaIndex = Math.min(
    Math.max(input.agendaStepIndex ?? 0, 0),
    Math.max(agenda.length - 1, 0),
  )
  const currentAgendaStep = agenda[agendaIndex] ?? agenda[0] ?? null

  const commitmentsToVerify = buildCommitments({
    memoryCommitments,
    promisedFollowUps,
    packagePurpose: bundle.canonicalDecision?.decision.title ?? null,
  })

  const missingEvidence = uniqueStrings(bundle.readiness.missing, 6)
  const opportunityProgression = buildGrowthCanonicalMeetingOpportunityProgression({
    prepBundle: bundle,
    canonicalDecision: input.canonicalDecision,
    missingEvidence,
  })

  const likelyObjections = buildObjectionPrep({
    prepBundle: bundle,
    enrichedObjections: enriched?.objections ?? [],
    competitiveNotes: competitiveConsiderations,
    memoryObjections: input.leadMemory?.topObjections ?? [],
  })

  const liveSupport = {
    currentAgendaStep: currentAgendaStep?.step ?? null,
    currentObjective: currentAgendaStep?.purpose ?? meetingObjective,
    pursuitOutcome: businessObjective,
    questionToAskNext: questionsToAsk[agendaIndex] ?? questionsToAsk[0] ?? null,
    evidenceToReference: evidenceToReference.slice(0, 4),
    risksToAvoid: bundle.openRisks.slice(0, 3).map((row) => row.reason),
    commitmentToObtain: commitmentsToVerify.find((row) => row.status !== "completed")?.commitment ?? null,
    offTrackRecovery:
      "Pause, summarize what you heard, and return to the open commitment or operational pain you came to validate.",
    successProbability: opportunityProgression.advanceProbability,
  }

  const postMeetingOutcomes = mapPostCallClosureToMeetingOutcomes(input.postCallClosure ?? null)

  const confidence = Math.round(
    Math.min(
      95,
      Math.max(
        35,
        bundle.readiness.score * 0.55 +
          (input.canonicalDecision ? 15 : 0) +
          (stakeholders.length > 0 ? 10 : 0) +
          (evidenceToReference.length > 2 ? 10 : 0),
      ),
    ),
  )

  return {
    qaMarker: GROWTH_AIOS_MEETING_INTELLIGENCE_1A_QA_MARKER,
    generatedAt: input.generatedAt,
    meetingId: bundle.meeting.id,
    leadId: bundle.meeting.leadId,
    companyName: bundle.companySnapshot.companyName,
    meetingObjective,
    desiredBusinessOutcome: businessObjective,
    desiredRelationshipOutcome: relationshipObjective,
    goals: {
      primaryObjective: businessObjective,
      secondaryObjective: bundle.recommendedObjectives[1]?.objective ?? null,
      relationshipObjective,
      businessObjective,
      successCriteria: uniqueStrings([
        "Primary stakeholder priorities validated",
        "Open commitments verified or closed",
        bundle.recommendedObjectives[0]?.objective,
        "Concrete next step with owner and date",
      ], 5),
      failureConditions: uniqueStrings([
        "Leave without confirming decision process",
        "Ignore an open promised follow-up",
        "Push pricing before operational pain is validated",
      ], 4),
    },
    attendeePriorities: uniqueStrings(stakeholders.flatMap((row) => row.likelyPriorities), 8),
    stakeholders,
    missingStakeholders: bundle.accountPlaybookContext?.committeeCoverageRisks
      .map((row) => row.reason)
      .slice(0, 4) ?? [],
    committeeGaps: uniqueStrings([
      bundle.accountPlaybookContext?.committeeStrategy,
      ...(bundle.accountPlaybookContext?.committeeCoverageRisks.map((row) => row.label) ?? []),
    ], 4),
    agenda,
    recommendedDiscoveryPath: uniqueStrings([
      enriched?.consultantDiscoveryIntelligence?.conversationAngle,
      enriched?.revenueStrategyIntelligence?.conversationApproach,
      "Start with operational pain, validate assumptions, then propose a low-lift next step.",
    ], 4),
    questionsToAsk,
    likelyObjections,
    evidenceToReference,
    commitmentsToVerify,
    promisedFollowUps,
    competitiveConsiderations,
    exitCriteria: opportunityProgression.exitCriteria,
    nextMeetingRecommendation:
      bundle.meeting.status === "scheduled"
        ? "Book the follow-up before ending — propose a workflow review or stakeholder expansion session."
        : null,
    opportunityProgression,
    liveSupport,
    operatorExperience: {
      todaysStrategy:
        input.canonicalDecision?.operatorCard.headline ??
        enriched?.operatorReasoning?.primaryInsight ??
        enriched?.operatorReasoning?.conversationGoal ??
        "Validate the operational problem, honor open commitments, and earn the next step.",
      whatAvaWantsToLearn: uniqueStrings([
        ...questionsToAsk.slice(0, 3),
        "Who owns budget and implementation?",
        "What would make timing work?",
      ], 5),
      whatAvaWantsToLeaveWith: uniqueStrings([
        businessObjective,
        "Agreement on the next step",
        commitmentsToVerify[0]?.commitment,
        opportunityProgression.exitCriteria[0],
      ], 5),
      risks: bundle.openRisks.slice(0, 5).map((row) => `${row.label}: ${row.reason}`),
    },
    postMeetingOutcomes,
    confidence,
  }
}

export function buildMeetingIntelligenceInputForDecisionEngine(input: {
  hasUpcomingMeeting: boolean
  buyingStage: string | null
  recommendedNextAction: string | null
  readinessScore: number
  readinessMissing: string[]
  committeeCoverage: string | null
  canonicalDecision: GrowthCanonicalDecisionResolution | null
  postCallClosure: GrowthCallWorkspacePostCallClosure | null
}): import("@/lib/growth/meeting-intelligence/growth-canonical-meeting-brief-types").GrowthCanonicalMeetingIntelligenceInput | null {
  if (!input.hasUpcomingMeeting && !input.postCallClosure) return null

  const opportunityProgression: GrowthCanonicalMeetingOpportunityProgression = {
    currentStage: input.buyingStage ?? input.canonicalDecision?.decision.primaryAction ?? "discovery",
    mustHappenNext: uniqueStrings([
      input.canonicalDecision?.decision.title,
      input.recommendedNextAction,
      ...input.readinessMissing.map((row) => `Close gap: ${row}`),
    ], 6),
    advanceProbability: Math.round(
      Math.min(
        95,
        Math.max(
          25,
          input.readinessScore +
            (input.canonicalDecision?.decision.primaryAction === "prepare_meeting" ? 5 : 0) +
            (input.committeeCoverage === "Strong" ? 8 : input.committeeCoverage === "Weak" ? -12 : 0),
        ),
      ),
    ),
    missingEvidence: uniqueStrings(input.readinessMissing, 6),
    exitCriteria: uniqueStrings([
      "Clear next step with owner and date",
      "Primary stakeholder priorities validated",
      "Open commitments verified or closed",
      input.recommendedNextAction,
    ], 5),
  }

  return {
    opportunityProgression,
    postMeetingOutcomes: mapPostCallClosureToMeetingOutcomes(input.postCallClosure),
  }
}

export function projectCanonicalMeetingBriefLiveContext(
  brief: GrowthCanonicalMeetingBrief,
  agendaStepIndex?: number | null,
): GrowthCanonicalMeetingBrief["liveSupport"] {
  const index = Math.min(
    Math.max(agendaStepIndex ?? 0, 0),
    Math.max(brief.agenda.length - 1, 0),
  )
  const step = brief.agenda[index] ?? brief.agenda[0] ?? null
  return {
    ...brief.liveSupport,
    currentAgendaStep: step?.step ?? brief.liveSupport.currentAgendaStep,
    currentObjective: step?.purpose ?? brief.liveSupport.currentObjective,
    questionToAskNext: brief.questionsToAsk[index] ?? brief.questionsToAsk[0] ?? null,
    successProbability: brief.opportunityProgression.advanceProbability,
  }
}
