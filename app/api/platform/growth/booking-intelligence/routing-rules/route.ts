import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listCalendarRoutingRules, upsertCalendarRoutingRule } from "@/lib/growth/booking-intelligence/booking-events"
import { isGrowthCalendarBookingIntelligenceSchemaReady } from "@/lib/growth/booking-intelligence/schema-health"
import { GROWTH_CALENDAR_ROUTING_RULE_TYPES } from "@/lib/growth/booking-intelligence/booking-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  id: z.string().uuid().optional(),
  ruleType: z.enum(GROWTH_CALENDAR_ROUTING_RULE_TYPES),
  label: z.string().min(1).max(120),
  priority: z.number().int().min(1).max(9999).optional(),
  isActive: z.boolean().optional(),
  matchCriteria: z.record(z.unknown()).optional(),
  targetOwnerLabel: z.string().max(120).nullable().optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCalendarBookingIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const rules = await listCalendarRoutingRules(access.admin)
    return NextResponse.json({ ok: true, rules })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load routing rules." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCalendarBookingIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid routing rule payload." }, { status: 400 })
  }

  try {
    const rule = await upsertCalendarRoutingRule(access.admin, parsed.data)
    return NextResponse.json({ ok: true, rule })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save routing rule."
    return NextResponse.json({ error: "save_failed", message }, { status: 500 })
  }
}
