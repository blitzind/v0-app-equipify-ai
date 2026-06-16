/** Growth Engine S2-H — Retell conversational agent metadata catalog (static, no migration). Client-safe. */

export const GROWTH_MEDIA_CONVERSATIONAL_AGENT_QA_MARKER = "growth-media-conversational-agents-s2h-v1" as const

export const GROWTH_MEDIA_CONVERSATIONAL_AGENT_PROVIDERS = ["retell"] as const

export type GrowthMediaConversationalAgentProvider = (typeof GROWTH_MEDIA_CONVERSATIONAL_AGENT_PROVIDERS)[number]

export type GrowthMediaConversationalQualificationGoal = {
  goalId: string
  label: string
  description: string
}

export type GrowthMediaConversationalAgentDefinition = {
  agentId: string
  provider: GrowthMediaConversationalAgentProvider
  displayName: string
  description: string | null
  avatarId: string | null
  voiceId: string | null
  language: string
  personality: string | null
  systemPrompt: string
  qualificationGoals: GrowthMediaConversationalQualificationGoal[]
  enabled: boolean
}

export const GROWTH_MEDIA_RETELL_CONVERSATIONAL_AGENT_CATALOG: GrowthMediaConversationalAgentDefinition[] = [
  {
    agentId: "retell-agent-jordan-qualifier",
    provider: "retell",
    displayName: "Jordan — Share Page Qualifier",
    description: "Warm outbound qualifier for personalized share page follow-ups.",
    avatarId: "elevenlabs-avatar-jordan",
    voiceId: "elevenlabs-voice-jordan-clone",
    language: "en-US",
    personality: "professional, consultative, concise",
    systemPrompt:
      "You are Jordan from {{sender.company}} speaking with {{prospect.name}} at {{company.name}}. Qualify interest, confirm fit, and guide toward booking when appropriate.",
    qualificationGoals: [
      {
        goalId: "meeting_readiness",
        label: "Meeting readiness",
        description: "Assess timeline, budget signals, and decision-maker access.",
      },
      {
        goalId: "fit_qualification",
        label: "Fit qualification",
        description: "Confirm ICP fit and pain points using fit scoring concepts.",
      },
    ],
    enabled: true,
  },
  {
    agentId: "retell-agent-maya-discovery",
    provider: "retell",
    displayName: "Maya — Discovery Guide",
    description: "Conversational discovery agent for buying committee and next-best-action signals.",
    avatarId: "elevenlabs-avatar-maya",
    voiceId: "elevenlabs-voice-maya-clone",
    language: "en-US",
    personality: "friendly, curious, patient",
    systemPrompt:
      "You are Maya helping {{prospect.name}} explore how {{sender.company}} can support {{company.name}}. Surface buying committee signals and recommend next steps without pressure.",
    qualificationGoals: [
      {
        goalId: "buying_committee_discovery",
        label: "Buying committee discovery",
        description: "Identify stakeholders and committee coverage gaps.",
      },
      {
        goalId: "next_best_action",
        label: "Next best action",
        description: "Recommend human follow-up aligned with NBA engine outcomes.",
      },
    ],
    enabled: true,
  },
  {
    agentId: "retell-agent-alex-executive",
    provider: "retell",
    displayName: "Alex — Executive Briefing",
    description: "Executive briefing agent focused on meeting readiness and booking recommendations.",
    avatarId: "elevenlabs-avatar-alex",
    voiceId: "elevenlabs-voice-alex-narration",
    language: "en-GB",
    personality: "executive, direct, respectful",
    systemPrompt:
      "You are Alex briefing {{prospect.name}} on value for {{company.name}}. Confirm executive priorities and determine whether a live meeting is appropriate.",
    qualificationGoals: [
      {
        goalId: "booking_recommendation",
        label: "Booking recommendation",
        description: "Evaluate booking criteria and meeting readiness score thresholds.",
      },
    ],
    enabled: true,
  },
]

export function listEnabledConversationalAgents(
  provider: GrowthMediaConversationalAgentProvider = "retell",
): GrowthMediaConversationalAgentDefinition[] {
  return GROWTH_MEDIA_RETELL_CONVERSATIONAL_AGENT_CATALOG.filter(
    (agent) => agent.provider === provider && agent.enabled,
  )
}

export function getConversationalAgentById(
  agentId: string | null | undefined,
): GrowthMediaConversationalAgentDefinition | null {
  const trimmed = agentId?.trim()
  if (!trimmed) return null
  return GROWTH_MEDIA_RETELL_CONVERSATIONAL_AGENT_CATALOG.find((agent) => agent.agentId === trimmed) ?? null
}

export function validateConversationalAgentId(agentId: string | null | undefined): boolean {
  const agent = getConversationalAgentById(agentId)
  return agent != null && agent.enabled
}
