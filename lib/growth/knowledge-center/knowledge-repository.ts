/** Phase GS-3A — Knowledge Center repository — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { ingestKnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-ingestion-service"
import { searchKnowledge } from "@/lib/growth/knowledge-center/knowledge-search"
import {
  KNOWLEDGE_CENTER_QA_MARKER,
  type KnowledgeDocument,
  type KnowledgeDocumentStatus,
  type KnowledgeIngestionInput,
  type KnowledgeIngestionResult,
  type KnowledgeSearchInput,
  type KnowledgeSearchResult,
  type KnowledgeVisibility,
} from "@/lib/growth/knowledge-center/knowledge-document-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

type RawKnowledgeRow = {
  id: string
  event_payload: Record<string, unknown>
  occurred_at: string
}

function rowToDocument(row: RawKnowledgeRow): KnowledgeDocument | null {
  const payload = row.event_payload ?? {}
  const document = payload.document as KnowledgeDocument | undefined
  if (!document || document.qa_marker !== KNOWLEDGE_CENTER_QA_MARKER) return null
  return {
    ...document,
    audit_event_id: row.id,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export async function listKnowledgeDocuments(
  admin: SupabaseClient,
  input?: {
    organization_id?: string | null
    status?: KnowledgeDocumentStatus | null
    visibility?: KnowledgeVisibility | null
    limit?: number
  },
): Promise<KnowledgeDocument[]> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) return []

  const { data } = await admin
    .schema("growth")
    .from("signal_events")
    .select("id, event_payload, occurred_at")
    .eq("event_type", "ingested")
    .contains("event_payload", {
      qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
      knowledge_document: true,
    })
    .order("occurred_at", { ascending: false })
    .limit(input?.limit ?? 500)

  const documents: KnowledgeDocument[] = []
  for (const row of (data as RawKnowledgeRow[] | null) ?? []) {
    const document = rowToDocument(row)
    if (!document) continue
    if (input?.organization_id && document.organization_id !== input.organization_id) continue
    if (input?.status && document.status !== input.status) continue
    if (input?.visibility && document.visibility !== input.visibility) continue
    documents.push(document)
  }
  return documents
}

export async function getKnowledgeDocumentById(
  admin: SupabaseClient,
  knowledge_document_id: string,
): Promise<KnowledgeDocument | null> {
  const documents = await listKnowledgeDocuments(admin, { limit: 500 })
  return documents.find((doc) => doc.knowledge_document_id === knowledge_document_id) ?? null
}

export async function createKnowledgeDocument(
  admin: SupabaseClient,
  input: KnowledgeIngestionInput,
): Promise<{ ok: boolean; result?: KnowledgeIngestionResult; error?: string }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, error: "schema_not_ready" }
  }

  const knowledge_document_id = randomUUID()
  const organization_id = input.organization_id ?? getGrowthEngineAiOrgId()
  const ingested = ingestKnowledgeDocument(
    { ...input, organization_id },
    knowledge_document_id,
  )

  const { data, error } = await admin
    .schema("growth")
    .from("signal_events")
    .insert({
      signal_id: null,
      organization_id: organization_id,
      event_type: "ingested",
      event_payload: {
        qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
        knowledge_document: true,
        knowledge_document_id,
        document: ingested.document,
        requires_human_review: true,
        autonomous_execution_enabled: false,
      },
      occurred_at: ingested.document.created_at,
    })
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    result: {
      ...ingested,
      document: {
        ...ingested.document,
        audit_event_id: data?.id as string | undefined,
      },
    },
  }
}

export async function updateKnowledgeDocument(
  admin: SupabaseClient,
  input: {
    knowledge_document_id: string
    title?: string
    content?: string
    tags?: string[]
    status?: KnowledgeDocumentStatus
    visibility?: KnowledgeVisibility
    source_url?: string | null
    source_filename?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<{ ok: boolean; document?: KnowledgeDocument; error?: string }> {
  const existing = await getKnowledgeDocumentById(admin, input.knowledge_document_id)
  if (!existing?.audit_event_id) return { ok: false, error: "not_found" }

  const ingested = ingestKnowledgeDocument(
    {
      organization_id: existing.organization_id,
      source_type: existing.source_type,
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      source_url: input.source_url ?? existing.source_url,
      source_filename: input.source_filename ?? existing.source_filename,
      tags: input.tags ?? existing.tags,
      categories: existing.categories,
      visibility: input.visibility ?? existing.visibility,
      status: input.status ?? existing.status,
      metadata: { ...existing.metadata, ...(input.metadata ?? {}) },
      created_by_user_id: existing.created_by_user_id,
    },
    existing.knowledge_document_id,
    { created_at: existing.created_at, updated_at: new Date().toISOString() },
  )

  const updatedDocument: KnowledgeDocument = {
    ...ingested.document,
    audit_event_id: existing.audit_event_id,
  }

  const { error } = await admin
    .schema("growth")
    .from("signal_events")
    .update({
      event_payload: {
        qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
        knowledge_document: true,
        knowledge_document_id: existing.knowledge_document_id,
        document: updatedDocument,
        requires_human_review: true,
        autonomous_execution_enabled: false,
      },
    })
    .eq("id", existing.audit_event_id)

  if (error) return { ok: false, error: error.message }
  return { ok: true, document: updatedDocument }
}

export async function archiveKnowledgeDocument(
  admin: SupabaseClient,
  knowledge_document_id: string,
): Promise<{ ok: boolean; document?: KnowledgeDocument; error?: string }> {
  return updateKnowledgeDocument(admin, {
    knowledge_document_id,
    status: "archived",
  })
}

export async function runKnowledgeSearch(
  admin: SupabaseClient,
  input: KnowledgeSearchInput,
): Promise<KnowledgeSearchResult> {
  const documents = await listKnowledgeDocuments(admin, {
    organization_id: input.organization_id ?? getGrowthEngineAiOrgId(),
    limit: 500,
  })
  return searchKnowledge(documents, input)
}
