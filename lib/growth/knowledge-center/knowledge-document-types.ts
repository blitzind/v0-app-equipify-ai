/** Phase GS-3A — Knowledge Center document types (client-safe). */

export const KNOWLEDGE_CENTER_QA_MARKER = "growth-knowledge-center-gs3a-v1" as const

export const KNOWLEDGE_CENTER_CONFIRM = "RUN_KNOWLEDGE_CENTER_FOUNDATION_CERTIFICATION" as const

export const KNOWLEDGE_SOURCE_TYPES = ["url", "file", "text", "faq"] as const
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number]

export const KNOWLEDGE_DOCUMENT_STATUSES = ["draft", "active", "archived"] as const
export type KnowledgeDocumentStatus = (typeof KNOWLEDGE_DOCUMENT_STATUSES)[number]

export const KNOWLEDGE_VISIBILITY_LEVELS = ["organization", "private"] as const
export type KnowledgeVisibility = (typeof KNOWLEDGE_VISIBILITY_LEVELS)[number]

export const KNOWLEDGE_CATEGORIES = [
  "product",
  "pricing",
  "faq",
  "competitor",
  "playbook",
  "case_study",
  "objection",
  "training",
  "meeting",
  "call",
  "other",
] as const
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number]

export type KnowledgeClassification = {
  category: KnowledgeCategory
  confidence: number
  reasons: string[]
}

export type KnowledgeDocument = {
  qa_marker: typeof KNOWLEDGE_CENTER_QA_MARKER
  knowledge_document_id: string
  audit_event_id?: string | null
  organization_id: string | null
  source_type: KnowledgeSourceType
  title: string
  content: string
  summary: string
  tags: string[]
  categories: KnowledgeCategory[]
  source_url: string | null
  source_filename: string | null
  status: KnowledgeDocumentStatus
  classification: KnowledgeClassification
  visibility: KnowledgeVisibility
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  created_by_user_id: string | null
  requires_human_review: true
  autonomous_execution_enabled: false
}

export type KnowledgeIngestionInput = {
  organization_id?: string | null
  source_type: KnowledgeSourceType
  title: string
  content?: string | null
  source_url?: string | null
  source_filename?: string | null
  tags?: string[]
  categories?: KnowledgeCategory[]
  visibility?: KnowledgeVisibility
  status?: KnowledgeDocumentStatus
  metadata?: Record<string, unknown>
  faq_question?: string | null
  faq_answer?: string | null
  created_by_user_id?: string | null
}

export type KnowledgeIngestionResult = {
  qa_marker: typeof KNOWLEDGE_CENTER_QA_MARKER
  document: KnowledgeDocument
  summary: string
  tags: string[]
  classification: KnowledgeClassification
  warnings: string[]
  requires_human_review: true
  autonomous_execution_enabled: false
}

export type KnowledgeSearchInput = {
  query?: string | null
  tags?: string[]
  category?: KnowledgeCategory | null
  status?: KnowledgeDocumentStatus | null
  visibility?: KnowledgeVisibility | null
  source_type?: KnowledgeSourceType | null
  organization_id?: string | null
  limit?: number
}

export type KnowledgeSearchHit = {
  document: KnowledgeDocument
  score: number
  matched_fields: string[]
}

export type KnowledgeSearchResult = {
  qa_marker: typeof KNOWLEDGE_CENTER_QA_MARKER
  generated_at: string
  query: string | null
  total: number
  hits: KnowledgeSearchHit[]
  autonomous_execution_enabled: false
}

export const KNOWLEDGE_FUTURE_CONSUMERS = [
  "Prospect Discovery",
  "Company Intelligence",
  "Account Playbooks",
  "Reply Intelligence",
  "Meeting Prep",
  "Call Coaching",
  "AI SDR Personas",
  "Growth Agents",
] as const

export type KnowledgeFutureConsumer = (typeof KNOWLEDGE_FUTURE_CONSUMERS)[number]

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  product: "Product",
  pricing: "Pricing",
  faq: "FAQ",
  competitor: "Competitor",
  playbook: "Playbook",
  case_study: "Case Study",
  objection: "Objection",
  training: "Training",
  meeting: "Meeting",
  call: "Call",
  other: "Other",
}

export const KNOWLEDGE_SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  url: "URL",
  file: "File",
  text: "Note",
  faq: "FAQ",
}
