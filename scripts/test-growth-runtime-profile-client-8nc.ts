/**
 * Phase 8N-C — client runtime profile resolution verification.
 *
 * Usage:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-growth-runtime-profile-client-8nc.ts
 */
import assert from "node:assert/strict"
import {
  GROWTH_RUNTIME_PROFILE_VERSION,
  resolveGrowthRuntimeProfileId,
} from "../lib/growth/runtime/growth-runtime-profile"
import {
  shouldDeferGrowthInboxTier3Hydration,
  shouldSkipGrowthInboxSecondaryHydration,
} from "../lib/growth/inbox/growth-inbox-minimal-runtime-contract"
import { isGrowthFeatureShellMounted } from "../lib/growth/runtime/growth-feature-shell-guards"

type EnvSnapshot = Record<string, string | undefined>

const TRACKED_KEYS = [
  "GROWTH_RUNTIME_PROFILE",
  "NEXT_PUBLIC_GROWTH_RUNTIME_PROFILE",
  "VERCEL_ENV",
  "NEXT_PUBLIC_VERCEL_ENV",
  "NODE_ENV",
] as const

function snapshotEnv(): EnvSnapshot {
  return Object.fromEntries(TRACKED_KEYS.map((key) => [key, process.env[key]]))
}

function restoreEnv(snapshot: EnvSnapshot): void {
  for (const key of TRACKED_KEYS) {
    const value = snapshot[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

function withEnv(patch: EnvSnapshot, fn: () => void): void {
  const saved = snapshotEnv()
  for (const key of TRACKED_KEYS) delete process.env[key]
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) process.env[key] = value
  }
  try {
    fn()
  } finally {
    restoreEnv(saved)
  }
}

function simulateServerProduction(): void {
  withEnv(
    {
      VERCEL_ENV: "production",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(resolveGrowthRuntimeProfileId(), "operator_minimal")
    },
  )
  console.log("  ✓ server production → operator_minimal")
}

function simulateClientProduction(): void {
  withEnv(
    {
      NEXT_PUBLIC_VERCEL_ENV: "production",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(resolveGrowthRuntimeProfileId(), "operator_minimal")
      assert.equal(shouldDeferGrowthInboxTier3Hydration(), true)
      assert.equal(shouldSkipGrowthInboxSecondaryHydration(), true)
    },
  )
  console.log("  ✓ client production → operator_minimal + Tier 3/secondary gates")
}

function simulateClientPreview(): void {
  withEnv(
    {
      NEXT_PUBLIC_VERCEL_ENV: "preview",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(resolveGrowthRuntimeProfileId(), "operator_minimal")
    },
  )
  console.log("  ✓ client preview → operator_minimal")
}

function simulateLocalDevelopment(): void {
  withEnv(
    {
      NODE_ENV: "development",
    },
    () => {
      assert.equal(resolveGrowthRuntimeProfileId(), "development_all")
      assert.equal(shouldDeferGrowthInboxTier3Hydration(), false)
      assert.equal(shouldSkipGrowthInboxSecondaryHydration(), false)
    },
  )
  console.log("  ✓ local development → development_all")
}

function simulateFullAdminOverride(): void {
  withEnv(
    {
      NEXT_PUBLIC_GROWTH_RUNTIME_PROFILE: "full_admin",
      NEXT_PUBLIC_VERCEL_ENV: "production",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(resolveGrowthRuntimeProfileId(), "full_admin")
      assert.equal(isGrowthFeatureShellMounted("realtimeEventBus", { isPlatformAdmin: false }), true)
    },
  )
  console.log("  ✓ explicit full_admin override honored on client")
}

function simulatePlatformAdminBypass(): void {
  assert.equal(
    isGrowthFeatureShellMounted("realtimeEventBus", { isPlatformAdmin: true }),
    true,
  )
  console.log("  ✓ platform admin shell bypass → full_admin Tier 2 visibility")
}

function main(): void {
  console.log("\n=== Phase 8N-C client runtime profile ===\n")
  assert.equal(GROWTH_RUNTIME_PROFILE_VERSION, "8nc.1")
  simulateServerProduction()
  simulateClientProduction()
  simulateClientPreview()
  simulateLocalDevelopment()
  simulateFullAdminOverride()
  simulatePlatformAdminBypass()
  console.log("\nPhase 8N-C client runtime profile: PASS\n")
}

main()
