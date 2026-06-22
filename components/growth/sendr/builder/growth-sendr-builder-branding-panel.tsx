"use client"

import { useEffect, useState } from "react"
import { Loader2, Palette, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { GrowthSendrLandingPage } from "@/lib/growth/sendr/growth-sendr-types"
import {
  GROWTH_SENDR_DEFAULT_PAGE_THEME,
  parseGrowthSendrPageTheme,
  type GrowthSendrPageTheme,
} from "@/lib/growth/sendr/growth-sendr-config"

function initialThemeFromPage(page: GrowthSendrLandingPage): GrowthSendrPageTheme {
  const raw = page.mobileMetadata.theme
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return parseGrowthSendrPageTheme(raw, GROWTH_SENDR_DEFAULT_PAGE_THEME)
  }
  return { ...GROWTH_SENDR_DEFAULT_PAGE_THEME, logoUrl: null, footerText: null }
}

type Props = {
  page: GrowthSendrLandingPage
  disabled?: boolean
  onSaved: () => void
  onMessage: (message: string | null) => void
}

function ColorField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-md border border-border bg-background p-1"
          aria-label={`Pick ${label}`}
        />
        <Input id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}

export function GrowthSendrBuilderBrandingPanel({ page, disabled, onSaved, onMessage }: Props) {
  const [theme, setTheme] = useState<GrowthSendrPageTheme>(() => initialThemeFromPage(page))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setTheme(initialThemeFromPage(page))
  }, [page.id, page.mobileMetadata.theme])

  function updateTheme(patch: Partial<GrowthSendrPageTheme>) {
    setTheme((current) => ({ ...current, ...patch }))
  }

  async function saveTheme() {
    setBusy(true)
    onMessage(null)
    try {
      const res = await fetch("/api/platform/growth/sendr/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          landingPageId: page.id,
          mobileMetadata: {
            theme: parseGrowthSendrPageTheme(theme),
          },
        }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!res.ok) {
        onMessage(data.message ?? "Failed to save theme")
        return
      }
      onMessage("Theme saved — preview and published pages will use these colors.")
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  function resetDefaults() {
    setTheme({ ...GROWTH_SENDR_DEFAULT_PAGE_THEME, logoUrl: null, footerText: null })
  }

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Palette className="size-4" />
          Branding & theme
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Saved to this page — applies to live preview and published public pages. Use a dark header with a light page
          body when your logo needs contrast.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            value={theme.logoUrl ?? ""}
            disabled={disabled || busy}
            onChange={(e) => updateTheme({ logoUrl: e.target.value || null })}
            placeholder="https://"
          />
          {theme.logoUrl ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={theme.logoUrl} alt="" className="h-8 max-w-[160px] object-contain" />
              <span className="text-xs text-muted-foreground">Logo preview</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            id="headerBackground"
            label="Header / sidebar background"
            value={theme.headerBackground ?? GROWTH_SENDR_DEFAULT_PAGE_THEME.headerBackground}
            disabled={disabled || busy}
            onChange={(headerBackground) => updateTheme({ headerBackground })}
          />
          <ColorField
            id="headerText"
            label="Header / sidebar text"
            value={theme.headerText ?? GROWTH_SENDR_DEFAULT_PAGE_THEME.headerText}
            disabled={disabled || busy}
            onChange={(headerText) => updateTheme({ headerText })}
          />
          <ColorField
            id="pageBackground"
            label="Page background"
            value={theme.pageBackground ?? GROWTH_SENDR_DEFAULT_PAGE_THEME.pageBackground}
            disabled={disabled || busy}
            onChange={(pageBackground) => updateTheme({ pageBackground })}
          />
          <ColorField
            id="pageText"
            label="Page text"
            value={theme.pageText ?? GROWTH_SENDR_DEFAULT_PAGE_THEME.pageText}
            disabled={disabled || busy}
            onChange={(pageText) => updateTheme({ pageText })}
          />
          <ColorField
            id="surfaceColor"
            label="Card / surface color"
            value={theme.surfaceColor ?? GROWTH_SENDR_DEFAULT_PAGE_THEME.surfaceColor}
            disabled={disabled || busy}
            onChange={(surfaceColor) => updateTheme({ surfaceColor })}
          />
          <ColorField
            id="accentColor"
            label="Accent color"
            value={theme.accentColor ?? GROWTH_SENDR_DEFAULT_PAGE_THEME.accentColor}
            disabled={disabled || busy}
            onChange={(accentColor) => updateTheme({ accentColor })}
          />
          <ColorField
            id="buttonBackground"
            label="Button background"
            value={theme.buttonBackground ?? GROWTH_SENDR_DEFAULT_PAGE_THEME.buttonBackground}
            disabled={disabled || busy}
            onChange={(buttonBackground) => updateTheme({ buttonBackground })}
          />
          <ColorField
            id="buttonText"
            label="Button text"
            value={theme.buttonText ?? GROWTH_SENDR_DEFAULT_PAGE_THEME.buttonText}
            disabled={disabled || busy}
            onChange={(buttonText) => updateTheme({ buttonText })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="footerText">Footer text</Label>
          <Input
            id="footerText"
            value={theme.footerText ?? ""}
            disabled={disabled || busy}
            onChange={(e) => updateTheme({ footerText: e.target.value || null })}
            placeholder="Personalized video experience · Secure viewing"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={disabled || busy} onClick={() => void saveTheme()}>
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
            Save theme
          </Button>
          <Button type="button" variant="outline" disabled={disabled || busy} onClick={resetDefaults}>
            Reset defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
