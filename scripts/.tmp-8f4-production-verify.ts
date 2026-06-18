/**
 * Phase 8F.5 — production verification via Playwright storage state only (temp; not committed).
 *
 * Requires:
 *   GROWTH_CERT_STORAGE_STATE=scripts/.growth-cert-storage-state.json
 *
 * Usage:
 *   GROWTH_CERT_STORAGE_STATE=scripts/.growth-cert-storage-state.json \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/.tmp-8f4-production-verify.ts
 *
 * No Supabase admin APIs. No service-role JWT. No .env.local. No vercel env run.
 */
import fs from "node:fs"
import path from "node:path"
import { chromium, type Page, type Request } from "@playwright/test"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import {
  GROWTH_INBOX_LAZY_PANEL_ACTIVATED_EVENT,
  GROWTH_INBOX_LAZY_PANEL_FETCH_EVENT,
} from "../lib/growth/inbox/growth-inbox-workflow-lazy-instrumentation"

const BASE_URL = (resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai").replace(/\/$/, "")
const COMMIT = "cbdb490b"
const NAV_TIMEOUT_MS = 45_000
const ROUTE_SMOKE_MS = 45_000
const SETTLE_MS = 6_000

const BANNED_INBOX = [
  "campaign-builder",
  "agent-orchestration",
  "sequence-preview",
  "human-interventions",
  "follow-up-policies",
  "conversational-playbooks/generate",
  "realtime-events",
] as const

const CRITICAL_INITIAL_PATHS = [
  "/api/platform/growth/inbox",
  "/api/platform/growth/inbox/dashboard",
  "/api/platform/growth/operator-inbox",
  "/api/growth/workspace/settings/default-views",
] as const

const ALLOWED_IDLE_PATHS = [
  "/api/platform/growth/inbox/sync/dashboard",
  "/api/platform/growth/mailboxes",
  "/api/platform/growth/replies/dashboard",
  "/api/platform/growth/calls/queue",
  "/api/platform/growth/calls/dashboard",
] as const

type CertErrorCode =
  | "auth_setup_failed"
  | "route_timeout"
  | "missing_required_element"

function certError(code: CertErrorCode, detail: string): Error {
  return new Error(`${code}:${detail}`)
}

function resolveStorageStatePath(): string {
  const fromEnv = process.env.GROWTH_CERT_STORAGE_STATE?.trim()
  const candidate = fromEnv || path.join(process.cwd(), "scripts/.growth-cert-storage-state.json")
  if (!fs.existsSync(candidate)) {
    throw certError("auth_setup_failed", `missing_storage_state:${candidate}`)
  }
  return candidate
}

async function authenticateFromStorageState(page: Page, storageStatePath: string) {
  await page.goto("/growth/inbox", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS })
  if (page.url().includes("/login")) {
    throw certError("auth_setup_failed", `storage_state_invalid:${storageStatePath}`)
  }
  return { method: "storage_state", storage_state: storageStatePath }
}

function trackNetwork(page: Page) {
  const platformGrowthRequests: string[] = []
  const growthApiRequests: string[] = []
  const responses: Array<{ url: string; status: number }> = []
  const onReq = (r: Request) => {
    const u = r.url()
    if (u.includes("/api/platform/growth/")) platformGrowthRequests.push(u)
    if (u.includes("/api/growth/")) growthApiRequests.push(u)
  }
  const onRes = (r: { url: () => string; status: () => number }) => {
    const u = r.url()
    if (u.includes("/api/platform/growth/") || u.includes("/api/growth/")) {
      responses.push({ url: u, status: r.status() })
    }
  }
  page.on("request", onReq)
  page.on("response", onRes)
  return {
    snapshot: () => ({
      platformGrowthRequests: [...platformGrowthRequests],
      growthApiRequests: [...growthApiRequests],
      responses: [...responses],
    }),
    reset: () => {
      platformGrowthRequests.length = 0
      growthApiRequests.length = 0
      responses.length = 0
    },
    detach: () => { page.off("request", onReq) },
  }
}

function summarizePaths(urls: string[]) {
  const paths = urls.map((u) => {
    try { return new URL(u).pathname } catch { return u }
  })
  return { count: urls.length, unique: [...new Set(paths)], paths: [...new Set(paths)] }
}

function findBanned(urls: string[]) {
  return BANNED_INBOX.filter((banned) => urls.some((u) => u.includes(banned)))
}

function hasRealtimePolling(urls: string[]) {
  return urls.some((u) => u.includes("realtime-events"))
}

function pathsInclude(urls: string[], fragment: string) {
  return urls.some((u) => u.includes(fragment))
}

async function gotoRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: ROUTE_SMOKE_MS })
  await page.waitForTimeout(SETTLE_MS)
}

async function isActiveQueue(page: Page, label: string) {
  const btn = page.locator("button").filter({ hasText: new RegExp(`^${label}\\b`) }).first()
  await btn.waitFor({ state: "visible", timeout: ROUTE_SMOKE_MS })
  return ((await btn.getAttribute("class")) ?? "").includes("bg-primary")
}

