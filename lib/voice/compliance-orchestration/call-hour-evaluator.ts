/** Timezone-aware call-hour evaluation — Phase 4C. */

import type { VoiceCallHourRulePublicView } from "@/lib/voice/compliance-orchestration/types"

export type CallHourEvaluation = {
  timezoneKnown: boolean
  withinCallHours: boolean | null
  evidenceText: string
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim())
  if (!match) return null
  const hours = Number.parseInt(match[1]!, 10)
  const minutes = Number.parseInt(match[2]!, 10)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function localParts(now: Date, timezone: string): { dayKey: string; minutes: number } | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]))
    const weekday = (lookup.weekday ?? "").toLowerCase()
    const dayKey = DAY_NAMES.find((d) => d === weekday) ?? weekday
    const minutes = parseTimeToMinutes(`${lookup.hour}:${lookup.minute}`)
    if (minutes == null) return null
    return { dayKey, minutes }
  } catch {
    return null
  }
}

export function evaluateCallHourRule(
  rule: VoiceCallHourRulePublicView | null,
  now: Date = new Date(),
): CallHourEvaluation {
  if (!rule?.timezone?.trim()) {
    return {
      timezoneKnown: false,
      withinCallHours: null,
      evidenceText: "Timezone unknown — manual review required per conservative policy.",
    }
  }

  const local = localParts(now, rule.timezone)
  if (!local) {
    return {
      timezoneKnown: false,
      withinCallHours: null,
      evidenceText: `Could not evaluate call hours in timezone ${rule.timezone}.`,
    }
  }

  const allowedDays = rule.allowedDays.map((d) => d.toLowerCase())
  if (!allowedDays.includes(local.dayKey)) {
    return {
      timezoneKnown: true,
      withinCallHours: false,
      evidenceText: `Outside allowed days (${local.dayKey}) for rule ${rule.name}.`,
    }
  }

  const start = parseTimeToMinutes(rule.allowedStartTime)
  const end = parseTimeToMinutes(rule.allowedEndTime)
  if (start == null || end == null) {
    return {
      timezoneKnown: true,
      withinCallHours: null,
      evidenceText: "Call-hour rule times invalid — manual review required.",
    }
  }

  const within = local.minutes >= start && local.minutes <= end
  return {
    timezoneKnown: true,
    withinCallHours: within,
    evidenceText: within
      ? `Within call hours for ${rule.name} (${rule.timezone}).`
      : `Outside call hours for ${rule.name} (${rule.allowedStartTime}-${rule.allowedEndTime} ${rule.timezone}).`,
  }
}

export function buildDefaultCallHourRule(organizationId: string): Omit<VoiceCallHourRulePublicView, "id" | "createdAt" | "updatedAt"> {
  return {
    organizationId,
    name: "Default business hours",
    timezone: "America/New_York",
    allowedDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    allowedStartTime: "09:00",
    allowedEndTime: "17:00",
    channel: null,
    campaignType: null,
    isDefault: true,
    metadata: {},
  }
}
