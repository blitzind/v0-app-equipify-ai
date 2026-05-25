/** Client-safe calendar link builders for public booking success state. */

export type BookingCalendarEventInput = {
  title: string
  description: string
  location: string
  startAtIso: string
  endAtIso: string
}

function toGoogleCalendarDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

export function buildGoogleCalendarUrl(input: BookingCalendarEventInput): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    details: input.description,
    location: input.location,
    dates: `${toGoogleCalendarDate(input.startAtIso)}/${toGoogleCalendarDate(input.endAtIso)}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildOutlookCalendarUrl(input: BookingCalendarEventInput): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: input.title,
    body: input.description,
    location: input.location,
    startdt: new Date(input.startAtIso).toISOString(),
    enddt: new Date(input.endAtIso).toISOString(),
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

export function buildIcsCalendarBlob(input: BookingCalendarEventInput): Blob {
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Equipify//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${input.startAtIso}-${Math.random().toString(36).slice(2)}@equipify.ai`,
    `DTSTAMP:${toGoogleCalendarDate(new Date().toISOString())}`,
    `DTSTART:${toGoogleCalendarDate(input.startAtIso)}`,
    `DTEND:${toGoogleCalendarDate(input.endAtIso)}`,
    `SUMMARY:${escape(input.title)}`,
    `DESCRIPTION:${escape(input.description)}`,
    `LOCATION:${escape(input.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")

  return new Blob([content], { type: "text/calendar;charset=utf-8" })
}

export function downloadIcsCalendarFile(input: BookingCalendarEventInput, filename = "meeting.ics"): void {
  const blob = buildIcsCalendarBlob(input)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
