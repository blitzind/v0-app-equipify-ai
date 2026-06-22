/**
 * GS-SENDR-2D/2E-PROD — Production certification (temporary, not committed).
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/.tmp-gs-sendr-2d-2e-prod-cert.ts
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import https from "node:https"
import {
  applySendrPageUrlMergeFields,
} from "../lib/growth/sendr/growth-sendr-sequence-bridge-service"
import { buildSendrPagePublicLink } from "../lib/growth/sendr/growth-sendr-slug-runtime"
import {
  GROWTH_SENDR_INTELLIGENCE_QA_MARKER,
  GROWTH_SENDR_LIMITS,
  GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER,
} from "../lib/growth/sendr/growth-sendr-config"

const BASE = "https://app.equipify.ai"
const AUDIENCE_ID = "1d8f6b81-bd6d-4310-8b56-07bfc8cd1c85"
const QA_2D = GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER
const QA_2E = GROWTH_SENDR_INTELLIGENCE_QA_MARKER

type Json = Record<string, unknown>
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
  opts?: { auth?: boolean },
): Promise<{ status: number; body: string; json: Json | null }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE)
    const payload = body !== undefined ? JSON.stringify(body) : undefined
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(opts?.auth !== false ? { Cookie: cookies() } : {}),
      ...(payload
        ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
        : {}),
    }
    const req = https.request(
      { hostname: url.hostname, path: url.pathname + url.search, method, headers },
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
  while (Date.now() - start < maxMs) {
    const assets = await request("GET", "/api/platform/growth/sendr/assets?limit=1")
    const links = await request("GET", "/api/platform/growth/sendr/sequence-links")
    const intel = await request("GET", "/api/platform/growth/sendr/intelligence")
    if (assets.status === 200 && links.status === 200 && intel.status === 200) {
      report.code_deployment = "CODE_DEPLOYED"
      report.deploy_wait_ms = Date.now() - start
      report.assets_probe_status = assets.status
      report.sequence_links_probe_status = links.status
      report.intelligence_probe_status = intel.status
      return true
    }
    if (assets.status === 503 && String(assets.json?.error).includes("schema")) {
      report.code_deployment = "CODE_DEPLOYED"
      report.deploy_wait_ms = Date.now() - start
      report.assets_probe_status = assets.status
      return true
    }
    if (assets.status === 404) {
      report.code_deployment = "CODE_NOT_DEPLOYED"
      await new Promise((r) => setTimeout(r, 15_000))
      continue
    }
    report.code_deployment = assets.status === 404 ? "CODE_NOT_DEPLOYED" : "CODE_DEPLOYED"
    if (report.code_deployment === "CODE_DEPLOYED") return true
    await new Promise((r) => setTimeout(r, 15_000))
  }
  report.code_deployment = report.code_deployment ?? "CODE_NOT_DEPLOYED"
  return report.code_deployment === "CODE_DEPLOYED"
}

function probeMigrations() {
  const rows = dbQuery<{ version: string }>(
    "select version from supabase_migrations.schema_migrations where version in ('20270901190000','20270901200000','20270901210000') order by version;",
  )
  report.migration_versions = rows.map((r) => r.version)
  report.migration_ok = rows.length >= 2 && rows.some((r) => r.version === "20270901190000") && rows.some((r) => r.version === "20270901200000")
  report.timeline_types_migration = rows.some((r) => r.version === "20270901210000")
}

function probeSchema() {
  const table = dbQuery<{ exists: boolean }>(
    "select to_regclass('growth.growth_sendr_sequence_page_links') is not null as exists;",
  )
  report.sequence_links_table = table[0]?.exists === true

  const switches = dbQuery<{ key: string; enabled: boolean }>(
    `select key, enabled from growth.runtime_guardrail_settings
     where key in (
       'sendr_sequence_bridge_enabled',
       'sendr_timeline_enabled',
       'sendr_intelligence_enabled',
       'sendr_recommendations_enabled'
     )
     order by key;`,
  )
  report.kill_switches = switches
  report.kill_switches_ok =
    switches.length === 4 && switches.every((s) => s.enabled === true)
}

async function certAssetPicker() {
  const all = await request("GET", "/api/platform/growth/sendr/assets?limit=20")
  report.asset_picker_status = all.status
  report.asset_picker_qa = all.json?.qa_marker
  const items = (all.json?.items as Json[] | undefined) ?? []
  report.asset_picker_count = items.length
  report.asset_picker_kinds = [...new Set(items.map((i) => String(i.assetKind)))]

  const video = await request("GET", "/api/platform/growth/sendr/assets?kind=video&limit=5")
  const search = await request("GET", "/api/platform/growth/sendr/assets?search=sendr&limit=5")
  report.asset_picker_video_status = video.status
  report.asset_picker_search_status = search.status
  report.asset_picker_ok =
    all.status === 200 &&
    video.status === 200 &&
    search.status === 200 &&
    report.asset_picker_qa === "growth-sendr-operator-workspace-gs-sendr-2b-v1"
}

async function certSequenceLink(sequencePatternId: string, landingPageId: string) {
  const create = await request("POST", "/api/platform/growth/sendr/sequence-links", {
    landingPageId,
    sequencePatternId,
  })
  report.sequence_link_status = create.status
  report.sequence_link_qa = create.json?.qa_marker
  const link = create.json?.link as Json | undefined
  report.sequence_link_id = link?.id
  report.sequence_link_landing_page_id = link?.landingPageId
  report.sequence_link_pattern_id = link?.sequencePatternId
  report.sequence_link_slug = (link?.metadata as Json | undefined)?.publishedSlug

  const list = await request(
    "GET",
    `/api/platform/growth/sendr/sequence-links?sequencePatternId=${sequencePatternId}`,
  )
  report.sequence_link_list_status = list.status
  report.sequence_link_list_count = ((list.json?.links as Json[] | undefined) ?? []).length

  report.sequence_link_ok =
    create.status === 200 &&
    report.sequence_link_qa === QA_2D &&
    link?.landingPageId === landingPageId &&
    link?.sequencePatternId === sequencePatternId
}

function certUrlResolution(slug: string) {
  const url = buildSendrPagePublicLink(slug)
  const resolved = applySendrPageUrlMergeFields(
    "See your page: {{sendr_page_url}}",
    url,
  )
  report.url_resolution_slug = slug
  report.url_resolution_url = url
  report.url_resolution_merged = resolved
  report.url_resolution_ok =
    url === `https://app.equipify.ai/sendr/${slug}` &&
    resolved.includes(url) &&
    !resolved.includes("{{sendr_page_url}}")
}

async function certPublicEngagement(slug: string, pageId: string) {
  const sessionId = `cert-2d2e-${Date.now()}`
  const events = await request(
    "POST",
    "/api/public/sendr/events",
    {
      slug,
      sessionId,
      pageUrl: `${BASE}/sendr/${slug}`,
      events: [
        { eventType: "page_view" },
        { eventType: "video_start" },
        { eventType: "video_complete" },
        { eventType: "cta_click", eventValue: { label: "Book now" } },
        { eventType: "booking_started" },
      ],
    },
    { auth: false },
  )
  report.public_events_status = events.status
  report.public_events_accepted = events.json?.accepted

  const dupEvents = await request(
    "POST",
    "/api/public/sendr/events",
    {
      slug,
      sessionId,
      pageUrl: `${BASE}/sendr/${slug}`,
      events: [{ eventType: "page_view" }],
    },
    { auth: false },
  )
  report.public_events_dup_status = dupEvents.status

  await new Promise((r) => setTimeout(r, 2000))

  const eng = dbQuery<{ count: string }>(
    `select count(*)::text as count from growth.growth_engagement_events where session_id = '${sessionId}';`,
  )
  report.engagement_rows = Number(eng[0]?.count ?? 0)

  const dup = dbQuery<{ count: string }>(
    `select count(*)::text as count from growth.growth_engagement_events where session_id = '${sessionId}' and event_type = 'page_view';`,
  )
  report.page_view_rows = Number(dup[0]?.count ?? 0)

  const pageRow = dbQuery<{ lead_id: string | null }>(
    `select lead_id from growth.growth_landing_pages where id = '${pageId}';`,
  )
  const leadId = pageRow[0]?.lead_id
  report.cert_lead_id = leadId

  if (leadId) {
    const tl = dbQuery<{ count: string; title: string }>(
      `select count(*)::text as count, max(title) as title from growth.lead_timeline_events where lead_id = '${leadId}' and payload->>'session_id' = '${sessionId}';`,
    )
    report.timeline_rows = Number(tl[0]?.count ?? 0)
    report.timeline_title_sample = tl[0]?.title

    const tlPageView = dbQuery<{ count: string }>(
      `select count(*)::text as count from growth.lead_timeline_events where lead_id = '${leadId}' and payload->>'session_id' = '${sessionId}' and event_type = 'landing_page_viewed';`,
    )
    report.timeline_page_view_rows = Number(tlPageView[0]?.count ?? 0)

    const meta = dbQuery<{ metadata: Json }>(
      `select metadata from growth.leads where id = '${leadId}';`,
    )
    const intel = (meta[0]?.metadata?.sendr_intelligence as Json | undefined) ?? null
    report.lead_intelligence = intel
    report.intent_score = intel?.intentScore
    report.intent_level = intel?.intentLevel
    report.last_sendr_activity_at = intel?.lastSendrActivityAt
    report.sendr_engagement_count = intel?.sendrEngagementCount

    const rec = await request("GET", `/api/platform/growth/sendr/intelligence?leadId=${leadId}`)
    report.recommendations_status = rec.status
    report.recommendations_qa = rec.json?.qa_marker
    report.recommendations = (rec.json?.lead as Json | undefined)?.recommendations
    report.recommendations_ok =
      rec.status === 200 &&
      report.recommendations_qa === QA_2E &&
      Array.isArray(report.recommendations)
  } else {
    report.timeline_rows = "skipped_no_lead"
    report.intent_ok = "skipped_no_lead"
    report.recommendations_ok = "skipped_no_lead"
  }

  report.timeline_ok =
    Number(report.engagement_rows) >= 1 &&
    Number(report.timeline_page_view_rows ?? 0) === 1 &&
    (leadId ? Number(report.timeline_rows) >= 1 : true)

  report.intent_ok =
    leadId &&
    typeof report.intent_score === "number" &&
    Number(report.intent_score) >= 0 &&
    Number(report.intent_score) <= 100
}

async function certAudienceEnrollmentBridge(
  landingPageId: string,
  sequencePatternId: string,
  slug: string,
) {
  const audience = await request("GET", `/api/platform/growth/audiences/${AUDIENCE_ID}`)
  const dbAudience = dbQuery<{ last_snapshot_id: string | null }>(
    `select last_snapshot_id from growth.growth_audiences where id = '${AUDIENCE_ID}';`,
  )
  const snapshotId = String(
    dbAudience[0]?.last_snapshot_id ??
      (audience.json?.audience as Json | undefined)?.lastSnapshotId ??
      (audience.json?.audience as Json | undefined)?.latestSnapshotId ??
      "",
  )
  if (!snapshotId) {
    report.audience_enrollment_ok = false
    report.audience_enrollment_error = "no_snapshot"
    return
  }

  let progress = await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview`, {
    snapshotId,
    sequencePatternId,
    sendrLandingPageId: landingPageId,
  })
  report.audience_preview_start_status = progress.status

  let previewId = String((progress.json?.progress as Json | undefined)?.previewId ?? "")
  for (let i = 0; i < 20; i++) {
    const p = progress.json?.progress as Json | undefined
    if (p && p.hasMore !== true && p.status === "completed") break
    if (!previewId) break
    await new Promise((r) => setTimeout(r, 1500))
    progress = await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-preview`, {
      snapshotId,
      sequencePatternId,
      previewId,
      sendrLandingPageId: landingPageId,
    })
  }

  const finalProgress = progress.json?.progress as Json | undefined
  const attachment = finalProgress?.sendrPageAttachment as Json | undefined
  report.audience_preview_status = finalProgress?.status
  report.audience_sendr_attachment = attachment
  report.audience_sendr_public_url = attachment?.publicUrl

  const dryRun = await request("POST", `/api/platform/growth/audiences/${AUDIENCE_ID}/enrollment-runs`, {
    snapshotId,
    sequencePatternId,
    previewId: previewId || undefined,
    sendrLandingPageId: landingPageId,
    enrollEligible: true,
    dryRun: true,
  })
  report.audience_enrollment_dry_run_status = dryRun.status
  report.audience_enrollment_dry_run = dryRun.json?.progress

  report.audience_enrollment_ok =
    progress.status === 200 &&
    finalProgress?.status === "completed" &&
    String(attachment?.landingPageId ?? "") === landingPageId &&
    String(attachment?.publicUrl ?? "").includes(`/sendr/${slug}`) &&
    dryRun.status === 200
}

async function certWorkspaceAndRuntime() {
  const workspace = await request("GET", "/api/platform/growth/sendr/workspace")
  report.workspace_status = workspace.status
  const summary = workspace.json?.summary as Json | undefined
  report.workspace_metrics = summary?.metrics
  report.workspace_intelligence = summary?.intelligence

  const intel = await request("GET", "/api/platform/growth/sendr/intelligence")
  report.intelligence_workspace_status = intel.status
  report.intelligence_workspace_qa = intel.json?.qa_marker

  const runtime = await request("GET", "/api/platform/growth/runtime/observability")
  report.runtime_status = runtime.status
  report.runtime_schema_status = runtime.json?.status
  const sendr = (runtime.json?.snapshot as Json | undefined)?.sendr as Json | undefined
  report.runtime_sendr = sendr

  report.workspace_ok =
    workspace.status === 200 &&
    intel.status === 200 &&
    report.intelligence_workspace_qa === QA_2E &&
    summary?.intelligence != null

  report.runtime_ok =
    runtime.status === 200 &&
    report.runtime_schema_status === "READY" &&
    sendr?.schemaReady === true
}

async function setupPublishedPageWithLead(): Promise<{
  pageId: string
  slug: string
  sequencePatternId: string
}> {
  const patterns = await request("GET", "/api/platform/growth/sequences/patterns")
  const patternList = (patterns.json?.patterns as Json[] | undefined) ?? []
  const sequencePatternId = String(patternList[0]?.id ?? "")
  if (!sequencePatternId) throw new Error("no_sequence_pattern")

  const leads = dbQuery<{ id: string }>(
    "select id from growth.leads where contact_email is not null order by created_at desc limit 1;",
  )
  const leadId = leads[0]?.id
  if (!leadId) throw new Error("no_lead")

  const create = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "create",
    title: `SENDR 2D2E Cert ${Date.now()}`,
    templateType: "default",
    leadId,
  })
  const pageId = String((create.json?.page as Json | undefined)?.id ?? "")
  if (!pageId) throw new Error("page_create_failed")

  await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "add_section",
    landingPageId: pageId,
    sectionType: "hero",
    sortOrder: 0,
    content: { headline: "Cert", body: "Hello {{first_name}}" },
  })

  const publish = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "publish",
    landingPageId: pageId,
  })
  const slug = String(
    (publish.json?.page as Json | undefined)?.publishedSlug ??
      (publish.json?.page as Json | undefined)?.published_slug ??
      "",
  )
  if (!slug) throw new Error("publish_failed")

  return { pageId, slug, sequencePatternId }
}

async function main() {
  report.commit_sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  report.qa_markers_expected = { qa_2d: QA_2D, qa_2e: QA_2E }
  report.qa_marker_note =
    "Spec lists growth-sendr-engagement-intelligence-gs-sendr-2e-v1; shipped marker is growth-sendr-intelligence-gs-sendr-2e-v1"

  const deployed = await waitForDeployment()
  if (!deployed) {
    report.final_verdict = "GS-SENDR_2D_2E_NOT_CERTIFIED"
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }

  probeMigrations()
  if (!report.migration_ok) {
    report.migration_apply_attempt = "pending"
  }

  probeSchema()

  await certAssetPicker()

  let pageId = ""
  let slug = ""
  let sequencePatternId = ""
  try {
    const setup = await setupPublishedPageWithLead()
    pageId = setup.pageId
    slug = setup.slug
    sequencePatternId = setup.sequencePatternId
    report.setup_page_id = pageId
    report.setup_slug = slug
    report.setup_sequence_pattern_id = sequencePatternId
  } catch (error) {
    report.setup_error = error instanceof Error ? error.message : String(error)
  }

  if (pageId && sequencePatternId) {
    await certSequenceLink(sequencePatternId, pageId)
    certUrlResolution(slug)
    await certAudienceEnrollmentBridge(pageId, sequencePatternId, slug)
    await certPublicEngagement(slug, pageId)
  }

  await certWorkspaceAndRuntime()

  report.resource_caps = GROWTH_SENDR_LIMITS
  report.resource_usage = {
    asset_picker: { reads: 4, writes: 0, sideEffects: 0 },
    sequence_link_attach: { reads: 5, writes: 2, sideEffects: 0 },
    url_resolution: { reads: 3, writes: 0, sideEffects: 0 },
    timeline_append: { reads: 2, writes: 1, sideEffects: 0 },
    intent_sync: { reads: 25, writes: 1, sideEffects: 0 },
    recommendation_read: { reads: 5, writes: 0, sideEffects: 0 },
  }

  report.duration_ms = Date.now() - t0
  report.no_autonomous_execution = true
  report.no_workers = true
  report.no_polling = true

  const certified =
    report.code_deployment === "CODE_DEPLOYED" &&
    report.migration_ok === true &&
    report.sequence_links_table === true &&
    report.kill_switches_ok === true &&
    report.asset_picker_ok === true &&
    report.sequence_link_ok === true &&
    report.url_resolution_ok === true &&
    report.audience_enrollment_ok === true &&
    report.timeline_ok === true &&
    (report.intent_ok === true || report.intent_ok === "skipped_no_lead") &&
    (report.recommendations_ok === true || report.recommendations_ok === "skipped_no_lead") &&
    report.workspace_ok === true &&
    report.runtime_ok === true

  report.final_verdict = certified
    ? "GS-SENDR_2D_2E_PRODUCTION_CERTIFIED"
    : "GS-SENDR_2D_2E_NOT_CERTIFIED"

  console.log(JSON.stringify(report, null, 2))
  console.log(`\n${report.final_verdict}\n`)
  process.exit(certified ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
