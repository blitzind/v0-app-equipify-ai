import { NextResponse } from "next/server"
import { z } from "zod"
import {
  createGrowthAudience,
  listGrowthAudiences,
} from "@/lib/growth/audiences/growth-audience-repository"
import {
  assertAudienceOrgScope,
  requireAudiencePlatformAccess,
} from "@/lib/growth/audiences/growth-audience-platform-access"
import { GROWTH_AUDIENCE_QA_MARKER } from "@/lib/growth/audiences/growth-audience-config"
import { getProspectSearchSavedSearch } from "@/lib/growth/prospect-search/saved-searches"

export const runtime = "nodejs"

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  savedSearchId: z.string().uuid(),
})

export async function GET(request: Request) {
  const access = await requireAudiencePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  try {
    const result = await listGrowthAudiences(access.admin, {
      organizationId: access.organizationId,
      limit: Number(url.searchParams.get("limit") ?? "50"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    })
    return NextResponse.json({
      ok: true,
      items: result.items,
      total: result.total,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "list_failed",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const access = await requireAudiencePlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  const savedSearch = await getProspectSearchSavedSearch(access.admin, parsed.data.savedSearchId)
  if (!savedSearch) {
    return NextResponse.json({ ok: false, error: "saved_search_not_found" }, { status: 404 })
  }

  try {
    const audience = await createGrowthAudience(access.admin, {
      organizationId: access.organizationId,
      name: parsed.data.name,
      description: parsed.data.description,
      savedSearchId: parsed.data.savedSearchId,
      createdBy: access.userId,
    })
    return NextResponse.json({ ok: true, audience, qa_marker: GROWTH_AUDIENCE_QA_MARKER })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "create_failed",
      },
      { status: 500 },
    )
  }
}
