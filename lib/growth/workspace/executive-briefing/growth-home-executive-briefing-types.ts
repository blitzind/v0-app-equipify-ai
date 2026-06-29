/** GE-AI-UX-1C … GE-AI-8A / GE-AI-9A / GE-AI-9B / GE-AI-9C / GE-AI-ARCH-2C — AI OS v1 Home executive briefing (client-safe presentation types). */

export const GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER =
  "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1" as const

export const GROWTH_HOME_EXECUTIVE_BRIEFING_RULE =
  "Home executive briefing is presentation-only — deterministic synthesis from existing workspace dashboard read models. No LLMs, no new intelligence." as const

export type GrowthHomeHealthTone = "healthy" | "attention" | "critical"

export type GrowthHomeExecutiveBrief = {
  greeting: string
  introLine: string
  teammateName: string
  teammateRole: string
  completedOutcomes: string[]
  exceptionCount: number
  exceptionSummary: string
  handledRestSummary: string
  overallHealth: {
    tone: GrowthHomeHealthTone
    label: string
    summary: string
  }
  meetingsBookedSummary: string | null
  opportunitiesAdvancedSummary: string | null
  revenueImpactSummary: string | null
  estimatedBusinessImpact: string | null
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  /** @deprecated UX-1C fields — kept for synthesizer compat */
  progressSinceLastVisit: string[]
  biggestWin: { headline: string; detail: string } | null
  biggestRisk: { headline: string; detail: string } | null
  todaysPriority: string
  suggestedNextAction: { label: string; href: string }
}

export type GrowthHomeExceptionItem = GrowthHomeAttentionItem

/** @deprecated use GrowthHomeExceptionItem */
export type GrowthHomeAttentionItem = {
  id: string
  headline: string
  summary: string
  ctaLabel: string
  ctaHref: string
  impactScore: number
}

export type GrowthHomeRecommendation = {
  id: string
  headline: string
  whyItMatters: string
  expectedImpact: string
  estimatedRevenue: string | null
  timeRequired: string
  primaryCtaLabel: string
  primaryCtaHref: string
  dismissible: true
}

export type GrowthHomeActivityGroup = {
  id: string
  label: string
  summary: string
  count: number | null
  href: string | null
}

export type GrowthHomeTimelinePeriod = {
  id: string
  periodLabel: string
  items: string[]
}

export type GrowthHomeApprovalSummary = {
  totalPending: number
  groups: Array<{ id: string; label: string; count: number }>
  reviewHref: string
}

export type GrowthHomeBusinessMetric = {
  id: string
  label: string
  value: string
  href: string
}

export type GrowthHomeAiEmployeeStatus = {
  kind:
    | "working"
    | "researching"
    | "preparing_outreach"
    | "monitoring_replies"
    | "learning"
    | "waiting_for_approval"
    | "idle"
  label: string
  activityLabel: string
}

export type GrowthHomeCheckIn = {
  greeting: string
  /** GE-AI-UX-7A contextual continuity */
  hasContinuity: boolean
  continuityIntro: string | null
  continuityBullets: string[]
  /** GE-AI-UX-8A operator mission summary */
  operatorMissionSummary: string | null
  activeMissionCount: number
  /** GE-AI-UX-9A marketing operator voice */
  marketingOperatorSummary: string | null
  activeMarketingMissionCount: number
  marketingVoiceLines: string[]
  /** GE-AI-UX-9B customer success operator voice */
  customerSuccessOperatorSummary: string | null
  activeCustomerSuccessMissionCount: number
  customerSuccessVoiceLines: string[]
  /** GE-AI-UX-9C service operator voice */
  serviceOperatorSummary: string | null
  totalServiceMissionCount: number
  serviceVoiceLines: string[]
  /** GE-AI-UX-5A proactive opening */
  foundIntro: string
  foundObservations: string[]
  calmLine: string | null
  /** @deprecated UX-4A — mirrors foundIntro for compat */
  awayIntro: string
  /** @deprecated UX-4A — mirrors foundObservations for compat */
  completedWhileAway: string[]
  focusIntro: string
  focusingOn: string[]
  needsReviewLine: string
  teammateName: string
  teammateRole: string
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  status: GrowthHomeAiEmployeeStatus
}

