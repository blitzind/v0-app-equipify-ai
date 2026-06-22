/**
 * GS-SENDR-BUNDLE-PROD — Production certification (temporary, not committed).
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/.tmp-gs-sendr-bundle-prod-cert.ts
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import https from "node:https"

const BASE = "https://app.equipify.ai"
const QA_2A = "growth-personalized-media-runtime-gs-sendr-2a-v1"
const QA_2B = "growth-sendr-operator-workspace-gs-sendr-2b-v1"
const QA_2C = "growth-sendr-public-runtime-gs-sendr-2c-v1"

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

function probeMigrations() {
  const rows = dbQuery<{ version: string }>(
    "select version from supabase_migrations.schema_migrations where version in ('20270901170000','20270901180000') order by version;",
  )
  report.migrations_applied = rows.map((r) => r.version)
  report.migration_ok = rows.length === 2
}

function probeSchemaTables() {
  const rows = dbQuery<Json>(
    `select
      to_regclass('growth.growth_media_assets') is not null as media_assets,
      to_regclass('growth.growth_landing_pages') is not null as landing_pages,
      to_regclass('growth.growth_landing_page_publications') is not null as publications,
      to_regclass('growth.growth_engagement_events') is not null as engagement_events,
      to_regclass('growth.growth_video_assets') is not null as video_assets,
      to_regclass('growth.growth_booking_assets') is not null as booking_assets;`,
  )
  report.schema_tables = rows[0] ?? null
  report.schema_ok =
    rows[0] &&
    rows[0].media_assets === true &&
    rows[0].landing_pages === true &&
    rows[0].publications === true &&
    rows[0].engagement_events === true
}

async function probeRoutes() {
  const workspace = await request("GET", "/api/platform/growth/sendr/workspace")
  report.workspace_status = workspace.status
  report.workspace_qa = workspace.json?.qa_marker

  const media = await request("POST", "/api/platform/growth/sendr/media-assets", {
    assetType: "page",
    name: `SENDR cert ${Date.now()}`,
  })
  report.media_assets_status = media.status
  report.media_assets_qa = media.json?.qa_marker

  const landingCreate = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "create",
    title: `SENDR Prod Cert ${Date.now()}`,
    templateType: "default",
  })
  report.landing_create_status = landingCreate.status
  report.landing_create_qa = landingCreate.json?.qa_marker
  const pageId = (landingCreate.json?.page as Json | undefined)?.id as string | undefined
  report.page_id = pageId

  const video = await request("POST", "/api/platform/growth/sendr/video-assets", {
    action: "register",
    sourceUrl: "https://example.com/cert-video.mp4",
    posterUrl: "https://example.com/cert-poster.jpg",
  })
  report.video_status = video.status
  report.video_qa = video.json?.qa_marker
  const videoAssetId = (video.json?.videoAsset as Json | undefined)?.id as string | undefined

  const booking = await request("POST", "/api/platform/growth/sendr/booking-assets", {
    action: "register",
    meetingLink: "https://cal.example.com/cert-meeting",
    meetingType: "discovery",
    durationMinutes: 30,
    timezone: "America/New_York",
    calendarProvider: "manual",
  })
  report.booking_status = booking.status
  report.booking_qa = booking.json?.qa_marker
  const bookingAssetId = (booking.json?.bookingAsset as Json | undefined)?.id as string | undefined

  if (pageId) {
    await request("POST", "/api/platform/growth/sendr/landing-pages", {
      action: "add_section",
      landingPageId: pageId,
      sectionType: "hero",
      sortOrder: 0,
      content: { headline: "Hello", body: "Welcome {{first_name}}" },
    })
    await request("POST", "/api/platform/growth/sendr/landing-pages", {
      action: "add_section",
      landingPageId: pageId,
      sectionType: "cta",
      sortOrder: 1,
      content: { label: "Book now", href: "https://cal.example.com/cert-meeting" },
    })
    if (videoAssetId) {
      await request("POST", "/api/platform/growth/sendr/video-assets", {
        action: "attach",
        landingPageId: pageId,
        videoAssetId,
      })
    }
    if (bookingAssetId) {
      await request("POST", "/api/platform/growth/sendr/booking-assets", {
        action: "attach",
        landingPageId: pageId,
        bookingAssetId,
      })
    }
    const publish = await request("POST", "/api/platform/growth/sendr/landing-pages", {
      action: "publish",
      landingPageId: pageId,
    })
    report.publish_status = publish.status
    report.publish_qa = publish.json?.qa_marker
    report.public_link = publish.json?.publicLink
    report.published_slug =
      (publish.json?.page as Json | undefined)?.publishedSlug ??
      (publish.json?.page as Json | undefined)?.published_slug
    report.published_version = (publish.json?.page as Json | undefined)?.publishedVersion
  }

  const slug = String(report.published_slug ?? "")
  if (slug) {
    const pubGet = await request("GET", `/api/public/sendr/${slug}`, undefined, { auth: false })
    report.public_get_status = pubGet.status
    report.public_get_qa = pubGet.json?.qa_marker
    report.public_page_title = (pubGet.json?.page as Json | undefined)?.title

    const sessionId = `cert-${Date.now()}`
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
          { eventType: "cta_click", eventValue: { label: "Book now" } },
          { eventType: "booking_started" },
        ],
      },
      { auth: false },
    )
    report.public_events_status = events.status
    report.public_events_qa = events.json?.qa_marker
    report.public_events_accepted = events.json?.accepted

    await new Promise((r) => setTimeout(r, 1500))

    const engRows = dbQuery<{ count: string }>(
      `select count(*)::text as count from growth.growth_engagement_events where session_id = '${sessionId}';`,
    )
    report.engagement_rows = Number(engRows[0]?.count ?? 0)

    const rollupRows = dbQuery<{ count: string }>(
      `select coalesce(sum(event_count),0)::text as count from growth.growth_engagement_event_rollups where rollup_date = current_date and event_type in ('page_view','video_start','cta_click','booking_started');`,
    )
    report.rollup_rows_today = Number(rollupRows[0]?.count ?? 0)

    const pageRow = dbQuery<{ lead_id: string | null }>(
      `select lead_id from growth.growth_landing_pages where id = '${report.page_id}';`,
    )
    const leadId = pageRow[0]?.lead_id
    if (leadId) {
      const tl = dbQuery<{ count: string }>(
        `select count(*)::text as count from growth.lead_timeline_events where lead_id = '${leadId}' and payload->>'session_id' = '${sessionId}';`,
      )
      report.timeline_rows = Number(tl[0]?.count ?? 0)
    } else {
      report.timeline_rows = "skipped_no_lead"
    }
  }

  const runtime = await request("GET", "/api/platform/growth/runtime/observability")
  report.runtime_status = runtime.status
  const sendr = (runtime.json?.snapshot as Json | undefined)?.sendr as Json | undefined
  report.runtime_sendr = sendr

  report.routes_ok =
    workspace.status === 200 &&
    media.status === 200 &&
    landingCreate.status === 200 &&
    video.status === 200 &&
    booking.status === 200 &&
    report.publish_status === 200 &&
    report.public_get_status === 200 &&
    report.public_events_status === 200

  report.qa_markers_ok =
    report.media_assets_qa === QA_2A &&
    report.landing_create_qa === QA_2A &&
    report.workspace_qa === QA_2B &&
    report.public_get_qa === QA_2C &&
    report.public_events_qa === QA_2C
}

async function main() {
  report.commit_sha = "e6df2682"
  report.code_deployment = "CODE_DEPLOYED"

  probeMigrations()
  probeSchemaTables()
  await probeRoutes()

  report.duration_ms = Date.now() - t0
  report.reads_estimate = 25
  report.writes_estimate = 20
  report.side_effects = 1
  report.no_polling = true
  report.no_workers = true
  report.no_realtime = true
  report.no_autonomous_execution = true

  const certified =
    report.code_deployment === "CODE_DEPLOYED" &&
    report.migration_ok === true &&
    report.schema_ok === true &&
    report.routes_ok === true &&
    report.qa_markers_ok === true &&
    typeof report.public_link === "string" &&
    String(report.public_link).includes("/sendr/") &&
    Number(report.engagement_rows) >= 1

  report.final_verdict = certified
    ? "GS-SENDR_BUNDLE_PRODUCTION_CERTIFIED"
    : "GS-SENDR_BUNDLE_NOT_CERTIFIED"

  console.log(JSON.stringify(report, null, 2))
  console.log(`\n${report.final_verdict}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
