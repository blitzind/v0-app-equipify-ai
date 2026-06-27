/** GE-AI-UX-1C — Business-first narrative formatting for Home briefing (client-safe). */

import { translateOperatorActivityHeadline } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-event-translator"

export function formatHomeCountPhrase(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`)
  return `${count} ${word}`
}

export function formatHomeProgressBullet(template: string, count: number, singular: string, plural?: string): string {
  if (count <= 0) return template.replace("{count}", "no").replace("{phrase}", plural ?? `${singular}s`)
  return template.replace("{count}", String(count)).replace("{phrase}", formatHomeCountPhrase(count, singular, plural))
}

export function translateHomeActivityTitle(title: string, summary?: string | null): string {
  return translateOperatorActivityHeadline({ title, summary }).headline
}

export function sanitizeHomeNarrative(text: string): string {
  return text
    .replace(/\b(growth\.[a-z0-9_.]+)\b/gi, "")
    .replace(/\bworkflow_request_\w+\b/gi, "")
    .replace(/\bapproval_queue_size\b/gi, "")
    .replace(/\bconfidence\s*score\b/gi, "")
    .replace(/\bevent\s*type\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export function formatHomeCurrency(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "$0"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
  }).format(amount)
}

export function formatHomeRevenueRange(low: number, high: number): string {
  if (low <= 0 && high <= 0) return ""
  if (low === high) return formatHomeCurrency(low)
  return `${formatHomeCurrency(low)}–${formatHomeCurrency(high)}`
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}
