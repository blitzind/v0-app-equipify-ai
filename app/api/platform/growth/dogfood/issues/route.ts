import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_DOGFOOD_ISSUE_SEVERITIES,
  GROWTH_DOGFOOD_ISSUE_STATUSES,
  GROWTH_DOGFOOD_SUBSYSTEMS,
  GROWTH_DOGFOOD_VALIDATION_STATUSES,
} from "@/lib/growth/dogfood/dogfood-types"
import { listGrowthDogfoodIssues } from "@/lib/growth/dogfood/dogfood-repository"
import { createGrowthDogfoodIssue } from "@/lib/growth/dogfood/mutate-dogfood-validation"
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
  const statusParam = url.searchParams.get("status")
  const blockersOnly = url.searchParams.get("blockers") === "true"
  const severityParam = url.searchParams.get("severity")
  const severity =
    severityParam && z.enum(GROWTH_DOGFOOD_ISSUE_SEVERITIES).safeParse(severityParam).success ? severityParam : undefined
  const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(url.searchParams.get("limit"))

  try {
    const items = await listGrowthDogfoodIssues(access.admin, {
      subsystem,
      severity,
      status: blockersOnly
        ? ["open", "in_progress"]
        : statusParam && z.enum(GROWTH_DOGFOOD_ISSUE_STATUSES).safeParse(statusParam).success
          ? statusParam
          : undefined,
      limit,
    })
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, feed: { items } })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load dogfood issues." }, { status: 500 })
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
      title: z.string().min(1).max(200),
      severity: z.enum(GROWTH_DOGFOOD_ISSUE_SEVERITIES),
      subsystem: z.enum(GROWTH_DOGFOOD_SUBSYSTEMS),
      ownerUserId: z.string().uuid().nullable().optional(),
      reproductionNotes: z.string().max(4000).optional(),
    })
    .parse(await request.json().catch(() => ({})))

  try {
    const issue = await createGrowthDogfoodIssue(access.admin, {
      title: body.title,
      severity: body.severity,
      subsystem: body.subsystem,
      ownerUserId: body.ownerUserId ?? access.userId,
      reproductionNotes: body.reproductionNotes ?? "",
      actor: { userId: access.userId, email: access.userEmail },
    })
    return NextResponse.json({ ok: true, issue })
  } catch {
    return NextResponse.json({ error: "create_failed", message: "Could not create dogfood issue." }, { status: 500 })
  }
}