export type GrowthHomeCompletedTodayItem = {
  id: string
  category: string
  label: string
  detail: string
}

export type GrowthHomeWorkingOnItem = {
  id: string
  label: string
  href: string | null
}

export type GrowthHomeNeedsReviewGroup = {
  id: string
  label: string
  count: number
}

export type GrowthHomeNeedsReview = {
  totalCount: number
  groups: GrowthHomeNeedsReviewGroup[]
  reviewHref: string
  attentionItems: GrowthHomeAttentionItem[]
}

export type GrowthHomeWorkSummaryCategory = {
  id: string
  label: string
  items: string[]
}

export type GrowthHomeNoticedItem = {
  id: string
  category: string
  observation: string
  evidence: string
  href: string | null
}

export type GrowthHomeWatchingItem = {
  id: string
  label: string
  href: string | null
}

export type GrowthHomeInitiativeRecommendation = {
  id: string
  category: string
  headline: string
  whyItMatters: string
  recommendedAction: string
  confidence: "high" | "medium" | "needs_more_evidence"
  confidenceLabel: string
  evidence: string[]
  priority: "handle_today" | "worth_reviewing" | "keep_an_eye_on" | "can_wait"
  priorityLabel: string
  primaryCtaLabel: string
  primaryCtaHref: string
}

export type GrowthHomeBusinessAwareness = {
  thisWeek: { label: string; value: string } | null
  thisMonth: { label: string; value: string } | null
  currentObjective: { label: string; detail: string; href: string | null } | null
  topWin: { headline: string; detail: string } | null
  biggestRisk: { headline: string; detail: string } | null
}

export type GrowthHomeMyPriority = {
  id: string
  title: string
  whyItMatters: string
  progressPercent: number
  progressLabel: string
  nextStep: string
  waitingOnMe: string[]
  waitingOnYou: string[]
  href: string | null
}

export type GrowthHomeAccomplishmentGroup = {
  id: string
  label: string
  items: string[]
}

export type GrowthHomeWeeklyGoal = {
  id: string
  label: string
  targetLabel: string
  currentValue: number
  targetValue: number
  progressPercent: number
}

export type GrowthHomeWaitingOnYouItem = {
  id: string
  label: string
  detail: string
  href: string
}

export type GrowthHomeFeaturedOutcome = {
  headline: string
  whyItMatters: string
  suggestedNextStep: string
  confidenceLabel: string
  evidence: string[]
  href: string | null
}

export type GrowthHomeAiWorkloadItem = {
  id: string
  label: string
  progressPercent: number
}

export type GrowthHomeExecutiveRecommendation = {
  headline: string
  sentence: string
  evidence: string[]
  expectedResults?: string[]
  href: string | null
  confidencePercent?: number | null
  confidenceLabel?: string | null
}

/** GE-AIOS-UX-1A — Executive AI operator home presentation (read-model only). */
export const GROWTH_HOME_AI_OS_UX_QA_MARKER = "growth-ge-aios-ux-1a-ai-os-home-experience-v1" as const

export type GrowthHomeExecutiveBriefingHeroMetric = {
  label: string
  value: string
  confidencePercent?: number | null
  confidenceLabel?: string | null
}

export type GrowthHomeExecutiveBriefingHero = {
  greeting: string
  introLine: string
  revenueToday: GrowthHomeExecutiveBriefingHeroMetric[]
  biggestOpportunity: string | null
  biggestRisk: string | null
  expectedOutcomeToday: string | null
  overallConfidencePercent: number | null
  overallConfidenceLabel: string | null
}

export type GrowthHomeAvaLiveStatusItem = {
  id: string
  verb: string
  label: string
  detail?: string | null
}

