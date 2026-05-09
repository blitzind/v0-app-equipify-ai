import { NextResponse } from "next/server"
import { z } from "zod"
import { AidenChatMessageSchema, AidenFeatureRequestDraftSchema } from "@/lib/aiden/aiden-response-rules"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"
import { canAccessApp } from "@/lib/billing/access"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { getOrganizationSubscription } from "@/lib/billing/subscriptions"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ManualFeatureRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(4000),
  moduleContext: z.string().trim().max(200).optional().nullable(),
  module: z.string().trim().max(120).optional().nullable(),
  currentPath: z.string().trim().max(300).optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  userNotes: z.string().trim().max(2000).optional().nullable(),
})

const BodySchema = z
  .object({
    draft: AidenFeatureRequestDraftSchema.optional(),
    manual: ManualFeatureRequestSchema.optional(),
    currentPath: z.string().trim().max(300).optional().nullable(),
    module: z.string().trim().max(120).optional().nullable(),
    chatContext: z.array(AidenChatMessageSchema).max(8).optional().default([]),
  })
  .refine(
    (data) => {
      const hasDraft = data.draft != null
      const hasManual = data.manual != null
      return (hasDraft && !hasManual) || (!hasDraft && hasManual)
    },
    { message: "Send exactly one of draft (AI-shaped) or manual (form) submission." },
  )

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

function sanitizeText(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]")
    .replace(/\b(?:sk|pk|rk|api|key|secret|token)_[A-Za-z0-9_-]{12,}\b/g, "[secret]")
    .slice(0, max)
}

function normalizeForDedupe(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
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
    return jsonError("invalid_body", "Send either draft (from AIden) or manual form fields.", 400)
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
      "Feature requests are unavailable while billing is restricted for this workspace.",
      403,
    )
  }

  const planId = getEffectivePlanId(subscription?.plan_id ?? "solo", subscription)

  const payload = parsed.data.draft
    ? {
        kind: "draft" as const,
        title: sanitizeText(parsed.data.draft.title, 120),
        originalQuestion: sanitizeText(parsed.data.draft.originalQuestion, 1000),
        module: sanitizeText(parsed.data.draft.module ?? parsed.data.module, 120),
        path: sanitizeText(parsed.data.draft.currentPath ?? parsed.data.currentPath, 300),
        currentLimitation: sanitizeText(parsed.data.draft.currentLimitation, 600),
        suggestedImprovement: sanitizeText(parsed.data.draft.suggestedImprovement, 800),
        businessValue: sanitizeText(parsed.data.draft.businessValue, 800),
        priority: "unreviewed" as const,
      }
    : parsed.data.manual
      ? {
          kind: "manual" as const,
          title: sanitizeText(parsed.data.manual.title, 120),
          originalQuestion: sanitizeText(parsed.data.manual.description, 4000),
          module: sanitizeText(
            parsed.data.manual.moduleContext ?? parsed.data.manual.module ?? parsed.data.module,
            120,
          ),
          path: sanitizeText(parsed.data.manual.currentPath ?? parsed.data.currentPath, 300),
          currentLimitation: null as string | null,
          suggestedImprovement: sanitizeText(parsed.data.manual.userNotes, 800),
          businessValue: null as string | null,
          priority: parsed.data.manual.priority ?? ("unreviewed" as const),
        }
      : null

  if (!payload || !payload.title || !payload.originalQuestion) {
    return jsonError("invalid_payload", "Title and description are required.", 400)
  }

  const dedupeQuestion = normalizeForDedupe(payload.originalQuestion)
  const dedupeTitle = normalizeForDedupe(payload.title)
  const { data: recent } = await supabase
    .from("product_feature_requests")
    .select("id, title, original_question, status, created_at")
    .eq("organization_id", organizationId)
    .eq("submitted_by", user.id)
    .in("status", ["new", "reviewed", "planned", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(25)

  const duplicate = (recent ?? []).find((row) => {
    const existingTitle = normalizeForDedupe(String(row.title ?? ""))
    const existingQuestion = normalizeForDedupe(String(row.original_question ?? ""))
    return existingTitle === dedupeTitle || existingQuestion === dedupeQuestion
  })

  if (duplicate?.id) {
    await recordAidenUsageEvent({
      organizationId,
      userId: user.id,
      featureKey: "feature_request",
      planTier: planId,
      metadata: { kind: payload.kind, duplicate: true },
    })
    return NextResponse.json({ ok: true, duplicate: true, requestId: duplicate.id })
  }

  const chatContext = parsed.data.chatContext.slice(-6).map((message) => ({
    role: message.role,
    content: sanitizeText(message.content, 800),
  }))

  const { data: inserted, error: insertErr } = await supabase
    .from("product_feature_requests")
    .insert({
      organization_id: organizationId,
      submitted_by: user.id,
      source: "aiden",
      title: payload.title,
      original_question: payload.originalQuestion,
      module: payload.module,
      current_path: payload.path,
      current_limitation: payload.currentLimitation,
      suggested_improvement: payload.suggestedImprovement,
      business_value: payload.businessValue,
      status: "new",
      priority: payload.priority,
      chat_context: {
        submittedAt: new Date().toISOString(),
        submissionKind: payload.kind,
        messages: chatContext,
      },
    })
    .select("id")
    .single()

  if (insertErr || !inserted?.id) {
    return jsonError("insert_failed", insertErr?.message ?? "Could not save feature request.", 500)
  }

  await recordAidenUsageEvent({
    organizationId,
    userId: user.id,
    featureKey: "feature_request",
    planTier: planId,
    metadata: { kind: payload.kind, duplicate: false },
  })

  return NextResponse.json({ ok: true, duplicate: false, requestId: inserted.id })
}
