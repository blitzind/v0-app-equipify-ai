/** Pure scheduling helpers for Growth outreach execution. */

export function parseOutreachTimezoneMinutes(isoOrLocal: string, timezone: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    const parts = formatter.formatToParts(new Date(isoOrLocal))
    const lookup = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]))
    return new Date(
      `${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour}:${lookup.minute}:${lookup.second ?? "00"}`,
    )
  } catch {
    return new Date(isoOrLocal)
  }
}

export function isWithinBusinessHours(input: {
  at: Date
  timezone: string
  startMinutes: number
  endMinutes: number
}): boolean {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })
  const parts = formatter.formatToParts(input.at)
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
  const total = hour * 60 + minute
  return total >= input.startMinutes && total < input.endMinutes
}

export function nextBusinessHoursSlot(input: {
  from: Date
  timezone: string
  startMinutes: number
  endMinutes: number
}): Date {
  const candidate = new Date(input.from)
  for (let day = 0; day < 14; day += 1) {
    if (isWithinBusinessHours({ at: candidate, ...input })) return candidate
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: input.timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })
    const parts = formatter.formatToParts(candidate)
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
    const total = hour * 60 + minute
    if (total < input.startMinutes) {
      const deltaMinutes = input.startMinutes - total
      candidate.setMinutes(candidate.getMinutes() + deltaMinutes)
      if (isWithinBusinessHours({ at: candidate, ...input })) return candidate
    }
    candidate.setDate(candidate.getDate() + 1)
    candidate.setHours(0, input.startMinutes, 0, 0)
  }
  return input.from
}

export function resolveScheduledFor(input: {
  sendNow: boolean
  scheduledFor?: string | null
  respectBusinessHours: boolean
  timezone: string
  startMinutes: number
  endMinutes: number
}): { scheduledFor: string | null; status: "approved" | "scheduled" } {
  if (input.sendNow) {
    const now = new Date()
    if (
      input.respectBusinessHours &&
      !isWithinBusinessHours({
        at: now,
        timezone: input.timezone,
        startMinutes: input.startMinutes,
        endMinutes: input.endMinutes,
      })
    ) {
      const slot = nextBusinessHoursSlot({
        from: now,
        timezone: input.timezone,
        startMinutes: input.startMinutes,
        endMinutes: input.endMinutes,
      })
      return { scheduledFor: slot.toISOString(), status: "scheduled" }
    }
    return { scheduledFor: now.toISOString(), status: "approved" }
  }
  if (input.scheduledFor) {
    const at = new Date(input.scheduledFor)
    let slot = at
    if (
      input.respectBusinessHours &&
      !isWithinBusinessHours({
        at,
        timezone: input.timezone,
        startMinutes: input.startMinutes,
        endMinutes: input.endMinutes,
      })
    ) {
      slot = nextBusinessHoursSlot({
        from: at,
        timezone: input.timezone,
        startMinutes: input.startMinutes,
        endMinutes: input.endMinutes,
      })
    }
    return { scheduledFor: slot.toISOString(), status: "scheduled" }
  }
  return { scheduledFor: null, status: "approved" }
}
