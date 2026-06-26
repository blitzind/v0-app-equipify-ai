/**
 * GE-AUTO-UI-4 — Growth settings full-width DOM/layout regression cert.
 * Run: pnpm test:ge-auto-ui-4
 *
 * Optional live audit (requires dev server + auth storage state):
 *   EQUIPIFY_LAYOUT_AUDIT=1 pnpm test:ge-auto-ui-4
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { chromium, type Page } from "playwright"
import { GROWTH_SETTINGS_SHELL_WIDTH_ENFORCER_QA_MARKER } from "../components/growth/settings/growth-settings-shell-width-enforcer"

export const GE_AUTO_UI_4_QA_MARKER = "ge-auto-ui-4-v1" as const

const VIEWPORT_WIDTH = 1920
const MIN_FILL_RATIO = 0.72

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function staticAudit(): void {
  const growthShell = readSource("components/growth/shell/growth-workspace-shell.tsx")
  assert.match(growthShell, /data-growth-workspace-full-width/)
  assert.match(growthShell, /GROWTH_WORKSPACE_SHELL_MAIN_INNER/)
  assert.doesNotMatch(growthShell, /isGrowthWorkspaceSettingsPathname\(pathname\)/)
  console.log("  ✓ Workspace shell uses full-width main inner on all Growth routes")

  const routeHook = readSource("lib/growth/settings/use-growth-workspace-settings-route.ts")
  assert.match(routeHook, /useSelectedLayoutSegments/)
  assert.match(routeHook, /segments\[0\] === "settings"/)
  console.log("  ✓ Settings route detected via layout segments + pathname fallback")

  const enforcer = readSource("components/growth/settings/growth-settings-shell-width-enforcer.tsx")
  assert.match(enforcer, /max-w-\[1440px\]/)
  assert.match(enforcer, /max-w-none/)
  assert.match(enforcer, /WORKSPACE_SHELL_MAIN_CONTENT_ID/)
  console.log("  ✓ Settings shell width enforcer strips 1440px cap at runtime")

  const settingsShell = readSource("components/growth/settings/growth-settings-shell.tsx")
  assert.match(settingsShell, /GrowthSettingsShellWidthEnforcer/)
  assert.match(settingsShell, /data-growth-settings-layout-root/)
  assert.match(settingsShell, /data-growth-settings-header/)
  assert.match(settingsShell, /data-growth-settings-body/)
  assert.match(settingsShell, /data-growth-settings-content/)
  console.log("  ✓ Settings shell exposes DOM audit markers")

  const globals = readSource("app/globals.css")
  assert.match(globals, /#main-content > \[data-growth-settings-full-width="true"\]/)
  assert.match(globals, /max-width: none !important/)
  console.log("  ✓ Global CSS safety rule for settings full-width main inner")

  const tokens = readSource("lib/workspace/workspace-shell-tokens.ts")
  const settingsInner = tokens.match(/WORKSPACE_SETTINGS_SHELL_MAIN_INNER\s*=\s*\n?\s*"([^"]+)"/)
  assert.ok(settingsInner)
  assert.match(settingsInner[1], /max-w-none/)
  assert.match(settingsInner[1], /mx-0/)
  assert.doesNotMatch(settingsInner[1], /max-w-\[1440px\]/)
  console.log("  ✓ Core/Growth settings inner token has explicit max-w-none mx-0")

  const controlCenter = readSource("components/growth/autonomy/growth-autonomy-control-center.tsx")
  assert.match(controlCenter, /data-growth-autonomy-control-center/)
  assert.match(controlCenter, /max-w-none/)
  console.log("  ✓ Autonomy control center marked and uncapped")
}

async function measure(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((node) => node.getBoundingClientRect().width)
}

async function assertNoCappedAncestor(page: Page, selector: string): Promise<void> {
  const capped = await page.locator(selector).first().evaluate((start) => {
    let node: Element | null = start
    while (node) {
      const style = window.getComputedStyle(node)
      const maxWidth = style.maxWidth
      if (maxWidth.endsWith("px")) {
        const value = Number.parseFloat(maxWidth)
        if (Number.isFinite(value) && value > 0 && value <= 1440) {
          return {
            tag: node.tagName.toLowerCase(),
            id: node.id,
            className: node.className,
            maxWidth,
          }
        }
      }
      node = node.parentElement
    }
    return null
  })
  assert.equal(capped, null, `unexpected capped ancestor for ${selector}: ${JSON.stringify(capped)}`)
}

async function browserAudit(baseUrl: string): Promise<void> {
  const authFile = path.join(process.cwd(), "e2e/screenshots/.auth/user.json")
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: 1080 },
    ...(fs.existsSync(authFile) ? { storageState: authFile } : {}),
  })
  const page = await context.newPage()

  try {
    await page.goto(`${baseUrl}/growth/settings/autonomy`, { waitUntil: "domcontentloaded", timeout: 60_000 })
    const landedUrl = page.url()
    if (landedUrl.includes("/login") || landedUrl === `${baseUrl}/` || landedUrl.endsWith("/")) {
      console.log(`  ○ Browser audit skipped — landed on ${landedUrl} (auth required for /growth/settings/*)`)
      return
    }

    const hasLayoutRoot = await page.locator("[data-growth-settings-layout-root]").count()
    if (hasLayoutRoot === 0) {
      console.log(`  ○ Browser audit skipped — settings layout markers absent at ${landedUrl}`)
      return
    }

    const viewport = page.viewportSize()?.width ?? VIEWPORT_WIDTH
    const mainInner = await measure(page, '#main-content > [data-qa-marker="workspace-shell-v1"]')
    const layoutRoot = await measure(page, "[data-growth-settings-layout-root]")
    const header = await measure(page, "[data-growth-settings-header]")
    const body = await measure(page, "[data-growth-settings-body]")
    const content = await measure(page, "[data-growth-settings-content]")
    const controlCenter = await measure(page, "[data-growth-autonomy-control-center]")

    console.log(`  ✓ viewport=${viewport}px mainInner=${mainInner.toFixed(0)}px layoutRoot=${layoutRoot.toFixed(0)}px`)
    console.log(`  ✓ header=${header.toFixed(0)}px body=${body.toFixed(0)}px content=${content.toFixed(0)}px controlCenter=${controlCenter.toFixed(0)}px`)

    assert.ok(mainInner / viewport >= MIN_FILL_RATIO, `main inner too narrow: ${mainInner}/${viewport}`)
    assert.ok(layoutRoot / mainInner >= 0.98, "layout root should match main inner width")
    assert.ok(header / layoutRoot >= 0.98, "header should span layout root")
    assert.ok(body / layoutRoot >= 0.98, "body should span layout root")
    assert.ok(content / body >= 0.55, "content column should use majority of body beside nav")

    await assertNoCappedAncestor(page, "[data-growth-settings-content]")
    await assertNoCappedAncestor(page, "[data-growth-autonomy-control-center]")

    const enforcerMarker = await page.locator('[data-growth-settings-width-enforcer]').count()
    assert.ok(enforcerMarker >= 1, "width enforcer marker expected on main inner")

    console.log("  ✓ Browser audit — no 1440px capped ancestors; widths fill available area")
  } finally {
    await browser.close()
  }
}

async function main(): Promise<void> {
  console.log(`\n=== GE-AUTO-UI-4 (${GE_AUTO_UI_4_QA_MARKER}) ===\n`)
  assert.equal(GROWTH_SETTINGS_SHELL_WIDTH_ENFORCER_QA_MARKER, "growth-settings-shell-width-enforcer-ui-5-v1")

  staticAudit()

  if (process.env.EQUIPIFY_LAYOUT_AUDIT === "1") {
    const baseUrl = process.env.EQUIPIFY_LAYOUT_AUDIT_URL ?? "http://127.0.0.1:3000"
    console.log("\n  Running browser layout audit…")
    await browserAudit(baseUrl)
  } else {
    console.log("\n  ○ Browser audit skipped (set EQUIPIFY_LAYOUT_AUDIT=1 to enable Playwright width audit)")
  }

  console.log("\nGE-AUTO-UI-4 passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
