/** Growth Engine A3 — Video page validation (client-safe). */

import {
  GROWTH_VIDEO_PAGE_EVENT_TYPES,
  GROWTH_VIDEO_PAGE_STATUSES,
  type GrowthVideoPageBranding,
  type GrowthVideoPagePersonalization,
} from "@/lib/growth/videos/growth-video-types"

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_SLUG_LENGTH = 80
const MAX_TITLE_LENGTH = 240
const MAX_DESCRIPTION_LENGTH = 4000
const MAX_URL_LENGTH = 2048
const MAX_LABEL_LENGTH = 120

export function normalizeGrowthVideoPageSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
}

export function assertGrowthVideoPageSlug(slug: string): string {
  const normalized = normalizeGrowthVideoPageSlug(slug)
  if (!normalized || normalized.length < 3) {
    throw new Error("invalid_slug")
  }
  if (!SLUG_PATTERN.test(normalized)) {
    throw new Error("invalid_slug")
  }
  return normalized
}

export function slugFromGrowthVideoPageTitle(title: string): string {
  return assertGrowthVideoPageSlug(title)
}

export function assertGrowthVideoPageStatus(status: string): (typeof GROWTH_VIDEO_PAGE_STATUSES)[number] {
  if (!(GROWTH_VIDEO_PAGE_STATUSES as readonly string[]).includes(status)) {
    throw new Error("invalid_status")
  }
  return status as (typeof GROWTH_VIDEO_PAGE_STATUSES)[number]
}

export function assertGrowthVideoPageEventType(
  eventType: string,
): (typeof GROWTH_VIDEO_PAGE_EVENT_TYPES)[number] {
  if (!(GROWTH_VIDEO_PAGE_EVENT_TYPES as readonly string[]).includes(eventType)) {
    throw new Error("invalid_event_type")
  }
  return eventType as (typeof GROWTH_VIDEO_PAGE_EVENT_TYPES)[number]
}

export function sanitizeGrowthVideoPageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim().slice(0, MAX_URL_LENGTH)
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("invalid_url")
  }
  return trimmed
}

export function sanitizeGrowthVideoPageLabel(label: string | null | undefined): string | null {
  if (!label?.trim()) return null
  return label.trim().slice(0, MAX_LABEL_LENGTH)
}

export function sanitizeGrowthVideoPageTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) throw new Error("invalid_title")
  return trimmed.slice(0, MAX_TITLE_LENGTH)
}

export function sanitizeGrowthVideoPageDescription(description: string | null | undefined): string | null {
  if (!description?.trim()) return null
  return description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
}

export function parseGrowthVideoPageBranding(
  value: unknown,
): GrowthVideoPageBranding {
  if (!value || typeof value !== "object") return {}
  const row = value as Record<string, unknown>
  return {
    logoUrl:
      typeof row.logoUrl === "string" && row.logoUrl.trim()
        ? row.logoUrl.trim().slice(0, MAX_URL_LENGTH)
        : null,
    primaryColor:
      typeof row.primaryColor === "string" && row.primaryColor.trim()
        ? row.primaryColor.trim().slice(0, 32)
        : null,
    buttonLabelOverride: sanitizeGrowthVideoPageLabel(
      typeof row.buttonLabelOverride === "string" ? row.buttonLabelOverride : null,
    ),
  }
}

export function parseGrowthVideoPagePersonalization(
  value: unknown,
): GrowthVideoPagePersonalization {
  if (!value || typeof value !== "object") return {}
  const row = value as Record<string, unknown>
  const variables =
    row.variables && typeof row.variables === "object"
      ? Object.fromEntries(
          Object.entries(row.variables as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [k.slice(0, 64), (v as string).slice(0, 500)]),
        )
      : undefined
  const mergeFields = Array.isArray(row.mergeFields)
    ? row.mergeFields
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim().slice(0, 64))
        .filter(Boolean)
    : undefined
  const previewContext =
    row.previewContext && typeof row.previewContext === "object"
      ? Object.fromEntries(
          Object.entries(row.previewContext as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [k.slice(0, 64), (v as string).slice(0, 500)]),
        )
      : undefined
  return { variables, mergeFields, previewContext }
}

export function buildGrowthVideoPublicPath(slug: string): string {
  return `/v/${encodeURIComponent(slug)}`
}
