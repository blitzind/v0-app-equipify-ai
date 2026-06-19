/** Display-only inbox message snippet helpers (UX-AUDIT-8). Client-safe. */

import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import { classificationLabel } from "@/lib/growth/inbox/reply-classifier"

const FORWARDED_PREFIX = /^(-+\s*)?(forwarded message|begin forwarded message)/i
const SIGNATURE_MARKERS = [
  /^--\s*$/,
  /^best regards,?$/i,
  /^kind regards,?$/i,
  /^thanks,?$/i,
  /^sent from my (iphone|ipad|android)/i,
]

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi
const QUOTED_LINE = /^>/
const REPLY_HEADER = /^On .+ wrote:$/i
const FROM_HEADER = /^From:/i
const ORIGINAL_MESSAGE = /^-+\s*original message\s*-+/i

export type InboxMessageDisplaySections = {
  primary: string
  signature: string | null
  quoted: string | null
  forwarded: string | null
}

export function collapseQuotedChain(text: string): string {
  const lines = text.split(/\r?\n/)
  const quoteStart = lines.findIndex((line) => QUOTED_LINE.test(line.trim()) || REPLY_HEADER.test(line.trim()))
  if (quoteStart <= 0) return text
  return lines.slice(0, quoteStart).join("\n").trim()
}

export function collapseRepeatedContactBlocks(text: string): string {
  const lines = text.split(/\r?\n/)
  const blockStart = lines.findIndex(
    (line) => FROM_HEADER.test(line.trim()) || ORIGINAL_MESSAGE.test(line.trim()) || REPLY_HEADER.test(line.trim()),
  )
  if (blockStart <= 0) return text
  return lines.slice(0, blockStart).join("\n").trim()
}

export function splitInboxMessageSections(raw: string): InboxMessageDisplaySections {
  const normalized = raw.trim()
  if (!normalized) return { primary: "—", signature: null, quoted: null, forwarded: null }

  let working = normalized
  let forwarded: string | null = null
  const forwardLines = working.split(/\r?\n/)
  const forwardIndex = forwardLines.findIndex((line) => FORWARDED_PREFIX.test(line.trim()))
  if (forwardIndex > 0) {
    forwarded = forwardLines.slice(forwardIndex).join("\n").trim()
    working = forwardLines.slice(0, forwardIndex).join("\n").trim()
  }

  let quoted: string | null = null
  const quotedLines = working.split(/\r?\n/)
  const quoteIndex = quotedLines.findIndex(
    (line) => QUOTED_LINE.test(line.trim()) || REPLY_HEADER.test(line.trim()) || FROM_HEADER.test(line.trim()),
  )
  if (quoteIndex > 0) {
    quoted = quotedLines.slice(quoteIndex).join("\n").trim()
    working = quotedLines.slice(0, quoteIndex).join("\n").trim()
  }

  let signature: string | null = null
  const signatureLines = working.split(/\r?\n/)
  for (let index = 0; index < signatureLines.length; index += 1) {
    const trimmed = signatureLines[index]?.trim() ?? ""
    if (SIGNATURE_MARKERS.some((pattern) => pattern.test(trimmed))) {
      signature = signatureLines.slice(index).join("\n").trim()
      working = signatureLines.slice(0, index).join("\n").trim()
      break
    }
  }

  working = collapseLongUrls(working.replace(/\n{3,}/g, "\n\n").trim())

  return {
    primary: working || "—",
    signature,
    quoted,
    forwarded,
  }
}

export function collapseForwardedBoilerplate(text: string): string {
  const lines = text.split(/\r?\n/)
  const startIndex = lines.findIndex((line) => FORWARDED_PREFIX.test(line.trim()))
  if (startIndex <= 0) return text
  return lines.slice(0, startIndex).join("\n").trim()
}

export function collapseSignature(text: string): string {
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() ?? ""
    if (SIGNATURE_MARKERS.some((pattern) => pattern.test(trimmed))) {
      return lines.slice(0, index).join("\n").trim()
    }
  }
  return text
}

export function collapseLongUrls(text: string, maxLength = 48): string {
  return text.replace(URL_PATTERN, (url) => {
    if (url.length <= maxLength) return url
    return `${url.slice(0, maxLength - 1)}…`
  })
}

export function prepareInboxMessageSnippet(raw: string, maxLength = 160): { snippet: string; truncated: boolean } {
  const sections = splitInboxMessageSections(raw)
  let text = sections.primary
  if (!text || text === "—") return { snippet: "—", truncated: false }

  if (text.length <= maxLength) return { snippet: text, truncated: false }
  return { snippet: `${text.slice(0, maxLength).trim()}…`, truncated: true }
}

export function formatInboxMessageDayHeader(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, { month: "short", day: "numeric" })
}

export function formatInboxCompactTimestamp(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return "now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function parseInboxLeadLabelParts(leadLabel: string): { company: string; contact: string } {
  const parts = leadLabel.split(" · ").map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { company: parts[0] ?? leadLabel, contact: parts[parts.length - 1] ?? leadLabel }
  }
  return { company: leadLabel, contact: leadLabel }
}

export function inboxContactInitials(label: string): string {
  const { contact } = parseInboxLeadLabelParts(label)
  const words = contact.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[words.length - 1]?.[0] ?? ""}`.toUpperCase()
  }
  return contact.slice(0, 2).toUpperCase()
}

export function resolveInboxReplyConfidence(thread: GrowthInboxThread): string {
  const score = thread.classification_confidence ?? 0
  if (score >= 0.8) return "High"
  if (score >= 0.5) return "Medium"
  return "Low"
}

export function resolveInboxMeetingPropensity(thread: GrowthInboxThread): string {
  if (thread.classification === "meeting_intent") return "High"
  if (thread.classification === "positive_interest") return "Medium"
  return "Low"
}

export function resolveInboxNextBestAction(thread: GrowthInboxThread): string {
  if (thread.classification === "meeting_intent") return "Book discovery call"
  if (thread.classification === "positive_interest" || thread.classification === "referral") {
    return "Reply and offer meeting"
  }
  if (thread.classification === "question") return "Answer question"
  if (thread.requires_human_review) return "Review reply"
  return "Follow up"
}

export function resolveInboxStatusBadgeLabels(thread: GrowthInboxThread): string[] {
  const labels = [classificationLabel(thread.classification)]
  if (thread.classification === "meeting_intent" || thread.classification === "positive_interest") {
    labels.push("Meeting")
  }
  return labels
}
