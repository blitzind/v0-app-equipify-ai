/**
 * Outbound signature injection contract (GS-GROWTH-SIGNATURES-1B).
 */

import type { GrowthRenderedSignature } from "@/lib/growth/signatures/signature-types"

export const GROWTH_SIGNATURE_INJECTION_QA_MARKER = "growth-signature-injection-1b-v1" as const

export const GROWTH_OUTBOUND_SIGNATURE_MARKER_ATTR = "data-growth-outbound-signature" as const
export const GROWTH_OUTBOUND_SIGNATURE_MARKER_VALUE = "1b" as const

export type OutboundSignatureInjectionInput = {
  htmlBody: string
  textBody?: string | null
  signature: GrowthRenderedSignature | null
}

export type OutboundSignatureInjectionResult = {
  htmlBody: string
  textBody: string
  signatureInjected: boolean
}

const HTML_SEPARATOR =
  '<p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;">&nbsp;</p>'

const UNSUBSCRIBE_FOOTER_RE =
  /<p[^>]*>\s*\{\{unsubscribe(?:_link|\.link)\}\}[\s\S]*?<\/p>/i

const PLAINTEXT_UNSUBSCRIBE_RE = /\n\nReply STOP to unsubscribe\.?$/i

function wrapSignatureHtml(signatureHtml: string): string {
  return `<div ${GROWTH_OUTBOUND_SIGNATURE_MARKER_ATTR}="${GROWTH_OUTBOUND_SIGNATURE_MARKER_VALUE}">${signatureHtml}</div>`
}

export function outboundBodyContainsSignature(htmlBody: string, textBody?: string | null): boolean {
  if (htmlBody.includes(`${GROWTH_OUTBOUND_SIGNATURE_MARKER_ATTR}="${GROWTH_OUTBOUND_SIGNATURE_MARKER_VALUE}"`)) {
    return true
  }
  const text = textBody?.trim() ?? ""
  if (!text) return false
  return /\n--\n[\s\S]+$/.test(text) && htmlBody.includes(GROWTH_OUTBOUND_SIGNATURE_MARKER_ATTR)
}

function injectSignatureHtml(htmlBody: string, signatureHtml: string): string {
  const wrapped = wrapSignatureHtml(signatureHtml)
  const footerMatch = htmlBody.match(UNSUBSCRIBE_FOOTER_RE)
  if (footerMatch?.index != null) {
    const idx = footerMatch.index
    return `${htmlBody.slice(0, idx)}${HTML_SEPARATOR}${wrapped}${htmlBody.slice(idx)}`
  }
  return htmlBody ? `${htmlBody}${HTML_SEPARATOR}${wrapped}` : wrapped
}

function injectSignatureText(textBody: string, signatureText: string): string {
  const block = `\n\n--\n${signatureText}`
  const unsubMatch = textBody.match(PLAINTEXT_UNSUBSCRIBE_RE)
  if (unsubMatch?.index != null) {
    const idx = unsubMatch.index
    return `${textBody.slice(0, idx)}${block}${textBody.slice(idx)}`
  }
  return textBody ? `${textBody}${block}` : signatureText
}

/**
 * Appends rendered signature HTML/text to an outbound body once.
 * Preserves unsubscribe footer placement when present.
 */
export function appendSignatureToOutboundBody(
  input: OutboundSignatureInjectionInput,
): OutboundSignatureInjectionResult {
  const baseHtml = input.htmlBody ?? ""
  const baseText = input.textBody?.trim() ?? ""

  if (!input.signature?.html?.trim()) {
    return {
      htmlBody: baseHtml,
      textBody: baseText,
      signatureInjected: false,
    }
  }

  if (outboundBodyContainsSignature(baseHtml, baseText)) {
    return {
      htmlBody: baseHtml,
      textBody: baseText,
      signatureInjected: false,
    }
  }

  const sigHtml = input.signature.html.trim()
  const sigText = input.signature.text.trim()

  return {
    htmlBody: injectSignatureHtml(baseHtml, sigHtml),
    textBody: injectSignatureText(baseText, sigText),
    signatureInjected: true,
  }
}

/** Documented injection points for runtime wiring. */
export const GROWTH_OUTBOUND_SIGNATURE_INJECTION_POINTS = [
  "lib/growth/sequences/execution/sequence-send-builder.ts",
  "lib/growth/replies/reply-send-builder.ts",
  "lib/growth/provider-setup/provider-test-send.ts",
  "app/api/platform/growth/providers/test-send/route.ts",
  "lib/growth/run-ai-copilot-generation.ts",
] as const
