import type { VoiceProviderId } from "@/lib/voice/types"

export type VoiceProvisionNumberInput = {
  organizationId: string
  areaCode?: string
  displayName?: string
}

export type VoiceProvisionNumberResult = {
  ok: boolean
  providerNumberId?: string
  phoneNumber?: string
  message?: string
}

export type VoiceReleaseNumberInput = {
  organizationId: string
  providerNumberId: string
}

export type VoiceInitiateCallInput = {
  organizationId: string
  fromNumber: string
  toNumber: string
  metadata?: Record<string, unknown>
}

export type VoiceInitiateCallResult = {
  ok: boolean
  providerCallId?: string
  message?: string
}

export type VoiceFetchCallResult = {
  ok: boolean
  providerCallId?: string
  status?: string
  message?: string
}

export type VoiceListNumbersResult = {
  ok: boolean
  numbers: Array<{ providerNumberId: string; phoneNumber: string; status: string }>
  message?: string
}

export type VoiceSendSmsInput = {
  organizationId: string
  fromNumber: string
  toNumber: string
  body: string
}

export type VoiceSendSmsResult = {
  ok: boolean
  providerMessageId?: string
  message?: string
}

export type VoiceWebhookValidationInput = {
  signatureHeader: string | null
  url: string
  rawBody: string
  params?: Record<string, string>
}

export type VoiceWebhookValidationResult = {
  ok: boolean
  message?: string
}

export type NormalizedVoiceWebhookEvent = {
  provider: VoiceProviderId
  providerCallId: string
  eventType: string
  eventTimestamp: string
  direction: "inbound" | "outbound" | null
  fromNumber: string | null
  toNumber: string | null
  providerStatus: string | null
  recordingAvailable: boolean
  payload: Record<string, unknown>
}

export interface VoiceTelephonyProvider {
  readonly providerId: VoiceProviderId
  provisionNumber(input: VoiceProvisionNumberInput): Promise<VoiceProvisionNumberResult>
  releaseNumber(input: VoiceReleaseNumberInput): Promise<{ ok: boolean; message?: string }>
  initiateCall(input: VoiceInitiateCallInput): Promise<VoiceInitiateCallResult>
  fetchCall(providerCallId: string): Promise<VoiceFetchCallResult>
  listNumbers(organizationId: string): Promise<VoiceListNumbersResult>
  sendSms(input: VoiceSendSmsInput): Promise<VoiceSendSmsResult>
  validateWebhook(input: VoiceWebhookValidationInput): Promise<VoiceWebhookValidationResult>
  normalizeWebhookEvent(payload: Record<string, unknown>): NormalizedVoiceWebhookEvent | null
}
