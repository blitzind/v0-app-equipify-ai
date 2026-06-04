"use client"

import type { GrowthInboxMessage, GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import { safeFormatLeadLabel } from "@/lib/growth/lead-label"

export const INBOX_STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked"> = {
  open: "healthy",
  waiting: "neutral",
  needs_review: "attention",
  resolved: "healthy",
  archived: "blocked",
  low: "neutral",
  normal: "healthy",
  high: "attention",
  critical: "critical",
}

export const INBOX_SEVERITY_TONE: Record<string, "healthy" | "medium" | "attention" | "critical" | "neutral"> = {
  low: "neutral",
  medium: "medium",
  high: "attention",
  critical: "critical",
}

export function formatInboxDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function sanitizeInboxUiErrorMessage(message: string | null | undefined): string | null {
  const trimmed = message?.trim()
  if (!trimmed) return null
  if (/\bis not defined$/i.test(trimmed) || /^ReferenceError/i.test(trimmed)) {
    return "Inbox data could not be loaded due to a server configuration issue. Retry shortly."
  }
  return trimmed
}

export function displayInboxLeadLabel(thread: GrowthInboxThread): string {
  return safeFormatLeadLabel(thread.lead_label || thread.lead_id)
}

export function inboxMessageSignalFlags(message: GrowthInboxMessage): string[] {
  const flags: string[] = []
  if (message.contains_budget) flags.push("Budget")
  if (message.contains_pricing) flags.push("Pricing")
  if (message.contains_meeting_language) flags.push("Meeting")
  if (message.contains_positive_signal) flags.push("Positive")
  if (message.contains_competitor) flags.push("Competitor")
  return flags
}
