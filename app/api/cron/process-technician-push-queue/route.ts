import { NextResponse } from "next/server"
import { processQueuedTechnicianPushEvents } from "@/lib/push/send-technician-push.server"
import { createServiceRoleClient } from "@/lib/supabase/admin"

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

async function runPushQueueCron(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  const cronHeader = request.headers.get("x-cron-secret")
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  const token = bearer ?? cronHeader

  if (!secret || token !== secret) {
    return unauthorized()
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    )
  }

  const result = await processQueuedTechnicianPushEvents(admin)
  return NextResponse.json(result)
}

export async function GET(request: Request) {
  return runPushQueueCron(request)
}

export async function POST(request: Request) {
  return runPushQueueCron(request)
}
