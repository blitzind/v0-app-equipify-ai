/** Phase GS-3D — Knowledge citation builder (client-safe). */

import type { KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"
import type { KnowledgeCitation } from "@/lib/growth/knowledge-center/knowledge-recommendation-types"

export function buildKnowledgeCitations(documents: KnowledgeDocument[]): KnowledgeCitation[] {
  return documents.map((document) => ({
    document_id: document.knowledge_document_id,
    title: document.title,
    category: document.categories[0] ?? document.classification.category ?? "other",
  }))
}

export function assertAllRecommendationsCited(
  recommendations: Array<{ citations: KnowledgeCitation[] }>,
): boolean {
  if (recommendations.length === 0) return true
  return recommendations.every(
    (recommendation) =>
      recommendation.citations.length > 0 &&
      recommendation.citations.every(
        (citation) =>
          Boolean(citation.document_id) && Boolean(citation.title) && Boolean(citation.category),
      ),
  )
}
