/**
 * Phase 8F.5 — manual login storage-state capture (temp; not committed).
 *
 * Usage:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/.tmp-save-growth-cert-storage-state.ts
 *
 * No Supabase admin APIs. No service-role JWT. No .env.local.
 */
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"
import { chromium } from "@playwright/test"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"

const BASE_URL = (resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai").replace(/\/$/, "")
const OUT_PATH = path.join(process.cwd(), "scripts/.growth-cert-storage-state.json")
const NAV_TIMEOUT_MS = 45_000

function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close()
      resolve()
    })
  })
}

async function isGrowthWorkspaceAuthenticated(page: import("@playwright/test").Page): Promise<boolean> {
  const url = page.url()
  if (url.includes("/login")) return false
  return url.includes("/growth") || url.includes("/dashboard")
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: BASE_URL,
  })
  const page = await context.newPage()

  console.log(`\nOpening ${BASE_URL}/login`)
  console.log("1. Log in manually in the browser window")
  console.log("2. Navigate to /growth (or any Growth workspace page)")
  console.log("3. Press Enter in this terminal to save storage state\n")

  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS })

  let ready = false
  const enterPromise = waitForEnter("Press Enter after login (or wait for auto-detect when /growth loads)… ").then(() => {
    ready = true
  })

  const pollPromise = (async () => {
    const deadline = Date.now() + 10 * 60_000
    let stable = 0
    while (Date.now() < deadline && !ready) {
      if (await isGrowthWorkspaceAuthenticated(page)) {
        stable += 1
        if (stable >= 2) return
      } else {
        stable = 0
      }
      await page.waitForTimeout(1000)
    }
    if (!ready && stable < 2) throw new Error("auth_setup_failed:manual_login_timeout")
  })()

  await Promise.race([enterPromise, pollPromise])

  if (!(await isGrowthWorkspaceAuthenticated(page))) {
    await page.goto("/growth/inbox", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS })
  }
  if (page.url().includes("/login")) {
    throw new Error("auth_setup_failed:not_authenticated_after_manual_login")
  }

  await context.storageState({ path: OUT_PATH })
  console.log(JSON.stringify({
    ok: true,
    saved_to: OUT_PATH,
    final_url: page.url(),
    message: "Storage state saved. Run cert with GROWTH_CERT_STORAGE_STATE=scripts/.growth-cert-storage-state.json",
  }, null, 2))

  await browser.close()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
