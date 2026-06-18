/** Phase 8F.3 — temporary production verification (not committed). */
import { chromium, type Page, type Request } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { execSync } from "node:child_process"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import { getPlatformAdminEmails } from "../lib/platform-admin-policy"
import { mintGrowthPlatformAdminBearerToken } from "../lib/growth/qa/growth-platform-admin-bearer-probe"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"
import {
  getWorkspacePreferencesForUser,
  upsertWorkspacePreferencesForUser,
} from "../lib/growth/settings/growth-workspace-settings-repository"
import {
  GROWTH_INBOX_LAZY_PANEL_ACTIVATED_EVENT,
  GROWTH_INBOX_LAZY_PANEL_FETCH_EVENT,
} from "../lib/growth/inbox/growth-inbox-workflow-lazy-instrumentation"

const BASE_URL = (resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai").replace(/\/$/, "")
const BANNED_INBOX_INITIAL = [
  "campaign-builder",
  "agent-orchestration",
  "sequence-preview",
  "human-interventions",
  "follow-up-policies",
  "conversational-playbooks/generate",
] as const

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

async function resolvePlatformAdminEmail(boot: NonNullable<ReturnType<typeof bootstrapGrowthOperatorNotificationsCertEnv>>): Promise<string> {
  const anonKey = resolveAnonKey(boot.url)
  const email = "mike@blitzind.com"
  const minted = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: anonKey,
    admin_email: email,
  })
  if (minted.access_token) return email
  throw new Error(minted.error ?? "no platform-admin email")
}

async function resolveUserId(boot: NonNullable<ReturnType<typeof bootstrapGrowthOperatorNotificationsCertEnv>>, email: string) {
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { data } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()
  if (data?.id) return data.id as string
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const match = listed.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (match?.id) return match.id
  throw new Error(`user id not found for ${email}`)
}

async function authenticate(page: Page, boot: NonNullable<ReturnType<typeof bootstrapGrowthOperatorNotificationsCertEnv>>) {
  const anonKey = resolveAnonKey(boot.url)
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const email = await resolvePlatformAdminEmail(boot)
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: `${BASE_URL}/growth/inbox` } })
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
  await page.context().addCookies(cookiesToSet.map((c) => ({
    name: c.name, value: c.value, domain: "app.equipify.ai", path: "/",
    httpOnly: Boolean(c.options?.httpOnly), secure: true, sameSite: "Lax" as const,
  })))
  return email
}

function trackPlatformGrowth(page: Page) {
  const requests: string[] = []
  const responses: Array<{ url: string; status: number }> = []
  const onReq = (r: Request) => {
    const u = r.url()
    if (u.includes("/api/platform/growth/")) requests.push(u)
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
    snapshot: () => ({ requests: [...requests], responses: [...responses] }),
    reset: () => { requests.length = 0; responses.length = 0 },
    detach: () => { page.off("request", onReq) },
  }
}

function summarizePaths(urls: string[]) {
  const paths = urls.map((u) => {
    try { return new URL(u).pathname } catch { return u }
  })
  const unique = [...new Set(paths)]
  return { count: urls.length, unique: unique.length, paths: unique }
}

function findBanned(urls: string[]) {
  return BANNED_INBOX_INITIAL.filter((banned) => urls.some((u) => u.includes(banned)))
}

async function isActiveQueue(page: Page, label: string) {
  const btn = page.locator("button").filter({ hasText: new RegExp(`^${label}\\b`) }).first()
  await btn.waitFor({ state: "visible", timeout: 60_000 })
  return ((await btn.getAttribute("class")) ?? "").includes("bg-primary")
}

