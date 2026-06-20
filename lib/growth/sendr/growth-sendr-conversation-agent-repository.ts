import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SENDR_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import type { GrowthSendrConversationAgent } from "@/lib/growth/sendr/growth-sendr-types"

function agentsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_conversation_agents")
}

function versionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_conversation_agent_versions")
}

function mapAgent(row: Record<string, unknown>): GrowthSendrConversationAgent {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownerUserId: String(row.owner_user_id),
    mediaAssetId: row.media_asset_id ? String(row.media_asset_id) : null,
    name: String(row.name),
    provider: String(row.provider),
    published: Boolean(row.published),
    publishedVersionId: row.published_version_id ? String(row.published_version_id) : null,
    bookingEnabled: Boolean(row.booking_enabled),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    createdAt: String(row.created_at),
  }
}

/** Registry metadata only — no Retell calls, no live agents. */
export async function registerGrowthSendrConversationAgent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    ownerUserId: string
    name: string
    provider?: string
    mediaAssetId?: string | null
    systemPrompt?: string | null
    voiceProvider?: string | null
    voiceId?: string | null
    knowledgeSources?: unknown[]
    bookingEnabled?: boolean
  },
): Promise<GrowthSendrConversationAgent> {
  const { data: agentRow, error: agentError } = await agentsTable(admin)
    .insert({
      organization_id: input.organizationId,
      owner_user_id: input.ownerUserId,
      name: input.name,
      provider: input.provider ?? "retell",
      media_asset_id: input.mediaAssetId ?? null,
      booking_enabled: input.bookingEnabled ?? false,
      qa_marker: GROWTH_SENDR_QA_MARKER,
    })
    .select("*")
    .single()
  if (agentError) throw new Error(agentError.message)

  const agent = mapAgent(agentRow as Record<string, unknown>)
  const { data: versionRow, error: versionError } = await versionsTable(admin)
    .insert({
      agent_id: agent.id,
      organization_id: input.organizationId,
      version_number: 1,
      system_prompt: input.systemPrompt ?? null,
      voice_provider: input.voiceProvider ?? null,
      voice_id: input.voiceId ?? null,
      knowledge_sources: input.knowledgeSources ?? [],
      booking_enabled: input.bookingEnabled ?? false,
      qa_marker: GROWTH_SENDR_QA_MARKER,
    })
    .select("id")
    .single()
  if (versionError) throw new Error(versionError.message)

  await agentsTable(admin)
    .update({ published_version_id: String((versionRow as { id: string }).id) })
    .eq("id", agent.id)

  return agent
}

export async function countGrowthSendrAgentEventsToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("growth_engagement_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart)
    .in("event_type", ["agent_opened", "agent_question", "agent_completed"])
  if (error) return 0
  return count ?? 0
}
