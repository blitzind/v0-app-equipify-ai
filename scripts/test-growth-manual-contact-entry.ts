/**
 * Regression checks for manual Growth contact entry.
 * Run: pnpm test:growth-manual-contact-entry
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { manualContactInputToImportRow } from "../lib/growth/manual-entry/manual-contact-entry-types"
import { GROWTH_MANUAL_CONTACT_ENTRY_QA_MARKER } from "../lib/growth/manual-entry/manual-contact-entry-types"

assert.equal(GROWTH_MANUAL_CONTACT_ENTRY_QA_MARKER, "growth-manual-contact-entry-v1")

const row = manualContactInputToImportRow(
  {
    company_name: "Acme Medical",
    contact_name: "Jane Doe",
    title: "CEO",
    email: "jane@acme.com",
    phone: "555-0100",
    website: "https://acme.com",
    linkedin_url: "https://linkedin.com/in/janedoe",
    city: "Austin",
    state: "TX",
    source_note: "Trade show booth",
  },
  "manual:entry:test-id",
)

assert.equal(row.companyName, "Acme Medical")
assert.equal(row.contactName, "Jane Doe")
assert.equal(row.firstName, "Jane")
assert.equal(row.lastName, "Doe")
assert.equal(row.email, "jane@acme.com")
assert.equal(row.externalRef, "manual:entry:test-id")

const serviceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/manual-entry/create-manual-growth-contact.ts"),
  "utf8",
)
assert.match(serviceSource, /sourceKind: "manual"/)
assert.match(serviceSource, /source: "manual"/)
assert.match(serviceSource, /findImportDedupeMatch/)
assert.match(serviceSource, /assertEmailSendAllowed/)
assert.match(serviceSource, /recomputeGrowthLeadWorkflowSignals/)
assert.match(serviceSource, /verifyEmailWithProvider/)
assert.doesNotMatch(serviceSource, /lead.inbox|createLeadCandidate|sendEmail/i)

const apiSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/manual-contacts/route.ts"),
  "utf8",
)
assert.match(apiSource, /requireGrowthEnginePlatformAccess/)
assert.match(apiSource, /createManualGrowthContact/)

const dialogSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-manual-contact-form-dialog.tsx"),
  "utf8",
)
assert.match(dialogSource, /Add contact manually/)
assert.match(dialogSource, /verify_email/)
assert.match(dialogSource, /Open lead/)
assert.match(dialogSource, /manual-contacts/)

const acquisitionDetailSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-acquisition-run-detail.tsx"),
  "utf8",
)
assert.match(acquisitionDetailSource, /GrowthManualContactFormDialog/)

const crmSource = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/leads/crm/page.tsx"),
  "utf8",
)
assert.match(crmSource, /GrowthManualContactFormDialog/)

console.log("growth-manual-contact-entry checks passed")
