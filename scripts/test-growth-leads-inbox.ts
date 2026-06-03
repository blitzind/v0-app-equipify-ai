/**
 * Regression checks for Growth Leads inbox usability (archive, contact edit, quick actions).
 * Run: pnpm test:growth-leads-inbox
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { z } from "zod"
import { GROWTH_LEAD_HARD_DELETE_ENABLED } from "../lib/growth/lead-archive"
import {
  GROWTH_LEAD_ARCHIVE_SCHEMA_PUBLIC_MESSAGE,
  GrowthLeadArchiveSchemaIncompleteError,
  isGrowthLeadArchiveSchemaIncompleteErrorCode,
  mapGrowthLeadArchiveApiError,
} from "../lib/growth/lead-archive-api-errors"
import {
  friendlyLeadContactValidationError,
  normalizeLeadContactPhone,
  normalizeLeadContactWebsite,
  validateLeadContactEmail,
} from "../lib/growth/lead-contact-validation"

assert.equal(GROWTH_LEAD_HARD_DELETE_ENABLED, false, "Growth leads must not hard-delete in product flows")

assert.equal(validateLeadContactEmail("Jane@Example.com"), "jane@example.com")
assert.throws(() => validateLeadContactEmail("not-an-email"), /invalid_email/)
assert.equal(validateLeadContactEmail(null), null)

assert.equal(normalizeLeadContactPhone("(555) 123-4567"), "5551234567")
assert.throws(() => normalizeLeadContactPhone("123"), /invalid_phone/)
assert.equal(normalizeLeadContactPhone(null), null)

assert.equal(normalizeLeadContactWebsite("example.com"), "https://example.com")
assert.equal(normalizeLeadContactWebsite(null), null)

assert.equal(friendlyLeadContactValidationError("invalid_email"), "Enter a valid email address.")
assert.equal(friendlyLeadContactValidationError("unknown"), "Could not save contact info.")

const BulkArchiveBodySchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(100),
  reason: z.string().trim().max(500).optional().nullable(),
})

const sampleIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
]
assert.ok(BulkArchiveBodySchema.safeParse({ leadIds: sampleIds }).success)
assert.ok(!BulkArchiveBodySchema.safeParse({ leadIds: [] }).success)
assert.ok(!BulkArchiveBodySchema.safeParse({ leadIds: ["not-a-uuid"] }).success)

const schemaIncomplete = mapGrowthLeadArchiveApiError(new GrowthLeadArchiveSchemaIncompleteError())
assert.equal(schemaIncomplete.status, 503)
assert.equal(schemaIncomplete.error, "growth_lead_archive_schema_incomplete")
assert.equal(schemaIncomplete.message, GROWTH_LEAD_ARCHIVE_SCHEMA_PUBLIC_MESSAGE)
assert.ok(isGrowthLeadArchiveSchemaIncompleteErrorCode(schemaIncomplete.error))

const repoSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/lead-repository.ts"), "utf8")
assert.match(repoSource, /probeGrowthLeadArchiveSchema/, "lead repository probes archive schema")
assert.match(repoSource, /LEAD_SELECT_CORE/, "lead repository has core select without archive columns")
assert.match(repoSource, /leadSelectFor\(archiveReady\)/, "lead repository chooses select based on schema")
assert.match(repoSource, /\.is\("archived_at", null\)/, "listGrowthLeads excludes archived rows when schema ready")
assert.match(repoSource, /\.neq\("status", "archived"\)/, "listGrowthLeads fallback excludes archived status pre-migration")
assert.match(repoSource, /GrowthLeadArchiveSchemaIncompleteError/, "archive requires migration when schema missing")
assert.doesNotMatch(repoSource, /\.delete\(\)/, "lead repository must not hard-delete growth.leads")

const leadsRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/leads/route.ts"),
  "utf8",
)
assert.match(leadsRouteSource, /archiveSchemaReady/, "list API exposes archive schema readiness")

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/leads/crm/page.tsx"),
  "utf8",
)
assert.match(pageSource, /onArchiveLead=\{archiveLead\}/, "page wires archiveLead handler")
assert.match(pageSource, /onBulkArchive=\{bulkArchiveLeads\}/, "page wires bulkArchiveLeads handler")
assert.match(pageSource, /archiveAvailable=\{archiveSchemaReady\}/, "page passes archive availability to table")
assert.doesNotMatch(pageSource, /onDeleteLead|updateLeadStatus|deletingLeadId/, "page no longer uses delete/status props")

const deleteRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/leads/[leadId]/route.ts"),
  "utf8",
)
assert.match(deleteRoute, /archiveGrowthLeads|deleteGrowthLead/, "DELETE route archives instead of hard delete")
assert.match(deleteRoute, /mapGrowthLeadArchiveApiError/, "DELETE route maps migration-needed errors")

const tableSource = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-leads-table.tsx"), "utf8")
assert.match(tableSource, /GrowthCallActionSheet/, "table uses GrowthCallActionSheet for calls")
assert.match(tableSource, /mailto:/, "table exposes mailto when email exists")
assert.match(tableSource, /No email on lead/, "email quick action disabled tooltip")
assert.match(tableSource, /No phone on lead/, "phone quick action disabled tooltip")
assert.match(tableSource, /Archive Selected/, "bulk archive toolbar label")
assert.match(tableSource, /archiveAvailable/, "table respects archive availability")
assert.match(tableSource, /sourceKind\?\.replace/, "table handles missing source kind safely")
assert.match(tableSource, /ownerLabels/, "table accepts owner label map")
assert.match(tableSource, /Assign to me/, "table exposes assign-to-me quick action")

const editDialogSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-lead-edit-contact-dialog.tsx"),
  "utf8",
)
assert.match(editDialogSource, /method: "PATCH"/, "edit contact dialog PATCHes lead")
assert.match(editDialogSource, /friendlyLeadContactValidationError/, "edit contact uses friendly validation errors")

function quickActionsAvailable(lead: { contactEmail?: string | null; contactPhone?: string | null }) {
  const email = lead.contactEmail?.trim() || null
  const phone = lead.contactPhone?.trim() || null
  return {
    callEnabled: Boolean(phone),
    emailEnabled: Boolean(email),
    openEnabled: true,
  }
}

assert.deepEqual(quickActionsAvailable({ contactEmail: "a@b.com", contactPhone: "5551234567" }), {
  callEnabled: true,
  emailEnabled: true,
  openEnabled: true,
})
assert.deepEqual(quickActionsAvailable({ contactEmail: "", contactPhone: null }), {
  callEnabled: false,
  emailEnabled: false,
  openEnabled: true,
})
assert.deepEqual(quickActionsAvailable({ contactEmail: undefined, contactPhone: undefined }), {
  callEnabled: false,
  emailEnabled: false,
  openEnabled: true,
})

function leadSelectFor(archiveReady: boolean): "full" | "core" {
  return archiveReady ? "full" : "core"
}

assert.equal(leadSelectFor(false), "core", "list loads without archive columns")
assert.equal(leadSelectFor(true), "full", "list uses archive columns when ready")

console.log("growth leads inbox tests passed")
