/**
 * AVA-GROWTH-HOME-RENDER-HOTFIX-1A — capture production /growth render errors.
 */
import { execSync } from "node:child_process"
import { chromium, type Response } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
import { resolveLinkedSupabaseProjectRef } from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"

const BASE_URL = "https://app.equipify.ai"
const ROUTE = "/growth"

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

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const pageErrors: string[] = []
  const apiStatuses: Array<{ path: string; status: number }> = []

  page.on("pageerror", (error) => {
    pageErrors.push(`${error.message}\n${error.stack ?? ""}`)
  })
  page.on("response", (response: Response) => {
    const url = response.url()
    if (!url.includes("/api/")) return
    const path = url.replace(BASE_URL, "").replace(/\?.*$/, "")
    if (
      path.includes("workspace-summary") ||
      path.includes("ai-teammate") ||
      path.includes("growth/home")
    ) {
      apiStatuses.push({ path, status: response.status() })
    }
  })

  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) throw new Error("bootstrap failed")
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

  const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []
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

  await page.context().addCookies(
    cookiesToSet.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: new URL(BASE_URL).hostname,
      path: "/",
      httpOnly: Boolean(cookie.options?.httpOnly),
      secure: true,
      sameSite: "Lax" as const,
    })),
  )

  await page.goto(`${BASE_URL}${ROUTE}`, { waitUntil: "networkidle", timeout: 120_000 })
  await page.waitForTimeout(8_000)

  const bodyText = await page.locator("body").innerText()
  console.log("route_error:", bodyText.includes("We couldn't load this screen"))
  console.log("dashboard_marker:", bodyText.includes("Growth") || bodyText.includes("Ava"))
  console.log("\n=== API ===")
  for (const row of apiStatuses) console.log(row.path, row.status)
  console.log("\n=== PAGE ERRORS ===")
  if (pageErrors.length === 0) console.log("(none)")
  for (const err of pageErrors) console.log(err)

  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
