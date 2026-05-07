import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Workflow Automations Phase 2 — recent run history (drawer feed).
 *
 * Returns the last 25 runs for an automation plus their step logs so
 * the run history drawer can render timestamps, action attempts, and
 * failure messages without spawning a second request per run.
 *
 * Read-only; member-scoped (same RLS shape as the existing list GET).
 * Limited size to keep the payload bounded; future "load more" can
 * page on `started_at` cursor without breaking this contract.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ organizationId: string; automationId: string }> },
) {
  const { organizationId, automationId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(automationId)) {
    return jsonError("Invalid id.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return jsonError("Unauthorized.", 401)

  if (!isPlatformAdminEmail(user.email)) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem) return jsonError("Forbidden.", 403)
  }

  const { data: runs, error: runErr } = await supabase
    .from("workflow_runs")
    .select("id, status, started_at, completed_at, source_type, source_id, error_message")
    .eq("organization_id", organizationId)
    .eq("automation_id", automationId)
    .order("started_at", { ascending: false })
    .limit(25)
  if (runErr) return jsonError(runErr.message, 500)

  const runIds = (runs ?? []).map((r: { id: string }) => r.id)
  const logsByRun = new Map<
    string,
    Array<{ id: string; step: string; message: string; metadata: Record<string, unknown>; created_at: string }>
  >()
  if (runIds.length > 0) {
    const { data: logs } = await supabase
      .from("workflow_run_logs")
      .select("id, workflow_run_id, step, message, metadata, created_at")
      .eq("organization_id", organizationId)
      .in("workflow_run_id", runIds)
      .order("created_at", { ascending: true })
      .limit(500)
    for (const log of (logs ?? []) as Array<{
      id: string
      workflow_run_id: string
      step: string
      message: string
      metadata: Record<string, unknown>
      created_at: string
    }>) {
      const arr = logsByRun.get(log.workflow_run_id) ?? []
      arr.push({
        id: log.id,
        step: log.step,
        message: log.message,
        metadata: log.metadata ?? {},
        created_at: log.created_at,
      })
      logsByRun.set(log.workflow_run_id, arr)
    }
  }

  const enriched = (runs ?? []).map((r: { id: string }) => ({
    ...r,
    logs: logsByRun.get(r.id) ?? [],
  }))

  return NextResponse.json({ runs: enriched })
}
