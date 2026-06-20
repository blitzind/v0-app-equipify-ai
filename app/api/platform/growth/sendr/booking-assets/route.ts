import { NextResponse } from "next/server"
import { z } from "zod"
import { GROWTH_SENDR_WORKSPACE_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import {
  getGrowthSendrBookingAsset,
  registerGrowthSendrBookingAsset,
} from "@/lib/growth/sendr/growth-sendr-booking-runtime-repository"
import {
  getGrowthSendrLandingPage,
  updateGrowthSendrLandingPage,
} from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

const BodySchema = z.object({
  action: z.enum(["register", "attach"]).optional(),
  bookingAssetId: z.string().uuid().optional(),
  landingPageId: z.string().uuid().optional(),
  mediaAssetId: z.string().uuid().optional(),
  meetingLink: z.string().max(2000).optional().nullable(),
  meetingType: z.string().max(120).optional().nullable(),
  durationMinutes: z.number().int().min(1).max(480).optional().nullable(),
  timezone: z.string().max(80).optional().nullable(),
  calendarProvider: z.enum(["google", "outlook", "manual"]).optional().nullable(),
  legacyBookingPageId: z.string().uuid().optional(),
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
      const bookingAsset = await registerGrowthSendrBookingAsset(access.admin, {
        organizationId: access.organizationId,
        ownerUserId: access.userId,
        mediaAssetId: parsed.data.mediaAssetId,
        meetingLink: parsed.data.meetingLink,
        meetingType: parsed.data.meetingType,
        durationMinutes: parsed.data.durationMinutes,
        timezone: parsed.data.timezone,
        calendarProvider: parsed.data.calendarProvider,
        legacyBookingPageId: parsed.data.legacyBookingPageId,
      })
      return NextResponse.json({ ok: true, bookingAsset, qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER })
    }

    if (action === "attach") {
      if (!parsed.data.landingPageId || !parsed.data.bookingAssetId) {
        return NextResponse.json({ ok: false, error: "attach_fields_required" }, { status: 400 })
      }
      const existing = await getGrowthSendrBookingAsset(access.admin, parsed.data.bookingAssetId)
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
          bookingAssetId: parsed.data.bookingAssetId,
          meetingLink: existing.meetingLink,
        },
        variableMap: existing.meetingLink
          ? { ...currentPage.variableMap, meeting_link: existing.meetingLink }
          : currentPage.variableMap,
      })
      return NextResponse.json({
        ok: true,
        page,
        bookingAsset: existing,
        qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER,
      })
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "booking_asset_failed" },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const bookingAssetId = new URL(request.url).searchParams.get("bookingAssetId")
  if (!bookingAssetId) {
    return NextResponse.json({ ok: false, error: "booking_asset_id_required" }, { status: 400 })
  }

  const bookingAsset = await getGrowthSendrBookingAsset(access.admin, bookingAssetId)
  if (!bookingAsset || bookingAsset.organizationId !== access.organizationId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, bookingAsset, qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER })
}
