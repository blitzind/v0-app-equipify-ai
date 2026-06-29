import { NextResponse } from "next/server"
import { requireGrowthPlatformAdminAccess } from "@/lib/growth/access"
import {
  assertGrowthResetAdminConfirmAllowed,
  assertGrowthResetAdminDryRunAllowed,
  buildGrowthResetAdminReadinessPayload,
  parseGrowthResetAdminRunMode,
} from "@/lib/growth/reset/growth-test-data-reset-admin-route-gates"
import { runGrowthTestDataResetFromAdminRuntime } from "@/lib/growth/reset/growth-test-data-reset-admin-runner"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET() {
  const access = await requireGrowthPlatformAdminAccess()
  if (!access.ok) return access.response

  return NextResponse.json(buildGrowthResetAdminReadinessPayload(process.env))
}

export async function POST(request: Request) {
  const access = await requireGrowthPlatformAdminAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => ({}))
  const mode = parseGrowthResetAdminRunMode(body)
  const confirmationPhrase =
    typeof (body as Record<string, unknown>).confirmation_phrase === "string"
      ? (body as Record<string, unknown>).confirmation_phrase
      : typeof (body as Record<string, unknown>).confirm === "string"
        ? (body as Record<string, unknown>).confirm
        : null

  if (mode === "dry_run") {
    const gate = assertGrowthResetAdminDryRunAllowed(process.env)
    if (!gate.ok) {
      return NextResponse.json({ ok: false, blockers: gate.blockers }, { status: 403 })
    }
  } else {
    const gate = assertGrowthResetAdminConfirmAllowed(process.env, confirmationPhrase)
    if (!gate.ok) {
      return NextResponse.json({ ok: false, blockers: gate.blockers }, { status: 403 })
    }
  }

  const run = await runGrowthTestDataResetFromAdminRuntime(access.admin, { mode })

  if (!run.ok) {
    return NextResponse.json(run, { status: 422 })
  }

  return NextResponse.json({
    ok: true,
    mode: run.mode,
    ...run.report,
  })
}
