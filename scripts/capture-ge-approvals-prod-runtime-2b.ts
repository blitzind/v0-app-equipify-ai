/**
 * GE-AIOS-APPROVALS-PAGE-PRODUCTION-RUNTIME-FAILURE-2B — read-only production capture.
 */
import { execSync } from "node:child_process"
import { chromium, type Page, type Response } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "/Users/blitz/Projects/equipify/equipify-app/lib/growth/notifications/growth-notification-cert-bootstrap"
import { mintGrowthPlatformAdminBearerToken } from "/Users/blitz/Projects/equipify/equipify-app/lib/growth/qa/growth-platform-admin-bearer-probe"
import { resolveLinkedSupabaseProjectRef } from "/Users/blitz/Projects/equipify/equipify-app/lib/growth/qa/supabase-cli-linked-project-bootstrap"

const BASE_URL = "https://app.equipify.ai"
const ROUTE = "/growth/os/approvals"

function resolveAnonKey(bootUrl: string): string {
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
    options: { redirectTo: `${BASE_URL}${ROUTE}` },
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
      secure: true,
      sameSite: "Lax" as const,
    })),
  )
  return email
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const apiResponses: Array<{
    url: string
    status: number
    bodySnippet: string
  }> = []

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[console] ${msg.text()}`)
  })
  page.on("pageerror", (error) => {
    pageErrors.push(`[pageerror] ${error.message}\n${error.stack ?? ""}`)
  })
  page.on("response", async (response: Response) => {
    const url = response.url()
    if (
      url.includes("/api/platform/growth/ai-os/approvals") ||
      url.includes("/api/platform/growth/ai-os/command-center") ||
      url.includes("/api/platform/growth/ai-os/bounded-autonomous-outbound") ||
      url.includes("/api/platform/growth/settings/ai-teammate-identity") ||
      url.includes("/_next/data") && url.includes("approvals")
    ) {
      const text = await response.text().catch(() => "")
      apiResponses.push({
        url,
        status: response.status(),
        bodySnippet: text.slice(0, 1200),
      })
    }
  })

  const email = await authenticate(page)
  console.log("authenticated:", email)

  const response = await page.goto(`${BASE_URL}${ROUTE}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  })

  await page.waitForTimeout(10_000)

  const bodyText = await page.locator("body").innerText().catch(() => "")
  const hasRouteError = bodyText.includes("We couldn't load this screen")
  const hasClientError = bodyText.includes("Could not load")
  const vercelId = response?.headers()["x-vercel-id"] ?? null

  console.log("\n=== PAGE ===")
  console.log("url:", `${BASE_URL}${ROUTE}`)
  console.log("http:", response?.status())
  console.log("x-vercel-id:", vercelId)
  console.log("route_error_ui:", hasRouteError)
  console.log("client_error_ui:", hasClientError)
  console.log("body_snippet:", bodyText.slice(0, 800))

  console.log("\n=== API RESPONSES ===")
  for (const row of apiResponses) {
    console.log(JSON.stringify(row, null, 2))
  }

  if (pageErrors.length) {
    console.log("\n=== PAGE ERRORS ===")
    for (const entry of pageErrors) console.log(entry)
  }
  if (consoleErrors.length) {
    console.log("\n=== CONSOLE ERRORS ===")
    for (const entry of consoleErrors.slice(0, 12)) console.log(entry)
  }

  const nextData = await page
    .locator('script[id="__NEXT_DATA__"]')
    .textContent()
    .catch(() => null)
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData) as { props?: { pageProps?: { err?: unknown } } }
      if (parsed.props?.pageProps?.err) {
        console.log("\n=== __NEXT_DATA__ err ===")
        console.log(JSON.stringify(parsed.props.pageProps.err, null, 2))
      }
    } catch {
      // ignore
    }
  }

  await browser.close()
}

void main()
