/**
 * Regression checks for Growth Engine import pipeline helpers.
 * Run: pnpm test:growth-import
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { inferBatchAutoTags, mergeLeadMetadataTags } from "../lib/growth/import/batch-tags"
import {
  computeBatchContactabilityAverage,
  computeContactabilityScore,
  countEstimatedCallReadyLeads,
  isEstimatedCallReadyLead,
} from "../lib/growth/import/contactability"
import { suggestGrowthImportColumnMapping } from "../lib/growth/import/map-columns"
import { buildCreateLeadInputFromImportRow, buildProtectedMergePatch } from "../lib/growth/import/merge"
import { computeImportPipelineSummary, computeImportQualityScore, computeImportFillMetrics } from "../lib/growth/import/quality"
import { proposeImportRowAction } from "../lib/growth/import/dedupe"
import { parseCsvText } from "../lib/migration-imports/parse-csv"
import { manualCsvImportAdapter } from "../lib/growth/import/vendors/manual-csv"
import { seamlessCsvImportAdapter } from "../lib/growth/import/vendors/seamless-csv"
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
  metadata: { tags: ["existing_tag"] },
} as GrowthLead

const normalizedRow = {
  companyName: "Acme HVAC",
  contactName: "Jane Doe",
  firstName: "Jane",
  lastName: "Doe",
  email: "new@example.com",
  phone: "5559998888",
  website: "https://acme.example",
  linkedinUrl: "https://linkedin.com/in/jane",
  title: "CEO",
  addressLine1: null,
  city: null,
  state: null,
  postalCode: null,
  country: "US",
  notes: "Import notes should not overwrite",
  externalRef: null,
}

const patch = buildProtectedMergePatch(existing, normalizedRow, {
  sourceChannel: "Outbound",
  sourceCampaign: "Spring",
  sourceVendor: "manual_csv",
  sourceImportBatchId: "batch-1",
  externalRef: "manual_csv:ref1",
  rowIndex: 0,
  autoTags: ["hvac"],
  contactabilityScore: 100,
})

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
assert.deepEqual((patch.metadata as { tags: string[] }).tags, ["existing_tag", "hvac"])

const createInput = buildCreateLeadInputFromImportRow(normalizedRow, {
  sourceChannel: "Outbound",
  sourceCampaign: "Medical Equipment Q1",
  sourceVendor: "seamless",
  sourceImportBatchId: "batch-2",
  externalRef: "seamless:SC-001",
  rowIndex: 1,
  createdBy: "user-1",
  autoTags: ["medical_equipment"],
  contactabilityScore: 100,
})
assert.deepEqual(createInput.metadata.tags, ["medical_equipment"])
assert.equal(createInput.metadata.import.contactabilityScore, 100)

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

assert.equal(computeContactabilityScore(normalizedRow), 100)
assert.equal(computeBatchContactabilityAverage([normalizedRow]), 100)

assert.deepEqual(inferBatchAutoTags({ batchName: "Medical Equipment outreach" }), ["medical_equipment"])
assert.deepEqual(inferBatchAutoTags({ batchName: "Storm leads" }), ["storm_restoration"])
assert.deepEqual(inferBatchAutoTags({ sourceCampaign: "HVAC spring" }), ["hvac"])
assert.deepEqual(mergeLeadMetadataTags(["a"], ["b", "a"]), ["a", "b"])

assert.equal(
  isEstimatedCallReadyLead({ row: normalizedRow, hasError: false, proposedAction: "create_new" }),
  true,
)
assert.equal(
  isEstimatedCallReadyLead({ row: { ...normalizedRow, phone: null }, hasError: false, proposedAction: "create_new" }),
  false,
)

const previews = [
  {
    normalized: normalizedRow,
    issues: [],
    proposedAction: "create_new" as const,
    contactabilityScore: 100,
  },
  {
    normalized: { ...normalizedRow, phone: null },
    issues: [],
    proposedAction: "skip" as const,
    contactabilityScore: 65,
  },
]
assert.equal(countEstimatedCallReadyLeads(previews), 1)

const summary = computeImportPipelineSummary({
  rows: [normalizedRow],
  imported: 1,
  updated: 0,
  skipped: 0,
  duplicate: 0,
  error: 0,
  previews,
})
assert.equal(summary.avgContactabilityScore, 82.5)
assert.equal(summary.estimatedCallReadyLeads, 1)

const fixturePath = path.join(process.cwd(), "lib/growth/import/fixtures/seamless-clean.csv")
const fixtureCsv = fs.readFileSync(fixturePath, "utf8")
const parsedFixture = parseCsvText(fixtureCsv, 5000)
const seamlessMapping = suggestGrowthImportColumnMapping(parsedFixture.headers, seamlessCsvImportAdapter)
const seamlessRows = parsedFixture.rows.map((raw) => seamlessCsvImportAdapter.normalizeRow(raw, seamlessMapping))

assert.equal(seamlessRows.length, 3)
assert.equal(seamlessRows[0]?.email, "jane@acme.com")
assert.equal(seamlessRows[0]?.phone, "5551234567")
assert.equal(seamlessRows[0]?.externalRef, "SC-001")
assert.equal(seamlessCsvImportAdapter.externalRef(seamlessRows[0]!, "seamless"), "seamless:contact:SC-001")

console.log("growth import tests passed")
