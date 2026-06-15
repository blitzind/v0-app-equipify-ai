/** Phase GS-3D — Deterministic knowledge-augmented recommendation engine (client-safe). */

import { buildKnowledgeConsumerContextFromDocuments } from "@/lib/growth/knowledge-center/knowledge-context-injection"
import { buildKnowledgeCitations } from "@/lib/growth/knowledge-center/knowledge-citation-builder"
import type { KnowledgeConsumerContext } from "@/lib/growth/knowledge-center/knowledge-context-types"
import type { KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"
import {
  KNOWLEDGE_RECOMMENDATION_QA_MARKER,
  KNOWLEDGE_RECOMMENDATION_TYPE_LABELS,
  type KnowledgeRecommendation,
  type KnowledgeRecommendationGenerateRequest,
  type KnowledgeRecommendationGenerateResult,
  type KnowledgeRecommendationPriority,
} from "@/lib/growth/knowledge-center/knowledge-recommendation-types"
import type { KnowledgeConsumer } from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

function hasTagPattern(document: KnowledgeDocument, pattern: RegExp): boolean {
  return document.tags.some((tag) => pattern.test(tag))
}

function computeConfidence(contextRelevance: number, documents: KnowledgeDocument[]): number {
  if (documents.length === 0) return 0
  const docBoost = Math.min(15, documents.length * 5)
  const categoryBoost = documents.some((doc) => doc.categories.length > 0) ? 5 : 0
  return Math.min(100, Math.round(contextRelevance * 0.6 + docBoost + categoryBoost))
}

function computePriority(confidence: number): KnowledgeRecommendationPriority {
  if (confidence >= 85) return "urgent"
  if (confidence >= 70) return "high"
  if (confidence >= 50) return "medium"
  return "low"
}

function buildRecommendation(
  consumer: KnowledgeConsumer,
  recommendationType: string,
  documents: KnowledgeDocument[],
  context: KnowledgeConsumerContext,
  reasoning: string[],
): KnowledgeRecommendation | null {
  const citations = buildKnowledgeCitations(documents.slice(0, 3))
  if (citations.length === 0) return null

  const confidence = computeConfidence(context.relevance_score, documents)
  const primaryDoc = documents[0]
  const label = KNOWLEDGE_RECOMMENDATION_TYPE_LABELS[recommendationType] ?? recommendationType

  return {
    recommendation_id: `${consumer}-${recommendationType}-${primaryDoc.knowledge_document_id}`,
    consumer,
    recommendation_type: recommendationType,
    title: `${label}: ${primaryDoc.title}`,
    description: `Review "${primaryDoc.title}" before taking action. ${primaryDoc.summary}`.trim(),
    confidence,
    priority: computePriority(confidence),
    reasoning,
    citations,
    requires_human_review: true,
    created_at: new Date().toISOString(),
  }
}

function recommendationsFromDocuments(
  consumer: KnowledgeConsumer,
  recommendationType: string,
  documents: KnowledgeDocument[],
  context: KnowledgeConsumerContext,
  reasonPrefix: string,
  max = 2,
): KnowledgeRecommendation[] {
  const results: KnowledgeRecommendation[] = []
  for (const document of documents.slice(0, max)) {
    const recommendation = buildRecommendation(consumer, recommendationType, [document], context, [
      `${reasonPrefix}: matched active knowledge document "${document.title}".`,
      "Citation-backed recommendation only — no autonomous execution.",
    ])
    if (recommendation) results.push(recommendation)
  }
  return results
}

function buildReplyIntelligenceRecommendations(context: KnowledgeConsumerContext, query?: string | null) {
  const consumer: KnowledgeConsumer = "reply_intelligence"
  const results: KnowledgeRecommendation[] = []

  results.push(
    ...recommendationsFromDocuments(
      consumer,
      "review_objection",
      context.objections,
      context,
      "Objection document available for reply review",
    ),
  )
  results.push(
    ...recommendationsFromDocuments(
      consumer,
      "review_pricing_note",
      context.pricing_notes,
      context,
      "Pricing note available for reply review",
    ),
  )
  results.push(
    ...recommendationsFromDocuments(
      consumer,
      "review_competitor_response",
      context.competitors,
      context,
      "Competitor document available for reply review",
    ),
  )

  const meetingQuery = /meeting|call|demo|schedule/i.test(query ?? "")
  if (meetingQuery && context.playbooks.length + context.case_studies.length > 0) {
    const meetingDocs = [...context.playbooks, ...context.case_studies].slice(0, 1)
    results.push(
      ...recommendationsFromDocuments(
        consumer,
        "recommend_meeting",
        meetingDocs,
        context,
        "Meeting-oriented knowledge matched query context",
        1,
      ),
    )
  }

  return results
}

function buildMeetingPrepRecommendations(context: KnowledgeConsumerContext) {
  const consumer: KnowledgeConsumer = "meeting_prep"
  const results: KnowledgeRecommendation[] = []

  results.push(
    ...recommendationsFromDocuments(
      consumer,
      "discuss_case_study",
      context.case_studies,
      context,
      "Case study available for meeting prep",
    ),
  )

  const roiDocs = context.case_studies.filter(
    (doc) => hasTagPattern(doc, /roi|proof|return/) || doc.categories.includes("case_study"),
  )
  results.push(
    ...recommendationsFromDocuments(
      consumer,
      "discuss_roi",
      roiDocs,
      context,
      "ROI material available for meeting prep",
      1,
    ),
  )

  results.push(
    ...recommendationsFromDocuments(
      consumer,
      "discuss_competitor",
      context.competitors,
      context,
      "Competitor positioning available for meeting prep",
      1,
    ),
  )
  results.push(
    ...recommendationsFromDocuments(
      consumer,
      "review_risks",
      context.objections,
      context,
      "Risk/objection document available for meeting prep",
      1,
    ),
  )

  return results
}

function buildSequenceBuilderRecommendations(context: KnowledgeConsumerContext) {
  const consumer: KnowledgeConsumer = "sequence_builder"
  const valueProps = context.playbooks.filter((doc) =>
    hasTagPattern(doc, /value_prop|messaging|positioning/),
  )
  const ctas = context.playbooks.filter((doc) => hasTagPattern(doc, /cta|call_to_action/))
  const proofPoints = context.case_studies.length > 0 ? context.case_studies : context.playbooks.filter((doc) =>
    hasTagPattern(doc, /proof|case_study/),
  )

  return [
    ...recommendationsFromDocuments(
      consumer,
      "recommend_value_proposition",
      valueProps.length > 0 ? valueProps : context.playbooks,
      context,
      "Value proposition reference available for sequence builder",
      1,
    ),
    ...recommendationsFromDocuments(
      consumer,
      "recommend_cta",
      ctas.length > 0 ? ctas : context.playbooks,
      context,
      "CTA reference available for sequence builder",
      1,
    ),
    ...recommendationsFromDocuments(
      consumer,
      "recommend_proof_point",
      proofPoints,
      context,
      "Proof point reference available for sequence builder",
      1,
    ),
  ]
}

function buildVoiceDropRecommendations(context: KnowledgeConsumerContext) {
  const consumer: KnowledgeConsumer = "voice_drop"
  const scripts = context.playbooks.filter((doc) => hasTagPattern(doc, /script|talk_track/))
  const personas = context.playbooks.filter((doc) => hasTagPattern(doc, /persona|positioning/))

  return [
    ...recommendationsFromDocuments(
      consumer,
      "recommend_script",
      scripts.length > 0 ? scripts : context.playbooks,
      context,
      "Script reference available for voice drop",
      1,
    ),
    ...recommendationsFromDocuments(
      consumer,
      "recommend_persona_angle",
      personas.length > 0 ? personas : context.playbooks,
      context,
      "Persona angle reference available for voice drop",
      1,
    ),
  ]
}

function buildCallCoachingRecommendations(context: KnowledgeConsumerContext) {
  const consumer: KnowledgeConsumer = "call_coaching"
  const discovery = context.playbooks.filter((doc) => hasTagPattern(doc, /discovery|qualification/))
  const talkTracks = context.playbooks.filter((doc) => hasTagPattern(doc, /talk_track|script/))

  return [
    ...recommendationsFromDocuments(
      consumer,
      "recommend_talk_track",
      talkTracks.length > 0 ? talkTracks : context.playbooks,
      context,
      "Talk track reference available for call coaching",
      1,
    ),
    ...recommendationsFromDocuments(
      consumer,
      "recommend_discovery_question",
      discovery.length > 0 ? discovery : context.playbooks,
      context,
      "Discovery question reference available for call coaching",
      1,
    ),
    ...recommendationsFromDocuments(
      consumer,
      "recommend_objection_response",
      context.objections,
      context,
      "Objection response reference available for call coaching",
      1,
    ),
  ]
}

function buildProspectDiscoveryRecommendations(context: KnowledgeConsumerContext) {
  const consumer: KnowledgeConsumer = "prospect_discovery"
  const qualification = context.playbooks.filter((doc) =>
    hasTagPattern(doc, /qualification|icp|criteria/),
  )

  return [
    ...recommendationsFromDocuments(
      consumer,
      "recommend_playbook",
      context.playbooks,
      context,
      "Playbook available for prospect discovery",
      1,
    ),
    ...recommendationsFromDocuments(
      consumer,
      "recommend_qualification_criteria",
      qualification.length > 0 ? qualification : context.playbooks,
      context,
      "Qualification criteria available for prospect discovery",
      1,
    ),
  ]
}

function buildOpportunityIntelligenceRecommendations(context: KnowledgeConsumerContext) {
  const consumer: KnowledgeConsumer = "opportunity_intelligence"
  const roiDocs = context.case_studies.filter((doc) => hasTagPattern(doc, /roi|proof/))

  return [
    ...recommendationsFromDocuments(
      consumer,
      "recommend_case_study",
      context.case_studies,
      context,
      "Case study available for opportunity intelligence",
      1,
    ),
    ...recommendationsFromDocuments(
      consumer,
      "recommend_pricing_material",
      context.pricing_notes,
      context,
      "Pricing material available for opportunity intelligence",
      1,
    ),
    ...recommendationsFromDocuments(
      consumer,
      "recommend_roi_material",
      roiDocs.length > 0 ? roiDocs : context.case_studies,
      context,
      "ROI material available for opportunity intelligence",
      1,
    ),
  ]
}

function buildConsumerRecommendations(
  context: KnowledgeConsumerContext,
  query?: string | null,
): KnowledgeRecommendation[] {
  switch (context.consumer) {
    case "reply_intelligence":
      return buildReplyIntelligenceRecommendations(context, query)
    case "meeting_prep":
      return buildMeetingPrepRecommendations(context)
    case "sequence_builder":
      return buildSequenceBuilderRecommendations(context)
    case "voice_drop":
      return buildVoiceDropRecommendations(context)
    case "call_coaching":
      return buildCallCoachingRecommendations(context)
    case "prospect_discovery":
      return buildProspectDiscoveryRecommendations(context)
    case "opportunity_intelligence":
      return buildOpportunityIntelligenceRecommendations(context)
    default:
      return []
  }
}

export function generateKnowledgeRecommendations(
  context: KnowledgeConsumerContext,
  input?: Pick<KnowledgeRecommendationGenerateRequest, "query" | "limit">,
): KnowledgeRecommendationGenerateResult {
  const recommendations = buildConsumerRecommendations(context, input?.query)
    .sort((left, right) => right.confidence - left.confidence || left.title.localeCompare(right.title))

  const limit = Math.min(20, Math.max(1, input?.limit ?? 12))
  const limited = recommendations.slice(0, limit)

  const citations = limited.flatMap((recommendation) => recommendation.citations)
  const uniqueCitations = Array.from(
    new Map(citations.map((citation) => [citation.document_id, citation])).values(),
  )

  return {
    qa_marker: KNOWLEDGE_RECOMMENDATION_QA_MARKER,
    consumer: context.consumer,
    recommendations: limited,
    citations: uniqueCitations,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    generated_at: new Date().toISOString(),
  }
}

export function generateKnowledgeRecommendationsFromDocuments(
  request: KnowledgeRecommendationGenerateRequest & { organization_id: string },
  allDocuments: KnowledgeDocument[],
): KnowledgeRecommendationGenerateResult {
  const context = buildKnowledgeConsumerContextFromDocuments(request, allDocuments)
  return generateKnowledgeRecommendations(context, request)
}
