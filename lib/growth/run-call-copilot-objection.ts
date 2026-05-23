import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"
import {
  fetchGrowthCallCopilotSession,
  getCallCopilotBriefing,
  insertGrowthCallBriefEffectiveness,
  updateGrowthCallCopilotSession,
} from "@/lib/growth/call-copilot-repository"
import type { GrowthCallCopilotSession } from "@/lib/growth/call-copilot-types"
import { runGrowthAiCopilotGeneration } from "@/lib/growth/run-ai-copilot-generation"
import { emitGrowthLeadCallCopilotObjectionCapturedTimeline } from "@/lib/growth/timeline-emitter"

export async function runGrowthCallCopilotObjection(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    objectionText: string
    frameworkKey?: string | null
    actingUserId: string
    actingUserEmail: string
  },
): Promise<
  | { ok: true; session: GrowthCallCopilotSession }
  | { ok: false; code: string; message: string }
> {
  const trimmed = input.objectionText.trim()
  if (!trimmed) {
    return { ok: false, code: "invalid_objection", message: "Objection text is required." }
  }

  const existing = await fetchGrowthCallCopilotSession(admin, input)
  if (!existing) return { ok: false, code: "not_found", message: "Session not found." }
  if (existing.status !== "in_call") {
    return { ok: false, code: "invalid_status", message: "Session must be in_call to capture objections." }
  }

  const generation = await runGrowthAiCopilotGeneration({
    admin,
    leadId: input.leadId,
    generationType: "call_objection_response",
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
    snapshotOverrides: { replyPreview: trimmed },
  })

  if (!generation.ok) {
    return { ok: false, code: generation.code, message: generation.message }
  }

  const entry = {
    id: randomUUID(),
    input: trimmed,
    frameworkKey: input.frameworkKey ?? null,
    response: generation.generation.generatedContent,
    generationId: generation.generation.id !== "ephemeral" ? generation.generation.id : null,
    capturedAt: new Date().toISOString(),
    capturedBy: input.actingUserId,
  }

  const session = await updateGrowthCallCopilotSession(admin, {
    leadId: input.leadId,
    sessionId: input.sessionId,
    patch: {
      detectedObjections: [...existing.detectedObjections, entry],
      recommendedResponses: {
        ...existing.recommendedResponses,
        [entry.id]: {
          response: generation.generation.generatedContent,
          generationId: entry.generationId,
        },
      },
    },
  })

  const briefing = getCallCopilotBriefing(session)
  await insertGrowthCallBriefEffectiveness(admin, {
    sessionId: session.id,
    leadId: input.leadId,
    outcome: "objection_captured",
    highRiskCall: briefing?.highRiskCall ?? false,
    callOutcomeConfidence: session.callOutcomeConfidence,
    metadata: { objectionPreview: trimmed.slice(0, 120) },
  })

  await emitGrowthLeadCallCopilotObjectionCapturedTimeline(admin, {
    leadId: input.leadId,
    sessionId: session.id,
    objectionPreview: trimmed.slice(0, 120),
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })

  return { ok: true, session }
}
