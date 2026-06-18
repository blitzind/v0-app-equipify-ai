/**
 * Phase 8N-B — authenticated browser inbox certification (temp; not committed).
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=https://byyfylkklbxcdofaspye.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY="$(supabase projects api-keys --project-ref byyfylkklbxcdofaspye -o json | node -e '...')" \
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/.tmp-8n-b-inbox-browser-cert.ts
 */
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { chromium, type Page, type Request } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"
import { mintGrowthPlatformAdminBearerToken } from "../lib/growth/qa/growth-platform-admin-bearer-probe"
import { GROWTH_INBOX_TIER3_ON_DEMAND_ROUTES } from "../lib/growth/inbox/growth-inbox-minimal-runtime-contract"

const BASE_URL = (resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai").replace(/\/$/, "")
const STORAGE_STATE_PATH = path.join(process.cwd(), "scripts/.growth-cert-storage-state.json")
const NAV_TIMEOUT_MS = 120_000
const POLL_OBSERVE_MS = 195_000
const SETTLE_MS = 6_000

const ALLOWED_INITIAL = [
  "/api/platform/growth/inbox/dashboard",
  "/api/platform/growth/operator-inbox",
  "/api/growth/workspace/settings/default-views",
] as const

const OPTIONAL_INITIAL = ["/api/platform/growth/inbox"] as const

const BANNED_INITIAL = [
  "realtime-events",
  "inbox/sync/dashboard",
  "campaign-builder",
  "sequence-preview",
  "agent-orchestration",
  "human-interventions",
  "revenue-execution",
  "booking-intelligence",
  "opportunities/dashboard",
  "conversational-playbooks/generate",
  "follow-up-policies",
] as const

const TIER3_FRAGMENTS = [
  "forecast-evidence",
  "execution-plan",
  "sequence-exit-candidates",
  "booking-intelligence",
  "opportunities/dashboard",
  "revenue-execution/command-center",
  "conversational-playbooks",
  "follow-up-policies",
] as const

const SELECTED_THREAD_ALLOWED = [
  "/api/platform/growth/inbox/thread/",
  "/api/platform/growth/leads/",
  "/api/platform/growth/replies/timeline",
  "/api/platform/growth/lead-memory/profile/",
  "/api/platform/growth/replies/copilot",
  "/api/platform/growth/replies/workflow-actions",
] as const

type TimedRequest = { url: string; at: number }

function resolveAnonKey(bootUrl: string): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()
  if (fromEnv) return fromEnv
  const projectRef = resolveLinkedSupabaseProjectRef() ?? bootUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!projectRef) throw new Error("no project ref")
  const raw = execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, { encoding: "utf8" })
  const anon = (JSON.parse(raw) as Array<{ name: string; api_key: string }>).find((e) => e.name === "anon")?.api_key
  if (!anon) throw new Error("no anon key")
  return anon.trim()
}

