/**
 * AVA-SUPERVISED-OUTBOUND-1A — Idempotent signature boundary helpers (client-safe).
 */

import { createHash } from "node:crypto"

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

export function fingerprintAvaSupervisedOutboundBody(body: string): string {
  return createHash("sha256").update(body.replace(/\r\n/g, "\n").trim()).digest("hex")
}

function normalizeBody(body: string): string {
  return body.replace(/\r\n/g, "\n").trimEnd()
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

/**
 * Removes accidental Ava/legacy signature blocks from GPT output or older persisted drafts.
 * Narrow matching only — no broad rewrite.
 */
export function stripAccidentalAvaSignatureFromBody(
  body: string,
  canonicalSignatureText?: string | null,
): string {
  let next = stripTrailingSignatureSeparator(body)

  if (canonicalSignatureText?.trim()) {
    const canonical = canonicalSignatureText.trim()
    while (next.endsWith(canonical)) {
      next = next.slice(0, -canonical.length).trimEnd()
    }
    const canonicalWithSeparator = `\n\n--\n${canonical}`
    while (next.endsWith(canonicalWithSeparator)) {
      next = next.slice(0, -canonicalWithSeparator.length).trimEnd()
    }
  }

  const separatorIndex = next.search(/\n--\n[\s\S]*$/)
  if (separatorIndex >= 0) {
    const tail = next.slice(separatorIndex + 4)
    if (
      trailingBlockLooksLikeLegacyAvaSignature(tail) ||
      trailingBlockLooksLikeSchedulingCta(tail)
    ) {
      next = next.slice(0, separatorIndex).trimEnd()
    }
  }

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

  return stripTrailingSignatureSeparator(lines.join("\n"))
}

export function countPlaintextSignatureSeparators(body: string): number {
  const matches = body.match(/\n--\n/g)
  return matches?.length ?? 0
}

export function bodyContainsLegacyAvaSignatureMarkers(body: string): boolean {
  const normalized = body.toLowerCase()
  return LEGACY_AVA_SIGNATURE_MARKERS.some((marker) => normalized.includes(marker))
}
