/** GE-AIOS-12A — Canonical Memory Engine orchestrator. Delegates to @fuzor/memory. */

import {
  forgetPlatformMemory as forgetMemory,
  rememberPlatformConversation as rememberConversation,
  rememberPlatformOutcome as rememberOutcome,
  rememberPlatformPreference as rememberPreference,
  runPlatformMemoryEngine,
  type PlatformRunMemoryEngineInput,
} from "@fuzor/memory"

export type RunMemoryEngineInput = Omit<PlatformRunMemoryEngineInput, "organizationId"> & {
  organizationId?: string
}

export { rememberConversation, rememberOutcome, rememberPreference, forgetMemory }

export function runMemoryEngine(input: RunMemoryEngineInput) {
  const organizationId = input.organizationId?.trim() || "local-organization"
  return runPlatformMemoryEngine({ ...input, organizationId })
}

export type { RunMemoryEngineInput as MemoryEngineInput }
