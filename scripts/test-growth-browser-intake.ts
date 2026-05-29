/**
 * Regression checks for Growth Engine browser extension intake.
 * Run: pnpm test:growth-browser-intake
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  browserIntakeHasContactData,
  browserIntakeInputToImportRow,
  GROWTH_BROWSER_INTAKE_QA_MARKER,
  GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS,
  normalizeBrowserIntakeSourcePlatform,
  resolveBrowserIntakeContactName,
} from "../lib/growth/browser-intake/browser-intake-types"

assert.equal(GROWTH_BROWSER_INTAKE_QA_MARKER, "growth-browser-intake-v1")
assert.deepEqual(GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS, ["linkedin", "website", "manual", "other"])

assert.equal(normalizeBrowserIntakeSourcePlatform("LinkedIn"), "linkedin")
assert.equal(normalizeBrowserIntakeSourcePlatform(""), "other")

assert.equal(
  browserIntakeHasContactData({ company_name: "Acme", contact_name: "Jane Doe" }),
  true,
)
assert.equal(
  browserIntakeHasContactData({ company_name: "Acme", email: "jane@acme.com" }),
  true,
)
assert.equal(browserIntakeHasContactData({ company_name: "Acme" }), false)

const row = browserIntakeInputToImportRow(
  {
    company_name: "Acme Medical",
    contact_name: "Jane Doe",
    title: "CEO",
    email: "jane@acme.com",
    phone: "555-0100",
    website: "acme.com",
    linkedin_url: "https://linkedin.com/in/janedoe",
    source_url: "https://www.linkedin.com/in/janedoe",
    source_platform: "linkedin",
    city: "Austin",
    state: "TX",
    notes: "Captured from profile",
  },
  "browser_extension:test-id",
)

assert.equal(row.companyName, "Acme Medical")
assert.equal(row.contactName, "Jane Doe")
assert.equal(row.email, "jane@acme.com")
assert.equal(row.website, "https://acme.com")
assert.equal(row.externalRef, "browser_extension:test-id")

assert.equal(
  resolveBrowserIntakeContactName({ company_name: "Acme", email: "jane.doe@acme.com" }),
  "jane doe",
)

const serviceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/browser-intake/create-browser-intake-contact.ts"),
  "utf8",
)
assert.match(serviceSource, /sourceKind: "browser_extension"/)
assert.match(serviceSource, /findImportDedupeMatch/)
assert.match(serviceSource, /assertEmailSendAllowed/)
assert.match(serviceSource, /recomputeGrowthLeadWorkflowSignals/)
assert.match(serviceSource, /createGrowthLeadDecisionMaker/)
assert.doesNotMatch(serviceSource, /verifyEmailWithProvider/)
assert.doesNotMatch(serviceSource, /lead\.inbox|createLeadCandidate|sendEmail|enroll/i)

const apiSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/contact/route.ts"),
  "utf8",
)
assert.match(apiSource, /requireGrowthEnginePlatformAccess/)
assert.match(apiSource, /createBrowserIntakeContact/)
assert.match(apiSource, /source_platform/)

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/browser-intake-test/page.tsx"),
  "utf8",
)
assert.match(pageSource, /browser-intake\/contact/)
assert.match(pageSource, /source_platform/)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270528140000_growth_browser_extension_source_kind.sql"),
  "utf8",
)
assert.match(migrationSource, /browser_extension/)

const manifestSource = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/manifest.json"),
  "utf8",
)
assert.match(manifestSource, /"manifest_version": 3/)
assert.match(manifestSource, /host_permissions/)
assert.match(manifestSource, /https:\/\/app\.equipify\.ai\/\*/)

const popupJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/popup.js"),
  "utf8",
)
assert.match(popupJs, /browser-intake\/contact/)
assert.match(popupJs, /credentials: "include"/)
assert.match(popupJs, /linkedin\.com/)
assert.match(popupJs, /admin\/growth\/leads/)
assert.doesNotMatch(popupJs, /api[_-]?key|secret|password|token/i)

console.log("growth-browser-intake checks passed")
