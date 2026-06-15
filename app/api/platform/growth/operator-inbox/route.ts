import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchOperatorInboxQueue } from "@/lib/growth/operator-inbox/operator-inbox-service"
import { OPERATOR_INBOX_FILTERS } from "@/lib/growth/operator-inbox/operator-inbox-types"

export const runtime = "nodejs"
export const maxDuration = 120

const QuerySchema = z.object({
  lead_id: z.string().max(120).optional(),
  filter: z.enum(OPERATOR_INBOX_FILTERS).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
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
    const queue = await fetchOperatorInboxQueue(access.admin, parsed.data)
    return NextResponse.json({
      ok: true,
      ...queue,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "operator_inbox_failed", message }, { status: 500 })
  }
}
