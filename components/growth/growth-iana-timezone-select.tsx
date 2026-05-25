"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
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
import {
  BOOKING_COMMON_TIMEZONES,
  formatIanaTimezoneOption,
  listBookingIanaTimezones,
  resolveBookingTimezone,
} from "@/lib/growth/booking/booking-timezone-utils"
import { cn } from "@/lib/utils"

type GrowthIanaTimezoneSelectProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  id?: string
}

export function GrowthIanaTimezoneSelect({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Select timezone…",
  id,
}: GrowthIanaTimezoneSelectProps) {
  const [open, setOpen] = useState(false)
  const safeValue = resolveBookingTimezone(value)
  const allTimezones = useMemo(() => listBookingIanaTimezones(), [])
  const common = useMemo(
    () => BOOKING_COMMON_TIMEZONES.filter((tz) => allTimezones.includes(tz)),
    [allTimezones],
  )
  const other = useMemo(
    () => allTimezones.filter((tz) => !common.includes(tz as (typeof BOOKING_COMMON_TIMEZONES)[number])),
    [allTimezones, common],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-9 w-full justify-between font-normal", className)}
        >
          <span className="truncate text-left">
            {safeValue ? formatIanaTimezoneOption(safeValue) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,420px)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezones…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup heading="Common">
              {common.map((tz) => (
                <CommandItem
                  key={tz}
                  value={`${formatIanaTimezoneOption(tz)} ${tz}`}
                  onSelect={() => {
                    onChange(tz)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 size-4", safeValue === tz ? "opacity-100" : "opacity-0")} />
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
                  <Check className={cn("mr-2 size-4", safeValue === tz ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{formatIanaTimezoneOption(tz)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
