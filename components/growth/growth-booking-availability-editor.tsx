"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BookingWeeklyDaySchedule } from "@/lib/growth/booking/booking-page-ui-types"

type GrowthBookingAvailabilityEditorProps = {
  schedule: BookingWeeklyDaySchedule[]
  onChange: (schedule: BookingWeeklyDaySchedule[]) => void
  disabled?: boolean
}

export function GrowthBookingAvailabilityEditor({
  schedule,
  onChange,
  disabled,
}: GrowthBookingAvailabilityEditorProps) {
  function updateDay(dayOfWeek: number, patch: Partial<BookingWeeklyDaySchedule>) {
    onChange(schedule.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)))
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Weekly availability</Label>
      <div className="space-y-1.5 rounded-md border border-border/70 p-2 dark:border-[#25324C]">
        {schedule.map((day) => (
          <div key={day.dayOfWeek} className="grid grid-cols-[92px_52px_1fr_1fr] items-center gap-2 text-xs sm:grid-cols-[110px_60px_1fr_1fr]">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={day.enabled}
                disabled={disabled}
                onChange={(event) => updateDay(day.dayOfWeek, { enabled: event.target.checked })}
              />
              <span className="truncate">{day.label.slice(0, 3)}</span>
            </label>
            <span className="hidden text-muted-foreground sm:inline">{day.label}</span>
            <Input
              className="h-8 text-xs"
              value={day.startTime}
              disabled={disabled || !day.enabled}
              placeholder="09:00"
              onChange={(event) => updateDay(day.dayOfWeek, { startTime: event.target.value })}
            />
            <Input
              className="h-8 text-xs"
              value={day.endTime}
              disabled={disabled || !day.enabled}
              placeholder="17:00"
              onChange={(event) => updateDay(day.dayOfWeek, { endTime: event.target.value })}
            />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Times use 24-hour HH:MM format in the page timezone.</p>
    </div>
  )
}
