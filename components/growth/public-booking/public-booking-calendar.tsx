"use client"

import type { CSSProperties } from "react"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

type PublicBookingCalendarProps = {
  accentColor: string
  month: Date
  onMonthChange: (month: Date) => void
  selected?: Date
  onSelect: (date: Date | undefined) => void
  disabled: (date: Date) => boolean
  available: (date: Date) => boolean
  startMonth?: Date
  endMonth?: Date
}

export function PublicBookingCalendar({
  accentColor,
  month,
  onMonthChange,
  selected,
  onSelect,
  disabled,
  available,
  startMonth,
  endMonth,
}: PublicBookingCalendarProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-7",
        "dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-[0_8px_40px_rgb(0,0,0,0.35)]",
      )}
      style={{ "--booking-accent": accentColor } as CSSProperties}
    >
      <Calendar
        mode="single"
        month={month}
        onMonthChange={onMonthChange}
        selected={selected}
        onSelect={onSelect}
        disabled={disabled}
        startMonth={startMonth}
        endMonth={endMonth}
        modifiers={{ available, today: (date) => calendarDateKey(date) === calendarDateKey(today) }}
        modifiersClassNames={{
          available:
            "[&>button]:relative [&>button]:font-semibold [&>button]:transition-all [&>button]:duration-200 [&>button]:hover:-translate-y-0.5 [&>button]:hover:shadow-md motion-reduce:[&>button]:hover:translate-y-0 [&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2 [&>button]:after:size-1.5 [&>button]:after:-translate-x-1/2 [&>button]:after:rounded-full [&>button]:after:bg-[var(--booking-accent)] [&>button]:after:content-['']",
          selected:
            "[&>button]:!bg-gradient-to-br [&>button]:!from-[var(--booking-accent)] [&>button]:!to-[color-mix(in_srgb,var(--booking-accent)_70%,#1e3a8a)] [&>button]:!text-white [&>button]:!shadow-lg [&>button]:!ring-2 [&>button]:!ring-[color-mix(in_srgb,var(--booking-accent)_35%,white)] [&>button]:after:hidden",
          today:
            "[&>button]:ring-2 [&>button]:ring-[color-mix(in_srgb,var(--booking-accent)_25%,transparent)] [&>button]:ring-offset-2 [&>button]:ring-offset-background",
        }}
        className={cn(
          "w-full max-w-none [--cell-size:3.25rem] sm:[--cell-size:3.75rem] md:[--cell-size:4rem]",
          "[&_.rdp-month]:w-full",
          "[&_.rdp-month_caption]:mb-4",
          "[&_.rdp-caption_label]:text-lg [&_.rdp-caption_label]:font-semibold [&_.rdp-caption_label]:tracking-tight",
          "[&_.rdp-button_previous]:size-10 [&_.rdp-button_previous]:rounded-xl [&_.rdp-button_previous]:border [&_.rdp-button_previous]:border-slate-200 [&_.rdp-button_previous]:shadow-sm",
          "[&_.rdp-button_next]:size-10 [&_.rdp-button_next]:rounded-xl [&_.rdp-button_next]:border [&_.rdp-button_next]:border-slate-200 [&_.rdp-button_next]:shadow-sm",
          "dark:[&_.rdp-button_previous]:border-slate-700 dark:[&_.rdp-button_next]:border-slate-700",
          "[&_.rdp-week]:mt-1.5",
          "[&_.rdp-weekday]:pb-2 [&_.rdp-weekday]:text-[11px] [&_.rdp-weekday]:font-semibold [&_.rdp-weekday]:uppercase [&_.rdp-weekday]:tracking-widest [&_.rdp-weekday]:text-slate-400",
          "[&_.rdp-day_button]:rounded-xl [&_.rdp-day_button]:text-[15px] [&_.rdp-day_button]:font-medium",
          "[&_.rdp-disabled]:opacity-35",
        )}
      />

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--booking-accent)]" />
          Available
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-slate-300 dark:bg-slate-600" />
          Unavailable
        </span>
      </div>
    </div>
  )
}

function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
