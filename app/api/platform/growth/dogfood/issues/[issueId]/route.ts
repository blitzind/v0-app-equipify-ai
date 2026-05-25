import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_DOGFOOD_ISSUE_STATUSES } from "@/lib/growth/dogfood/dogfood-types"
import { updateGrowthDogfoodIssueStatus } from "@/lib/growth/dogfood/mutate-dogfood-validation"
import { GROWTH_DOGFOOD_SCHEMA_SETUP_MESSAGE, isGrowthDogfoodSchemaReady } from "@/lib/growth/dogfood/dogfood-schema-health"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ issueId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { issueId } = await context.params
  if (!(await isGrowthDogfoodSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "schema_not_ready", message: GROWTH_DOGFOOD_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const body = z
    .object({
      status: z.enum(GROWTH_DOGFOOD_ISSUE_STATUSES),
      fixedVersion: z.string().nullable().optional(),
    })
    .parse(await request.json().catch(() => ({})))

  try {
    const issue = await updateGrowthDogfoodIssueStatus(access.admin, {
      issueId,
      status: body.status,
      fixedVersion: body.fixedVersion,
      actor: { userId: access.userId, email: access.userEmail },
    })
    return NextResponse.json({ ok: true, issue })
  } catch {
    return NextResponse.json({ error: "update_failed", message: "Could not update dogfood issue." }, { status: 500 })
  }
}
