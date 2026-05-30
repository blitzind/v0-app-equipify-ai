/**
 * Regression checks: growth.leads source_kind constraint + browser extension intake.
 * Run: pnpm test:growth-leads-source-kind
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_LEAD_SOURCE_KINDS } from "../lib/growth/types"

const ROOT = process.cwd()
const repairMigration = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20270620120000_growth_leads_source_kind_repair.sql"),
  "utf8",
)
const browserExtensionMigration = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20270528140000_growth_browser_extension_source_kind.sql"),
  "utf8",
)
const createBrowserIntake = fs.readFileSync(
  path.join(ROOT, "lib/growth/browser-intake/create-browser-intake-contact.ts"),
  "utf8",
)

const REQUIRED_SOURCE_KINDS = [
  "manual",
  "import",
  "web",
  "referral",
  "partner",
  "other",
  "browser_extension",
  "acquisition",
] as const

for (const kind of REQUIRED_SOURCE_KINDS) {
  assert.ok(GROWTH_LEAD_SOURCE_KINDS.includes(kind), `GROWTH_LEAD_SOURCE_KINDS missing ${kind}`)
}

assert.match(createBrowserIntake, /sourceKind: "browser_extension"/)
assert.match(createBrowserIntake, /source_kind: "browser_extension"/)

assert.match(repairMigration, /drop constraint if exists leads_source_kind_check/)
assert.match(repairMigration, /add constraint leads_source_kind_check/)

for (const kind of REQUIRED_SOURCE_KINDS) {
  assert.match(repairMigration, new RegExp(`'${kind}'`), `repair migration missing '${kind}'`)
}

assert.match(browserExtensionMigration, /'browser_extension'/)

console.log("growth-leads-source-kind tests passed.")
