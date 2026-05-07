import { NextResponse } from "next/server"
import {
  getActiveImportRun,
  processAsyncImportRunTick,
  resumeFailedImportRun,
  requestCancelAsyncRun,
  startAsyncImportRun,
} from "@/lib/migration-imports/async-runner"
import type { MigrationCommitOptions } from "@/lib/migration-imports/types"
import { requireOrgMigrationAccess } from "@/lib/migration-imports/require-org-migration-access"

export const runtime = "nodejs"
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; jobId: string }> },
) {
  const { organizationId, jobId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(jobId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgMigrationAccess(organizationId)
  if ("error" in gate) return gate.error

  const run = await getActiveImportRun(gate, organizationId, jobId)
  return NextResponse.json({ run })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; jobId: string }> },
) {
  const { organizationId, jobId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(jobId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgMigrationAccess(organizationId)
  if ("error" in gate) return gate.error

  let body: {
    action?: "start" | "tick" | "cancel" | "resume"
    columnMapping?: Record<string, string>
    options?: MigrationCommitOptions
    chunkSize?: number
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  const action = body.action ?? "tick"
  try {
    if (action === "start") {
      const { run, accepted } = await startAsyncImportRun({
        gate,
        organizationId,
        jobId,
        columnMapping: body.columnMapping,
        options: body.options,
        chunkSize: body.chunkSize,
      })
      return NextResponse.json({ ok: true, action, accepted, run })
    }
    if (action === "cancel") {
      const run = await requestCancelAsyncRun(gate, organizationId, jobId)
      return NextResponse.json({ ok: true, action, run })
    }
    if (action === "resume") {
      const run = await resumeFailedImportRun(gate, organizationId, jobId)
      return NextResponse.json({ ok: true, action, run })
    }

    const run = await processAsyncImportRunTick(gate, organizationId, jobId)
    return NextResponse.json({ ok: true, action: "tick", run })
  } catch (e) {
    return NextResponse.json(
      { error: "async_import_failed", message: e instanceof Error ? e.message : "Async import failed." },
      { status: 400 },
    )
  }
}
