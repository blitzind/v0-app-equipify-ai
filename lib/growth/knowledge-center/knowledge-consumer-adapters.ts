/** Phase GS-3B — Knowledge consumer adapters (client-safe). */

import type { KnowledgeCategory, KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"
import { KNOWLEDGE_CATEGORIES } from "@/lib/growth/knowledge-center/knowledge-document-types"
import { retrieveKnowledge } from "@/lib/growth/knowledge-center/knowledge-retrieval-service"
import {
  KNOWLEDGE_CONSUMER_DEFAULT_CATEGORIES,
  KNOWLEDGE_CONSUMER_DEFAULT_TAGS,
  type KnowledgeConsumer,
  type KnowledgeRetrievalRequest,
  type KnowledgeRetrievalResult,
} from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

function uniqueCategories(values: Array<string | KnowledgeCategory>): KnowledgeCategory[] {
  const set = new Set<KnowledgeCategory>()
  for (const value of values) {
    if ((KNOWLEDGE_CATEGORIES as readonly string[]).includes(value)) {
      set.add(value as KnowledgeCategory)
    }
  }
  return [...set]
}

function uniqueTags(values: string[]): string[] {
  return [...new Set(values.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
}

export function resolveConsumerRetrievalScope(request: KnowledgeRetrievalRequest): {
  categories: KnowledgeCategory[]
  tags: string[]
} {
  const defaults = KNOWLEDGE_CONSUMER_DEFAULT_CATEGORIES[request.consumer]
  const defaultTags = KNOWLEDGE_CONSUMER_DEFAULT_TAGS[request.consumer]
  return {
    categories: uniqueCategories([...(request.categories ?? []), ...defaults]),
    tags: uniqueTags([...(request.tags ?? []), ...defaultTags]),
  }
}

function countByCategories(documents: KnowledgeDocument[], categories: KnowledgeCategory[]): number {
  return documents.filter((doc) => categories.some((category) => doc.categories.includes(category))).length
}

export function buildConsumerContext(
  consumer: KnowledgeConsumer,
  documents: KnowledgeDocument[],
): Record<string, unknown> {
  const base = {
    documents_returned: documents.length,
    consumer,
  }

  switch (consumer) {
    case "prospect_discovery":
      return {
        ...base,
        playbooks_found: countByCategories(documents, ["playbook"]),
        icp_notes_found: documents.filter((doc) =>
          doc.tags.some((tag) => /icp|qualification|industry/.test(tag)),
        ).length,
        qualification_docs_found: documents.filter((doc) =>
          doc.tags.some((tag) => /qualification|criteria/.test(tag)),
        ).length,
        competitors_found: countByCategories(documents, ["competitor"]),
      }
    case "reply_intelligence":
      return {
        ...base,
        faqs_found: countByCategories(documents, ["faq"]),
        objections_found: countByCategories(documents, ["objection"]),
        pricing_notes_found: countByCategories(documents, ["pricing"]),
        competitors_found: countByCategories(documents, ["competitor"]),
      }
    case "meeting_prep":
      return {
        ...base,
        case_studies_found: countByCategories(documents, ["case_study"]),
        objections_found: countByCategories(documents, ["objection"]),
        playbooks_found: countByCategories(documents, ["playbook"]),
        competitors_found: countByCategories(documents, ["competitor"]),
        pricing_notes_found: countByCategories(documents, ["pricing"]),
      }
    case "sequence_builder":
      return {
        ...base,
        playbooks_found: countByCategories(documents, ["playbook"]),
        value_props_found: documents.filter((doc) =>
          doc.tags.some((tag) => /value_prop|messaging|positioning/.test(tag)),
        ).length,
        proof_points_found: countByCategories(documents, ["case_study", "product"]),
        ctas_found: documents.filter((doc) => doc.tags.some((tag) => /cta|call_to_action/.test(tag))).length,
      }
    case "voice_drop":
      return {
        ...base,
        scripts_found: countByCategories(documents, ["call"]),
        positioning_found: documents.filter((doc) =>
          doc.tags.some((tag) => /positioning|persona|script/.test(tag)),
        ).length,
        objections_found: countByCategories(documents, ["objection"]),
        persona_docs_found: documents.filter((doc) => doc.tags.some((tag) => /persona/.test(tag))).length,
      }
    case "call_coaching":
      return {
        ...base,
        objections_found: countByCategories(documents, ["objection"]),
        discovery_questions_found: documents.filter((doc) =>
          doc.tags.some((tag) => /discovery|question/.test(tag)),
        ).length,
        talk_tracks_found: countByCategories(documents, ["call", "training"]),
        competitors_found: countByCategories(documents, ["competitor"]),
      }
    case "opportunity_intelligence":
      return {
        ...base,
        pricing_notes_found: countByCategories(documents, ["pricing"]),
        competitive_positioning_found: countByCategories(documents, ["competitor"]),
        implementation_playbooks_found: documents.filter((doc) =>
          doc.tags.some((tag) => /implementation|onboarding|rollout/.test(tag)),
        ).length,
        case_studies_found: countByCategories(documents, ["case_study"]),
        roi_materials_found: documents.filter((doc) => doc.tags.some((tag) => /roi|payback/.test(tag))).length,
      }
    default:
      return base
  }
}

export function retrieveKnowledgeForConsumer(
  documents: KnowledgeDocument[],
  request: KnowledgeRetrievalRequest,
): KnowledgeRetrievalResult {
  const scope = resolveConsumerRetrievalScope(request)
  const result = retrieveKnowledge(documents, request, scope.categories, scope.tags)
  return {
    ...result,
    consumer_context: buildConsumerContext(request.consumer, result.documents),
  }
}
