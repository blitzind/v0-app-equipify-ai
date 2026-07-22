/** Phase GS-3A — Knowledge Center repository — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  archivePlatformKnowledgeDocument,
  createPlatformKnowledgeDocument,
  getPlatformKnowledgeDocumentById,
  listPlatformKnowledgeDocuments,
  runPlatformKnowledgeRetrieval,
  runPlatformKnowledgeSearch,
  updatePlatformKnowledgeDocument,
  type PlatformKnowledgeDocumentStatus,
  type PlatformKnowledgeIngestionInput,
  type PlatformKnowledgeSearchInput,
  type PlatformKnowledgeVisibility,
  type PlatformKnowledgeRetrievalRequest,
} from "@fuzor/knowledge"

import { resolveKnowledgeOrganizationId } from "@/lib/growth/knowledge-center/knowledge-org-bootstrap"

export async function listKnowledgeDocuments(
  admin: SupabaseClient,
  input?: {
    organization_id?: string | null
    status?: PlatformKnowledgeDocumentStatus | null
    visibility?: PlatformKnowledgeVisibility | null
    limit?: number
  },
) {
  return listPlatformKnowledgeDocuments(admin, {
    ...input,
    organization_id: input?.organization_id
      ? resolveKnowledgeOrganizationId(input.organization_id)
      : input?.organization_id,
  })
}

export async function getKnowledgeDocumentById(
  admin: SupabaseClient,
  knowledge_document_id: string,
) {
  return getPlatformKnowledgeDocumentById(admin, knowledge_document_id)
}

export async function createKnowledgeDocument(
  admin: SupabaseClient,
  input: PlatformKnowledgeIngestionInput,
) {
  return createPlatformKnowledgeDocument(admin, {
    ...input,
    organization_id: resolveKnowledgeOrganizationId(input.organization_id),
  })
}

export async function updateKnowledgeDocument(
  admin: SupabaseClient,
  input: {
    knowledge_document_id: string
    title?: string
    content?: string
    tags?: string[]
    status?: PlatformKnowledgeDocumentStatus
    visibility?: PlatformKnowledgeVisibility
    source_url?: string | null
    source_filename?: string | null
    metadata?: Record<string, unknown>
  },
) {
  return updatePlatformKnowledgeDocument(admin, input)
}

export async function archiveKnowledgeDocument(
  admin: SupabaseClient,
  knowledge_document_id: string,
) {
  return archivePlatformKnowledgeDocument(admin, knowledge_document_id)
}

export async function runKnowledgeSearch(
  admin: SupabaseClient,
  input: PlatformKnowledgeSearchInput,
) {
  return runPlatformKnowledgeSearch(admin, {
    ...input,
    organization_id: resolveKnowledgeOrganizationId(input.organization_id),
  })
}

export async function runKnowledgeRetrieval(
  admin: SupabaseClient,
  request: PlatformKnowledgeRetrievalRequest,
) {
  return runPlatformKnowledgeRetrieval(admin, {
    ...request,
    organization_id: resolveKnowledgeOrganizationId(request.organization_id) ?? request.organization_id,
  })
}