async function authenticate(page: Page, boot: NonNullable<ReturnType<typeof bootstrapGrowthOperatorNotificationsCertEnv>>) {
  const anonKey = resolveAnonKey(boot.url)
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const email = "mike@blitzind.com"
  const minted = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: anonKey,
    admin_email: email,
  })
  if (!minted.access_token) throw new Error(minted.error ?? "platform_admin_mint_failed")

  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${BASE_URL}/growth/inbox` },
  })
  const hashed = link.data?.properties?.hashed_token
  if (!hashed) throw new Error("generate_link_failed")

  const anon = createClient(boot.url, anonKey, { auth: { persistSession: false } })
  const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: "email" })
  const session = verified.data.session
  if (!session?.access_token || !session.refresh_token) throw new Error("verify_otp_failed")

  const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []
  const supabase = createServerClient(boot.url, anonKey, {
    cookies: { getAll: () => [], setAll: (c) => { for (const x of c) cookiesToSet.push(x) } },
  })
  await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
  await page.context().addCookies(
    cookiesToSet.map((c) => ({
      name: c.name,
      value: c.value,
      domain: "app.equipify.ai",
      path: "/",
      httpOnly: Boolean(c.options?.httpOnly),
      secure: true,
      sameSite: "Lax" as const,
    })),
  )
  return { email, method: "magiclink_supabase_admin" as const }
}

function trackNetwork(page: Page) {
  const platformGrowth: TimedRequest[] = []
  const growthApi: TimedRequest[] = []
  const responses: Array<{ url: string; status: number; at: number }> = []
  const onReq = (r: Request) => {
    const u = r.url()
    const at = Date.now()
    if (u.includes("/api/platform/growth/")) platformGrowth.push({ url: u, at })
    if (u.includes("/api/growth/")) growthApi.push({ url: u, at })
  }
  const onRes = (r: { url: () => string; status: () => number }) => {
    const u = r.url()
    if (u.includes("/api/platform/growth/") || u.includes("/api/growth/")) {
      responses.push({ url: u, status: r.status(), at: Date.now() })
    }
  }
  page.on("request", onReq)
  page.on("response", onRes)
  return {
    snapshot: () => ({
      platformGrowth: [...platformGrowth],
      growthApi: [...growthApi],
      responses: [...responses],
    }),
    reset: () => {
      platformGrowth.length = 0
      growthApi.length = 0
      responses.length = 0
    },
    detach: () => {
      page.off("request", onReq)
    },
  }
}

function pathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function pathsFrom(requests: TimedRequest[]): string[] {
  return [...new Set(requests.map((r) => pathname(r.url)))]
}

function urlsMatching(requests: TimedRequest[], fragment: string): TimedRequest[] {
  return requests.filter((r) => r.url.includes(fragment))
}

function analyzePollCycles(requests: TimedRequest[], fragment: string) {
  const hits = urlsMatching(requests, fragment).sort((a, b) => a.at - b.at)
  const intervals = hits.slice(1).map((h, i) => h.at - hits[i]!.at)
  return {
    count: hits.length,
    timestamps: hits.map((h) => new Date(h.at).toISOString()),
    intervalsMs: intervals,
    urls: hits.map((h) => h.url),
  }
}

async function main() {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ ok: false, error: "supabase_bootstrap_failed" }, null, 2))
    process.exit(1)
  }

  const consoleErrors: string[] = []
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: BASE_URL })
  const page = await context.newPage()
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text())
  })
  page.on("pageerror", (e) => consoleErrors.push(String(e)))

  const auth = await authenticate(page, boot)
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true })
  await context.storageState({ path: STORAGE_STATE_PATH })

  const tracker = trackNetwork(page)

  const loadStart = Date.now()
  await page.goto("/growth/inbox", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS })
  await page.waitForTimeout(SETTLE_MS)
  const loadMs = Date.now() - loadStart

  if (page.url().includes("/login")) {
    throw new Error("auth_setup_failed:redirected_to_login")
  }

  const initial = tracker.snapshot()
  const initialAll = [...initial.platformGrowth, ...initial.growthApi]
  const initialPaths = pathsFrom(initialAll)
  const initialFailures = initial.responses.filter((r) => r.status >= 500)
  const operatorInboxUrls = urlsMatching(initial.platformGrowth, "operator-inbox")
  const compactUsed = operatorInboxUrls.some((r) => r.url.includes("mode=compact"))
  const fullUsed = operatorInboxUrls.some((r) => r.url.includes("mode=full"))
  const listInboxUsed = initialPaths.some((p) => p === "/api/platform/growth/inbox")
  const bannedInitial = BANNED_INITIAL.filter((b) => initialAll.some((r) => r.url.includes(b)))
  const tier3EagerInitial = TIER3_FRAGMENTS.filter((b) => initialAll.some((r) => r.url.includes(b)))
  const allowedInitialPresent = ALLOWED_INITIAL.map((p) => ({
    path: p,
    seen: initialAll.some((r) => pathname(r.url).startsWith(p) || r.url.includes(p)),
  }))

  const notificationsVisible = await page.getByText(/Operator Notifications/i).first().isVisible().catch(() => false)
  const queueVisible = await page.getByText(/Thread Queue|Needs Action/i).first().isVisible().catch(() => false)

  tracker.reset()
  const pollStart = Date.now()
  await page.waitForTimeout(POLL_OBSERVE_MS)
  const pollWindow = tracker.snapshot()
  const pollAll = [...pollWindow.platformGrowth, ...pollWindow.growthApi]
  const pollFailures = pollWindow.responses.filter((r) => r.status >= 500)
  const pollBanned = BANNED_INITIAL.filter((b) => pollAll.some((r) => r.url.includes(b)))
  const pollRealtime = pollAll.some((r) => r.url.includes("realtime-events"))
  const pollSync = pollAll.some((r) => r.url.includes("inbox/sync/dashboard"))
  const pollDiagnostics = pollAll.some((r) => r.url.includes("runtime-diagnostics"))
  const operatorPoll = analyzePollCycles(pollAll, "operator-inbox")
  const dashboardPoll = analyzePollCycles(pollAll, "inbox/dashboard")
  const pollCompactOnly = urlsMatching(pollAll, "operator-inbox").every((r) => r.url.includes("mode=compact"))
  const pollFullAny = urlsMatching(pollAll, "operator-inbox").some((r) => r.url.includes("mode=full"))

  tracker.reset()
  const threadBtn = page.locator("button.rounded-lg.border").filter({ hasText: /.+/ }).first()
  const threadCount = await page.locator("button.rounded-lg.border").count()
  let clickedThread = false
  if (threadCount > 0) {
    await threadBtn.click().catch(() => {})
    clickedThread = true
  }
  await page.waitForTimeout(SETTLE_MS)
  const afterThread = tracker.snapshot()
  const afterAll = [...afterThread.platformGrowth, ...afterThread.growthApi]
  const afterPaths = pathsFrom(afterAll)
  const selectedAllowed = SELECTED_THREAD_ALLOWED.map((p) => ({
    fragment: p,
    seen: afterAll.some((r) => r.url.includes(p)),
  }))
  const tier3AfterSelect = TIER3_FRAGMENTS.filter((b) => afterAll.some((r) => r.url.includes(b)))
  const afterFailures = afterThread.responses.filter((r) => r.status >= 500)

  tracker.reset()
  let tier3FirstLoadPaths: string[] = []
  let tier3ReopenPaths: string[] = []
  let tier3RefreshPaths: string[] = []
  const loadIntelBtn = page.getByRole("button", { name: /Load intelligence/i }).first()
  const hasLoadIntel = await loadIntelBtn.isVisible({ timeout: 5000 }).catch(() => false)
  if (hasLoadIntel) {
    await loadIntelBtn.click()
    await page.waitForTimeout(4000)
    tier3FirstLoadPaths = pathsFrom([...tracker.snapshot().platformGrowth, ...tracker.snapshot().growthApi])
    tracker.reset()
    await page.waitForTimeout(2000)
    tier3ReopenPaths = pathsFrom([...tracker.snapshot().platformGrowth, ...tracker.snapshot().growthApi])
    const refreshBtn = page.getByRole("button", { name: /^Refresh$/i }).first()
    if (await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await refreshBtn.click()
      await page.waitForTimeout(4000)
      tier3RefreshPaths = pathsFrom([...tracker.snapshot().platformGrowth, ...tracker.snapshot().growthApi])
    }
  }

  const authLockErrors = consoleErrors.filter((e) => e.includes("lock:sb-") || e.includes("stole"))
  const failedFetchErrors = consoleErrors.filter((e) => e.toLowerCase().includes("failed to fetch"))
  const supabaseErrors = consoleErrors.filter((e) => /supabase|auth.*timeout|oauth/i.test(e))

  const blockers: string[] = []
  if (initialFailures.some((r) => r.status === 504)) blockers.push("initial_504")
  if (pollFailures.some((r) => r.status >= 500)) blockers.push("poll_500")
  if (fullUsed) blockers.push("operator_inbox_full_on_initial")
  if (pollFullAny) blockers.push("operator_inbox_full_on_poll")
  if (bannedInitial.length > 0) blockers.push(`banned_initial:${bannedInitial.join(",")}`)
  if (tier3EagerInitial.length > 0) blockers.push(`tier3_eager_initial:${tier3EagerInitial.join(",")}`)
  if (pollRealtime) blockers.push("realtime_poll")
  if (!compactUsed && operatorInboxUrls.length > 0) blockers.push("compact_mode_not_used")
  if (allowedInitialPresent.filter((a) => a.path.includes("dashboard") || a.path.includes("operator-inbox")).some((a) => !a.seen)) {
    blockers.push("missing_critical_initial_routes")
  }

  let goLive: "READY" | "READY_WITH_MINOR_RISKS" | "NOT_READY" = "READY"
  if (blockers.length > 0) goLive = "NOT_READY"
  else if (listInboxUsed || tier3AfterSelect.length > 0 || consoleErrors.length > 0) goLive = "READY_WITH_MINOR_RISKS"

  console.log(
    JSON.stringify(
      {
        ok: blockers.length === 0,
        deployment_url: BASE_URL,
        deployment_id: "dpl_7CfhwMGbQRa8gyq2rKUk7CVUP7Wi",
        commit: "98ee9105",
        auth: {
          method: auth.method,
          email: auth.email,
          storage_state_saved: STORAGE_STATE_PATH,
          storage_state_valid: !page.url().includes("/login"),
        },
        initial_inbox: {
          load_ms: loadMs,
          page_url: page.url(),
          platform_growth_count: initial.platformGrowth.length,
          growth_api_count: initial.growthApi.length,
          unique_paths: initialPaths,
          allowed_initial_present: allowedInitialPresent,
          list_inbox_used: listInboxUsed,
          operator_inbox_urls: operatorInboxUrls.map((r) => r.url),
          compact_mode_used: compactUsed,
          full_mode_used: fullUsed,
          banned_initial: bannedInitial,
          tier3_eager_initial: tier3EagerInitial,
          failures: initialFailures,
          queue_visible: queueVisible,
          notifications_visible: notificationsVisible,
        },
        polling: {
          observe_ms: POLL_OBSERVE_MS,
          elapsed_ms: Date.now() - pollStart,
          operator_inbox: operatorPoll,
          inbox_dashboard: dashboardPoll,
          compact_only: pollCompactOnly,
          full_mode_any: pollFullAny,
          banned_routes: pollBanned,
          realtime_events: pollRealtime,
          sync_dashboard: pollSync,
          runtime_diagnostics: pollDiagnostics,
          failures: pollFailures,
        },
        thread_selection: {
          clicked: clickedThread,
          thread_count: threadCount,
          paths_after_select: afterPaths,
          selected_allowed: selectedAllowed,
          tier3_auto_loaded: tier3AfterSelect,
          failures: afterFailures,
        },
        tier3_on_demand: {
          load_intelligence_clicked: hasLoadIntel,
          first_load_paths: tier3FirstLoadPaths,
          reopen_paths: tier3ReopenPaths,
          refresh_paths: tier3RefreshPaths,
          cache_hit_on_reopen: tier3ReopenPaths.length === 0,
          refresh_fired: tier3RefreshPaths.length > 0,
          flagged_tier3_eager_initial: tier3EagerInitial.length,
          tier3_on_demand_route_inventory: [...GROWTH_INBOX_TIER3_ON_DEMAND_ROUTES],
        },
        console_network: {
          console_errors: consoleErrors.slice(0, 15),
          auth_lock_errors: authLockErrors.length,
          failed_fetch_errors: failedFetchErrors.length,
          supabase_auth_errors: supabaseErrors.length,
        },
        go_live: goLive,
        blockers,
      },
      null,
      2,
    ),
  )

  tracker.detach()
  await browser.close()
  if (goLive === "NOT_READY") process.exit(1)
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }, null, 2))
  process.exit(1)
})
