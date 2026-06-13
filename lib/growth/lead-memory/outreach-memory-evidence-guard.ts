/** Guards for memory evidence used in outbound personalization — client-safe. */

const AUTO_REPLY_PATTERNS = [
  /\bautomatic reply\b/i,
  /\bout of office\b/i,
  /\bauto[- ]?reply\b/i,
  /\[external\]/i,
  /\bthank you for (your )?(email|message|reaching out)\b/i,
  /\bdo not reply\b/i,
  /\bmail delivery (failed|subsystem)\b/i,
] as const

const INTERNAL_PIPELINE_TITLE_PATTERNS = [
  /^meeting interest detected$/i,
  /^budget signal detected$/i,
  /^timeline signal detected$/i,
  /^committee involvement detected$/i,
  /^buying signal detected$/i,
  /^engagement pattern recorded$/i,
  /^competitive context detected$/i,
] as const

export function isAutoReplyEvidence(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false
  return AUTO_REPLY_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function isInternalMemoryPipelineTitle(title: string): boolean {
  const normalized = title.trim()
  if (!normalized) return false
  return INTERNAL_PIPELINE_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function isRedactedContactName(name: string | null | undefined): boolean {
  const normalized = name?.trim() ?? ""
  if (!normalized) return true
  return /\*{2,}/.test(normalized)
}

export function hasEncodingCorruption(text: string): boolean {
  return /Ã¢Â|â€™|â€œ|â€/.test(text)
}

/** Memory/timeline/reply evidence must not enter outbound generation when true. */
export function isUnusableOutreachMemoryEvidence(input: {
  title?: string | null
  evidence?: string | null
}): boolean {
  const title = input.title?.trim() ?? ""
  const evidence = input.evidence?.trim() ?? ""
  const combined = `${title} ${evidence}`.trim()
  if (!combined) return true

  if (isAutoReplyEvidence(combined)) return true
  if (title && isInternalMemoryPipelineTitle(title)) return true
  if (hasEncodingCorruption(combined)) return true
  if (/\*{2,}/.test(combined)) return true

  return false
}

export function filterUsableOutreachMemorySnippet(text: string, maxLength: number): string | null {
  const trimmed = text.trim()
  if (!trimmed || isUnusableOutreachMemoryEvidence({ evidence: trimmed })) return null
  if (trimmed.length <= maxLength) return trimmed
  const cut = trimmed.slice(0, maxLength - 1)
  const space = cut.lastIndexOf(" ")
  const snippet = `${(space > 24 ? cut.slice(0, space) : cut).trim()}…`
  if (isUnusableOutreachMemoryEvidence({ evidence: snippet })) return null
  return snippet
}
