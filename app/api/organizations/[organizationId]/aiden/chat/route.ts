import { NextResponse } from "next/server"
import { z } from "zod"
import { logAidenHelpEvent } from "@/lib/aiden/analytics"
import { buildAidenSupportPhase1Prompt } from "@/lib/aiden/aiden-support-phase1-prompt"
import {
  AidenSupportPhase1AnswerSchema,
  type AidenSupportPhase1Answer,
} from "@/lib/aiden/aiden-support-phase1-schema"
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
 * Phase 1 — safe support chat only.
 *
 * - Org-scoped, authenticated members only.
 * - No tools, no mutations, no action execution (ignored if legacy clients send extra fields).
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

  const systemPrompt = buildAidenSupportPhase1Prompt({
    organizationName: orgName,
    currentPath: path,
    currentModule: moduleLabel,
  })

  const result = await runAiTask<AidenSupportPhase1Answer>({
    task: "aiden_help",
    organizationId,
    input: {
      messages: toAiMessages(systemPrompt, parsed.data.messages),
    },
    schema: AidenSupportPhase1AnswerSchema,
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
      phase: 1,
      module: moduleLabel,
      currentPath: path,
    },
    meta: {
      provider: result.meta.provider,
      model: result.meta.model,
      durationMs: result.meta.durationMs,
    },
  })
}
