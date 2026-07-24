/**
 * FUZOR-COMPANY-INTELLIGENCE-GPT-DIRECT-1A — Experimental prompts.
 * Parallel path only. Production CI unchanged.
 */

export const FUZOR_CI_GPT_DIRECT_1A_QA_MARKER =
  "fuzor-company-intelligence-gpt-direct-1a-v1" as const

export const FUZOR_CI_GPT_DIRECT_PROMPT_VERSION =
  "fuzor-company-intelligence-gpt-direct-1a-v1" as const

export const FUZOR_CI_GPT_DIRECT_HOTFIX_1A_OBJECTIVE =
  "Understand this company well enough to explain what it does, how it appears to operate, and whether another AI employee could make an informed business decision about it." as const

export function buildGptDirectCompanyIntelligenceSystemPrompt(): string {
  return [
    "You help another AI employee understand a company well enough to make informed business decisions about it.",
    "",
    "Your objective is business comprehension — how the company operates, what it sells or delivers, who it serves, and how work likely flows day to day.",
    "",
    "You are given the company name, website, and retrieved website text.",
    "Use that material as your source. Do not invent facts beyond what the website text supports.",
    "When the website text is incomplete, determine what it does support and list genuine unknowns separately.",
    "",
    "Do not recommend software.",
    "Do not mention Equipify.",
    "Do not determine ICP fit or sales suitability.",
    "Do not output confidence percentages, maturity scores, fit scores, or probabilities.",
    "",
    "Return JSON matching the required schema exactly.",
  ].join("\n")
}

export function buildGptDirectCompanyIntelligenceUserPrompt(input: {
  companyName: string
  website: string | null
  websitePages: Array<{ url: string; text: string }>
  retrievalStatus: string
  objective?: string
}): string {
  const websiteSection =
    input.websitePages.length > 0
      ? input.websitePages
          .map(
            (page, index) =>
              `--- PAGE ${index + 1}: ${page.url} ---\n${page.text}`,
          )
          .join("\n\n")
      : "(no website text retrieved)"

  return [
    input.objective ??
      "Understand this business well enough that another AI employee could make informed business decisions about them.",
    "",
    "COMPANY NAME",
    input.companyName,
    "",
    "WEBSITE",
    input.website ?? "(none)",
    "",
    "WEBSITE RETRIEVAL STATUS",
    input.retrievalStatus,
    "",
    "RETRIEVED WEBSITE TEXT",
    "The software retrieved public website text. Use it as appropriate.",
    "You decide how to interpret it. No further page instructions are provided.",
    "",
    websiteSection,
    "",
    "Respond with JSON only.",
  ].join("\n")
}
