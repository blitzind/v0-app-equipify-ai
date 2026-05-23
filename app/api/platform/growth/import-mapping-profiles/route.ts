import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createGrowthImportMappingProfile,
  listGrowthImportMappingProfiles,
} from "@/lib/growth/import/mapping-profile-repository"
import { GROWTH_IMPORT_DUPLICATE_STRATEGIES } from "@/lib/growth/import/types"

export const runtime = "nodejs"

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sourceVendor: z.string().trim().min(1).max(100),
  columnMapping: z.record(z.string(), z.string()),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const sourceVendor = url.searchParams.get("sourceVendor")

  try {
    const profiles = await listGrowthImportMappingProfiles(access.admin, sourceVendor ?? undefined)
    return NextResponse.json({ ok: true, profiles })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid mapping profile." }, { status: 400 })
  }

  try {
    const profile = await createGrowthImportMappingProfile(access.admin, {
      ...parsed.data,
      createdBy: access.userId,
    })
    return NextResponse.json({ ok: true, profile }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
