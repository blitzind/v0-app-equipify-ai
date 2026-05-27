import { createHash } from "node:crypto"
import type { GrowthInboxNormalizedMessage } from "@/lib/growth/inbox-sync/inbox-sync-types"

const PREVIEW_MAX = 280

export type GrowthInboxProviderRawMessage = {
  provider_message_id: string
  provider_thread_id?: string | null
  in_reply_to?: string | null
  references?: string[] | null
  from_email?: string | null
  to_email?: string | null
  subject?: string | null
  body_preview?: string | null
  message_timestamp?: string | null
}

export function normalizeEmailAddress(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function normalizeSubject(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
}

export function buildMessagePreview(body: string | null | undefined): string {
  const collapsed = (body ?? "").replace(/\s+/g, " ").trim()
  if (!collapsed) return ""
  return collapsed.slice(0, PREVIEW_MAX)
}

export function hashEmailAddress(email: string): string {
  const normalized = normalizeEmailAddress(email)
  if (!normalized) return ""
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32)
}

export function buildInboxMessageHash(input: {
  mailboxConnectionId: string
  providerMessageId: string
  fromEmail: string
  messageTimestamp: string
  bodyPreview: string
}): string {
  const payload = [
    input.mailboxConnectionId,
    input.providerMessageId,
    normalizeEmailAddress(input.fromEmail),
    input.messageTimestamp,
    buildMessagePreview(input.bodyPreview),
  ].join("|")
  return createHash("sha256").update(payload).digest("hex")
}

export function normalizeProviderMessage(
  raw: GrowthInboxProviderRawMessage,
  mailboxConnectionId: string,
): GrowthInboxNormalizedMessage {
  const providerMessageId = raw.provider_message_id.trim()
  const fromEmail = normalizeEmailAddress(raw.from_email)
  const toEmail = normalizeEmailAddress(raw.to_email)
  const bodyPreview = buildMessagePreview(raw.body_preview)
  const messageTimestamp = raw.message_timestamp ?? new Date().toISOString()

  return {
    providerMessageId,
    providerThreadId: raw.provider_thread_id?.trim() || null,
    inReplyTo: raw.in_reply_to?.trim() || null,
    references: (raw.references ?? []).map((value) => value.trim()).filter(Boolean),
    fromEmail,
    toEmail,
    subject: (raw.subject ?? "").trim(),
    bodyPreview,
    messageTimestamp,
    messageHash: buildInboxMessageHash({
      mailboxConnectionId,
      providerMessageId,
      fromEmail,
      messageTimestamp,
      bodyPreview,
    }),
  }
}

export function subjectSimilarityScore(left: string, right: string): number {
  const a = normalizeSubject(left)
  const b = normalizeSubject(right)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.8
  return 0
}
