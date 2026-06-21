"use client"

import { CalendarDays, Clock, Globe, MessageCircle, Sparkles, Star, Video, Zap } from "lucide-react"
import type { GrowthSendrPublicPagePayload } from "@/lib/growth/sendr/growth-sendr-types"
import {
  GROWTH_SENDR_PRESENTATION_ACCENT,
  GROWTH_SENDR_PRESENTATION_FEATURE_BADGES,
} from "@/lib/growth/sendr/growth-sendr-presentation-config"
import { PresentationCtaButton } from "@/components/growth/sendr/presentation/presentation-cta-button"
import { cn } from "@/lib/utils"

type HeroContent = {
  headline?: string
  body?: string
  personalizationLabel?: string
  trustLine?: string
}

type PrimaryCta = {
  label: string
  href: string
  onClick?: () => void
}

type Props = {
  pageTitle: string
  hero?: HeroContent
  booking: GrowthSendrPublicPagePayload["booking"]
  primaryCta?: PrimaryCta | null
  personalized?: boolean
  className?: string
}

function resolvePersonalizationPill(hero: HeroContent | undefined, personalized: boolean): string | null {
  if (hero?.personalizationLabel) return hero.personalizationLabel
  if (!personalized) return "Personalized video experience"
  const headline = hero?.headline ?? ""
  const forMatch = headline.match(/\bfor\s+(.+?)(?:[.!?]|$)/i)
  if (forMatch?.[1]) return `Personalized for ${forMatch[1].trim()}`
  return "Personalized for you"
}

export function PresentationSidebarBrand({
  pageTitle,
  hero,
  booking,
  primaryCta,
  personalized = false,
  className,
}: Props) {
  const accent = GROWTH_SENDR_PRESENTATION_ACCENT
  const headline = hero?.headline ?? pageTitle
  const body = hero?.body
  const pill = resolvePersonalizationPill(hero, personalized)
  const trustLine = hero?.trustLine ?? "Trusted by service businesses nationwide."

  return (
    <aside
      className={cn(
        "relative flex flex-col border-b border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white lg:min-h-[720px] lg:border-b-0 lg:border-r dark:border-slate-800",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.22),transparent_55%)]" />

      <div className="relative flex flex-1 flex-col gap-7 p-6 sm:p-8 lg:gap-8 lg:p-10 xl:p-12">
        <div className="space-y-5">
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-6" style={{ color: accent }} />
            <span className="text-lg font-bold tracking-tight">Equipify.ai</span>
          </div>

          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ backgroundColor: `${accent}22`, color: accent }}
          >
            <Zap className="size-3.5" />
            {pill}
          </span>

          <div className="space-y-4">
            <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight sm:text-[2.35rem] lg:text-[2.5rem]">
              {headline}
            </h1>
            {body ? (
              <p className="max-w-md text-base leading-relaxed text-slate-300 sm:text-[1.0625rem] whitespace-pre-wrap">
                {body}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="flex gap-0.5 text-amber-400">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className="size-4 fill-current" />
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-200 sm:text-[0.9375rem]">{trustLine}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {GROWTH_SENDR_PRESENTATION_FEATURE_BADGES.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200"
            >
              {tag}
            </span>
          ))}
        </div>

        {primaryCta ? (
          <div className="pt-1 lg:hidden">
            <PresentationCtaButton
              href={primaryCta.href}
              onClick={primaryCta.onClick}
              variant="ghost"
              size="large"
              fullWidth
            >
              {primaryCta.label}
            </PresentationCtaButton>
          </div>
        ) : null}

        {booking ? (
          <div className="mt-auto rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Meeting information</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-200">
              {booking.durationMinutes ? (
                <li className="flex items-center gap-2.5">
                  <Clock className="size-4 shrink-0 text-slate-400" />
                  {booking.durationMinutes}-minute walkthrough
                </li>
              ) : null}
              {booking.meetingLink ? (
                <li className="flex items-center gap-2.5">
                  <Video className="size-4 shrink-0 text-slate-400" />
                  Google Meet
                </li>
              ) : null}
              <li className="flex items-center gap-2.5">
                <MessageCircle className="size-4 shrink-0 text-slate-400" />
                Live Q&amp;A
              </li>
              <li className="flex items-center gap-2.5">
                <CalendarDays className="size-4 shrink-0 text-slate-400" />
                No commitment required
              </li>
              {booking.timezone ? (
                <li className="flex items-center gap-2.5">
                  <Globe className="size-4 shrink-0 text-slate-400" />
                  {booking.timezone}
                </li>
              ) : null}
              {booking.meetingType ? (
                <li className="flex items-center gap-2.5 text-slate-400">
                  <span className="size-4 shrink-0" />
                  {booking.meetingType}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
