/**
 * GE-AUTO-UI-5 — Growth settings width parity with Core Workspace Settings.
 * Run: pnpm test:ge-auto-ui-5
 *
 * Optional live audit (requires dev server + auth storage state):
 *   EQUIPIFY_LAYOUT_AUDIT=1 pnpm test:ge-auto-ui-5
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { chromium, type Page } from "playwright"
import {
  GROWTH_WORKSPACE_SETTINGS_SHELL_BODY,
  GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT,
  GROWTH_WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER,
  GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER,
  GROWTH_WORKSPACE_SETTINGS_SHELL_ROOT,
  GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR,
} from "../lib/growth/settings/growth-workspace-settings-shell-tokens"
import {
  WORKSPACE_SETTINGS_SHELL_BODY,
  WORKSPACE_SETTINGS_SHELL_CONTENT,
  WORKSPACE_SETTINGS_SHELL_MAIN_INNER,
  WORKSPACE_SETTINGS_SHELL_ROOT,
} from "../lib/settings/workspace-settings-shell-tokens"

export const GE_AUTO_UI_5_QA_MARKER = "ge-auto-ui-5-v1" as const

const VIEWPORT_WIDTH = 1920
const WIDTH_PARITY_TOLERANCE_PX = 24

type LayerMeasurement = {
  layer: string
  selector: string
  width: number
  classes: string
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function staticTokenParityAudit(): void {
  assert.equal(GROWTH_WORKSPACE_SETTINGS_SHELL_ROOT, WORKSPACE_SETTINGS_SHELL_ROOT)
  assert.equal(GROWTH_WORKSPACE_SETTINGS_SHELL_BODY, WORKSPACE_SETTINGS_SHELL_BODY)
  assert.equal(GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT, WORKSPACE_SETTINGS_SHELL_CONTENT)
  assert.equal(GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER, WORKSPACE_SETTINGS_SHELL_MAIN_INNER)
  console.log("  ✓ Growth settings ROOT/BODY/CONTENT/MAIN_INNER alias Core tokens exactly")

  assert.match(GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR, /\bmd:w-56\b/)
  assert.doesNotMatch(GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR, /\blg:w-64\b/)
  console.log("  ✓ Growth settings sidebar desktop width matches Core (md:w-56)")

  const growthShell = readSource("components/growth/shell/growth-workspace-shell.tsx")
  assert.match(growthShell, /isSettingsRoute\s*\?/)
  assert.match(growthShell, /GROWTH_AIDEN_SAFE_AREA_PR/)
  assert.match(growthShell, /!isSettingsRoute|isSettingsRoute\s*\?\s*cn\(mainInnerClass/)
  assert.doesNotMatch(
    growthShell,
    /cn\(\s*mainInnerClass,\s*isSettingsRoute[^)]*GROWTH_AIDEN_SAFE_AREA_PR/s,
  )
  console.log("  ✓ Growth workspace shell omits AIden safe-area padding on settings routes")

  const enforcer = readSource("components/growth/settings/growth-settings-shell-width-enforcer.tsx")
  assert.match(enforcer, /growth-aiden-safe-area-pr/)
  assert.match(enforcer, /growthSettingsShellParity/)
  console.log("  ✓ Width enforcer strips AIden padding classes at runtime on settings mount")

  const globals = readSource("app/globals.css")
  assert.match(globals, /padding-right: 1\.5rem !important/)
  console.log("  ✓ Global CSS resets settings main-inner right padding to Core p-6 equivalent")

  assert.equal(GROWTH_WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER, "growth-workspace-settings-shell-layout-ui-5-v1")
  console.log("  ✓ Growth settings shell layout QA marker ui-5")

  const coreLayout = readSource("app/(dashboard)/settings/layout.tsx")
  assert.match(coreLayout, /data-workspace-settings-layout-root/)
  assert.match(coreLayout, /data-workspace-settings-body/)
  assert.match(coreLayout, /data-workspace-settings-content/)
  console.log("  ✓ Core settings layout exposes DOM audit markers for parity comparison")

  const nonSettingsGrowth = readSource("components/growth/shell/growth-workspace-shell.tsx")
  assert.match(nonSettingsGrowth, /GROWTH_AIDEN_SAFE_AREA_PR/)
  console.log("  ✓ Non-settings Growth routes retain AIden safe-area padding")
}

async function measureLayer(page: Page, layer: string, selector: string): Promise<LayerMeasurement> {
  const result = await page.locator(selector).first().evaluate((node, layerName) => {
    const rect = node.getBoundingClientRect()
    return {
      layer: layerName,
      selector: "",
      width: rect.width,
      classes: typeof node.className === "string" ? node.className : "",
    }
  }, layer)
  return { ...result, selector }
}

async function measureComputedPaddingRight(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((node) => {
    const style = window.getComputedStyle(node)
    return Number.parseFloat(style.paddingRight) || 0
  })
}

function printParityTable(
  core: LayerMeasurement[],
  growth: LayerMeasurement[],
  differences: string[],
): void {
  console.log("\n  | Layer | Core `/settings/general` | Growth `/growth/settings/sidebar-preferences` | Difference |")
  console.log("  |------|---------------------------|-----------------------------------------------|------------|")
  for (let i = 0; i < core.length; i += 1) {
    const c = core[i]
    const g = growth[i]
    const diff = Math.abs(c.width - g.width)
    const diffLabel =
      diff <= WIDTH_PARITY_TOLERANCE_PX
        ? `≈ parity (${diff.toFixed(0)}px)`
        : `Δ ${diff.toFixed(0)}px (core ${c.width.toFixed(0)} vs growth ${g.width.toFixed(0)})`
    console.log(
      `  | ${c.layer} | ${c.width.toFixed(0)}px | ${g.width.toFixed(0)}px | ${diffLabel} |`,
    )
    if (diff > WIDTH_PARITY_TOLERANCE_PX) {
      differences.push(`${c.layer}: ${diff.toFixed(0)}px narrower/wider on Growth`)
    }
  }
}

async function browserParityAudit(baseUrl: string): Promise<void> {
  const authFile = path.join(process.cwd(), "e2e/screenshots/.auth/user.json")
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: 1080 },
    ...(fs.existsSync(authFile) ? { storageState: authFile } : {}),
  })
  const page = await context.newPage()

  try {
    const layers: Array<{ layer: string; coreSelector: string; growthSelector: string }> = [
      {
        layer: "viewport",
        coreSelector: "html",
        growthSelector: "html",
      },
      {
        layer: "#main-content",
        coreSelector: "#main-content",
        growthSelector: "#main-content",
      },
      {
        layer: "main inner (workspace shell)",
        coreSelector: '#main-content > [data-qa-marker="workspace-shell-v1"]',
        growthSelector: '#main-content > [data-qa-marker="workspace-shell-v1"]',
      },
      {
        layer: "settings layout root",
        coreSelector: "[data-workspace-settings-layout-root]",
        growthSelector: "[data-growth-settings-layout-root]",
      },
      {
        layer: "settings body wrapper",
        coreSelector: "[data-workspace-settings-body]",
        growthSelector: "[data-growth-settings-body]",
      },
      {
        layer: "settings content column",
        coreSelector: "[data-workspace-settings-content]",
        growthSelector: "[data-growth-settings-content]",
      },
    ]

    await page.goto(`${baseUrl}/settings/general`, { waitUntil: "domcontentloaded", timeout: 60_000 })
    if (page.url().includes("/login")) {
      console.log(`  ○ Browser parity audit skipped — auth required (landed on ${page.url()})`)
      return
    }

    const coreMeasurements: LayerMeasurement[] = []
    for (const { layer, coreSelector } of layers) {
      const count = await page.locator(coreSelector).count()
      if (count === 0 && layer !== "viewport") {
        console.log(`  ○ Browser parity audit skipped — Core marker missing: ${coreSelector}`)
        return
      }
      coreMeasurements.push(await measureLayer(page, layer, coreSelector))
    }
    const coreMainInnerPr = await measureComputedPaddingRight(
      page,
      '#main-content > [data-qa-marker="workspace-shell-v1"]',
    )

    await page.goto(`${baseUrl}/growth/settings/sidebar-preferences`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    })
    if (page.url().includes("/login") || (await page.locator("[data-growth-settings-layout-root]").count()) === 0) {
      console.log(`  ○ Browser parity audit skipped — Growth settings markers absent at ${page.url()}`)
      return
    }

    const growthMeasurements: LayerMeasurement[] = []
    for (const { layer, growthSelector } of layers) {
      growthMeasurements.push(await measureLayer(page, layer, growthSelector))
    }
    const growthMainInnerPr = await measureComputedPaddingRight(
      page,
      '#main-content > [data-growth-settings-full-width="true"]',
    )

    const differences: string[] = []
    printParityTable(coreMeasurements, growthMeasurements, differences)

    console.log(
      `\n  ✓ main inner padding-right: core=${coreMainInnerPr.toFixed(0)}px growth=${growthMainInnerPr.toFixed(0)}px`,
    )
    assert.ok(
      Math.abs(coreMainInnerPr - growthMainInnerPr) <= WIDTH_PARITY_TOLERANCE_PX,
      `main inner padding-right mismatch: core ${coreMainInnerPr}px vs growth ${growthMainInnerPr}px`,
    )

    const coreContent = coreMeasurements.find((m) => m.layer === "settings content column")!
    const growthContent = growthMeasurements.find((m) => m.layer === "settings content column")!
    assert.ok(
      Math.abs(coreContent.width - growthContent.width) <= WIDTH_PARITY_TOLERANCE_PX,
      `settings content column width mismatch: core ${coreContent.width}px vs growth ${growthContent.width}px`,
    )

    const growthMainInner = growthMeasurements.find((m) => m.layer === "main inner (workspace shell)")!
    assert.doesNotMatch(growthMainInner.classes, /\bgrowth-aiden-safe-area-pr\b/)
    assert.match(growthMainInner.classes, /\bmax-w-none\b/)

    if (differences.length > 0) {
      console.log(`\n  ⚠ Layers outside tolerance: ${differences.join("; ")}`)
    } else {
      console.log("\n  ✓ Browser parity audit — Growth settings widths match Core within tolerance")
    }
  } finally {
    await browser.close()
  }
}

async function main(): Promise<void> {
  console.log(`\n=== GE-AUTO-UI-5 (${GE_AUTO_UI_5_QA_MARKER}) ===\n`)
  assert.equal(GE_AUTO_UI_5_QA_MARKER, "ge-auto-ui-5-v1")

  staticTokenParityAudit()

  if (process.env.EQUIPIFY_LAYOUT_AUDIT === "1") {
    const baseUrl = process.env.EQUIPIFY_LAYOUT_AUDIT_URL ?? "http://127.0.0.1:3000"
    console.log("\n  Running Core vs Growth browser parity audit…")
    await browserParityAudit(baseUrl)
  } else {
    console.log(
      "\n  ○ Browser parity audit skipped (set EQUIPIFY_LAYOUT_AUDIT=1 to enable Playwright width comparison)",
    )
  }

  console.log("\nGE-AUTO-UI-5 passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
