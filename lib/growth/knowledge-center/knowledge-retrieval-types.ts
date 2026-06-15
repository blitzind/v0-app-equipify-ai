/** Phase GS-3B — Knowledge retrieval types (client-safe). */

import type { KnowledgeCategory, KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"

export const KNOWLEDGE_RETRIEVAL_QA_MARKER = "growth-knowledge-retrieval-gs3b-v1" as const

export const KNOWLEDGE_RETRIEVAL_CONFIRM = "RUN_KNOWLEDGE_RETRIEVAL_LAYER_CERTIFICATION" as const

export const KNOWLEDGE_CONSUMERS = [
  "prospect_discovery",
  "reply_intelligence",
  "meeting_prep",
  "sequence_builder",
  "voice_drop",
  "call_coaching",
  "opportunity_intelligence",
] as const

export type KnowledgeConsumer = (typeof KNOWLEDGE_CONSUMERS)[number]

export const KNOWLEDGE_CONSUMER_LABELS: Record<KnowledgeConsumer, string> = {
  prospect_discovery: "Prospect Discovery",
  reply_intelligence: "Reply Intelligence",
  meeting_prep: "Meeting Prep",
  sequence_builder: "Sequence Builder",
  voice_drop: "Voice Drops",
  call_coaching: "Call Coaching",
  opportunity_intelligence: "Opportunity Intelligence",
}

export type KnowledgeRetrievalRequest = {
  organization_id: string
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

export type KnowledgeRetrievalResult = {
  qa_marker: typeof KNOWLEDGE_RETRIEVAL_QA_MARKER
  generated_at: string
  consumer: KnowledgeConsumer
  documents: KnowledgeDocument[]
  matched_categories: string[]
  matched_tags: string[]
  relevance_score: number
  warnings: string[]
  consumer_context: Record<string, unknown>
  requires_human_review: true
  autonomous_execution_enabled: false
}

export type KnowledgeRetrievalScoredDocument = {
  document: KnowledgeDocument
  relevance_score: number
  matched_fields: string[]
}

export const KNOWLEDGE_RETRIEVAL_RELEVANCE_WEIGHTS = {
  title: 40,
  category: 20,
  tag: 15,
  industry: 15,
  keyword: 10,
} as const

export const KNOWLEDGE_CONSUMER_DEFAULT_CATEGORIES: Record<KnowledgeConsumer, KnowledgeCategory[]> = {
  prospect_discovery: ["playbook", "competitor", "product", "training", "other"],
  reply_intelligence: ["faq", "objection", "pricing", "competitor"],
  meeting_prep: ["case_study", "objection", "playbook", "competitor", "pricing"],
  sequence_builder: ["playbook", "product", "case_study", "other"],
  voice_drop: ["call", "playbook", "objection", "product"],
  call_coaching: ["objection", "call", "training", "competitor"],
  opportunity_intelligence: ["pricing", "competitor", "playbook", "case_study", "product"],
}

export const KNOWLEDGE_CONSUMER_DEFAULT_TAGS: Record<KnowledgeConsumer, string[]> = {
  prospect_discovery: ["icp", "qualification", "industry"],
  reply_intelligence: ["objection", "faq", "competitor"],
  meeting_prep: ["case_study", "discovery", "competitor"],
  sequence_builder: ["messaging", "value_prop", "cta"],
  voice_drop: ["script", "persona", "positioning"],
  call_coaching: ["objection", "discovery", "talk_track"],
  opportunity_intelligence: ["roi", "pricing", "implementation"],
}

export const KNOWLEDGE_EXCLUDED_RETRIEVAL_STATUSES = ["draft", "archived", "review"] as const
