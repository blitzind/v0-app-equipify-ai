import { NextResponse } from "next/server"
import { z } from "zod"
import { logAidenHelpEvent } from "@/lib/aiden/analytics"
import { buildAidenSupportPhase2Prompt } from "@/lib/aiden/aiden-support-phase2-prompt"
import { getAidenPageGuidanceLevel } from "@/lib/aiden/tier-capabilities"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"
import { canAccessApp } from "@/lib/billing/access"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { getOrganizationSubscription } from "@/lib/billing/subscriptions"
import {
  AidenSupportPhase2AnswerSchema,
  type AidenSupportPhase2Answer,
} from "@/lib/aiden/aiden-support-phase2-schema"
import { AidenChatMessageSchema } from "@/lib/aiden/aiden-response-rules"
import { moduleFromPath } from "@/lib/aiden/module-context"
import { runAiTask } from "@/lib/ai/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { AiChatMessage } from "@/lib/ai/types"

export const runtime = "nodejs"
export const maxDuration = 60

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Phase 2 — safe support chat + optional feature-request draft text (no execution).
 *
 * - Org-scoped, authenticated members only.
 * - No tools, no mutations, no action execution.
 * - Context: current path + module label only (no record payloads).
 */
const BodySchema = z.object({
  messages: z.array(AidenChatMessageSchema).min(1).max(20),
  currentPath: z.string().trim().max(300).optional().nullable(),
  currentModule: z.string().trim().max(120).optional().nullable(),
})

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

function toAiMessages(systemPrompt: string, chat: z.infer<typeof BodySchema>["messages"]): AiChatMessage[] {
  const trimmed = chat.slice(-12)
  return [{ role: "system", content: systemPrompt }, ...trimmed.map((m) => ({ role: m.role, content: m.content }))]
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("invalid_organization", "Invalid organization id.", 400)
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return jsonError("invalid_body", "Send messages plus optional currentPath and currentModule.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user?.id) {
    return jsonError("unauthorized", "Sign in required.", 401)
  }

  const { data: member, error: memberErr } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (memberErr || !member) {
    return jsonError("forbidden", "You do not have access to this organization.", 403)
  }

  const subscription = await getOrganizationSubscription(supabase, organizationId)
  if (!canAccessApp(subscription)) {
    return jsonError(
      "billing_inactive",
      "AIden is unavailable while billing is restricted for this workspace. Restore billing to continue using help chat.",
      403,
    )
  }

  const planId = getEffectivePlanId(subscription?.plan_id ?? "solo", subscription)
  const pageGuidanceLevel = getAidenPageGuidanceLevel(planId)

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle()

  const orgName = (organization as { name?: string | null } | null)?.name ?? null

  const pathRaw = parsed.data.currentPath?.trim() ?? ""
  const path = pathRaw.length > 0 ? pathRaw : null
  const derivedModule = moduleFromPath(path ?? "/")
  const moduleLabel = parsed.data.currentModule?.trim() || derivedModule.label

  const systemPrompt = buildAidenSupportPhase2Prompt({
    organizationName: orgName,
    currentPath: path,
    currentModule: moduleLabel,
    planTier: planId,
    pageGuidanceLevel,
  })

  const result = await runAiTask<AidenSupportPhase2Answer>({
    task: "aiden_help",
    organizationId,
    input: {
      messages: toAiMessages(systemPrompt, parsed.data.messages),
    },
    schema: AidenSupportPhase2AnswerSchema,
    skipCache: true,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "aiden_failed",
        message: result.error.message || "AIden could not answer right now.",
      },
      { status: 502 },
    )
  }

  const latestQuestion = parsed.data.messages.filter((m) => m.role === "user").at(-1)?.content ?? ""

  await recordAidenUsageEvent({
    organizationId,
    userId: user.id,
    featureKey: "support_chat",
    planTier: planId,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    durationMs: result.meta.durationMs,
    metadata: { module: moduleLabel },
  })

  logAidenHelpEvent({
    organizationId,
    userId: user.id,
    latestQuestion,
    context: { module: moduleLabel },
    unresolved: Boolean(result.output.unresolved),
    answerText: result.output.answer,
    relatedRoutes: result.output.relatedRoutes,
  })

  return NextResponse.json({
    ok: true,
    answer: result.output,
    context: {
      phase: 2,
      module: moduleLabel,
      currentPath: path,
      planTier: planId,
      pageGuidanceLevel,
    },
    meta: {
      provider: result.meta.provider,
      model: result.meta.model,
      durationMs: result.meta.durationMs,
    },
  })
}
