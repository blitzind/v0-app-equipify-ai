/** GE-AIOS-SEND-PLANE-1A — Bridge canonical materialization into copilot generation (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  insertGrowthAiCopilotGeneration,
} from "@/lib/growth/ai-copilot-repository"
import type {
  GrowthAiCopilotGeneration,
  GrowthAiCopilotGenerationType,
} from "@/lib/growth/ai-copilot-types"
import { OUTREACH_PERSONALIZATION_STRATEGY_VERSION } from "@/lib/growth/outreach/personalization/personalization-types"
import { resolveCanonicalOutreachPackageForLead } from "@/lib/growth/aios/growth/growth-send-plane-1a-canonical-loader"
import {
  materializeCanonicalOutreachChannelContent,
  resolveCanonicalTransportChannelFromGenerationType,
  resolveOperatorAssetOverride,
} from "@/lib/growth/aios/growth/growth-send-plane-1a-materialization"
import { GROWTH_AIOS_SEND_PLANE_1A_QA_MARKER } from "@/lib/growth/aios/growth/growth-send-plane-1a-constitution"
import type { RunGrowthAiCopilotGenerationInput } from "@/lib/growth/run-ai-copilot-generation"

export async function tryMaterializeCanonicalCopilotGeneration(input: {
  admin: SupabaseClient
  request: RunGrowthAiCopilotGenerationInput
  actingUserId: string | null
  storeGenerations: boolean
  promptVariant: string
  snapshot: GrowthAiCopilotGeneration["inputSnapshot"]
}): Promise<
  | { ok: true; generation: GrowthAiCopilotGeneration; cached?: boolean }
  | { ok: false; code: string; message: string }
  | null
> {
  const channel = resolveCanonicalTransportChannelFromGenerationType(input.request.generationType)
  if (!channel || channel === "call" || channel === "sendr") {
    return null
  }

  const organizationId = input.request.organizationId ?? getGrowthEngineAiOrgId()
  if (!organizationId) return null

  const pkg = await resolveCanonicalOutreachPackageForLead(input.admin, {
    organizationId,
    leadId: input.request.leadId,
  })
  const brief = pkg?.salesStrategyBrief
  if (!brief) return null

  const materialized = materializeCanonicalOutreachChannelContent({
    brief,
    channel,
    package: pkg,
    operatorAssetOverride: resolveOperatorAssetOverride(pkg, channel),
  })

  if (!materialized.transportReady) {
    return {
      ok: false,
      code: "send_plane_constitution_failed",
      message: materialized.constitutionFailures.join(", ") || "Canonical draft failed constitution gate.",
    }
  }

  const generatedSubject = materialized.subject ?? ""
  const generatedContent = materialized.body
  const classification = {
    confidence: brief.confidence,
    primary: "canonical_send_plane",
  }

  if (!input.storeGenerations) {
    return {
      ok: true,
      generation: {
        id: "ephemeral",
        leadId: input.request.leadId,
        generationType: input.request.generationType,
        promptVersion: OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
        promptVariant: input.promptVariant,
        inputSnapshot: input.snapshot,
        generatedContent,
        generatedSubject,
        classification,
        status: "draft",
        sourceReplyId: input.request.sourceReplyId ?? null,
        inputHash: `send-plane:${pkg.packageId}:${input.request.generationType}`,
        playbookInfluenceScore: 0,
        playbookAttribution: {
          sendPlane: GROWTH_AIOS_SEND_PLANE_1A_QA_MARKER,
          packageId: pkg.packageId,
          channel,
        },
        approvedAt: null,
        approvedBy: null,
        sentAt: null,
        createdBy: input.actingUserId,
        createdAt: new Date().toISOString(),
      },
    }
  }

  const generation = await insertGrowthAiCopilotGeneration(input.admin, {
    leadId: input.request.leadId,
    generationType: input.request.generationType as GrowthAiCopilotGenerationType,
    promptVersion: OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
    promptVariant: input.promptVariant,
    inputSnapshot: input.snapshot,
    generatedContent,
    generatedSubject,
    classification,
    sourceReplyId: input.request.sourceReplyId ?? null,
    inputHash: `send-plane:${pkg.packageId}:${input.request.generationType}`,
    playbookInfluenceScore: 0,
    playbookAttribution: {
      sendPlane: GROWTH_AIOS_SEND_PLANE_1A_QA_MARKER,
      packageId: pkg.packageId,
      channel,
    },
    createdBy: input.actingUserId,
  })

  return { ok: true, generation }
}
