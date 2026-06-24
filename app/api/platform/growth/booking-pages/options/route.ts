import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_SIGNATURE_BOOKING_OPTIONS_QA_MARKER,
  type GrowthSignatureBookingOptionsResponse,
} from "@/lib/growth/booking/booking-page-signature-options-types"
import { listGrowthSignatureBookingOptions } from "@/lib/growth/booking/booking-page-signature-options-service"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const origin = new URL(request.url).origin
  const options = await listGrowthSignatureBookingOptions(access.admin, {
    ownerUserId: access.userId,
    origin,
  })

  const payload: GrowthSignatureBookingOptionsResponse = {
    ok: true,
    options,
    qa_marker: GROWTH_SIGNATURE_BOOKING_OPTIONS_QA_MARKER,
  }

  return NextResponse.json(payload)
}
