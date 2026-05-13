import { NextResponse } from "next/server"
import { z } from "zod"
import { buildOperationalRecommendationsPrompt } from "@/lib/aiden/operational-prompts"
import {
  AidenOperationalRecommendationsAnswerSchema,
  OperationalModuleContextSchema,
  type AidenOperationalRecommendationsAnswer,
} from "@/lib/aiden/operational-recommendations-schema"
import { buildOperationalSnapshot } from "@/lib/aiden/operational-snapshot"
import { resolveOperationalRecommendationsRequest } from "@/lib/aiden/operational-request-context"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"
import { runAiTask } from "@/lib/ai/server"
import { industryLabelForLaunchpad } from "@/lib/first-run/launchpad-copy"
import { resolveOnboardingIndustryBundle } from "@/lib/onboarding-industry/resolve-onboarding-industry-bundle"

export const runtime = "nodejs"
export const maxDuration = 90

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  moduleContext: OperationalModuleContextSchema.optional().default("dashboard"),
})

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("invalid_organization", "Invalid organization id.", 400)
  }

  const rawBody = await request.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return jsonError("invalid_body", parsed.error.message, 400)
  }

  const resolved = await resolveOperationalRecommendationsRequest(organizationId)
  if (!resolved.ok) {
    return resolved.response
  }

  const { ctx } = resolved
  const includeFinancialHints = Boolean(ctx.permissions.canViewFinancials || ctx.permissions.canViewBilling)

  const snapshot = await buildOperationalSnapshot(ctx.supabase, {
    organizationId,
    permissions: ctx.permissions,
    assignedScope: ctx.assignedScope,
    moduleContext: parsed.data.moduleContext,
    includeFinancialHints,
  })

  const { data: orgIndustry } = await ctx.supabase
    .from("organizations")
    .select("industry")
    .eq("id", organizationId)
    .maybeSingle()
  const industryRaw = (orgIndustry as { industry?: string | null } | null)?.industry ?? null
  const sectorFraming = resolveOnboardingIndustryBundle(
    industryRaw,
    industryLabelForLaunchpad(industryRaw),
  ).aidenSectorFraming

  const snapshotJson = JSON.stringify(snapshot)
  const prompt = buildOperationalRecommendationsPrompt({
    snapshotJson,
    moduleContext: parsed.data.moduleContext,
    sectorFraming,
  })

  const started = Date.now()
  const result = await runAiTask<AidenOperationalRecommendationsAnswer>({
    task: "aiden_operational_recommendations",
    organizationId,
    input: { system: prompt.system, user: prompt.user },
    schema: AidenOperationalRecommendationsAnswerSchema,
  })

  if (!result.ok) {
    return jsonError("ai_failed", result.error.message || "Could not generate recommendations.", 502)
  }

  void recordAidenUsageEvent({
    organizationId,
    userId: ctx.userId,
    featureKey: "operational_recommendations",
    planTier: ctx.planId,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    durationMs: Date.now() - started,
    metadata: { module: parsed.data.moduleContext },
  })

  return NextResponse.json({ ok: true, answer: result.output })
}
