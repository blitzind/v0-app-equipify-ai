"use client"

import type { GrowthSharePageCTA, GrowthSharePageRenderModel } from "@/lib/growth/share-pages/share-page-types"
import { cn } from "@/lib/utils"

type CtaClickHandler = (cta: GrowthSharePageCTA, input?: { bookingStarted?: boolean }) => void

function renderCtaContent(cta: GrowthSharePageCTA) {
  return cta.label
}

export function GrowthSharePageCtaSection({
  model,
  onCtaClick,
}: {
  model: GrowthSharePageRenderModel
  onCtaClick?: CtaClickHandler
}) {
  if (model.ctaConfig.length === 0) return null

  const booking = model.booking

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        Suggested next step
      </h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {model.ctaConfig.map((cta) => {
          const isBookMeeting = cta.action === "book_meeting"
          const bookingUrl = isBookMeeting && booking ? booking.bookingUrl : null
          const className = cn(
            "inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium transition",
            cta.kind === "primary"
              ? "text-[var(--share-button-text)] bg-[var(--share-button-bg)]"
              : cta.kind === "secondary"
                ? "border border-[var(--share-accent-color)] text-[var(--share-accent-color)]"
                : "text-[var(--share-brand-color)] underline decoration-[var(--share-brand-color)]/40",
            booking?.disabled && isBookMeeting ? "cursor-not-allowed opacity-60" : "",
          )

          const handleClick = () => {
            if (booking?.disabled && isBookMeeting) return
            onCtaClick?.(cta, { bookingStarted: isBookMeeting && Boolean(bookingUrl) })
          }

          if (bookingUrl && !booking.disabled) {
            return (
              <a
                key={cta.id}
                href={bookingUrl}
                aria-label={cta.label}
                onClick={handleClick}
                className={className}
              >
                {renderCtaContent(cta)}
              </a>
            )
          }

          return (
            <button
              key={cta.id}
              type="button"
              aria-label={cta.label}
              disabled={booking?.disabled && isBookMeeting}
              onClick={handleClick}
              className={className}
            >
              {renderCtaContent(cta)}
            </button>
          )
        })}
      </div>
      {model.previewMode && booking ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Booking links are preview-only and disabled until the page is published.
        </p>
      ) : null}
    </section>
  )
}
