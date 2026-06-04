import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadSmsInboxChannelThread } from "@/lib/growth/sms/sms-inbox-bridge"
import { isGrowthSmsSchemaReady } from "@/lib/growth/sms/schema-health"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ conversationId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSmsSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { conversationId } = await context.params
  try {
    const thread = await loadSmsInboxChannelThread(access.admin, conversationId)
    if (!thread) {
      return NextResponse.json({ error: "sms_conversation_not_found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, thread })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "load_failed", message }, { status: 500 })
  }
}
