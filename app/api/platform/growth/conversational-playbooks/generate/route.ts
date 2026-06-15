import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { generateConversationalPlaybookForRequest } from "@/lib/growth/conversational-playbooks/conversational-playbook-service"
import {
  CONVERSATIONAL_PLAYBOOK_CONSUMERS,
  CONVERSATIONAL_PLAYBOOK_TYPES,
} from "@/lib/growth/conversational-playbooks/conversational-playbook-types"

export const runtime = "nodejs"
export const maxDuration = 120

const GenerateSchema = z.object({
  consumer: z.enum(CONVERSATIONAL_PLAYBOOK_CONSUMERS),
  lead_id: z.string().max(120).optional(),
  company_id: z.string().max(120).optional(),
  industry: z.string().max(120).optional(),
  query: z.string().max(500).optional(),
  playbook_type: z.enum(CONVERSATIONAL_PLAYBOOK_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  include_private: z.boolean().optional(),
  persist_audit: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = GenerateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await generateConversationalPlaybookForRequest(access.admin, parsed.data, {
      persist_audit: parsed.data.persist_audit ?? true,
      operator_id: access.userId,
    })

    if (!result.ok || !result.playbook) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "generate_failed" },
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
    return NextResponse.json({ ok: false, error: "generate_failed", message }, { status: 500 })
  }
}
