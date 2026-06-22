/** Customer-facing Personalized Videos branding (client-safe). Internal code may remain `sendr`. */

export const GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL = "Personalized Videos" as const
export const GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL = "Personalized Video Page" as const
export const GROWTH_PERSONALIZED_VIDEOS_PAGES_LABEL = "Personalized Video Pages" as const
export const GROWTH_PERSONALIZED_VIDEOS_URL_LABEL = "Video Page URL" as const
export const GROWTH_PERSONALIZED_VIDEOS_PUBLIC_PATH = "/videos" as const
export const GROWTH_PERSONALIZED_VIDEOS_LEGACY_PUBLIC_PATH = "/sendr" as const

/** Canonical Growth workspace routes — operator-facing only. */
export const GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH = "/growth/videos/personalized" as const
export const GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH = "/growth/activity" as const
/** Legacy workspace prefix — redirects preserve query params. */
export const GROWTH_PERSONALIZED_VIDEOS_LEGACY_WORKSPACE_PREFIX = "/growth/sendr" as const

export function buildGrowthPersonalizedVideosWorkspaceHref(suffix = ""): string {
  if (!suffix) return GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH
  const normalized = suffix.startsWith("/") ? suffix.slice(1) : suffix
  return `${GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH}/${normalized}`
}

export function buildGrowthPersonalizedVideosPageDetailPath(pageId: string): string {
  return `${GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH}/${pageId}`
}

/** Preferred sequence merge token — show this in all operator UI. */
export const GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN = "{{video_page_url}}" as const

/** Legacy merge token — resolved at send time; do not promote in UI. */
export const GROWTH_LEGACY_SENDR_PAGE_URL_MERGE_TOKEN = "{{sendr_page_url}}" as const

export const GROWTH_PERSONALIZED_VIDEOS_BRANDING_QA_MARKER =
  "growth-personalized-videos-branding-v1" as const

/** Operator-facing labels for launch preview sample variable keys. */
export function formatGrowthVideoPageSampleVariableKey(key: string): string {
  if (key === "sendr_page_url") return "video_page_url"
  return key
}
