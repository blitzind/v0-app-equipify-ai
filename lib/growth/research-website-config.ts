import "server-only"

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Slice 2B kill switch — default off preserves Slice 2A behavior. */
export function isGrowthResearchWebsiteEnabledEnv(): boolean {
  return process.env.GROWTH_RESEARCH_WEBSITE_ENABLED?.trim() === "true"
}

export function getGrowthResearchWebsiteConfig() {
  return {
    enabled: isGrowthResearchWebsiteEnabledEnv(),
    timeoutMs: readPositiveInt("GROWTH_RESEARCH_WEBSITE_TIMEOUT_MS", 8000),
    maxBytes: readPositiveInt("GROWTH_RESEARCH_WEBSITE_MAX_BYTES", 1_572_864),
    excerptChars: readPositiveInt("GROWTH_RESEARCH_WEBSITE_EXCERPT_CHARS", 8000),
    maxRedirects: 3,
  }
}
