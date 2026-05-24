import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchGrowthAssignmentEngineStatus,
  runGrowthLeadAssignmentEngine,
} from "@/lib/growth/assignment/run-assignment-engine"

export const runtime = "nodejs"

const BodySchema = z.object({
  dryRun: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const status = await fetchGrowthAssignmentEngineStatus(access.admin)
    return NextResponse.json({ ok: true, status })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load assignment engine status."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid assignment run payload." }, { status: 400 })
  }

  try {
    const result = await runGrowthLeadAssignmentEngine(access.admin, {
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
      dryRun: parsed.data.dryRun,
      limit: parsed.data.limit,
    })
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Assignment run failed."
    return NextResponse.json({ error: "run_failed", message }, { status: 500 })
  }
}
