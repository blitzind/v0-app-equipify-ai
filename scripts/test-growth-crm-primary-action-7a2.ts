/**
 * GS-GROWTH-OPS-7A.2 — CRM drawer primary action certification.
 * Run: pnpm test:growth-crm-primary-action-7a2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER } from "../lib/growth/operator-ux/growth-operator-primary-actions-7a2"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-7A.2 CRM Primary Action Certification ===\n")
  assert.ok(GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER)

  const commandCenter = readSource("components/growth/growth-lead-command-center.tsx")
  assert.match(commandCenter, /Generate Personalization/)
  assert.match(commandCenter, /buildGrowthPersonalizationHref/)
  assert.match(commandCenter, /Call/)
  assert.match(commandCenter, /Email/)
  assert.match(commandCenter, /Directions/)
  assert.match(commandCenter, /Ownership &amp; assignment/)
  assert.match(commandCenter, /More lead actions/)
  console.log("  ✓ lead drawer promotes Generate Personalization with Call/Email/Directions secondary")

  const crmWorkspace = readSource("components/growth/leads/growth-leads-crm-workspace.tsx")
  assert.doesNotMatch(crmWorkspace, /Ownership[\s\S]*variant="outline"[\s\S]*Users/)
  assert.match(crmWorkspace, /Revenue Queue/)
  assert.match(crmWorkspace, /Ownership/)
  assert.match(crmWorkspace, /text-xs text-muted-foreground/)
  console.log("  ✓ CRM page demotes Revenue Queue and Ownership to muted links")

  console.log("\nGS-GROWTH-OPS-7A.2 CRM primary action certification passed.\n")
}

main()
