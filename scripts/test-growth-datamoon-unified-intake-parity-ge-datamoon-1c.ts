/**
 * GE-DATAMOON-1C — Datamoon unified intake parity certification.
 * Run: pnpm test:growth-datamoon-unified-intake-parity-ge-datamoon-1c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildDatamoonUnifiedIntakePayload,
  formatDatamoonUnifiedIntakeRecordMessage,
} from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-intake"
import { normalizeDatamoonAudienceRecord } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import { sanitizeDatamoonProviderMetadata } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-sanitizer"
import { normalizeLeadIntakeSource } from "../lib/growth/revenue-workflow/normalize-lead-intake-source"
import { LEAD_INTAKE_SOURCES } from "../lib/growth/revenue-workflow/unified-lead-intake-types"

export const GROWTH_DATAMOON_UNIFIED_INTAKE_PARITY_GE_DATAMOON_1C_QA_MARKER =
  "growth-datamoon-unified-intake-parity-ge-datamoon-1c-v1" as const

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

async function main() {
  const checks: string[] = []

  assert.ok((LEAD_INTAKE_SOURCES as readonly string[]).includes("datamoon"))
  checks.push("datamoon_in_lead_intake_sources")

  const normalized = normalizeDatamoonAudienceRecord(
    {
      first_name: "Grace",
      last_name: "Hopper",
      business_email: "grace@naval.mil",
      personal_emails: "grace.personal@example.com",
      personal_phone: "555-867-5309",
      linkedin_url: "https://linkedin.com/in/gracehopper",
      personal_address: "1 Navy Way",
      personal_city: "Arlington",
      personal_state: "VA",
      personal_zip: "22202",
      contact_country: "US",
      company_domain: "naval.mil",
    },
    { providerMode: "ext" },
  )

  const intakePayload = buildDatamoonUnifiedIntakePayload({
    run: {
      id: "run-1",
      datamoonAudienceId: "audience-1",
      providerMode: "ext",
      audienceType: "b2b",
    },
    record: {
      id: "record-1",
      recordIndex: 3,
      normalized,
    },
    leadId: "lead-1",
  })

  assert.equal(intakePayload.source, "datamoon")
  assert.equal(intakePayload.leadId, "lead-1")
  assert.equal(intakePayload.company.name, "naval.mil")
  assert.match(intakePayload.company.website ?? "", /naval\.mil/)
  assert.equal(intakePayload.contact.firstName, "Grace")
  assert.equal(intakePayload.contact.lastName, "Hopper")
  assert.equal(intakePayload.contact.email, "grace@naval.mil")
  assert.equal(intakePayload.contact.phone, "5558675309")
  assert.match(intakePayload.contact.linkedinUrl ?? "", /gracehopper/)
  assert.equal(intakePayload.metadata.datamoon_import_run_id, "run-1")
  assert.equal(intakePayload.metadata.datamoon_audience_id, "audience-1")
  assert.equal(intakePayload.metadata.datamoon_record_id, "record-1")
  assert.equal(intakePayload.metadata.record_index, 3)
  assert.equal(intakePayload.metadata.provider_mode, "ext")
  assert.equal(intakePayload.metadata.audience_type, "b2b")
  assert.equal(intakePayload.metadata.business_email, "grace@naval.mil")
  assert.equal(intakePayload.metadata.personal_email, "grace.personal@example.com")
  assert.equal(intakePayload.metadata.address_line1, "1 Navy Way")
  assert.equal(intakePayload.metadata.city, "Arlington")
  assert.equal(intakePayload.metadata.state, "VA")
  assert.equal(intakePayload.metadata.postal_code, "22202")
  assert.equal(intakePayload.metadata.country, "US")
  checks.push("datamoon_intake_payload_mapping")

  const canonical = normalizeLeadIntakeSource(intakePayload)
  assert.equal(canonical.source, "datamoon")
  assert.equal(canonical.leadId, "lead-1")
  assert.equal(canonical.email, "grace@naval.mil")
  checks.push("datamoon_intake_normalizes")

  const serviceSource = read("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")
  assert.match(serviceSource, /runUnifiedRevenueWorkflowAfterIntake/)
  assert.match(serviceSource, /recomputeGrowthLeadWorkflowSignals/)
  const workflowCallIndex = serviceSource.indexOf("runUnifiedRevenueWorkflowAfterIntake")
  const leadCreateIndex = serviceSource.indexOf("createGrowthLead")
  const recomputeIndex = serviceSource.indexOf("recomputeGrowthLeadWorkflowSignals")
  assert.ok(leadCreateIndex >= 0 && recomputeIndex > leadCreateIndex)
  assert.ok(workflowCallIndex > recomputeIndex)
  checks.push("import_calls_unified_intake_after_lead_creation")

  assert.doesNotMatch(serviceSource, /executeOutreach|bulkEnroll|sequencePattern|createCampaign|sendOutbound/i)
  checks.push("no_outreach_or_sequence_enrollment")

  assert.match(serviceSource, /formatDatamoonUnifiedIntakeRecordMessage/)
  assert.match(serviceSource, /unifiedIntakeWarnings/)
  assert.match(serviceSource, /unified_intake_warnings/)
  checks.push("workflow_failure_does_not_fail_import")

  const skippedMessage = formatDatamoonUnifiedIntakeRecordMessage({
    skipped: true,
    skipReason: "unified_revenue_workflow_disabled",
  })
  assert.match(skippedMessage, /Imported into growth\.leads\./)
  assert.match(skippedMessage, /Unified intake skipped/)
  assert.doesNotMatch(skippedMessage, /grace@naval\.mil/)
  checks.push("sanitized_workflow_skip_message")

  const sanitizedWarning = sanitizeDatamoonProviderMetadata({
    unified_intake_warnings: [{ record_id: "record-1", skip_reason: "person@example.com failed" }],
  }) as { unified_intake_warnings: Array<{ skip_reason: string }> }
  assert.match(sanitizedWarning.unified_intake_warnings[0]!.skip_reason, /REDACTED_EMAIL/)
  checks.push("sanitized_run_warnings")

  const panelSource = read("components/growth/lead-sources/growth-datamoon-audience-import-panel.tsx")
  assert.match(panelSource, /dry-run/i)
  checks.push("dry_run_ui_preserved")

  const configSource = read("lib/growth/providers/datamoon/datamoon-config.ts")
  assert.match(configSource, /DATAMOON_DRY_RUN_ONLY/)
  assert.match(configSource, /DATAMOON_PROVIDER_ENABLED/)
  checks.push("dry_run_disabled_safety_preserved")

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_DATAMOON_UNIFIED_INTAKE_PARITY_GE_DATAMOON_1C_QA_MARKER,
        checks,
        status: "pass",
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