export type GrowthHomeAvaLiveStatus = {
  items: GrowthHomeAvaLiveStatusItem[]
  learningLabel: string | null
  runtimeNote: string | null
}

export type GrowthHomeDailyWorkQueueItem = {
  id: string
  priority: "critical" | "high" | "medium" | "low"
  companyName: string
  actionLabel: string
  channelLabel?: string | null
  reason?: string | null
  estimatedMinutes?: number | null
  requiresHumanApproval?: boolean
  href: string | null
  confidencePercent: number | null
  confidenceLabel: string | null
}

export type GrowthHomeDailyWorkQueueBuckets = {
  critical: number
  high: number
  medium: number
  waiting: number
  blocked: number
}

export type GrowthHomeThroughputMetric = {
  id: string
  label: string
  value: string
  href: string | null
}

export type GrowthHomeMailboxDomainHealth = {
  mailboxPool: {
    healthy: number
    warming: number
    paused: number
    warning: number
    expired: number
  }
  domainHealth: {
    spf: string | null
    dkim: string | null
    dmarc: string | null
    mx: string | null
    warmupPercent: number | null
    dailyUtilization: string | null
  }
  summary: string | null
  href: string | null
}

export type GrowthHomeAutonomousReadiness = {
  mode: string
  executionReadinessPercent: number | null
  executionReadinessLabel: string | null
  guardrails: string
  killSwitch: string
}

export type GrowthHomeAiOsUxViewModel = {
  qaMarker: typeof GROWTH_HOME_AI_OS_UX_QA_MARKER
  hero: GrowthHomeExecutiveBriefingHero
  waitingOnYou: GrowthHomeWaitingOnYouItem[]
  waitingOnYouOverflow: number
  approveItemsHref: string | null
  approveItemsCount: number
  liveStatus: GrowthHomeAvaLiveStatus | null
  dailyWorkQueueBuckets: GrowthHomeDailyWorkQueueBuckets | null
  dailyWorkQueue: GrowthHomeDailyWorkQueueItem[]
  throughput: GrowthHomeThroughputMetric[]
  mailboxDomainHealth: GrowthHomeMailboxDomainHealth | null
  autonomousReadiness: GrowthHomeAutonomousReadiness | null
}

