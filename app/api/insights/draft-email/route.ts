import { NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { runAiTask } from "@/lib/ai/server"
import { aiDebugLog } from "@/lib/ai/ai-debug"
import { applyUserPromptTemplate, getPromptForTask } from "@/lib/ai/prompts"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Body = {
  organizationId?: string
  insightTitle?: string
  insightCategory?: string
  insightText?: string
  recommendedAction?: string
  relatedMetric?: string
}

const draftEmailOutputSchema = z
  .object({
    subject: z.string(),
    body: z.string(),
  })
  .transform((d) => ({
    subject: d.subject.trim(),
    body: d.body.trim(),
  }))
  .superRefine((d, ctx) => {
    if (!d.subject) {
      ctx.addIssue({ code: "custom", message: "subject required", path: ["subject"] })
    }
    if (!d.body) {
      ctx.addIssue({ code: "custom", message: "body required", path: ["body"] })
    }
  })

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }

  const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  const insightTitle = typeof body.insightTitle === "string" ? body.insightTitle.trim() : ""
  const insightCategory = typeof body.insightCategory === "string" ? body.insightCategory.trim() : ""
  const insightText = typeof body.insightText === "string" ? body.insightText.trim() : ""
  const recommendedAction = typeof body.recommendedAction === "string" ? body.recommendedAction.trim() : ""
  const relatedMetric = typeof body.relatedMetric === "string" ? body.relatedMetric.trim() : ""

  if (!insightTitle || !insightText) {
    return NextResponse.json(
      { error: "invalid_payload", message: "insightTitle and insightText are required." },
      { status: 400 },
    )
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to draft email." }, { status: 401 })
  }

  const { data: member, error: memberErr } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (memberErr || !member) {
    return NextResponse.json(
      { error: "forbidden", message: "You do not have access to this organization." },
      { status: 403 },
    )
  }

  const prompt = getPromptForTask("customer_email")
  const userMessage = applyUserPromptTemplate(prompt.userPromptTemplate, {
    insightCategory: insightCategory || "general",
    insightTitle,
    insightText,
    recommendedActionBlock: recommendedAction ? `Suggested next step: ${recommendedAction}\n` : "",
    relatedMetricBlock: relatedMetric ? `Related metric: ${relatedMetric}\n` : "",
  })

  const envModel = process.env.OPENAI_INSIGHTS_MODEL?.trim()
  const taskOverrides = {
    structuredMode: "json_object" as const,
    ...(envModel != null && envModel.length > 0
      ? { primaryModel: { provider: "openai" as const, model: envModel } }
      : {}),
  }

  try {
    const result = await runAiTask({
      task: "customer_email",
      organizationId,
      input: {
        system: prompt.systemPrompt,
        user: userMessage,
      },
      schema: draftEmailOutputSchema,
      taskOverrides,
      cacheSchemaVersion: prompt.schemaVersion,
    })

    if (!result.ok) {
      const message = result.error.message
      aiDebugLog("draft_email_failed", {
        organizationId,
        message: message.slice(0, 500),
        escalationReasons: result.meta.escalationReasons,
      })
      if (message.includes("No AI provider is configured")) {
        return NextResponse.json(
          {
            ok: false,
            error: "not_configured",
            message:
              "Draft email is not configured. Add OPENAI_API_KEY (and optional ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY) and AI_ENABLED_PROVIDERS.",
          },
          { status: 503 },
        )
      }
      return NextResponse.json({ ok: false, error: "generation_failed", message }, { status: 500 })
    }

    aiDebugLog("draft_email_ok", {
      organizationId,
      model: result.meta.model,
      provider: result.meta.provider,
      escalated: result.meta.escalated,
      promptId: prompt.promptId,
      promptVersion: prompt.version,
    })

    const { subject, body: emailBody } = result.output
    if (!subject || !emailBody) {
      return NextResponse.json({ error: "invalid_ai_shape", message: "AI response missing subject or body." }, { status: 500 })
    }

    return NextResponse.json({ ok: true, subject, body: emailBody })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "generation_failed", message }, { status: 500 })
  }
}
