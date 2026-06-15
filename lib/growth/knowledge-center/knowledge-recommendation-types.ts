/** Phase GS-3D — Knowledge-augmented copilot recommendation types (client-safe). */

import type { KnowledgeConsumer } from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

export const KNOWLEDGE_RECOMMENDATION_QA_MARKER = "growth-knowledge-recommendations-gs3d-v1" as const

export const KNOWLEDGE_RECOMMENDATION_CONFIRM = "RUN_KNOWLEDGE_RECOMMENDATIONS_CERTIFICATION" as const

export const KNOWLEDGE_RECOMMENDATION_GENERATED_EVENT = "knowledge_recommendations_generated" as const

export type KnowledgeRecommendationPriority = "low" | "medium" | "high" | "urgent"

export type KnowledgeCitation = {
  document_id: string
  title: string
  category: string
}

export type KnowledgeRecommendation = {
  recommendation_id: string
  consumer: string
  recommendation_type: string
  title: string
  description: string
  confidence: number
  priority: KnowledgeRecommendationPriority
  reasoning: string[]
  citations: KnowledgeCitation[]
  requires_human_review: boolean
  created_at: string
}

export const REPLY_INTELLIGENCE_RECOMMENDATION_TYPES = [
  "review_objection",
  "review_pricing_note",
  "review_competitor_response",
  "recommend_meeting",
] as const

export const MEETING_PREP_RECOMMENDATION_TYPES = [
  "discuss_case_study",
  "discuss_roi",
  "discuss_competitor",
  "review_risks",
] as const

export const SEQUENCE_BUILDER_RECOMMENDATION_TYPES = [
  "recommend_value_proposition",
  "recommend_cta",
  "recommend_proof_point",
] as const

export const VOICE_DROP_RECOMMENDATION_TYPES = [
  "recommend_script",
  "recommend_persona_angle",
] as const

export const CALL_COACHING_RECOMMENDATION_TYPES = [
  "recommend_talk_track",
  "recommend_discovery_question",
  "recommend_objection_response",
] as const

export const PROSPECT_DISCOVERY_RECOMMENDATION_TYPES = [
  "recommend_playbook",
  "recommend_qualification_criteria",
] as const

export const OPPORTUNITY_INTELLIGENCE_RECOMMENDATION_TYPES = [
  "recommend_case_study",
  "recommend_pricing_material",
  "recommend_roi_material",
] as const

export const KNOWLEDGE_RECOMMENDATION_TYPE_LABELS: Record<string, string> = {
  review_objection: "Review objection handling",
  review_pricing_note: "Review pricing note",
  review_competitor_response: "Review competitor response",
  recommend_meeting: "Recommend meeting follow-up",
  discuss_case_study: "Discuss case study",
  discuss_roi: "Discuss ROI proof",
  discuss_competitor: "Discuss competitor positioning",
  review_risks: "Review risk factors",
  recommend_value_proposition: "Recommend value proposition",
  recommend_cta: "Recommend call-to-action",
  recommend_proof_point: "Recommend proof point",
  recommend_script: "Recommend script angle",
  recommend_persona_angle: "Recommend persona angle",
  recommend_talk_track: "Recommend talk track",
  recommend_discovery_question: "Recommend discovery question",
  recommend_objection_response: "Recommend objection response",
  recommend_playbook: "Recommend playbook",
  recommend_qualification_criteria: "Recommend qualification criteria",
  recommend_case_study: "Recommend case study",
  recommend_pricing_material: "Recommend pricing material",
  recommend_roi_material: "Recommend ROI material",
}

export const KNOWLEDGE_CONSUMER_RECOMMENDATION_TYPES: Record<KnowledgeConsumer, readonly string[]> = {
  reply_intelligence: REPLY_INTELLIGENCE_RECOMMENDATION_TYPES,
  meeting_prep: MEETING_PREP_RECOMMENDATION_TYPES,
  sequence_builder: SEQUENCE_BUILDER_RECOMMENDATION_TYPES,
  voice_drop: VOICE_DROP_RECOMMENDATION_TYPES,
  call_coaching: CALL_COACHING_RECOMMENDATION_TYPES,
  prospect_discovery: PROSPECT_DISCOVERY_RECOMMENDATION_TYPES,
  opportunity_intelligence: OPPORTUNITY_INTELLIGENCE_RECOMMENDATION_TYPES,
}

export type KnowledgeRecommendationGenerateRequest = {
  organization_id?: string | null
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

export type KnowledgeRecommendationGenerateResult = {
  qa_marker: typeof KNOWLEDGE_RECOMMENDATION_QA_MARKER
  consumer: KnowledgeConsumer
  recommendations: KnowledgeRecommendation[]
  citations: KnowledgeCitation[]
  requires_human_review: true
  autonomous_execution_enabled: false
  generated_at: string
}