export type GrowthHomeExecutiveBriefingViewModel = {
  readOnly: true
  qaMarker: typeof GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER
  generatedAt: string
  executiveBrief: GrowthHomeExecutiveBrief
  exceptions: GrowthHomeExceptionItem[]
  /** @deprecated alias */
  needsAttention: GrowthHomeExceptionItem[]
  recommendation: GrowthHomeRecommendation | null
  additionalRecommendations: GrowthHomeRecommendation[]
  aiActivity: GrowthHomeActivityGroup[]
  timeline: GrowthHomeTimelinePeriod[]
  approvalSummary: GrowthHomeApprovalSummary | null
  businessSnapshot: GrowthHomeBusinessMetric[]
  /** GE-AI-UX-4A — AI employee check-in and work sections */
  checkIn: GrowthHomeCheckIn
  employeeStatus: GrowthHomeAiEmployeeStatus
  /** @deprecated UX-6A — use accomplishments */
  completedToday: GrowthHomeCompletedTodayItem[]
  /** @deprecated UX-6A — use myPriorities */
  workingOnNow: GrowthHomeWorkingOnItem[]
  needsReview: GrowthHomeNeedsReview
  workSummary: GrowthHomeWorkSummaryCategory[]
  /** GE-AI-UX-5A — proactive initiative layer */
  thingsNoticed: GrowthHomeNoticedItem[]
  watching: GrowthHomeWatchingItem[]
  initiativeRecommendations: GrowthHomeInitiativeRecommendation[]
  businessAwareness: GrowthHomeBusinessAwareness
  /** GE-AI-UX-6A — ownership & accountability layer */
  myPriorities: GrowthHomeMyPriority[]
  accomplishments: GrowthHomeAccomplishmentGroup[]
  weeklyGoals: GrowthHomeWeeklyGoal[]
  waitingOnYou: GrowthHomeWaitingOnYouItem[]
  biggestWin: GrowthHomeFeaturedOutcome | null
  biggestRiskFeatured: GrowthHomeFeaturedOutcome | null
  aiWorkload: GrowthHomeAiWorkloadItem[]
  executiveRecommendation: GrowthHomeExecutiveRecommendation | null
  waitingOnYouOverflow: number
  /** GE-AI-UX-7A — relationship & continuity layer */
  sinceWeLastMet: GrowthHomeSinceWeLastMetItem[]
  whatChanged: GrowthHomeWhatChangedItem[]
  recommendationContinuity: GrowthHomeRecommendationContinuity[]
  ourProgress: GrowthHomeProgressPeriod[]
  milestones: GrowthHomeMilestone[]
  trustExplanations: GrowthHomeTrustExplanation[]
  dailyBriefing: GrowthHomeDailyBriefing | null
  /** GE-AI-UX-8A — autonomous revenue operator layer */
  activeRevenueMissions: GrowthHomeRevenueMission[]
  missionHealth: GrowthHomeMissionHealthSummary[]
  missionTimeline: GrowthHomeMissionTimelineItem[]
  nextPlannedActions: GrowthHomePlannedAction[]
  revenueForecast: GrowthHomeRevenueForecast | null
  /** GE-AI-UX-9A — autonomous marketing operator layer */
  marketingMissions: GrowthHomeMarketingMission[]
  campaignPerformance: GrowthHomeCampaignPerformanceItem[]
  contentPreparing: GrowthHomeContentPreparingItem[]
  audienceIntelligence: GrowthHomeAudienceInsight[]
  marketingContribution: GrowthHomeMarketingContribution | null
  /** GE-AI-UX-9B — autonomous customer success operator layer */
  customerSuccessMissions: GrowthHomeCsMission[]
  customerHealth: GrowthHomeCsCustomerHealthItem[]
  expansionOpportunities: GrowthHomeCsExpansionOpportunity[]
  renewalsMonitoring: GrowthHomeCsRenewalMonitoring[]
  customerWins: GrowthHomeCsCustomerWin[]
  csContribution: GrowthHomeCsContribution | null
  /** GE-AI-UX-9C — autonomous service operator layer */
  serviceMissions: GrowthHomeServiceMission[]
  serviceHealth: GrowthHomeServiceHealthItem[]
  technicianAwareness: GrowthHomeTechnicianAwarenessItem[]
  serviceFollowUps: GrowthHomeServiceFollowUp[]
  operationalInsights: GrowthHomeServiceOperationalInsight[]
  serviceContribution: GrowthHomeServiceContribution | null
  /** GE-AIOS-UX-1A — AI OS home operator experience */
  aiOsUx: GrowthHomeAiOsUxViewModel
}

export type GrowthHomeRevenueMission = {
  id: string
  title: string
  objective: string
  progressPercent: number
  currentStage: string
  estimatedCompletion: string
  blocker: string | null
  nextAction: string
  health: "healthy" | "waiting" | "blocked" | "needs_review" | "completed"
  metrics: Array<{ label: string; value: string }>
  nextMilestone: string
  reviewHref: string
  controls: Array<{
    kind: "pause" | "resume" | "review" | "open_approvals"
    label: string
    href: string
    disabled?: boolean
  }>
}

export type GrowthHomeMissionHealthSummary = {
  health: GrowthHomeRevenueMission["health"]
  count: number
}

export type GrowthHomeMissionTimelineItem = {
  id: string
  summary: string
  occurredAt: string | null
  missionId: string | null
}

export type GrowthHomePlannedAction = {
  id: string
  summary: string
  evidence: string
}

export type GrowthHomeRevenueForecast = {
  monthlyGoal: string
  projectedAttainment: string
  projectedPercent: number
  remainingWork: string
  risk: string
  confidence: string
}

