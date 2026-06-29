/**
 * GE-IRE-6G — Account Outreach Strategy panel certification.
 * Run: pnpm test:growth-account-outreach-strategy-panel
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertAccountOutreachStrategyPanelViewHasNoSensitiveData,
  buildAccountOutreachStrategyPanelView,
  sanitizeAccountOutreachStrategyPanelView,
} from "../lib/growth/contact-verification/account-outreach-strategy-panel-view"
import {
  GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER,
  isAccountOutreachStrategyPanelEnabled,
  isAccountOutreachStrategyPanelEnabledClient,
} from "../lib/growth/contact-verification/account-outreach-strategy-panel-feature"
import { recommendAccountOutreach } from "../lib/growth/contact-verification/account-outreach-recommendation"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const saved = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }) as Promise<T>
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-6G Account Outreach Strategy Panel Certification ===\n")

  assert.equal(GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER, "account-outreach-strategy-panel-v1")
  assert.equal(isAccountOutreachStrategyPanelEnabled(), false)
  assert.equal(
    isAccountOutreachStrategyPanelEnabled({ GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL: "true" }),
    true,
  )
  console.log("  ✓ Feature flag false by default")

  const panelSource = readSource(
    "components/growth/prospect-search/prospect-search-account-outreach-strategy-panel.tsx",
  )
  assert.match(panelSource, /isAccountOutreachStrategyPanelEnabledClient/)
  assert.match(panelSource, /if \(!panelEnabled\) return null/)
  assert.match(panelSource, /data-account-outreach-strategy-panel="read-only"/)
  assert.match(panelSource, /disabled/)
  assert.doesNotMatch(panelSource, /onClick=\{[^}]*enroll/i)
  assert.doesNotMatch(panelSource, /onClick=\{[^}]*send/i)
  console.log("  ✓ Panel hidden when client flag off; action buttons disabled only")

  await withEnv({ GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL: undefined }, async () => {
    const disabled = await buildAccountOutreachStrategyPanelView({
      companyName: "Acme",
      contacts: [{ firstName: "Jane", lastName: "Doe", jobTitle: "COO", email: "jane@acme.com" }],
    })
    assert.equal(disabled, null)
  })
  console.log("  ✓ Server builder no-op when flag off")

  const input = {
    companyName: "Precision Biomedical",
    domain: "precisionbiomedical.com",
    industry: "healthcare",
    targetUseCase: "service_operations" as const,
    contacts: [
      {
        firstName: "Chris",
        lastName: "Taylor",
        jobTitle: "VP Operations",
        department: "operations",
        email: "chris.taylor@precisionbiomedical.com",
        phone: "+1-555-0100",
        linkedinUrl: "https://linkedin.com/in/chris-taylor",
      },
      {
        firstName: "Pat",
        lastName: "Reed",
        jobTitle: "Procurement Manager",
        department: "finance",
        email: "pat.reed@precisionbiomedical.com",
      },
    ],
  }

  const view = await withEnv({ GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL: "true" }, async () =>
    buildAccountOutreachStrategyPanelView(input, { skipDns: true }),
  )
  assert.ok(view)
  assert.equal(view?.qa_marker, GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER)
  assert.ok(view?.primary)
  assert.ok(view?.backups.length >= 0)
  assert.ok(view?.staged_plan.length >= 1)
  assert.ok(assertAccountOutreachStrategyPanelViewHasNoSensitiveData(view))
  console.log("  ✓ Flag on builds read-only sanitized panel view")

  const full = await recommendAccountOutreach(input, { skipDns: true })
  const masked = sanitizeAccountOutreachStrategyPanelView(full, {
    visibleEmails: ["chris.taylor@precisionbiomedical.com"],
  })
  assert.equal(masked.primary?.recommended_email, "chris.taylor@precisionbiomedical.com")
  assert.ok(assertAccountOutreachStrategyPanelViewHasNoSensitiveData(masked, {
    allowEmails: ["chris.taylor@precisionbiomedical.com"],
  }))
  assert.ok(masked.primary?.recommended_email?.includes("pat.reed") === false)
  assert.ok(masked.primary?.recommended_email !== "pat.reed@precisionbiomedical.com")
  console.log("  ✓ Email masking respects visible page emails")

  const apiSource = readSource(
    "app/api/platform/growth/prospect-search/account-outreach-strategy/route.ts",
  )
  assert.match(apiSource, /isAccountOutreachStrategyPanelEnabled/)
  assert.match(apiSource, /panel_disabled/)
  assert.ok(!apiSource.includes("supabase.from"))
  assert.ok(!apiSource.includes("enrollContact"))
  console.log("  ✓ Diagnostic API gated and read-only")

  const intelligencePanelSource = readSource(
    "components/growth/prospect-search/company-contact-intelligence-panel.tsx",
  )
  assert.match(intelligencePanelSource, /ProspectSearchAccountOutreachStrategyPanel/)
  assert.ok(!intelligencePanelSource.includes("account_outreach_strategy:"))
  console.log("  ✓ Wired into company contact intelligence panel without row shape changes")

  const nextConfig = readSource("next.config.mjs")
  assert.match(nextConfig, /NEXT_PUBLIC_GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL/)
  console.log("  ✓ Client env exposure in next.config")

  console.log("\nGE-IRE-6G account outreach strategy panel certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
