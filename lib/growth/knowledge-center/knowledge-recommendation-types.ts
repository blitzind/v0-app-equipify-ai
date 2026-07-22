/** Phase GS-3D — Knowledge recommendation contracts (client-safe). */

export {
  PLATFORM_KNOWLEDGE_RECOMMENDATION_CONFIRM as KNOWLEDGE_RECOMMENDATION_CONFIRM,
  PLATFORM_KNOWLEDGE_RECOMMENDATION_GENERATED_EVENT as KNOWLEDGE_RECOMMENDATION_GENERATED_EVENT,
  PLATFORM_KNOWLEDGE_RECOMMENDATION_QA_MARKER as KNOWLEDGE_RECOMMENDATION_QA_MARKER,
  PLATFORM_KNOWLEDGE_RECOMMENDATION_TYPE_LABELS as KNOWLEDGE_RECOMMENDATION_TYPE_LABELS,
  PLATFORM_KNOWLEDGE_CONSUMER_RECOMMENDATION_TYPES as KNOWLEDGE_CONSUMER_RECOMMENDATION_TYPES,
} from "@fuzor/knowledge"

export type {
  PlatformKnowledgeCitation as KnowledgeCitation,
  PlatformKnowledgeRecommendation as KnowledgeRecommendation,
  PlatformKnowledgeRecommendationGenerateRequest as KnowledgeRecommendationGenerateRequest,
  PlatformKnowledgeRecommendationGenerateResult as KnowledgeRecommendationGenerateResult,
  PlatformKnowledgeRecommendationPriority as KnowledgeRecommendationPriority,
} from "@fuzor/knowledge"
