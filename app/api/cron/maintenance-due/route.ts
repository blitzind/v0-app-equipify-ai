import { NextResponse } from "next/server"
import { processDuePlansAllOrganizations } from "@/lib/maintenance-plans/process-due-plans"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  const cronHeader = request.headers.get("x-cron-secret")
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  const token = bearer ?? cronHeader

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }

  const result = await processDuePlansAllOrganizations(admin)
  return NextResponse.json(result)
}
