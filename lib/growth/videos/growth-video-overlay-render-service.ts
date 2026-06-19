/** Growth Engine B2 — Overlay preview rendering (client-safe, reuses S2-E overlay utils). */

import type { CSSProperties } from "react"
import type { GrowthMediaVideoOverlayItem, GrowthMediaVideoOverlaySpec } from "@/lib/growth/media/media-video-overlay-types"
import {
  createDefaultVideoOverlayStyle,
  createDefaultVideoOverlayTiming,
  normalizeVideoOverlaySpec,
  resolveVideoOverlayItems,
} from "@/lib/growth/media/media-video-overlay-utils"
import {
  GROWTH_VIDEO_OVERLAY_B2_POSITIONS,
  GROWTH_VIDEO_OVERLAY_B2_TYPES,
  type GrowthVideoOverlayB2Config,
  type GrowthVideoOverlayB2Item,
  type GrowthVideoOverlayB2Position,
  type GrowthVideoOverlayB2Style,
  type GrowthVideoOverlayB2Type,
  type GrowthVideoOverlayResolvedPreviewItem,
} from "@/lib/growth/videos/growth-video-types"

export const GROWTH_VIDEO_OVERLAY_B2_METADATA_KEY = "growth_video_overlays_b2"

const DEFAULT_B2_TEMPLATES: Record<GrowthVideoOverlayB2Type, string> = {
  intro_banner: "A quick video for {{first_name}}",
  company_badge: "{{company}} · {{industry}}",
  cta_overlay: "Book a demo",
  calendar_overlay: "Schedule a time that works for you",
  lower_third: "{{sender.name}} from {{sender.company}}",
}

const DEFAULT_B2_POSITIONS: Record<GrowthVideoOverlayB2Type, GrowthVideoOverlayB2Position> = {
  intro_banner: "top",
  company_badge: "top",
  cta_overlay: "bottom",
  calendar_overlay: "bottom",
  lower_third: "lower_third",
}

const B2_TO_MEDIA_TYPE: Record<
  GrowthVideoOverlayB2Type,
  GrowthMediaVideoOverlayItem["type"]
> = {
  intro_banner: "intro_title",
  company_badge: "badge",
  cta_overlay: "cta",
  calendar_overlay: "text",
  lower_third: "lower_third",
}

const B2_TO_MEDIA_POSITION: Record<GrowthVideoOverlayB2Position, GrowthMediaVideoOverlayItem["position"]> =
  {
    top: "top_center",
    bottom: "bottom_center",
    lower_third: "lower_third",
    center: "center",
  }

