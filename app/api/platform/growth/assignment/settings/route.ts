import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchGrowthAssignmentSettings,
  updateGrowthAssignmentSettings,
} from "@/lib/growth/assignment/assignment-settings-repository"

export const runtime = "nodejs"

const UpdateSettingsSchema = z.object({
  roundRobinEnabled: z.boolean().optional(),
  industrySpecializationEnabled: z.boolean().optional(),
  territoryMatchingEnabled: z.boolean().optional(),
  capacityBalancingEnabled: z.boolean().optional(),
  priorityRoutingEnabled: z.boolean().optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const settings = await fetchGrowthAssignmentSettings(access.admin)
    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load assignment settings."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = UpdateSettingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid assignment settings payload." }, { status: 400 })
  }

  try {
    const settings = await updateGrowthAssignmentSettings(access.admin, {
      ...parsed.data,
      updatedBy: access.userId,
    })
    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update assignment settings."
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
