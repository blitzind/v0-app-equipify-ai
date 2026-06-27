/** Client-safe Growth Engine research error copy. */

export function growthLeadResearchErrorMessage(input: {
  error?: string | null
  message?: string | null
}): string {
  if (input.message?.trim()) return input.message.trim()

  switch (input.error) {
    case "server_config":
      return "AI research is not configured. Set GROWTH_ENGINE_AI_ORG_ID on the server."
    case "not_configured":
      return "AI research is not configured. Set OPENAI_API_KEY and enable AI providers."
    case "feature_disabled":
      return "AI OS is disabled on this deployment."
    case "forbidden":
      return "Platform admin access is required."
    case "not_found":
      return "Lead not found."
    case "research_failed":
      return "Research generation failed. Check server logs for details."
    default:
      return "Research generation failed."
  }
}
