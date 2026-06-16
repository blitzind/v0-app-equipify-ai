import { NextResponse } from "next/server"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaBookingHandoffError } from "@/lib/growth/media/media-booking-handoff-route-utils"
import {
  getBookingHandoff,
  toGrowthMediaBookingHandoffResponse,
} from "@/lib/growth/media/media-booking-handoff-service"
import {
  GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER,
  GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS,
} from "@/lib/growth/media/media-booking-handoff-types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  try {
    const { id } = await context.params
    const record = getBookingHandoff(id, access.organizationId)
    return NextResponse.json({
      ...toGrowthMediaBookingHandoffResponse(record),
      qa_marker: GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER,
      ...GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaBookingHandoffError(error)
  }
}
