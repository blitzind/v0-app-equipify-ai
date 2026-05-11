/**
 * AI Ops Phase 3 — daily digest cron worker.
 *
 * Wiring (Vercel cron entry in `vercel.json`):
 *   { "path": "/api/cron/ai-ops-digest", "schedule": "0 * * * *" }
 *
 * Runs hourly. For each organization with `ai_ops_digest_settings.enabled`,
 * checks whether the organization's local hour matches `send_hour`. If
 * yes (and not a weekend when `skip_weekends` is true), the runner is
 * invoked. Each run writes a row to `ai_ops_digest_runs`; failures are
 * captured per-org and never abort the worker.
 *
 * Safety:
 *   - Internal-only delivery (digest recipients are staff emails).
 *   - No customer-facing sends.
 *   - Authenticated by `CRON_SECRET` shared secret.
 *   - Skips orgs with no recipients configured.
 *   - Phase 60.5: skips orgs without Growth+ `ai` plan entitlement (trial Scale counts).
 */

import { NextResponse } from "next/server"
import { logAiGovernanceSkip } from "@/lib/ai/governance-log"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runDigestForOrganization } from "@/lib/ai-ops/digest-runner"
import { normalizeSettingsRow } from "@/lib/ai-ops/digest"

export const runtime = "nodejs"
/** Avoid Next.js fetch caching — cron must always run live queries. */
export const dynamic = "force-dynamic"

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}

async function runAiOpsDigestCron(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  const cronHeader = request.headers.get("x-cron-secret")
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  const token = bearer ?? cronHeader
  if (!secret || token !== secret) return unauthorized()

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    )
  }

  const now = new Date()
  const dayOfWeekUtc = now.getUTCDay() // 0 = Sun, 6 = Sat (UTC reference; per-org weekend check uses local day below)

  const { data: settingsRows, error: settingsError } = await admin
    .from("ai_ops_digest_settings")
    .select("*")
    .eq("enabled", true)
  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 })
  }

  const candidates = (settingsRows ?? []).map((r) => normalizeSettingsRow(r as Record<string, unknown>))
  const orgIds = candidates.map((c) => c.organization_id)
  if (orgIds.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      ranAt: now.toISOString(),
      utcDayOfWeek: dayOfWeekUtc,
    })
  }

  // Resolve live timezones for each candidate org so editing the
  // organization timezone takes effect without the user re-saving
  // digest settings.
  const { data: orgRows, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, timezone")
    .in("id", orgIds)
  if (orgErr) {
    return NextResponse.json({ error: orgErr.message }, { status: 500 })
  }
  const orgById = new Map<string, { id: string; name: string; timezone: string | null }>()
  for (const o of (orgRows ?? []) as Array<{ id: string; name: string; timezone: string | null }>) {
    orgById.set(o.id, o)
  }

  const summary = {
    processed: 0,
    sent: 0,
    skipped: 0,
    skipped_no_ai_entitlement: 0,
    failed: 0,
    no_items: 0,
    no_recipients: 0,
  }
  const perOrg: Array<{
    organizationId: string
    status: string
    runId: string | null
    error?: string
    itemsCount?: number
  }> = []

  for (const settings of candidates) {
    summary.processed += 1
    const org = orgById.get(settings.organization_id)
    if (!org) {
      perOrg.push({ organizationId: settings.organization_id, status: "skipped", runId: null, error: "org_missing" })
      summary.skipped += 1
      continue
    }
    const tz = org.timezone ?? settings.timezone_snapshot ?? "UTC"

    const local = describeLocal(now, tz)
    if (local.hour !== settings.send_hour) {
      summary.skipped += 1
      perOrg.push({ organizationId: org.id, status: "skipped", runId: null, error: "wrong_hour" })
      continue
    }
    if (settings.skip_weekends && (local.dayOfWeek === 0 || local.dayOfWeek === 6)) {
      summary.skipped += 1
      perOrg.push({ organizationId: org.id, status: "skipped", runId: null, error: "weekend" })
      continue
    }

    // Cool-down: don't double-send within the same hour.
    if (settings.last_sent_at) {
      const last = Date.parse(settings.last_sent_at)
      if (Number.isFinite(last) && now.getTime() - last < 60 * 60 * 1000) {
        summary.skipped += 1
        perOrg.push({ organizationId: org.id, status: "skipped", runId: null, error: "cooldown" })
        continue
      }
    }

    const planGate = await requireFeatureAccess(admin, org.id, "ai")
    if (!planGate.ok) {
      summary.skipped += 1
      summary.skipped_no_ai_entitlement += 1
      logAiGovernanceSkip({
        organizationId: org.id,
        feature: "ai_ops_digest_cron",
        reason: "missing_ai_plan_entitlement",
        source: "cron/ai-ops-digest",
      })
      perOrg.push({
        organizationId: org.id,
        status: "skipped",
        runId: null,
        error: "no_ai_entitlement",
      })
      continue
    }

    try {
      const result = await runDigestForOrganization({
        supabase: admin,
        organizationId: org.id,
        triggerKind: "cron",
        triggeredBy: null,
        now,
      })
      perOrg.push({
        organizationId: org.id,
        status: result.status,
        runId: result.runId,
        error: result.errorMessage,
        itemsCount: result.itemsCount,
      })
      if (result.status === "sent") summary.sent += 1
      else if (result.status === "no_items") summary.no_items += 1
      else if (result.status === "no_recipients") summary.no_recipients += 1
      else if (result.status === "failed") summary.failed += 1
      else summary.skipped += 1
    } catch (e) {
      summary.failed += 1
      perOrg.push({
        organizationId: org.id,
        status: "failed",
        runId: null,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: now.toISOString(),
    summary,
    perOrg,
  })
}

function describeLocal(date: Date, timezone: string): { hour: number; dayOfWeek: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "2-digit",
      weekday: "short",
    })
    const parts = fmt.formatToParts(date)
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0"
    const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun"
    const hour = Number.parseInt(hourStr, 10) % 24
    const dayOfWeek = WEEKDAY_LOOKUP[weekdayStr] ?? 0
    return { hour, dayOfWeek }
  } catch {
    // Bad timezone string — fall back to UTC.
    return { hour: date.getUTCHours(), dayOfWeek: date.getUTCDay() }
  }
}

const WEEKDAY_LOOKUP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export async function GET(request: Request) {
  return runAiOpsDigestCron(request)
}

export async function POST(request: Request) {
  return runAiOpsDigestCron(request)
}
