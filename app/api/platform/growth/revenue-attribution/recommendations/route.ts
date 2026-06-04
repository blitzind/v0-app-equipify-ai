import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthAttributionTouchLedgerSchemaReady } from "@/lib/growth/revenue-attribution/attribution-touch-schema-health"
import { fetchGrowthRevenueAttributionRecommendations } from "@/lib/growth/revenue-attribution/fetch-growth-revenue-attribution-recommendations"
import { GROWTH_ATTRIBUTION_MODELS } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types"

export const runtime = "nodejs"

const QuerySchema = z.object({
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  channel: z.string().optional(),
  rep_user_id: z.string().uuid().optional(),
  sequence_id: z.string().uuid().optional(),
  attribution_model: z.enum(GROWTH_ATTRIBUTION_MODELS).optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAttributionTouchLedgerSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "growth_schema_incomplete", message: "Apply attribution touch ledger migration." },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    date_from: url.searchParams.get("date_from") ?? undefined,
    date_to: url.searchParams.get("date_to") ?? undefined,
    channel: url.searchParams.get("channel") ?? undefined,
    rep_user_id: url.searchParams.get("rep_user_id") ?? undefined,
    sequence_id: url.searchParams.get("sequence_id") ?? undefined,
    attribution_model: url.searchParams.get("attribution_model") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query", message: "Invalid recommendation filters." }, { status: 400 })
  }

  try {
    const recommendations = await fetchGrowthRevenueAttributionRecommendations(access.admin, {
      dateFrom: parsed.data.date_from,
      dateTo: parsed.data.date_to,
      channel: parsed.data.channel ?? null,
      repUserId: parsed.data.rep_user_id ?? null,
      sequenceId: parsed.data.sequence_id ?? null,
      attributionModel: parsed.data.attribution_model,
    })
    return NextResponse.json({ ok: true, recommendations })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
