/**
 * Runtime DOM/CSS audit — Growth workspace bottom scroll reserve.
 *
 * Usage:
 *   pnpm tsx scripts/audit-growth-workspace-bottom-scroll.ts
 *   GROWTH_BOTTOM_SCROLL_AUDIT_URL=https://app.equipify.ai pnpm tsx scripts/audit-growth-workspace-bottom-scroll.ts
 */
import fs from "node:fs"
import path from "node:path"
import { chromium, type Page } from "playwright"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"

const BROWSER_AUDIT_FN_SOURCE = fs
  .readFileSync(path.join(process.cwd(), "scripts/audit-growth-workspace-bottom-scroll.browser.js"), "utf8")
  .replace("export function auditGrowthBottomScrollInBrowser", "function auditGrowthBottomScrollInBrowser")

export const GROWTH_BOTTOM_SCROLL_AUDIT_QA_MARKER = "growth-bottom-scroll-audit-v1" as const

const ROUTES = [
  "/growth/campaigns",
  "/growth/leads",
  "/growth/leads/prospect-search",
] as const

const STORAGE_CANDIDATES = [
  path.join(process.cwd(), "scripts/.growth-cert-storage-state.json"),
  path.join(process.cwd(), "e2e/screenshots/.auth/user.json"),
]

type LayerAudit = {
  selector: string
  label: string
  found: boolean
  rect: { top: number; bottom: number; height: number; width: number } | null
  scroll: { scrollHeight: number; clientHeight: number; scrollTop: number } | null
  computed: {
    paddingTop: string
    paddingBottom: string
    marginTop: string
    marginBottom: string
    minHeight: string
    height: string
    maxHeight: string
    overflowY: string
    boxSizing: string
    position: string
  } | null
  className: string
  dataAttributes: Record<string, string>
}

type PageAudit = {
  route: string
  url: string
  viewport: { width: number; height: number }
  document: { scrollHeight: number; clientHeight: number }
  body: { scrollHeight: number; clientHeight: number }
  main: LayerAudit
  mainInner: LayerAudit
  pageRoot: LayerAudit
  lastSection: LayerAudit
  aidenLauncher: LayerAudit
  aidenParent: LayerAudit
  bottomReservePx: number
  lastContentToScrollBottomPx: number
  culpritCandidates: Array<{
    label: string
    selector: string
    extraBottomPx: number
    paddingBottomPx: number
    marginBottomPx: number
    minHeightPx: number
    className: string
  }>
}

