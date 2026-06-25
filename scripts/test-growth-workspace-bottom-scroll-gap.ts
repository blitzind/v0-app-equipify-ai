/**
 * Regression — Growth workspace bottom scroll gap (rendered layout, not class strings).
 *
 * Run: pnpm test:growth-workspace-bottom-scroll-gap
 * Live (optional): GROWTH_WORKSPACE_BOTTOM_GAP_URL=https://app.equipify.ai pnpm test:growth-workspace-bottom-scroll-gap
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { chromium, type Page } from "playwright"

export const GROWTH_WORKSPACE_BOTTOM_SCROLL_GAP_QA_MARKER = "growth-workspace-bottom-scroll-gap-v1" as const

const ROUTES = ["/growth/campaigns", "/growth/leads", "/growth/leads/prospect-search"] as const
const MAX_MAIN_BOTTOM_GAP_PX = 32
const MAX_DOCUMENT_SCROLL_LEAK_PX = 2

const MEASURE_FN_SOURCE = fs
  .readFileSync(path.join(process.cwd(), "scripts/test-growth-workspace-bottom-scroll-gap.browser.js"), "utf8")
  .replace("export function measureGrowthWorkspaceBottomScrollGap", "function measureGrowthWorkspaceBottomScrollGap")

const STORAGE_CANDIDATES = [
  path.join(process.cwd(), "scripts/.growth-cert-storage-state.json"),
  path.join(process.cwd(), "e2e/screenshots/.auth/user.json"),
]

function resolveStorageStatePath(): string | null {
  for (const candidate of STORAGE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

async function measurePage(page: Page) {
  return page.evaluate(`${MEASURE_FN_SOURCE}\nmeasureGrowthWorkspaceBottomScrollGap()`)
}

async function assertSrOnlyFixture(page: Page): Promise<void> {
  await page.setContent(`<!doctype html>
<html lang="en" class="h-full">
<head>
<style>
  html, body { margin: 0; height: 100%; }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
  html:has([data-qa-marker="growth-workspace-shell-v2"]) { overflow: hidden; }
  [data-qa-marker="growth-workspace-shell-v2"] #main-content section { position: relative; }
  #main-content { overflow-y: auto; height: 320px; background: #111; }
  section { margin-bottom: 24px; padding: 16px; background: #222; color: #fff; }
  .spacer { height: 900px; }
</style>
</head>
<body class="h-full">
  <div data-qa-marker="growth-workspace-shell-v2" class="h-full">
    <main id="main-content">
      <div class="px-3 pb-6">
      <section aria-labelledby="s1"><h2 id="s1" class="sr-only">One</h2><div class="spacer">A</div></section>
      <section aria-labelledby="s2"><h2 id="s2" class="sr-only">Two</h2><div class="spacer">B</div></section>
      <section aria-labelledby="s3"><h2 id="s3" class="sr-only">Three</h2><div>Last</div></section>
      </div>
    </main>
  </div>
</body>
</html>`)

  const main = page.locator("#main-content")
  await main.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })

  const metrics = await measurePage(page)
  assert.ok(
    metrics.documentScrollLeakPx <= MAX_DOCUMENT_SCROLL_LEAK_PX,
    `fixture document scroll leak ${metrics.documentScrollLeakPx}px (expected <= ${MAX_DOCUMENT_SCROLL_LEAK_PX})`,
  )
  assert.ok(
    metrics.mainBottomGapPx != null && metrics.mainBottomGapPx <= MAX_MAIN_BOTTOM_GAP_PX,
    `fixture main bottom gap ${metrics.mainBottomGapPx}px (expected <= ${MAX_MAIN_BOTTOM_GAP_PX})`,
  )
}

async function assertLiveRoutes(page: Page, baseUrl: string): Promise<void> {
  for (const route of ROUTES) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 120_000 })
    if (page.url().includes("/login")) {
      throw new Error(`Auth required for live bottom-gap test — redirected to ${page.url()}`)
    }
    await page.waitForSelector("#main-content", { timeout: 60_000 })
    await page.waitForTimeout(1200)

    const metrics = await measurePage(page)
    assert.ok(
      metrics.documentScrollLeakPx <= MAX_DOCUMENT_SCROLL_LEAK_PX,
      `${route} document scroll leak ${metrics.documentScrollLeakPx}px (doc=${metrics.documentScrollHeight}, body=${metrics.bodyClientHeight})`,
    )
    assert.ok(
      metrics.mainBottomGapPx != null && metrics.mainBottomGapPx <= MAX_MAIN_BOTTOM_GAP_PX,
      `${route} main bottom gap ${metrics.mainBottomGapPx}px (main scrollHeight=${metrics.mainScrollHeight})`,
    )
  }
}

function assertGlobalsContainmentRules(): void {
  const globals = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8")
  assert.match(
    globals,
    /html:has\(\[data-qa-marker="growth-workspace-shell-v2"\]\)\s*\{\s*overflow:\s*hidden;/,
    "globals.css must clip phantom document scroll on Growth workspace shell",
  )
  assert.match(
    globals,
    /\[data-qa-marker="growth-workspace-shell-v2"\]\s+#main-content\s+section\s*\{\s*position:\s*relative;/,
    "globals.css must contain sr-only section headings inside positioned sections",
  )
}

async function main(): Promise<void> {
  console.log(`\n=== Growth workspace bottom scroll gap (${GROWTH_WORKSPACE_BOTTOM_SCROLL_GAP_QA_MARKER}) ===\n`)

  assertGlobalsContainmentRules()
  console.log("PASS — globals.css Growth scroll containment rules")

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await assertSrOnlyFixture(page)
  console.log("PASS — sr-only section fixture (rendered scrollHeight relationship)")

  const storageStatePath = resolveStorageStatePath()
  const baseUrl = (process.env.GROWTH_WORKSPACE_BOTTOM_GAP_URL ?? "").replace(/\/$/, "")
  if (storageStatePath && baseUrl) {
    await page.context().close()
    const context = await browser.newContext({
      storageState: storageStatePath,
      viewport: { width: 390, height: 844 },
    })
    const livePage = await context.newPage()
    await assertLiveRoutes(livePage, baseUrl)
    await context.close()
    console.log(`PASS — live routes at ${baseUrl} (mobile viewport)`)
  } else {
    console.log("SKIP — live route audit (set GROWTH_WORKSPACE_BOTTOM_GAP_URL + auth storage to enable)")
  }

  await browser.close()
  console.log("")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
