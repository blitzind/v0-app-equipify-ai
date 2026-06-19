import "server-only"

import { getGrowthAvatarProviderStates } from "@/lib/growth/media/growth-ai-avatar-provider-config"

export function growthAiAvatarSafetyJson(extra: Record<string, unknown> = {}) {
  const providerStates = getGrowthAvatarProviderStates()
  const selectedProvider =
    typeof extra.provider === "string" && extra.provider === "retell" ? "retell" : "elevenlabs"
  const providerState = providerStates[selectedProvider]

  return {
    ...extra,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    provider_execution_enabled: providerState.enabled,
    provider_states: providerStates,
    outreach_execution: false,
    enrollment_execution: false,
    auto_publish_enabled: false,
  }
}
