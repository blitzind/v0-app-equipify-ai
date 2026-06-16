import { NextResponse } from "next/server"
import { z } from "zod"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaBookingHandoffError } from "@/lib/growth/media/media-booking-handoff-route-utils"
import {
  createBookingHandoff,
  toGrowthMediaBookingHandoffResponse,
} from "@/lib/growth/media/media-booking-handoff-service"
import {
  GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER,
  GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS,
} from "@/lib/growth/media/media-booking-handoff-types"

export const runtime = "nodejs"

const CreateBookingHandoffSchema = z.object({
  qualification_goal: z.string().max(120).nullable().optional(),
  prospect_name: z.string().max(500).nullable().optional(),
  company_name: z.string().max(500).nullable().optional(),
  sender_name: z.string().max(500).nullable().optional(),
  sender_company: z.string().max(500).nullable().optional(),
  ai_qa_enabled: z.boolean().optional(),
  conversation_enabled: z.boolean().optional(),
  booking_handoff_enabled: z.boolean().optional(),
  agenda_template: z.string().max(4000).nullable().optional(),
})

export async function POST(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateBookingHandoffSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const record = createBookingHandoff({
      organizationId: access.organizationId,
      qualificationGoal: parsed.data.qualification_goal ?? null,
      prospectName: parsed.data.prospect_name ?? null,
      companyName: parsed.data.company_name ?? null,
      senderName: parsed.data.sender_name ?? null,
      senderCompany: parsed.data.sender_company ?? null,
      aiQaEnabled: parsed.data.ai_qa_enabled,
      conversationEnabled: parsed.data.conversation_enabled,
      bookingHandoffEnabled: parsed.data.booking_handoff_enabled,
      agendaTemplate: parsed.data.agenda_template ?? null,
    })

    return NextResponse.json({
      ...toGrowthMediaBookingHandoffResponse(record),
      qa_marker: GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER,
      ...GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaBookingHandoffError(error)
  }
}
