/** Passive-mode guard — intelligence never triggers autonomous actions. */

export const VOICE_INTELLIGENCE_PASSIVE_MODE_ENABLED = true as const
export const VOICE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED = true as const

export function assertVoiceIntelligencePassiveOnly(action: string): void {
  if (!VOICE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED) {
    throw new Error(`Autonomous voice intelligence action blocked: ${action}`)
  }
}

export function voiceIntelligenceAllowsAutonomousAction(): false {
  assertVoiceIntelligencePassiveOnly("autonomous_action_probe")
  return false
}
