/**
 * Regression checks for Growth command navigation palette (Prompt 33 + 35).
 * Run: pnpm test:growth-command-navigation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_COMMAND_PALETTE_DESTINATIONS,
  GROWTH_COMMAND_PALETTE_ENTRIES,
  GROWTH_NAV_QUICK_ACTIONS,
  GROWTH_NAVIGATION_IA_QA_MARKER,
} from "../lib/growth/navigation/growth-navigation-destinations"
import { GROWTH_NAVIGATION_POLISH_QA_MARKER } from "../lib/growth/navigation/growth-navigation-ranking"

assert.equal(GROWTH_NAVIGATION_IA_QA_MARKER, "growth-navigation-ia-v2")
assert.equal(GROWTH_NAVIGATION_POLISH_QA_MARKER, "growth-navigation-polish-v1")

const palettePath = path.join(process.cwd(), "components/growth/growth-command-navigation-palette.tsx")
const paletteSource = fs.readFileSync(palettePath, "utf8")
assert.match(paletteSource, /CommandDialog/)
assert.match(paletteSource, /GROWTH_NAVIGATION_IA_QA_MARKER/)
assert.match(paletteSource, /GROWTH_NAVIGATION_POLISH_QA_MARKER/)
assert.match(paletteSource, /Growth navigation/)
assert.match(paletteSource, /rankGrowthCommandPaletteEntries/)
assert.match(paletteSource, /readGrowthNavigationUsage/)

const providerPath = path.join(process.cwd(), "components/growth/growth-navigation-provider.tsx")
const providerSource = fs.readFileSync(providerPath, "utf8")
assert.match(providerSource, /isGrowthNavigationInputTarget/)
assert.match(providerSource, /event\.key\.toLowerCase\(\) !== "k"/)
assert.match(providerSource, /metaKey \|\| event\.ctrlKey/)
assert.match(providerSource, /recordGrowthNavigationUsage/)

const layoutPath = path.join(process.cwd(), "app/(admin)/admin/growth/layout.tsx")
const layoutSource = fs.readFileSync(layoutPath, "utf8")
assert.match(layoutSource, /GrowthNavigationProvider/)
assert.match(layoutSource, /GrowthCommandNavigationPalette/)

const jumpNavSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-jump-nav.tsx"),
  "utf8",
)
assert.match(jumpNavSource, /growthNavigationShortcutLabel/)
assert.match(jumpNavSource, /setOpen\(true\)/)

const requiredIds = [
  "command",
  "inbox",
  "search",
  "intent-pixel",
  "lead-intelligence",
  "outreach-approval",
  "call-workspace",
  "calls-live",
  "call-queue",
  "live-coaching",
  "call-providers",
  "providers",
  "settings",
]
for (const id of requiredIds) {
  assert.ok(
    GROWTH_COMMAND_PALETTE_DESTINATIONS.some((d) => d.id === id),
    `missing palette destination: ${id}`,
  )
}

assert.ok(GROWTH_COMMAND_PALETTE_DESTINATIONS.some((d) => d.label === "Revenue Inbox"))
assert.ok(GROWTH_COMMAND_PALETTE_ENTRIES.length > GROWTH_COMMAND_PALETTE_DESTINATIONS.length)

assert.ok(GROWTH_NAV_QUICK_ACTIONS.some((a) => a.href.includes("mode=discover")))
assert.ok(GROWTH_NAV_QUICK_ACTIONS.some((a) => a.label === "Run Lead Intelligence"))

const guardSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/navigation/growth-navigation-input-guard.ts"),
  "utf8",
)
assert.match(guardSource, /INPUT/)
assert.match(guardSource, /TEXTAREA/)
assert.match(guardSource, /contenteditable/)

console.log("growth-command-navigation: all checks passed")
