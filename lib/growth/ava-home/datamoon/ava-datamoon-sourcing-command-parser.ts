/** GE-AVA-DATAMOON-SOURCING-WORKBENCH-1A — Natural language → editable audience draft (client-safe). */

import {
  AVA_DATAMOON_JOB_TITLE_PRESETS,
  AVA_DATAMOON_TOPIC_PRESETS,
  createDefaultAvaDatamoonAudienceDraft,
  type AvaDatamoonAudienceDraft,
  type AvaDatamoonSourcingDraftResult,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"

function normalizeCommand(command: string): string {
  return command.trim().toLowerCase()
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase))
}

function pickTopics(text: string): { topics: string[]; assumptions: string[] } {
  const assumptions: string[] = []
  if (includesAny(text, ["medical equipment", "medical device", "biomedical"])) {
    return { topics: ["medical equipment service"], assumptions: ["Mapped to medical equipment service topic."] }
  }
  if (includesAny(text, ["public safety", "fire department", "police", "ems", "first responder"])) {
    return {
      topics: ["public safety equipment service"],
      assumptions: ["Mapped to public safety equipment service topic."],
    }
  }
  if (includesAny(text, ["field service", "fsm"])) {
    return { topics: ["field service management"], assumptions: ["Mapped to field service management topic."] }
  }
  if (includesAny(text, ["repair", "maintenance operations", "facilities maintenance"])) {
    return {
      topics: ["repair and maintenance operations"],
      assumptions: ["Mapped to repair and maintenance operations topic."],
    }
  }
  if (includesAny(text, ["equipment maintenance", "maintenance software", "cmms", "equipment service"])) {
    return {
      topics: ["equipment maintenance software"],
      assumptions: ["Mapped to equipment maintenance software topic."],
    }
  }
  assumptions.push("Defaulted to equipment maintenance software topic.")
  return { topics: ["equipment maintenance software"], assumptions }
}

function pickJobTitles(text: string): { jobTitles: string[]; assumptions: string[] } {
  const assumptions: string[] = []
  if (includesAny(text, ["public safety"])) {
    return {
      jobTitles: ["owner", "general manager", "operations manager", "service manager"],
      assumptions: ["Prioritized owner, general manager, operations manager, and service manager."],
    }
  }
  if (includesAny(text, ["medical equipment"])) {
    return {
      jobTitles: ["owner", "CEO", "operations manager", "service manager"],
      assumptions: ["Prioritized owners, operators, and service managers."],
    }
  }
  if (includesAny(text, ["buyer", "buyers", "decision maker", "decision-maker"])) {
    return {
      jobTitles: ["owner", "CEO", "president", "operations manager"],
      assumptions: ["Prioritized buyer-facing leadership titles."],
    }
  }
  assumptions.push("Prioritized owner, CEO, operations manager, and service manager.")
  return {
    jobTitles: ["owner", "CEO", "operations manager", "service manager"],
  }
}

function pickLookbackDays(text: string): AvaDatamoonAudienceDraft["lookbackDays"] {
  if (includesAny(text, ["90 day", "90-day", "last 90", "past 90"])) return 90
  if (includesAny(text, ["60 day", "60-day", "last 60", "past 60"])) return 60
  if (includesAny(text, ["30 day", "30-day", "last 30", "past 30", "last month"])) return 30
  if (includesAny(text, ["14 day", "14-day", "last 14", "past 14", "two week"])) return 14
  return 7
}

function pickIntentLevels(text: string): AvaDatamoonAudienceDraft["intentLevels"] {
  const levels = new Set<AvaDatamoonAudienceDraft["intentLevels"][number]>()
  if (includesAny(text, ["high intent", "high-intent", "high buying"])) levels.add("high")
  if (includesAny(text, ["medium intent", "medium-intent"])) levels.add("medium")
  if (includesAny(text, ["low intent", "low-intent"])) levels.add("low")
  if (levels.size === 0) {
    levels.add("high")
    levels.add("medium")
  }
  return Array.from(levels)
}

function pickAudienceName(text: string, topics: string[]): string {
  if (includesAny(text, ["medical equipment"])) return "Medical equipment service buyers"
  if (includesAny(text, ["public safety"])) return "Public safety service companies"
  if (includesAny(text, ["field service"])) return "Field service management buyers"
  return `${topics[0] ?? "Datamoon"} audience`
}

function buildExplanation(draft: AvaDatamoonAudienceDraft): string {
  const titles = draft.jobTitles.join(", ")
  const topics = draft.topics.join(", ")
  const intents = draft.intentLevels.join(" and ")
  return (
    `I'll look for ${draft.geography.country}-based ${draft.companySize.toUpperCase()} service companies showing ${intents} intent around ${topics} in the last ${draft.lookbackDays} days. ` +
    `I'll prioritize ${titles}. Review or edit the search before I build the audience.`
  )
}

export function parseAvaDatamoonSourcingCommand(command: string): AvaDatamoonSourcingDraftResult {
  const text = normalizeCommand(command)
  const assumptions: string[] = []
  const topicPick = pickTopics(text)
  assumptions.push(...topicPick.assumptions)

  const jobTitlePick = pickJobTitles(text)
  assumptions.push(...jobTitlePick.assumptions)

  const lookbackDays = pickLookbackDays(text)
  if (lookbackDays === 7) assumptions.push("Defaulted lookback window to 7 days.")

  const intentLevels = pickIntentLevels(text)
  if (intentLevels.includes("high") && intentLevels.includes("medium") && !text.includes("intent")) {
    assumptions.push("Included high and medium intent levels.")
  }

  assumptions.push("Defaulted geography to US.")
  assumptions.push("Defaulted company size to SMB.")
  assumptions.push("Human approval required before building audience or importing records.")

  const audienceDraft = createDefaultAvaDatamoonAudienceDraft({
    audienceName: pickAudienceName(text, topicPick.topics),
    topics: topicPick.topics,
    jobTitles: jobTitlePick.jobTitles,
    lookbackDays,
    intentLevels,
    geography: { country: "US", state: null, city: null },
    companySize: "smb",
  })

  return {
    audienceDraft,
    explanation: buildExplanation(audienceDraft),
    confidence: topicPick.topics.some((topic) => AVA_DATAMOON_TOPIC_PRESETS.includes(topic as never)) ? 0.82 : 0.65,
    assumptions,
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
