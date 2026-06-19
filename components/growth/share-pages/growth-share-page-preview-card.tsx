"use client"

import { cn } from "@/lib/utils"
import { sharePageThemeStyle } from "@/components/growth/share-pages/share-page-theme-utils"

export type GrowthSharePagePreviewModel = {
  logoUrl: string
  heroImageUrl: string
  headline: string
  introCopy: string
  ctaText: string
  ctaUrl: string
  calendarUrl: string
  footerText: string
  primaryColor: string
  accentColor: string
  recipientName: string
  companyName: string
}

export function GrowthSharePagePreviewCard({
  model,
  className,
  id,
}: {
  model: GrowthSharePagePreviewModel
  className?: string
  id?: string
}) {
  const primaryColor = model.primaryColor.trim() || "#059669"
  const accentColor = model.accentColor.trim() || primaryColor
  const themeStyle = sharePageThemeStyle({
    brandColor: primaryColor,
    accentColor,
    logoUrl: model.logoUrl.trim() || null,
    heroImageUrl: model.heroImageUrl.trim() || null,
    publicThemeMode: "system",
    footerNote: model.footerText.trim() || null,
  })

  return (
    <div
      id={id}
      className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}
      aria-label="Live share page preview"
    >
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium text-foreground">Live Share Page Preview</p>
        <p className="text-xs text-muted-foreground">Visual only — updates as you edit.</p>
      </div>

      <div className="bg-background p-4 sm:p-5" style={themeStyle}>
        <header className="mb-4 flex items-center gap-3">
          {model.logoUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={model.logoUrl.trim()} alt="" className="h-8 w-auto max-w-[140px] object-contain" />
          ) : (
            <div className="text-xs font-semibold tracking-wide text-muted-foreground">Your logo</div>
          )}
        </header>

        {model.heroImageUrl.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={model.heroImageUrl.trim()}
            alt=""
            className="mb-4 aspect-[21/9] w-full rounded-xl border border-border object-cover"
          />
        ) : (
          <div className="mb-4 flex aspect-[21/9] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
            Hero image preview
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-lg font-semibold tracking-tight text-foreground">
            {model.headline.trim() || `Hi ${model.recipientName || "there"}`}
          </h4>
          <p className="text-sm text-muted-foreground">
            {model.introCopy.trim() ||
              "Intro copy will appear here as you personalize the share page for your recipient."}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {model.ctaText.trim() ? (
            <span
              className="inline-flex items-center rounded-full px-4 py-2 text-xs font-medium text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {model.ctaText}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-dashed border-border px-4 py-2 text-xs text-muted-foreground">
              Primary CTA
            </span>
          )}
          {model.calendarUrl.trim() ? (
            <span
              className="inline-flex items-center rounded-full border px-4 py-2 text-xs font-medium"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              Book a meeting
            </span>
          ) : null}
        </div>

        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          {model.footerText.trim() ||
            `${model.companyName || "Your company"} · Personalized for ${model.recipientName || "your prospect"}`}
        </p>
      </div>
    </div>
  )
}
