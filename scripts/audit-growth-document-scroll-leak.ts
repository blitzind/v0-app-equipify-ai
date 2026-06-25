import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright"

const ROUTES = ["/growth/campaigns", "/growth/leads", "/growth/leads/prospect-search"] as const
const BROWSER_FN_SOURCE = fs
  .readFileSync(path.join(process.cwd(), "scripts/audit-growth-document-scroll-leak.browser.js"), "utf8")
  .replace("export function auditGrowthDocumentScrollLeak", "function auditGrowthDocumentScrollLeak")

async function main(): Promise<void> {
  const baseUrl = "https://app.equipify.ai"
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    storageState: "scripts/.growth-cert-storage-state.json",
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()

  for (const route of ROUTES) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 120_000 })
    if (page.url().includes("/login")) {
      throw new Error(`Auth required — redirected to ${page.url()}`)
    }
    await page.waitForSelector("#main-content")
    await page.waitForTimeout(1500)
    const evalSource = `${BROWSER_FN_SOURCE}\nauditGrowthDocumentScrollLeak()`
    const report = await page.evaluate(evalSource)
    console.log(`\n=== ${route} ===`)
    console.log(JSON.stringify(report, null, 2))
  }

  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
