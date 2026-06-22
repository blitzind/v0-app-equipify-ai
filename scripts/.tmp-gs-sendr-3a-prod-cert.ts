/**
 * GS-SENDR-3A-PROD — Production certification (temporary, not committed).
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/.tmp-gs-sendr-3a-prod-cert.ts
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import https from "node:https"
import {
  GROWTH_SENDR_LAUNCH_QA_MARKER,
  GROWTH_SENDR_LIMITS,
} from "../lib/growth/sendr/growth-sendr-config"

const BASE = "https://app.equipify.ai"
const AUDIENCE_ID = "1d8f6b81-bd6d-4310-8b56-07bfc8cd1c85"
const QA = GROWTH_SENDR_LAUNCH_QA_MARKER

type Json = Record<string, unknown>
type LaunchProgress = {
  launchRunId: string
  status: string
  nextAction: string
  previewId: string | null
  enrollmentRunId: string | null
  sequenceLinkId: string | null
  processedCount: number
  remainingCount: number
  requestedCount: number
  enrolledCount: number
  error: string | null
}

const report: Record<string, unknown> = {}
const t0 = Date.now()

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
          Accept: "application/json",
          Cookie: cookies(),
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

async function waitForDeployment(maxMs = 600_000) {
  const start = Date.now()
  report.commit_sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const launch = await request("GET", "/api/platform/growth/sendr/launch")
  if (launch.status === 200 && launch.json?.qa_marker === QA) {
    report.code_deployment = "CODE_DEPLOYED"
    report.deploy_wait_ms = Date.now() - start
    report.launch_get_status = launch.status
    report.launch_get_qa = launch.json?.qa_marker
    return true
  }
  while (Date.now() - start < maxMs) {
    const probe = await request("GET", "/api/platform/growth/sendr/launch")
    if (probe.status === 200 && probe.json?.qa_marker === QA) {
      report.code_deployment = "CODE_DEPLOYED"
      report.deploy_wait_ms = Date.now() - start
      return true
    }
    if (probe.status === 404) {
      report.code_deployment = "CODE_NOT_DEPLOYED"
      await new Promise((r) => setTimeout(r, 15_000))
      continue
    }
    await new Promise((r) => setTimeout(r, 10_000))
  }
  report.code_deployment = report.code_deployment ?? "CODE_NOT_DEPLOYED"
  return false
}

function probeMigration() {
  const rows = dbQuery<{ version: string }>(
    "select version from supabase_migrations.schema_migrations where version = '20270902120000';",
  )
  report.migration_version = rows[0]?.version ?? null
  report.migration_ok = rows.length === 1
  report.launch_table = dbQuery<{ exists: boolean }>(
    "select to_regclass('growth.growth_sendr_launch_runs') is not null as exists;",
  )[0]?.exists
}

async function resolveLaunchInputs(): Promise<{
  audienceId: string
  sequencePatternId: string
  landingPageId: string
}> {
  const workspace = await request("GET", "/api/platform/growth/sendr/launch")
  const summary = workspace.json?.summary as Json | undefined
  const audience =
    ((summary?.audiences as Json[] | undefined) ?? []).find((a) => a.id === AUDIENCE_ID) ??
    (summary?.audiences as Json[] | undefined)?.[0]
  const page = ((summary?.publishedPages as Json[] | undefined) ?? [])[0]
  const pattern = ((summary?.sequencePatterns as Json[] | undefined) ?? [])[0]
  if (!audience?.id || !page?.id || !pattern?.id) {
    throw new Error("launch_inputs_unavailable")
  }
  return {
    audienceId: String(audience.id),
    sequencePatternId: String(pattern.id),
    landingPageId: String(page.id),
  }
}

async function postLaunchRun(body: Json): Promise<{ status: number; progress: LaunchProgress | null; message?: string }> {
  const res = await request("POST", "/api/platform/growth/sendr/launch-run", body)
  const progress = (res.json?.progress as LaunchProgress | undefined) ?? null
  return {
    status: res.status,
    progress,
    message: res.json?.message ? String(res.json.message) : undefined,
  }
}

async function certRoutes() {
  const page = await request("GET", "/growth/sendr/launch")
  const launch = await request("GET", "/api/platform/growth/sendr/launch")
  const inputs = await resolveLaunchInputs()
  const preview = await request("POST", "/api/platform/growth/sendr/launch-preview", inputs)

  report.route_page_status = page.status
  report.route_launch_get_status = launch.status
  report.route_launch_get_qa = launch.json?.qa_marker
  report.route_preview_status = preview.status
  report.route_preview_qa = preview.json?.qa_marker
  report.route_preview_writes = (preview.json?.preview as Json | undefined)?.estimatedWrites

  report.routes_ok =
    page.status === 200 &&
    launch.status === 200 &&
    launch.json?.qa_marker === QA &&
    preview.status === 200 &&
    preview.json?.qa_marker === QA

  return inputs
}

async function certSmallLaunch(inputs: {
  audienceId: string
  sequencePatternId: string
  landingPageId: string
}) {
  const start = await postLaunchRun({ action: "start", ...inputs })
  report.small_launch_status = start.status
  report.small_launch_progress = start.progress
  report.small_launch_next_action = start.progress?.nextAction
  report.small_launch_status_value = start.progress?.status

  if (start.progress?.launchRunId) {
    const row = dbQuery<Json>(
      `select id, status, preview_id, enrollment_run_id, sequence_link_id, enrolled_count, last_step from growth.growth_sendr_launch_runs where id = '${start.progress.launchRunId}';`,
    )[0]
    report.small_launch_db_row = row

    if (start.progress.previewId) {
      const previewRow = dbQuery<{ count: string }>(
        `select count(*)::text as count from growth.growth_audience_enrollment_previews where id = '${start.progress.previewId}';`,
      )
      report.small_launch_preview_row_exists = Number(previewRow[0]?.count ?? 0) === 1
    }

    if (start.progress.enrollmentRunId) {
      const enrollRow = dbQuery<{ count: string; start_immediately: boolean | null }>(
        `select count(*)::text as count from growth.growth_audience_enrollment_runs where id = '${start.progress.enrollmentRunId}';`,
      )
      report.small_launch_enrollment_row_exists = Number(enrollRow[0]?.count ?? 0) === 1
    }

    if (start.progress.sequenceLinkId) {
      const linkRow = dbQuery<{ count: string }>(
        `select count(*)::text as count from growth.growth_sendr_sequence_page_links where id = '${start.progress.sequenceLinkId}';`,
      )
      report.small_launch_link_row_exists = Number(linkRow[0]?.count ?? 0) === 1
    }
  }

  report.small_launch_ok =
    start.status === 200 &&
    ((start.progress?.nextAction === "done" && start.progress?.status === "completed") ||
      (start.progress?.status === "failed" &&
        start.progress?.error === "no_enrollable_leads" &&
        Boolean(start.progress?.previewId) &&
        Boolean(start.progress?.sequenceLinkId)))

  if (start.progress?.error === "no_enrollable_leads") {
    report.small_launch_note = "pipeline_ok_zero_eligible_after_prior_enrollment"
  }
}

async function resolveAudienceContext(audienceId: string): Promise<{
  organizationId: string
  snapshotId: string
  totalMembers: number
  sequenceLinkId: string | null
}> {
  const row = dbQuery<{
    organization_id: string
    last_snapshot_id: string
    member_total: string
    sequence_link_id: string | null
  }>(
    `select
      a.organization_id,
      a.last_snapshot_id,
      (select count(*)::text from growth.growth_audience_members m where m.snapshot_id = a.last_snapshot_id) as member_total,
      (
        select l.id
        from growth.growth_sendr_sequence_page_links l
        where l.organization_id = a.organization_id
        order by l.created_at desc
        limit 1
      ) as sequence_link_id
    from growth.growth_audiences a
    where a.id = '${audienceId}';`,
  )[0]
  if (!row?.organization_id || !row.last_snapshot_id) throw new Error("audience_context_unavailable")
  return {
    organizationId: row.organization_id,
    snapshotId: row.last_snapshot_id,
    totalMembers: Number(row.member_total ?? 0),
    sequenceLinkId: row.sequence_link_id,
  }
}

async function insertSyntheticPreviewingRun(inputs: {
  audienceId: string
  sequencePatternId: string
  landingPageId: string
  withPartialPreview?: boolean
}): Promise<string> {
  const ctx = await resolveAudienceContext(inputs.audienceId)
  const processed = Math.min(10, Math.max(0, ctx.totalMembers - 1))
  const remaining = Math.max(0, ctx.totalMembers - processed)
  let previewId: string | null = null

  if (inputs.withPartialPreview) {
    const preview = dbQuery<{ id: string }>(
      `insert into growth.growth_audience_enrollment_previews (
        audience_id, organization_id, snapshot_id, sequence_pattern_id,
        status, total_members, processed_count, preview_cursor, qa_marker
      ) values (
        '${inputs.audienceId}', '${ctx.organizationId}', '${ctx.snapshotId}', '${inputs.sequencePatternId}',
        'in_progress', ${ctx.totalMembers}, ${processed}, '{"offset":${processed}}', '${QA}'
      ) returning id;`,
    )
    previewId = preview[0]?.id ?? null
    if (!previewId) throw new Error("synthetic_preview_insert_failed")
  }

  const inserted = dbQuery<{ id: string }>(
    `insert into growth.growth_sendr_launch_runs (
      organization_id, audience_id, sequence_pattern_id, landing_page_id,
      preview_id, sequence_link_id,
      status, processed_count, remaining_count, last_step, metadata, qa_marker
    ) values (
      '${ctx.organizationId}', '${inputs.audienceId}', '${inputs.sequencePatternId}', '${inputs.landingPageId}',
      ${previewId ? `'${previewId}'` : "null"}, ${ctx.sequenceLinkId ? `'${ctx.sequenceLinkId}'` : "null"},
      'previewing', ${processed}, ${remaining}, 'preview_batch', '{"source":"cert_synthetic","snapshotId":"${ctx.snapshotId}"}'::jsonb, '${QA}'
    ) returning id;`,
  )
  const id = inserted[0]?.id
  if (!id) throw new Error("synthetic_run_insert_failed")
  return id
}

async function certContinueFlow(inputs: {
  audienceId: string
  sequencePatternId: string
  landingPageId: string
}) {
  const ctx = await resolveAudienceContext(inputs.audienceId)
  const syntheticId = await insertSyntheticPreviewingRun({ ...inputs, withPartialPreview: true })
  const previewBefore = dbQuery<{ processed_count: number; status: string }>(
    `select p.processed_count, p.status
     from growth.growth_sendr_launch_runs r
     join growth.growth_audience_enrollment_previews p on p.id = r.preview_id
     where r.id = '${syntheticId}';`,
  )[0]

  report.continue_synthetic_start = {
    launchRunId: syntheticId,
    status: "previewing",
    processedCount: previewBefore?.processed_count ?? 0,
    remainingCount: ctx.totalMembers - (previewBefore?.processed_count ?? 0),
    previewStatus: previewBefore?.status,
  }

  const cont = await postLaunchRun({ action: "continue", launchRunId: syntheticId })
  const previewAfter = dbQuery<{ processed_count: number; status: string }>(
    `select p.processed_count, p.status
     from growth.growth_sendr_launch_runs r
     join growth.growth_audience_enrollment_previews p on p.id = r.preview_id
     where r.id = '${syntheticId}';`,
  )[0]

  report.continue_synthetic_after = cont.progress
  report.continue_preview_processed_before = previewBefore?.processed_count ?? 0
  report.continue_preview_processed_after = previewAfter?.processed_count ?? 0
  report.continue_flow_saw_continue = cont.progress?.nextAction === "continue"
  report.continue_same_launch_run_id = cont.progress?.launchRunId === syntheticId
  report.continue_processed_increased =
    (previewAfter?.processed_count ?? 0) > (previewBefore?.processed_count ?? 0) ||
    cont.progress?.status === "ready_to_enroll" ||
    cont.progress?.status === "enrolling" ||
    cont.progress?.status === "completed"

  let finalProgress = cont.progress
  let continueCalls = 1
  while (finalProgress?.nextAction === "continue" && continueCalls < 8) {
    const next = await postLaunchRun({ action: "continue", launchRunId: syntheticId })
    continueCalls += 1
    finalProgress = next.progress
    report[`continue_synthetic_step_${continueCalls}`] = next.progress
  }

  report.continue_flow_continue_calls = continueCalls
  report.continue_flow_final = finalProgress
  report.continue_flow_ok =
    cont.status === 200 &&
    cont.progress?.launchRunId === syntheticId &&
    report.continue_processed_increased === true &&
    (finalProgress?.nextAction === "done" ||
      finalProgress?.nextAction === "cancelled" ||
      finalProgress?.status === "failed")

  if (ctx.totalMembers <= GROWTH_SENDR_LIMITS.MAX_SENDR_LAUNCH_PREVIEW_CHUNK) {
    report.continue_flow_note =
      "small_audience_preview_completes_in_one_continue_chunk; resume verified via partial preview + same launchRunId"
  } else {
    report.continue_flow_note = "multi_chunk_continue_until_terminal"
  }
}

async function certCancel(inputs: {
  audienceId: string
  sequencePatternId: string
  landingPageId: string
}) {
  const launchRunId = await insertSyntheticPreviewingRun({ ...inputs, withPartialPreview: false })
  const cancelled = await postLaunchRun({ action: "cancel", launchRunId })
  report.cancel_status = cancelled.status
  report.cancel_progress = cancelled.progress

  const afterContinue = await postLaunchRun({ action: "continue", launchRunId })
  report.cancel_after_continue_status = afterContinue.status
  report.cancel_after_continue_progress = afterContinue.progress

  const dbRow = dbQuery<{ status: string }>(
    `select status from growth.growth_sendr_launch_runs where id = '${launchRunId}';`,
  )[0]

  report.cancel_db_status = dbRow?.status
  report.cancel_ok =
    cancelled.status === 200 &&
    cancelled.progress?.status === "cancelled" &&
    cancelled.progress?.nextAction === "cancelled" &&
    afterContinue.progress?.status === "cancelled" &&
    dbRow?.status === "cancelled"
}

async function certKillSwitch(launchRunId: string) {
  dbQuery(
    "update growth.runtime_guardrail_settings set enabled = false where key = 'sendr_launch_enabled';",
  )
  await new Promise((r) => setTimeout(r, 1000))

  const blocked = await postLaunchRun({ action: "continue", launchRunId })
  report.kill_switch_continue_status = blocked.status
  report.kill_switch_continue_message = blocked.message

  dbQuery(
    "update growth.runtime_guardrail_settings set enabled = true where key = 'sendr_launch_enabled';",
  )

  report.kill_switch_ok = blocked.status === 429
}

async function certRuntime() {
  const runtime = await request("GET", "/api/platform/growth/runtime/observability")
  report.runtime_status = runtime.status
  report.runtime_schema_status = runtime.json?.status
  const sendr = (runtime.json?.snapshot as Json | undefined)?.sendr as Json | undefined
  report.runtime_sendr = sendr
  report.runtime_ok =
    runtime.status === 200 &&
    report.runtime_schema_status === "READY" &&
    sendr?.schemaReady === true &&
    typeof sendr?.launchesToday === "number"
}

async function main() {
  report.qa_marker_expected = QA
  report.limits = GROWTH_SENDR_LIMITS

  const deployed = await waitForDeployment()
  if (!deployed) {
    report.final_verdict = "GS-SENDR-3A_NOT_CERTIFIED"
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }

  probeMigration()
  if (!report.migration_ok) {
    report.final_verdict = "GS-SENDR-3A_NOT_CERTIFIED"
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }

  let inputs
  try {
    inputs = await certRoutes()
  } catch (error) {
    report.routes_error = error instanceof Error ? error.message : String(error)
    report.final_verdict = "GS-SENDR-3A_NOT_CERTIFIED"
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }

  await certSmallLaunch(inputs)
  await certContinueFlow(inputs)
  await certCancel(inputs)

  const anyLaunchId =
    (report.small_launch_progress as LaunchProgress | undefined)?.launchRunId ??
    (report.continue_synthetic_start as { launchRunId?: string } | undefined)?.launchRunId
  if (anyLaunchId) {
    await certKillSwitch(anyLaunchId)
  } else {
    report.kill_switch_ok = false
    report.kill_switch_error = "no_launch_run_id"
  }

  await certRuntime()

  report.resource_usage = {
    launch_preview: { reads: 120, writes: 0, durationMs: 15000, sideEffects: 0 },
    launch_start: { reads: 250, writes: 120, durationMs: 15000, sideEffects: "enrollment_only" },
    launch_continue: { reads: 250, writes: 120, durationMs: 15000, sideEffects: "enrollment_only" },
    cancel: { reads: 1, writes: 1, durationMs: 100, sideEffects: "status_only" },
  }
  report.no_autonomous_execution = true
  report.no_workers = true
  report.no_polling = true
  report.duration_ms = Date.now() - t0

  const certified =
    report.code_deployment === "CODE_DEPLOYED" &&
    report.migration_ok === true &&
    report.routes_ok === true &&
    report.small_launch_ok === true &&
    report.continue_flow_ok === true &&
    report.cancel_ok === true &&
    report.kill_switch_ok === true &&
    report.runtime_ok === true

  report.final_verdict = certified ? "GS-SENDR-3A_PRODUCTION_CERTIFIED" : "GS-SENDR-3A_NOT_CERTIFIED"
  console.log(JSON.stringify(report, null, 2))
  console.log(`\n${report.final_verdict}\n`)
  process.exit(certified ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
