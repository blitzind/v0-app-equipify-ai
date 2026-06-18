/**
 * Equipify Core production certification foundation (EC-1).
 * Pure structural verification — no network, browser, Stripe, or Supabase mutations.
 *
 * Run: pnpm exec tsx scripts/test-equipify-core-production-certification-foundation.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  EQUIPIFY_CORE_CERTIFICATION_CATEGORIES,
  EQUIPIFY_CORE_CERTIFICATION_QA_MARKER,
  EQUIPIFY_CORE_CRITICAL_REVENUE_RUNTIME_IDS,
  EQUIPIFY_CORE_DEPENDENCIES,
  EQUIPIFY_CORE_PRODUCTION_HOST,
  EQUIPIFY_CORE_RUNTIME_INVENTORY,
} from "../lib/certification/equipify-core-runtime-inventory"
import {
  getCriticalRoutes,
  getDependencies,
  getDependencyInventory,
  groupByCategory,
  summarizeCertificationInventory,
  validateFullInventory,
} from "../lib/certification/equipify-core-certification-helpers"

const ROOT = process.cwd()

const REQUIRED_FILES = [
  "docs/EQUIPIFY_CORE_PRODUCTION_CERTIFICATION.md",
  "docs/EQUIPIFY_PLAN_NAMING_MIGRATION.md",
  "lib/certification/equipify-core-runtime-inventory.ts",
  "lib/certification/equipify-core-certification-helpers.ts",
  "lib/certification/equipify-core-production-certification.ts",
  "lib/certification/equipify-core-revenue-certification.ts",
  "lib/certification/equipify-core-revenue-dependency-inventory.ts",
  "scripts/certify-equipify-core-production.ts",
  "scripts/test-equipify-core-production-certification-foundation.ts",
] as const

const REQUIRED_DOC_SECTIONS = [
  "## Authentication",
  "## Onboarding",
  "## Customers",
  "## Prospects",
  "## Work Orders",
  "## Quotes",
  "## Invoices",
  "## Payments",
  "## Purchase Orders",
  "## Portal",
  "## Billing",
  "## Mobile",
  "## Notifications",
  "## Settings",
  "## Production Test Matrix",
  "## Critical Revenue Path",
  "## Billing Path",
  "## Portal Path",
  "## Technician Path",
] as const

const REQUIRED_NAMING_SURFACES = [
  "Workspace switcher",
  "Sidebar badges",
  "Account footer",
  "Billing page",
  "Onboarding plan cards",
  "Upgrade copy",
] as const

function assertRequiredFilesExist(): void {
  for (const relativePath of REQUIRED_FILES) {
    const absolute = path.join(ROOT, relativePath)
    assert.ok(fs.existsSync(absolute), `Missing required file: ${relativePath}`)
    console.log(`  ✓ file exists: ${relativePath}`)
  }
}

function assertCertificationDocStructure(): void {
  const docPath = path.join(ROOT, "docs/EQUIPIFY_CORE_PRODUCTION_CERTIFICATION.md")
  const content = fs.readFileSync(docPath, "utf8")

  assert.match(content, /EC-1/)
  assert.match(content, /\|\s*Untested\s*\|/)
  assert.match(content, new RegExp(EQUIPIFY_CORE_PRODUCTION_HOST.replace(/\./g, "\\.")))
  console.log(`  ✓ certification doc references production host`)

  for (const section of REQUIRED_DOC_SECTIONS) {
    assert.ok(content.includes(section), `Certification doc missing section: ${section}`)
    console.log(`  ✓ doc section: ${section}`)
  }

  for (const category of EQUIPIFY_CORE_CERTIFICATION_CATEGORIES) {
    const label = category.replace(/_/g, " ")
    assert.ok(
      content.toLowerCase().includes(label) || content.includes(category),
      `Certification doc should mention category: ${category}`,
    )
  }
  console.log(`  ✓ all ${EQUIPIFY_CORE_CERTIFICATION_CATEGORIES.length} certification categories referenced in doc`)
}

function assertNamingMigrationDocStructure(): void {
  const docPath = path.join(ROOT, "docs/EQUIPIFY_PLAN_NAMING_MIGRATION.md")
  const content = fs.readFileSync(docPath, "utf8")

  assert.match(content, /Equipify Solo/)
  assert.match(content, /Equipify Core/)
  assert.match(content, /Equipify Growth/)
  assert.match(content, /Equipify Scale/)
  assert.match(content, /Growth Engine/)
  assert.match(content, /NOT part of EC-1/i)
  console.log(`  ✓ naming migration doc has locked plan decisions`)

  for (const surface of REQUIRED_NAMING_SURFACES) {
    assert.ok(content.includes(surface), `Naming doc missing surface: ${surface}`)
    console.log(`  ✓ naming surface documented: ${surface}`)
  }
}

function assertInventoryIntegrity(): void {
  assert.equal(EQUIPIFY_CORE_CERTIFICATION_QA_MARKER, "equipify-core-certification-ec-1-v1")
  console.log(`  ✓ QA marker: ${EQUIPIFY_CORE_CERTIFICATION_QA_MARKER}`)

  assert.ok(EQUIPIFY_CORE_RUNTIME_INVENTORY.length >= 40, "runtime inventory should cover core surfaces")
  console.log(`  ✓ runtime inventory entries: ${EQUIPIFY_CORE_RUNTIME_INVENTORY.length}`)

  const validation = validateFullInventory()
  if (!validation.ok) {
    console.error(validation.errors.join("\n"))
  }
  assert.ok(validation.ok, "runtime inventory validation failed")
  console.log(`  ✓ runtime inventory metadata valid`)

  const summary = summarizeCertificationInventory()
  assert.equal(summary.missingCategories.length, 0)
  assert.equal(summary.categoriesPresent.length, EQUIPIFY_CORE_CERTIFICATION_CATEGORIES.length)
  console.log(`  ✓ all certification categories present in runtime inventory`)

  const groups = groupByCategory()
  assert.equal(groups.length, EQUIPIFY_CORE_CERTIFICATION_CATEGORIES.length)
  for (const group of groups) {
    assert.ok(group.entries.length > 0, `category has no runtime entries: ${group.category}`)
  }
  console.log(`  ✓ groupByCategory() covers ${groups.length} categories`)

  const criticalRoutes = getCriticalRoutes()
  assert.ok(criticalRoutes.length >= 15, "expected substantial critical/high route coverage")
  console.log(`  ✓ getCriticalRoutes(): ${criticalRoutes.length} critical+high entries`)

  const deps = getDependencies()
  assert.ok(deps.length >= 5)
  for (const dep of deps) {
    assert.ok(EQUIPIFY_CORE_DEPENDENCIES.includes(dep))
  }
  console.log(`  ✓ getDependencies(): ${deps.length} unique dependencies`)

  const depInventory = getDependencyInventory()
  assert.equal(depInventory.length, deps.length)
  for (const row of depInventory) {
    assert.ok(row.routeCount > 0)
    assert.ok(row.label.length > 0)
  }
  console.log(`  ✓ dependency inventory rows: ${depInventory.length}`)

  const summaryAgain = summarizeCertificationInventory()
  assert.ok(summaryAgain.criticalRouteCount >= 10)
  assert.ok(summaryAgain.totalRuntimeEntries === EQUIPIFY_CORE_RUNTIME_INVENTORY.length)
  console.log(
    `  ✓ summarizeCertificationInventory(): critical=${summaryAgain.criticalRouteCount}, high=${summaryAgain.highRouteCount}`,
  )
}

function assertCriticalRevenueCoverage(): void {
  const ids = new Set(EQUIPIFY_CORE_RUNTIME_INVENTORY.map((e) => e.id))
  for (const requiredId of EQUIPIFY_CORE_CRITICAL_REVENUE_RUNTIME_IDS) {
    assert.ok(ids.has(requiredId), `critical revenue runtime id missing: ${requiredId}`)
  }
  console.log(
    `  ✓ critical revenue path covers ${EQUIPIFY_CORE_CRITICAL_REVENUE_RUNTIME_IDS.length} runtime ids`,
  )

  const revenueRoutes = [
    "/login",
    "/onboarding",
    "/customers",
    "/work-orders",
    "/quotes",
    "/invoices",
    "/api/email/quote",
    "/api/email/invoice",
    "/api/stripe/webhook",
    "/api/blitzpay/webhook",
    "/settings/billing",
    "/settings/payments",
    "/portal/login",
  ]
  const inventoryRoutes = new Set(EQUIPIFY_CORE_RUNTIME_INVENTORY.map((e) => e.route))
  for (const route of revenueRoutes) {
    assert.ok(inventoryRoutes.has(route), `revenue route not inventoried: ${route}`)
  }
  console.log(`  ✓ ${revenueRoutes.length} canonical revenue routes present in inventory`)
}

function main(): void {
  console.log(`\n=== Equipify Core certification foundation (${EQUIPIFY_CORE_CERTIFICATION_QA_MARKER}) ===\n`)

  console.log("Inventory integrity")
  assertRequiredFilesExist()
  assertInventoryIntegrity()
  assertCriticalRevenueCoverage()

  console.log("\nDocumentation structure")
  assertCertificationDocStructure()
  assertNamingMigrationDocStructure()

  const summary = summarizeCertificationInventory()

  console.log("\nEquipify Core certification foundation PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: EQUIPIFY_CORE_CERTIFICATION_QA_MARKER,
        production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
        runtime_entries: summary.totalRuntimeEntries,
        categories: summary.byCategory,
        criticality: summary.byCriticality,
        dependencies: summary.uniqueDependencies,
        network_activity: false,
      },
      null,
      2,
    ),
  )
}

main()
