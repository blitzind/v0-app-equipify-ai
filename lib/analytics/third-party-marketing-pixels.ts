/**
 * Reserved hook points for Meta Pixel, Microsoft Clarity, LinkedIn Insight Tag, etc.
 * Import from `MarketingAnalyticsProvider` when wiring additional tags.
 */
export type FutureMarketingPixelId = "meta" | "clarity" | "linkedin"

export function registerFutureMarketingPixels(opts?: { debug?: boolean }) {
  void opts
  /* intentionally empty — extend here without scattering inline scripts */
}
