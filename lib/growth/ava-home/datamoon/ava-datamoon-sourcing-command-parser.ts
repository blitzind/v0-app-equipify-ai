/** GE-AVA-DATAMOON-SOURCING-WORKBENCH-1A / GE-AIOS-BUSINESS-PROFILE-1C — NL → editable audience draft (client-safe). */

import type { BusinessProfileLeadDiscoveryProjection } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import {
  extractCommandTopicPhrase,
  parseUsStateFromCommand,
} from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import {
  AVA_DATAMOON_JOB_TITLE_PRESETS,
  AVA_DATAMOON_TOPIC_PRESETS,
  createMinimalAvaDatamoonAudienceDraft,
  type AvaDatamoonAudienceDraft,
  type AvaDatamoonSourcingDraftResult,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"

export type ParseAvaDatamoonSourcingCommandOptions = {
  profileProjection?: BusinessProfileLeadDiscoveryProjection | null
}

function normalizeCommand(command: string): string {
  return command.trim().toLowerCase()
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase))
}

type TopicPick = { topics: string[]; assumptions: string[]; fromCommand: boolean }

function pickCommandSpecificTopics(text: string): TopicPick | null {
  if (includesAny(text, ["medical equipment", "medical device", "biomedical"])) {
    return { topics: ["medical equipment service"], assumptions: ["Mapped to medical equipment service topic."], fromCommand: true }
  }
  if (includesAny(text, ["public safety", "fire department", "police", "ems", "first responder"])) {
    return {
      topics: ["public safety equipment service"],
      assumptions: ["Mapped to public safety equipment service topic."],
      fromCommand: true,
    }
  }
  if (includesAny(text, ["field service", "fsm"])) {
    return { topics: ["field service management"], assumptions: ["Mapped to field service management topic."], fromCommand: true }
  }
  if (includesAny(text, ["repair", "maintenance operations", "facilities maintenance"])) {
    return {
      topics: ["repair and maintenance operations"],
      assumptions: ["Mapped to repair and maintenance operations topic."],
      fromCommand: true,
    }
  }
  if (includesAny(text, ["equipment maintenance", "maintenance software", "cmms", "equipment service"])) {
    return {
      topics: ["equipment maintenance software"],
      assumptions: ["Mapped to equipment maintenance software topic from your request."],
      fromCommand: true,
    }
  }
  if (includesAny(text, ["roofing"])) {
    return { topics: ["roofing"], assumptions: ["Mapped to roofing from your request."], fromCommand: true }
  }
  if (includesAny(text, ["hvac"])) {
    return { topics: ["hvac"], assumptions: ["Mapped to HVAC from your request."], fromCommand: true }
  }
  return null
}

function pickTopics(text: string, profile?: BusinessProfileLeadDiscoveryProjection | null): TopicPick {
  const commandSpecific = pickCommandSpecificTopics(text)
  if (commandSpecific) return commandSpecific

  const extracted = extractCommandTopicPhrase(text)
  if (extracted) {
    return {
      topics: [extracted],
      assumptions: [`Interpreted search topic from your request: "${extracted}".`],
      fromCommand: true,
    }
  }

  if (profile?.topics.length) {
    return {
      topics: profile.topics.slice(0, 5),
      assumptions: ["Started with topics from your approved Business Profile."],
      fromCommand: false,
    }
  }

  return {
    topics: [],
    assumptions: ["No approved Business Profile — topics were not prefilled. Add topics manually or create a Business Profile."],
    fromCommand: false,
  }
}

function pickJobTitles(text: string, profile?: BusinessProfileLeadDiscoveryProjection | null): { jobTitles: string[]; assumptions: string[]; fromCommand: boolean } {
  if (includesAny(text, ["public safety"])) {
    return {
      jobTitles: ["owner", "general manager", "operations manager", "service manager"],
      assumptions: ["Prioritized owner, general manager, operations manager, and service manager."],
      fromCommand: true,
    }
  }
  if (includesAny(text, ["medical equipment"])) {
    return {
      jobTitles: ["owner", "CEO", "operations manager", "service manager"],
      assumptions: ["Prioritized owners, operators, and service managers."],
      fromCommand: true,
    }
  }
  if (includesAny(text, ["buyer", "buyers", "decision maker", "decision-maker"])) {
    return {
      jobTitles: ["owner", "CEO", "president", "operations manager"],
      assumptions: ["Prioritized buyer-facing leadership titles from your request."],
      fromCommand: true,
    }
  }

  if (profile?.jobTitles.length) {
    return {
      jobTitles: profile.jobTitles.slice(0, 8),
      assumptions: ["Started with buyer personas from your approved Business Profile."],
      fromCommand: false,
    }
  }

  return {
    jobTitles: [],
    assumptions: ["No approved Business Profile — job titles were not prefilled."],
    fromCommand: false,
  }
}