export type GrowthHomeMarketingMission = {
  id: string
  campaign: string
  goal: string
  progressPercent: number
  currentStage: string
  expectedImpact: string
  blocker: string | null
  nextMilestone: string
  reviewHref: string
  health: "healthy" | "waiting" | "blocked" | "needs_review" | "completed"
}

export type GrowthHomeCampaignPerformanceItem = {
  id: string
  summary: string
  evidence: string
}

export type GrowthHomeContentPreparingItem = {
  id: string
  label: string
  detail: string
  href: string
}

export type GrowthHomeAudienceInsight = {
  id: string
  insight: string
  evidence: string
}

export type GrowthHomeMarketingContribution = {
  pipelineInfluenced: string
  campaignRoi: string
  leadsGenerated: string
  meetingsInfluenced: string
  revenueInfluenced: string
}

export type GrowthHomeCsMission = {
  id: string
  customer: string
  currentHealth: string
  renewalStatus: string
  progressPercent: number
  currentStage: string
  nextMilestone: string
  blocker: string | null
  expectedValue: string
  reviewHref: string
  health: "healthy" | "waiting" | "blocked" | "needs_review" | "completed"
}

export type GrowthHomeCsCustomerHealthItem = {
  id: string
  summary: string
  evidence: string
}

export type GrowthHomeCsExpansionOpportunity = {
  id: string
  headline: string
  evidence: string
}

export type GrowthHomeCsRenewalMonitoring = {
  id: string
  customer: string
  riskLevel: string
  recommendedAction: string
  daysRemaining: number
  owner: string
  href: string
}

export type GrowthHomeCsCustomerWin = {
  id: string
  emoji: string
  headline: string
  detail: string
}

export type GrowthHomeCsContribution = {
  retention: string
  expansionRevenue: string
  renewalPipeline: string
  customerHealth: string
  advocatesCreated: string
  lifetimeValueInfluenced: string
}

export type GrowthHomeServiceMission = {
  id: string
  customer: string
  workOrder: string
  currentStage: string
  technician: string
  progressPercent: number
  blocker: string | null
  eta: string
  expectedValue: string
  reviewHref: string
  health: "healthy" | "waiting" | "blocked" | "needs_review" | "completed"
}

export type GrowthHomeServiceHealthItem = {
  id: string
  summary: string
  evidence: string
}

export type GrowthHomeTechnicianAwarenessItem = {
  id: string
  summary: string
  evidence: string
}

export type GrowthHomeServiceFollowUp = {
  id: string
  summary: string
  evidence: string
}

export type GrowthHomeServiceOperationalInsight = {
  id: string
  headline: string
  evidence: string
}

export type GrowthHomeServiceContribution = {
  workOrdersCompleted: string
  firstTimeFixRate: string
  technicianUtilization: string
  customerSatisfaction: string
  reviewRequests: string
  serviceRevenueInfluenced: string
}

export type GrowthHomeSinceWeLastMetItem = {
  id: string
  category: "completed" | "changed" | "improved" | "escalated" | "waiting"
  summary: string
  evidence: string
}

export type GrowthHomeWhatChangedItem = {
  id: string
  label: string
  detail: string
  href: string | null
}

export type GrowthHomeRecommendationContinuity = {
  id: string
  headline: string
  previousStance: string
  currentStance: string
  reason: string
  evidence: string[]
}

export type GrowthHomeProgressPeriod = {
  id: string
  label: string
  metrics: Array<{ label: string; value: string }>
}

export type GrowthHomeMilestone = {
  id: string
  emoji: string
  headline: string
  detail: string
}

export type GrowthHomeTrustExplanation = {
  id: string
  direction: "increased" | "decreased"
  summary: string
  evidence: string[]
}

export type GrowthHomeDailyBriefing = {
  period: "morning" | "afternoon" | "evening"
  headline: string
  items: string[]
}
