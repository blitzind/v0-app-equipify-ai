import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_DOGFOOD_SUBSYSTEMS, GROWTH_DOGFOOD_VALIDATION_STATUSES } from "@/lib/growth/dogfood/dogfood-types"
import { listGrowthDogfoodValidationRuns } from "@/lib/growth/dogfood/dogfood-repository"
import { recordGrowthDogfoodValidationRun } from "@/lib/growth/dogfood/mutate-dogfood-validation"
import { GROWTH_DOGFOOD_SCHEMA_SETUP_MESSAGE, isGrowthDogfoodSchemaReady } from "@/lib/growth/dogfood/dogfood-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthDogfoodSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_DOGFOOD_SCHEMA_SETUP_MESSAGE },
      feed: { items: [] },
    })
  }

  const url = new URL(request.url)
  const subsystemParam = url.searchParams.get("subsystem")
  const subsystem =
    subsystemParam && z.enum(GROWTH_DOGFOOD_SUBSYSTEMS).safeParse(subsystemParam).success ? subsystemParam : undefined
  const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(url.searchParams.get("limit"))

  try {
    const items = await listGrowthDogfoodValidationRuns(access.admin, { subsystem, limit })
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, feed: { items } })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load validation runs." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthDogfoodSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "schema_not_ready", message: GROWTH_DOGFOOD_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const body = z
    .object({
      subsystem: z.enum(GROWTH_DOGFOOD_SUBSYSTEMS),
      status: z.enum(GROWTH_DOGFOOD_VALIDATION_STATUSES),
      notes: z.string().max(4000).optional(),
      ownerUserId: z.string().uuid().nullable().optional(),
    })
    .parse(await request.json().catch(() => ({})))

  try {
    const run = await recordGrowthDogfoodValidationRun(access.admin, {
      subsystem: body.subsystem,
      status: body.status,
      notes: body.notes ?? "",
      ownerUserId: body.ownerUserId ?? access.userId,
      actor: { userId: access.userId, email: access.userEmail },
    })
    return NextResponse.json({ ok: true, run })
  } catch {
    return NextResponse.json({ error: "create_failed", message: "Could not record validation run." }, { status: 500 })
  }
}
