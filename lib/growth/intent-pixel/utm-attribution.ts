import type { GrowthIntentPixelUtmAttribution } from "@/lib/growth/intent-pixel/intent-pixel-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function parseUtmFromUrl(pageUrl: string): GrowthIntentPixelUtmAttribution {
  const empty: GrowthIntentPixelUtmAttribution = {
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
  }

  try {
    const url = new URL(pageUrl)
    return {
      utm_source: asString(url.searchParams.get("utm_source")),
      utm_medium: asString(url.searchParams.get("utm_medium")),
      utm_campaign: asString(url.searchParams.get("utm_campaign")),
      utm_term: asString(url.searchParams.get("utm_term")),
      utm_content: asString(url.searchParams.get("utm_content")),
    }
  } catch {
    return empty
  }
}

export function mergeUtmAttribution(
  partial: Partial<GrowthIntentPixelUtmAttribution> | undefined,
  pageUrl?: string,
): GrowthIntentPixelUtmAttribution {
  const fromUrl = pageUrl ? parseUtmFromUrl(pageUrl) : {
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
  }

  return {
    utm_source: asString(partial?.utm_source) || fromUrl.utm_source,
    utm_medium: asString(partial?.utm_medium) || fromUrl.utm_medium,
    utm_campaign: asString(partial?.utm_campaign) || fromUrl.utm_campaign,
    utm_term: asString(partial?.utm_term) || fromUrl.utm_term,
    utm_content: asString(partial?.utm_content) || fromUrl.utm_content,
  }
}

export function hasUtmSignal(utm: GrowthIntentPixelUtmAttribution): boolean {
  return Object.values(utm).some((value) => value.length > 0)
}
