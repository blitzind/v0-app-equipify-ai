import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type AppendGovernancePolicyEventInput = {
  eventType:
    | "policy_created"
    | "policy_activated"
    | "policy_paused"
    | "policy_archived"
    | "policy_evaluated"
    | "policy_violation"
    | "approval_audited"
    | "export_requested"
    | "export_completed"
    | "retention_updated"
    | "legal_hold_applied"
  policyId?: string | null
  severity?: "info" | "low" | "medium" | "high" | "critical"
  title: string
  description: string
  actorUserId?: string | null
  actorEmail?: string
  metadata?: Record<string, unknown>
}

export async function appendGovernancePolicyEvent(
  admin: SupabaseClient,
  input: AppendGovernancePolicyEventInput,
): Promise<void> {
  const { error } = await admin.schema("growth").from("governance_policy_events").insert({
    event_type: input.eventType,
    policy_id: input.policyId ?? null,
    severity: input.severity ?? "info",
    title: input.title,
    description: input.description,
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? "",
    metadata: input.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

export async function appendGovernancePlatformTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType: string
    title: string
    summary: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await admin
    .schema("growth")
    .from("platform_timeline_events")
    .insert({
      event_type: input.eventType,
      title: input.title,
      summary: input.summary,
      metadata: input.metadata ?? {},
    })
    .then(() => undefined)
    .catch(() => undefined)
}

export async function listGovernancePolicyEvents(
  admin: SupabaseClient,
  input?: { limit?: number; eventType?: string },
) {
  let query = admin
    .schema("growth")
    .from("governance_policy_events")
    .select("*")
    .order("recorded_at", { ascending: false })
  if (input?.eventType) query = query.eq("event_type", input.eventType)
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    eventType: String(row.event_type ?? ""),
    policyId: row.policy_id ? String(row.policy_id) : null,
    severity: String(row.severity ?? "info") as "info" | "low" | "medium" | "high" | "critical",
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    actorEmail: String(row.actor_email ?? ""),
    recordedAt: String(row.recorded_at ?? ""),
  }))
}