function resolveStorageStatePath(): string | null {
  for (const candidate of STORAGE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

async function auditPage(page: Page, baseUrl: string, route: string): Promise<PageAudit> {
  await page.goto(`${baseUrl}${route}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  })

  if (page.url().includes("/login")) {
    throw new Error(`Auth required — redirected to ${page.url()}`)
  }

  await page.waitForSelector("#main-content", { timeout: 60_000 })
  await page.waitForTimeout(1500)

  await page.evaluate(() => {
    const main = document.getElementById("main-content")
    if (main) main.scrollTop = main.scrollHeight
  })
  await page.waitForTimeout(400)

  const viewport = page.viewportSize() ?? { width: 1440, height: 900 }
  const params = {
    marker: GROWTH_BOTTOM_SCROLL_AUDIT_QA_MARKER,
    routePath: route,
    viewportHeight: viewport.height,
  }

  return page.evaluate(
    `${BROWSER_AUDIT_FN_SOURCE}\nauditGrowthBottomScrollInBrowser(${JSON.stringify(params)})`,
  )
}

function printLayer(layer: LayerAudit): void {
  if (!layer.found) {
    console.log(`  ${layer.label}: (not found)`)
    return
  }
  console.log(`  ${layer.label} [${layer.selector}]`)
  console.log(`    class: ${layer.className.slice(0, 180)}${layer.className.length > 180 ? "…" : ""}`)
  if (Object.keys(layer.dataAttributes).length > 0) {
    console.log(`    data: ${JSON.stringify(layer.dataAttributes)}`)
  }
  if (layer.rect) {
    console.log(
      `    rect: top=${layer.rect.top.toFixed(1)} bottom=${layer.rect.bottom.toFixed(1)} height=${layer.rect.height.toFixed(1)}`,
    )
  }
  if (layer.scroll) {
    console.log(
      `    scroll: scrollHeight=${layer.scroll.scrollHeight} clientHeight=${layer.scroll.clientHeight} scrollTop=${layer.scroll.scrollTop.toFixed(1)}`,
    )
  }
  if (layer.computed) {
    console.log(
      `    computed: pt=${layer.computed.paddingTop} pb=${layer.computed.paddingBottom} mb=${layer.computed.marginBottom} min-h=${layer.computed.minHeight} h=${layer.computed.height} overflow-y=${layer.computed.overflowY} position=${layer.computed.position}`,
    )
  }
}

async function main(): Promise<void> {
  const baseUrl = (process.env.GROWTH_BOTTOM_SCROLL_AUDIT_URL ?? resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai").replace(/\/$/, "")
  const storageStatePath = resolveStorageStatePath()
  if (!storageStatePath) {
    throw new Error("No auth storage state found (scripts/.growth-cert-storage-state.json or e2e/screenshots/.auth/user.json)")
  }

  console.log(`\n=== Growth workspace bottom scroll audit (${GROWTH_BOTTOM_SCROLL_AUDIT_QA_MARKER}) ===`)
  console.log(`baseUrl: ${baseUrl}`)
  console.log(`storage: ${storageStatePath}`)

  const browser = await chromium.launch({ headless: true })
  const results: PageAudit[] = []

  for (const viewport of [
    { width: 1440, height: 900, label: "desktop" },
    { width: 390, height: 844, label: "mobile" },
  ]) {
    console.log(`\n--- viewport: ${viewport.label} (${viewport.width}x${viewport.height}) ---`)
    const context = await browser.newContext({
      baseURL: baseUrl,
      storageState: storageStatePath,
      viewport: { width: viewport.width, height: viewport.height },
    })
    const page = await context.newPage()

    for (const route of ROUTES) {
      console.log(`\n[${viewport.label}] ${route}`)
      try {
        const audit = await auditPage(page, baseUrl, route)
        results.push(audit)

        console.log(`  url: ${audit.url}`)
        console.log(`  document scrollHeight=${audit.document.scrollHeight} clientHeight=${audit.document.clientHeight}`)
        console.log(`  body scrollHeight=${audit.body.scrollHeight} clientHeight=${audit.body.clientHeight}`)
        printLayer(audit.main)
        printLayer(audit.mainInner)
        printLayer(audit.pageRoot)
        printLayer(audit.lastSection)
        printLayer(audit.aidenLauncher)
        printLayer(audit.aidenParent)
        console.log(`  lastContentToScrollBottomPx: ${audit.lastContentToScrollBottomPx.toFixed(1)}`)
        console.log(`  bottomReservePx (reported): ${audit.bottomReservePx.toFixed(1)}`)
        console.log("  culprit candidates (sorted by extraBottomPx):")
        for (const c of audit.culpritCandidates.slice(0, 6)) {
          console.log(
            `    - ${c.label}: extraBottomPx=${c.extraBottomPx.toFixed(1)} pb=${c.paddingBottomPx.toFixed(1)} mb=${c.marginBottomPx.toFixed(1)} min-h=${c.minHeightPx.toFixed(1)} class="${c.className.slice(0, 120)}"`,
          )
        }
      } catch (error) {
        console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    await context.close()
  }

  await browser.close()

  const reportPath = path.join(process.cwd(), "scripts/.growth-bottom-scroll-audit-report.json")
  fs.writeFileSync(reportPath, JSON.stringify({ marker: GROWTH_BOTTOM_SCROLL_AUDIT_QA_MARKER, results }, null, 2))
  console.log(`\nWrote ${reportPath}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