async function main() {
  const storageStatePath = resolveStorageStatePath()
  const consoleErrors: string[] = []

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: BASE_URL,
    storageState: storageStatePath,
  })
  const page = await context.newPage()
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()) })

  const auth = await authenticateFromStorageState(page, storageStatePath)

  const tracker = trackNetwork(page)
  const lazyActivations: string[] = []
  const lazyFetches: Array<{ panelId: string; phase: string }> = []
  await page.exposeFunction("__recordLazyActivation", (panelId: string) => { lazyActivations.push(panelId) })
  await page.exposeFunction("__recordLazyFetch", (panelId: string, phase: string) => {
    lazyFetches.push({ panelId, phase })
  })
  await page.addInitScript(({ activated, fetchEvt }) => {
    document.addEventListener(activated, (e) => {
      const panelId = (e as CustomEvent<{ panelId?: string }>).detail?.panelId
      if (panelId) (window as unknown as { __recordLazyActivation?: (id: string) => void }).__recordLazyActivation?.(panelId)
    })
    document.addEventListener(fetchEvt, (e) => {
      const detail = (e as CustomEvent<{ panelId?: string; phase?: string }>).detail
      if (detail?.panelId && detail?.phase) {
        (window as unknown as { __recordLazyFetch?: (id: string, phase: string) => void }).__recordLazyFetch?.(
          detail.panelId,
          detail.phase,
        )
      }
    })
  }, { activated: GROWTH_INBOX_LAZY_PANEL_ACTIVATED_EVENT, fetchEvt: GROWTH_INBOX_LAZY_PANEL_FETCH_EVENT })

  tracker.reset()
  await gotoRoute(page, "/growth/inbox")
  await page.waitForTimeout(3000)
  const initial3s = tracker.snapshot()
  await page.waitForTimeout(5000)
  const initial8s = tracker.snapshot()

  const initial3sPg = summarizePaths(initial3s.platformGrowthRequests)
  const initial3sGrowth = summarizePaths(initial3s.growthApiRequests)
  const initial8sPg = summarizePaths(initial8s.platformGrowthRequests)
  const initial8sGrowth = summarizePaths(initial8s.growthApiRequests)
  const allInitial8s = [...initial8s.platformGrowthRequests, ...initial8s.growthApiRequests]
  const initial504 = initial8s.responses.filter((r) => r.status === 504)
  const initialBanned = findBanned(allInitial8s)
  const initialRealtime = hasRealtimePolling(initial8s.platformGrowthRequests)
  const queueVisible = await page.getByText(/Thread Queue|Needs Action/i).first().isVisible().catch(() => false)
  const notificationsVisible = await page.getByText(/Operator Notifications/i).first().isVisible().catch(() => false)

  const criticalPresent = CRITICAL_INITIAL_PATHS.map((p) => ({
    path: p,
    seen: pathsInclude([...initial3s.platformGrowthRequests, ...initial3s.growthApiRequests], p),
  }))
  const idleSeen = ALLOWED_IDLE_PATHS.map((p) => ({
    path: p,
    seen: pathsInclude(allInitial8s, p),
  }))

  tracker.reset()
  const threadButtons = page.locator("div").filter({ has: page.getByText(/Thread Queue/i) }).locator("button.rounded-lg.border")
  const threadCount = await threadButtons.count()
  const clickedThread = threadCount > 0
  if (clickedThread) await threadButtons.first().click()
  await page.waitForTimeout(SETTLE_MS)
  const afterSelect = tracker.snapshot()
  const afterSelectPg = summarizePaths(afterSelect.platformGrowthRequests)
  const afterSelectBanned = findBanned(afterSelect.platformGrowthRequests)
  const afterSelect504 = afterSelect.responses.filter((r) => r.status === 504)

  tracker.reset()
  lazyActivations.length = 0
  lazyFetches.length = 0
  await gotoRoute(page, "/growth/inbox/workflow")
  const workflowCollapsed = tracker.snapshot()
  const workflowCollapsedBanned = findBanned(workflowCollapsed.platformGrowthRequests)
  const workflowCollapsedHuman = workflowCollapsed.platformGrowthRequests.filter((u) => u.includes("human-interventions"))

  const humanPanel = page.locator('[data-growth-lazy-panel-id="human-interventions"] button').first()
  await humanPanel.waitFor({ state: "visible", timeout: ROUTE_SMOKE_MS })
  await humanPanel.click()
  await page.waitForTimeout(SETTLE_MS)
  const workflowExpanded = tracker.snapshot()
  const humanFetchStarts = lazyFetches.filter((f) => f.panelId === "human-interventions" && f.phase === "start").length
  const humanFetchCompletes = lazyFetches.filter((f) => f.panelId === "human-interventions" && f.phase === "complete").length

  await humanPanel.click()
  await page.waitForTimeout(1000)
  await humanPanel.click()
  await page.waitForTimeout(3000)
  const humanFetchStartsAfterReexpand = lazyFetches.filter((f) => f.panelId === "human-interventions" && f.phase === "start").length
  const workflow504 = [...workflowCollapsed.responses, ...workflowExpanded.responses].filter((r) => r.status === 504)

  tracker.reset()
  await gotoRoute(page, "/growth/inbox/operations")
  const opsCollapsed = tracker.snapshot()
  const diagnosticsLink = await page.getByRole("link", { name: /Inbox Diagnostics/i }).first().isVisible().catch(() => false)
  const bodyText = (await page.locator("body").textContent()) ?? ""
  const opsPanel = page.locator('[data-growth-lazy-panel-id="inbox-diagnostics"] button').first()
  if (await opsPanel.isVisible().catch(() => false)) await opsPanel.click()
  await page.waitForTimeout(SETTLE_MS)
  const opsExpanded = tracker.snapshot()
  const ops504 = [...opsCollapsed.responses, ...opsExpanded.responses].filter((r) => r.status === 504)

  await gotoRoute(page, "/growth/settings/default-views")
  await gotoRoute(page, "/growth/settings/sidebar-preferences")

  await gotoRoute(page, "/growth/inbox")
  const objections = await isActiveQueue(page, "Objections").catch(() => false)
  await gotoRoute(page, "/growth/inbox?view=high_priority")
  const highPriority = await isActiveQueue(page, "High Priority").catch(() => false)
  await gotoRoute(page, "/growth/calls/workspace")
  const callsOverview = page.url().includes("/growth/calls/workspace") && !page.url().includes("view=operate")
  await gotoRoute(page, "/growth/calls/workspace?view=operate")
  const callsOperate = page.url().includes("view=operate")
  await gotoRoute(page, "/growth/opportunities")
  const pipeline = page.url().includes("/pipeline")
  await gotoRoute(page, "/growth/opportunities/readiness")
  const readiness = page.url().includes("/readiness")
  await gotoRoute(page, "/growth/inbox")
  const collapsed = ((await page.getByRole("navigation", { name: /Growth Engine navigation/i }).getAttribute("class").catch(() => "")) ?? "").includes("w-14")

  const authLockErrors = consoleErrors.filter((e) => e.includes("lock:sb-") || e.includes("stole"))
  const failedFetchErrors = consoleErrors.filter((e) => e.toLowerCase().includes("failed to fetch"))

  console.log(JSON.stringify({
    ok: true,
    commit: COMMIT,
    auth_method: auth.method,
    storage_state: auth.storage_state,
    deployment_url: BASE_URL,
    inbox_initial_request_count: {
      platform_growth_3s: initial3sPg.count,
      platform_growth_8s: initial8sPg.count,
      growth_api_3s: initial3sGrowth.count,
      growth_api_8s: initial8sGrowth.count,
      platform_growth_paths_3s: initial3sPg.paths,
      platform_growth_paths_8s: initial8sPg.paths,
      growth_api_paths_8s: initial8sGrowth.paths,
      critical_present: criticalPresent,
      idle_seen: idleSeen,
    },
    inbox_banned_endpoint_result: {
      banned: initialBanned,
      realtime_polling: initialRealtime,
      s504: initial504.length,
      queue_visible: queueVisible,
      notifications_visible: notificationsVisible,
    },
    thread_select_result: {
      clicked: clickedThread,
      thread_count: threadCount,
      platform_growth_count: afterSelectPg.count,
      paths: afterSelectPg.paths,
      banned: afterSelectBanned,
      s504: afterSelect504.length,
    },
    workflow_lazy_result: {
      collapsed_platform_growth_count: workflowCollapsed.count,
      collapsed_human_interventions: workflowCollapsedHuman.length,
      collapsed_banned: workflowCollapsedBanned,
      expanded_platform_growth_count: workflowExpanded.count,
      human_interventions_fetch_starts: humanFetchStarts,
      human_interventions_fetch_completes: humanFetchCompletes,
      human_interventions_fetch_starts_after_reexpand: humanFetchStartsAfterReexpand,
      lazy_activations: lazyActivations,
      s504: workflow504.length,
    },
    operations_lazy_result: {
      diagnostics_link_visible: diagnosticsLink,
      collapsed_platform_growth_count: opsCollapsed.count,
      expanded_platform_growth_count: opsExpanded.count,
      white_screen: bodyText.trim().length === 0,
      s504: ops504.length,
    },
    settings_consumption_result: {
      ui_confirmed_only: true,
      objections,
      high_priority: highPriority,
      calls_overview: callsOverview,
      calls_operate: callsOperate,
      pipeline,
      readiness,
      collapsed,
    },
    console_network_errors: {
      console_errors: consoleErrors.slice(0, 10),
      auth_lock_errors: authLockErrors.length,
      failed_fetch_errors: failedFetchErrors.length,
      total_504: initial504.length + afterSelect504.length + workflow504.length + ops504.length,
    },
  }, null, 2))

  tracker.detach()
  await browser.close()
}

main().catch((e) => {
  const message = e instanceof Error ? e.message : String(e)
  console.log(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
