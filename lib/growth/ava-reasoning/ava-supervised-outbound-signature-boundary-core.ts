/**
 * AVA-SUPERVISED-OUTBOUND-1A/1B — Idempotent signature boundary helpers (client-safe).
 */

import { createHash } from "node:crypto"
import {
  GROWTH_OUTBOUND_SIGNATURE_MARKER_ATTR,
  GROWTH_OUTBOUND_SIGNATURE_MARKER_VALUE,
} from "@/lib/growth/signatures/signature-injection"

export const AVA_SUPERVISED_OUTBOUND_SIGNATURE_BOUNDARY_CORE_QA_MARKER =
  "ava-supervised-outbound-signature-boundary-core-1b-v1" as const

/** Plain-text signature separator with optional surrounding whitespace. */
export const AVA_SUPERVISED_OUTBOUND_PLAINTEXT_SIGNATURE_SEPARATOR_PATTERN =
  /\n[ \t]*--[ \t]*\n/g

const TRAILING_PLAINTEXT_SIGNATURE_REGION_PATTERN = /\n[ \t]*--[ \t]*\n[\s\S]*$/

const HTML_BR_SIGNATURE_SEPARATOR_PATTERN = /<br\s*\/?>\s*--\s*<br\s*\/?>[\s\S]*$/i

const HTML_SIGNATURE_MARKER_PATTERN = new RegExp(
  `<div\\s+${GROWTH_OUTBOUND_SIGNATURE_MARKER_ATTR}=["']${GROWTH_OUTBOUND_SIGNATURE_MARKER_VALUE}["'][\\s\\S]*?</div>\\s*$`,
  "i",
)

const LEGACY_AVA_SIGNATURE_MARKERS = [
  "ava sinclair",
  "growth advisor",
  "equipify.ai",
  "equipifyai.com",
  "ava@equipifyai.com",
] as const

const SCHEDULING_CTA_MARKERS = [
  "schedule a call",
  "book a time",
  "calendly",
  "grab time",
] as const

