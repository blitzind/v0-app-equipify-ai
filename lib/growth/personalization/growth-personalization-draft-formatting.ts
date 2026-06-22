/** GS-AI-PLAYBOOK-4D.2 — Display-only draft paragraph formatting (client-safe). */

export const PERSONALIZATION_DRAFT_MAX_PARAGRAPH_CHARS = 220
export const PERSONALIZATION_DRAFT_MAX_SENTENCES_PER_PARAGRAPH = 2
export const PERSONALIZATION_DRAFT_DESKTOP_MAX_CHARS = 320
export const PERSONALIZATION_DRAFT_MOBILE_MAX_CHARS = 165

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z0-9"(\[])/

const TRANSITION_PHRASES = [
  "However,",
  "That said,",
  "Additionally,",
  "Also,",
  "For example,",
  "Specifically,",
  "In many cases,",
  "As a result,",
  "Because of this,",
  "With that in mind,",
] as const

const BULLET_LINE_RE = /^\s*(?:[•\-]|(?:\d+\.))\s+/

const CTA_SENTENCE_RE =
  /^(?:happy to|open to|would it be|would next|let me know|feel free to|i(?:'|’)d be happy to)\b/i

function normalizeDraftBody(body: string): string {
  const transitionBreakPattern = TRANSITION_PHRASES.map((phrase) =>
    phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|")

  return body
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(?<=[.!?])\n(?=[A-Z0-9"(\[])/g, "\n\n")
    .replace(new RegExp(`\\n(?=(?:${transitionBreakPattern}))`, "g"), "\n\n")
    .trim()
}

function collapseInlineWhitespace(text: string): string {
  return text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim()
}

function splitSentences(text: string): string[] {
  const normalized = collapseInlineWhitespace(text)
  if (!normalized) return []
  const parts = normalized.split(SENTENCE_SPLIT_RE).map((entry) => entry.trim()).filter(Boolean)
  return parts.length > 0 ? parts : [normalized]
}

function isBulletLine(line: string): boolean {
  return BULLET_LINE_RE.test(line)
}

function startsWithTransitionPhrase(sentence: string): boolean {
  const trimmed = sentence.trim()
  return TRANSITION_PHRASES.some((phrase) => trimmed.startsWith(phrase))
}

function isCtaSentence(sentence: string): boolean {
  const trimmed = sentence.trim()
  if (!trimmed) return false
  if (trimmed.endsWith("?")) return true
  return CTA_SENTENCE_RE.test(trimmed)
}

function joinSentences(sentences: string[]): string {
  return sentences.join(" ").trim()
}

function sentenceCount(paragraph: string): number {
  return splitSentences(paragraph).length
}

function mergeSalutationClause(clauses: string[]): string[] {
  if (clauses.length <= 1) return clauses
  if (/^(Hi|Hello|Hey|Dear)\b/i.test(clauses[0]!)) {
    return [`${clauses[0]}, ${clauses[1]}`, ...clauses.slice(2)]
  }
  return clauses
}

function splitLongSentence(sentence: string, maxChars = PERSONALIZATION_DRAFT_MAX_PARAGRAPH_CHARS): string[] {
  const trimmed = sentence.trim()
  if (trimmed.length <= maxChars) return [trimmed]

  const clauses = mergeSalutationClause(
    trimmed.split(/,\s+/).map((entry) => entry.trim()).filter(Boolean),
  )
  if (clauses.length <= 1) return [trimmed]

  const chunks: string[] = []
  let current = ""

  for (let index = 0; index < clauses.length; index += 1) {
    const clause = clauses[index]!
    const next = current ? `${current}, ${clause}` : clause
    if (next.length > maxChars && current) {
      chunks.push(current.endsWith(".") ? current : `${current}.`)
      current = clause
    } else {
      current = next
    }
  }

  if (current) {
    chunks.push(current.endsWith(".") || current.endsWith("?") || current.endsWith("!") ? current : `${current}.`)
  }

  return chunks.length > 0 ? chunks : [trimmed]
}

function groupSentencesIntoParagraphs(sentences: string[]): string[] {
  const paragraphs: string[] = []

  for (const sentence of sentences) {
    for (const unit of splitLongSentence(sentence)) {
      paragraphs.push(unit)
    }
  }

  return paragraphs
}

function enforceDisplayLineLimits(paragraphs: string[]): string[] {
  const result: string[] = []

  for (const paragraph of paragraphs) {
    if (isBulletLine(paragraph) || isCtaSentence(paragraph)) {
      result.push(paragraph)
      continue
    }

    if (
      paragraph.length <= PERSONALIZATION_DRAFT_MAX_PARAGRAPH_CHARS &&
      sentenceCount(paragraph) <= PERSONALIZATION_DRAFT_MAX_SENTENCES_PER_PARAGRAPH
    ) {
      result.push(paragraph)
      continue
    }

    const sentences = splitSentences(paragraph)
    if (sentences.length <= 1) {
      if (paragraph.length <= PERSONALIZATION_DRAFT_DESKTOP_MAX_CHARS) {
        result.push(paragraph)
        continue
      }
      result.push(...splitLongSentence(paragraph, PERSONALIZATION_DRAFT_MAX_PARAGRAPH_CHARS))
      continue
    }

    result.push(...groupSentencesIntoParagraphs(sentences))
  }

  return result.filter(Boolean)
}

function formatProseBlock(text: string): string[] {
  const sentences = splitSentences(text)
  if (!sentences.length) return []
  return enforceDisplayLineLimits(groupSentencesIntoParagraphs(sentences))
}

function formatDraftBlock(block: string): string[] {
  const trimmed = block.trim()
  if (!trimmed) return []

  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean)
  if (lines.some(isBulletLine)) {
    const paragraphs: string[] = []
    let proseBuffer: string[] = []

    const flushProse = () => {
      if (!proseBuffer.length) return
      paragraphs.push(...formatProseBlock(proseBuffer.join(" ")))
      proseBuffer = []
    }

    for (const line of lines) {
      if (isBulletLine(line)) {
        flushProse()
        paragraphs.push(line)
      } else {
        proseBuffer.push(line)
      }
    }

    flushProse()
    return paragraphs
  }

  return formatProseBlock(lines.join(" "))
}

function formatExistingParagraphBlock(block: string): string[] {
  const trimmed = block.trim()
  if (!trimmed) return []

  if (trimmed.split("\n").some((line) => isBulletLine(line.trim()))) {
    return formatDraftBlock(trimmed)
  }

  const prose = collapseInlineWhitespace(trimmed)
  if (!prose) return []

  const sentences = splitSentences(prose)
  if (
    prose.length <= PERSONALIZATION_DRAFT_MAX_PARAGRAPH_CHARS &&
    sentences.length <= PERSONALIZATION_DRAFT_MAX_SENTENCES_PER_PARAGRAPH
  ) {
    return [prose]
  }

  return enforceDisplayLineLimits(groupSentencesIntoParagraphs(sentences))
}

/**
 * Formats generated copy into readable paragraphs for operator preview.
 * Does not mutate stored draft content.
 */
export function formatPersonalizationDraftBodyParagraphsForDisplay(body: string): string[] {
  const normalized = normalizeDraftBody(body)
  if (!normalized) return []

  const blocks = normalized.split(/\n\n+/)
  if (blocks.length === 1) {
    return formatDraftBlock(blocks[0]!)
  }

  const paragraphs: string[] = []
  for (const block of blocks) {
    paragraphs.push(...formatExistingParagraphBlock(block))
  }

  return paragraphs.filter(Boolean)
}

export function formatPersonalizationDraftBodyForDisplay(body: string): string {
  return formatPersonalizationDraftBodyParagraphsForDisplay(body).join("\n\n")
}

export function formatPersonalizationDraftTimestamp(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export type PersonalizationDraftPreviewSectionKey =
  | "subject"
  | "opening"
  | "problem"
  | "value"
  | "cta"

export type PersonalizationDraftPreviewSection = {
  key: PersonalizationDraftPreviewSectionKey
  label: string
  content: string
}

/**
 * Splits a draft body into operator-friendly preview cards (display only).
 */
export function buildPersonalizationDraftPreviewSections(input: {
  subject: string
  body: string
}): PersonalizationDraftPreviewSection[] {
  const paragraphs = formatPersonalizationDraftBodyParagraphsForDisplay(input.body)

  const sections: PersonalizationDraftPreviewSection[] = [
    { key: "subject", label: "Subject", content: input.subject.trim() },
  ]

  if (paragraphs.length === 0) {
    return sections
  }

  if (paragraphs.length === 1) {
    sections.push({ key: "opening", label: "Opening", content: paragraphs[0]! })
    return sections
  }

  if (paragraphs.length === 2) {
    sections.push({ key: "opening", label: "Opening", content: paragraphs[0]! })
    sections.push({ key: "cta", label: "CTA", content: paragraphs[1]! })
    return sections
  }

  if (paragraphs.length === 3) {
    sections.push({ key: "opening", label: "Opening", content: paragraphs[0]! })
    sections.push({ key: "value", label: "Value", content: paragraphs[1]! })
    sections.push({ key: "cta", label: "CTA", content: paragraphs[2]! })
    return sections
  }

  sections.push({ key: "opening", label: "Opening", content: paragraphs[0]! })
  sections.push({ key: "problem", label: "Problem", content: paragraphs[1]! })
  sections.push({
    key: "value",
    label: "Value",
    content: paragraphs.slice(2, -1).join("\n\n"),
  })
  sections.push({ key: "cta", label: "CTA", content: paragraphs[paragraphs.length - 1]! })
  return sections
}
