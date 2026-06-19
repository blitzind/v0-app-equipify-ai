/**
 * Regression checks for GE-MAIL-1D Domain deliverability setup instructions.
 * Run: pnpm test:growth-domain-deliverability-setup
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGoogleWorkspaceSpfRecord,
  buildRecommendedDmarcRecord,
  computeEqualWeightDeliverabilityBreakdown,
  deliverabilitySetupHealthLabel,
  GROWTH_DOMAIN_DELIVERABILITY_SETUP_QA_MARKER,
  GOOGLE_WORKSPACE_MX_RECORDS,
  pointsForRecordStatus,
  recordStatusFromCheck,
} from "../lib/growth/deliverability/domain-deliverability-setup-types"
import {
  GROWTH_DELIVERABILITY_DNS_SETUP_ARCHITECTURE_DIAGRAM,
  GROWTH_DELIVERABILITY_DNS_SETUP_ARCHITECTURE_QA_MARKER,
  GROWTH_DELIVERABILITY_DNS_SETUP_OPERATOR_RUNBOOK,
} from "../lib/growth/deliverability/deliverability-dns-setup-architecture"
import { mergeObservedDnsFromSource } from "../lib/growth/deliverability/domain-deliverability-setup-service"
import { computeDeliverabilityScore } from "../lib/growth/deliverability/deliverability-score"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_DOMAIN_DELIVERABILITY_SETUP_QA_MARKER, "growth-domain-deliverability-setup-1d-v1")
  assert.equal(GROWTH_DELIVERABILITY_DNS_SETUP_ARCHITECTURE_QA_MARKER, "growth-deliverability-dns-setup-architecture-1d-v1")
  assert.equal(GOOGLE_WORKSPACE_MX_RECORDS.length, 5)
  assert.equal(buildGoogleWorkspaceSpfRecord(), "v=spf1 include:_spf.google.com ~all")
  assert.match(buildRecommendedDmarcRecord("Example.COM"), /dmarc@example\.com/i)

  const fullCheck = {
    spf_present: true,
    spf_valid: true,
    dkim_present: true,
    dkim_valid: true,
    dmarc_present: true,
    dmarc_valid: true,
    mx_present: true,
    mx_valid: true,
    mx_provider: "google" as const,
  }

  assert.deepEqual(computeEqualWeightDeliverabilityBreakdown(fullCheck), {
    spf: 25,
    dkim: 25,
    dmarc: 25,
    mx: 25,
    total: 100,
  })
  assert.equal(deliverabilitySetupHealthLabel(100), "Healthy")
  assert.equal(deliverabilitySetupHealthLabel(75), "Warning")
  assert.equal(deliverabilitySetupHealthLabel(25), "At Risk")

  assert.equal(recordStatusFromCheck(true, true), "valid")
  assert.equal(pointsForRecordStatus("valid"), 25)
  assert.equal(pointsForRecordStatus("missing"), 0)

  assert.equal(
    computeDeliverabilityScore({
      ...fullCheck,
      dmarc_present: false,
      dmarc_valid: false,
      warnings: [],
    }),
    75,
  )

  assert.equal(
    computeDeliverabilityScore({
      ...fullCheck,
      mx_present: false,
      mx_valid: false,
      warnings: [],
    }),
    75,
  )

  const merged = mergeObservedDnsFromSource(
    "target.com",
    "google",
    {
      root_txt: ["v=spf1 include:_spf.google.com ~all"],
      dmarc_txt: ["v=DMARC1; p=none; rua=mailto:dmarc@source.com"],
      mx: [{ exchange: "ASPMX.L.GOOGLE.COM", priority: 1 }],
      dkim: { selector: "google", records: ["v=DKIM1; k=rsa; p=abc"] },
    },
    "google",
  )

  assert.equal(merged.isGoogle, true)
  assert.equal(merged.spfValue, "v=spf1 include:_spf.google.com ~all")
  assert.equal(merged.mxRecords[0]?.value, "ASPMX.L.GOOGLE.COM")
  assert.match(merged.dkim.records[0]?.host ?? "", /google\._domainkey\.target\.com/)

  assert.match(GROWTH_DELIVERABILITY_DNS_SETUP_ARCHITECTURE_DIAGRAM, /setup-instructions/)
  assert.ok(GROWTH_DELIVERABILITY_DNS_SETUP_OPERATOR_RUNBOOK.length >= 5)

  const serviceSource = readSource("lib/growth/deliverability/domain-deliverability-setup-service.ts")
  assert.match(serviceSource, /buildDomainDeliverabilitySetupInstructions/)
  assert.match(serviceSource, /copyDomainDeliverabilitySetupFromSource/)

  const setupRoute = readSource("app/api/platform/growth/deliverability/domain/[id]/setup-instructions/route.ts")
  assert.match(setupRoute, /buildDomainDeliverabilitySetupInstructions/)

  const copyRoute = readSource("app/api/platform/growth/deliverability/domain/[id]/copy-setup/route.ts")
  assert.match(copyRoute, /copyDomainDeliverabilitySetupFromSource/)

  const drawerSource = readSource("components/growth/growth-domain-deliverability-setup-drawer.tsx")
  assert.match(drawerSource, /GrowthDomainDeliverabilitySetupDrawer/)
  assert.match(drawerSource, /Verify DNS/)
  assert.match(drawerSource, /Copy setup/)

  const dashboardSource = readSource("components/growth/growth-deliverability-dashboard.tsx")
  assert.match(dashboardSource, /View Setup Instructions/)
  assert.match(dashboardSource, /GrowthDomainDeliverabilitySetupDrawer/)

  console.log("growth domain deliverability setup checks passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
