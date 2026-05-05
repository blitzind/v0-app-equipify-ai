import { NextResponse } from "next/server"
import OpenAI from "openai"
import { createServerSupabaseClient } from "@/lib/supabase/server"
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

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_configured",
        message: "Draft email is not configured. Add OPENAI_API_KEY to the server environment.",
      },
      { status: 503 },
    )
  }

  const model = process.env.OPENAI_INSIGHTS_MODEL?.trim() || "gpt-4o-mini"
  const client = new OpenAI({ apiKey })

  const system = `You are helping a field service company write a professional customer email.

Return a single JSON object (no markdown) with exactly:
{
  "subject": string,
  "body": string
}

Rules:
- Tone: clear, helpful, professional; no hype.
- Do not invent customer names, dollar amounts, or specific dates not provided in the prompt.
- Body should be plain text with short paragraphs; suitable for copy-paste into an email client.
- Do not include a signature block or automated disclaimer unless the user context implies it.
`

  const userContent = [
    `Organization context: internal Equipify user drafting follow-up (category: ${insightCategory || "general"}).`,
    `Insight title: ${insightTitle}`,
    `Insight: ${insightText}`,
    recommendedAction ? `Suggested next step: ${recommendedAction}` : null,
    relatedMetric ? `Related metric: ${relatedMetric}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    })

    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) {
      return NextResponse.json({ error: "empty_response", message: "AI returned an empty response." }, { status: 500 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: "parse_failed", message: "Failed to parse AI response." }, { status: 500 })
    }

    const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
    const subject = typeof o.subject === "string" ? o.subject.trim() : ""
    const emailBody = typeof o.body === "string" ? o.body.trim() : ""
    if (!subject || !emailBody) {
      return NextResponse.json({ error: "invalid_ai_shape", message: "AI response missing subject or body." }, { status: 500 })
    }

    return NextResponse.json({ ok: true, subject, body: emailBody })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "generation_failed", message }, { status: 500 })
  }
}
