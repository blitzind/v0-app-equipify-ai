import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthPersonalizationFeedbackType } from "@/lib/growth/personalization/personalization-types"

export async function recordPersonalizationFeedback(
  admin: SupabaseClient,
  input: {
    generationId: string
    leadId: string
    feedbackType: GrowthPersonalizationFeedbackType
    notes?: string
    actorUserId: string
    actorEmail: string
  },
): Promise<void> {
  const { error } = await admin.schema("growth").from("personalization_feedback").insert({
    generation_id: input.generationId,
    lead_id: input.leadId,
    feedback_type: input.feedbackType,
    notes: input.notes?.trim() ?? "",
    actor_user_id: input.actorUserId,
    actor_email: input.actorEmail,
  })
  if (error) throw new Error(error.message)
}

export async function listPersonalizationFeedback(admin: SupabaseClient, generationId: string) {
  const { data, error } = await admin
    .schema("growth")
    .from("personalization_feedback")
    .select("*")
    .eq("generation_id", generationId)
    .order("recorded_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    feedbackType: String(row.feedback_type) as GrowthPersonalizationFeedbackType,
    notes: String(row.notes ?? ""),
    actorEmail: String(row.actor_email ?? ""),
    recordedAt: String(row.recorded_at ?? ""),
  }))
}
