import type {
  GrowthIntentPixelBrowserMetadata,
  GrowthIntentPixelDeviceMetadata,
} from "@/lib/growth/intent-pixel/intent-pixel-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.round(value)
}

export function normalizeDeviceMetadata(
  partial: Partial<GrowthIntentPixelDeviceMetadata> | undefined,
): GrowthIntentPixelDeviceMetadata {
  return {
    user_agent: asString(partial?.user_agent).slice(0, 512),
    language: asString(partial?.language).slice(0, 32),
    timezone: asString(partial?.timezone).slice(0, 64),
    screen_width: asNullableNumber(partial?.screen_width),
    screen_height: asNullableNumber(partial?.screen_height),
    platform: asString(partial?.platform).slice(0, 64),
  }
}

export function normalizeBrowserMetadata(
  partial: Partial<GrowthIntentPixelBrowserMetadata> | undefined,
  fallback: { page_url?: string; referrer?: string } = {},
): GrowthIntentPixelBrowserMetadata {
  return {
    referrer: asString(partial?.referrer ?? fallback.referrer).slice(0, 2048),
    landing_url: asString(partial?.landing_url).slice(0, 2048),
    page_url: asString(partial?.page_url ?? fallback.page_url).slice(0, 2048),
  }
}

export function extractPagePath(pageUrl: string): string {
  try {
    const url = new URL(pageUrl)
    return `${url.pathname}${url.search}`
  } catch {
    return pageUrl.slice(0, 512)
  }
}
