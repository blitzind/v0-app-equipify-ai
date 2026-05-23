/**
 * Regression checks for Growth Engine import pipeline helpers.
 * Run: pnpm test:growth-import
 */
import assert from "node:assert/strict"
import { suggestGrowthImportColumnMapping } from "../lib/growth/import/map-columns"
import { buildProtectedMergePatch } from "../lib/growth/import/merge"
import { computeImportQualityScore, computeImportFillMetrics } from "../lib/growth/import/quality"
import { proposeImportRowAction } from "../lib/growth/import/dedupe"
import { manualCsvImportAdapter } from "../lib/growth/import/vendors/manual-csv"
import type { GrowthLead } from "../lib/growth/types"

const headers = ["Company Name", "Email", "Phone", "Website", "First Name", "Last Name"]
const mapping = suggestGrowthImportColumnMapping(headers, manualCsvImportAdapter)

assert.equal(mapping.company_name, "Company Name")
assert.equal(mapping.email, "Email")
assert.equal(mapping.phone, "Phone")
assert.equal(mapping.website, "Website")

assert.equal(proposeImportRowAction({ leadId: "x", rule: "email", confidence: 0.9, dedupeKey: "a" }, "skip_high_confidence"), "skip")
assert.equal(proposeImportRowAction({ leadId: "x", rule: "email", confidence: 0.75, dedupeKey: "a" }, "merge_empty_fields"), "merge")
assert.equal(proposeImportRowAction(null, "skip_high_confidence"), "create_new")

const existing = {
  id: "lead-1",
  notes: "Manual analyst notes",
  contactEmail: "old@example.com",
  contactPhone: "5551112222",
  callPriorityOverride: 90,
  lastHumanTouchAt: "2026-01-01T00:00:00.000Z",
  firstHumanTouchAt: "2026-01-01T00:00:00.000Z",
  timeToFirstTouchHours: 4,
  decisionMakerStatus: "confirmed",
  primaryDecisionMakerId: "dm-1",
  callDisposition: "interested",
  callDispositionAt: "2026-01-02T00:00:00.000Z",
  lastCallAt: "2026-01-02T00:00:00.000Z",
  metadata: {},
} as GrowthLead

const patch = buildProtectedMergePatch(
  existing,
  {
    companyName: "Acme HVAC",
    contactName: "Jane Doe",
    firstName: "Jane",
    lastName: "Doe",
    email: "new@example.com",
    phone: "5559998888",
    website: "https://acme.example",
    linkedinUrl: null,
    title: null,
    addressLine1: null,
    city: null,
    state: null,
    postalCode: null,
    country: "US",
    notes: "Import notes should not overwrite",
    externalRef: null,
  },
  {
    sourceChannel: "Outbound",
    sourceCampaign: "Spring",
    sourceVendor: "manual_csv",
    sourceImportBatchId: "batch-1",
    externalRef: "manual_csv:ref1",
    rowIndex: 0,
  },
)

assert.equal(patch.notes, undefined)
assert.equal(patch.contact_email, undefined)
assert.equal(patch.contact_phone, undefined)
assert.equal(patch.call_priority_override, undefined)
assert.equal(patch.last_human_touch_at, undefined)
assert.equal(patch.first_human_touch_at, undefined)
assert.equal(patch.time_to_first_touch_hours, undefined)
assert.equal(patch.decision_maker_status, undefined)
assert.equal(patch.primary_decision_maker_id, undefined)
assert.equal(patch.call_disposition, undefined)
assert.equal(patch.contact_name, "Jane Doe")

const fill = computeImportFillMetrics([
  {
    companyName: "A",
    contactName: "B",
    firstName: null,
    lastName: null,
    email: "a@b.com",
    phone: null,
    website: "https://a.com",
    linkedinUrl: null,
    title: null,
    addressLine1: null,
    city: null,
    state: null,
    postalCode: null,
    country: "US",
    notes: null,
    externalRef: null,
  },
  {
    companyName: "C",
    contactName: null,
    firstName: null,
    lastName: null,
    email: null,
    phone: "5551234567",
    website: null,
    linkedinUrl: null,
    title: null,
    addressLine1: null,
    city: null,
    state: null,
    postalCode: null,
    country: "US",
    notes: null,
    externalRef: null,
  },
])

assert.equal(fill.emailFillPercent, 50)
assert.equal(fill.phoneFillPercent, 50)
assert.equal(fill.websiteFillPercent, 50)

const score = computeImportQualityScore({ ...fill, errorRate: 0.1 })
assert.ok(score >= 0 && score <= 100)

console.log("growth import tests passed")
