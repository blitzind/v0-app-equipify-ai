/**
 * GE-AIOS-15C — Intake Graph Binding certification.
 * Run: pnpm test:ge-aios-15c-intake-graph-binding
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_INTAKE_GRAPH_BINDING_15C_QA_MARKER,
  GROWTH_INTAKE_RELATIONSHIP_BINDING_QA_MARKER,
  buildIntakeRelationshipBindingIntent,
  extractRelationshipGraphFromLeadMetadata,
  mergeIntakeRelationshipBindingMetadata,
} from "../lib/growth/relationship/intake-relationship-graph-binding"
import { inferIntakeBindingSource } from "../lib/growth/relationship/infer-intake-binding-source"
import {
  buildRelationshipGraphContext,
  hasRelationshipGraphBinding,
} from "../lib/growth/relationship/relationship-graph-types"
import { isLegacyBuyingCommitteeWriteQuarantined } from "../lib/growth/relationship/legacy-buying-committee-quarantine"

const PHASE = "GE-AIOS-15C" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sliceFromExport(source: string, exportName: string): string {
  const start = source.indexOf(`export async function ${exportName}`)
  assert.ok(start >= 0, `${exportName} export missing`)
  const nextExport = source.indexOf("\nexport ", start + 1)
  return nextExport >= 0 ? source.slice(start, nextExport) : source.slice(start)
}

function main(): void {
  console.log(`[${PHASE}] Intake Graph Binding certification`)

  assert.equal(GROWTH_INTAKE_GRAPH_BINDING_15C_QA_MARKER, "ge-aios-15c-intake-graph-binding-v1")
  assert.equal(isLegacyBuyingCommitteeWriteQuarantined(), true)

  const bindSource = readSource("lib/growth/relationship/bind-intake-relationship-graph.ts")
  assert.match(bindSource, /export async function bindIntakeRelationshipGraph/)
  assert.match(bindSource, /buying_committee_intelligence_members/)
  assert.doesNotMatch(bindSource, /buying_committees|buying_committee_members|buying_committee_maps/)
  assert.doesNotMatch(bindSource, /\.from\(["']buying_committees["']\)/)

  const leadRepo = readSource("lib/growth/lead-repository.ts")
  const createLeadFn = sliceFromExport(leadRepo, "createGrowthLead")
  assert.match(createLeadFn, /bindIntakeRelationshipGraph/)
  assert.match(createLeadFn, /buildIntakeBindingInputFromCreateLead/)
  assert.match(createLeadFn, /lead_create_intake_graph_binding_failed/)
  assert.doesNotMatch(createLeadFn, /if \(bindingPlan\) throw/)

  const datamoon = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")
  assert.match(datamoon, /intakeBindingSource:\s*"datamoon"/)
  assert.match(datamoon, /createGrowthLead/)

  const browser = readSource("lib/growth/browser-intake/create-browser-intake-contact.ts")
  assert.match(browser, /intakeBindingSource:\s*"browser_capture"/)
  assert.match(browser, /createGrowthLead/)
  assert.doesNotMatch(browser, /\.from\(["']buying_committees["']\)/)

  const manual = readSource("lib/growth/manual-entry/create-manual-growth-contact.ts")
  assert.match(manual, /intakeBindingSource:\s*"manual_lead"/)

  const manualRoute = readSource("app/api/platform/growth/leads/route.ts")
  assert.match(manualRoute, /intakeBindingSource/)

  const unified = readSource("lib/growth/revenue-workflow/unified-revenue-workflow-lead-resolver.ts")
  assert.match(unified, /mapIntakeSourceToBindingSource/)
  assert.match(unified, /intakeBindingSource:/)

  const promote = readSource("lib/growth/acquisition/promote-verified-contact-to-lead.ts")
  assert.match(promote, /intakeBindingSource:\s*"discovery_import"/)

  const inboxBridge = readSource("lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge.ts")
  assert.match(inboxBridge, /resolveUnifiedLeadFromIntake/)

  const intent = buildIntakeRelationshipBindingIntent("datamoon")
  assert.equal(intent.use_legacy_buying_committee_writes, false)
  assert.ok(intent.bind_canonical_company)

  assert.equal(inferIntakeBindingSource({ metadata: { datamoon: { run_id: "r1" } } }), "datamoon")
  assert.equal(
    inferIntakeBindingSource({ metadata: { browser_extension: { source_platform: "linkedin" } } }),
    "browser_capture",
  )
  assert.equal(inferIntakeBindingSource({ sourceKind: "manual" }), "manual_lead")
  assert.equal(
    inferIntakeBindingSource({ metadata: { leadInboxDedupeHash: "abc" } }),
    "discovery_import",
  )

  const leadId = "11111111-1111-4111-8111-111111111111"
  const companyId = "22222222-2222-4222-8222-222222222222"
  const graph = buildRelationshipGraphContext({
    lead_id: leadId,
    canonical_company_id: companyId,
    person_id: "33333333-3333-4333-8333-333333333333",
    committee_role: "economic_buyer",
  })

  const merged = mergeIntakeRelationshipBindingMetadata(
    { datamoon: { run_id: "run-1" }, source_channel: "datamoon_audience" },
    graph,
    {
      company_domain: "example.com",
      company_source: "companies_primary_domain",
      relationship_binding_status: "bound",
      relationship_binding_attempted_at: new Date().toISOString(),
      relationship_binding_warnings: [],
      source_lineage: { intake_source: "datamoon", company_name: "Example Co" },
      primary_person_id: graph.person_id,
      person_company_role_id: "44444444-4444-4444-8444-444444444444",
      committee_role: "economic_buyer",
      intent,
    },
  )

  assert.equal(merged.canonical_company_id, companyId)
  assert.equal(merged.company_domain, "example.com")
  assert.equal(merged.company_source, "companies_primary_domain")
  assert.equal(merged.relationship_binding_status, "bound")
  assert.ok(Array.isArray(merged.relationship_binding_warnings))
  assert.equal(merged.source_lineage.intake_source, "datamoon")
  assert.equal(merged.primary_person_id, graph.person_id)
  assert.equal(merged.person_company_role_id, "44444444-4444-4444-8444-444444444444")
  assert.equal(merged.committee_role, "economic_buyer")
  assert.equal(merged.relationship_binding_qa_marker, GROWTH_INTAKE_RELATIONSHIP_BINDING_QA_MARKER)
  assert.equal(merged.relationship_binding_15c_qa_marker, GROWTH_INTAKE_GRAPH_BINDING_15C_QA_MARKER)
  assert.equal((merged.datamoon as { run_id: string }).run_id, "run-1")

  const extracted = extractRelationshipGraphFromLeadMetadata({
    lead_id: leadId,
    metadata: merged,
  })
  assert.ok(hasRelationshipGraphBinding(extracted))
  assert.equal(extracted.canonical_company_id, companyId)

  const manualIntent = buildIntakeRelationshipBindingIntent("manual_lead")
  assert.equal(manualIntent.bind_person, false)

  const migrationDir = path.join(process.cwd(), "supabase/migrations")
  const newMigrations = fs
    .readdirSync(migrationDir)
    .filter((name) => name.includes("15c") || name.includes("intake_graph"))
  assert.equal(newMigrations.length, 0, "15C must not add schema migrations")

  assert.doesNotMatch(readSource("lib/growth/relationship/index.ts"), /fetch\(/)

  console.log(`[${PHASE}] PASS — Intake Graph Binding certified (local)`)
}

main()
