import "server-only"

import type { GrowthMediaConversationalSessionStatus } from "@/lib/growth/media/media-conversational-session-types"
import { GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS } from "@/lib/growth/media/media-conversational-session-types"
import {
  RETELL_VIDEO_AGENT_PROVIDER_NAME,
  RETELL_VIDEO_AGENT_PROVIDER_QA_MARKER,
  type RetellVideoAgentProviderCapabilities,
  type RetellVideoAgentProviderSessionRequest,
  type RetellVideoAgentProviderSessionSnapshot,
  type RetellVideoAgentProviderStatus,
} from "@/lib/growth/media/providers/retell-video-agent-provider-types"

export class RetellVideoAgentProviderExecutionDisabledError extends Error {
  constructor() {
    super("provider_execution_disabled")
    this.name = "RetellVideoAgentProviderExecutionDisabledError"
  }
}

export function getRetellVideoAgentProviderCapabilities(): RetellVideoAgentProviderCapabilities {
  return {
    provider: RETELL_VIDEO_AGENT_PROVIDER_NAME,
    executionEnabled: false,
    supportsWebRtc: false,
    supportsWebhooks: false,
    qaMarker: RETELL_VIDEO_AGENT_PROVIDER_QA_MARKER,
    ...GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS,
  }
}

export function assertRetellVideoAgentProviderExecutionDisabled(): void {
  if (getRetellVideoAgentProviderCapabilities().executionEnabled) {
    throw new RetellVideoAgentProviderExecutionDisabledError()
  }
}

export function createRetellVideoAgentProviderSession(
  _request: RetellVideoAgentProviderSessionRequest,
): RetellVideoAgentProviderSessionSnapshot {
  assertRetellVideoAgentProviderExecutionDisabled()
  throw new RetellVideoAgentProviderExecutionDisabledError()
}

export function pollRetellVideoAgentProviderSession(
  _providerSessionId: string,
): RetellVideoAgentProviderSessionSnapshot {
  assertRetellVideoAgentProviderExecutionDisabled()
  throw new RetellVideoAgentProviderExecutionDisabledError()
}

export function endRetellVideoAgentProviderSession(
  _providerSessionId: string,
): RetellVideoAgentProviderSessionSnapshot {
  assertRetellVideoAgentProviderExecutionDisabled()
  throw new RetellVideoAgentProviderExecutionDisabledError()
}

export function cancelRetellVideoAgentProviderSession(
  _providerSessionId: string,
): RetellVideoAgentProviderSessionSnapshot {
  assertRetellVideoAgentProviderExecutionDisabled()
  throw new RetellVideoAgentProviderExecutionDisabledError()
}

export function mapRetellVideoAgentProviderStatusToSessionStatus(
  status: RetellVideoAgentProviderStatus,
): GrowthMediaConversationalSessionStatus {
  switch (status) {
    case "pending":
      return "draft"
    case "ready":
      return "ready"
    case "active":
      return "active"
    case "completed":
      return "completed"
    case "failed":
      return "failed"
    case "cancelled":
      return "cancelled"
    default:
      return "draft"
  }
}
