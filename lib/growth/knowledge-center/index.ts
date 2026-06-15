/** Phase GS-3A — Knowledge Center foundation exports. */

export {
  KNOWLEDGE_CENTER_CONFIRM,
  KNOWLEDGE_CENTER_QA_MARKER,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  KNOWLEDGE_DOCUMENT_STATUSES,
  KNOWLEDGE_FUTURE_CONSUMERS,
  KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_SOURCE_TYPE_LABELS,
  KNOWLEDGE_VISIBILITY_LEVELS,
  type KnowledgeCategory,
  type KnowledgeClassification,
  type KnowledgeDocument,
  type KnowledgeDocumentStatus,
  type KnowledgeFutureConsumer,
  type KnowledgeIngestionInput,
  type KnowledgeIngestionResult,
  type KnowledgeSearchHit,
  type KnowledgeSearchInput,
  type KnowledgeSearchResult,
  type KnowledgeSourceType,
  type KnowledgeVisibility,
} from "@/lib/growth/knowledge-center/knowledge-document-types"

export { classifyKnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-classification"
export { ingestKnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-ingestion-service"
export { searchKnowledge } from "@/lib/growth/knowledge-center/knowledge-search"
