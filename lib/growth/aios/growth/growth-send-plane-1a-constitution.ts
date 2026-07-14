/**
 * GE-AIOS-SEND-PLANE-1A — Production Human Communication Constitution (client-safe).
 * Mandatory final gate before transport. No signatures — mailbox system owns those.
 * INSTITUTIONAL-LEARNING-1B — canonical identity capitalization/branding gate.
 */

import {
  applyCanonicalIdentityToCopy,
  reviewCanonicalIdentityConstitution,
  type GrowthCanonicalDisplayIdentity,
} from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b"

export type { GrowthCanonicalDisplayIdentity } from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b"

export const GROWTH_AIOS_SEND_PLANE_1A_QA_MARKER =
  "ge-aios-send-plane-1a-canonical-draft-materialization-v1" as const

/** AI / research-reveal phrasing — reject equivalents, not only exact strings. */
export const SEND_PLANE_AI_PHRASING_PATTERNS = [
  /\bsomething i kept coming back to\b/i,
  /\bwhat stood out to me\b/i,
  /\bbased on my research\b/i,
  /\bi noticed after reviewing\b/i,
  /\bi spent some time looking\b/i,
  /\bit appears\b/i,
  /\bit seems\b/i,
  /\bi wanted to reach out\b/i,
  /\bquick note\b/i,
  /\bjust checking in\b/i,
  /\btouching base\b/i,
  /\bcircle back\b/i,
  /\bhope this finds you well\b/i,
  /\bi came across\b/i,
  /\bi've been looking\b/i,
  /\baccording to our records\b/i,
  /\bour system\b/i,
  /\bwe tracked\b/i,
  /\bconfidence score\b/i,
  /\bai\b/i,
  /\bcrawler\b/i,
  /\bautomation\b/i,
  /\bdraft factory\b/i,
  /\bgrowth 5f\b/i,
  /\bge-aios\b/i,
]

export const SEND_PLANE_MARKETING_LANGUAGE_PATTERNS = [
  /\brevolutionary\b/i,
  /\bgame[- ]changing\b/i,
  /\bcutting[- ]edge\b/i,
  /\bseamless\b/i,
  /\bbest[- ]in[- ]class\b/i,
  /\bindustry[- ]leading\b/i,
  /\btransform your business\b/i,
  /\bcomprehensive solution\b/i,
  /\bleverage\b/i,
  /\bstreamline\b/i,
  /\bsynerg/i,
]

export const SEND_PLANE_SIGNATURE_PATTERNS = [
  /^[\s]*[-—–]\s*[A-Za-z][^\n]{0,40}[\s]*$/gm,
  /^Thanks,?\s*$/gim,
  /^Thank you,?\s*$/gim,
  /^Best,?\s*$/gim,
  /^Regards,?\s*$/gim,
  /^Warm regards,?\s*$/gim,
  /^Sincerely,?\s*$/gim,
  /^Cheers,?\s*$/gim,
  /^—\s*[A-Za-z]/gm,
  /^-\s*[A-Za-z]/gm,
  /\bunsubscribe\b/i,
  /\bconfidentiality notice\b/i,
]

export function normalizeProductionPunctuation(text: string): string {
  let out = text
  out = out.replace(/\s*—\s*/g, ". ")
  out = out.replace(/\s+-\s+(?=[A-Za-z])/g, ". ")
  out = out.replace(/\.{2,}/g, ".")
  out = out.replace(/\s*\(\s*[^)]{80,}\s*\)\s*/g, " ")
  out = out.replace(/\.(\s*\.)+/g, ".")
  out = out.replace(/\s+/g, " ")
  out = out.replace(/ \./g, ".")
  out = out.replace(/\.\s+\./g, ". ")
  return out.trim()
}

export function stripAiGeneratedSignatureContent(text: string): string {
  let out = text.trim()
  for (const pattern of SEND_PLANE_SIGNATURE_PATTERNS) {
    out = out.replace(pattern, "")
  }
  return out
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
}

export function reviewOperatorExecutionGuideConstitution(
  text: string,
  canonicalIdentity?: GrowthCanonicalDisplayIdentity | null,
): string[] {
  const failures: string[] = []
  const normalized = text.trim()
  if (!normalized) {
    failures.push("send_plane:empty_copy")
    return failures
  }
  if (/—/.test(normalized)) failures.push("send_plane:em_dash_forbidden")
  for (const pattern of SEND_PLANE_SIGNATURE_PATTERNS) {
    if (pattern.test(normalized)) failures.push(`send_plane:signature_leak:${pattern.source}`)
  }
  failures.push(...reviewCanonicalIdentityConstitution(normalized, canonicalIdentity))
  return failures
}

export function reviewProductionHumanCommunicationConstitution(
  text: string,
  companyName: string,
  canonicalIdentity?: GrowthCanonicalDisplayIdentity | null,
): string[] {
  const failures: string[] = []
  const normalized = text.trim()
  if (!normalized) {
    failures.push("send_plane:empty_copy")
    return failures
  }

  if (/—/.test(normalized)) {
    failures.push("send_plane:em_dash_forbidden")
  }
  if (/\.{3,}/.test(normalized)) {
    failures.push("send_plane:excessive_ellipsis")
  }

  for (const pattern of SEND_PLANE_AI_PHRASING_PATTERNS) {
    if (pattern.test(normalized)) failures.push(`send_plane:ai_phrasing:${pattern.source}`)
  }
  for (const pattern of SEND_PLANE_MARKETING_LANGUAGE_PATTERNS) {
    if (pattern.test(normalized)) failures.push(`send_plane:marketing_language:${pattern.source}`)
  }
  for (const pattern of SEND_PLANE_SIGNATURE_PATTERNS) {
    if (pattern.test(normalized)) failures.push(`send_plane:signature_leak:${pattern.source}`)
  }

  if (companyName && normalized.toLowerCase().includes("verified description")) {
    failures.push("send_plane:internal_evidence_leak")
  }

  failures.push(...reviewCanonicalIdentityConstitution(normalized, canonicalIdentity))

  return failures
}

export function finalizeProductionCustomerFacingCopy(
  text: string,
  canonicalIdentity?: GrowthCanonicalDisplayIdentity | null,
): string {
  const stripped = stripAiGeneratedSignatureContent(text)
  const identityApplied = applyCanonicalIdentityToCopy(stripped, canonicalIdentity)
  return normalizeProductionPunctuation(identityApplied)
}
