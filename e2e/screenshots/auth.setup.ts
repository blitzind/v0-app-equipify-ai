import fs from "node:fs"
import path from "node:path"
import { test as setup } from "@playwright/test"

const authFile = path.join(__dirname, ".auth", "user.json")

setup("authenticate screenshot operator", async ({ page }) => {
  const email = process.env.EQUIPIFY_SCREENSHOT_EMAIL
  const password = process.env.EQUIPIFY_SCREENSHOT_PASSWORD
  if (!email || !password) {
    throw new Error(
      "Missing EQUIPIFY_SCREENSHOT_EMAIL / EQUIPIFY_SCREENSHOT_PASSWORD. " +
        "Set them to a user with demo-seeded org access, or place a pre-generated storage state at e2e/screenshots/.auth/user.json.",
    )
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true })

  await page.goto("/login")
  await page.getByPlaceholder("you@company.com").fill(email)
  await page.getByPlaceholder("••••••••").fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL(/\/(?!login)/, { timeout: 90_000 })

  await page.context().storageState({ path: authFile })
})
