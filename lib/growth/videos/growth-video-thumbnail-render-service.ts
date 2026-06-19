/** Growth Engine B3 — Deterministic thumbnail/OG SVG rendering (client-safe). */

import {
  DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE,
} from "@/lib/growth/media/media-video-thumbnail-types"
import type {
  GrowthVideoThumbnailLayout,
  GrowthVideoThumbnailRenderResult,
  GrowthVideoThumbnailType,
} from "@/lib/growth/videos/growth-video-types"

export const GROWTH_VIDEO_THUMBNAIL_DIMENSIONS = {
  thumbnail: { width: 640, height: 360 },
  open_graph: { width: 1200, height: 630 },
} as const

export const GROWTH_VIDEO_THUMBNAIL_DEFAULT_MIME = DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function pickMergeValue(mergeValues: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const normalized = key.toLowerCase()
    const value = mergeValues[normalized] ?? mergeValues[key]
    if (value?.trim()) return value.trim()
  }
  return ""
}

export function buildGrowthVideoThumbnailLayout(input: {
  type: GrowthVideoThumbnailType
  mergeValues: Record<string, string>
  ctaLabel?: string | null
  pageTitle?: string | null
}): GrowthVideoThumbnailLayout {
  const firstName = pickMergeValue(input.mergeValues, "first_name", "lead.first_name")
  const fullName = pickMergeValue(input.mergeValues, "full_name", "lead.contact_name", "first_name")
  const company = pickMergeValue(input.mergeValues, "company", "lead.company_name") || "[company]"
  const industry = pickMergeValue(input.mergeValues, "industry", "lead.industry") || "Industry"
  const title = pickMergeValue(input.mergeValues, "title", "lead.title")
  const ctaText =
    input.ctaLabel?.trim() ||
    pickMergeValue(input.mergeValues, "cta_url", "lead.cta_url") ||
    "Watch Video"

  switch (input.type) {
    case "company":
      return {
        headline: company,
        subheadline: title || input.pageTitle?.trim() || "Personalized video outreach",
        badge: industry,
        ctaText,
      }
    case "cta":
      return {
        headline: ctaText,
        subheadline: company,
        badge: "Call to action",
        ctaText,
      }
    case "open_graph":
    case "prospect":
    default: {
      const contactLabel = firstName || fullName || "there"
      return {
        headline: `A quick video for ${contactLabel}`,
        subheadline: company,
        badge: industry,
        ctaText,
      }
    }
  }
}

export function renderGrowthVideoThumbnailSvg(input: {
  type: GrowthVideoThumbnailType
  mergeValues: Record<string, string>
  primaryColor?: string | null
  ctaLabel?: string | null
  pageTitle?: string | null
  dimensions?: { width: number; height: number }
}): GrowthVideoThumbnailRenderResult {
  const dimensions =
    input.dimensions ??
    (input.type === "open_graph"
      ? GROWTH_VIDEO_THUMBNAIL_DIMENSIONS.open_graph
      : GROWTH_VIDEO_THUMBNAIL_DIMENSIONS.thumbnail)

  const layout = buildGrowthVideoThumbnailLayout({
    type: input.type,
    mergeValues: input.mergeValues,
    ctaLabel: input.ctaLabel,
    pageTitle: input.pageTitle,
  })

  const primary = input.primaryColor?.trim() || "#2563eb"
  const { width, height } = dimensions
  const headlineSize = input.type === "open_graph" ? 48 : 32
  const subSize = input.type === "open_graph" ? 28 : 22

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="${escapeXml(primary)}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <text x="48" y="72" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="20" opacity="0.85">🎥</text>
  <text x="48" y="${height * 0.42}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="${headlineSize}" font-weight="700">${escapeXml(layout.headline)}</text>
  <text x="48" y="${height * 0.42 + headlineSize + 16}" fill="#e2e8f0" font-family="Inter, Arial, sans-serif" font-size="${subSize}">${escapeXml(layout.subheadline)}</text>
  <rect x="48" y="${height - 96}" rx="18" ry="18" width="${Math.min(width - 96, 280)}" height="44" fill="${escapeXml(primary)}" opacity="0.95"/>
  <text x="68" y="${height - 66}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="600">${escapeXml(layout.ctaText)}</text>
  <rect x="${width - 220}" y="48" rx="12" ry="12" width="172" height="36" fill="#ffffff" opacity="0.12"/>
  <text x="${width - 204}" y="72" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="14">${escapeXml(layout.badge)}</text>
</svg>`

  return {
    type: input.type,
    layout,
    mergeValues: input.mergeValues,
    svg,
    width,
    height,
  }
}

export function computeGrowthVideoThumbnailScore(input: {
  mergeValues: Record<string, string>
  requiredKeys?: string[]
}): number {
  const keys =
    input.requiredKeys ??
    ["first_name", "company", "industry", "lead.contact_name", "lead.company_name", "lead.industry"]
  if (keys.length === 0) return 100
  const resolved = keys.filter((key) => {
    const value = input.mergeValues[key.toLowerCase()] ?? input.mergeValues[key]
    return Boolean(value?.trim()) && !value.startsWith("[")
  }).length
  return Math.round((resolved / keys.length) * 100)
}

export function growthVideoThumbnailSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
