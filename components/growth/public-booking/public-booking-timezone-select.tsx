"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Globe2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { GrowthBookingTimezoneMode } from "@/lib/growth/booking/booking-page-types"
import {
  BOOKING_COMMON_TIMEZONES,
  formatFriendlyTimezoneName,
  formatIanaTimezoneOption,
  formatUtcOffsetLabel,
  listBookingIanaTimezones,
  resolveBookingTimezone,
} from "@/lib/growth/booking/booking-timezone-utils"
import { cn } from "@/lib/utils"

type PublicBookingTimezoneSelectProps = {
  displayTimezone: string
  pageTimezone: string
  visitorTimezone: string
  timezoneMode: GrowthBookingTimezoneMode
  onChange: (value: string) => void
  className?: string
  compact?: boolean
}

function shortTimezoneLabel(timeZone: string): string {
  const safe = resolveBookingTimezone(timeZone)
  const offset = formatUtcOffsetLabel(safe)
  const friendly = formatFriendlyTimezoneName(safe)
  return `${friendly} (${offset.replace("UTC", "").trim() || "UTC"})`
}

export function PublicBookingTimezoneSelect({
  displayTimezone,
  pageTimezone,
  visitorTimezone,
  timezoneMode,
  onChange,
  className,
  compact = false,
}: PublicBookingTimezoneSelectProps) {
  const [open, setOpen] = useState(false)
  const safeDisplay = resolveBookingTimezone(displayTimezone, pageTimezone)
  const allTimezones = useMemo(() => listBookingIanaTimezones(), [])
  const common = useMemo(
    () => BOOKING_COMMON_TIMEZONES.filter((tz) => allTimezones.includes(tz)),
    [allTimezones],
  )
  const other = useMemo(
    () => allTimezones.filter((tz) => !common.includes(tz as (typeof BOOKING_COMMON_TIMEZONES)[number])),
    [allTimezones, common],
  )

  if (timezoneMode === "fixed_host") {
    return (
      <div className={cn("space-y-1.5", className)}>
        <p className="text-xs font-medium text-muted-foreground">Host timezone</p>
        <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
          <Globe2 className="mr-2 size-4 text-slate-400" />
          {formatIanaTimezoneOption(pageTimezone)}
        </div>
      </div>
    )
  }

  if (timezoneMode === "visitor_local") {
    return (
      <div className={cn("space-y-1.5", className)}>
        <p className="text-xs font-medium text-muted-foreground">Your timezone</p>
        <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          <Globe2 className="mr-2 size-4 text-slate-400" />
          {shortTimezoneLabel(visitorTimezone)} · {resolveBookingTimezone(visitorTimezone)}
        </div>
        {!compact ? (
          <p className="text-xs text-muted-foreground">Times auto-detected from your device. Bookings stored in UTC.</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor="booking-display-timezone" className="text-xs font-medium text-muted-foreground">
        Your timezone
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="booking-display-timezone"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-11 w-full justify-between rounded-xl border-slate-200 bg-white px-3 text-sm font-medium shadow-sm",
              "dark:border-slate-700 dark:bg-slate-900",
              compact ? "sm:max-w-xs" : "sm:min-w-[280px]",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 truncate text-left">
              <Globe2 className="size-4 shrink-0 text-slate-400" />
              {shortTimezoneLabel(safeDisplay)}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,420px)] p-0" align="end">
          <Command>
            <CommandInput placeholder="Search timezones…" />
            <CommandList>
              <CommandEmpty>No timezone found.</CommandEmpty>
              <CommandGroup heading="Suggested">
                {[visitorTimezone, pageTimezone, ...common]
                  .filter((tz, index, list) => list.indexOf(tz) === index)
                  .map((tz) => (
                    <CommandItem
                      key={tz}
                      value={`${formatIanaTimezoneOption(tz)} ${tz}`}
                      onSelect={() => {
                        onChange(tz)
                        setOpen(false)
                      }}
                    >
                      <Check className={cn("mr-2 size-4", safeDisplay === tz ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{formatIanaTimezoneOption(tz)}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
              <CommandGroup heading="All timezones">
                {other.map((tz) => (
                  <CommandItem
                    key={tz}
                    value={`${formatIanaTimezoneOption(tz)} ${tz}`}
                    onSelect={() => {
                      onChange(tz)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn("mr-2 size-4", safeDisplay === tz ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{formatIanaTimezoneOption(tz)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!compact ? (
        <p className="text-xs text-muted-foreground">
          Times shown in your timezone. Canonical booking time stored in UTC.
        </p>
      ) : null}
    </div>
  )
}
