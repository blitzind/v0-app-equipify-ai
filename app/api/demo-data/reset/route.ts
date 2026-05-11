import { NextResponse } from "next/server"
import { gateDemoDataManagement } from "@/lib/demo-data/access"
import { REMOVE_SAMPLE_DATA_CONFIRMATION_PHRASE } from "@/lib/demo-data/remove-sample-confirmation"
import { resetSampleDataForOrganization } from "@/lib/demo-data/reset-sample-data"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Body = {
  organizationId?: string
  confirmation?: string
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
    const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : ""

    if (confirmation !== REMOVE_SAMPLE_DATA_CONFIRMATION_PHRASE) {
      return NextResponse.json(
        {
          message: `Type the phrase "${REMOVE_SAMPLE_DATA_CONFIRMATION_PHRASE}" exactly (all caps) to confirm removal of sample-only records.`,
        },
        { status: 400 },
      )
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const gate = await gateDemoDataManagement(supabase, user, organizationId)
    if (!gate.ok) {
      return NextResponse.json({ message: gate.message }, { status: gate.status })
    }

    let admin: ReturnType<typeof createServiceRoleSupabaseClient>
    try {
      admin = createServiceRoleSupabaseClient()
    } catch {
      return NextResponse.json({ message: "Server is not configured." }, { status: 503 })
    }

    const { summary } = await resetSampleDataForOrganization(admin, gate.organizationId)

    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error."
    console.error("[POST /api/demo-data/reset]", e)
    return NextResponse.json({ message }, { status: 500 })
  }
}
