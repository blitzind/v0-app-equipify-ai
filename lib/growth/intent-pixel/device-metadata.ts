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
  const base: GrowthIntentPixelBrowserMetadata = {
    referrer: asString(partial?.referrer ?? fallback.referrer).slice(0, 2048),
    landing_url: asString(partial?.landing_url).slice(0, 2048),
    page_url: asString(partial?.page_url ?? fallback.page_url).slice(0, 2048),
  }

  if (partial?.consent_categories && typeof partial.consent_categories === "object") {
    base.consent_categories = {
      analytics: partial.consent_categories.analytics === true,
      personalization: partial.consent_categories.personalization === true,
      marketing: partial.consent_categories.marketing === true,
    }
  }

  if (partial?.personalization_segment && typeof partial.personalization_segment === "object") {
    const segment = partial.personalization_segment
    base.personalization_segment = {
      industry_affinity: asString(segment.industry_affinity) || null,
      content_affinity: asString(segment.content_affinity) || null,
      returning_visitor: segment.returning_visitor === true,
      visit_count:
        typeof segment.visit_count === "number" && Number.isFinite(segment.visit_count)
          ? Math.max(0, Math.round(segment.visit_count))
          : 0,
      last_industry_slug: asString(segment.last_industry_slug) || null,
      recommended_cta: asString(segment.recommended_cta) || null,
      recommended_case_study_slug: asString(segment.recommended_case_study_slug) || null,
    }
  }

  return base
}

export function extractPagePath(pageUrl: string): string {
  try {
    const url = new URL(pageUrl)
    return `${url.pathname}${url.search}`
  } catch {
    return pageUrl.slice(0, 512)
  }
}
