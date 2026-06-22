import { NextResponse } from "next/server"
import { z } from "zod"
import { createGeV14DemoAssistantSessionForPage } from "@/lib/growth/demo-assistant/ge-v1-4-demo-session-service"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const BodySchema = z.object({
  publicSessionId: z.string().min(8).max(120),
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

  const result = await createGeV14DemoAssistantSessionForPage(admin, {
    slug,
    publicSessionId: parsed.data.publicSessionId,
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
      sessionId: result.session.id,
      degraded: result.degraded,
      bookingUrl: result.session.prospectContext.bookingUrl ?? null,
    },
    { headers: CORS_HEADERS },
  )
}
