import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GE_V1_4_DEMO_ASSISTANT_QA_MARKER,
  GE_V1_4_DEMO_ASSISTANT_SCHEMA_MIGRATION,
  type GeV14ConversationOutcome,
  type GeV14DemoAssistantSession,
  type GeV14DemoSessionStatus,
  type GeV14ProspectContext,
} from "@/lib/growth/demo-assistant/ge-v1-4-types"

function mapRow(row: Record<string, unknown>): GeV14DemoAssistantSession {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    landingPageId: String(row.landing_page_id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    publishedSlug: String(row.published_slug),
    publicSessionId: String(row.public_session_id),
    status: String(row.status) as GeV14DemoSessionStatus,
    retellChatId: row.retell_chat_id ? String(row.retell_chat_id) : null,
    prospectContext: (row.prospect_context as GeV14ProspectContext) ?? {},
    conversationOutcome: (row.conversation_outcome as GeV14ConversationOutcome | null) ?? null,
    errorMetadata: (row.error_metadata as Record<string, unknown> | null) ?? null,
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  }
}

export async function probeGeV14DemoAssistantSessionsTable(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("demo_assistant_sessions")
    .select("id")
    .limit(1)
  if (error?.message?.includes("does not exist")) return false
  return !error
}

export async function createGeV14DemoAssistantSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    landingPageId: string
    leadId: string | null
    publishedSlug: string
    publicSessionId: string
    prospectContext: GeV14ProspectContext
    retellChatId?: string | null
  },
): Promise<GeV14DemoAssistantSession> {
  const { data, error } = await admin
    .schema("growth")
    .from("demo_assistant_sessions")
    .insert({
      organization_id: input.organizationId,
      landing_page_id: input.landingPageId,
      lead_id: input.leadId,
      published_slug: input.publishedSlug,
      public_session_id: input.publicSessionId,
      status: "active",
      retell_chat_id: input.retellChatId ?? null,
      prospect_context: input.prospectContext,
      qa_marker: GE_V1_4_DEMO_ASSISTANT_QA_MARKER,
    })
    .select("*")
    .single()

  if (error) {
    throw new Error(`demo_assistant_session_create_failed:${error.message}`)
  }

  return mapRow(data as Record<string, unknown>)
}

export async function getGeV14DemoAssistantSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<GeV14DemoAssistantSession | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("demo_assistant_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle()

  if (error?.message?.includes("does not exist")) return null
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function completeGeV14DemoAssistantSession(
  admin: SupabaseClient,
  input: {
    sessionId: string
    status: "completed" | "failed"
    conversationOutcome?: GeV14ConversationOutcome | null
    errorMetadata?: Record<string, unknown> | null
  },
): Promise<GeV14DemoAssistantSession | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("demo_assistant_sessions")
    .update({
      status: input.status,
      completed_at: new Date().toISOString(),
      conversation_outcome: input.conversationOutcome ?? null,
      error_metadata: input.errorMetadata ?? null,
    })
    .eq("id", input.sessionId)
    .select("*")
    .maybeSingle()

  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export { GE_V1_4_DEMO_ASSISTANT_SCHEMA_MIGRATION }
