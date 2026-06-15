/** Phase GS-3B — Deterministic knowledge retrieval service (client-safe). */

import type { KnowledgeCategory, KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"
import { KNOWLEDGE_CATEGORIES } from "@/lib/growth/knowledge-center/knowledge-document-types"
import {
  KNOWLEDGE_EXCLUDED_RETRIEVAL_STATUSES,
  KNOWLEDGE_RETRIEVAL_QA_MARKER,
  KNOWLEDGE_RETRIEVAL_RELEVANCE_WEIGHTS,
  type KnowledgeRetrievalRequest,
  type KnowledgeRetrievalResult,
  type KnowledgeRetrievalScoredDocument,
} from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function isExcludedStatus(document: KnowledgeDocument): boolean {
  if (document.status !== "active") return true
  if ((KNOWLEDGE_EXCLUDED_RETRIEVAL_STATUSES as readonly string[]).includes(document.status)) return true
  if (document.metadata.knowledge_review_status === "review") return true
  return false
}

function normalizeCategories(values: string[] | undefined): KnowledgeCategory[] {
  if (!values?.length) return []
  return values.filter((value): value is KnowledgeCategory =>
    (KNOWLEDGE_CATEGORIES as readonly string[]).includes(value),
  )
}

function documentMatchesVisibility(
  document: KnowledgeDocument,
  request: KnowledgeRetrievalRequest,
): boolean {
  if (request.organization_id) {
    if (!document.organization_id || document.organization_id !== request.organization_id) {
      return false
    }
  } else if (document.organization_id) {
    return false
  }

  if (document.visibility === "organization") return true
  if (document.visibility !== "private") return false
  if (!request.include_private) return false

  const metaLead = typeof document.metadata.lead_id === "string" ? document.metadata.lead_id : null
  const metaCompany =
    typeof document.metadata.company_id === "string" ? document.metadata.company_id : null

  if (request.lead_id && metaLead && request.lead_id !== metaLead) return false
  if (request.company_id && metaCompany && request.company_id !== metaCompany) return false

  return true
}

function documentMatchesScope(
  document: KnowledgeDocument,
  request: KnowledgeRetrievalRequest,
  categories: KnowledgeCategory[],
  tags: string[],
): boolean {
  if (isExcludedStatus(document)) return false
  if (!documentMatchesVisibility(document, request)) return false

  if (categories.length > 0) {
    const hasCategory = categories.some((category) => document.categories.includes(category))
    if (!hasCategory) return false
  }

  if (tags.length > 0) {
    const docTags = new Set(document.tags.map((tag) => tag.toLowerCase()))
    const hasTag = tags.some((tag) => docTags.has(tag.toLowerCase()))
    if (!hasTag) return false
  }

  if (request.lead_id) {
    const metaLead = typeof document.metadata.lead_id === "string" ? document.metadata.lead_id : null
    if (metaLead && metaLead !== request.lead_id) return false
  }

  if (request.company_id) {
    const metaCompany =
      typeof document.metadata.company_id === "string" ? document.metadata.company_id : null
    if (metaCompany && metaCompany !== request.company_id) return false
  }

  return true
}

export function scoreKnowledgeDocumentRelevance(
  document: KnowledgeDocument,
  request: KnowledgeRetrievalRequest,
  categories: KnowledgeCategory[],
  tags: string[],
): KnowledgeRetrievalScoredDocument {
  let score = 0
  const matched_fields: string[] = []
  const queryTokens = tokenize(request.query ?? "")
  const industry = request.industry?.trim().toLowerCase() ?? ""
  const titleCorpus = document.title.toLowerCase()
  const contentCorpus = `${document.summary} ${document.content}`.toLowerCase()
  const tagSet = new Set(document.tags.map((tag) => tag.toLowerCase()))

  if (queryTokens.length > 0) {
    for (const token of queryTokens) {
      if (titleCorpus.includes(token)) {
        score += KNOWLEDGE_RETRIEVAL_RELEVANCE_WEIGHTS.title
        if (!matched_fields.includes("title")) matched_fields.push("title")
      } else if (contentCorpus.includes(token)) {
        score += KNOWLEDGE_RETRIEVAL_RELEVANCE_WEIGHTS.keyword
        if (!matched_fields.includes("keyword")) matched_fields.push("keyword")
      }
    }
  }

  if (categories.length > 0) {
    const matched = categories.filter((category) => document.categories.includes(category))
    if (matched.length > 0) {
      score += KNOWLEDGE_RETRIEVAL_RELEVANCE_WEIGHTS.category
      matched_fields.push("category")
    }
  }

  if (tags.length > 0) {
    const matched = tags.filter((tag) => tagSet.has(tag.toLowerCase()))
    if (matched.length > 0) {
      score += KNOWLEDGE_RETRIEVAL_RELEVANCE_WEIGHTS.tag
      matched_fields.push("tag")
    }
  }

  if (industry) {
    const industryCorpus = `${document.title} ${document.content} ${document.tags.join(" ")} ${JSON.stringify(document.metadata)}`.toLowerCase()
    if (industryCorpus.includes(industry)) {
      score += KNOWLEDGE_RETRIEVAL_RELEVANCE_WEIGHTS.industry
      matched_fields.push("industry")
    }
  }

  if (queryTokens.length === 0 && categories.length === 0 && tags.length === 0 && !industry) {
    score = 25
    matched_fields.push("consumer_defaults")
  }

  return {
    document,
    relevance_score: Math.min(100, score),
    matched_fields,
  }
}

export function retrieveKnowledge(
  documents: KnowledgeDocument[],
  request: KnowledgeRetrievalRequest,
  resolvedCategories: KnowledgeCategory[],
  resolvedTags: string[],
): KnowledgeRetrievalResult {
  const warnings: string[] = []
  const limit = Math.min(Math.max(request.limit ?? 12, 1), 50)
  const categories = normalizeCategories(resolvedCategories.length ? resolvedCategories : request.categories)
  const tags = (resolvedTags.length ? resolvedTags : request.tags ?? []).map((tag) => tag.toLowerCase())

  const eligible = documents.filter((document) => documentMatchesScope(document, request, categories, tags))

  if (eligible.length === 0) {
    warnings.push("No active knowledge documents matched retrieval scope.")
  }

  const inactiveCount = documents.filter(
    (doc) => doc.organization_id === request.organization_id && isExcludedStatus(doc),
  ).length
  if (inactiveCount > 0) {
    warnings.push(`${inactiveCount} non-active documents excluded from retrieval.`)
  }

  const scored = eligible
    .map((document) => scoreKnowledgeDocumentRelevance(document, request, categories, tags))
    .sort(
      (a, b) =>
        b.relevance_score - a.relevance_score ||
        Date.parse(b.document.updated_at) - Date.parse(a.document.updated_at),
    )

  const top = scored.slice(0, limit)
  const matched_categories = [
    ...new Set(top.flatMap((item) => item.document.categories).filter((cat) => categories.includes(cat))),
  ]
  const matched_tags = [
    ...new Set(
      top
        .flatMap((item) => item.document.tags)
        .filter((tag) => tags.includes(tag.toLowerCase())),
    ),
  ]

  const relevance_score = top.length > 0 ? Math.max(...top.map((item) => item.relevance_score)) : 0

  return {
    qa_marker: KNOWLEDGE_RETRIEVAL_QA_MARKER,
    generated_at: new Date().toISOString(),
    consumer: request.consumer,
    documents: top.map((item) => item.document),
    matched_categories,
    matched_tags,
    relevance_score,
    warnings,
    consumer_context: {},
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}
