/** Phase GS-3C — Knowledge context injection (client-safe build + server inject). */

import { retrieveKnowledgeForConsumer } from "@/lib/growth/knowledge-center/knowledge-consumer-adapters"
import {
  buildConsumerSpecificContextMetadata,
  buildContextCounts,
  consumerBucketDocuments,
} from "@/lib/growth/knowledge-center/knowledge-consumer-wiring"
import type { KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"
import type {
  KnowledgeConsumerContext,
  KnowledgeContextInjectionRequest,
  KnowledgeContextInjectionResult,
} from "@/lib/growth/knowledge-center/knowledge-context-types"
import { KNOWLEDGE_CONTEXT_QA_MARKER } from "@/lib/growth/knowledge-center/knowledge-context-types"
import type { KnowledgeRetrievalRequest, KnowledgeRetrievalResult } from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

export function buildKnowledgeConsumerContext(
  retrieval: KnowledgeRetrievalResult,
  documents: KnowledgeDocument[],
): KnowledgeConsumerContext {
  const buckets = consumerBucketDocuments(retrieval.consumer, documents)
  const counts = buildContextCounts(documents, buckets)
  const consumerMetadata = buildConsumerSpecificContextMetadata(retrieval.consumer, counts)

  const warnings = [...retrieval.warnings]
  if (documents.length === 0) {
    warnings.push("No active knowledge documents available for this consumer scope.")
  }
  warnings.push("Read-only context injection — no generated summaries or autonomous actions.")

  return {
    qa_marker: KNOWLEDGE_CONTEXT_QA_MARKER,
    consumer: retrieval.consumer,
    documents,
    playbooks: buckets.playbooks,
    objections: buckets.objections,
    competitors: buckets.competitors,
    case_studies: buckets.case_studies,
    faqs: buckets.faqs,
    pricing_notes: buckets.pricing_notes,
    counts,
    warnings,
    relevance_score: retrieval.relevance_score,
    matched_categories: retrieval.matched_categories,
    matched_tags: retrieval.matched_tags,
    consumer_context: consumerMetadata,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export function buildKnowledgeConsumerContextFromDocuments(
  request: KnowledgeContextInjectionRequest & { organization_id: string },
  allDocuments: KnowledgeDocument[],
): KnowledgeConsumerContext {
  const retrievalRequest: KnowledgeRetrievalRequest = {
    organization_id: request.organization_id,
    consumer: request.consumer,
    categories: request.categories,
    tags: request.tags,
    industry: request.industry,
    company_id: request.company_id,
    lead_id: request.lead_id,
    query: request.query,
    limit: request.limit,
    include_private: request.include_private,
  }

  const retrieval = retrieveKnowledgeForConsumer(allDocuments, retrievalRequest)
  return buildKnowledgeConsumerContext(retrieval, retrieval.documents)
}
