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
}

export function PublicBookingCalendar({
  accentColor,
  month,
  onMonthChange,
  selected,
  onSelect,
  disabled,
  available,
}: PublicBookingCalendarProps) {
  return (
    <div
      className="w-full rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900/40"
      style={{ "--booking-accent": accentColor } as CSSProperties}
    >
      <Calendar
        mode="single"
        month={month}
        onMonthChange={onMonthChange}
        selected={selected}
        onSelect={onSelect}
        disabled={disabled}
        modifiers={{ available }}
        modifiersClassNames={{
          available:
            "font-semibold text-foreground [&>button]:bg-[color-mix(in_srgb,var(--booking-accent)_12%,transparent)] [&>button]:ring-1 [&>button]:ring-[color-mix(in_srgb,var(--booking-accent)_35%,transparent)]",
          selected:
            "[&>button]:!bg-[var(--booking-accent)] [&>button]:!text-white [&>button]:!ring-2 [&>button]:!ring-[color-mix(in_srgb,var(--booking-accent)_40%,white)]",
        }}
        className={cn(
          "w-full max-w-none [--cell-size:2.85rem] sm:[--cell-size:3.1rem]",
          "[&_.rdp-month]:w-full",
          "[&_.rdp-week]:mt-2",
          "[&_.rdp-weekday]:text-xs [&_.rdp-weekday]:font-medium [&_.rdp-weekday]:uppercase [&_.rdp-weekday]:tracking-wide",
        )}
      />
    </div>
  )
}
