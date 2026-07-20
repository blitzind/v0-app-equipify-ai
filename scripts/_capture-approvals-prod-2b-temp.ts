import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { chromium, type Page, type Response } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
import { resolveSupabaseUrlForProjectRef } from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"

const BASE_URL = "https://app.equipify.ai"
const ROUTE = "/growth/os/approvals"

function bootstrapSupabase() {
  const projectRef = readFileSync(resolve(process.cwd(), "supabase/.temp/project-ref"), "utf8").trim()
  const url = resolveSupabaseUrlForProjectRef(projectRef)
  const keysRaw = execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, {
    encoding: "utf8",
  })
  const keys = JSON.parse(keysRaw) as Array<{ name: string; api_key: string }>
  const jwt = keys.find((k) => k.name === "service_role")!.api_key
  const anon = keys.find((k) => k.name === "anon")!.api_key
  return { url, jwt, anon }
}

async function authenticate(page: Page): Promise<string> {
  const { url, jwt, anon: anonKey } = bootstrapSupabase()
  const email = "mike@blitzind.com"
  const minted = await mintGrowthPlatformAdminBearerToken({
    supabase_url: url,
    service_role_key: jwt,
    anon_key: anonKey,
    admin_email: email,
  })
  if (!minted.access_token) throw new Error(minted.error ?? "mint_failed")

  const admin = createClient(url, jwt, { auth: { persistSession: false } })
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${BASE_URL}${ROUTE}` },
  })
  const hashed = link.data?.properties?.hashed_token
  if (!hashed) throw new Error("generate_link_failed")

  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: "email" })
  const session = verified.data.session
  if (!session?.access_token || !session.refresh_token) throw new Error("verify_otp_failed")

  const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> =
    []
  const supabase = createServerClient(url, anonKey, {
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
  const apiResponses: Array<{ url: string; status: number; bodySnippet: string }> = []

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
      url.includes("/api/platform/growth/ai-os/bounded-autonomous-outbound")
    ) {
      const text = await response.text().catch(() => "")
      apiResponses.push({ url, status: response.status(), bodySnippet: text.slice(0, 800) })
    }
  })

  const email = await authenticate(page)
  console.log("authenticated:", email)

  const response = await page.goto(`${BASE_URL}${ROUTE}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  })
  await page.waitForTimeout(12_000)

  const bodyText = await page.locator("body").innerText().catch(() => "")
  const hasRouteError = bodyText.includes("We couldn't load this screen")
  const hasClientError = bodyText.includes("Could not load")

  console.log("\n=== PAGE ===")
  console.log("url:", `${BASE_URL}${ROUTE}`)
  console.log("http:", response?.status())
  console.log("x-vercel-id:", response?.headers()["x-vercel-id"] ?? null)
  console.log("timestamp:", new Date().toISOString())
  console.log("route_error_ui:", hasRouteError)
  console.log("client_error_ui:", hasClientError)
  console.log("body_snippet:", bodyText.slice(0, 1000))

  console.log("\n=== API RESPONSES ===")
  for (const row of apiResponses) console.log(JSON.stringify(row))

  if (pageErrors.length) {
    console.log("\n=== PAGE ERRORS ===")
    for (const entry of pageErrors) console.log(entry)
  }
  if (consoleErrors.length) {
    console.log("\n=== CONSOLE ERRORS ===")
    for (const entry of consoleErrors.slice(0, 20)) console.log(entry)
  }

  await browser.close()
  if (pageErrors.length || hasRouteError) process.exitCode = 1
}

void main()
