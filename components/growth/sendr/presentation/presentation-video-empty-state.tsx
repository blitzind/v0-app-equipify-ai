"use client"

import { Play, Sparkles } from "lucide-react"
import { PresentationCard } from "@/components/growth/sendr/presentation/presentation-card"
import { PresentationCtaButton } from "@/components/growth/sendr/presentation/presentation-cta-button"
import { GROWTH_SENDR_PRESENTATION_ACCENT } from "@/lib/growth/sendr/growth-sendr-presentation-config"
import { cn } from "@/lib/utils"

type Props = {
  personalized?: boolean
  bookingHref?: string | null
  bookingLabel?: string
  onBookingClick?: () => void
  className?: string
}

export function PresentationVideoEmptyState({
  personalized = false,
  bookingHref,
  bookingLabel = "Schedule a demo",
  onBookingClick,
  className,
}: Props) {
  const accent = GROWTH_SENDR_PRESENTATION_ACCENT

  return (
    <PresentationCard
      variant="elevated"
      className={cn("overflow-hidden p-0", className)}
      data-qa-marker="growth-sendr-presentation-video-empty-v1"
    >
      <div className="border-b border-slate-200/80 px-5 py-5 dark:border-slate-800 sm:px-8 sm:py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
          Personalized video
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
          Your personalized video will appear here
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
          {personalized
            ? "We are preparing a custom walkthrough designed specifically for your business. Check back shortly — or schedule time with our team now."
            : "We are preparing a custom walkthrough designed specifically for your business. When it is ready, you will see it right here."}
        </p>
      </div>

      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-14 sm:px-10 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(circle at 30% 20%, ${accent}33, transparent 55%)`,
          }}
        />
        <div className="relative mx-auto flex max-w-md flex-col items-center text-center">
          <div className="relative mb-6">
            <span className="absolute -inset-3 rounded-full bg-blue-500/10 blur-xl" />
            <span
              className="relative flex size-20 items-center justify-center rounded-full border border-white/15 bg-white/5 shadow-[0_8px_32px_rgb(0,0,0,0.35)]"
              style={{ boxShadow: `0 8px 40px ${accent}22` }}
            >
              <Play className="size-9 text-white" fill="currentColor" />
            </span>
          </div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            <Sparkles className="size-3.5" style={{ color: accent }} />
            Preparing your experience
          </div>
          <p className="text-sm leading-relaxed text-slate-300">
            A tailored video walkthrough is being prepared for your team.
          </p>
          {bookingHref ? (
            <div className="mt-8 w-full max-w-sm">
              <p className="mb-3 text-xs text-slate-400">
                Schedule a demo while we prepare your personalized video.
              </p>
              <PresentationCtaButton
                href={bookingHref}
                onClick={onBookingClick}
                variant="ghost"
                size="large"
                fullWidth
              >
                {bookingLabel}
              </PresentationCtaButton>
            </div>
          ) : null}
        </div>
      </div>
    </PresentationCard>
  )
}
