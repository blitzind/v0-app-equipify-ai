/** Phase GS-3C — Knowledge context injection server + audit — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildKnowledgeConsumerContextFromDocuments } from "@/lib/growth/knowledge-center/knowledge-context-injection"
import {
  KNOWLEDGE_CONTEXT_QA_MARKER,
  KNOWLEDGE_CONTEXT_RETRIEVED_EVENT,
  type KnowledgeContextInjectionRequest,
  type KnowledgeContextInjectionResult,
} from "@/lib/growth/knowledge-center/knowledge-context-types"
import { resolveConsumerRetrievalScope } from "@/lib/growth/knowledge-center/knowledge-consumer-adapters"
import { listKnowledgeDocuments } from "@/lib/growth/knowledge-center/knowledge-repository"
import { KNOWLEDGE_CENTER_QA_MARKER } from "@/lib/growth/knowledge-center/knowledge-document-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

export async function persistKnowledgeContextRetrievalAudit(
  admin: SupabaseClient,
  input: {
    organization_id: string
    consumer: string
    document_count: number
    categories: string[]
    tags: string[]
    relevance_score: number
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
        qa_marker: KNOWLEDGE_CONTEXT_QA_MARKER,
        knowledge_center_qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
        event_name: KNOWLEDGE_CONTEXT_RETRIEVED_EVENT,
        knowledge_context_retrieved: true,
        consumer: input.consumer,
        document_count: input.document_count,
        categories_used: input.categories,
        tags_used: input.tags,
        relevance_score: input.relevance_score,
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

export async function injectKnowledgeContext(
  admin: SupabaseClient,
  request: KnowledgeContextInjectionRequest,
): Promise<{ ok: boolean; context?: KnowledgeContextInjectionResult; error?: string }> {
  const organization_id = request.organization_id ?? getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  const documents = await listKnowledgeDocuments(admin, { organization_id, limit: 500 })
  const context = buildKnowledgeConsumerContextFromDocuments({ ...request, organization_id }, documents)

  const scope = resolveConsumerRetrievalScope({
    organization_id,
    consumer: request.consumer,
    categories: request.categories,
    tags: request.tags,
  })

  const audit = await persistKnowledgeContextRetrievalAudit(admin, {
    organization_id,
    consumer: request.consumer,
    document_count: context.documents.length,
    categories: scope.categories,
    tags: scope.tags,
    relevance_score: context.relevance_score,
    lead_id: request.lead_id,
    company_id: request.company_id,
    query: request.query,
  })

  return {
    ok: true,
    context: {
      ...context,
      audit_event_id: audit.audit_event_id ?? null,
    },
  }
}
