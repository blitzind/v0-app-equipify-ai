import { NextResponse } from "next/server"
import { z } from "zod"
import { logAidenHelpEvent } from "@/lib/aiden/analytics"
import { buildAidenSystemPrompt } from "@/lib/aiden/aiden-system-prompt"
import {
  buildServerAidenContext,
  formatAidenContextForPrompt,
  type AidenClientPageContext,
} from "@/lib/aiden/context-builders"
import {
  AidenAnswerSchema,
  AidenChatMessageSchema,
  type AidenChatMessage,
} from "@/lib/aiden/aiden-response-rules"
import { runAiTask } from "@/lib/ai/server"
import { getEffectiveOrgPermissions, normalizeOrgMemberRole } from "@/lib/permissions/model"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { AiChatMessage } from "@/lib/ai/types"

export const runtime = "nodejs"
export const maxDuration = 60

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  messages: z.array(AidenChatMessageSchema).min(1).max(20),
  currentPath: z.string().trim().max(300).optional().nullable(),
  currentModule: z.string().trim().max(120).optional().nullable(),
  pageContext: z
    .object({
      currentPath: z.string().trim().max(300).optional().nullable(),
      currentModule: z.string().trim().max(120).optional().nullable(),
      visibleTitle: z.string().trim().max(160).optional().nullable(),
      organizationId: z.string().trim().max(80).optional().nullable(),
      selectedEntityIds: z
        .object({
          customerId: z.string().trim().max(80).optional().nullable(),
          equipmentId: z.string().trim().max(80).optional().nullable(),
          workOrderId: z.string().trim().max(80).optional().nullable(),
          invoiceId: z.string().trim().max(80).optional().nullable(),
          quoteId: z.string().trim().max(80).optional().nullable(),
          maintenancePlanId: z.string().trim().max(80).optional().nullable(),
        })
        .optional(),
      currentRecord: z
        .object({
          type: z.string().trim().max(80),
          id: z.string().trim().max(80).optional().nullable(),
          label: z.string().trim().max(160).optional().nullable(),
          number: z.string().trim().max(80).optional().nullable(),
          status: z.string().trim().max(80).optional().nullable(),
          customer: z.string().trim().max(160).optional().nullable(),
          equipment: z.string().trim().max(160).optional().nullable(),
          assignedTech: z.string().trim().max(160).optional().nullable(),
          serial: z.string().trim().max(120).optional().nullable(),
        })
        .optional()
        .nullable(),
      pageState: z.record(z.union([z.string().max(160), z.number(), z.boolean(), z.null()])).optional(),
    })
    .optional()
    .nullable(),
  stream: z.boolean().optional().default(false),
})

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

function buildUserContext(args: {
  formattedContext: string
}): string {
  return [
    "Current app context:",
    args.formattedContext,
    "",
    "Answer the user's latest Equipify help question using this context and the user's permissions.",
    "Return JSON with: message, answer, steps, relatedRoutes, actions, permissionNote, limitation, unresolved, howToMode.",
  ].join("\n")
}

function toAiMessages(messages: AidenChatMessage[], formattedContext: string, promptContext: Parameters<typeof buildAidenSystemPrompt>[0]): AiChatMessage[] {
  const trimmedHistory = messages.slice(-12)
  return [
    { role: "system", content: buildAidenSystemPrompt(promptContext) },
    { role: "user", content: buildUserContext({ formattedContext }) },
    ...trimmedHistory.map((m): AiChatMessage => ({ role: m.role, content: m.content })),
  ]
}

function withLegacyContext(body: z.infer<typeof BodySchema>): AidenClientPageContext {
  return {
    ...(body.pageContext ?? {}),
    currentPath: body.pageContext?.currentPath ?? body.currentPath ?? null,
    currentModule: body.pageContext?.currentModule ?? body.currentModule ?? null,
  }
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
    return jsonError("invalid_body", "Send messages plus optional currentPath/currentModule.", 400)
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
    .select("user_id, role, permission_profile, permissions_json")
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

  const permissions = getEffectiveOrgPermissions({
    role: normalizeOrgMemberRole((member as { role?: string | null }).role),
    permissionProfile: (member as { permission_profile?: string | null }).permission_profile ?? null,
    permissionsJson: (member as { permissions_json?: unknown }).permissions_json ?? null,
  })
  const pageContext = await buildServerAidenContext({
    supabase,
    organizationId,
    organizationName: (organization as { name?: string | null } | null)?.name ?? null,
    permissions,
    clientContext: withLegacyContext(parsed.data),
  })
  const formattedContext = formatAidenContextForPrompt(pageContext)

  const result = await runAiTask({
    task: "aiden_help",
    organizationId,
    input: {
      messages: toAiMessages(
        parsed.data.messages,
        formattedContext,
        pageContext,
      ),
    },
    schema: AidenAnswerSchema,
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
    context: pageContext,
    unresolved: Boolean(result.output.unresolved),
    answerText: result.output.answer,
    relatedRoutes: result.output.relatedRoutes,
  })

  return NextResponse.json({
    ok: true,
    answer: result.output,
    context: {
      module: pageContext.module,
      currentRecord: pageContext.currentRecord,
      allowedActions: pageContext.allowedActions,
      streaming: {
        requested: parsed.data.stream,
        supported: false,
      },
    },
    meta: {
      provider: result.meta.provider,
      model: result.meta.model,
      durationMs: result.meta.durationMs,
    },
  })
}
