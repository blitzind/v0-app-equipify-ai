/**
 * GE-AIOS-SAFETY-1 — Autonomous execution guardrail feature flags (client-safe).
 */

export function isAutonomousExecutionKillSwitchActive(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GROWTH_AUTONOMOUS_EXECUTION_KILL_SWITCH === "true"
}

export function isAutonomousExecutionGuardrailsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GROWTH_AUTONOMOUS_EXECUTION_GUARDRAILS === "true"
}

export function isAutonomousExecutionGuardrailsEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_GROWTH_AUTONOMOUS_EXECUTION_GUARDRAILS === "true"
}
