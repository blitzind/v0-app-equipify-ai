import type { VoiceBrowserProviderId } from "@/lib/voice/browser-calling/types"

export type VoiceBrowserCallingProviderContext = {
  organizationId: string
  userId: string
  clientIdentity: string
}

export type VoiceBrowserAccessTokenResult = {
  provider: VoiceBrowserProviderId
  token: string | null
  expiresAt: string | null
  stubMode: boolean
  message: string
}

export interface VoiceBrowserCallingProvider {
  readonly providerId: VoiceBrowserProviderId
  createAccessToken(input: VoiceBrowserCallingProviderContext): Promise<VoiceBrowserAccessTokenResult>
  validateRegistrationContext(input: VoiceBrowserCallingProviderContext): { ok: boolean; message: string }
}
