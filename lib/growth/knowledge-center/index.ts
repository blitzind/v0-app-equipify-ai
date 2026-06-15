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

export {
  KNOWLEDGE_CONSUMER_DEFAULT_CATEGORIES,
  KNOWLEDGE_CONSUMER_DEFAULT_TAGS,
  KNOWLEDGE_CONSUMER_LABELS,
  KNOWLEDGE_CONSUMERS,
  KNOWLEDGE_EXCLUDED_RETRIEVAL_STATUSES,
  KNOWLEDGE_RETRIEVAL_CONFIRM,
  KNOWLEDGE_RETRIEVAL_QA_MARKER,
  KNOWLEDGE_RETRIEVAL_RELEVANCE_WEIGHTS,
  type KnowledgeConsumer,
  type KnowledgeRetrievalRequest,
  type KnowledgeRetrievalResult,
  type KnowledgeRetrievalScoredDocument,
} from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

export {
  retrieveKnowledge,
  scoreKnowledgeDocumentRelevance,
} from "@/lib/growth/knowledge-center/knowledge-retrieval-service"

export {
  buildConsumerContext,
  resolveConsumerRetrievalScope,
  retrieveKnowledgeForConsumer,
} from "@/lib/growth/knowledge-center/knowledge-consumer-adapters"
