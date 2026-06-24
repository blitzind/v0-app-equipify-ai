"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBuilderColorField } from "@/components/growth/builder/growth-builder-color-field"
import { GrowthMediaPicker } from "@/components/growth/media-library/growth-media-picker"
import {
  GROWTH_SHARE_PAGE_OPERATOR_DEFAULT_THEME,
  parseSharePageExtendedTheme,
} from "@/lib/growth/share-pages/share-page-types"
import type { GrowthSharePageTheme } from "@/lib/growth/share-pages/share-page-types"

type Props = {
  theme: GrowthSharePageTheme
  footerText: string
  heroImageUrl: string
  disabled?: boolean
  onThemeChange: (theme: GrowthSharePageTheme) => void
  onFooterTextChange: (value: string) => void
  onHeroImageUrlChange: (value: string) => void
}

export function GrowthSharePageBrandingFields({
  theme,
  footerText,
  heroImageUrl,
  disabled,
  onThemeChange,
  onFooterTextChange,
  onHeroImageUrlChange,
}: Props) {
  const defaults = GROWTH_SHARE_PAGE_OPERATOR_DEFAULT_THEME

  function update(patch: Partial<GrowthSharePageTheme>) {
    onThemeChange(parseSharePageExtendedTheme({ ...theme, ...patch }))
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Saved with your share page — applies to live preview and published public pages at /p/[token].
      </p>

      <GrowthMediaPicker
        label="Logo"
        value={theme.logoUrl ?? ""}
        disabled={disabled}
        acceptedTypes={["logo", "image"]}
        allowManualUrl
        onChange={(url) => update({ logoUrl: url || null })}
      />

      <GrowthMediaPicker
        label="Hero image"
        value={heroImageUrl}
        disabled={disabled}
        acceptedTypes={["image"]}
        allowManualUrl
        onChange={(url) => onHeroImageUrlChange(url)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <GrowthBuilderColorField
          id="headerBackground"
          label="Header background"
          value={theme.headerBackground ?? defaults.headerBackground}
          disabled={disabled}
          onChange={(headerBackground) => update({ headerBackground })}
        />
        <GrowthBuilderColorField
          id="headerText"
          label="Header text"
          value={theme.headerText ?? defaults.headerText}
          disabled={disabled}
          onChange={(headerText) => update({ headerText })}
        />
        <GrowthBuilderColorField
          id="pageBackground"
          label="Page background"
          value={theme.pageBackground ?? defaults.pageBackground}
          disabled={disabled}
          onChange={(pageBackground) => update({ pageBackground })}
        />
        <GrowthBuilderColorField
          id="pageText"
          label="Page text"
          value={theme.pageText ?? defaults.pageText}
          disabled={disabled}
          onChange={(pageText) => update({ pageText })}
        />
        <GrowthBuilderColorField
          id="surfaceColor"
          label="Surface / card color"
          value={theme.surfaceColor ?? defaults.surfaceColor}
          disabled={disabled}
          onChange={(surfaceColor) => update({ surfaceColor })}
        />
        <GrowthBuilderColorField
          id="accentColor"
          label="Accent color"
          value={theme.accentColor}
          disabled={disabled}
          onChange={(accentColor) => update({ accentColor, brandColor: accentColor })}
        />
        <GrowthBuilderColorField
          id="buttonBackground"
          label="Button background"
          value={theme.buttonBackground ?? defaults.buttonBackground}
          disabled={disabled}
          onChange={(buttonBackground) => update({ buttonBackground })}
        />
        <GrowthBuilderColorField
          id="buttonText"
          label="Button text"
          value={theme.buttonText ?? defaults.buttonText}
          disabled={disabled}
          onChange={(buttonText) => update({ buttonText })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="footerText">Footer text</Label>
        <Input
          id="footerText"
          value={footerText}
          disabled={disabled}
          onChange={(e) => onFooterTextChange(e.target.value)}
          placeholder="Personalized share page · Secure viewing"
        />
      </div>
    </div>
  )
}
