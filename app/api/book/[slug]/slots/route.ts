import { NextResponse } from "next/server"
import { fetchPublicBookingSlots } from "@/lib/growth/booking/booking-service"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const normalized = String(slug ?? "").trim().toLowerCase()
  if (!normalized) {
    return NextResponse.json({ error: "not_found", message: "Booking page not found." }, { status: 404 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: "unavailable", message: "Booking is temporarily unavailable." }, { status: 503 })
  }

  const result = await fetchPublicBookingSlots(admin, normalized)
  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: result.code === "page_disabled" ? 404 : 503 })
  }

  return NextResponse.json({ ok: true, slots: result.slots, timezone: result.timezone })
}
