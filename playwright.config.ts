import fs from "node:fs"
import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

const authFile = path.join(__dirname, "e2e/screenshots/.auth", "user.json")
const hasStorageState = fs.existsSync(authFile)

export default defineConfig({
  testDir: path.join(__dirname, "e2e"),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.EQUIPIFY_SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3000",
    locale: "en-US",
    colorScheme: "light",
    reducedMotion: "reduce",
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
  },
  projects: [
    ...(hasStorageState
      ? []
      : [
          {
            name: "setup",
            testMatch: /screenshots\/auth\.setup\.ts/,
          },
        ]),
    {
      name: "industry-shots",
      dependencies: hasStorageState ? [] : ["setup"],
      testMatch: /screenshots\/industry-assets\.spec\.ts/,
      use: {
        storageState: authFile,
      },
    },
  ],
})
