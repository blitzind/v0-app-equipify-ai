import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import {
  listOperatorEventsForRun,
  recordOperatorEvent,
  type ImportOperatorEventSeverity,
} from "@/lib/migration-imports/operator-events"

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED_SEVERITY: ImportOperatorEventSeverity[] = ["info", "warning", "critical"]

async function requireGate(runId: string) {
  if (!UUID_RE.test(runId)) {
    return { error: NextResponse.json({ error: "invalid_request", message: "Invalid run id." }, { status: 400 }) } as const
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return {
      error: NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 }),
    } as const
  }

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return {
      error: NextResponse.json(
        { error: "server_config", message: "Server is not configured for platform admin operations." },
        { status: 503 },
      ),
    } as const
  }

  const { data: run } = await svc
    .from("organization_import_job_runs")
    .select("id, organization_id, import_job_id")
    .eq("id", runId)
    .maybeSingle()
  if (!run) {
    return { error: NextResponse.json({ error: "not_found", message: "Import run not found." }, { status: 404 }) } as const
  }

  return {
    user,
    svc,
    run: {
      runId: String((run as { id: string }).id),
      organizationId: String((run as { organization_id: string }).organization_id),
      importJobId: String((run as { import_job_id: string }).import_job_id),
    },
  } as const
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params
  const gate = await requireGate(runId)
  if ("error" in gate) return gate.error

  const events = await listOperatorEventsForRun(gate.run.runId, 50)
  return NextResponse.json({ ok: true, events })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params
  const gate = await requireGate(runId)
  if ("error" in gate) return gate.error

  let body: { message?: string; severity?: string; metadata?: Record<string, unknown> }
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  const message = (body.message ?? "").toString().trim()
  if (!message) {
    return NextResponse.json({ error: "invalid_request", message: "Note message is required." }, { status: 400 })
  }

  const severity: ImportOperatorEventSeverity = ALLOWED_SEVERITY.includes(
    (body.severity ?? "info") as ImportOperatorEventSeverity,
  )
    ? ((body.severity ?? "info") as ImportOperatorEventSeverity)
    : "info"

  const event = await recordOperatorEvent({
    importJobId: gate.run.importJobId,
    importRunId: gate.run.runId,
    organizationId: gate.run.organizationId,
    actorUserId: gate.user.id,
    actorEmail: gate.user.email ?? null,
    actorKind: "platform_admin",
    eventType: "note",
    severity,
    message,
    metadata: body.metadata ?? {},
  })

  if (!event) {
    return NextResponse.json({ error: "write_failed", message: "Could not record operator note." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, event })
}
