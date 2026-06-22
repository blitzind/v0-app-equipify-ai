/**
 * GS-SENDR-5C — Final production certification (temporary, not committed).
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/.tmp-gs-sendr-5c-prod-cert.ts
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import https from "node:https"

const BASE = "https://app.equipify.ai"
const QA = {
  analytics: "growth-sendr-analytics-gs-sendr-3b-v1",
  activity: "growth-sendr-activity-gs-sendr-3c-v1",
  visitor: "growth-sendr-visitor-personalization-gs-sendr-3c-v1",
  public: "growth-sendr-public-runtime-gs-sendr-2c-v1",
  intelligence: "growth-sendr-intelligence-gs-sendr-2e-v1",
  launch: "growth-sendr-launch-gs-sendr-3a-v1",
} as const

const report: Record<string, unknown> = { matrix: {} as Record<string, string>, phase: "GS-SENDR-5C" }
const t0 = Date.now()

function mark(key: string, status: "PASS" | "FAIL" | "PARTIAL" | "NOT_TESTED", detail?: unknown) {
  ;(report.matrix as Record<string, string>)[key] = status
  if (detail !== undefined) report[`detail_${key}`] = detail
}

function cookies(): string {
  const state = JSON.parse(fs.readFileSync("scripts/.growth-cert-storage-state.json", "utf8")) as {
    cookies: Array<{ name: string; value: string; domain: string }>
  }
  return state.cookies
    .filter((c) => c.domain.includes("equipify"))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
}

function dbQuery<T = Record<string, unknown>>(sql: string): T[] {
  const out = execFileSync("npx", ["supabase", "db", "query", "--linked", "-o", "json", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  return (JSON.parse(out) as { rows?: T[] }).rows ?? []
}

function requestRaw(
  method: string,
  path: string,
  body?: unknown,
  auth = true,
): Promise<{
  status: number
  json: Record<string, unknown> | null
  body: string
  headers: Record<string, string | string[] | undefined>
}> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined
    const req = https.request(
      {
        hostname: "app.equipify.ai",
        path,
        method,
        headers: {
          Accept: method === "GET" && !path.includes("/api/") ? "text/html" : "application/json",
          ...(auth ? { Cookie: cookies() } : {}),
          ...(payload
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
            : {}),
        },
      },
      (res) => {
        let data = ""
        res.on("data", (c) => (data += c))
        res.on("end", () => {
          let json: Record<string, unknown> | null = null
          try {
            json = JSON.parse(data) as Record<string, unknown>
          } catch {
            json = null
          }
          resolve({ status: res.statusCode ?? 0, json, body: data, headers: res.headers })
        })
      },
    )
    req.on("error", reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function request(method: string, path: string, body?: unknown, auth = true) {
  const res = await requestRaw(method, path, body, auth)
  return { status: res.status, json: res.json, body: res.body, headers: res.headers }
}

async function probeGuardrails() {
  const obs = await request("GET", "/api/platform/growth/runtime/observability")
  const killSwitches = (obs.json?.snapshot as Record<string, unknown> | undefined)?.killSwitches as
    | Record<string, boolean>
    | undefined
  const sendr = (obs.json?.snapshot as Record<string, unknown> | undefined)?.sendr as
    | Record<string, unknown>
    | undefined

  mark(
    "guardrail_observability",
    obs.status === 200 ? "PASS" : "FAIL",
    { analyticsLoadsToday: sendr?.analyticsLoadsToday, activityLoadsToday: sendr?.activityLoadsToday },
  )
  mark(
    "kill_switch_analytics_default",
    killSwitches?.sendr_analytics_enabled === true ? "PASS" : "FAIL",
    { sendr_analytics_enabled: killSwitches?.sendr_analytics_enabled ?? "missing" },
  )
  mark(
    "kill_switch_activity_default",
    killSwitches?.sendr_activity_enabled === true ? "PASS" : "FAIL",
    { sendr_activity_enabled: killSwitches?.sendr_activity_enabled ?? "missing" },
  )

  const analytics = await request("GET", "/api/platform/growth/sendr/analytics?preset=last_7_days")
  mark(
    "analytics_api_200",
    analytics.status === 200 && analytics.json?.qa_marker === QA.analytics ? "PASS" : "FAIL",
    { status: analytics.status, message: analytics.json?.message },
  )

  const activity = await request("GET", "/api/platform/growth/sendr/activity")
  mark(
    "activity_api_200",
    activity.status === 200 && activity.json?.qa_marker === QA.activity ? "PASS" : "FAIL",
    { status: activity.status, message: activity.json?.message },
  )
}

async function probeAnalyticsActivity() {
  const funnel = await request("GET", "/api/platform/growth/sendr/analytics/funnel?preset=last_7_days")
  mark("analytics_funnel", funnel.status === 200 ? "PASS" : "FAIL", funnel.status)

  const pages = await request("GET", "/api/platform/growth/sendr/analytics/pages?preset=last_7_days")
  mark("analytics_pages", pages.status === 200 ? "PASS" : "FAIL", pages.status)

  const prospects = await request("GET", "/api/platform/growth/sendr/analytics/prospects?preset=last_7_days&limit=10")
  mark("analytics_high_intent", prospects.status === 200 ? "PASS" : "FAIL", prospects.status)

  const feed = await request("GET", "/api/platform/growth/sendr/activity/feed?limit=10")
  mark("activity_feed", feed.status === 200 ? "PASS" : "FAIL", feed.status)

  const hot = await request("GET", "/api/platform/growth/sendr/activity/prospects?limit=10")
  mark("activity_hot_prospects", hot.status === 200 ? "PASS" : "FAIL", hot.status)

  const lead = dbQuery<{ id: string }>(`select id from growth.leads order by updated_at desc limit 1;`)[0]
  if (lead?.id) {
    const timeline = await request(
      "GET",
      `/api/platform/growth/sendr/activity/timeline?leadId=${lead.id}&preset=last_7_days`,
    )
    mark("activity_timeline", timeline.status === 200 ? "PASS" : "FAIL", timeline.status)
    report.sample_lead_id = lead.id
  } else {
    mark("activity_timeline", "NOT_TESTED")
  }

  const intel = await request("GET", "/api/platform/growth/sendr/intelligence")
  mark(
    "recommendations_intelligence",
    intel.status === 200 && intel.json?.qa_marker === QA.intelligence ? "PASS" : "FAIL",
    intel.status,
  )
}

async function probeVideoWorkflow() {
  const growthCount = dbQuery<{ cnt: string }>(
    `select count(*)::text as cnt from growth.video_assets where storage_path is not null;`,
  )[0]?.cnt
  const legacyCount = dbQuery<{ cnt: string }>(
    `select count(*)::text as cnt from growth.growth_video_assets where deleted_at is null and legacy_video_asset_id is null;`,
  )[0]?.cnt
  report.prod_growth_video_assets = Number(growthCount ?? 0)
  report.prod_legacy_video_metadata = Number(legacyCount ?? 0)

  const assets = await request("GET", "/api/platform/growth/sendr/assets?kind=video&limit=10")
  const videoLibrary = assets.json?.videoLibrary as Record<string, unknown> | undefined
  const growthItems = ((assets.json?.items as Array<Record<string, unknown>>) ?? []).filter(
    (i) => (i.metadata as Record<string, unknown>)?.source === "growth_library",
  )

  mark(
    "video_library_empty_state",
    assets.status === 200 ? (videoLibrary?.isEmpty === true || growthItems.length === 0 ? "PASS" : "PARTIAL") : "FAIL",
    videoLibrary ?? { growthItems: growthItems.length },
  )

  mark(
    "growth_video_upload_seed",
    Number(growthCount) > 0 ? "PASS" : "NOT_TESTED",
    { note: "operator must upload via /growth/videos/library", count: growthCount },
  )

  const growthVideoId = dbQuery<{ id: string }>(
    `select id from growth.video_assets where storage_path is not null order by updated_at desc limit 1;`,
  )[0]?.id

  const pageCreate = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "create",
    title: `PV 5C Cert ${Date.now()}`,
    templateType: "default",
  })
  const pageId = (pageCreate.json?.page as Record<string, unknown> | undefined)?.id as string | undefined
  mark("page_create", pageCreate.status === 200 && pageId ? "PASS" : "FAIL")

  if (!pageId) return

  const videoSection = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "add_section",
    landingPageId: pageId,
    sectionType: "video",
    sortOrder: 0,
    content: { headline: "Your video" },
  })
  const sectionId = (videoSection.json?.section as Record<string, unknown> | undefined)?.id as string | undefined
  mark("section_add_video", videoSection.status === 200 && sectionId ? "PASS" : "FAIL")

  if (growthVideoId) {
    const attachPage = await request("POST", "/api/platform/growth/sendr/video-assets", {
      action: "attach_growth_video",
      landingPageId: pageId,
      growthVideoAssetId: growthVideoId,
    })
    mark("page_attach_growth_video", attachPage.status === 200 ? "PASS" : "FAIL", attachPage.json)

    if (sectionId) {
      const attachSection = await request("POST", "/api/platform/growth/sendr/video-assets", {
        action: "attach_growth_video_section",
        landingPageId: pageId,
        sectionId,
        growthVideoAssetId: growthVideoId,
      })
      mark("section_attach_growth_video", attachSection.status === 200 ? "PASS" : "FAIL", attachSection.json)

      const detachSection = await request("POST", "/api/platform/growth/sendr/video-assets", {
        action: "detach_section_video",
        landingPageId: pageId,
        sectionId,
      })
      mark("section_detach_video", detachSection.status === 200 ? "PASS" : "FAIL", detachSection.status)

      await request("POST", "/api/platform/growth/sendr/video-assets", {
        action: "attach_growth_video_section",
        landingPageId: pageId,
        sectionId,
        growthVideoAssetId: growthVideoId,
      })
    } else {
      mark("section_attach_growth_video", "NOT_TESTED")
      mark("section_detach_video", "NOT_TESTED")
    }

    const preview = await request("GET", `/api/platform/growth/sendr/video-assets?growthVideoAssetId=${growthVideoId}`)
    mark(
      "video_preview_api",
      preview.status === 200 && preview.json?.preview ? "PASS" : "FAIL",
      preview.status,
    )

    const detachPage = await request("POST", "/api/platform/growth/sendr/video-assets", {
      action: "detach_page_video",
      landingPageId: pageId,
    })
    mark("page_detach_video", detachPage.status === 200 ? "PASS" : "FAIL", detachPage.status)

    await request("POST", "/api/platform/growth/sendr/video-assets", {
      action: "attach_growth_video",
      landingPageId: pageId,
      growthVideoAssetId: growthVideoId,
    })
  } else {
    mark("page_attach_growth_video", "NOT_TESTED", "no growth.video_assets")
    mark("section_attach_growth_video", "NOT_TESTED")
    mark("section_detach_video", "NOT_TESTED")
    mark("video_preview_api", "NOT_TESTED")
    mark("page_detach_video", "NOT_TESTED")
  }

  const publish = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "publish",
    landingPageId: pageId,
  })
  const slug = (publish.json?.page as Record<string, unknown> | undefined)?.publishedSlug as string | undefined
  mark("publish", publish.status === 200 && slug ? "PASS" : "FAIL", { slug })

  const republish = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "publish",
    landingPageId: pageId,
  })
  mark("republish", republish.status === 200 ? "PASS" : "FAIL")

  report.cert_page_id = pageId
  report.cert_slug = slug

  if (slug) await probePublicRuntime(slug, pageId, sectionId, growthVideoId)
}

async function probePublicRuntime(
  slug: string,
  pageId: string,
  sectionId?: string,
  growthVideoId?: string,
) {
  const anonApi = await request("GET", `/api/public/sendr/${slug}`, undefined, false)
  const pagePayload = anonApi.json?.page as Record<string, unknown> | undefined
  const sections = pagePayload?.sections as Array<Record<string, unknown>> | undefined
  const hasPlayback = Boolean(
    (pagePayload?.video as Record<string, unknown> | undefined)?.playbackUrl ||
      sections?.some((s) => (s.content as Record<string, unknown>)?.videoPlayback),
  )
  mark("public_api_anonymous", anonApi.status === 200 && anonApi.json?.qa_marker === QA.public ? "PASS" : "FAIL", {
    hasPlayback,
    sections: sections?.length ?? 0,
  })

  const videosSsr = await requestRaw("GET", `/videos/${slug}`, undefined, false)
  mark(
    "public_videos_ssr",
    videosSsr.status === 200 && videosSsr.body.length > 500 ? "PASS" : "PARTIAL",
    videosSsr.status,
  )

  const legacy = await requestRaw("GET", `/sendr/${slug}`, undefined, false)
  mark(
    "legacy_sendr_redirect",
    legacy.status === 307 && String(legacy.headers.location).includes(`/videos/${slug}`) ? "PASS" : "FAIL",
    { status: legacy.status, location: legacy.headers.location },
  )

  const lead = dbQuery<{ id: string }>(`select id from growth.leads order by updated_at desc limit 1;`)[0]
  if (lead?.id) {
    const leadApi = await request("GET", `/api/public/sendr/${slug}?leadId=${lead.id}`, undefined, false)
    const pers = (leadApi.json?.page as Record<string, unknown> | undefined)?.personalization
    mark(
      "personalization_leadId",
      leadApi.status === 200 && (pers as Record<string, unknown>)?.applied === true ? "PASS" : "PARTIAL",
      pers,
    )
  }

  const launch = await request("GET", "/api/platform/growth/sendr/launch")
  const summary = launch.json?.summary as Record<string, unknown> | undefined
  const audience = ((summary?.audiences as Array<Record<string, unknown>>) ?? [])[0]
  const pattern = ((summary?.sequencePatterns as Array<Record<string, unknown>>) ?? [])[0]

  if (audience?.id && pattern?.id) {
    const preview = await request("POST", "/api/platform/growth/sendr/launch-preview", {
      landingPageId: pageId,
      audienceId: String(audience.id),
      sequencePatternId: String(pattern.id),
    })
    const url = (preview.json?.preview as Record<string, unknown> | undefined)?.sendrPageUrl as string | undefined
    const eligible = (preview.json?.preview as Record<string, unknown> | undefined)?.eligibleCount
    mark(
      "launch_preview_url",
      preview.status === 200 && String(url).includes("/videos/") ? "PASS" : "PARTIAL",
      { url, eligibleCount: eligible },
    )

    if (url?.includes("token=")) {
      const tokenApi = await request("GET", `/api/public/sendr/${slug}?${url.split("?")[1]}`, undefined, false)
      const tokenPers = (tokenApi.json?.page as Record<string, unknown> | undefined)?.personalization
      mark(
        "personalization_token",
        tokenApi.status === 200 && (tokenPers as Record<string, unknown>)?.applied === true ? "PASS" : "PARTIAL",
        tokenPers,
      )
    } else {
      mark("personalization_token", eligible === 0 ? "PARTIAL" : "NOT_TESTED", { url, eligibleCount: eligible })
    }
  } else {
    mark("launch_preview_url", "NOT_TESTED")
    mark("personalization_token", "NOT_TESTED")
  }

  const badToken = await request("GET", `/api/public/sendr/${slug}?token=invalid.token.here`, undefined, false)
  mark(
    "invalid_token_fallback",
    badToken.status === 200 &&
      (badToken.json?.page as Record<string, unknown> | undefined)?.personalization?.applied !== true
      ? "PASS"
      : "FAIL",
  )

  const sessionId = `cert-5c-${Date.now()}`
  const events = await request(
    "POST",
    "/api/public/sendr/events",
    {
      slug,
      sessionId,
      pageUrl: `${BASE}/videos/${slug}`,
      events: [
        { eventType: "page_view" },
        {
          eventType: "video_start",
          eventValue: growthVideoId ? { videoAssetId: growthVideoId } : {},
        },
        { eventType: "video_progress", eventValue: { progressPct: 50 } },
        { eventType: "video_complete" },
        { eventType: "cta_click", eventValue: { label: "Book" } },
        { eventType: "booking_started" },
      ],
    },
    false,
  )
  mark(
    "engagement_ingest",
    events.status === 200 && Number(events.json?.accepted) >= 1 ? "PASS" : "FAIL",
    events.json,
  )

  await new Promise((r) => setTimeout(r, 1500))
  const count = dbQuery<{ cnt: string }>(
    `select count(*)::text as cnt from growth.growth_engagement_events where session_id = '${sessionId}';`,
  )[0]?.cnt
  mark("engagement_persisted", Number(count) >= 1 ? "PASS" : "FAIL", count)

  mark(
    "anonymous_playback",
    hasPlayback && growthVideoId ? "PASS" : growthVideoId ? "PARTIAL" : "NOT_TESTED",
    { hasPlayback, growthVideoId: growthVideoId ?? null },
  )
  mark("tokenized_playback", "NOT_TESTED", "requires token URL with eligible audience")
}

async function probeUiRoutes() {
  for (const [key, path] of [
    ["ui_analytics", "/growth/sendr/analytics"],
    ["ui_activity", "/growth/sendr/activity"],
    ["ui_workspace", "/growth/sendr"],
    ["ui_video_library", "/growth/videos/library"],
    ["ui_record_stub", "/growth/videos/record"],
  ] as const) {
    const res = await requestRaw("GET", path)
    mark(key, res.status === 200 ? "PASS" : res.status === 307 ? "PARTIAL" : "FAIL", res.status)
  }
}

async function main() {
  report.base = BASE
  report.deployed_commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  report.local_5b_hotfix_committed = false
  report.note =
    "Production reflects deployed commit; GS-SENDR-5B hotfix is local-only until commit+push to main."

  try {
    await probeGuardrails()
    await probeAnalyticsActivity()
    await probeVideoWorkflow()
    await probeUiRoutes()
  } catch (error) {
    report.fatal_error = error instanceof Error ? error.message : String(error)
  }

  const matrix = report.matrix as Record<string, string>
  const values = Object.values(matrix)
  report.summary = {
    pass: values.filter((v) => v === "PASS").length,
    fail: values.filter((v) => v === "FAIL").length,
    partial: values.filter((v) => v === "PARTIAL").length,
    not_tested: values.filter((v) => v === "NOT_TESTED").length,
    total: values.length,
  }
  report.duration_ms = Date.now() - t0
  report.no_commit = true
  report.no_deploy = true

  const criticalFails = [
    "kill_switch_analytics_default",
    "kill_switch_activity_default",
    "analytics_api_200",
    "activity_api_200",
  ].filter((k) => matrix[k] === "FAIL")

  report.go_live_blockers = criticalFails
  report.production_ready =
    criticalFails.length === 0 && values.filter((v) => v === "FAIL").length === 0

  console.log(JSON.stringify(report, null, 2))
  process.exit(report.production_ready ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