function pickLookbackDays(text: string, profile?: BusinessProfileLeadDiscoveryProjection | null): AvaDatamoonAudienceDraft["lookbackDays"] {
  if (includesAny(text, ["90 day", "90-day", "last 90", "past 90"])) return 90
  if (includesAny(text, ["60 day", "60-day", "last 60", "past 60"])) return 60
  if (includesAny(text, ["30 day", "30-day", "last 30", "past 30", "last month"])) return 30
  if (includesAny(text, ["14 day", "14-day", "last 14", "past 14", "two week"])) return 14
  return profile?.lookbackDays ?? 7
}

function pickIntentLevels(text: string, profile?: BusinessProfileLeadDiscoveryProjection | null): AvaDatamoonAudienceDraft["intentLevels"] {
  const levels = new Set<AvaDatamoonAudienceDraft["intentLevels"][number]>()
  if (includesAny(text, ["high intent", "high-intent", "high buying"])) levels.add("high")
  if (includesAny(text, ["medium intent", "medium-intent"])) levels.add("medium")
  if (includesAny(text, ["low intent", "low-intent"])) levels.add("low")
  if (levels.size === 0) {
    return profile?.intentLevels?.length ? [...profile.intentLevels] : ["high", "medium"]
  }
  return Array.from(levels)
}

function pickGeography(text: string, profile?: BusinessProfileLeadDiscoveryProjection | null): AvaDatamoonAudienceDraft["geography"] {
  const state = parseUsStateFromCommand(text)
  if (state) {
    return { country: "US", state, city: null }
  }
  if (includesAny(text, ["united states", "u.s.", " usa", " us-based", "u.s.-based"])) {
    return { country: "US", state: null, city: null }
  }
  return profile?.geography ?? { country: "US", state: null, city: null }
}

function pickCompanySize(text: string, profile?: BusinessProfileLeadDiscoveryProjection | null): AvaDatamoonAudienceDraft["companySize"] {
  if (includesAny(text, ["enterprise", "500+"])) return "500+"
  if (includesAny(text, ["mid-market", "mid market", "51-200", "51 to 200"])) return "51-200"
  if (includesAny(text, ["smb", "small business", "small and mid"])) return "smb"
  return profile?.companySize ?? "smb"
}

function pickAudienceName(text: string, topics: string[], profile?: BusinessProfileLeadDiscoveryProjection | null): string {
  if (includesAny(text, ["medical equipment"])) return "Medical equipment service buyers"
  if (includesAny(text, ["public safety"])) return "Public safety service companies"
  if (includesAny(text, ["field service"])) return "Field service management buyers"
  if (includesAny(text, ["roofing"])) return "Roofing companies"
  if (profile?.audienceNameSuggestion && !topics.length) return profile.audienceNameSuggestion
  return `${topics[0] ?? "Lead discovery"} audience`
}

function buildExplanation(input: {
  draft: AvaDatamoonAudienceDraft
  profileUsed: boolean
}): string {
  const titles = draftSummaryTitles(input.draft)
  const topics = input.draft.topics.join(", ") || "your selected topics"
  const intents = input.draft.intentLevels.join(" and ")
  const geo = input.draft.geography.state
    ? `${input.draft.geography.state}, ${input.draft.geography.country}`
    : input.draft.geography.country

  if (input.profileUsed) {
    return (
      `I started with your approved Business Profile and adjusted the search based on your request. ` +
      `I'll look for ${geo}-based ${input.draft.companySize.toUpperCase()} companies showing ${intents} intent around ${topics} in the last ${input.draft.lookbackDays} days. ` +
      `${titles}Review or edit the search before I build the audience.`
    )
  }

  return (
    `I don't know your ideal customer yet. Create a Business Profile first for better recommendations, or continue with this manual search draft. ` +
    `I'll look for ${geo}-based companies showing ${intents} intent around ${topics || "topics you add"} in the last ${input.draft.lookbackDays} days. ` +
    `${titles}Review or edit the search before I build the audience.`
  )
}

