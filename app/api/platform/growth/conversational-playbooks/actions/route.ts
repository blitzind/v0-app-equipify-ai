import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  markConversationalPlaybookReviewed,
  recordConversationalPlaybookViewed,
} from "@/lib/growth/conversational-playbooks/conversational-playbook-service"
import {
  type ConversationalPlaybook,
} from "@/lib/growth/conversational-playbooks/conversational-playbook-types"

export const runtime = "nodejs"
export const maxDuration = 120

const ActionSchema = z.object({
  action: z.enum(["mark_reviewed", "view_playbook"]),
  playbook: z.custom<ConversationalPlaybook>(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = ActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    if (parsed.data.action === "mark_reviewed") {
      const result = await markConversationalPlaybookReviewed(access.admin, {
        playbook: parsed.data.playbook,
        operator_id: access.userId,
      })
      return NextResponse.json({
        ok: result.ok,
        error: result.error ?? null,
        message_send: false,
        auto_reply: false,
        requires_human_review: true,
        autonomous_execution_enabled: false,
      })
    }

    if (parsed.data.action === "view_playbook") {
      await recordConversationalPlaybookViewed(access.admin, {
        playbook: parsed.data.playbook,
        operator_id: access.userId,
      })
    }

    return NextResponse.json({
      ok: true,
      message_send: false,
      auto_reply: false,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "conversational_playbook_action_failed", message }, { status: 500 })
  }
}
