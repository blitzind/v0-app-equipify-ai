import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { fetchGrowthBookingPageBySlug, toPublicBookingPageView } from "@/lib/growth/booking/booking-page-repository"

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

  const page = await fetchGrowthBookingPageBySlug(admin, normalized, true)
  if (!page) {
    return NextResponse.json({ error: "not_found", message: "Booking page not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, page: toPublicBookingPageView(page) })
}
