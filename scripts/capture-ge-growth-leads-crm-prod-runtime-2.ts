/**
 * GE-GROWTH-LEADS-CRM-PROD-RUNTIME-2 — capture first client render exception for CRM deep link.
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- node -r ./scripts/server-only-shim.cjs --import tsx scripts/capture-ge-growth-leads-crm-prod-runtime-2.ts
 */
import { execSync } from "node:child_process"
import { chromium, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import { mintGrowthPlatformAdminBearerToken } from "../lib/growth/qa/growth-platform-admin-bearer-probe"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const LEAD_ID = "ec176375-8b43-4fa5-b63d-3cfdc8a18461"
const BASE_URL = (
  process.env.CRM_CAPTURE_BASE_URL ??
  resolveGrowthDeployedRuntimeBaseUrl() ??
  "https://app.equipify.ai"
).replace(/\/$/, "")

function resolveAnonKey(bootUrl: string): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()
  if (fromEnv) return fromEnv
  const projectRef =
    resolveLinkedSupabaseProjectRef() ?? bootUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!projectRef) throw new Error("no project ref")
  const raw = execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, {
    encoding: "utf8",
  })
  const anon = (JSON.parse(raw) as Array<{ name: string; api_key: string }>).find(
    (entry) => entry.name === "anon",
  )?.api_key
  if (!anon) throw new Error("no anon key")
  return anon.trim()
}

async function authenticate(page: Page): Promise<string> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) throw new Error("Could not bootstrap production Supabase env")

  const anonKey = resolveAnonKey(boot.url)
  const email = "mike@blitzind.com"
  const minted = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: anonKey,
    admin_email: email,
  })
  if (!minted.access_token) throw new Error(minted.error ?? "mint_failed")

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${BASE_URL}/growth/leads/crm` },
  })
  const hashed = link.data?.properties?.hashed_token
  if (!hashed) throw new Error("generate_link_failed")

  const anon = createClient(boot.url, anonKey, { auth: { persistSession: false } })
  const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: "email" })
  const session = verified.data.session
  if (!session?.access_token || !session.refresh_token) throw new Error("verify_otp_failed")

  const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> =
    []
  const supabase = createServerClient(boot.url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => {
        for (const cookie of cookies) cookiesToSet.push(cookie)
      },
    },
  })
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  const hostname = new URL(BASE_URL).hostname
  await page.context().addCookies(
    cookiesToSet.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: hostname,
      path: "/",
      httpOnly: Boolean(cookie.options?.httpOnly),
      secure: BASE_URL.startsWith("https"),
      sameSite: "Lax" as const,
    })),
  )
  return email
}

async function captureRoute(path: string): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })
  page.on("pageerror", (error) => {
    pageErrors.push(`${error.message}\n${error.stack ?? ""}`)
  })

  const email = await authenticate(page)
  console.log(`Authenticated as ${email}`)

  const response = await page.goto(`${BASE_URL}${path}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  })

  await page.waitForTimeout(8000)

  const bodyText = await page.locator("body").innerText().catch(() => "")
  const hasRouteError = bodyText.includes("We couldn't load this screen")
  const diagnostic = await page.locator("pre").first().textContent().catch(() => null)

  console.log("\n=== ROUTE ===")
  console.log("URL:", `${BASE_URL}${path}`)
  console.log("HTTP:", response?.status())
  console.log("Route error UI:", hasRouteError)
  if (diagnostic) console.log("Diagnostic pre:\n", diagnostic)
  if (pageErrors.length) {
    console.log("\n=== PAGE ERRORS (first) ===")
    console.log(pageErrors[0])
  }
  if (consoleErrors.length) {
    console.log("\n=== CONSOLE ERRORS (first 8) ===")
    for (const entry of consoleErrors.slice(0, 8)) console.log(entry)
  }
  if (!pageErrors.length && !consoleErrors.length && !hasRouteError) {
    console.log("\nPage rendered without captured errors.")
    console.log("Body snippet:", bodyText.slice(0, 500))
  }

  await browser.close()
  if (pageErrors.length || hasRouteError) process.exitCode = 1
}

async function main(): Promise<void> {
  await captureRoute("/growth/leads/crm")
  await captureRoute(`/growth/leads/crm?open=${LEAD_ID}`)
}

void main()
