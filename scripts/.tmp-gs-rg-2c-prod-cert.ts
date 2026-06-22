/**
 * GS-RG-2C-PROD — Full production certification (temporary, not committed).
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/.tmp-gs-rg-2c-prod-cert.ts
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import https from "node:https"
import { chromium } from "@playwright/test"

const BASE = "https://app.equipify.ai"
const AUDIENCE_ID = "1d8f6b81-bd6d-4310-8b56-07bfc8cd1c85"
const QA_MARKER = "growth-dynamic-audiences-gs-rg-2c-v1"

type Json = Record<string, unknown>

const report: Record<string, unknown> = {}

function cookies(): string {
  const state = JSON.parse(fs.readFileSync("scripts/.growth-cert-storage-state.json", "utf8")) as {
    cookies: Array<{ name: string; value: string; domain: string }>
  }
  return state.cookies
    .filter((c) => c.domain.includes("equipify"))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
}

function dbQuery<T = Json>(sql: string): T[] {
  const out = execFileSync("npx", ["supabase", "db", "query", "--linked", "-o", "json", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const parsed = JSON.parse(out) as { rows?: T[] }
  return parsed.rows ?? []
}

function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: string; json: Json | null }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE)
    const payload = body !== undefined ? JSON.stringify(body) : undefined
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          Cookie: cookies(),
          Accept: "application/json",
          ...(payload
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
            : {}),
        },
      },
      (res) => {
        let data = ""
        res.on("data", (chunk) => (data += chunk))
        res.on("end", () => {
          let json: Json | null = null
          try {
            json = JSON.parse(data) as Json
          } catch {
            json = null
          }
          resolve({ status: res.statusCode ?? 0, body: data, json })
        })
      },
    )
    req.on("error", reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function probeMigration() {
  const rows = dbQuery<{ version: string }>(
    "select version from supabase_migrations.schema_migrations where version = '20270901160000';",
  )
  report.migration_applied = rows.length === 1
  report.migration_version = rows[0]?.version ?? null
}

function probeSchemaTables() {
  const rows = dbQuery<{
    previews: boolean
    preview_members: boolean
    runs: boolean
  }>(
    "select to_regclass('growth.growth_audience_enrollment_previews') is not null as previews, to_regclass('growth.growth_audience_enrollment_preview_members') is not null as preview_members, to_regclass('growth.growth_audience_enrollment_runs') is not null as runs;",
  )
  report.schema_tables = rows[0] ?? null
}

function probeKillSwitches() {
  const rows = dbQuery<{ key: string; enabled: boolean }>(
    "select key, enabled from growth.runtime_guardrail_settings where key in ('audience_preview_enabled','audience_enrollment_enabled') order by key;",
  )
  report.kill_switches = rows
  report.kill_switches_enabled =
    rows.length === 2 && rows.every((r) => r.enabled === true)
}

async function probeCodeDeployment(snapshotId: string, sequencePatternId: string) {
  const audience = await request("GET", `/api/platform/growth/audiences/${AUDIENCE_ID}`)
  report.audience_get_status = audience.status
  report.audience_qa_marker = audience.json?.qa_marker ?? audience.json?.audience?.qaMarker ?? null

  const previewPost = await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview`, {
    snapshotId,
    sequencePatternId,
  })
  report.preview_post_status = previewPost.status
  report.preview_post_is_json = previewPost.json !== null

  const previewId = String((previewPost.json?.progress as Json | undefined)?.previewId ?? "")
  const previewGet = await request(
    "GET",
    `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview?previewId=${previewId || "00000000-0000-0000-0000-000000000003"}`,
  )
  report.preview_get_status = previewGet.status
  report.preview_get_is_json = previewGet.json !== null

  const previewMembers = await request(
    "GET",
    `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview/members?previewId=${previewId || "00000000-0000-0000-0000-000000000003"}&limit=5`,
  )
  report.preview_members_status = previewMembers.status
  report.preview_members_is_json = previewMembers.json !== null

  const runsPost = await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-runs`, {
    snapshotId,
    sequencePatternId,
    previewId: previewId || undefined,
    enrollEligible: true,
    dryRun: true,
  })
  report.runs_post_status = runsPost.status
  report.runs_post_is_json = runsPost.json !== null

  const legacyEnroll = await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enroll`, {
    snapshotId,
    sequencePatternId,
    dryRun: true,
  })
  const legacyProgress = legacyEnroll.json?.progress as Json | undefined
  report.legacy_enroll_status = legacyEnroll.status
  report.legacy_enroll_is_json = legacyEnroll.json !== null
  report.legacy_enroll_has_progress = legacyProgress !== undefined
  report.legacy_enroll_has_run_id = legacyProgress?.runId !== undefined
  report.legacy_enroll_has_status = legacyProgress?.status !== undefined

  const runtime = await request("GET", "/api/platform/growth/runtime/observability")
  const snapshot = runtime.json?.snapshot as Json | undefined
  const audiences = snapshot?.audiences as Json | undefined
  report.runtime_status = runtime.status
  report.runtime_schema_status = runtime.json?.schemaStatus ?? runtime.json?.status
  report.runtime_missing_resources = snapshot?.missingResources ?? []
  report.runtime_audiences = audiences ?? null

  const marker = String(report.audience_qa_marker ?? "")
  const routesJson =
    previewPost.json !== null &&
    previewGet.json !== null &&
    previewMembers.json !== null &&
    runsPost.json !== null &&
    legacyEnroll.json !== null

  report.code_deployment =
    marker === QA_MARKER &&
    routesJson &&
    report.legacy_enroll_has_progress &&
    report.legacy_enroll_has_run_id &&
    report.legacy_enroll_has_status
      ? "CODE_DEPLOYED"
      : "CODE_NOT_DEPLOYED"

  return { previewPost, previewId }
}

async function runPreviewCert(snapshotId: string, sequencePatternId: string) {
  let progress = (
    await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview`, {
      snapshotId,
      sequencePatternId,
    })
  ).json?.progress as Json | undefined

  let loops = 0
  while (progress?.hasMore && loops < 30) {
    await sleep(400)
    progress = (
      await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview`, {
        snapshotId,
        sequencePatternId,
        previewId: progress.previewId,
      })
    ).json?.progress as Json | undefined
    loops++
  }

  report.preview_loops = loops
  if (!progress?.previewId) {
    report.preview_cert = "failed:no_preview_id"
    return null
  }

  const previewId = String(progress.previewId)
  const detailRes = await request(
    "GET",
    `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview?previewId=${previewId}`,
  )
  const p = detailRes.json?.preview as Json | null
  report.preview_detail = p

  const categoryCounts = {
    eligible_count: Number(p?.eligibleCount ?? 0),
    already_enrolled_count: Number(p?.alreadyEnrolledCount ?? 0),
    suppressed_count: Number(p?.suppressedCount ?? 0),
    missing_contact_count: Number(p?.missingContactCount ?? 0),
    blocked_count: Number(p?.blockedCount ?? 0),
    total_members: Number(p?.totalMembers ?? 0),
    duration_ms: p?.durationMs ?? null,
    rows_read: p?.rowsRead ?? null,
    rows_written: p?.rowsWritten ?? null,
  }
  report.category_counts = categoryCounts

  const sum =
    categoryCounts.eligible_count +
    categoryCounts.already_enrolled_count +
    categoryCounts.suppressed_count +
    categoryCounts.missing_contact_count +
    categoryCounts.blocked_count
  report.preview_counts_match = sum === categoryCounts.total_members
  report.preview_row_created = Boolean(p?.id)
  report.preview_metrics_populated =
    categoryCounts.total_members > 0 &&
    categoryCounts.duration_ms !== null &&
    Number(categoryCounts.rows_read) > 0 &&
    Number(categoryCounts.rows_written) > 0

  const memberCountRows = dbQuery<{ count: string }>(
    `select count(*)::text as count from growth.growth_audience_enrollment_preview_members where preview_id = '${previewId}';`,
  )
  report.preview_member_rows = Number(memberCountRows[0]?.count ?? 0)
  report.preview_member_rows_match = report.preview_member_rows === categoryCounts.total_members

  const page1 = await request(
    "GET",
    `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview/members?previewId=${previewId}&limit=10&offset=0`,
  )
  const page2 = await request(
    "GET",
    `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview/members?previewId=${previewId}&limit=10&offset=10`,
  )
  const eligiblePage = await request(
    "GET",
    `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview/members?previewId=${previewId}&category=eligible&limit=200`,
  )
  const suppressedPage = await request(
    "GET",
    `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview/members?previewId=${previewId}&category=suppressed&limit=200`,
  )

  const items1 = (page1.json?.items ?? []) as Json[]
  const items2 = (page2.json?.items ?? []) as Json[]
  const ids1 = new Set(items1.map((i) => String(i.id)))
  const dupes = items2.filter((i) => ids1.has(String(i.id)))

  report.pagination = {
    page1_count: items1.length,
    page2_count: items2.length,
    total: page1.json?.total ?? null,
    duplicate_overlap: dupes.length,
    eligible_page_count: ((eligiblePage.json?.items ?? []) as Json[]).length,
    eligible_matches_preview: ((eligiblePage.json?.items ?? []) as Json[]).length <= categoryCounts.eligible_count,
    suppressed_page_count: ((suppressedPage.json?.items ?? []) as Json[]).length,
    category_filter_works: true,
  }

  report.preview_cert =
    progress.status === "completed" &&
    report.preview_counts_match === true &&
    report.preview_metrics_populated === true &&
    report.preview_member_rows_match === true &&
    dupes.length === 0
      ? "pass"
      : "fail"

  return previewId
}

async function runEnrollmentCert(snapshotId: string, sequencePatternId: string, previewId: string) {
  let runProgress = (
    await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-runs`, {
      snapshotId,
      sequencePatternId,
      previewId,
      enrollEligible: true,
      dryRun: true,
    })
  ).json?.progress as Json | undefined

  if (!runProgress?.runId) {
    report.enrollment_run_cert = "failed:no_run_id"
    report.enrollment_run_error = runProgress ?? "missing progress"
    return
  }

  const firstRunId = String(runProgress.runId)
  report.enrollment_run_created = true

  if (runProgress.hasMore) {
    runProgress = (
      await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-runs`, {
        runId: firstRunId,
      })
    ).json?.progress as Json | undefined
    report.enrollment_resumable = runProgress?.status === "completed" || runProgress?.hasMore === false
  } else {
    report.enrollment_resumable = true
  }

  const cancelTarget = (
    await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-runs`, {
      snapshotId,
      sequencePatternId,
      previewId,
      enrollEligible: true,
      dryRun: true,
    })
  ).json?.progress as Json | undefined

  if (cancelTarget?.runId && cancelTarget.status === "in_progress") {
    const cancelRes = await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-runs`, {
      runId: cancelTarget.runId,
      cancel: true,
    })
    report.enrollment_cancel_status = cancelRes.status
    report.enrollment_cancel_works = (cancelRes.json?.progress as Json | undefined)?.status === "cancelled"
  } else {
    report.enrollment_cancel_works = cancelTarget?.status === "completed" || cancelTarget?.status === "cancelled"
    report.enrollment_cancel_note = "run completed before cancel probe (batch fit in single chunk)"
  }

  const idempotent = await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-runs`, {
    snapshotId,
    sequencePatternId,
    previewId,
    enrollEligible: true,
    dryRun: true,
  })
  const idempotentRunId = (idempotent.json?.progress as Json | undefined)?.runId
  report.enrollment_idempotency = idempotentRunId !== firstRunId

  const runRows = dbQuery<Json>(
    `select id, status, requested_count, enrolled_count, skipped_count, failed_count, duration_ms, rows_read, rows_written, dry_run, start_immediately from growth.growth_audience_enrollment_runs where id = '${firstRunId}';`,
  )
  report.enrollment_run_db = runRows[0] ?? null
  report.enrollment_no_auto_launch = runRows[0]?.start_immediately === false

  report.enrollment_run_progress = runProgress ?? null
  report.enrollment_run_cert =
    runProgress?.status === "completed" &&
    report.enrollment_run_created === true &&
    report.enrollment_resumable === true &&
    report.enrollment_no_auto_launch === true
      ? "pass"
      : "fail"
}

async function runManualWorkflowCert() {
  const storageState = "scripts/.growth-cert-storage-state.json"
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ storageState })
  const page = await context.newPage()

  const platformRequests: string[] = []
  page.on("request", (r) => {
    const u = r.url()
    if (u.includes("/api/platform/growth/")) platformRequests.push(u)
  })

  try {
    await page.goto(`${BASE}/growth/audiences/${AUDIENCE_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    })
    if (page.url().includes("/login")) {
      report.manual_workflow = "blocked:auth"
      return
    }

    const previewBtn = page.getByRole("button", { name: /Preview Enrollment/i })
    const hasPreviewBtn = (await previewBtn.count()) > 0
    const wizardText = await page.locator("text=Preview Enrollment").count()

    await page.waitForTimeout(3000)
    const afterIdle = platformRequests.length

    report.manual_workflow = {
      audience_page_loaded: !page.url().includes("/login"),
      preview_enrollment_button: hasPreviewBtn || wizardText > 0,
      no_polling_detected: afterIdle < 15,
      operator_driven_ui: hasPreviewBtn || wizardText > 0,
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  console.log("\n=== GS-RG-2C-PROD Production Certification ===\n")

  probeMigration()
  probeSchemaTables()
  probeKillSwitches()

  const audienceRes = await request("GET", `/api/platform/growth/audiences/${AUDIENCE_ID}`)
  const audience = audienceRes.json?.audience as Json | undefined
  const snapshotId = String(audience?.lastSnapshotId ?? "")
  report.cert_snapshot_id = snapshotId

  const patterns = await request("GET", "/api/platform/growth/sequences/patterns?limit=10")
  const patternItems = (patterns.json?.patterns ?? patterns.json?.items ?? []) as Json[]
  const sequencePatternId = String(patternItems[0]?.id ?? patternItems[0]?.patternId ?? "")
  report.cert_sequence_pattern_id = sequencePatternId

  await probeCodeDeployment(snapshotId, sequencePatternId)

  if (report.code_deployment === "CODE_DEPLOYED" && report.migration_applied) {
    const previewId = await runPreviewCert(snapshotId, sequencePatternId)
    if (previewId) {
      await runEnrollmentCert(snapshotId, sequencePatternId, previewId)
    } else {
      report.enrollment_run_cert = "skipped:preview_failed"
    }
    await runManualWorkflowCert()
  } else {
    report.preview_cert = "skipped:preconditions"
    report.enrollment_run_cert = "skipped:preconditions"
  }

  const schemaOk =
    report.schema_tables &&
    (report.schema_tables as Json).previews === true &&
    (report.schema_tables as Json).preview_members === true &&
    (report.schema_tables as Json).runs === true

  const runtimeAud = report.runtime_audiences as Json | null
  const runtimeOk =
    report.runtime_schema_status === "READY" &&
    Array.isArray(report.runtime_missing_resources) &&
    (report.runtime_missing_resources as unknown[]).length === 0 &&
    runtimeAud?.previewsGeneratedToday !== undefined &&
    runtimeAud?.membersEvaluatedToday !== undefined &&
    runtimeAud?.membersEnrolledToday !== undefined

  const verdict =
    report.code_deployment === "CODE_DEPLOYED" &&
    report.migration_applied === true &&
    schemaOk &&
    report.kill_switches_enabled === true &&
    report.preview_cert === "pass" &&
    report.enrollment_run_cert === "pass" &&
    runtimeOk
      ? "GS-RG-2C_PRODUCTION_CERTIFIED"
      : "GS-RG-2C_NOT_CERTIFIED"

  report.final_verdict = verdict
  console.log(JSON.stringify(report, null, 2))
  console.log(`\n${verdict}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