async function main() {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) { console.log(JSON.stringify({ ok: false, error: "bootstrap" })); process.exit(1) }

  const consoleErrors: string[] = []
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: BASE_URL })
  const page = await context.newPage()
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()) })

  const email = await authenticate(page, boot)
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const userId = await resolveUserId(boot, email)
  const beforePrefs = await getWorkspacePreferencesForUser(admin, userId)
  await upsertWorkspacePreferencesForUser(admin, userId, {
    inboxDefaultFilter: "objections",
    callsDefaultView: "overview",
    opportunitiesDefaultTab: "pipeline",
    sidebarCollapsed: true,
  })

  const tracker = trackPlatformGrowth(page)
  const lazyActivations: string[] = []
  const lazyFetches: Array<{ panelId: string; phase: string }> = []
  await page.exposeFunction("__recordLazyActivation", (panelId: string) => { lazyActivations.push(panelId) })
  await page.exposeFunction("__recordLazyFetch", (panelId: string, phase: string) => { lazyFetches.push({ panelId, phase }) })
  await page.addInitScript(({ activated, fetchEvt }) => {
    document.addEventListener(activated, (e) => {
      const panelId = (e as CustomEvent<{ panelId?: string }>).detail?.panelId
      if (panelId) (window as unknown as { __recordLazyActivation?: (id: string) => void }).__recordLazyActivation?.(panelId)
    })
    document.addEventListener(fetchEvt, (e) => {
      const detail = (e as CustomEvent<{ panelId?: string; phase?: string }>).detail
      if (detail?.panelId && detail?.phase) {
        (window as unknown as { __recordLazyFetch?: (id: string, phase: string) => void }).__recordLazyFetch?.(detail.panelId, detail.phase)
      }
    })
  }, { activated: GROWTH_INBOX_LAZY_PANEL_ACTIVATED_EVENT, fetchEvt: GROWTH_INBOX_LAZY_PANEL_FETCH_EVENT })

  await page.goto("/growth/inbox", { waitUntil: "domcontentloaded", timeout: 120_000 })
  await page.waitForTimeout(6000)
  const initial = tracker.snapshot()
  const initialSummary = summarizePaths(initial.requests)
  const initial504 = initial.responses.filter((r) => r.status === 504)
  const initialBanned = findBanned(initial.requests)
  const queueVisible = await page.getByText(/Thread Queue|Needs Action/i).first().isVisible().catch(() => false)
  const notificationsVisible = await page.getByText(/Operator Notifications/i).first().isVisible().catch(() => false)

  tracker.reset()
  const firstThread = page.locator("[data-thread-id], [data-inbox-thread-id], button").filter({ hasText: /@|\.com/i }).first()
  const hasThread = await firstThread.isVisible({ timeout: 5000 }).catch(() => false)
  if (hasThread) await firstThread.click()
  await page.waitForTimeout(5000)
  const afterSelect = tracker.snapshot()
  const afterSelectSummary = summarizePaths(afterSelect.requests)
  const afterSelectBanned = findBanned(afterSelect.requests)

  tracker.reset()
  lazyActivations.length = 0
  lazyFetches.length = 0
  await page.goto("/growth/inbox/workflow", { waitUntil: "domcontentloaded", timeout: 120_000 })
  await page.waitForTimeout(4000)
  const workflowCollapsed = tracker.snapshot()
  const workflowCollapsedBanned = findBanned(workflowCollapsed.requests)

  const humanPanel = page.locator('[data-growth-lazy-panel-id="human-interventions"] button').first()
  await humanPanel.click()
  await page.waitForTimeout(5000)
  const workflowExpanded = tracker.snapshot()
  const humanFetchStarts = lazyFetches.filter((f) => f.panelId === "human-interventions" && f.phase === "start").length
  const humanFetchCompletes = lazyFetches.filter((f) => f.panelId === "human-interventions" && f.phase === "complete").length

  await humanPanel.click()
  await page.waitForTimeout(1000)
  await humanPanel.click()
  await page.waitForTimeout(3000)
  const humanFetchStartsAfterReexpand = lazyFetches.filter((f) => f.panelId === "human-interventions" && f.phase === "start").length

  tracker.reset()
  await page.goto("/growth/inbox/operations", { waitUntil: "domcontentloaded", timeout: 120_000 })
  await page.waitForTimeout(3000)
  const opsCollapsed = tracker.snapshot()
  const diagnosticsLink = await page.getByRole("link", { name: /Inbox Diagnostics/i }).first().isVisible().catch(() => false)
  const opsPanel = page.locator('[data-growth-lazy-panel-id="inbox-diagnostics"] button').first()
  if (await opsPanel.isVisible().catch(() => false)) await opsPanel.click()
  await page.waitForTimeout(4000)
  const opsExpanded = tracker.snapshot()

  const goto = async (path: string) => {
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: 120_000 })
    await page.waitForTimeout(4000)
  }
  await goto("/growth/inbox")
  const objections = await isActiveQueue(page, "Objections")
  await goto("/growth/inbox?view=high_priority")
  const highPriority = await isActiveQueue(page, "High Priority")
  await goto("/growth/calls/workspace")
  const callsOverview = page.url().includes("/growth/calls/workspace") && !page.url().includes("view=operate")
  await goto("/growth/calls/workspace?view=operate")
  const callsOperate = page.url().includes("view=operate")
  await goto("/growth/opportunities")
  const pipeline = page.url().includes("/pipeline")
  await goto("/growth/opportunities/readiness")
  const readiness = page.url().includes("/readiness")
  await goto("/growth/inbox")
  const collapsed = ((await page.getByRole("navigation", { name: /Growth Engine navigation/i }).getAttribute("class").catch(() => "")) ?? "").includes("w-14")

  await upsertWorkspacePreferencesForUser(admin, userId, {
    inboxDefaultFilter: beforePrefs?.inboxDefaultFilter ?? "all",
    callsDefaultView: beforePrefs?.callsDefaultView ?? "workspace",
    opportunitiesDefaultTab: beforePrefs?.opportunitiesDefaultTab ?? "overview",
    sidebarCollapsed: beforePrefs?.sidebarCollapsed ?? false,
  })

  const authLockErrors = consoleErrors.filter((e) => e.includes("lock:sb-") || e.includes("stole"))
  const failedFetchErrors = consoleErrors.filter((e) => e.toLowerCase().includes("failed to fetch"))

  console.log(JSON.stringify({
    ok: true,
    commit: "cbdb490b",
    email,
    deployment_url: BASE_URL,
    inbox_initial: {
      platform_growth_count: initialSummary.count,
      unique_paths: initialSummary.paths,
      banned: initialBanned,
      s504: initial504.length,
      queue_visible: queueVisible,
      notifications_visible: notificationsVisible,
    },
    thread_select: {
      platform_growth_count: afterSelectSummary.count,
      unique_paths: afterSelectSummary.paths,
      banned: afterSelectBanned,
      clicked: hasThread,
    },
    workflow_lazy: {
      collapsed_platform_growth_count: workflowCollapsed.count,
      collapsed_banned: workflowCollapsedBanned,
      expanded_platform_growth_count: workflowExpanded.count,
      human_interventions_fetch_starts: humanFetchStarts,
      human_interventions_fetch_completes: humanFetchCompletes,
      human_interventions_fetch_starts_after_reexpand: humanFetchStartsAfterReexpand,
      lazy_activations: lazyActivations,
    },
    operations_lazy: {
      diagnostics_link_visible: diagnosticsLink,
      collapsed_platform_growth_count: opsCollapsed.count,
      expanded_platform_growth_count: opsExpanded.count,
      white_screen: !(await page.locator("body").textContent()).trim().length,
    },
    settings_consumption: {
      objections,
      high_priority: highPriority,
      calls_overview: callsOverview,
      calls_operate: callsOperate,
      pipeline,
      readiness,
      collapsed,
    },
    console_errors: consoleErrors.slice(0, 10),
    auth_lock_errors: authLockErrors.length,
    failed_fetch_errors: failedFetchErrors.length,
  }, null, 2))

  tracker.detach()
  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
