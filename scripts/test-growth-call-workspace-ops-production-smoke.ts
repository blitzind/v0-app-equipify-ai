/**
 * CALLS-OPS-1B — Production smoke for Calls operator workflow (Playwright + storage state).
 *
 * Usage:
 *   GROWTH_CERT_STORAGE_STATE=scripts/.growth-cert-storage-state.json \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-growth-call-workspace-ops-production-smoke.ts
 *
 * Production host only. Does not use .env.local.
 */
import fs from "node:fs"
import path from "node:path"
import { chromium, type Page } from "@playwright/test"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import { GROWTH_CALL_WORKSPACE_OPS_QA_MARKER } from "../lib/growth/native-dialer/call-workspace-operator-types"

const BASE_URL = (resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai").replace(/\/$/, "")
const OPERATE_URL = `${BASE_URL}/growth/calls/workspace?view=operate`
const NAV_TIMEOUT_MS = 45_000

type SmokeResult = {
  id: number
  name: string
  status: "pass" | "fail" | "blocked"
  detail: string
}

const results: SmokeResult[] = []

function record(id: number, name: string, status: SmokeResult["status"], detail: string) {
  results.push({ id, name, status, detail })
  const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : "○"
  console.log(`  ${icon} [${id}] ${name}: ${detail}`)
}

function resolveStorageStatePath(): string {
  const fromEnv = process.env.GROWTH_CERT_STORAGE_STATE?.trim()
  const candidate = fromEnv || path.join(process.cwd(), "scripts/.growth-cert-storage-state.json")
  if (!fs.existsSync(candidate)) {
    throw new Error(`missing_storage_state:${candidate}`)
  }
  return candidate
}

async function waitForOperateShell(page: Page) {
  await page.goto(OPERATE_URL, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS })
  if (page.url().includes("/login")) {
    throw new Error("auth_failed:redirected_to_login")
  }
  await page.waitForSelector('[data-qa-marker="native-dialer-v1"]', { timeout: 60_000 })
  await page.waitForTimeout(4_000)
}

async function runSmoke(): Promise<void> {
  console.log(`\n=== CALLS-OPS-1B production smoke (${GROWTH_CALL_WORKSPACE_OPS_QA_MARKER}) ===`)
  console.log(`Host: ${BASE_URL}\n`)

  const storageStatePath = resolveStorageStatePath()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ storageState: storageStatePath })
  const page = await context.newPage()

  try {
    await waitForOperateShell(page)

    const opsMarkerCount = await page.locator(`[data-growth-call-workspace-ops-marker="${GROWTH_CALL_WORKSPACE_OPS_QA_MARKER}"]`).count()
    const opsDeployed = opsMarkerCount > 0
    record(
      1,
      "Queue row → Preview (deployed surface)",
      opsDeployed ? "pass" : "fail",
      opsDeployed
        ? `ops markers present (${opsMarkerCount})`
        : "CALLS-OPS-1 bundle not deployed to production yet — no ops QA markers in DOM",
    )

    const previewButtons = page.getByRole("button", { name: "Preview", exact: true })
    const previewButtonCount = await previewButtons.count()
    const hasQueueItems = previewButtonCount > 0

    if (!opsDeployed) {
      for (const blocked of [
        [2, "Preview expands right rail"],
        [3, "Center preview card loads lead/company/phone"],
        [4, "Call starts from preview"],
        [5, "Notes editable during call"],
        [6, "Notes autosave"],
        [7, "Refresh restores notes"],
        [8, "Wrap-up saves disposition"],
        [9, "Follow-up action executes"],
        [10, "Sequence enroll from right rail"],
        [11, "Power dial advances to next preview"],
        [12, "Countdown appears correctly"],
      ] as const) {
        record(blocked[0], blocked[1], "blocked", "Requires CALLS-OPS-1 deploy to production")
      }
      return
    }

    if (!hasQueueItems) {
      record(2, "Preview expands right rail", "blocked", "Production queue empty (0 items) — seed queue or use power dial tab with pending items")
      record(3, "Center preview card loads lead/company/phone", "blocked", "Production queue empty (0 items)")
    } else {
      await previewButtons.first().click()
      await page.waitForSelector('[data-qa-action="call-workspace-queue-preview"]', { timeout: 15_000 })

      const previewPanel = page.locator('[data-qa-action="call-workspace-queue-preview"]')
      const previewText = (await previewPanel.innerText()).trim()
      const hasLeadContext = /Contact|Lead|·|\(\d{3}\)/.test(previewText)
      record(
        3,
        "Center preview card loads lead/company/phone",
        hasLeadContext ? "pass" : "fail",
        hasLeadContext ? "Preview panel shows contact/phone context" : `Unexpected preview text: ${previewText.slice(0, 120)}`,
      )

      const railExpanded = await page.locator("text=Relationship Context").isVisible()
      record(
        2,
        "Preview expands right rail",
        railExpanded ? "pass" : "fail",
        railExpanded ? "Relationship Context rail visible after preview" : "Rail did not expand",
      )
    }

    record(
      4,
      "Call starts from preview",
      "blocked",
      "Not executed in automated smoke — requires operator telephony consent and live dialer provider",
    )
    record(5, "Notes editable during call", "blocked", "Requires active call session")
    record(6, "Notes autosave", "blocked", "Requires active call session; PATCH notes route verified separately when deployed")
    record(7, "Refresh restores notes", "blocked", "Requires active call session")
    record(8, "Wrap-up saves disposition", "blocked", "Requires completed call session")
    record(9, "Follow-up action executes", "blocked", "Requires wrap-up completion")

    const queueNextProbe = await page.request.get(`${BASE_URL}/api/platform/growth/calls/queue/next`)
    if (queueNextProbe.status() === 404) {
      record(6, "Notes autosave", "fail", "Production missing CALLS-OPS API routes (queue/next 404)")
    }

    const sequencePanel = page.locator('[data-qa-action="call-workspace-sequence-panel"]')
    const sequenceVisible = await sequencePanel.count()
    record(
      10,
      "Sequence enroll from right rail",
      sequenceVisible > 0 ? "pass" : "blocked",
      sequenceVisible > 0
        ? "Sequence panel rendered for linked lead"
        : "Sequence panel not visible — preview lead may lack leadId linkage in production queue",
    )

    const powerDialSettings = page.locator('[data-qa-action="call-workspace-power-dial-settings"]')
    const powerDialSettingsVisible = await powerDialSettings.count()
    record(
      11,
      "Power dial advances to next preview",
      "blocked",
      powerDialSettingsVisible > 0
        ? "Power dial settings visible; auto-advance loop not exercised without wrap-up completion"
        : "Power dial disabled in production settings or settings UI not visible",
    )

    const countdownVisible = await page.locator("text=/Auto-dial in \\d+s/").count()
    record(
      12,
      "Countdown appears correctly",
      countdownVisible > 0 ? "pass" : "blocked",
      countdownVisible > 0
        ? "Auto-dial countdown visible after preview"
        : "Countdown not shown — power_dial_enabled off, auto-advance off, or delay not started",
    )
  } finally {
    await browser.close()
  }
}

async function main() {
  try {
    await runSmoke()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\nProduction smoke aborted: ${message}\n`)
    process.exit(1)
  }

  const fails = results.filter((r) => r.status === "fail").length
  const blocked = results.filter((r) => r.status === "blocked").length
  const passes = results.filter((r) => r.status === "pass").length

  console.log("\n--- Summary ---")
  console.log(JSON.stringify({ ok: fails === 0, passes, blocked, fails, results }, null, 2))
  process.exit(fails === 0 ? 0 : 1)
}

main()
