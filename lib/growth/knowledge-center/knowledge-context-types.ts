/** Phase GS-3C — Knowledge context injection contracts (client-safe). */

export {
  PLATFORM_KNOWLEDGE_CONTEXT_CONFIRM as KNOWLEDGE_CONTEXT_CONFIRM,
  PLATFORM_KNOWLEDGE_CONTEXT_QA_MARKER as KNOWLEDGE_CONTEXT_QA_MARKER,
  PLATFORM_KNOWLEDGE_CONTEXT_RETRIEVED_EVENT as KNOWLEDGE_CONTEXT_RETRIEVED_EVENT,
} from "@fuzor/knowledge"

export type {
  PlatformKnowledgeConsumerContext as KnowledgeConsumerContext,
  PlatformKnowledgeConsumerContextCounts as KnowledgeConsumerContextCounts,
  PlatformKnowledgeContextInjectionRequest as KnowledgeContextInjectionRequest,
  PlatformKnowledgeContextInjectionResult as KnowledgeContextInjectionResult,
} from "@fuzor/knowledge"
