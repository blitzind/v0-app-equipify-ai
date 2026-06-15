/** Phase GS-3A — Knowledge ingestion service (client-safe). */

import { classifyKnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-classification"
import {
  KNOWLEDGE_CENTER_QA_MARKER,
  type KnowledgeDocument,
  type KnowledgeIngestionInput,
  type KnowledgeIngestionResult,
} from "@/lib/growth/knowledge-center/knowledge-document-types"

function normalizeTags(tags: string[] | undefined, classificationCategory: string, title: string): string[] {
  const set = new Set<string>()
  for (const tag of tags ?? []) {
    const normalized = tag.trim().toLowerCase()
    if (normalized) set.add(normalized)
  }
  set.add(classificationCategory)
  for (const token of title.toLowerCase().split(/[^a-z0-9]+/i)) {
    if (token.length >= 4) set.add(token)
  }
  return [...set].slice(0, 12)
}

function buildSummary(content: string, maxLength = 220): string {
  const trimmed = content.replace(/\s+/g, " ").trim()
  if (!trimmed) return "No content provided — human review required."
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1).trim()}…`
}

function resolveContent(input: KnowledgeIngestionInput): { content: string; warnings: string[] } {
  const warnings: string[] = []

  if (input.source_type === "faq") {
    const question = input.faq_question?.trim() ?? input.title.trim()
    const answer = input.faq_answer?.trim() ?? input.content?.trim() ?? ""
    if (!answer) warnings.push("FAQ answer missing — add answer content before activation.")
    return {
      content: `Q: ${question}\n\nA: ${answer}`,
      warnings,
    }
  }

  if (input.source_type === "url") {
    const url = input.source_url?.trim() ?? ""
    const body = input.content?.trim() ?? ""
    if (!url) warnings.push("URL source missing source_url.")
    if (!body) {
      warnings.push("URL content not fetched automatically — paste reviewed content or activate after review.")
    }
    return {
      content: body || (url ? `Source URL: ${url}\n\nContent pending human review.` : ""),
      warnings,
    }
  }

  if (input.source_type === "file") {
    const filename = input.source_filename?.trim() ?? ""
    const body = input.content?.trim() ?? ""
    if (!filename) warnings.push("File source missing source_filename metadata.")
    if (!body) {
      warnings.push("File text not extracted automatically — upload metadata only until human review completes.")
    }
    return {
      content: body || (filename ? `File: ${filename}\n\nExtracted content pending human review.` : ""),
      warnings,
    }
  }

  const text = input.content?.trim() ?? ""
  if (!text) warnings.push("Text note is empty — add content before activation.")
  return { content: text, warnings }
}

export function ingestKnowledgeDocument(
  input: KnowledgeIngestionInput,
  knowledge_document_id: string,
  timestamps?: { created_at?: string; updated_at?: string },
): KnowledgeIngestionResult {
  const now = timestamps?.created_at ?? new Date().toISOString()
  const updated_at = timestamps?.updated_at ?? now
  const { content, warnings: contentWarnings } = resolveContent(input)
  const title = input.title.trim()

  const classification = classifyKnowledgeDocument({
    title,
    content,
    source_type: input.source_type,
    source_url: input.source_url,
    source_filename: input.source_filename,
    tags: input.tags,
  })

  const categories = input.categories?.length
    ? [...new Set([...input.categories, classification.category])]
    : [classification.category]

  const tags = normalizeTags(input.tags, classification.category, title)
  const summary = buildSummary(content)
  const warnings = [...contentWarnings]
  if (input.status !== "archived" && (!content || content.includes("pending human review"))) {
    warnings.push("Document requires human review before downstream AI consumption.")
  }

  const document: KnowledgeDocument = {
    qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
    knowledge_document_id,
    organization_id: input.organization_id ?? null,
    source_type: input.source_type,
    title,
    content,
    summary,
    tags,
    categories,
    source_url: input.source_url?.trim() ?? null,
    source_filename: input.source_filename?.trim() ?? null,
    status: input.status ?? "draft",
    classification,
    visibility: input.visibility ?? "organization",
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at,
    created_by_user_id: input.created_by_user_id ?? null,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }

  return {
    qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
    document,
    summary,
    tags,
    classification,
    warnings,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}
