export type TwilioBrowserAccessTokenInput = {
  accountSid: string
  apiKeySid: string
  apiKeySecret: string
  twimlAppSid: string
  identity: string
  ttlSeconds?: number
}

export type TwilioBrowserTokenEnv = {
  accountSid: string
  authToken: string
  apiKeySid: string
  apiKeySecret: string
  twimlAppSid: string
}

export function readTwilioBrowserTokenEnv(): TwilioBrowserTokenEnv {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID?.trim() ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? "",
    apiKeySid: process.env.TWILIO_API_KEY_SID?.trim() ?? "",
    apiKeySecret: process.env.TWILIO_API_KEY_SECRET?.trim() ?? "",
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID?.trim() ?? "",
  }
}

export function normalizeTwilioBrowserAccessTokenInput(
  input: TwilioBrowserAccessTokenInput,
): Required<TwilioBrowserAccessTokenInput> {
  return {
    accountSid: input.accountSid.trim(),
    apiKeySid: input.apiKeySid.trim(),
    apiKeySecret: input.apiKeySecret.trim(),
    twimlAppSid: input.twimlAppSid.trim(),
    identity: input.identity.trim(),
    ttlSeconds: input.ttlSeconds ?? 3600,
  }
}

export async function mintTwilioVoiceBrowserAccessToken(
  input: TwilioBrowserAccessTokenInput,
): Promise<string> {
  const normalized = normalizeTwilioBrowserAccessTokenInput(input)
  const twilioModule = await import("twilio")
  const twilio = twilioModule.default ?? twilioModule
  const AccessToken = twilio.jwt.AccessToken
  const VoiceGrant = AccessToken.VoiceGrant

  const token = new AccessToken(
    normalized.accountSid,
    normalized.apiKeySid,
    normalized.apiKeySecret,
    {
      identity: normalized.identity,
      ttl: normalized.ttlSeconds,
    },
  )

  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: normalized.twimlAppSid,
      incomingAllow: true,
    }),
  )

  return token.toJwt()
}
