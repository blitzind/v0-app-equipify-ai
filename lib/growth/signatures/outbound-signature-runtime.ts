import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getMailboxConnectionBySender } from "@/lib/growth/mailboxes/mailbox-repository"
import {
  appendSignatureToOutboundBody,
  type OutboundSignatureInjectionResult,
} from "@/lib/growth/signatures/signature-injection"
import {
  applySenderMergeFieldsToText,
  buildSenderMergeFields,
} from "@/lib/growth/signatures/sender-merge-fields"
import {
  resolveOutboundSignatureForSender,
  type OutboundSignatureResolutionSource,
} from "@/lib/growth/signatures/signature-resolver"
import type { GrowthRenderedSignature } from "@/lib/growth/signatures/signature-types"

export const GROWTH_OUTBOUND_SIGNATURE_RUNTIME_QA_MARKER = "growth-outbound-signature-runtime-1b-v1" as const

export type PrepareOutboundEmailContentInput = {
  senderAccountId: string
  mailboxConnectionId?: string | null
  subject: string
  bodyText: string
  htmlBody?: string | null
  unsubscribeFooterHtml?: string | null
  unsubscribeTextSuffix?: string | null
}

export type PreparedOutboundEmailContent = {
  subject: string
  bodyText: string
  htmlBody: string
  textBody: string
  signatureInjected: boolean
  mergeFields: Record<string, string>
  resolutionSource: OutboundSignatureResolutionSource
  signature: GrowthRenderedSignature | null
}

function plainTextToHtmlBody(bodyText: string): string {
  const escaped = bodyText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return `<div>${escaped.replace(/\n/g, "<br/>")}</div>`
}

function buildPlaintextBody(bodyText: string, unsubscribeTextSuffix?: string | null): string {
  const suffix = unsubscribeTextSuffix?.trim()
  if (!suffix) return bodyText
  return bodyText ? `${bodyText}\n\n${suffix}` : suffix
}

export async function prepareOutboundEmailContent(
  admin: SupabaseClient,
  input: PrepareOutboundEmailContentInput,
): Promise<PreparedOutboundEmailContent> {
  let mailboxConnectionId = input.mailboxConnectionId ?? null
  if (!mailboxConnectionId) {
    const mailbox = await getMailboxConnectionBySender(admin, input.senderAccountId).catch(() => null)
    mailboxConnectionId = mailbox?.id ?? null
  }

  const resolved = await resolveOutboundSignatureForSender(admin, {
    senderAccountId: input.senderAccountId,
    mailboxConnectionId,
  })

  const subject = applySenderMergeFieldsToText(input.subject, resolved.mergeFields)
  const bodyText = applySenderMergeFieldsToText(input.bodyText, resolved.mergeFields)

  const contentHtml = input.htmlBody?.trim() ? input.htmlBody : plainTextToHtmlBody(bodyText)
  const footerHtml = input.unsubscribeFooterHtml?.trim() ?? ""
  const htmlWithFooter = footerHtml ? `${contentHtml}${footerHtml}` : contentHtml

  const baseText = buildPlaintextBody(bodyText, input.unsubscribeTextSuffix)

  const injected: OutboundSignatureInjectionResult = appendSignatureToOutboundBody({
    htmlBody: htmlWithFooter,
    textBody: baseText,
    signature: resolved.signature,
  })

  return {
    subject,
    bodyText,
    htmlBody: injected.htmlBody,
    textBody: injected.textBody,
    signatureInjected: injected.signatureInjected,
    mergeFields: resolved.mergeFields,
    resolutionSource: resolved.resolutionSource,
    signature: resolved.signature,
  }
}
