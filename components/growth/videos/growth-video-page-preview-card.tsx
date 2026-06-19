"use client"

import { Film, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { buildGrowthVideoPublicPath } from "@/lib/growth/videos/growth-video-page-validation"

export type GrowthVideoPagePreviewModel = {
  title: string
  description: string
  slug: string
  ctaLabel: string
  ctaUrl: string
  calendarUrl: string
  logoUrl: string
  primaryColor: string
  accentColor: string
  buttonLabelOverride: string
  footerText: string
  videoTitle?: string | null
}

function resolveCtaLabel(model: GrowthVideoPagePreviewModel): string {
  return model.buttonLabelOverride.trim() || model.ctaLabel.trim() || "Book a demo"
}

export function GrowthVideoPagePreviewCard({
  model,
  className,
  id,
}: {
  model: GrowthVideoPagePreviewModel
  className?: string
  id?: string
}) {
  const primaryColor = model.primaryColor.trim() || "#2563eb"
  const accentColor = model.accentColor.trim() || primaryColor
  const ctaLabel = resolveCtaLabel(model)
  const showCta = Boolean(model.ctaUrl.trim())
  const showCalendar = Boolean(model.calendarUrl.trim())
  const slugPreview = model.slug.trim()
  const publicPath = slugPreview.length >= 3 ? buildGrowthVideoPublicPath(slugPreview) : null

  return (
    <div
      id={id}
      className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}
      aria-label="Live page preview"
    >
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium text-foreground">Live Page Preview</p>
        <p className="text-xs text-muted-foreground">Visual only — updates as you edit.</p>
      </div>

      <div className="bg-gradient-to-b from-slate-950 to-slate-900 p-4 text-white sm:p-5">
        <header className="mb-4 flex items-center gap-3">
          {model.logoUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={model.logoUrl.trim()} alt="" className="h-8 w-auto max-w-[140px] object-contain" />
          ) : (
            <div className="text-xs font-semibold tracking-wide text-slate-300">Equipify</div>
          )}
        </header>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg">
          <div className="relative aspect-video bg-black">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
              <div
                className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/5"
                style={{ color: accentColor }}
              >
                <Play className="size-5 fill-current" aria-hidden />
              </div>
              <p className="text-xs text-slate-400">
                {model.videoTitle?.trim() ? model.videoTitle : "Video thumbnail preview"}
              </p>
            </div>
            <Film className="absolute right-3 top-3 size-4 text-white/30" aria-hidden />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <h4 className="text-lg font-semibold tracking-tight">
            {model.title.trim() || "Page title"}
          </h4>
          {model.description.trim() ? (
            <p className="text-sm text-slate-300">{model.description}</p>
          ) : (
            <p className="text-sm text-slate-500">Add a description to preview copy here.</p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {showCta ? (
            <span
              className="inline-flex items-center rounded-full px-4 py-2 text-xs font-medium text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {ctaLabel}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-dashed border-white/20 px-4 py-2 text-xs text-slate-500">
              CTA button
            </span>
          )}
          {showCalendar ? (
            <span className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-xs font-medium text-white">
              Schedule a meeting
            </span>
          ) : null}
        </div>

        {model.footerText.trim() ? (
          <p className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-400">{model.footerText}</p>
        ) : (
          <p className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-600">Footer text</p>
        )}
      </div>

      {publicPath ? (
        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          Public path: <span className="font-mono text-foreground">{publicPath}</span>
        </div>
      ) : null}
    </div>
  )
}
