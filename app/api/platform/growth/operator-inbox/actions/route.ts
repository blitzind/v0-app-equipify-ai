import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { applyOperatorInboxAction } from "@/lib/growth/operator-inbox/operator-inbox-service"
import {
  OPERATOR_INBOX_ACTIONS,
  OPERATOR_INBOX_ITEM_SOURCES,
} from "@/lib/growth/operator-inbox/operator-inbox-types"

export const runtime = "nodejs"
export const maxDuration = 120

const ActionSchema = z.object({
  action: z.enum(OPERATOR_INBOX_ACTIONS),
  item_id: z.string().max(200),
  source: z.enum(OPERATOR_INBOX_ITEM_SOURCES),
  source_ref: z.string().max(200),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = ActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await applyOperatorInboxAction(access.admin, parsed.data)
    return NextResponse.json({
      ok: result.ok,
      error: result.error ?? null,
      outreach_execution: false,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "operator_inbox_action_failed", message }, { status: 500 })
  }
}
