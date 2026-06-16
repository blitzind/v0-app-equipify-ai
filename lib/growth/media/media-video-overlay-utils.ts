/** Growth Engine S2-E — overlay spec validation, merge resolution, and preview helpers (client-safe). */

import {
  extractContentMergeFields,
  validateContentMergeFields,
} from "@/lib/growth/content/merge-field-validator"
import { applySharePageTemplateMergeFields } from "@/lib/growth/share-pages/share-page-template-instantiation-compile"
import {
  GROWTH_MEDIA_VIDEO_OVERLAY_POSITIONS,
  GROWTH_MEDIA_VIDEO_OVERLAY_QA_MARKER,
  GROWTH_MEDIA_VIDEO_OVERLAY_STANDARD_MERGE_KEYS,
  GROWTH_MEDIA_VIDEO_OVERLAY_TYPES,
  type GrowthMediaVideoOverlayItem,
  type GrowthMediaVideoOverlayPosition,
  type GrowthMediaVideoOverlayResolvedItem,
  type GrowthMediaVideoOverlaySpec,
  type GrowthMediaVideoOverlayStyle,
  type GrowthMediaVideoOverlayTiming,
  type GrowthMediaVideoOverlayType,
} from "@/lib/growth/media/media-video-overlay-types"

function newOverlayId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `overlay-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const DEFAULT_OVERLAY_TEXT: Record<GrowthMediaVideoOverlayType, string> = {
  text: "Hi {{prospect.name}}",
  cta: "Book with {{sender.name}}",
  badge: "{{company.name}}",
  lower_third: "{{prospect.name}} · {{company.name}}",
  intro_title: "A note for {{prospect.name}}",
}

const DEFAULT_OVERLAY_POSITION: Record<GrowthMediaVideoOverlayType, GrowthMediaVideoOverlayPosition> = {
  text: "center",
  cta: "bottom_center",
  badge: "top_right",
  lower_third: "lower_third",
  intro_title: "center",
}

export function createDefaultVideoOverlayTiming(): GrowthMediaVideoOverlayTiming {
  return {
    startSeconds: null,
    endSeconds: null,
    alwaysVisible: true,
    fadeInMs: 250,
    fadeOutMs: 250,
  }
}

export function createDefaultVideoOverlayStyle(): GrowthMediaVideoOverlayStyle {
  return {
    fontSize: 14,
    fontWeight: "semibold",
    alignment: "center",
    textColor: "#ffffff",
    backgroundColor: "#0f172a",
    backgroundOpacity: 0.72,
    borderRadius: 8,
    padding: 8,
    maxWidth: 80,
  }
}

export function createDefaultVideoOverlay(type: GrowthMediaVideoOverlayType): GrowthMediaVideoOverlayItem {
  const textTemplate = DEFAULT_OVERLAY_TEXT[type]
  return {
    id: newOverlayId(),
    type,
    enabled: true,
    textTemplate,
    mergeFieldsUsed: extractContentMergeFields(textTemplate),
    position: DEFAULT_OVERLAY_POSITION[type],
    timing: createDefaultVideoOverlayTiming(),
    style: createDefaultVideoOverlayStyle(),
    zIndex: 10,
    fallbackText: "Personalized message",
  }
}

export function createDefaultVideoOverlaySpec(): GrowthMediaVideoOverlaySpec {
  return {
    overlays: [],
    qaMarker: GROWTH_MEDIA_VIDEO_OVERLAY_QA_MARKER,
  }
}

export function normalizeVideoOverlaySpec(
  spec: GrowthMediaVideoOverlaySpec | null | undefined,
): GrowthMediaVideoOverlaySpec {
  const overlays = Array.isArray(spec?.overlays) ? spec.overlays : []
  return {
    overlays: overlays.map((overlay, index) => ({
      ...overlay,
      id: overlay.id?.trim() || newOverlayId(),
      type: (GROWTH_MEDIA_VIDEO_OVERLAY_TYPES as readonly string[]).includes(overlay.type)
        ? overlay.type
        : "text",
      enabled: overlay.enabled !== false,
      textTemplate: overlay.textTemplate ?? "",
      mergeFieldsUsed: extractContentMergeFields(overlay.textTemplate ?? ""),
      position: (GROWTH_MEDIA_VIDEO_OVERLAY_POSITIONS as readonly string[]).includes(overlay.position)
        ? overlay.position
        : "center",
      timing: {
        ...createDefaultVideoOverlayTiming(),
        ...overlay.timing,
      },
      style: {
        ...createDefaultVideoOverlayStyle(),
        ...overlay.style,
      },
      zIndex: Number.isFinite(overlay.zIndex) ? overlay.zIndex : index + 10,
      fallbackText: overlay.fallbackText?.trim() || "Personalized message",
    })),
    qaMarker: spec?.qaMarker ?? GROWTH_MEDIA_VIDEO_OVERLAY_QA_MARKER,
  }
}

export function buildVideoOverlayAllowedMergeKeys(
  customMergeValues: Record<string, string> = {},
): Set<string> {
  const keys = new Set<string>([
    ...GROWTH_MEDIA_VIDEO_OVERLAY_STANDARD_MERGE_KEYS,
    ...Object.keys(customMergeValues),
  ])
  return keys
}

export function extractVideoOverlayMergeFields(spec: GrowthMediaVideoOverlaySpec | null | undefined): string[] {
  const keys = new Set<string>()
  for (const overlay of normalizeVideoOverlaySpec(spec).overlays) {
    for (const key of extractContentMergeFields(overlay.textTemplate)) {
      keys.add(key)
    }
  }
  return [...keys]
}

export function validateVideoOverlaySpec(input: {
  spec: GrowthMediaVideoOverlaySpec | null | undefined
  allowedMergeKeys?: Set<string>
}): {
  valid: boolean
  overlayCount: number
  warnings: string[]
  blockedVariables: string[]
  unknownVariables: string[]
} {
  const spec = normalizeVideoOverlaySpec(input.spec)
  const allowedKeys = input.allowedMergeKeys ?? buildVideoOverlayAllowedMergeKeys()
  const warnings: string[] = []
  const blockedVariables = new Set<string>()
  const unknownVariables = new Set<string>()

  for (const overlay of spec.overlays) {
    if (!(GROWTH_MEDIA_VIDEO_OVERLAY_TYPES as readonly string[]).includes(overlay.type)) {
      warnings.push(`Overlay ${overlay.id} has invalid type.`)
    }
    if (!(GROWTH_MEDIA_VIDEO_OVERLAY_POSITIONS as readonly string[]).includes(overlay.position)) {
      warnings.push(`Overlay ${overlay.id} has invalid position.`)
    }
    if (!overlay.textTemplate.trim() && !overlay.fallbackText.trim()) {
      warnings.push(`Overlay ${overlay.id} has empty text template and fallback.`)
    }
    if (
      !overlay.timing.alwaysVisible &&
      overlay.timing.startSeconds != null &&
      overlay.timing.endSeconds != null &&
      overlay.timing.endSeconds < overlay.timing.startSeconds
    ) {
      warnings.push(`Overlay ${overlay.id} end time precedes start time.`)
    }

    const mergeValidation = validateContentMergeFields({
      text: overlay.textTemplate,
      allowedKeys,
    })
    for (const key of mergeValidation.blockedVariables) blockedVariables.add(key)
    for (const key of mergeValidation.unknownVariables) unknownVariables.add(key)
  }

  return {
    valid: warnings.length === 0 && blockedVariables.size === 0 && unknownVariables.size === 0,
    overlayCount: spec.overlays.length,
    warnings,
    blockedVariables: [...blockedVariables],
    unknownVariables: [...unknownVariables],
  }
}

export function resolveVideoOverlayDisplayText(
  overlay: GrowthMediaVideoOverlayItem,
  mergeValues: Record<string, string>,
): { text: string; usedFallback: boolean } {
  const merged = applySharePageTemplateMergeFields(overlay.textTemplate, mergeValues).trim()
  if (merged && !/\{\{/.test(merged)) {
    return { text: merged, usedFallback: false }
  }
  const fallback = overlay.fallbackText.trim()
  if (fallback) return { text: fallback, usedFallback: true }
  return { text: overlay.textTemplate.trim() || "Overlay", usedFallback: true }
}

export function resolveVideoOverlayItems(
  spec: GrowthMediaVideoOverlaySpec | null | undefined,
  mergeValues: Record<string, string>,
  previewSeconds = 0,
): GrowthMediaVideoOverlayResolvedItem[] {
  return getVideoOverlaysVisibleAtPreview(spec, previewSeconds)
    .map((overlay) => {
      const resolved = resolveVideoOverlayDisplayText(overlay, mergeValues)
      return {
        ...overlay,
        resolvedText: resolved.text,
        usedFallback: resolved.usedFallback,
      }
    })
    .sort((a, b) => a.zIndex - b.zIndex)
}

export function getVideoOverlaysVisibleAtPreview(
  spec: GrowthMediaVideoOverlaySpec | null | undefined,
  previewSeconds = 0,
): GrowthMediaVideoOverlayItem[] {
  return normalizeVideoOverlaySpec(spec).overlays.filter((overlay) => {
    if (!overlay.enabled) return false
    if (overlay.timing.alwaysVisible) return true
    const start = overlay.timing.startSeconds ?? 0
    const end = overlay.timing.endSeconds
    if (end == null) return previewSeconds >= start
    return previewSeconds >= start && previewSeconds <= end
  })
}

export function reorderVideoOverlays(
  overlays: GrowthMediaVideoOverlayItem[],
  fromIndex: number,
  toIndex: number,
): GrowthMediaVideoOverlayItem[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return overlays
  if (fromIndex >= overlays.length || toIndex >= overlays.length) return overlays
  const next = [...overlays]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next.map((overlay, index) => ({ ...overlay, zIndex: index + 10 }))
}

export function updateVideoOverlayInSpec(
  spec: GrowthMediaVideoOverlaySpec,
  overlayId: string,
  updater: (overlay: GrowthMediaVideoOverlayItem) => GrowthMediaVideoOverlayItem,
): GrowthMediaVideoOverlaySpec {
  return {
    ...spec,
    overlays: spec.overlays.map((overlay) => {
      if (overlay.id !== overlayId) return overlay
      const next = updater(overlay)
      return {
        ...next,
        mergeFieldsUsed: extractContentMergeFields(next.textTemplate),
      }
    }),
  }
}

export function removeVideoOverlayFromSpec(
  spec: GrowthMediaVideoOverlaySpec,
  overlayId: string,
): GrowthMediaVideoOverlaySpec {
  return {
    ...spec,
    overlays: spec.overlays.filter((overlay) => overlay.id !== overlayId),
  }
}

export function addVideoOverlayToSpec(
  spec: GrowthMediaVideoOverlaySpec,
  type: GrowthMediaVideoOverlayType,
): GrowthMediaVideoOverlaySpec {
  const overlay = createDefaultVideoOverlay(type)
  overlay.zIndex = spec.overlays.length + 10
  return {
    ...spec,
    overlays: [...spec.overlays, overlay],
  }
}

export const GROWTH_MEDIA_VIDEO_OVERLAY_POSITION_CLASSES: Record<
  GrowthMediaVideoOverlayPosition,
  string
> = {
  top_left: "top-2 left-2",
  top_center: "top-2 left-1/2 -translate-x-1/2",
  top_right: "top-2 right-2",
  center_left: "top-1/2 left-2 -translate-y-1/2",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  center_right: "top-1/2 right-2 -translate-y-1/2",
  bottom_left: "bottom-2 left-2",
  bottom_center: "bottom-2 left-1/2 -translate-x-1/2",
  bottom_right: "bottom-2 right-2",
  lower_third: "bottom-8 left-4 right-4",
}
