import { NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"
import { runAiTask } from "@/lib/ai/server"
import { generateRecommendations } from "@/lib/ai-ops/engine"
import {
  AI_OPS_NARRATION_SCHEMA_VERSION,
  AI_OPS_NARRATION_SYSTEM_PROMPT,
  buildAiOpsNarrationUserPrompt,
} from "@/lib/ai-ops/narrate-prompt"
import type { Recommendation } from "@/lib/ai-ops/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h freshness — beyond this we re-narrate.

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

const narrationSchema = z.object({
  headline: z.string().trim().min(1).max(120),
  explanation: z.string().trim().min(1).max(600),
  next_steps: z.array(z.string().trim().min(1).max(140)).min(1).max(4),
})

type NarrationPayload = z.infer<typeof narrationSchema>

/**
 * AI Ops Phase 2 — LLM narration for a single recommendation.
 *
 * Re-derives the recommendation server-side (so a client cannot
 * spoof category/rule/entity), then either returns a cached
 * narration or calls `runAiTask("insights_generation")` to generate
 * a new one. Plan/budget gating is inherited from the existing AI
 * router. Falls back to the deterministic explanation gracefully on
 * provider failure / plan denial.
 *
 * Permission: any org member (read-only assist). Writes to the
 * cache table are gated by RLS to owner/admin/manager.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; recommendationKey: string }> },
) {
  const { organizationId, recommendationKey } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400, "invalid_org")
  const key = decodeURIComponent(recommendationKey ?? "").trim()
  if (!key || key.length > 200) return jsonError("Invalid recommendation key.", 400, "invalid_key")

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return jsonError("Sign in required.", 401, "unauthorized")

  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const rawRole = isPlatformAdmin
    ? "owner"
    : await getOrganizationMemberRole(supabase, user.id, organizationId)
  const role = normalizeOrgMemberRole(rawRole)
  if (!role && !isPlatformAdmin) return jsonError("Forbidden.", 403, "forbidden")
  const permissions = getOrgPermissionsForRole(role)
  if (!permissions.canViewInsights && !isPlatformAdmin) {
    return jsonError("AI narration requires insights access.", 403, "forbidden")
  }

  // Re-derive the recommendation server-side. This guarantees the
  // payload sent to the LLM matches the deterministic engine and
  // cannot be tampered with from the client.
  const response = await generateRecommendations({
    supabase,
    organizationId,
    permissions,
    filter: { limit: 100 },
  })
  const target = response.items.find((i) => i.key === key)
  if (!target) {
    return jsonError(
      "Recommendation not found or no longer applicable. The underlying record may have been resolved already.",
      404,
      "not_found",
    )
  }

  // 1. Cache lookup (24h TTL on `updated_at`).
  const cached = await readNarration(supabase, organizationId, key)
  if (cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL_MS) {
    return NextResponse.json({
      ok: true,
      cached: true,
      narration: cached.payload,
      provider: cached.provider,
      model: cached.model,
    })
  }

  // 2. Generate via existing AI infrastructure. We reuse the
  //    `insights_generation` task — same plan/budget gating as the
  //    Insights page, no new task registration required.
  const result = await runAiTask({
    task: "insights_generation",
    organizationId,
    input: {
      system: AI_OPS_NARRATION_SYSTEM_PROMPT,
      user: buildAiOpsNarrationUserPrompt(target),
    },
    schema: narrationSchema,
    taskOverrides: { structuredMode: "json_object" },
    cacheSchemaVersion: AI_OPS_NARRATION_SCHEMA_VERSION,
  })

  if (!result.ok) {
    const message = result.error.message
    const planBlocked = result.meta.escalationReasons.includes("plan_blocked")
    const budgetBlocked = result.meta.escalationReasons.includes("budget_exceeded")
    const fallback = buildFallbackNarration(target)
    if (message.includes("No AI provider is configured")) {
      return NextResponse.json({
        ok: true,
        cached: false,
        narration: fallback,
        provider: null,
        model: null,
        warning: "ai_not_configured",
      })
    }
    if (planBlocked) {
      return NextResponse.json(
        {
          ok: false,
          error: "plan_blocked",
          message: "AI narration is not included on your current plan.",
          fallback,
        },
        { status: 402 },
      )
    }
    if (budgetBlocked) {
      return NextResponse.json(
        {
          ok: false,
          error: "budget_exceeded",
          message: "Monthly AI budget reached. Try again next month or raise the cap.",
          fallback,
        },
        { status: 402 },
      )
    }
    return NextResponse.json(
      { ok: false, error: "generation_failed", message, fallback },
      { status: 500 },
    )
  }

  const payload = result.output as NarrationPayload

  // 3. Persist to cache (best-effort; we always return the response
  //    even if the cache write fails).
  await writeNarration(supabase, {
    organizationId,
    recommendationKey: key,
    target,
    payload,
    provider: result.meta.provider,
    model: result.meta.model,
    userId: user.id,
  })

  return NextResponse.json({
    ok: true,
    cached: false,
    narration: payload,
    provider: result.meta.provider,
    model: result.meta.model,
  })
}

type CachedNarrationRow = {
  payload: NarrationPayload
  provider: string | null
  model: string | null
  updated_at: string
}

async function readNarration(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  key: string,
): Promise<CachedNarrationRow | null> {
  const { data, error } = await supabase
    .from("ai_ops_narrations")
    .select("narration_json, narration_text, provider, model, updated_at")
    .eq("organization_id", organizationId)
    .eq("recommendation_key", key)
    .eq("schema_version", AI_OPS_NARRATION_SCHEMA_VERSION)
    .maybeSingle()
  if (error || !data) return null
  const json = (data as { narration_json: unknown }).narration_json
  const parsed = narrationSchema.safeParse(json)
  if (!parsed.success) return null
  return {
    payload: parsed.data,
    provider: (data as { provider: string | null }).provider ?? null,
    model: (data as { model: string | null }).model ?? null,
    updated_at: (data as { updated_at: string }).updated_at,
  }
}

async function writeNarration(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  args: {
    organizationId: string
    recommendationKey: string
    target: Recommendation
    payload: NarrationPayload
    provider: string
    model: string
    userId: string
  },
): Promise<void> {
  const text = [
    args.payload.headline,
    args.payload.explanation,
    args.payload.next_steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
  ].join("\n\n")

  await supabase.from("ai_ops_narrations").upsert(
    {
      organization_id: args.organizationId,
      recommendation_key: args.recommendationKey,
      rule_id: args.target.ruleId,
      category: args.target.category,
      narration_text: text,
      narration_json: args.payload,
      provider: args.provider,
      model: args.model,
      schema_version: AI_OPS_NARRATION_SCHEMA_VERSION,
      generated_by: args.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,recommendation_key,schema_version" },
  )
}

function buildFallbackNarration(rec: Recommendation): NarrationPayload {
  const steps: string[] = []
  if (rec.actions[0]?.label) steps.push(rec.actions[0].label)
  if (rec.actions[1]?.label) steps.push(rec.actions[1].label)
  if (steps.length === 0) steps.push("Open the related record")
  steps.push("Confirm with the customer or technician")
  return {
    headline: rec.title,
    explanation: rec.explanation,
    next_steps: steps.slice(0, 4),
  }
}
