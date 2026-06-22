import { NextResponse } from "next/server"
import { z } from "zod"
import { askGeV14DemoAssistantQuestion } from "@/lib/growth/demo-assistant/ge-v1-4-demo-session-service"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const BodySchema = z.object({
  demoSessionId: z.string().uuid(),
  publicSessionId: z.string().min(8).max(120),
  question: z.string().min(1).max(2000),
  leadId: z.string().uuid().optional(),
  token: z.string().min(16).max(512).optional(),
})

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "unavailable" },
      { status: 503, headers: CORS_HEADERS },
    )
  }

  const { slug } = await context.params
  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const result = await askGeV14DemoAssistantQuestion(admin, {
    slug,
    demoSessionId: parsed.data.demoSessionId,
    publicSessionId: parsed.data.publicSessionId,
    question: parsed.data.question,
    renderContext: {
      leadId: parsed.data.leadId ?? null,
      token: parsed.data.token ?? null,
    },
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status, headers: CORS_HEADERS },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      answer: result.answer,
      bookingOffered: result.bookingOffered,
      bookingUrl: result.bookingUrl,
      intent: result.intent.primaryIntent,
      provider: result.provider,
    },
    { headers: CORS_HEADERS },
  )
}
