import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { applyApolloPilotCohortAction } from "@/lib/growth/apollo/apollo-pilot-route"

export const runtime = "nodejs"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = asString(body?.action)

  if (!action) {
    return NextResponse.json({ ok: false, message: "action is required." }, { status: 400 })
  }

  try {
    const cohort = await applyApolloPilotCohortAction(access.admin, {
      cohort_id: id,
      action,
    })
    return NextResponse.json({ ok: true, cohort })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
