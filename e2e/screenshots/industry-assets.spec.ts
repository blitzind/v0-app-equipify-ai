import fs from "node:fs/promises"
import path from "node:path"
import { test } from "@playwright/test"
import { withScreenshotMode } from "../../lib/screenshots/build-screenshot-url"
import {
  SCREENSHOT_REGISTRY_VERSION,
  defaultScreenshotIndustries,
  expandIndustryScenarios,
} from "../../lib/screenshots/industry-scenario-registry"

const OUTPUT_ROOT = path.join(process.cwd(), "screenshots", "output")

async function settle(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

test.describe.configure({ mode: "serial" })

test("capture industry marketing stills", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Use Chromium for stable PNG output.")

  const industries = defaultScreenshotIndustries()
  const scenarios = expandIndustryScenarios(industries)
  const manifestItems: Record<string, unknown>[] = []

  await fs.mkdir(OUTPUT_ROOT, { recursive: true })

  for (const row of scenarios) {
    const industryDir = path.join(OUTPUT_ROOT, row.industry)
    await fs.mkdir(industryDir, { recursive: true })
    const pngName = `${row.fileSlug}.png`
    const pngPath = path.join(industryDir, pngName)

    await page.setViewportSize(row.viewport)
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" })

    const url = withScreenshotMode(row.path)
    await page.goto(url, { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {})
    if (row.waitMs && row.waitMs > 0) await settle(row.waitMs)

    await page.screenshot({
      path: pngPath,
      fullPage: row.fullPage ?? false,
      animations: "disabled",
    })

    const meta = {
      registryVersion: SCREENSHOT_REGISTRY_VERSION,
      industry: row.industry,
      scenarioId: row.id,
      category: row.category,
      title: row.title,
      description: row.description,
      path: row.path,
      viewport: row.viewport,
      fullPage: row.fullPage ?? false,
      capturedAt: new Date().toISOString(),
      baseURL: process.env.EQUIPIFY_SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3000",
      relativeFile: path.posix.join(row.industry, pngName),
    }
    manifestItems.push(meta)
    await fs.writeFile(pngPath.replace(/\.png$/i, ".meta.json"), JSON.stringify(meta, null, 2))
  }

  await fs.writeFile(
    path.join(OUTPUT_ROOT, "manifest.json"),
    JSON.stringify(
      {
        registryVersion: SCREENSHOT_REGISTRY_VERSION,
        generatedAt: new Date().toISOString(),
        industries,
        items: manifestItems,
      },
      null,
      2,
    ),
  )
})
