"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthMediaPicker } from "@/components/growth/media-library/growth-media-picker"
import type { GrowthSharePageTemplateEditorMetadata } from "@/lib/growth/share-pages/share-page-template-editor-utils"
import {
  GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES,
} from "@/lib/growth/share-pages/share-page-template-types"
import type { GrowthSharePageTheme } from "@/lib/growth/share-pages/share-page-types"
import { GROWTH_SHARE_PAGE_PUBLIC_THEME_MODES } from "@/lib/growth/share-pages/share-page-types"

export function GrowthSharePageTemplateSettingsPanel({
  metadata,
  theme,
  tagsInput,
  onMetadataChange,
  onThemeChange,
  onTagsInputChange,
  disabled,
}: {
  metadata: GrowthSharePageTemplateEditorMetadata
  theme: GrowthSharePageTheme
  tagsInput: string
  onMetadataChange: (metadata: GrowthSharePageTemplateEditorMetadata) => void
  onThemeChange: (theme: GrowthSharePageTheme) => void
  onTagsInputChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <GrowthEngineCard className="space-y-5 p-4">
      <div>
        <h3 className="text-sm font-semibold">Template metadata</h3>
        <p className="mt-1 text-xs text-muted-foreground">Library details and preview theming.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Name</Label>
        <Input
          value={metadata.name}
          disabled={disabled}
          onChange={(e) => onMetadataChange({ ...metadata, name: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={metadata.description}
          disabled={disabled}
          rows={3}
          onChange={(e) => onMetadataChange({ ...metadata, description: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Category</Label>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={metadata.category}
          disabled={disabled}
          onChange={(e) => onMetadataChange({ ...metadata, category: e.target.value })}
        >
          {GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tags</Label>
        <Input
          value={tagsInput}
          disabled={disabled}
          placeholder="outbound, hvac, follow-up"
          onChange={(e) => onTagsInputChange(e.target.value)}
        />
      </div>

      <GrowthMediaPicker
        label="Preview image"
        value={metadata.previewImageUrl ?? ""}
        disabled={disabled}
        acceptedTypes={["image", "hero"]}
        allowManualUrl
        onChange={(url) => onMetadataChange({ ...metadata, previewImageUrl: url || null })}
      />

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked disabled readOnly />
        Requires human review before publish
      </label>

      <div className="border-t border-border pt-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Theme</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Brand color</Label>
            <Input
              value={theme.brandColor}
              disabled={disabled}
              onChange={(e) => onThemeChange({ ...theme, brandColor: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Accent color</Label>
            <Input
              value={theme.accentColor}
              disabled={disabled}
              onChange={(e) => onThemeChange({ ...theme, accentColor: e.target.value })}
            />
          </div>
        </div>
        <GrowthMediaPicker
          label="Logo"
          value={theme.logoUrl ?? ""}
          disabled={disabled}
          acceptedTypes={["logo", "image"]}
          allowManualUrl
          onChange={(url) => onThemeChange({ ...theme, logoUrl: url || null })}
        />
        <GrowthMediaPicker
          label="Hero image"
          value={theme.heroImageUrl ?? ""}
          disabled={disabled}
          acceptedTypes={["hero", "image"]}
          allowManualUrl
          onChange={(url) => onThemeChange({ ...theme, heroImageUrl: url || null })}
        />
        <div className="space-y-1.5">
          <Label className="text-xs">Public theme mode</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={theme.publicThemeMode}
            disabled={disabled}
            onChange={(e) =>
              onThemeChange({
                ...theme,
                publicThemeMode: e.target.value as GrowthSharePageTheme["publicThemeMode"],
              })
            }
          >
            {GROWTH_SHARE_PAGE_PUBLIC_THEME_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Footer note</Label>
          <Input
            value={theme.footerNote ?? ""}
            disabled={disabled}
            onChange={(e) => onThemeChange({ ...theme, footerNote: e.target.value || null })}
          />
        </div>
      </div>
    </GrowthEngineCard>
  )
}
