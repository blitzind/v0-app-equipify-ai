/** Phase GS-3D — Knowledge recommendation server + audit — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildKnowledgeConsumerContextFromDocuments } from "@/lib/growth/knowledge-center/knowledge-context-injection"
import { assertAllRecommendationsCited } from "@/lib/growth/knowledge-center/knowledge-citation-builder"
import { generateKnowledgeRecommendations } from "@/lib/growth/knowledge-center/knowledge-recommendation-engine"
import {
  KNOWLEDGE_RECOMMENDATION_GENERATED_EVENT,
  KNOWLEDGE_RECOMMENDATION_QA_MARKER,
  type KnowledgeRecommendationGenerateRequest,
  type KnowledgeRecommendationGenerateResult,
} from "@/lib/growth/knowledge-center/knowledge-recommendation-types"
import { listKnowledgeDocuments } from "@/lib/growth/knowledge-center/knowledge-repository"
import { KNOWLEDGE_CENTER_QA_MARKER } from "@/lib/growth/knowledge-center/knowledge-document-types"
import { KNOWLEDGE_CONTEXT_QA_MARKER } from "@/lib/growth/knowledge-center/knowledge-context-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

export async function persistKnowledgeRecommendationAudit(
  admin: SupabaseClient,
  input: {
    organization_id: string
    consumer: string
    recommendation_count: number
    citation_count: number
    lead_id?: string | null
    company_id?: string | null
    query?: string | null
  },
): Promise<{ ok: boolean; audit_event_id?: string; error?: string }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, error: "schema_not_ready" }
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("signal_events")
    .insert({
      signal_id: null,
      organization_id: input.organization_id,
      event_type: "ingested",
      event_payload: {
        qa_marker: KNOWLEDGE_RECOMMENDATION_QA_MARKER,
        knowledge_center_qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
        knowledge_context_qa_marker: KNOWLEDGE_CONTEXT_QA_MARKER,
        event_name: KNOWLEDGE_RECOMMENDATION_GENERATED_EVENT,
        knowledge_recommendations_generated: true,
        consumer: input.consumer,
        recommendation_count: input.recommendation_count,
        citation_count: input.citation_count,
        lead_id: input.lead_id ?? null,
        company_id: input.company_id ?? null,
        query: input.query ?? null,
        occurred_at: now,
        requires_human_review: true,
        autonomous_execution_enabled: false,
      },
      occurred_at: now,
    })
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, audit_event_id: data?.id as string | undefined }
}

export async function generateKnowledgeRecommendationsForRequest(
  admin: SupabaseClient,
  request: KnowledgeRecommendationGenerateRequest,
): Promise<{ ok: boolean; result?: KnowledgeRecommendationGenerateResult; error?: string }> {
  const organization_id = request.organization_id ?? getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  const documents = await listKnowledgeDocuments(admin, { organization_id, limit: 500 })
  const context = buildKnowledgeConsumerContextFromDocuments({ ...request, organization_id }, documents)
  const result = generateKnowledgeRecommendations(context, request)

  if (!assertAllRecommendationsCited(result.recommendations)) {
    return { ok: false, error: "uncited_recommendations_detected" }
  }

  await persistKnowledgeRecommendationAudit(admin, {
    organization_id,
    consumer: request.consumer,
    recommendation_count: result.recommendations.length,
    citation_count: result.citations.length,
    lead_id: request.lead_id,
    company_id: request.company_id,
    query: request.query,
  })

  return { ok: true, result }
}
