import { NextResponse } from "next/server"
import {
  GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER,
  GROWTH_SENDR_WORKSPACE_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import { listSendrAssetPickerItems } from "@/lib/growth/sendr/growth-sendr-asset-picker-service"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const kind = url.searchParams.get("kind") as
    | "media"
    | "video"
    | "booking"
    | "landing_page"
    | "all"
    | null
  const search = url.searchParams.get("search") ?? undefined
  const limit = Number(url.searchParams.get("limit") ?? 50)

  try {
    const items = await listSendrAssetPickerItems(access.admin, {
      organizationId: access.organizationId,
      kind: kind ?? "all",
      search,
      limit,
    })
    const videoItems = items.filter((item) => item.assetKind === "video")
    const growthLibraryVideoCount = videoItems.filter(
      (item) => item.metadata.source === "growth_library",
    ).length
    const legacyMetadataVideoCount = videoItems.filter(
      (item) => item.metadata.source === "sendr_metadata",
    ).length
    return NextResponse.json({
      ok: true,
      items,
      videoLibrary: {
        growthAssetCount: growthLibraryVideoCount,
        legacyMetadataCount: legacyMetadataVideoCount,
        isEmpty: growthLibraryVideoCount === 0,
      },
      qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "asset_list_failed" },
      { status: 500 },
    )
  }
}
