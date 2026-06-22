/**
 * GS-SENDR-5B — Production re-certification (temporary, not committed).
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/.tmp-gs-sendr-5b-prod-cert.ts
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import https from "node:https"

const BASE = "https://app.equipify.ai"
const report: Record<string, unknown> = { matrix: {} as Record<string, string>, phase: "GS-SENDR-5B" }
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

function request(
  method: string,
  path: string,
  body?: unknown,
  auth = true,
): Promise<{ status: number; json: Record<string, unknown> | null; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined
    const req = https.request(
      {
        hostname: "app.equipify.ai",
        path,
        method,
        headers: {
          Accept: "application/json",
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
          resolve({ status: res.statusCode ?? 0, json, body: data })
        })
      },
    )
    req.on("error", reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function main() {
  report.base = BASE
  report.local_hotfix_applied = true
  report.prod_deploy_pending = true

  // Analytics / activity (blocked until hotfix deploy)
  for (const [key, path] of [
    ["analytics_dashboard", "/api/platform/growth/sendr/analytics?preset=last_7_days"],
    ["analytics_funnel", "/api/platform/growth/sendr/analytics/funnel?preset=last_7_days"],
    ["analytics_prospects", "/api/platform/growth/sendr/analytics/prospects?preset=last_7_days&limit=5"],
    ["activity_workspace", "/api/platform/growth/sendr/activity"],
    ["activity_feed", "/api/platform/growth/sendr/activity/feed?limit=10"],
    ["activity_hot_prospects", "/api/platform/growth/sendr/activity/prospects?limit=10"],
    ["activity_timeline", "/api/platform/growth/sendr/activity/timeline?preset=last_7_days&limit=10"],
  ] as const) {
    const res = await request("GET", path)
    const message = String(res.json?.message ?? "")
    const pass = res.status === 200 && res.json?.ok === true
    mark(
      key,
      pass ? "PASS" : message.includes("disabled") ? "FAIL" : res.status === 200 ? "PARTIAL" : "FAIL",
      { status: res.status, message: message.slice(0, 80) },
    )
  }

  const intel = await request("GET", "/api/platform/growth/sendr/intelligence")
  mark(
    "recommendations_intelligence",
    intel.status === 200 && intel.json?.ok === true ? "PASS" : "FAIL",
    intel.status,
  )

  // Video library / attach
  const assets = await request("GET", "/api/platform/growth/sendr/assets?kind=video&limit=10")
  const videoLibrary = assets.json?.videoLibrary as Record<string, unknown> | undefined
  const items = (assets.json?.items as Array<Record<string, unknown>> | undefined) ?? []
  mark(
    "video_library_hints",
    assets.status === 200 && videoLibrary != null ? "PASS" : "PARTIAL",
    videoLibrary ?? { note: "videoLibrary hints ship with 5B deploy" },
  )
  mark(
    "video_empty_library_state",
    assets.status === 200 && (videoLibrary?.isEmpty === true || items.filter((i) => i.metadata?.source === "growth_library").length === 0)
      ? "PASS"
      : "PARTIAL",
    { growthCount: videoLibrary?.growthAssetCount, legacyCount: videoLibrary?.legacyMetadataCount },
  )

  const legacyId = items.find((i) => i.metadata?.source === "sendr_metadata")?.id as string | undefined
  if (legacyId) {
    const pageCreate = await request("POST", "/api/platform/growth/sendr/landing-pages", {
      action: "create",
      title: `PV 5B Legacy Attach ${Date.now()}`,
      templateType: "default",
    })
    const pageId = (pageCreate.json?.page as Record<string, unknown> | undefined)?.id as string | undefined
    if (pageId) {
      const badAttach = await request("POST", "/api/platform/growth/sendr/video-assets", {
        action: "attach_growth_video",
        landingPageId: pageId,
        growthVideoAssetId: legacyId,
      })
      mark(
        "legacy_attach_safe_error",
        badAttach.status === 404 || badAttach.status === 400 ? "PASS" : badAttach.status === 500 ? "FAIL" : "PARTIAL",
        { status: badAttach.status, message: badAttach.json?.message },
      )
    } else {
      mark("legacy_attach_safe_error", "NOT_TESTED")
    }
  } else {
    mark("legacy_attach_safe_error", "NOT_TESTED", "no legacy row")
  }

  const growthVideo = dbQuery<{ id: string }>(
    `select id from growth.video_assets where storage_path is not null limit 1;`,
  )[0]
  if (growthVideo?.id) {
    mark("growth_video_attach", "NOT_TESTED", "growth.video_assets present — operator seed done")
  } else {
    mark("growth_video_attach", "NOT_TESTED", "no growth.video_assets — operator upload required")
  }

  // Public runtime
  const pages = dbQuery<{ published_slug: string }>(
    `select published_slug from growth.growth_landing_pages where status='published' and published_slug is not null order by updated_at desc limit 1;`,
  )
  const slug = pages[0]?.published_slug
  if (slug) {
    const anon = await request("GET", `/api/public/sendr/${slug}`, undefined, false)
    mark("public_api_anonymous", anon.status === 200 ? "PASS" : "FAIL", anon.status)

    const lead = dbQuery<{ id: string }>(
      `select id from growth.leads order by updated_at desc limit 1;`,
    )[0]
    if (lead?.id) {
      const leadApi = await request("GET", `/api/public/sendr/${slug}?leadId=${lead.id}`, undefined, false)
      const personalization = (leadApi.json?.page as Record<string, unknown> | undefined)?.personalization
      mark(
        "personalization_leadId",
        leadApi.status === 200 && (personalization as Record<string, unknown>)?.applied === true
          ? "PASS"
          : "PARTIAL",
        personalization,
      )
    }

    const badToken = await request("GET", `/api/public/sendr/${slug}?token=invalid.token.here`, undefined, false)
    const badPers = (badToken.json?.page as Record<string, unknown> | undefined)?.personalization
    mark(
      "invalid_token_fallback",
      badToken.status === 200 && (badPers as Record<string, unknown>)?.applied !== true ? "PASS" : "FAIL",
      badPers,
    )

    const legacy = await request("GET", `/sendr/${slug}`, undefined, false)
    mark(
      "legacy_sendr_redirect",
      legacy.status === 307 && legacy.body.includes("/videos/") ? "PASS" : "PARTIAL",
      legacy.status,
    )
  }

  const obs = await request("GET", "/api/platform/growth/runtime/observability")
  const killSwitches = (obs.json?.snapshot as Record<string, unknown> | undefined)?.killSwitches as
    | Record<string, boolean>
    | undefined
  mark(
    "kill_switch_analytics_in_observability",
    killSwitches?.sendr_analytics_enabled === true ? "PASS" : "FAIL",
    {
      sendr_analytics_enabled: killSwitches?.sendr_analytics_enabled,
      sendr_activity_enabled: killSwitches?.sendr_activity_enabled,
      note: "requires 5B deploy for keys to appear",
    },
  )

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

  console.log(JSON.stringify(report, null, 2))
  process.exit(values.some((v) => v === "FAIL") ? 1 : 0)
}

main().catch((error) => {
  report.fatal_error = error instanceof Error ? error.message : String(error)
  console.log(JSON.stringify(report, null, 2))
  process.exit(1)
})
