import { NextResponse } from "next/server"
import { z } from "zod"
import { GROWTH_SENDR_WORKSPACE_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import { consumeSendrBudget } from "@/lib/growth/sendr/growth-sendr-guardrails"
import { updateGrowthSendrLandingPage, getGrowthSendrLandingPage } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"
import {
  getGrowthSendrVideoAsset,
  registerGrowthSendrVideoAssetMetadata,
  updateGrowthSendrVideoAssetMetadata,
} from "@/lib/growth/sendr/growth-sendr-video-runtime-repository"

export const runtime = "nodejs"

const BodySchema = z.object({
  action: z.enum(["register", "update_metadata", "attach", "attach_existing"]).optional(),
  videoAssetId: z.string().uuid().optional(),
  landingPageId: z.string().uuid().optional(),
  mediaAssetId: z.string().uuid().optional(),
  sourceUrl: z.string().max(2000).optional().nullable(),
  posterUrl: z.string().max(2000).optional().nullable(),
  durationSeconds: z.number().int().min(0).optional().nullable(),
  width: z.number().int().min(0).optional().nullable(),
  height: z.number().int().min(0).optional().nullable(),
  sizeBytes: z.number().int().min(0).optional().nullable(),
  legacyVideoAssetId: z.string().uuid().optional(),
  transcriptStatus: z.enum(["none", "pending", "ready", "failed"]).optional(),
  captionsStatus: z.enum(["none", "pending", "ready", "failed"]).optional(),
})

export async function POST(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  const action = parsed.data.action ?? "register"

  try {
    if (action === "register") {
      const budget = await consumeSendrBudget(access.admin, {
        organizationId: access.organizationId,
        resourceType: "media_assets",
      })
      if (!budget.allowed) {
        return NextResponse.json({ ok: false, message: budget.reason }, { status: 429 })
      }
      const videoAsset = await registerGrowthSendrVideoAssetMetadata(access.admin, {
        organizationId: access.organizationId,
        ownerUserId: access.userId,
        ...parsed.data,
      })
      return NextResponse.json({ ok: true, videoAsset, qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER })
    }

    if (action === "update_metadata") {
      if (!parsed.data.videoAssetId) {
        return NextResponse.json({ ok: false, error: "video_asset_id_required" }, { status: 400 })
      }
      const videoAsset = await updateGrowthSendrVideoAssetMetadata(access.admin, {
        videoAssetId: parsed.data.videoAssetId,
        organizationId: access.organizationId,
        sourceUrl: parsed.data.sourceUrl,
        posterUrl: parsed.data.posterUrl,
        mediaAssetId: parsed.data.mediaAssetId,
        transcriptStatus: parsed.data.transcriptStatus,
        captionsStatus: parsed.data.captionsStatus,
      })
      return NextResponse.json({ ok: true, videoAsset, qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER })
    }

    if (action === "attach" || action === "attach_existing") {
      if (!parsed.data.landingPageId || !parsed.data.videoAssetId) {
        return NextResponse.json({ ok: false, error: "attach_fields_required" }, { status: 400 })
      }
      const existing = await getGrowthSendrVideoAsset(access.admin, parsed.data.videoAssetId)
      if (!existing || existing.organizationId !== access.organizationId) {
        return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
      }
      const currentPage = await getGrowthSendrLandingPage(access.admin, parsed.data.landingPageId)
      if (!currentPage || currentPage.organizationId !== access.organizationId) {
        return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
      }
      const page = await updateGrowthSendrLandingPage(access.admin, {
        landingPageId: parsed.data.landingPageId,
        organizationId: access.organizationId,
        mobileMetadata: {
          ...currentPage.mobileMetadata,
          videoAssetId: parsed.data.videoAssetId,
        },
      })
      return NextResponse.json({ ok: true, page, videoAsset: existing, qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER })
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "video_asset_failed" },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const videoAssetId = new URL(request.url).searchParams.get("videoAssetId")
  if (!videoAssetId) {
    return NextResponse.json({ ok: false, error: "video_asset_id_required" }, { status: 400 })
  }

  const videoAsset = await getGrowthSendrVideoAsset(access.admin, videoAssetId)
  if (!videoAsset || videoAsset.organizationId !== access.organizationId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, videoAsset, qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER })
}
