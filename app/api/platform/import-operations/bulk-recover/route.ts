import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { bulkRecoverStaleRuns } from "@/lib/migration-imports/operator-actions"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json(
      { error: "server_config", message: "Server is not configured for platform admin operations." },
      { status: 503 },
    )
  }

  let body: { runIds?: string[] }
  try {
    body = (await request.json()) as { runIds?: string[] }
  } catch {
    body = {}
  }

  const runIds = Array.isArray(body.runIds) ? body.runIds.filter((s) => typeof s === "string") : []
  if (runIds.length === 0) {
    return NextResponse.json({ error: "invalid_request", message: "runIds is required." }, { status: 400 })
  }

  const result = await bulkRecoverStaleRuns(svc, runIds, {
    actorUserId: user.id,
    actorEmail: user.email,
    actorKind: "platform_admin",
  })

  return NextResponse.json({ ok: true, ...result })
}
