/** Phase GS-3A — Deterministic knowledge search (client-safe). */

import type {
  KnowledgeDocument,
  KnowledgeSearchHit,
  KnowledgeSearchInput,
  KnowledgeSearchResult,
} from "@/lib/growth/knowledge-center/knowledge-document-types"
import { KNOWLEDGE_CENTER_QA_MARKER } from "@/lib/growth/knowledge-center/knowledge-document-types"

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function scoreDocument(document: KnowledgeDocument, queryTokens: string[]): KnowledgeSearchHit | null {
  if (queryTokens.length === 0) return null

  let score = 0
  const matched_fields: string[] = []
  const titleTokens = tokenize(document.title)
  const tagTokens = document.tags.flatMap(tokenize)
  const categoryTokens = document.categories.flatMap(tokenize)
  const contentTokens = tokenize(`${document.summary} ${document.content}`).slice(0, 120)

  for (const query of queryTokens) {
    if (titleTokens.some((token) => token.includes(query) || query.includes(token))) {
      score += 24
      if (!matched_fields.includes("title")) matched_fields.push("title")
    }
    if (tagTokens.some((token) => token.includes(query) || query.includes(token))) {
      score += 18
      if (!matched_fields.includes("tags")) matched_fields.push("tags")
    }
    if (categoryTokens.some((token) => token.includes(query) || query.includes(token))) {
      score += 16
      if (!matched_fields.includes("categories")) matched_fields.push("categories")
    }
    if (contentTokens.some((token) => token.includes(query) || query.includes(token))) {
      score += 10
      if (!matched_fields.includes("content")) matched_fields.push("content")
    }
    if ((document.source_url ?? "").toLowerCase().includes(query)) {
      score += 8
      if (!matched_fields.includes("source_url")) matched_fields.push("source_url")
    }
  }

  if (score === 0) return null
  return { document, score, matched_fields }
}

function filterDocument(document: KnowledgeDocument, input: KnowledgeSearchInput): boolean {
  if (input.organization_id && document.organization_id !== input.organization_id) return false
  if (input.status && document.status !== input.status) return false
  if (input.visibility && document.visibility !== input.visibility) return false
  if (input.source_type && document.source_type !== input.source_type) return false
  if (input.category && !document.categories.includes(input.category)) return false
  if (input.tags && input.tags.length > 0) {
    const docTags = new Set(document.tags.map((tag) => tag.toLowerCase()))
    const matchesTag = input.tags.some((tag) => docTags.has(tag.toLowerCase()))
    if (!matchesTag) return false
  }
  return true
}

export function searchKnowledge(
  documents: KnowledgeDocument[],
  input: KnowledgeSearchInput = {},
): KnowledgeSearchResult {
  const query = input.query?.trim() ?? ""
  const queryTokens = tokenize(query)
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)

  const filtered = documents.filter((document) => filterDocument(document, input))

  let hits: KnowledgeSearchHit[]

  if (queryTokens.length === 0) {
    hits = filtered
      .map((document) => ({
        document,
        score: document.status === "active" ? 50 : document.status === "draft" ? 40 : 20,
        matched_fields: ["filter"],
      }))
      .sort((a, b) => Date.parse(b.document.updated_at) - Date.parse(a.document.updated_at))
  } else {
    hits = filtered
      .map((document) => scoreDocument(document, queryTokens))
      .filter((hit): hit is KnowledgeSearchHit => hit !== null)
      .sort((a, b) => b.score - a.score || Date.parse(b.document.updated_at) - Date.parse(a.document.updated_at))
  }

  return {
    qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
    generated_at: new Date().toISOString(),
    query: query || null,
    total: hits.length,
    hits: hits.slice(0, limit),
    autonomous_execution_enabled: false,
  }
}
