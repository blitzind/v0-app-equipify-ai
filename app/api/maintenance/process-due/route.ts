import { NextResponse } from "next/server"
import { processDuePlansForOrganization } from "@/lib/maintenance-plans/process-due-plans"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/** Manual run: processes due plans for the signed-in user’s default organization (JWT attribution). */
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_organization_id")
    .eq("id", user.id)
    .maybeSingle()

  const orgId = (profile as { default_organization_id?: string } | null)?.default_organization_id
  if (!orgId) {
    return NextResponse.json({ error: "No default organization" }, { status: 400 })
  }

  const result = await processDuePlansForOrganization(supabase, orgId, { systemInsert: false })
  return NextResponse.json(result)
}
