"use client"

import type { ReactNode } from "react"
import { Check, Clock3, Globe2, Lock, Shield, Sparkles, Star, Video } from "lucide-react"
import { formatTimezoneLabel } from "@/lib/growth/booking/booking-public-timezone"
import type { GrowthBookingPagePublicView } from "@/lib/growth/booking/booking-page-types"
import { cn } from "@/lib/utils"

const DEFAULT_FEATURE_CHIPS = ["Dispatch", "Scheduling", "Equipment Tracking", "Customer Portal", "AI Operations"]

type PublicBookingBrandPanelProps = {
  page: GrowthBookingPagePublicView
  displayTimezone: string
  pageTimezone: string
  className?: string
}

export function PublicBookingBrandPanel({ page, displayTimezone, pageTimezone, className }: PublicBookingBrandPanelProps) {
  const accentColor = page.accentColor ?? page.brandColor ?? "#2563eb"
  const brandColor = page.brandColor ?? accentColor

  return (
    <div
      className={cn(
        "relative flex min-h-full flex-col overflow-hidden text-white",
        "bg-[linear-gradient(165deg,#0b1120_0%,#111827_45%,#0f172a_100%)]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 top-0 size-64 rounded-full blur-3xl"
        style={{ backgroundColor: `${accentColor}33` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 size-72 rounded-full blur-3xl"
        style={{ backgroundColor: `${brandColor}28` }}
        aria-hidden
      />

      {page.heroImageUrl ? (
        <div className="relative h-36 w-full shrink-0 lg:h-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={page.heroImageUrl} alt="" className="h-full w-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1120] via-[#0b1120]/60 to-transparent" />
        </div>
      ) : null}

      <div className="relative flex flex-1 flex-col gap-6 p-6 sm:p-8 lg:p-10">
        <div className="space-y-4">
          {page.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.logoUrl} alt="" className="max-h-11 w-auto max-w-[200px] object-contain brightness-110" />
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles className="size-6" style={{ color: accentColor }} />
              <span className="text-lg font-bold tracking-tight">Equipify.ai</span>
            </div>
          )}

          <span
            className="inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
          >
            {page.brandName ?? "Equipment Service Platform"}
          </span>

          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-[2rem] lg:text-[2.125rem]">{page.pageTitle}</h1>
            {page.description ? (
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300 sm:text-[0.9375rem]">{page.description}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <div className="flex gap-0.5 text-amber-400">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className="size-4 fill-current" />
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-200">
            Equipify helps service companies streamline operations, improve visibility, and scale smarter.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {DEFAULT_FEATURE_CHIPS.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200"
            >
              <Check className="size-3.5 shrink-0" style={{ color: accentColor }} />
              {chip}
            </span>
          ))}
        </div>

        <dl className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
          <MetadataRow icon={<Clock3 className="size-4" />} label="Duration" value={`${page.durationMinutes} minutes`} accent={accentColor} />
          <MetadataRow
            icon={<Globe2 className="size-4" />}
            label="Your timezone"
            value={formatTimezoneLabel(displayTimezone)}
            hint={displayTimezone !== pageTimezone ? `Host: ${formatTimezoneLabel(pageTimezone)}` : undefined}
            accent={accentColor}
          />
          <MetadataRow icon={<Video className="size-4" />} label="Location" value={page.locationLabel} accent={accentColor} />
        </dl>

        <div className="mt-auto space-y-3 border-t border-white/10 pt-5 text-xs text-slate-400">
          <p className="inline-flex items-center gap-2">
            <Shield className="size-3.5" style={{ color: accentColor }} />
            Secure scheduling · Your information is never shared
          </p>
          <p className="inline-flex items-center gap-2">
            <Lock className="size-3.5" />
            Powered by Equipify.ai
          </p>
          {page.footerNote ? <p className="leading-relaxed text-slate-500">{page.footerNote}</p> : null}
        </div>
      </div>
    </div>
  )
}

function MetadataRow({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  accent: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10"
        style={{ backgroundColor: `${accent}18`, color: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-white">{value}</dd>
        {hint ? <dd className="text-xs text-slate-400">{hint}</dd> : null}
      </div>
    </div>
  )
}
