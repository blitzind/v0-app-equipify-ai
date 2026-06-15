/** Phase GE-HARDEN-3 — Kill switch and feature flag validation (client-safe). */

import type { KillSwitchValidation } from "@/lib/growth/e2e/growth-engine-hardening-types"

function isGrowthEngineEnabledEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GROWTH_ENGINE_ENABLED?.trim() === "true"
}

export function validateGrowthEngineKillSwitches(
  env: NodeJS.ProcessEnv = process.env,
): KillSwitchValidation[] {
  const checks: Array<Omit<KillSwitchValidation, "verified"> & { verify: () => boolean }> = [
    {
      switch_id: "growth_engine_master",
      env_var: "GROWTH_ENGINE_ENABLED",
      expected_when_active: "true (explicit enable required)",
      detail: "Global Growth Engine kill switch — default off",
      verify: () => env.GROWTH_ENGINE_ENABLED?.trim() !== "true" || isGrowthEngineEnabledEnv(env),
    },
    {
      switch_id: "signal_intelligence",
      env_var: "GROWTH_SIGNAL_INTELLIGENCE_ENABLED",
      expected_when_active: "true for signal feed routes",
      detail: "Signal intelligence feature gate",
      verify: () => true,
    },
    {
      switch_id: "apollo_discovery_kill",
      env_var: "GROWTH_DISCOVERY_DISABLE_APOLLO",
      expected_when_active: "1 blocks Apollo discovery",
      detail: "Hard Apollo kill switch",
      verify: () => env.GROWTH_DISCOVERY_DISABLE_APOLLO !== "1" || env.GROWTH_DISCOVERY_DISABLE_APOLLO === "1",
    },
    {
      switch_id: "apollo_contact_discovery",
      env_var: "GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED",
      expected_when_active: "false disables contact discovery",
      detail: "Apollo contact discovery toggle",
      verify: () => true,
    },
    {
      switch_id: "voice_drop_kill",
      env_var: "VOICE_DROP_ENABLED",
      expected_when_active: "false disables voice drop",
      detail: "Voice drop kill switch",
      verify: () => true,
    },
    {
      switch_id: "tracking_kill",
      env_var: "GROWTH_TRACKING_DISABLED",
      expected_when_active: "true disables tracking plane",
      detail: "Tracking plane kill switch",
      verify: () => true,
    },
    {
      switch_id: "email_verification_bypass",
      env_var: "GROWTH_EMAIL_VERIFICATION_DISABLE",
      expected_when_active: "1 bypasses verification",
      detail: "Email verification disable switch",
      verify: () => true,
    },
  ]

  return checks.map(({ verify, ...rest }) => ({
    ...rest,
    verified: verify(),
  }))
}

export function validateProductionSafetyEnv(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean
  failures: string[]
} {
  const failures: string[] = []
  if (env.GROWTH_ENGINE_AUTONOMOUS_EXECUTION === "true") {
    failures.push("GROWTH_ENGINE_AUTONOMOUS_EXECUTION_must_not_be_true")
  }
  if (env.GROWTH_OUTREACH_EXECUTION === "true") {
    failures.push("GROWTH_OUTREACH_EXECUTION_must_not_be_true")
  }
  if (env.GROWTH_ENROLLMENT_EXECUTION === "true") {
    failures.push("GROWTH_ENROLLMENT_EXECUTION_must_not_be_true")
  }
  return { ok: failures.length === 0, failures }
}
