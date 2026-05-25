import { NextResponse } from "next/server"
import { z } from "zod"
import { publicBookingErrorMessage } from "@/lib/growth/booking/booking-public-errors"
import { submitPublicBooking } from "@/lib/growth/booking/booking-service"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  company: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  slotStartAt: z.string().datetime(),
  slotEndAt: z.string().datetime(),
})

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const normalized = String(slug ?? "").trim().toLowerCase()
  if (!normalized) {
    return NextResponse.json({ error: "not_found", message: publicBookingErrorMessage("page_disabled") }, { status: 404 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_form", message: publicBookingErrorMessage("invalid_form") },
      { status: 400 },
    )
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { error: "unavailable", message: publicBookingErrorMessage("calendar_unavailable") },
      { status: 503 },
    )
  }

  const origin = new URL(request.url).origin
  const result = await submitPublicBooking(admin, {
    slug: normalized,
    ...parsed.data,
    appOrigin: origin,
  })

  if (!result.ok) {
    const status =
      result.code === "page_disabled"
        ? 404
        : result.code === "slot_unavailable" || result.code === "invalid_form"
          ? 409
          : 503
    return NextResponse.json({ error: result.code, message: result.message }, { status })
  }

  return NextResponse.json({ ok: true, ...result })
}
