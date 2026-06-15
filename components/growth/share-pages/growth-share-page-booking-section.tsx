"use client"

import { CalendarDays, ExternalLink } from "lucide-react"
import type { GrowthSharePageRenderModel } from "@/lib/growth/share-pages/share-page-types"

export function GrowthSharePageBookingSection({
  model,
  onBookingStart,
}: {
  model: GrowthSharePageRenderModel
  onBookingStart?: () => void
}) {
  const booking = model.booking
  if (!booking) return null

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Schedule time
          </h2>
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{booking.name}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Pick a time that works for you. Booking requires your action — nothing is scheduled automatically.
          </p>
        </div>
        <CalendarDays className="size-5 shrink-0 text-[var(--share-brand-color)]" aria-hidden />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {booking.disabled ? (
          <span className="inline-flex items-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-400 dark:border-slate-700">
            Booking preview only
          </span>
        ) : (
          <a
            href={booking.bookingUrl}
            onClick={() => onBookingStart?.()}
            className="inline-flex items-center rounded-full bg-[var(--share-brand-color)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Open scheduler
            <ExternalLink className="ml-2 size-4" aria-hidden />
          </a>
        )}
      </div>

      {!booking.disabled ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <iframe
            title={`Book ${booking.name}`}
            src={booking.embedUrl}
            className="h-[720px] w-full bg-white"
            loading="lazy"
          />
        </div>
      ) : null}
    </section>
  )
}
