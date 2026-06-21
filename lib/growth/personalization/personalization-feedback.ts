import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthPersonalizationFeedbackType } from "@/lib/growth/personalization/personalization-types"
import type {
  GrowthPersonalizationNegativeFeedbackReason,
  GrowthPersonalizationOperatorEvaluationSentiment,
} from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-types"

export async function recordPersonalizationFeedback(
  admin: SupabaseClient,
  input: {
    generationId: string
    leadId: string
    feedbackType: GrowthPersonalizationFeedbackType
    notes?: string
    actorUserId: string
    actorEmail: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin.schema("growth").from("personalization_feedback").insert({
    generation_id: input.generationId,
    lead_id: input.leadId,
    feedback_type: input.feedbackType,
    notes: input.notes?.trim() ?? "",
    actor_user_id: input.actorUserId,
    actor_email: input.actorEmail,
    metadata: input.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

export async function recordPersonalizationOperatorEvaluationFeedback(
  admin: SupabaseClient,
  input: {
    generationId: string
    leadId: string
    sentiment: GrowthPersonalizationOperatorEvaluationSentiment
    negativeReason?: GrowthPersonalizationNegativeFeedbackReason | null
    customNote?: string | null
    actorUserId: string
    actorEmail: string
  },
): Promise<void> {
  await recordPersonalizationFeedback(admin, {
    generationId: input.generationId,
    leadId: input.leadId,
    feedbackType: input.sentiment === "helpful" ? "performed_well" : "performed_poorly",
    notes: input.customNote?.trim() ?? "",
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    metadata: {
      evaluation_kind: "operator_quality",
      evaluation_sentiment: input.sentiment,
      ...(input.sentiment === "not_helpful" && input.negativeReason
        ? { negative_reason: input.negativeReason }
        : {}),
      ...(input.customNote?.trim() ? { custom_note: input.customNote.trim() } : {}),
    },
  })
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
