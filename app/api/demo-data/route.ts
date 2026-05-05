import { NextResponse } from "next/server"
import { gateDemoDataManagement } from "@/lib/demo-data/access"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { demoIndustrySelectOptions } from "@/lib/demo-seeding/profiles"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/** Until DB types include `demo_seed_industry`, avoid `never` from generated Supabase types. */
type OrgDemoSeedRow = { demo_seed_industry: string | null }

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? ""

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const gate = await gateDemoDataManagement(supabase, user, organizationId)
    if (!gate.ok) {
      return NextResponse.json({ message: gate.message }, { status: gate.status })
    }

    let row: OrgDemoSeedRow | null = null

    if (gate.platformAdmin) {
      try {
        const admin = createServiceRoleSupabaseClient()
        const { data: org } = await admin
          .from("organizations")
          .select("demo_seed_industry")
          .eq("id", gate.organizationId)
          .maybeSingle()
        row = org as unknown as OrgDemoSeedRow | null
      } catch {
        return NextResponse.json({ message: "Server is not configured." }, { status: 503 })
      }
    } else {
      const { data: org } = await supabase
        .from("organizations")
        .select("demo_seed_industry")
        .eq("id", gate.organizationId)
        .maybeSingle()
      row = org as unknown as OrgDemoSeedRow | null
    }

    return NextResponse.json({
      demoSeedIndustry: row?.demo_seed_industry ?? null,
      industryOptions: demoIndustrySelectOptions(),
    })
  } catch (e) {
    console.error("[GET /api/demo-data]", e)
    return NextResponse.json({ message: "Unexpected error." }, { status: 500 })
  }
}
