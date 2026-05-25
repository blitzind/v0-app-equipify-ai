"use client"

import { useMemo } from "react"
import { Globe2 } from "lucide-react"
import { formatTimezoneLabel, visitorTimezoneHelperCopy } from "@/lib/growth/booking/booking-public-timezone"
import { cn } from "@/lib/utils"

type PublicBookingTimezoneSelectProps = {
  displayTimezone: string
  pageTimezone: string
  visitorTimezone: string
  onChange: (value: string) => void
  className?: string
  compact?: boolean
}

export function PublicBookingTimezoneSelect({
  displayTimezone,
  pageTimezone,
  visitorTimezone,
  onChange,
  className,
  compact = false,
}: PublicBookingTimezoneSelectProps) {
  const options = useMemo(() => [...new Set([visitorTimezone, pageTimezone])], [visitorTimezone, pageTimezone])

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor="booking-display-timezone" className="sr-only">
        Timezone
      </label>
      <div className="relative">
        <Globe2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <select
          id="booking-display-timezone"
          value={displayTimezone}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium shadow-sm outline-none transition-shadow",
            "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10",
            "dark:border-slate-700 dark:bg-slate-900 dark:focus:border-blue-400 dark:focus:ring-blue-400/10",
            compact ? "sm:max-w-xs" : "sm:min-w-[280px]",
          )}
        >
          {options.map((tz) => (
            <option key={tz} value={tz}>
              {formatTimezoneLabel(tz)}
              {tz === visitorTimezone ? " · Your timezone" : tz === pageTimezone ? " · Host" : ""}
            </option>
          ))}
        </select>
      </div>
      {!compact ? <p className="text-xs text-muted-foreground">{visitorTimezoneHelperCopy(displayTimezone)}</p> : null}
    </div>
  )
}
