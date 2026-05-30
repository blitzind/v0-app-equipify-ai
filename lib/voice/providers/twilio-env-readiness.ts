/** Twilio environment presence — names only, never secret values. */

export type TwilioEnvPresence = {
  twilioAccountSid: boolean
  twilioAuthToken: boolean
  growthEngineAiOrgId: boolean
  twilioCredentialsConfigured: boolean
}

export const TWILIO_REQUIRED_ENV_VARS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"] as const

export const TWILIO_CONNECTION_ORG_ENV_VAR = "GROWTH_ENGINE_AI_ORG_ID" as const

export function readTwilioEnvPresence(
  env: NodeJS.ProcessEnv = process.env,
): TwilioEnvPresence {
  const twilioAccountSid = Boolean(env.TWILIO_ACCOUNT_SID?.trim())
  const twilioAuthToken = Boolean(env.TWILIO_AUTH_TOKEN?.trim())
  const growthEngineAiOrgId = Boolean(env.GROWTH_ENGINE_AI_ORG_ID?.trim())
  return {
    twilioAccountSid,
    twilioAuthToken,
    growthEngineAiOrgId,
    twilioCredentialsConfigured: twilioAccountSid && twilioAuthToken,
  }
}

export function missingTwilioEnvVarNames(presence: TwilioEnvPresence): string[] {
  const missing: string[] = []
  if (!presence.twilioAccountSid) missing.push("TWILIO_ACCOUNT_SID")
  if (!presence.twilioAuthToken) missing.push("TWILIO_AUTH_TOKEN")
  return missing
}

export function missingTwilioConnectionEnvVarNames(presence: TwilioEnvPresence): string[] {
  const missing = missingTwilioEnvVarNames(presence)
  if (!presence.growthEngineAiOrgId) missing.push(TWILIO_CONNECTION_ORG_ENV_VAR)
  return missing
}
