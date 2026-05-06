import type { AiProviderId } from "@/lib/ai/types"

export function getProviderApiKey(provider: AiProviderId): string | null {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY?.trim() || null
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY?.trim() || null
    case "google":
      return (
        process.env.GOOGLE_AI_API_KEY?.trim() ||
        process.env.GEMINI_API_KEY?.trim() ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
        null
      )
    default:
      return null
  }
}

export function hasProviderCredentials(provider: AiProviderId): boolean {
  return Boolean(getProviderApiKey(provider))
}
