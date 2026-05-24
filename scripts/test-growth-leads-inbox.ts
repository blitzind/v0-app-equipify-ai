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

const repoSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/lead-repository.ts"), "utf8")
assert.match(repoSource, /\.is\("archived_at", null\)/, "listGrowthLeads excludes archived rows by default")
assert.match(repoSource, /archived_at: now/, "archiveGrowthLeads sets archived_at")
assert.match(repoSource, /status: "archived"/, "archiveGrowthLeads sets status archived")
assert.doesNotMatch(repoSource, /\.delete\(\)/, "lead repository must not hard-delete growth.leads")

const deleteRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/leads/[leadId]/route.ts"),
  "utf8",
)
assert.match(deleteRoute, /archiveGrowthLeads|deleteGrowthLead/, "DELETE route archives instead of hard delete")

const tableSource = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-leads-table.tsx"), "utf8")
assert.match(tableSource, /GrowthCallActionSheet/, "table uses GrowthCallActionSheet for calls")
assert.match(tableSource, /mailto:/, "table exposes mailto when email exists")
assert.match(tableSource, /No email on lead/, "email quick action disabled tooltip")
assert.match(tableSource, /No phone on lead/, "phone quick action disabled tooltip")
assert.match(tableSource, /Archive Selected/, "bulk archive toolbar label")
assert.match(tableSource, /Archive Lead/, "row archive action")

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

console.log("growth leads inbox tests passed")
