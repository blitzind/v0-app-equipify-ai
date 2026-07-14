/** GE-AIOS-MEMORY-RESOLVER-1A — Memory constitution filters (client-safe). */

import { sanitizeMemoryEvidenceSnippet } from "@/lib/growth/lead-memory/memory-types"

const TRANSCRIPT_MARKERS = [
  /\boperator:\b/i,
  /\bprospect:\b/i,
  /\bcaller:\b/i,
  /\bagent:\b/i,
  /\[[\d:]+\]/,
  /\bSPEAKER\b/i,
  /\btranscript\b/i,
]

const SMALL_TALK_MARKERS = [
  /^how are you\b/i,
  /^nice weather\b/i,
  /^good (morning|afternoon|evening)\b/i,
  /^thanks for taking my call\b/i,
]

export function looksLikeRawTranscriptMemory(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length > 280) return true
  if ((trimmed.match(/:/g) ?? []).length >= 3) return true
  if (/\b(operator|prospect|caller|agent)\s*:/i.test(trimmed)) return true
  return TRANSCRIPT_MARKERS.some((pattern) => pattern.test(trimmed))
}

export function looksLikeIrrelevantSmallTalk(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length > 80) return false
  return SMALL_TALK_MARKERS.some((pattern) => pattern.test(trimmed))
}

const INTERNAL_MEMORY_MARKERS = [
  /\bqa[_-]?marker\b/i,
  /\bcanonical bundle\b/i,
  /\bhuman_memory_kind\b/i,
  /\bmetadata\./i,
  /\baios\b/i,
  /\binstitutional learning\b/i,
]

const AI_REASONING_MARKERS = [
  /\bi noticed\b/i,
  /\bi've been thinking\b/i,
  /\bas an ai\b/i,
  /\bmy analysis\b/i,
  /\blet me recall\b/i,
]

export function sanitizeConclusionForMemory(conclusion: string): string | null {
  const sanitized = sanitizeMemoryEvidenceSnippet(conclusion)
  if (!sanitized || sanitized.length < 8) return null
  if (looksLikeRawTranscriptMemory(sanitized)) return null
  if (looksLikeIrrelevantSmallTalk(sanitized)) return null
  if (INTERNAL_MEMORY_MARKERS.some((pattern) => pattern.test(sanitized))) return null
  if (AI_REASONING_MARKERS.some((pattern) => pattern.test(sanitized))) return null
  return sanitized
}

export function isProfessionallyUsefulPersonalContext(text: string): boolean {
  const sanitized = sanitizeMemoryEvidenceSnippet(text)
  if (!sanitized || sanitized.length < 12) return false
  if (looksLikeRawTranscriptMemory(sanitized)) return false
  return /surgery|travel|family|empathy|sensitivity|availability|out of office|vacation/i.test(sanitized)
}

export function institutionalAdviceMustNotOverrideAccountFact(
  institutionalLine: string,
  accountFacts: string[],
): boolean {
  const normalizedInstitutional = institutionalLine.trim().toLowerCase()
  if (!normalizedInstitutional) return true
  return !accountFacts.some((fact) => {
    const normalizedFact = fact.trim().toLowerCase()
    return normalizedFact.length > 12 && normalizedInstitutional.includes(normalizedFact)
  })
}
