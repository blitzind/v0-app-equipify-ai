/** Phase GS-3D — Conversational Playbooks server service — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { generateConversationalPlaybookFromDocuments } from "@/lib/growth/conversational-playbooks/conversational-playbook-engine"
import {
  CONVERSATIONAL_PLAYBOOK_QA_MARKER,
  type ConversationalPlaybook,
  type ConversationalPlaybookAuditEvent,
  type ConversationalPlaybookGenerateRequest,
} from "@/lib/growth/conversational-playbooks/conversational-playbook-types"
import { listKnowledgeDocuments } from "@/lib/growth/knowledge-center/knowledge-repository"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

async function persistConversationalPlaybookAudit(
  admin: SupabaseClient,
  input: {
    event_name: ConversationalPlaybookAuditEvent
    playbook: ConversationalPlaybook
    organization_id: string
    operator_id?: string | null
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
      event_type: "scored",
      event_payload: {
        qa_marker: CONVERSATIONAL_PLAYBOOK_QA_MARKER,
        event_name: input.event_name,
        conversational_playbook: true,
        playbook_id: input.playbook.playbook_id,
        consumer: input.playbook.consumer,
        playbook_type: input.playbook.playbook_type,
        confidence_score: input.playbook.confidence_score,
        citation_count: input.playbook.citations.length,
        section_count: input.playbook.sections.length,
        playbook: input.playbook,
        operator_id: input.operator_id ?? null,
        occurred_at: now,
        requires_human_review: true,
        requires_human_approval: true,
        enrollment_enabled: false,
        outreach_enabled: false,
        autonomous_execution_enabled: false,
      },
      occurred_at: now,
    })
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, audit_event_id: data?.id as string | undefined }
}

export async function generateConversationalPlaybookForRequest(
  admin: SupabaseClient,
  request: ConversationalPlaybookGenerateRequest,
  options?: { persist_audit?: boolean; operator_id?: string | null },
): Promise<{ ok: boolean; playbook?: ConversationalPlaybook; error?: string }> {
  const organization_id = request.organization_id ?? getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  try {
    const documents = await listKnowledgeDocuments(admin, {
      organization_id,
      limit: 500,
    })

    const playbook_id = randomUUID()
    const playbook = generateConversationalPlaybookFromDocuments(
      { ...request, organization_id },
      documents,
      playbook_id,
    )

    if (options?.persist_audit !== false) {
      await persistConversationalPlaybookAudit(admin, {
        event_name: "conversational_playbook_generated",
        playbook,
        organization_id,
        operator_id: options?.operator_id,
      })
    }

    return { ok: true, playbook }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }
}

export async function loadConversationalPlaybookForRequest(
  admin: SupabaseClient,
  request: ConversationalPlaybookGenerateRequest,
): Promise<{ ok: boolean; playbook?: ConversationalPlaybook; error?: string }> {
  return generateConversationalPlaybookForRequest(admin, request, { persist_audit: false })
}

export async function markConversationalPlaybookReviewed(
  admin: SupabaseClient,
  input: {
    playbook: ConversationalPlaybook
    operator_id?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  const reviewed: ConversationalPlaybook = {
    ...input.playbook,
    review_status: "reviewed",
  }

  const result = await persistConversationalPlaybookAudit(admin, {
    event_name: "conversational_playbook_reviewed",
    playbook: reviewed,
    organization_id,
    operator_id: input.operator_id,
  })

  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

export async function recordConversationalPlaybookViewed(
  admin: SupabaseClient,
  input: {
    playbook: ConversationalPlaybook
    operator_id?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  const result = await persistConversationalPlaybookAudit(admin, {
    event_name: "conversational_playbook_viewed",
    playbook: input.playbook,
    organization_id,
    operator_id: input.operator_id,
  })

  return result.ok ? { ok: true } : { ok: false, error: result.error }
}