export function normalizeOutboundPlaintextLineEndings(body: string): string {
  return body.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

export function fingerprintAvaSupervisedOutboundBody(body: string): string {
  return createHash("sha256").update(normalizeOutboundPlaintextLineEndings(body).trim()).digest("hex")
}

function normalizeBody(body: string): string {
  return normalizeOutboundPlaintextLineEndings(body).trimEnd()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function trailingBlockLooksLikeLegacyAvaSignature(block: string): boolean {
  const normalized = block.trim().toLowerCase()
  if (!normalized) return false
  return LEGACY_AVA_SIGNATURE_MARKERS.some((marker) => normalized.includes(marker))
}

function trailingBlockLooksLikeSchedulingCta(block: string): boolean {
  const normalized = block.trim().toLowerCase()
  if (!normalized) return false
  return SCHEDULING_CTA_MARKERS.some((marker) => normalized.includes(marker))
}

function stripTrailingSignatureSeparator(body: string): string {
  let next = normalizeBody(body)
  while (next.endsWith("--") || next.endsWith("—")) {
    next = next.slice(0, -2).trimEnd()
  }
  return next
}

export function countPlaintextSignatureSeparators(body: string): number {
  const normalized = normalizeOutboundPlaintextLineEndings(body)
  return normalized.match(AVA_SUPERVISED_OUTBOUND_PLAINTEXT_SIGNATURE_SEPARATOR_PATTERN)?.length ?? 0
}

export function countHtmlSignatureMarkers(html: string): number {
  const pattern = new RegExp(
    `${GROWTH_OUTBOUND_SIGNATURE_MARKER_ATTR}=["']${GROWTH_OUTBOUND_SIGNATURE_MARKER_VALUE}["']`,
    "g",
  )
  return html.match(pattern)?.length ?? 0
}

export function countHtmlBrSignatureSeparators(html: string): number {
  return html.match(/<br\s*\/?>\s*--\s*<br\s*\/?>/gi)?.length ?? 0
}

function stripTrailingPlaintextSignatureRegions(body: string): string {
  let next = normalizeBody(body)
  let trailing = next.match(TRAILING_PLAINTEXT_SIGNATURE_REGION_PATTERN)
  while (trailing?.index != null && trailing.index >= 0) {
    next = next.slice(0, trailing.index).trimEnd()
    trailing = next.match(TRAILING_PLAINTEXT_SIGNATURE_REGION_PATTERN)
  }
  return next
}

function stripTrailingHtmlSignatureRegions(html: string): string {
  let next = html.trimEnd()
  let changed = true
  while (changed) {
    changed = false
    const markerMatch = next.match(HTML_SIGNATURE_MARKER_PATTERN)
    if (markerMatch?.index != null && markerMatch.index >= 0) {
      next = next.slice(0, markerMatch.index).trimEnd()
      changed = true
      continue
    }
    const brMatch = next.match(HTML_BR_SIGNATURE_SEPARATOR_PATTERN)
    if (brMatch?.index != null && brMatch.index >= 0) {
      next = next.slice(0, brMatch.index).trimEnd()
      changed = true
    }
  }
  return next
}

function stripCanonicalSignatureTextVariants(body: string, canonicalSignatureText?: string | null): string {
  let next = body
  if (!canonicalSignatureText?.trim()) return next

  const canonical = normalizeBody(canonicalSignatureText)
  while (next.endsWith(canonical)) {
    next = next.slice(0, -canonical.length).trimEnd()
  }

  const separatorPatterns = [
    new RegExp(`${escapeRegExp(`\n[ \\t]*--[ \\t]*\\n${canonical}`)}$`),
    new RegExp(`${escapeRegExp(`\n\\n--\\n${canonical}`)}$`),
    new RegExp(`${escapeRegExp(`\\n--\\n${canonical}`)}$`),
  ]
  for (const pattern of separatorPatterns) {
    while (pattern.test(next)) {
      next = next.replace(pattern, "").trimEnd()
    }
  }

  return next
}

function bodyLooksLikeHtml(body: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(body)
}

/**
 * Removes accidental Ava/legacy signature blocks from GPT output or older persisted drafts.
 * Normalizes line endings and strips trailing plain-text or HTML signature regions.
 */
export function stripAccidentalAvaSignatureFromBody(
  body: string,
  canonicalSignatureText?: string | null,
): string {
  if (bodyLooksLikeHtml(body)) {
    return stripTrailingHtmlSignatureRegions(body)
  }

  let next = stripTrailingSignatureSeparator(body)
  next = stripCanonicalSignatureTextVariants(next, canonicalSignatureText)
  next = stripTrailingPlaintextSignatureRegions(next)

  const lines = next.split("\n")
  while (lines.length > 0) {
    const tail = lines.slice(-4).join("\n")
    if (
      trailingBlockLooksLikeLegacyAvaSignature(tail) ||
      (lines.length >= 2 &&
        trailingBlockLooksLikeLegacyAvaSignature(lines[lines.length - 1] ?? "") &&
        trailingBlockLooksLikeLegacyAvaSignature(lines[lines.length - 2] ?? ""))
    ) {
      lines.pop()
      continue
    }
    break
  }

  next = stripTrailingPlaintextSignatureRegions(stripTrailingSignatureSeparator(lines.join("\n")))
  return next
}

export function outboundUnsignedBodyRequiresReapproval(input: {
  approvedUnsignedBody: string
  canonicalSignatureText?: string | null
}): boolean {
  const normalizedApproved = normalizeBody(input.approvedUnsignedBody)
  const sanitized = stripAccidentalAvaSignatureFromBody(
    input.approvedUnsignedBody,
    input.canonicalSignatureText ?? null,
  )
  if (sanitized !== normalizedApproved) return true
  if (countPlaintextSignatureSeparators(input.approvedUnsignedBody) > 0) return true
  if (bodyLooksLikeHtml(input.approvedUnsignedBody) && countHtmlSignatureMarkers(input.approvedUnsignedBody) > 0) {
    return true
  }
  return false
}

export function bodyContainsLegacyAvaSignatureMarkers(body: string): boolean {
  const normalized = body.toLowerCase()
  return LEGACY_AVA_SIGNATURE_MARKERS.some((marker) => normalized.includes(marker))
}
