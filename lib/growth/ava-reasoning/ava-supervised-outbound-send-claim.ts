/**
 * AVA-SUPERVISED-OUTBOUND-1B — Atomic supervised send claim (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import {
  AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER,
  buildAvaSupervisedOutboundSendClaim,
  type AvaSupervisedOutboundSendLifecycle,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1b-types"

const GENERATION_SELECT =
  "id, lead_id, generation_type, prompt_version, prompt_variant, input_snapshot, generated_content, generated_subject, classification, status, source_reply_id, input_hash, playbook_influence_score, playbook_attribution, approved_at, approved_by, sent_at, created_by, created_at"

function mapGeneration(row: Record<string, unknown>): GrowthAiCopilotGeneration {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    generationType: row.generation_type as GrowthAiCopilotGeneration["generationType"],
    promptVersion: String(row.prompt_version),
    promptVariant: String(row.prompt_variant),
    inputSnapshot: (row.input_snapshot as Record<string, unknown>) ?? {},
    generatedContent: String(row.generated_content),
    generatedSubject: (row.generated_subject as string | null) ?? null,
    classification: (row.classification as GrowthAiCopilotGeneration["classification"]) ?? {},
    status: row.status as GrowthAiCopilotGeneration["status"],
    sourceReplyId: (row.source_reply_id as string | null) ?? null,
    inputHash: (row.input_hash as string | null) ?? null,
    playbookInfluenceScore: Number(row.playbook_influence_score ?? 0),
    playbookAttribution: (row.playbook_attribution as Record<string, unknown>) ?? {},
    approvedAt: (row.approved_at as string | null) ?? null,
    approvedBy: (row.approved_by as string | null) ?? null,
    sentAt: (row.sent_at as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
  }
}

export type ClaimAvaSupervisedOutboundSendResult =
  | { ok: true; generation: GrowthAiCopilotGeneration; lifecycle: AvaSupervisedOutboundSendLifecycle }
  | { ok: false; code: string; generation?: GrowthAiCopilotGeneration | null }

export async function claimAvaSupervisedOutboundSend(
  admin: SupabaseClient,
  input: {
    generationId: string
    actingUserId: string
    sendAttemptId: string
  },
): Promise<ClaimAvaSupervisedOutboundSendResult> {
  const claim = buildAvaSupervisedOutboundSendClaim({
    claimedBy: input.actingUserId,
    sendAttemptId: input.sendAttemptId,
  })

  const { data, error } = await admin.schema("growth").rpc("claim_ava_supervised_outbound_send", {
    p_generation_id: input.generationId,
    p_claim: claim,
  })

  if (error) {
    if (error.message.includes("claim_ava_supervised_outbound_send")) {
      return { ok: false, code: "claim_function_unavailable", generation: null }
    }
    throw new Error(error.message)
  }

  const payload = data as { ok?: boolean; code?: string; generation?: Record<string, unknown> } | null
  if (!payload?.ok || !payload.generation) {
    return { ok: false, code: payload?.code ?? "send_claim_rejected", generation: null }
  }

  const generation = mapGeneration(payload.generation)
  return { ok: true, generation, lifecycle: claim }
}

export async function finalizeAvaSupervisedOutboundSendClaim(
  admin: SupabaseClient,
  input: {
    generationId: string
    sendAttemptId: string
    sentAt: string | null
    classification: Record<string, unknown>
    generatedContent?: string
  },
): Promise<GrowthAiCopilotGeneration | null> {
  const patch: Record<string, unknown> = {
    classification: input.classification,
  }
  if (input.generatedContent !== undefined) patch.generated_content = input.generatedContent
  if (input.sentAt) patch.sent_at = input.sentAt

  const { data, error } = await admin
    .schema("growth")
    .from("ai_copilot_generations")
    .update(patch)
    .eq("id", input.generationId)
    .eq("classification->avaSupervisedOutboundSendLifecycle->>sendAttemptId", input.sendAttemptId)
    .eq("classification->avaSupervisedOutboundSendLifecycle->>status", "sending")
    .select(GENERATION_SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapGeneration(data as Record<string, unknown>) : null
}

export async function releaseAvaSupervisedOutboundSendClaim(
  admin: SupabaseClient,
  input: {
    generation: GrowthAiCopilotGeneration
    sendAttemptId: string
    actingUserId: string
    lifecycleStatus: "failed" | "delivery_unknown"
    errorCode?: string | null
    errorMessage?: string | null
    receipt: Record<string, unknown>
  },
): Promise<GrowthAiCopilotGeneration | null> {
  const currentLifecycle =
    (input.generation.classification as Record<string, unknown>).avaSupervisedOutboundSendLifecycle &&
    typeof (input.generation.classification as Record<string, unknown>).avaSupervisedOutboundSendLifecycle ===
      "object"
      ? ((input.generation.classification as Record<string, unknown>).avaSupervisedOutboundSendLifecycle as {
          claimedAt?: string
          claimedBy?: string
        })
      : null

  const classification = {
    ...(input.generation.classification as Record<string, unknown>),
    avaSupervisedOutboundSendLifecycle: {
      qaMarker: AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER,
      status: input.lifecycleStatus,
      claimedAt: currentLifecycle?.claimedAt ?? new Date().toISOString(),
      claimedBy: currentLifecycle?.claimedBy ?? input.actingUserId,
      sendAttemptId: input.sendAttemptId,
      completedAt: new Date().toISOString(),
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
    },
    avaSupervisedOutboundSendReceipt: input.receipt,
  }

  const { data, error } = await admin
    .schema("growth")
    .from("ai_copilot_generations")
    .update({ classification })
    .eq("id", input.generation.id)
    .eq("classification->avaSupervisedOutboundSendLifecycle->>sendAttemptId", input.sendAttemptId)
    .select(GENERATION_SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapGeneration(data as Record<string, unknown>) : null
}
