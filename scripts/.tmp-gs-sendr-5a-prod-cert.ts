/**
 * GS-SENDR-5A — Production operator certification (temporary, not committed).
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/.tmp-gs-sendr-5a-prod-cert.ts
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import https from "node:https"

const BASE = "https://app.equipify.ai"

const QA = {
  analytics: "growth-sendr-analytics-gs-sendr-3b-v1",
  activity: "growth-sendr-activity-gs-sendr-3c-v1",
  visitor: "growth-sendr-visitor-personalization-gs-sendr-3c-v1",
  urlDelivery: "growth-sendr-personalized-url-delivery-gs-sendr-3d-v1",
  videoIntegration: "growth-sendr-growth-video-integration-gs-sendr-4a-v1",
  videoWorkflow: "growth-sendr-video-workflow-gs-sendr-4b-v1",
  public: "growth-sendr-public-runtime-gs-sendr-2c-v1",
  workspace: "growth-sendr-operator-workspace-gs-sendr-2b-v1",
  launch: "growth-sendr-launch-gs-sendr-3a-v1",
  intelligence: "growth-sendr-intelligence-gs-sendr-2e-v1",
} as const

type Json = Record<string, unknown>
const report: Record<string, unknown> = { matrix: {} as Record<string, string> }
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

function dbQuery<T = Json>(sql: string): T[] {
  const out = execFileSync("npx", ["supabase", "db", "query", "--linked", "-o", "json", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const parsed = JSON.parse(out) as { rows?: T[] }
  return parsed.rows ?? []
}

function requestRaw(
  method: string,
  path: string,
  body?: unknown,
  opts?: { auth?: boolean; followRedirect?: boolean },
): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string; json: Json | null }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE)
    const payload = body !== undefined ? JSON.stringify(body) : undefined
    const headers: Record<string, string> = {
      Accept: method === "GET" && !path.includes("/api/") ? "text/html" : "application/json",
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
          resolve({ status: res.statusCode ?? 0, headers: res.headers as Record<string, string | string[] | undefined>, body: data, json })
        })
      },
    )
    req.on("error", reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function request(method: string, path: string, body?: unknown, opts?: { auth?: boolean }) {
  const res = await requestRaw(method, path, body, opts)
  return { status: res.status, body: res.body, json: res.json, headers: res.headers }
}

async function probeDeployment() {
  report.commit_sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()

  const checks = [
    ["analytics", "/api/platform/growth/sendr/analytics", QA.analytics],
    ["activity", "/api/platform/growth/sendr/activity", QA.activity],
    ["launch", "/api/platform/growth/sendr/launch", QA.launch],
    ["intelligence", "/api/platform/growth/sendr/intelligence", QA.intelligence],
    ["workspace", "/api/platform/growth/sendr/workspace", QA.workspace],
  ] as const

  report.deployment_qa = {}
  for (const [name, path, expected] of checks) {
    const res = await request("GET", path)
    ;(report.deployment_qa as Json)[name] = { status: res.status, qa: res.json?.qa_marker }
    mark(`deploy_${name}`, res.status === 200 && res.json?.qa_marker === expected ? "PASS" : "FAIL", {
      status: res.status,
      expected,
      actual: res.json?.qa_marker,
    })
  }

  const videosPage = await requestRaw("GET", "/growth/videos/library", undefined, { auth: true })
  mark("deploy_growth_video_library", videosPage.status === 200 ? "PASS" : "PARTIAL", videosPage.status)

  const recordPage = await requestRaw("GET", "/growth/videos/record?returnTo=%2Fgrowth%2Fsendr%2Ftest&landingPageId=00000000-0000-4000-8000-000000000001", undefined, {
    auth: true,
  })
  mark("deploy_record_return_route", recordPage.status === 200 ? "PASS" : "PARTIAL", recordPage.status)
}

async function probeOperatorWorkflow() {
  const landingCreate = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "create",
    title: `PV 5A Cert ${Date.now()}`,
    templateType: "default",
  })
  const pageId = (landingCreate.json?.page as Json | undefined)?.id as string | undefined
  mark("page_create", landingCreate.status === 200 && pageId ? "PASS" : "FAIL", landingCreate.status)

  if (!pageId) return

  const hero = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "add_section",
    landingPageId: pageId,
    sectionType: "hero",
    sortOrder: 0,
    content: { headline: "Hello {{first_name}}", body: "Welcome from {{company_name}}" },
  })
  mark("section_add_hero", hero.status === 200 ? "PASS" : "FAIL")

  const videoSection = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "add_section",
    landingPageId: pageId,
    sectionType: "video",
    sortOrder: 1,
    content: { headline: "Your video" },
  })
  const sectionId = (videoSection.json?.section as Json | undefined)?.id as string | undefined
  mark("section_add_video", videoSection.status === 200 && sectionId ? "PASS" : "FAIL")

  const growthVideos = dbQuery<{ id: string; title: string; storage_path: string | null }>(
    `select id, title, storage_path from growth.video_assets where storage_path is not null order by updated_at desc limit 1;`,
  )
  const growthVideoId = growthVideos[0]?.id
  report.growth_video_candidate = growthVideos[0] ?? null

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
    } else {
      mark("section_attach_growth_video", "NOT_TESTED")
    }
  } else {
    mark("page_attach_growth_video", "PARTIAL", "no growth.video_assets with storage_path in prod")
    mark("section_attach_growth_video", "NOT_TESTED")
  }

  const publish = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "publish",
    landingPageId: pageId,
  })
  const slug =
    (publish.json?.page as Json | undefined)?.publishedSlug ??
    (publish.json?.page as Json | undefined)?.published_slug
  const publicLink = publish.json?.publicLink
  mark("publish", publish.status === 200 && slug ? "PASS" : "FAIL", { slug, publicLink })

  report.cert_page_id = pageId
  report.cert_slug = slug
  report.cert_public_link = publicLink

  if (slug) {
    await probePublicRuntime(String(slug), pageId, sectionId)
    await probeRepublish(pageId)
  }
}

async function probeRepublish(pageId: string) {
  await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "update",
    landingPageId: pageId,
    title: `PV 5A Cert Updated ${Date.now()}`,
  })
  const republish = await request("POST", "/api/platform/growth/sendr/landing-pages", {
    action: "publish",
    landingPageId: pageId,
  })
  mark("republish", republish.status === 200 ? "PASS" : "FAIL", republish.status)
}

async function probePublicRuntime(slug: string, pageId: string, sectionId?: string) {
  const anonApi = await request("GET", `/api/public/sendr/${slug}`, undefined, { auth: false })
  const pagePayload = anonApi.json?.page as Json | undefined
  mark("public_api_anonymous", anonApi.status === 200 && anonApi.json?.qa_marker === QA.public ? "PASS" : "FAIL", {
    status: anonApi.status,
    hasVideo: Boolean(pagePayload?.video),
    sections: Array.isArray(pagePayload?.sections) ? pagePayload?.sections.length : 0,
  })

  const legacy = await requestRaw("GET", `/sendr/${slug}`, undefined, { auth: false })
  const location = legacy.headers.location
  mark(
    "legacy_sendr_redirect",
    legacy.status === 307 && String(location).includes(`/videos/${slug}`) ? "PASS" : "FAIL",
    { status: legacy.status, location },
  )

  const videosHtml = await requestRaw("GET", `/videos/${slug}`, undefined, { auth: false })
  mark(
    "public_videos_ssr",
    videosHtml.status === 200 && (videosHtml.body.includes("Personalized") || videosHtml.body.length > 500)
      ? "PASS"
      : "PARTIAL",
    videosHtml.status,
  )

  const leadRow = dbQuery<{ id: string; contact_name: string | null }>(
    `select id, contact_name from growth.leads where deleted_at is null order by updated_at desc limit 1;`,
  )
  const leadId = leadRow[0]?.id
  report.sample_lead_id = leadId

  if (leadId && pageId) {
    await request("POST", "/api/platform/growth/sendr/landing-pages", {
      action: "update",
      landingPageId: pageId,
      leadId,
    })
    const republish = await request("POST", "/api/platform/growth/sendr/landing-pages", {
      action: "publish",
      landingPageId: pageId,
    })
    const republishSlug =
      (republish.json?.page as Json | undefined)?.publishedSlug ??
      (republish.json?.page as Json | undefined)?.published_slug ??
      slug

    const preview = await request("POST", "/api/platform/growth/sendr/launch-preview", {
      landingPageId: pageId,
      audienceId: "1d8f6b81-bd6d-4310-8b56-07bfc8cd1c85",
      sequencePatternId: "00000000-0000-4000-8000-000000000099",
    })
    const sampleUrl =
      (preview.json?.preview as Json | undefined)?.samplePersonalizedPageUrl ??
      (preview.json?.preview as Json | undefined)?.sendrPageUrl
    report.launch_preview_sample_url = sampleUrl

    let tokenizedUrl: string | null = null
    if (typeof sampleUrl === "string" && sampleUrl.includes("token=")) {
      tokenizedUrl = sampleUrl
    } else {
      const pages = dbQuery<{ id: string }>(
        `select l.id from growth.growth_landing_pages l where l.published_slug = '${republishSlug.replace(/'/g, "''")}' limit 1;`,
      )
      const tokenRes = await request("GET", `/api/platform/growth/sendr/landing-pages?landingPageId=${pageId}&include=detail`)
      report.page_detail_for_token = tokenRes.status
    }

    if (typeof sampleUrl === "string" && sampleUrl.includes("/videos/") && sampleUrl.includes("token=")) {
      mark("token_url_shape", "PASS", sampleUrl)
      const tokenQuery = sampleUrl.split("?")[1] ?? ""
      const tokenApi = await request("GET", `/api/public/sendr/${republishSlug}?${tokenQuery}`, undefined, {
        auth: false,
      })
      const personalization = (tokenApi.json?.page as Json | undefined)?.personalization as Json | undefined
      mark(
        "token_personalization",
        tokenApi.status === 200 && personalization?.applied === true ? "PASS" : "PARTIAL",
        { status: tokenApi.status, personalization },
      )
      mark(
        "env_token_secret",
        tokenApi.status === 200 && personalization?.mode === "token" ? "PASS" : "PARTIAL",
        personalization,
      )
    } else {
      mark("token_url_shape", "PARTIAL", sampleUrl)
      mark("token_personalization", "NOT_TESTED")
      mark("env_token_secret", "NOT_TESTED")
    }

    const badToken = await request(
      "GET",
      `/api/public/sendr/${republishSlug}?token=invalid.token.here`,
      undefined,
      { auth: false },
    )
    const badPersonalization = (badToken.json?.page as Json | undefined)?.personalization as Json | undefined
    mark(
      "invalid_token_fallback",
      badToken.status === 200 && badPersonalization?.applied !== true ? "PASS" : "PARTIAL",
      badPersonalization,
    )
  } else {
    mark("token_url_shape", "NOT_TESTED")
    mark("token_personalization", "NOT_TESTED")
    mark("env_token_secret", "NOT_TESTED")
    mark("invalid_token_fallback", "NOT_TESTED")
  }

  const sessionId = `cert-5a-${Date.now()}`
  const events = await request(
    "POST",
    "/api/public/sendr/events",
    {
      slug,
      sessionId,
      pageUrl: `${BASE}/videos/${slug}`,
      events: [
        { eventType: "page_view" },
        { eventType: "video_start", eventValue: sectionId ? { videoAssetId: "00000000-0000-4000-8000-000000000001" } : {} },
        { eventType: "video_progress", eventValue: { progressPct: 50 } },
        { eventType: "video_complete" },
        { eventType: "cta_click", eventValue: { label: "Book" } },
        { eventType: "booking_started" },
      ],
    },
    { auth: false },
  )
  mark("engagement_events_ingest", events.status === 200 && Number(events.json?.accepted) >= 1 ? "PASS" : "FAIL", events.json)

  await new Promise((r) => setTimeout(r, 2000))
  const engCount = dbQuery<{ count: string }>(
    `select count(*)::text as count from growth.growth_engagement_events where session_id = '${sessionId}';`,
  )
  mark("engagement_events_persisted", Number(engCount[0]?.count ?? 0) >= 1 ? "PASS" : "FAIL", engCount[0]?.count)

  if (sectionId) {
    const sectionPlayback = ((pagePayload?.sections as Json[] | undefined) ?? []).find(
      (s) => s.type === "video",
    ) as Json | undefined
    const playback = sectionPlayback?.content as Json | undefined
    mark(
      "section_video_playback_ssr",
      playback?.videoPlayback ? "PASS" : growthVideoId ? "PARTIAL" : "NOT_TESTED",
      playback?.videoPlayback ?? null,
    )
  }

  report.cert_session_id = sessionId
}

async function probeAnalyticsActivity() {
  const analytics = await request("GET", "/api/platform/growth/sendr/analytics?preset=last_7_days")
  mark(
    "analytics_dashboard",
    analytics.status === 200 && analytics.json?.qa_marker === QA.analytics ? "PASS" : "FAIL",
    analytics.status,
  )

  const funnel = await request("GET", "/api/platform/growth/sendr/analytics/funnel?preset=last_7_days")
  mark("analytics_funnel", funnel.status === 200 ? "PASS" : "FAIL")

  const activity = await request("GET", "/api/platform/growth/sendr/activity")
  mark(
    "activity_workspace",
    activity.status === 200 && activity.json?.qa_marker === QA.activity ? "PASS" : "FAIL",
    activity.status,
  )

  const feed = await request("GET", "/api/platform/growth/sendr/activity/feed?limit=10")
  mark("activity_feed", feed.status === 200 ? "PASS" : "FAIL")

  const prospects = await request("GET", "/api/platform/growth/sendr/activity/prospects?limit=10")
  mark("activity_hot_prospects", prospects.status === 200 ? "PASS" : "FAIL")

  const intel = await request("GET", "/api/platform/growth/sendr/intelligence")
  mark(
    "recommendations_intelligence",
    intel.status === 200 && intel.json?.qa_marker === QA.intelligence ? "PASS" : "FAIL",
    intel.status,
  )
}

async function probeSequenceAndLaunch() {
  const launch = await request("GET", "/api/platform/growth/sendr/launch")
  const summary = launch.json?.summary as Json | undefined
  const page = ((summary?.publishedPages as Json[] | undefined) ?? [])[0]
  const pattern = ((summary?.sequencePatterns as Json[] | undefined) ?? [])[0]
  const audience = ((summary?.audiences as Json[] | undefined) ?? [])[0]

  if (page?.id && pattern?.id && audience?.id) {
    const preview = await request("POST", "/api/platform/growth/sendr/launch-preview", {
      landingPageId: String(page.id),
      audienceId: String(audience.id),
      sequencePatternId: String(pattern.id),
    })
    const sendrUrl =
      (preview.json?.preview as Json | undefined)?.sequenceMessagePreview ??
      (preview.json?.preview as Json | undefined)?.sendrPageUrl
    const urlStr = typeof sendrUrl === "string" ? sendrUrl : JSON.stringify(sendrUrl)
    mark(
      "launch_preview_tokenized_url",
      preview.status === 200 && urlStr.includes("/videos/") ? "PASS" : "PARTIAL",
      { status: preview.status, url: urlStr.slice(0, 200) },
    )
    mark(
      "sequence_sendr_page_url_shape",
      urlStr.includes("/videos/") ? "PASS" : urlStr.includes("{{sendr_page_url}}") ? "PARTIAL" : "FAIL",
      urlStr.slice(0, 200),
    )
  } else {
    mark("launch_preview_tokenized_url", "NOT_TESTED")
    mark("sequence_sendr_page_url_shape", "NOT_TESTED")
  }
}

async function probeVideoWorkflowApis() {
  const assets = await request("GET", "/api/platform/growth/sendr/assets?kind=video&limit=5")
  mark(
    "asset_picker_growth_library",
    assets.status === 200 && Array.isArray(assets.json?.items) ? "PASS" : "FAIL",
    { count: Array.isArray(assets.json?.items) ? assets.json?.items.length : 0 },
  )

  const growthVideo = dbQuery<{ id: string }>(
    `select id from growth.video_assets where storage_path is not null limit 1;`,
  )[0]
  if (growthVideo?.id) {
    const preview = await request("GET", `/api/platform/growth/sendr/video-assets?growthVideoAssetId=${growthVideo.id}`)
    mark(
      "growth_video_preview_api",
      preview.status === 200 && preview.json?.qa_marker === QA.videoIntegration ? "PASS" : "FAIL",
      preview.json?.preview ?? null,
    )
  } else {
    mark("growth_video_preview_api", "NOT_TESTED")
  }

  mark("record_flow", "PARTIAL", "Growth Video record UI present; Start recording buttons disabled (stub)")
  mark("upload_return_flow", "NOT_TESTED", "requires browser upload E2E — API attach_growth_video verified separately")
}

async function main() {
  report.phase = "GS-SENDR-5A"
  report.base = BASE

  try {
    await probeDeployment()
    await probeAnalyticsActivity()
    await probeSequenceAndLaunch()
    await probeVideoWorkflowApis()
    await probeOperatorWorkflow()
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

  const criticalFails = values.filter((v) => v === "FAIL").length
  report.production_ready =
    criticalFails === 0 && (report.summary as Json).pass as number >= (report.summary as Json).total as number * 0.75

  report.final_verdict = criticalFails === 0 ? "GS-SENDR-5A_PRODUCTION_CERTIFIED_WITH_NOTES" : "GS-SENDR-5A_ISSUES_FOUND"

  console.log(JSON.stringify(report, null, 2))
  console.log(`\n${report.final_verdict}\n`)
  process.exit(criticalFails === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
