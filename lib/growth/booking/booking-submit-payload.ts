/** Public booking submit payload normalization (backward-compatible). */

export const GROWTH_BOOKING_SUBMIT_API_QA_MARKER = "booking-submit-api-v1" as const
export const PUBLIC_BOOKING_SUBMIT_ROUTE_META = "public-booking-submit-v1" as const

export type PublicBookingSubmitPayload = {
  name: string
  email: string
  company?: string
  phone?: string
  notes?: string
  slotStartAt: string
  slotEndAt: string
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/** Zod `.datetime()` accepts `Z` suffix only — normalize any parseable ISO to UTC `Z`. */
export function normalizeBookingSubmitIso(value: unknown): string | null {
  const raw = readString(value)
  if (!raw) return null
  const ms = Date.parse(raw)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function resolveSlotTimes(body: Record<string, unknown>): { slotStartAt: string | null; slotEndAt: string | null } {
  const directStart = normalizeBookingSubmitIso(body.slotStartAt)
  const directEnd = normalizeBookingSubmitIso(body.slotEndAt)
  if (directStart && directEnd) return { slotStartAt: directStart, slotEndAt: directEnd }

  const startTime = normalizeBookingSubmitIso(body.startTime)
  const endTime = normalizeBookingSubmitIso(body.endTime)
  if (startTime && endTime) return { slotStartAt: startTime, slotEndAt: endTime }

  const start = normalizeBookingSubmitIso(body.start)
  const end = normalizeBookingSubmitIso(body.end)
  if (start && end) return { slotStartAt: start, slotEndAt: end }

  const selectedSlot = readRecord(body.selectedSlot)
  if (selectedSlot) {
    const slotStart = normalizeBookingSubmitIso(selectedSlot.startAt ?? selectedSlot.start)
    const slotEnd = normalizeBookingSubmitIso(selectedSlot.endAt ?? selectedSlot.end)
    if (slotStart && slotEnd) return { slotStartAt: slotStart, slotEndAt: slotEnd }
  }

  const slot = readRecord(body.slot)
  if (slot) {
    const slotStart = normalizeBookingSubmitIso(slot.startAt ?? slot.start)
    const slotEnd = normalizeBookingSubmitIso(slot.endAt ?? slot.end)
    if (slotStart && slotEnd) return { slotStartAt: slotStart, slotEndAt: slotEnd }
  }

  return { slotStartAt: null, slotEndAt: null }
}

export function parsePublicBookingSubmitPayload(
  raw: unknown,
): { ok: true; data: PublicBookingSubmitPayload } | { ok: false; code: "invalid_form" } {
  const body = readRecord(raw)
  if (!body) return { ok: false, code: "invalid_form" }

  const name = readString(body.name)
  const email = readString(body.email)?.toLowerCase() ?? null
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, code: "invalid_form" }
  }

  const { slotStartAt, slotEndAt } = resolveSlotTimes(body)
  if (!slotStartAt || !slotEndAt) return { ok: false, code: "invalid_form" }
  if (Date.parse(slotEndAt) <= Date.parse(slotStartAt)) return { ok: false, code: "invalid_form" }

  return {
    ok: true,
    data: {
      name: name.slice(0, 120),
      email: email.slice(0, 320),
      company: readOptionalString(body.company)?.slice(0, 120),
      phone: readOptionalString(body.phone)?.slice(0, 40),
      notes: readOptionalString(body.notes)?.slice(0, 2000),
      slotStartAt,
      slotEndAt,
    },
  }
}
