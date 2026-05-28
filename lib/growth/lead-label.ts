/** Client-safe lead display labels — safe to import from UI and server code. */

export function formatLeadLabel(companyName: string | null | undefined, fallback = "Lead"): string {
  const label = (companyName ?? "").trim()
  return label || fallback
}

export type LeadLabelFormatter = typeof formatLeadLabel

export function safeFormatLeadLabel(
  value: unknown,
  formatter: LeadLabelFormatter | null | undefined = formatLeadLabel,
  fallback = "Lead",
): string {
  try {
    const fn =
      typeof formatter === "function"
        ? formatter
        : typeof formatLeadLabel === "function"
          ? formatLeadLabel
          : null
    if (!fn) return String(value ?? fallback).trim() || fallback
    const companyName = typeof value === "string" ? value : value == null ? "" : String(value)
    return fn(companyName, fallback)
  } catch {
    const raw = typeof value === "string" ? value.trim() : ""
    return raw || fallback
  }
}
