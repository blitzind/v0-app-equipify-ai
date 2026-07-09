/**
 * GE-v1-1 — operational baseline certification (static + contract tests).
 * Run: pnpm test:ge-v1-1-operational-baseline
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GE_V1_1_LAUNCH_RUNBOOK_QA_MARKER,
  GE_V1_1_LAUNCH_RUNBOOK_STEPS,
} from "../lib/growth/operational/ge-v1-1-launch-runbook"
import {
  GE_V1_1_MEDICAL_ICP_KIT_QA_MARKER,
  GE_V1_1_MEDICAL_SAVED_SEARCHES,
} from "../lib/growth/operational/ge-v1-1-medical-icp-kit"
import {
  applySenderMergeFieldsToText,
  buildSenderMergeFields,
  GROWTH_SENDER_MERGE_FIELD_LEGACY_ALIASES,
} from "../lib/growth/signatures/sender-merge-fields"
import { GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER } from "../lib/growth/navigation/growth-workspace-shell-navigation"
import { GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS } from "../lib/growth/navigation/growth-workspace-sidebar-ia"

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function testLegacySenderMergeFields() {
  const fields = buildSenderMergeFields(
    {
      id: "p1",
      sender_account_id: "s1",
      mailbox_connection_id: null,
      display_name: "Jamie Rivera",
      title: "Founder",
      email: "jamie@equipify.ai",
      phone: null,
      website: "https://equipify.ai",
      linkedin_url: null,
      avatar_url: null,
      logo_url: null,
      active: true,
      signature_template: "simple",
      notes: null,
      created_at: "",
      updated_at: "",
      deleted_at: null,
    },
    "jamie@equipify.ai",
    null,
    "Jamie Rivera\nFounder · Equipify",
  )
  const rendered = applySenderMergeFieldsToText(
    "Hi — {{sender_name}} ({{sender_title}}) · {{sender_email}}\n\n{{sender_signature}}",
    fields,
  )
  assert.match(rendered, /Jamie Rivera/)
  assert.match(rendered, /Founder/)
  assert.match(rendered, /jamie@equipify.ai/)
  assert.match(rendered, /Founder · Equipify/)
  assert.ok(Object.keys(GROWTH_SENDER_MERGE_FIELD_LEGACY_ALIASES).length >= 4)
}

function testRunbookTenSteps() {
  assert.equal(GE_V1_1_LAUNCH_RUNBOOK_STEPS.length, 10)
  assert.equal(GE_V1_1_LAUNCH_RUNBOOK_QA_MARKER, "ge-v1-1-launch-runbook-v1")
  assert.ok(fs.existsSync("app/(growth)/growth/runbook/page.tsx"))
}

function testMedicalIcpKit() {
  assert.equal(GE_V1_1_MEDICAL_SAVED_SEARCHES.length, 4)
  assert.equal(GE_V1_1_MEDICAL_ICP_KIT_QA_MARKER, "ge-v1-1-medical-icp-kit-v1")
  for (const row of GE_V1_1_MEDICAL_SAVED_SEARCHES) {
    assert.match(row.name, /^ICP · Medical ·/)
  }
  assert.ok(fs.existsSync("scripts/seed-ge-v1-1-operational-baseline.ts"))
}

function testNavigationPromotions() {
  assert.ok(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("audiences"))
  assert.ok(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("engagement"))
  assert.ok(!GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("share-pages"))
  assert.ok(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("training"))
  assert.ok(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("operations"))
  assert.equal(GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER, "growth-workspace-shell-nav-v11")
  const catalog = readSource("lib/growth/navigation/growth-route-catalog-data.ts")
  assert.match(catalog, /workspace-audiences/)
  assert.match(catalog, /workspace-runbook/)
}

function testSenderLaunchWiring() {
  assert.match(readSource("lib/growth/sendr/growth-sendr-launch-run-service.ts"), /preferredSenderAccountId/)
  assert.match(readSource("lib/growth/sequences/execution/sequence-send-builder.ts"), /resolvePreferredSenderAccountFromSendrLink/)
  assert.match(readSource("components/growth/sendr/growth-sendr-launch-sender-step.tsx"), /Choose sender identity/)
  assert.match(readSource("lib/growth/sendr/growth-sendr-page-templates.ts"), /equipify_demo/)
}

function testLaunchCompleteLinks() {
  const complete = readSource("components/growth/sendr/growth-sendr-launch-complete-step.tsx")
  assert.match(complete, /\/growth\/campaigns\/sequences/)
  assert.match(complete, /\/growth\/engagement/)
  assert.match(complete, /\/growth\/runbook/)
  assert.ok(!complete.includes("/admin/growth/sequences/execution"))
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "legacy sender merge fields", fn: testLegacySenderMergeFields },
  { name: "runbook ten steps", fn: testRunbookTenSteps },
  { name: "medical ICP kit", fn: testMedicalIcpKit },
  { name: "navigation promotions", fn: testNavigationPromotions },
  { name: "sender launch wiring", fn: testSenderLaunchWiring },
  { name: "launch complete workspace links", fn: testLaunchCompleteLinks },
]

let failed = 0
for (const t of tests) {
  try {
    t.fn()
    console.log(`ok\t${t.name}`)
  } catch (e) {
    failed += 1
    console.error(`fail\t${t.name}`)
    console.error(e)
  }
}

if (failed > 0) process.exit(1)
console.log(`\nAll ${tests.length} ge-v1-1 operational baseline tests passed.`)
