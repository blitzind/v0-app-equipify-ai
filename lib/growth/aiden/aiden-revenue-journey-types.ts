/** Aiden Revenue Journey Tracker — client-safe types. */

export const AIDEN_REVENUE_JOURNEY_QA_MARKER = "aiden-revenue-journey-v1" as const

export const AIDEN_REVENUE_JOURNEY_STAGES = [
  "email_sent",
  "reply_received",
  "meeting",
  "opportunity",
  "revenue",
] as const

export type AidenRevenueJourneyStageKey = (typeof AIDEN_REVENUE_JOURNEY_STAGES)[number]

export type AidenRevenueJourneyStage = {
  key: AidenRevenueJourneyStageKey
  label: string
  complete: boolean
  detail: string | null
  deep_link: string | null
}

export type AidenPilotLeadRevenueJourney = {
  lead_id: string
  company_name: string
  current_stage: AidenRevenueJourneyStageKey
  stages: AidenRevenueJourneyStage[]
  missing_requirements: string[]
  recommended_next_action: string
}

export type AidenRevenueJourneyTracker = {
  qa_marker: typeof AIDEN_REVENUE_JOURNEY_QA_MARKER
  cohort_id: string | null
  generated_at: string
  summary: {
    total_leads: number
    email_sent: number
    reply_received: number
    meeting: number
    opportunity: number
    revenue: number
  }
  journeys: AidenPilotLeadRevenueJourney[]
}

export const AIDEN_REVENUE_JOURNEY_STAGE_LABELS: Record<AidenRevenueJourneyStageKey, string> = {
  email_sent: "Email Sent",
  reply_received: "Reply Received",
  meeting: "Meeting",
  opportunity: "Opportunity",
  revenue: "Revenue",
}

export function buildAidenRevenueJourneyTracker(input: {
  cohortId: string | null
  journeys: AidenPilotLeadRevenueJourney[]
}): AidenRevenueJourneyTracker {
  const summary = {
    total_leads: input.journeys.length,
    email_sent: input.journeys.filter((j) => j.stages.find((s) => s.key === "email_sent")?.complete).length,
    reply_received: input.journeys.filter((j) => j.stages.find((s) => s.key === "reply_received")?.complete).length,
    meeting: input.journeys.filter((j) => j.stages.find((s) => s.key === "meeting")?.complete).length,
    opportunity: input.journeys.filter((j) => j.stages.find((s) => s.key === "opportunity")?.complete).length,
    revenue: input.journeys.filter((j) => j.stages.find((s) => s.key === "revenue")?.complete).length,
  }

  return {
    qa_marker: AIDEN_REVENUE_JOURNEY_QA_MARKER,
    cohort_id: input.cohortId,
    generated_at: new Date().toISOString(),
    summary,
    journeys: input.journeys,
  }
}
