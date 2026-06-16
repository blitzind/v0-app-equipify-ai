"use client"

import { useMemo } from "react"
import {
  extractContentMergeFields,
  isBlockedContentVariable,
} from "@/lib/growth/content/merge-field-validator"
import type {
  GrowthMediaVideoOverlayItem,
  GrowthMediaVideoOverlaySpec,
  GrowthMediaVideoOverlayType,
} from "@/lib/growth/media/media-video-overlay-types"
import {
  GROWTH_MEDIA_VIDEO_OVERLAY_TYPES,
  GROWTH_MEDIA_VIDEO_OVERLAY_POSITIONS,
  GROWTH_MEDIA_VIDEO_OVERLAY_FONT_WEIGHTS,
  GROWTH_MEDIA_VIDEO_OVERLAY_ALIGNMENTS,
} from "@/lib/growth/media/media-video-overlay-types"
import {
  addVideoOverlayToSpec,
  buildVideoOverlayAllowedMergeKeys,
  normalizeVideoOverlaySpec,
  removeVideoOverlayFromSpec,
  reorderVideoOverlays,
  updateVideoOverlayInSpec,
  validateVideoOverlaySpec,
} from "@/lib/growth/media/media-video-overlay-utils"
import { GrowthMediaVideoOverlayPreview } from "@/components/growth/media/growth-media-video-overlay-preview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

function OverlayMergeHints({ text, allowedKeys }: { text: string; allowedKeys: Set<string> }) {
  const fields = useMemo(() => extractContentMergeFields(text), [text])
  const blocked = fields.filter(isBlockedContentVariable)
  const unknown = fields.filter((key) => !isBlockedContentVariable(key) && !allowedKeys.has(key))
  if (fields.length === 0) return null
  return (
    <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px]">
      <p className="font-medium">Merge fields</p>
      <p className="mt-1 text-muted-foreground">{fields.join(", ")}</p>
      {blocked.length > 0 ? <p className="mt-1 text-rose-600">Blocked: {blocked.join(", ")}</p> : null}
      {unknown.length > 0 ? (
        <p className="mt-1 text-amber-700 dark:text-amber-300">Unknown: {unknown.join(", ")}</p>
      ) : null}
    </div>
  )
}

function OverlayEditor({
  overlay,
  disabled,
  allowedKeys,
  onChange,
}: {
  overlay: GrowthMediaVideoOverlayItem
  disabled?: boolean
  allowedKeys: Set<string>
  onChange: (next: GrowthMediaVideoOverlayItem) => void
}) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs capitalize">{overlay.type.replace(/_/g, " ")}</Label>
        <label className="ml-auto flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={overlay.enabled}
            disabled={disabled}
            onChange={(e) => onChange({ ...overlay, enabled: e.target.checked })}
          />
          Enabled
        </label>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Text template</Label>
        <Textarea
          value={overlay.textTemplate}
          disabled={disabled}
          rows={2}
          onChange={(e) => onChange({ ...overlay, textTemplate: e.target.value })}
        />
        <OverlayMergeHints text={overlay.textTemplate} allowedKeys={allowedKeys} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Fallback text</Label>
          <Input
            value={overlay.fallbackText}
            disabled={disabled}
            onChange={(e) => onChange({ ...overlay, fallbackText: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Position</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
            value={overlay.position}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...overlay, position: e.target.value as GrowthMediaVideoOverlayItem["position"] })
            }
          >
            {GROWTH_MEDIA_VIDEO_OVERLAY_POSITIONS.map((position) => (
              <option key={position} value={position}>
                {position.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={overlay.timing.alwaysVisible}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...overlay,
                timing: { ...overlay.timing, alwaysVisible: e.target.checked },
              })
            }
          />
          Always visible
        </label>
        <div className="space-y-1">
          <Label className="text-xs">Start (s)</Label>
          <Input
            type="number"
            min={0}
            value={overlay.timing.startSeconds ?? ""}
            disabled={disabled || overlay.timing.alwaysVisible}
            onChange={(e) =>
              onChange({
                ...overlay,
                timing: {
                  ...overlay.timing,
                  startSeconds: e.target.value === "" ? null : Number(e.target.value),
                },
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End (s)</Label>
          <Input
            type="number"
            min={0}
            value={overlay.timing.endSeconds ?? ""}
            disabled={disabled || overlay.timing.alwaysVisible}
            onChange={(e) =>
              onChange({
                ...overlay,
                timing: {
                  ...overlay.timing,
                  endSeconds: e.target.value === "" ? null : Number(e.target.value),
                },
              })
            }
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Font size</Label>
          <Input
            type="number"
            min={10}
            value={overlay.style.fontSize ?? ""}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...overlay,
                style: { ...overlay.style, fontSize: e.target.value === "" ? null : Number(e.target.value) },
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Font weight</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
            value={overlay.style.fontWeight ?? "semibold"}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...overlay,
                style: {
                  ...overlay.style,
                  fontWeight: e.target.value as GrowthMediaVideoOverlayItem["style"]["fontWeight"],
                },
              })
            }
          >
            {GROWTH_MEDIA_VIDEO_OVERLAY_FONT_WEIGHTS.map((weight) => (
              <option key={weight} value={weight}>
                {weight}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Alignment</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
            value={overlay.style.alignment ?? "center"}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...overlay,
                style: {
                  ...overlay.style,
                  alignment: e.target.value as GrowthMediaVideoOverlayItem["style"]["alignment"],
                },
              })
            }
          >
            {GROWTH_MEDIA_VIDEO_OVERLAY_ALIGNMENTS.map((alignment) => (
              <option key={alignment} value={alignment}>
                {alignment}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Text color</Label>
          <Input
            value={overlay.style.textColor ?? ""}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...overlay, style: { ...overlay.style, textColor: e.target.value || null } })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Background color</Label>
          <Input
            value={overlay.style.backgroundColor ?? ""}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...overlay, style: { ...overlay.style, backgroundColor: e.target.value || null } })
            }
          />
        </div>
      </div>
    </div>
  )
}

