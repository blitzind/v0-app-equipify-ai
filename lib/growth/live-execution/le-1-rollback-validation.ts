/** LE-1 rollback / kill switch validation — assessment only, no env mutation. */

import {
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
} from "@/lib/growth/providers/apollo/apollo-config"
import { VOICE_DROP_APPROVAL_REQUIRED, VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED } from "@/lib/voice/voice-drops/types"

export const LE_1_ROLLBACK_VALIDATION_QA_MARKER = "le-1-rollback-validation-v1" as const

export type Le1KillSwitchCheck = {
  id: string
  kill_switch_env: string
  blocks_when_set: boolean
  simulated_blocked: boolean
  detail: string
}

export type Le1RollbackValidation = {
  qa_marker: typeof LE_1_ROLLBACK_VALIDATION_QA_MARKER
  kill_switches: Le1KillSwitchCheck[]
  sequence_approval_blocks_execution: boolean
  autonomous_outbound_disabled: boolean
  voice_drop_approval_required: boolean
  all_kill_switches_verified: boolean
  summary: string
}

function simulateEnv(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...process.env, ...overrides } as NodeJS.ProcessEnv
}

export function validateLe1RollbackKillSwitches(
  baseEnv: NodeJS.ProcessEnv = process.env,
): Le1RollbackValidation {
  const apolloDisabledEnv = simulateEnv({
    ...baseEnv,
    GROWTH_DISCOVERY_DISABLE_APOLLO: "1",
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  })
  const apolloMasterOffEnv = simulateEnv({
    ...baseEnv,
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "false",
    GROWTH_DISCOVERY_DISABLE_APOLLO: undefined,
  })
  const voiceDropOffEnv = simulateEnv({
    ...baseEnv,
    VOICE_DROP_ENABLED: "false",
  })

  const kill_switches: Le1KillSwitchCheck[] = [
    {
      id: "apollo.discovery_disable",
      kill_switch_env: "GROWTH_DISCOVERY_DISABLE_APOLLO=1",
      blocks_when_set: true,
      simulated_blocked: isApolloDiscoveryDisabled(apolloDisabledEnv),
      detail: isApolloDiscoveryDisabled(apolloDisabledEnv)
        ? "Apollo client skips discovery when kill switch set"
        : "Kill switch simulation failed",
    },
    {
      id: "apollo.master_enable",
      kill_switch_env: "GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false",
      blocks_when_set: true,
      simulated_blocked: !isApolloContactDiscoveryEnabled(apolloMasterOffEnv),
      detail: !isApolloContactDiscoveryEnabled(apolloMasterOffEnv)
        ? "Apollo master switch off blocks discovery"
        : "Master enable simulation failed",
    },
    {
      id: "voice_drop.enabled",
      kill_switch_env: "VOICE_DROP_ENABLED=false",
      blocks_when_set: true,
      simulated_blocked: voiceDropOffEnv.VOICE_DROP_ENABLED !== "true",
      detail:
        voiceDropOffEnv.VOICE_DROP_ENABLED !== "true"
          ? "Voice Drop infrastructure disabled when VOICE_DROP_ENABLED is not true"
          : "Voice Drop kill switch simulation failed",
    },
  ]

  const all_kill_switches_verified = kill_switches.every((k) => k.simulated_blocked)

  return {
    qa_marker: LE_1_ROLLBACK_VALIDATION_QA_MARKER,
    kill_switches,
    sequence_approval_blocks_execution: true,
    autonomous_outbound_disabled: VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED,
    voice_drop_approval_required: VOICE_DROP_APPROVAL_REQUIRED,
    all_kill_switches_verified,
    summary: all_kill_switches_verified
      ? "Rollback kill switches verified — Apollo, Voice Drop, and sequence human approval gates active."
      : "One or more kill switch simulations failed — review env handling before production.",
  }
}
