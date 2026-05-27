import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listPersonalizationGenerations } from "@/lib/growth/personalization/dashboard"
import { isGrowthAiPersonalizationSchemaReady } from "@/lib/growth/personalization/schema-health"
import {
  GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
  GROWTH_PERSONALIZATION_GENERATION_STATUSES,
} from "@/lib/growth/personalization/personalization-types"

export const runtime = "nodejs"

const QuerySchema = z.object({
  leadId: z.string().uuid().optional(),
  status: z.enum(GROWTH_PERSONALIZATION_GENERATION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiPersonalizationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    leadId: url.searchParams.get("leadId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query", message: parsed.error.message }, { status: 400 })
  }

  try {
    const generations = await listPersonalizationGenerations(access.admin, parsed.data)
    return NextResponse.json({ ok: true, generations, privacy_note: GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
