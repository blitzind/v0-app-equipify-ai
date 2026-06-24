import fs from "node:fs"
import path from "node:path"
import { test, expect } from "@playwright/test"

const authFile = path.join(__dirname, "screenshots/.auth/user.json")
const hasAuth = fs.existsSync(authFile)
const WIDTH_PARITY_TOLERANCE_PX = 24

test.describe("Growth settings layout width parity", () => {
  test.skip(!hasAuth, "Requires e2e/screenshots/.auth/user.json")

  test.use(hasAuth ? { storageState: authFile } : {})

  test("growth settings content width matches core settings", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })

    await page.goto("/settings/general")
    test.skip(page.url().includes("/login"), "Not authenticated")

    const core = await page.evaluate(() => {
      const pick = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().width ?? 0
      const mainInner = document.querySelector('#main-content > [data-qa-marker="workspace-shell-v1"]')
      const style = mainInner ? window.getComputedStyle(mainInner) : null
      return {
        mainInner: pick('#main-content > [data-qa-marker="workspace-shell-v1"]'),
        content: pick("[data-workspace-settings-content]"),
        paddingRight: style ? Number.parseFloat(style.paddingRight) : 0,
      }
    })

    await page.goto("/growth/settings/sidebar-preferences")
    test.skip(page.url().includes("/login"), "Not authenticated")
    await expect(page.locator("[data-growth-settings-layout-root]")).toBeVisible()

    const growth = await page.evaluate(() => {
      const pick = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().width ?? 0
      const mainInner = document.querySelector('#main-content > [data-growth-settings-full-width="true"]')
      const style = mainInner ? window.getComputedStyle(mainInner) : null
      return {
        mainInner: pick('#main-content > [data-growth-settings-full-width="true"]'),
        content: pick("[data-growth-settings-content]"),
        paddingRight: style ? Number.parseFloat(style.paddingRight) : 0,
        mainInnerClasses: mainInner?.className ?? "",
      }
    })

    expect(Math.abs(core.content - growth.content)).toBeLessThanOrEqual(WIDTH_PARITY_TOLERANCE_PX)
    expect(Math.abs(core.paddingRight - growth.paddingRight)).toBeLessThanOrEqual(WIDTH_PARITY_TOLERANCE_PX)
    expect(growth.mainInnerClasses).not.toMatch(/\bgrowth-aiden-safe-area-pr\b/)
  })
})
