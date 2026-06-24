import fs from "node:fs"
import path from "node:path"
import { test, expect } from "@playwright/test"

const authFile = path.join(__dirname, "screenshots/.auth/user.json")
const hasAuth = fs.existsSync(authFile)

test.describe("Growth settings layout width", () => {
  test.skip(!hasAuth, "Requires e2e/screenshots/.auth/user.json")

  test.use(hasAuth ? { storageState: authFile } : {})

  test("autonomy settings fills workspace width", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto("/growth/settings/autonomy")
    test.skip(page.url().includes("/login"), "Not authenticated")

    await expect(page.locator("[data-growth-settings-layout-root]")).toBeVisible()

    const widths = await page.evaluate(() => {
      const viewport = window.innerWidth
      const pick = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().width ?? 0
      return {
        viewport,
        mainInner: pick('#main-content > [data-qa-marker="workspace-shell-v1"]'),
        layoutRoot: pick("[data-growth-settings-layout-root]"),
        header: pick("[data-growth-settings-header]"),
        body: pick("[data-growth-settings-body]"),
        content: pick("[data-growth-settings-content]"),
        controlCenter: pick("[data-growth-autonomy-control-center]"),
      }
    })

    expect(widths.mainInner / widths.viewport).toBeGreaterThan(0.72)
    expect(widths.layoutRoot / widths.mainInner).toBeGreaterThan(0.98)
    expect(widths.header / widths.layoutRoot).toBeGreaterThan(0.98)
    expect(widths.controlCenter / widths.content).toBeGreaterThan(0.98)
  })
})
