/** Phase GS-3C — Knowledge consumer context types (client-safe). */

import type { KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"
import type { KnowledgeConsumer } from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

export const KNOWLEDGE_CONTEXT_QA_MARKER = "growth-knowledge-context-gs3c-v1" as const

export const KNOWLEDGE_CONTEXT_CONFIRM = "RUN_KNOWLEDGE_CONTEXT_INJECTION_CERTIFICATION" as const

export const KNOWLEDGE_CONTEXT_RETRIEVED_EVENT = "knowledge_context_retrieved" as const

export type KnowledgeConsumerContextCounts = {
  total: number
  playbooks: number
  objections: number
  competitors: number
  case_studies: number
  faqs: number
  pricing_notes: number
}

export type KnowledgeConsumerContext = {
  qa_marker: typeof KNOWLEDGE_CONTEXT_QA_MARKER
  consumer: KnowledgeConsumer
  documents: KnowledgeDocument[]
  playbooks: KnowledgeDocument[]
  objections: KnowledgeDocument[]
  competitors: KnowledgeDocument[]
  case_studies: KnowledgeDocument[]
  faqs: KnowledgeDocument[]
  pricing_notes: KnowledgeDocument[]
  counts: KnowledgeConsumerContextCounts
  warnings: string[]
  relevance_score: number
  matched_categories: string[]
  matched_tags: string[]
  consumer_context: Record<string, unknown>
  requires_human_review: true
  autonomous_execution_enabled: false
}

export type KnowledgeContextInjectionRequest = {
  organization_id?: string | null
  consumer: KnowledgeConsumer
  categories?: string[]
  tags?: string[]
  industry?: string
  company_id?: string
  lead_id?: string
  query?: string
  limit?: number
  include_private?: boolean
}

export type KnowledgeContextInjectionResult = KnowledgeConsumerContext & {
  audit_event_id?: string | null
}
