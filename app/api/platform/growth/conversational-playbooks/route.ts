import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadConversationalPlaybookForRequest } from "@/lib/growth/conversational-playbooks/conversational-playbook-service"
import {
  CONVERSATIONAL_PLAYBOOK_CONSUMERS,
  CONVERSATIONAL_PLAYBOOK_TYPES,
} from "@/lib/growth/conversational-playbooks/conversational-playbook-types"

export const runtime = "nodejs"
export const maxDuration = 120

const QuerySchema = z.object({
  consumer: z.enum(CONVERSATIONAL_PLAYBOOK_CONSUMERS),
  lead_id: z.string().max(120).optional(),
  company_id: z.string().max(120).optional(),
  industry: z.string().max(120).optional(),
  query: z.string().max(500).optional(),
  playbook_type: z.enum(CONVERSATIONAL_PLAYBOOK_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  include_private: z.coerce.boolean().optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const result = await loadConversationalPlaybookForRequest(access.admin, parsed.data)
    if (!result.ok || !result.playbook) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "playbook_failed" },
        { status: 422 },
      )
    }

    return NextResponse.json({
      ok: true,
      playbook: result.playbook,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_enabled: false,
      enrollment_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "conversational_playbook_failed", message }, { status: 500 })
  }
}
