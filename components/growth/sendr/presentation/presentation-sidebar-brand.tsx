"use client"

import { CalendarDays, Clock, Globe, MessageCircle, Sparkles, Star, Video, Zap } from "lucide-react"
import type { GrowthSendrPublicPagePayload } from "@/lib/growth/sendr/growth-sendr-types"
import { GROWTH_SENDR_PRESENTATION_FEATURE_BADGES } from "@/lib/growth/sendr/growth-sendr-presentation-config"
import { PresentationCtaButton } from "@/components/growth/sendr/presentation/presentation-cta-button"
import { usePresentationTheme } from "@/components/growth/sendr/presentation/presentation-section"
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
  const theme = usePresentationTheme()
  const accent = theme.accentColor ?? "#2563eb"
  const headline = hero?.headline ?? pageTitle
  const body = hero?.body
  const pill = resolvePersonalizationPill(hero, personalized)
  const trustLine = hero?.trustLine ?? "Trusted by service businesses nationwide."

  return (
    <aside
      className={cn(
        "relative flex flex-col border-b lg:min-h-[720px] lg:border-b-0 lg:border-r",
        className,
      )}
      style={{
        backgroundColor: "var(--sendr-header-bg)",
        color: "var(--sendr-header-text)",
        borderColor: "color-mix(in srgb, var(--sendr-header-text) 12%, transparent)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at top left, color-mix(in srgb, var(--sendr-accent) 22%, transparent), transparent 55%)`,
        }}
      />

      <div className="relative flex flex-1 flex-col gap-7 p-6 sm:p-8 lg:gap-8 lg:p-10 xl:p-12">
        <div className="space-y-5">
          <div className="flex items-center gap-2.5">
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt="" className="h-8 max-w-[180px] object-contain" />
            ) : (
              <>
                <Sparkles className="size-6" style={{ color: accent }} />
                <span className="text-lg font-bold tracking-tight">Equipify.ai</span>
              </>
            )}
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
              <p
                className="max-w-md text-base leading-relaxed sm:text-[1.0625rem] whitespace-pre-wrap"
                style={{ color: "color-mix(in srgb, var(--sendr-header-text) 75%, transparent)" }}
              >
                {body}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="rounded-2xl border p-5 backdrop-blur-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--sendr-header-text) 12%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--sendr-header-text) 6%, transparent)",
          }}
        >
          <div className="flex gap-0.5 text-amber-400">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className="size-4 fill-current" />
            ))}
          </div>
          <p
            className="mt-3 text-sm leading-relaxed sm:text-[0.9375rem]"
            style={{ color: "color-mix(in srgb, var(--sendr-header-text) 85%, transparent)" }}
          >
            {trustLine}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {GROWTH_SENDR_PRESENTATION_FEATURE_BADGES.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor: "color-mix(in srgb, var(--sendr-header-text) 12%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--sendr-header-text) 6%, transparent)",
                color: "color-mix(in srgb, var(--sendr-header-text) 85%, transparent)",
              }}
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
          <div
            className="mt-auto rounded-2xl border p-5"
            style={{
              borderColor: "color-mix(in srgb, var(--sendr-header-text) 12%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--sendr-header-bg) 70%, black)",
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ color: "color-mix(in srgb, var(--sendr-header-text) 55%, transparent)" }}
            >
              Meeting information
            </p>
            <ul
              className="mt-4 space-y-3 text-sm"
              style={{ color: "color-mix(in srgb, var(--sendr-header-text) 85%, transparent)" }}
            >
              {booking.durationMinutes ? (
                <li className="flex items-center gap-2.5">
                  <Clock className="size-4 shrink-0 opacity-60" />
                  {booking.durationMinutes}-minute walkthrough
                </li>
              ) : null}
              {booking.meetingLink ? (
                <li className="flex items-center gap-2.5">
                  <Video className="size-4 shrink-0 opacity-60" />
                  Google Meet
                </li>
              ) : null}
              <li className="flex items-center gap-2.5">
                <MessageCircle className="size-4 shrink-0 opacity-60" />
                Live Q&amp;A
              </li>
              <li className="flex items-center gap-2.5">
                <CalendarDays className="size-4 shrink-0 opacity-60" />
                No commitment required
              </li>
              {booking.timezone ? (
                <li className="flex items-center gap-2.5">
                  <Globe className="size-4 shrink-0 opacity-60" />
                  {booking.timezone}
                </li>
              ) : null}
              {booking.meetingType ? (
                <li className="flex items-center gap-2.5 opacity-70">
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
