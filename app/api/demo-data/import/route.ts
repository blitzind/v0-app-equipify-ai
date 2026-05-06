import { NextResponse } from "next/server"
import { gateDemoDataManagement } from "@/lib/demo-data/access"
import { seedDemoForIndustry } from "@/lib/demo-seeding/seed-engine"
import { normalizeIndustryKey } from "@/lib/demo-seeding/profiles"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Body = {
  organizationId?: string
  industry?: string
}

export async function POST(request: Request) {
  try {
    let body: Body
    try {
      body = (await request.json()) as Body
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 })
    }

    const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
    const industry = typeof body.industry === "string" ? body.industry.trim() : ""

    if (!organizationId || !industry) {
      return NextResponse.json({ message: "organizationId and industry are required." }, { status: 400 })
    }

    const industryKey = normalizeIndustryKey(industry)

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const gate = await gateDemoDataManagement(supabase, user, organizationId)
    if (!gate.ok) {
      return NextResponse.json({ message: gate.message }, { status: gate.status })
    }

    let db
    try {
      db = createServiceRoleSupabaseClient()
    } catch {
      return NextResponse.json(
        { message: "Server is not configured (missing service role key)." },
        { status: 503 },
      )
    }

    const result = await seedDemoForIndustry({
      supabase: db,
      organizationId: gate.organizationId,
      ownerUserId: gate.userId,
      industry: industryKey,
      import: true,
    })

    if (process.env.NODE_ENV === "development") {
      console.info("[demo-data/import]", {
        organizationId: gate.organizationId,
        industry: industryKey,
        seedDemo: true,
        counts: result.counts,
        techniciansSeeded: result.techniciansSeeded,
      })
    }

    return NextResponse.json({
      ok: true,
      industry: result.industry,
      counts: result.counts ?? null,
      techniciansSeeded: result.techniciansSeeded ?? false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error."
    console.error("[POST /api/demo-data/import]", e)
    return NextResponse.json({ message }, { status: 400 })
  }
}