function newOverlayId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `overlay-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeStyle(style: GrowthVideoOverlayB2Style | undefined): GrowthVideoOverlayB2Style {
  return {
    backgroundColor: style?.backgroundColor?.trim() || "#0f172a",
    textColor: style?.textColor?.trim() || "#ffffff",
    accentColor: style?.accentColor?.trim() || null,
    opacity: typeof style?.opacity === "number" ? Math.min(1, Math.max(0, style.opacity)) : 0.72,
  }
}

export function createDefaultGrowthVideoOverlayItem(
  type: GrowthVideoOverlayB2Type,
): GrowthVideoOverlayB2Item {
  return {
    id: newOverlayId(),
    type,
    enabled: true,
    textTemplate: DEFAULT_B2_TEMPLATES[type],
    position: DEFAULT_B2_POSITIONS[type],
    style: normalizeStyle(undefined),
  }
}

export function normalizeGrowthVideoOverlayConfig(
  config: GrowthVideoOverlayB2Config | null | undefined,
): GrowthVideoOverlayB2Config {
  const items = Array.isArray(config?.items) ? config.items : []
  return {
    enabled: config?.enabled === true,
    branding: config?.branding ?? undefined,
    items: items.map((item) => ({
      id: item.id?.trim() || newOverlayId(),
      type: (GROWTH_VIDEO_OVERLAY_B2_TYPES as readonly string[]).includes(item.type)
        ? item.type
        : "intro_banner",
      enabled: item.enabled !== false,
      textTemplate:
        item.textTemplate?.trim() || DEFAULT_B2_TEMPLATES[(item.type as GrowthVideoOverlayB2Type) ?? "intro_banner"],
      position: (GROWTH_VIDEO_OVERLAY_B2_POSITIONS as readonly string[]).includes(item.position)
        ? item.position
        : DEFAULT_B2_POSITIONS.intro_banner,
      style: normalizeStyle(item.style),
    })),
  }
}

function growthVideoOverlayStyleToMedia(
  style: GrowthVideoOverlayB2Style,
  accentColor?: string | null,
): GrowthMediaVideoOverlayItem["style"] {
  const defaults = createDefaultVideoOverlayStyle()
  return {
    ...defaults,
    textColor: style.textColor ?? defaults.textColor,
    backgroundColor: style.backgroundColor ?? accentColor ?? defaults.backgroundColor,
    backgroundOpacity: style.opacity ?? defaults.backgroundOpacity,
  }
}

export function growthVideoOverlayB2ToMediaSpec(
  config: GrowthVideoOverlayB2Config,
  accentColor?: string | null,
): GrowthMediaVideoOverlaySpec {
  const normalized = normalizeGrowthVideoOverlayConfig(config)
  return normalizeVideoOverlaySpec({
    overlays: normalized.items.map((item, index) => ({
      id: item.id,
      type: B2_TO_MEDIA_TYPE[item.type],
      enabled: normalized.enabled && item.enabled,
      textTemplate: item.textTemplate,
      mergeFieldsUsed: [],
      position: B2_TO_MEDIA_POSITION[item.position],
      timing: createDefaultVideoOverlayTiming(),
      style: growthVideoOverlayStyleToMedia(item.style, accentColor),
      zIndex: index + 10,
      fallbackText: "Personalized message",
    })),
  })
}

export function resolveGrowthVideoOverlayPreviewItems(input: {
  config: GrowthVideoOverlayB2Config
  mergeValues: Record<string, string>
  accentColor?: string | null
}): GrowthVideoOverlayResolvedPreviewItem[] {
  const normalized = normalizeGrowthVideoOverlayConfig(input.config)
  if (!normalized.enabled) return []

  const mediaSpec = growthVideoOverlayB2ToMediaSpec(normalized, input.accentColor)
  const resolved = resolveVideoOverlayItems(mediaSpec, input.mergeValues, 0)
  const itemById = new Map(normalized.items.map((item) => [item.id, item]))

  return resolved.map((overlay) => {
    const source = itemById.get(overlay.id)
    return {
      id: overlay.id,
      type: source?.type ?? "intro_banner",
      position: source?.position ?? "center",
      resolvedText: overlay.resolvedText,
      usedFallback: overlay.usedFallback,
      style: source?.style ?? normalizeStyle(undefined),
    }
  })
}

export function growthVideoOverlayB2PositionClass(position: GrowthVideoOverlayB2Position): string {
  switch (position) {
    case "top":
      return "top-4 left-1/2 -translate-x-1/2"
    case "bottom":
      return "bottom-4 left-1/2 -translate-x-1/2"
    case "lower_third":
      return "bottom-8 left-4 right-4"
    case "center":
    default:
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
  }
}

export function growthVideoOverlayB2InlineStyle(style: GrowthVideoOverlayB2Style): CSSProperties {
  const opacity = style.opacity ?? 0.72
  const background = style.backgroundColor ?? "#0f172a"
  const hexOpacity =
    background.startsWith("#") && background.length === 7
      ? `${background}${Math.round(opacity * 255)
          .toString(16)
          .padStart(2, "0")}`
      : background
  return {
    color: style.textColor ?? "#ffffff",
    backgroundColor: hexOpacity,
    borderRadius: "8px",
    padding: "8px 12px",
    maxWidth: "90%",
  }
}
