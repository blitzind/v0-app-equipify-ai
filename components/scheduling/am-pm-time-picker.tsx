"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatHhMmAmPm, parseFlexibleTimeToHhMm, quarterHourHhMmSlots } from "@/lib/time/am-pm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

const SLOTS = quarterHourHhMmSlots()

interface AmPmTimePickerProps {
  id?: string
  valueHhMm: string
  onChangeHhMm: (hhmm: string) => void
  disabled?: boolean
  className?: string
  /** Merged into `PopoverContent` (e.g. `z-[120]` when used inside a high z-index modal). */
  popoverContentClassName?: string
}

export function AmPmTimePicker({
  id,
  valueHhMm,
  onChangeHhMm,
  disabled,
  className,
  popoverContentClassName,
}: AmPmTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const [typing, setTyping] = useState("")
  const [manualFocused, setManualFocused] = useState(false)

  useEffect(() => {
    if (!manualFocused) {
      setTyping(formatHhMmAmPm(valueHhMm))
    }
  }, [valueHhMm, manualFocused])

  useEffect(() => {
    if (open) setFilter("")
  }, [open])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return SLOTS
    return SLOTS.filter((slot) => formatHhMmAmPm(slot).toLowerCase().includes(q))
  }, [filter])

  function commitManual() {
    const parsed = parseFlexibleTimeToHhMm(typing)
    if (parsed) {
      onChangeHhMm(parsed)
      setTyping(formatHhMmAmPm(parsed))
    } else {
      setTyping(formatHhMmAmPm(valueHhMm))
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              className="min-h-9 w-full justify-between font-normal sm:flex-1"
            >
              <span className="truncate">{formatHhMmAmPm(valueHhMm)}</span>
              <Clock className="ml-2 h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className={cn(
              "w-[min(100vw-2rem,280px)] p-0",
              popoverContentClassName,
            )}
          >
            <div className="border-b border-border p-2">
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter times…"
                className="h-9"
              />
            </div>
            <ScrollArea className="h-[220px]">
              <div className="p-1">
                {filtered.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">No matching slot.</p>
                ) : (
                  filtered.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        slot === valueHhMm && "bg-accent/80 font-medium",
                      )}
                      onClick={() => {
                        onChangeHhMm(slot)
                        setTyping(formatHhMmAmPm(slot))
                        setOpen(false)
                      }}
                    >
                      {formatHhMmAmPm(slot)}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <Input
          disabled={disabled}
          value={manualFocused ? typing : formatHhMmAmPm(valueHhMm)}
          onChange={(e) => {
            setTyping(e.target.value)
          }}
          onFocus={() => {
            setManualFocused(true)
            setTyping(formatHhMmAmPm(valueHhMm))
          }}
          onBlur={() => {
            setManualFocused(false)
            commitManual()
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commitManual()
            }
          }}
          placeholder="Type time"
          className="min-h-9 font-mono text-sm sm:max-w-[9rem]"
          aria-label="Type a time (keyboard fallback, AM/PM)"
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        15-minute increments in the list. You can also type a time (e.g. 2:30 PM).
      </p>
    </div>
  )
}