export function GrowthMediaVideoOverlayBuilder({
  overlaySpec,
  mergeValues,
  thumbnailPreviewUrl,
  layout = "wide",
  disabled,
  onChange,
}: {
  overlaySpec: GrowthMediaVideoOverlaySpec | null | undefined
  mergeValues: Record<string, string>
  thumbnailPreviewUrl?: string | null
  layout?: "wide" | "compact"
  disabled?: boolean
  onChange: (next: GrowthMediaVideoOverlaySpec) => void
}) {
  const spec = normalizeVideoOverlaySpec(overlaySpec)
  const allowedKeys = useMemo(
    () => buildVideoOverlayAllowedMergeKeys(mergeValues),
    [mergeValues],
  )
  const validation = useMemo(
    () => validateVideoOverlaySpec({ spec, allowedMergeKeys: allowedKeys }),
    [spec, allowedKeys],
  )

  const updateSpec = (next: GrowthMediaVideoOverlaySpec) => {
    onChange(normalizeVideoOverlaySpec(next))
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <div>
        <p className="text-sm font-medium">Personalized overlays (S2-E)</p>
        <p className="text-xs text-muted-foreground">
          Merge-field overlay specs only — no rendering, playback, or analytics.
        </p>
      </div>

      <GrowthMediaVideoOverlayPreview
        overlaySpec={spec}
        mergeValues={mergeValues}
        thumbnailPreviewUrl={thumbnailPreviewUrl}
        layout={layout}
      />

      {validation.warnings.length > 0 || validation.blockedVariables.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50/80 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          {validation.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          {validation.blockedVariables.length > 0 ? (
            <p>Blocked merge fields: {validation.blockedVariables.join(", ")}</p>
          ) : null}
          {validation.unknownVariables.length > 0 ? (
            <p>Unknown merge fields: {validation.unknownVariables.join(", ")}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        {spec.overlays.map((overlay, index) => (
          <div key={overlay.id} className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || index === 0}
                onClick={() =>
                  updateSpec({
                    ...spec,
                    overlays: reorderVideoOverlays(spec.overlays, index, index - 1),
                  })
                }
              >
                Move up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || index === spec.overlays.length - 1}
                onClick={() =>
                  updateSpec({
                    ...spec,
                    overlays: reorderVideoOverlays(spec.overlays, index, index + 1),
                  })
                }
              >
                Move down
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => updateSpec(removeVideoOverlayFromSpec(spec, overlay.id))}
              >
                Remove
              </Button>
            </div>
            <OverlayEditor
              overlay={overlay}
              disabled={disabled}
              allowedKeys={allowedKeys}
              onChange={(next) => updateSpec(updateVideoOverlayInSpec(spec, overlay.id, () => next))}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {GROWTH_MEDIA_VIDEO_OVERLAY_TYPES.map((type) => (
          <Button
            key={type}
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => updateSpec(addVideoOverlayToSpec(spec, type as GrowthMediaVideoOverlayType))}
          >
            Add {type.replace(/_/g, " ")}
          </Button>
        ))}
      </div>
    </div>
  )
}
