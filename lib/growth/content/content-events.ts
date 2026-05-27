import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthContentApprovalEntityType,
  GrowthContentApprovalEventType,
} from "@/lib/growth/content/content-types"

export async function appendContentTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType:
      | "content_template_created"
      | "content_template_submitted"
      | "content_template_approved"
      | "content_template_rejected"
      | "content_snippet_approved"
      | "content_render_previewed"
    title: string
    summary: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await admin.schema("growth").from("platform_timeline_events").insert({
      event_type: input.eventType,
      title: input.title.slice(0, 200),
      summary: input.summary.slice(0, 1000),
      metadata: input.metadata ?? {},
    })
  } catch {
    /* best-effort */
  }
}

export async function recordContentApprovalEvent(
  admin: SupabaseClient,
  input: {
    entityType: GrowthContentApprovalEntityType
    entityId: string
    eventType: GrowthContentApprovalEventType
    actorUserId?: string | null
    title: string
    description?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await admin.schema("growth").from("content_approval_events").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    event_type: input.eventType,
    actor_user_id: input.actorUserId ?? null,
    title: input.title.slice(0, 200),
    description: input.description?.slice(0, 2000) ?? "",
    metadata: input.metadata ?? {},
  })
}
