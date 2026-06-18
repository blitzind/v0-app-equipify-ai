/**
 * EC-5 — plan-aware workspace branding verification (local only, no network).
 *
 * Run: pnpm exec tsx scripts/test-equipify-plan-display-name.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { getEquipifyPlanDisplayName } from "../lib/billing/get-equipify-plan-display-name"
import {
  getOrganizationPlanDisplay,
  getOrganizationPlanDisplayFromWorkspace,
} from "../lib/billing/get-organization-plan-display"
import type { OrganizationSubscription } from "../lib/billing/subscriptions"
import type { TenantWorkspace } from "../lib/tenant-data"

function baseSubscription(overrides: Partial<OrganizationSubscription>): OrganizationSubscription {
  return {
    id: "sub-1",
    organization_id: "org-1",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    plan_id: "solo",
    intended_plan_id: null,
    billing_cycle: "monthly",
    status: "active",
    trial_starts_at: null,
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  }
}

function workspaceFixture(
  overrides: Partial<TenantWorkspace> & {
    organizationSubscription?: TenantWorkspace["organizationSubscription"]
  },
): TenantWorkspace {
  return {
    id: "ws-1",
    name: "Test Org",
    slug: "test",
    planId: "solo",
    billingCycle: "monthly",
    stripeCustomerId: "",
    stripeSubscriptionId: "",
    subscriptionStatus: "active",
    trialEndsAt: "",
    currentPeriodEnd: "",
    logoUrl: "",
    documentLogoUrl: "",
    primaryColor: "#000",
    companyEmail: "",
    companyPhone: "",
    companyWebsite: "",
    companyAddress: "",
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    currency: "USD",
    secondaryBrandColor: "",
    whiteLabelSettings: {},
    seatCount: 1,
    ownerId: "u-1",
    createdAt: "",
    ...overrides,
  }
}

function main(): void {
  console.log("\n=== EC-5 plan display verification ===\n")

  assert.equal(getEquipifyPlanDisplayName({ planId: "solo" }), "Equipify Solo")
  assert.equal(getEquipifyPlanDisplayName({ planId: "core" }), "Equipify Core")
  assert.equal(getEquipifyPlanDisplayName({ planId: "growth" }), "Equipify Growth")
  assert.equal(getEquipifyPlanDisplayName({ planId: "scale" }), "Equipify Scale")
  assert.equal(getEquipifyPlanDisplayName({ planId: "enterprise" }), "Equipify Enterprise")
  assert.equal(getEquipifyPlanDisplayName({ planId: "starter" }), "Equipify Solo")
  assert.equal(getEquipifyPlanDisplayName({}), "Equipify")
  assert.equal(getEquipifyPlanDisplayName({ planId: "unknown-tier" }), "Equipify")
  console.log("  ✓ getEquipifyPlanDisplayName mappings + fallback")

  assert.equal(
    getOrganizationPlanDisplay({ subscription: baseSubscription({ plan_id: "solo" }) }),
    "Equipify Solo",
  )
  assert.equal(
    getOrganizationPlanDisplay({ subscription: baseSubscription({ plan_id: "core" }) }),
    "Equipify Core",
  )
  assert.equal(
    getOrganizationPlanDisplay({ subscription: baseSubscription({ plan_id: "growth" }) }),
    "Equipify Growth",
  )
  assert.equal(
    getOrganizationPlanDisplay({ subscription: baseSubscription({ plan_id: "scale" }) }),
    "Equipify Scale",
  )
  assert.equal(
    getOrganizationPlanDisplay({ subscription: baseSubscription({ plan_id: "enterprise" }) }),
    "Equipify Enterprise",
  )
  assert.equal(getOrganizationPlanDisplay({ subscription: null }), "Equipify")
  assert.equal(getOrganizationPlanDisplay({ tenantSubscription: null }), "Equipify")
  console.log("  ✓ getOrganizationPlanDisplay per plan + missing subscription fallback")

  const trialing = baseSubscription({
    plan_id: "core",
    status: "trialing",
    trial_ends_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
  })
  assert.equal(getOrganizationPlanDisplay({ subscription: trialing }), "Equipify Scale")
  console.log("  ✓ active trial maps effective plan to Equipify Scale")

  assert.equal(
    getOrganizationPlanDisplayFromWorkspace(
      workspaceFixture({
        planId: "growth",
        organizationSubscription: { planId: "growth", status: "active", intendedPlanId: null },
      }),
    ),
    "Equipify Growth",
  )
  assert.equal(
    getOrganizationPlanDisplayFromWorkspace(workspaceFixture({ organizationSubscription: null })),
    "Equipify",
  )
  console.log("  ✓ getOrganizationPlanDisplayFromWorkspace")

  const switcherSource = readFileSync("components/workspace/workspace-switcher.tsx", "utf8")
  assert.ok(!switcherSource.includes('label: "Equipify Core"'), "workspace switcher must not hardcode Equipify Core")
  assert.ok(switcherSource.includes("Growth Engine"), "Growth Engine label must remain static")
  assert.ok(switcherSource.includes("getOrganizationPlanDisplay"), "workspace switcher must use plan display helper")
  console.log("  ✓ workspace switcher source uses dynamic plan label")

  console.log("\nEC-5 plan display verification PASS\n")
  console.log(JSON.stringify({ ok: true, phase: "EC-5" }, null, 2))
}

main()