function draftSummaryTitles(draft: AvaDatamoonAudienceDraft): string {
  if (draft.jobTitles.length === 0) return ""
  return `I'll prioritize ${draft.jobTitles.join(", ")}. `
}

export function parseAvaDatamoonSourcingCommand(
  command: string,
  options: ParseAvaDatamoonSourcingCommandOptions = {},
): AvaDatamoonSourcingDraftResult {
  const text = normalizeCommand(command)
  const profile = options.profileProjection ?? null
  const profileUsed = Boolean(profile)
  const assumptions: string[] = []
  const overrides: string[] = []

  const topicPick = pickTopics(text, profile)
  assumptions.push(...topicPick.assumptions)
  if (profile && topicPick.fromCommand && profile.topics.length > 0) {
    const profileTopic = profile.topics[0]
    const commandTopic = topicPick.topics[0]
    if (profileTopic && commandTopic && profileTopic.toLowerCase() !== commandTopic.toLowerCase()) {
      overrides.push(`Override: topic changed from "${profileTopic}" to "${commandTopic}" based on your request.`)
    }
  }

  const jobTitlePick = pickJobTitles(text, profile)
  assumptions.push(...jobTitlePick.assumptions)

  const lookbackDays = pickLookbackDays(text, profile)
  if (lookbackDays === 7 && !text.match(/day|week|month/)) {
    assumptions.push(profileUsed ? "Defaulted lookback window to 7 days." : "Defaulted lookback window to 7 days.")
  }

  const intentLevels = pickIntentLevels(text, profile)
  if (intentLevels.includes("high") && intentLevels.includes("medium") && !text.includes("intent")) {
    assumptions.push(profileUsed ? "Included high and medium intent levels from Business Profile defaults." : "Included high and medium intent levels.")
  }

  const geography = pickGeography(text, profile)
  if (profile && geography.state && geography.state !== profile.geography.state) {
    overrides.push(`Override: geography state changed to ${geography.state} based on your request.`)
    assumptions.push(`Adjusted geography to ${geography.state}, ${geography.country} from your request.`)
  } else if (profileUsed) {
    assumptions.push(`Geography from Business Profile: ${geography.country}${geography.state ? ` (${geography.state})` : ""}.`)
  } else if (!geography.state) {
    assumptions.push("Defaulted geography to US.")
  }

  const companySize = pickCompanySize(text, profile)
  if (profile && companySize !== profile.companySize && includesAny(text, ["enterprise", "smb", "mid-market", "51-200", "500+"])) {
    overrides.push(`Override: company size changed to ${companySize} based on your request.`)
  } else if (profileUsed) {
    assumptions.push(`Company size from Business Profile: ${companySize}.`)
  } else {
    assumptions.push("Defaulted company size to SMB.")
  }

  assumptions.push("Human approval required before building audience or importing records.")

  const audienceDraft = createMinimalAvaDatamoonAudienceDraft({
    audienceName: pickAudienceName(text, topicPick.topics, profile),
    topics: topicPick.topics,
    jobTitles: jobTitlePick.jobTitles,
    lookbackDays,
    intentLevels,
    geography,
    companySize,
  })

  const confidenceBase = profileUsed ? 0.78 : 0.55
  const confidenceBoost = topicPick.topics.some((topic) => AVA_DATAMOON_TOPIC_PRESETS.includes(topic as never)) ? 0.08 : 0
  const confidence = Math.min(confidenceBase + confidenceBoost + (overrides.length > 0 ? 0.04 : 0), 0.92)

  return {
    audienceDraft,
    explanation: buildExplanation({ draft: audienceDraft, profileUsed }),
    confidence,
    assumptions,
    overrides,
    businessProfileUsed: profileUsed,
    businessProfileStatus: profileUsed ? "approved" : "missing",
    editable: true,
    requiresApproval: true,
  }
}

export function isRecognizedAvaDatamoonSourcingCommand(command: string): boolean {
  const text = normalizeCommand(command)
  if (!text) return false
  return (
    includesAny(text, ["find", "search", "look for", "build", "audience", "buyer", "companies", "prospect"]) ||
    AVA_DATAMOON_TOPIC_PRESETS.some((topic) => text.includes(topic)) ||
    AVA_DATAMOON_JOB_TITLE_PRESETS.some((title) => text.includes(title))
  )
}
