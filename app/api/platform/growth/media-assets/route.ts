import { NextResponse } from "next/server"
import {
  GROWTH_MEDIA_ASSET_PROVIDERS,
  GROWTH_MEDIA_ASSET_RELATIONSHIP_TYPES,
  GROWTH_MEDIA_ASSET_STATUSES,
  GROWTH_MEDIA_ASSET_TYPES,
  GROWTH_MEDIA_ASSETS_QA_MARKER,
} from "@/lib/growth/media/media-asset-types"
import {
  createMediaAsset,
  listMediaAssets,
} from "@/lib/growth/media/media-asset-repository"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaAssetError } from "@/lib/growth/media/media-asset-route-utils"
import { listGrowthMediaLibraryAssets } from "@/lib/growth/media-library/growth-media-library-service"
import {
  GROWTH_MEDIA_LIBRARY_KIND_TAGS,
  GROWTH_MEDIA_LIBRARY_QA_MARKER,
} from "@/lib/growth/media-library/growth-media-library-types"
import { z } from "zod"

export const runtime = "nodejs"

const CreateSchema = z.object({
  asset_type: z.enum(GROWTH_MEDIA_ASSET_TYPES),
  provider: z.enum(GROWTH_MEDIA_ASSET_PROVIDERS).optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(4000).optional(),
  original_filename: z.string().max(500).nullable().optional(),
  mime_type: z.string().max(200).nullable().optional(),
  extension: z.string().max(20).nullable().optional(),
  tags: z.array(z.string().min(1).max(80)).max(20).optional(),
  source: z.enum(["manual", "upload", "generated", "import", "other"]).optional(),
  source_reference: z.string().max(500).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function GET(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const statusParam = url.searchParams.get("status")
  const assetTypeParam = url.searchParams.get("asset_type")
  const providerParam = url.searchParams.get("provider")
  const status =
    statusParam && (GROWTH_MEDIA_ASSET_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof GROWTH_MEDIA_ASSET_STATUSES)[number])
      : undefined
  const assetType =
    assetTypeParam && (GROWTH_MEDIA_ASSET_TYPES as readonly string[]).includes(assetTypeParam)
      ? (assetTypeParam as (typeof GROWTH_MEDIA_ASSET_TYPES)[number])
      : undefined
  const provider =
    providerParam && (GROWTH_MEDIA_ASSET_PROVIDERS as readonly string[]).includes(providerParam)
      ? (providerParam as (typeof GROWTH_MEDIA_ASSET_PROVIDERS)[number])
      : undefined
  const library = url.searchParams.get("library") === "1"
  const libraryKindParam = url.searchParams.get("library_kind")
  const libraryKind =
    libraryKindParam && libraryKindParam in GROWTH_MEDIA_LIBRARY_KIND_TAGS
      ? (libraryKindParam as "image" | "logo" | "avatar")
      : undefined

  try {
    if (library) {
      const result = await listGrowthMediaLibraryAssets(access.admin, {
        organizationId: access.organizationId,
        libraryKind,
        includeArchived: url.searchParams.get("include_archived") === "1",
        search: url.searchParams.get("search") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? "50"),
        offset: Number(url.searchParams.get("offset") ?? "0"),
        origin: url.origin,
      })
      return NextResponse.json({
        ok: true,
        items: result.items,
        total: result.total,
        qa_marker: GROWTH_MEDIA_LIBRARY_QA_MARKER,
      })
    }

    const result = await listMediaAssets(access.admin, {
      organizationId: access.organizationId,
      status,
      assetType,
      provider,
      tag: url.searchParams.get("tag") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? "50"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    })
    return NextResponse.json({
      ok: true,
      items: result.items,
      total: result.total,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      no_upload_execution: true,
      no_playback: true,
      qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    })
  } catch (error) {
    return mapMediaAssetError(error)
  }
}

export async function POST(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid media asset payload." }, { status: 400 })
  }

  try {
    const asset = await createMediaAsset(access.admin, {
      organizationId: access.organizationId,
      createdBy: access.userId,
      assetType: parsed.data.asset_type,
      provider: parsed.data.provider,
      title: parsed.data.title,
      description: parsed.data.description,
      originalFilename: parsed.data.original_filename,
      mimeType: parsed.data.mime_type,
      extension: parsed.data.extension,
      tags: parsed.data.tags,
      source: parsed.data.source,
      sourceReference: parsed.data.source_reference,
      metadata: parsed.data.metadata,
    })
    return NextResponse.json({
      ok: true,
      asset,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      no_upload_execution: true,
      qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    })
  } catch (error) {
    return mapMediaAssetError(error)
  }
}
