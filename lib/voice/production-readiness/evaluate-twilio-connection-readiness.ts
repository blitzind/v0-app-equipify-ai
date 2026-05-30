import {
  missingTwilioConnectionEnvVarNames,
  missingTwilioEnvVarNames,
  type TwilioEnvPresence,
} from "@/lib/voice/providers/twilio-env-readiness"
import {
  VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  type VoiceProductionReadinessStatus,
} from "@/lib/voice/production-readiness/types"
import type { VoiceProviderConfigurationRecord } from "@/lib/voice/types"

export type TwilioConnectionReadinessEvaluation = {
  status: VoiceProductionReadinessStatus
  summary: string
  missingEnvVars: string[]
  missingCredentials: string[]
  failingHealthChecks: string[]
  recommendedFix: string
  lastSuccessfulTest: string | null
}

export function evaluateTwilioConnectionReadiness(input: {
  organizationId: string | null
  twilioProvider: VoiceProviderConfigurationRecord | null
  env: TwilioEnvPresence
}): TwilioConnectionReadinessEvaluation {
  const { organizationId, twilioProvider, env } = input
  const missingEnvVars = missingTwilioConnectionEnvVarNames(env)
  const missingCredentials = missingTwilioEnvVarNames(env)
  const failingHealthChecks: string[] = []

  let status: VoiceProductionReadinessStatus = "blocked"

  if (!organizationId) {
    failingHealthChecks.push("Organization scope not configured (GROWTH_ENGINE_AI_ORG_ID).")
  } else if (!env.twilioCredentialsConfigured) {
    failingHealthChecks.push("Twilio credentials missing in server environment.")
  } else if (!twilioProvider) {
    status = "partial"
    failingHealthChecks.push("No Twilio provider configuration row for this organization.")
  } else if (twilioProvider.status === "disabled") {
    failingHealthChecks.push("Twilio provider is disabled.")
  } else if (twilioProvider.status === "ready" && twilioProvider.voiceEnabled) {
    status = "ready"
  } else if (twilioProvider.status === "degraded" || !twilioProvider.voiceEnabled) {
    status = "partial"
    if (!twilioProvider.voiceEnabled) {
      failingHealthChecks.push("Voice is disabled on Twilio provider configuration.")
    }
    if (twilioProvider.status === "degraded") {
      failingHealthChecks.push("Twilio provider status is degraded.")
    }
  } else {
    status = "partial"
    if (!twilioProvider.webhookValidated) {
      failingHealthChecks.push("Twilio provider row exists but webhook validation is pending.")
    }
    if (twilioProvider.status === "pending") {
      failingHealthChecks.push("Twilio provider is pending validation.")
    }
  }

  const recommendedFix = resolveTwilioConnectionRecommendedFix({
    organizationId,
    twilioProvider,
    env,
    missingCredentials,
  })

  const summary = twilioProvider
    ? `Twilio ${twilioProvider.status} — voice ${twilioProvider.voiceEnabled ? "enabled" : "disabled"}.`
    : env.twilioCredentialsConfigured
      ? "Twilio environment credentials detected; provider database row not initialized."
      : "Twilio provider not configured for this organization."

  return {
    status,
    summary,
    missingEnvVars,
    missingCredentials,
    failingHealthChecks,
    recommendedFix,
    lastSuccessfulTest: twilioProvider?.lastValidationAt ?? null,
  }
}

function resolveTwilioConnectionRecommendedFix(input: {
  organizationId: string | null
  twilioProvider: VoiceProviderConfigurationRecord | null
  env: TwilioEnvPresence
  missingCredentials: string[]
}): string {
  if (!input.organizationId) {
    return "Set GROWTH_ENGINE_AI_ORG_ID in environment configuration and redeploy."
  }
  if (input.missingCredentials.length > 0) {
    return "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Vercel Production environment variables, then redeploy."
  }
  if (!input.twilioProvider) {
    return "Initialize Twilio Provider in Communications settings (/admin/growth/settings/communications)."
  }
  if (input.twilioProvider.status === "pending" || !input.twilioProvider.webhookValidated) {
    return "Confirm Twilio Console account SID matches provider_account_reference, complete webhook validation, then refresh readiness."
  }
  return "Confirm Twilio Console account SID matches provider_account_reference and voice is enabled."
}

export function evaluateTwilioWebhookReadiness(input: {
  organizationId: string | null
  configuredProviderCount: number
  webhookValidatedCount: number
  webhookPendingCount: number
  twilioProvider: VoiceProviderConfigurationRecord | null
  env: TwilioEnvPresence
  publicOriginConfigured: boolean
}): {
  status: VoiceProductionReadinessStatus
  missingEnvVars: string[]
  missingCredentials: string[]
  failingHealthChecks: string[]
  recommendedFix: string
} {
  const missingEnvVars = missingTwilioEnvVarNames(input.env)
  if (!input.publicOriginConfigured) {
    missingEnvVars.push("NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL")
  }

  const missingCredentials = input.env.twilioAuthToken ? [] : ["TWILIO_AUTH_TOKEN"]
  const failingHealthChecks: string[] = []
  let status: VoiceProductionReadinessStatus = "blocked"

  if (!input.organizationId) {
    failingHealthChecks.push("Organization scope not configured.")
  } else if (!input.env.twilioCredentialsConfigured) {
    failingHealthChecks.push("Twilio credentials missing in server environment.")
  } else if (!input.twilioProvider) {
    status = "partial"
    failingHealthChecks.push("No Twilio provider configuration row for this organization.")
  } else if (input.configuredProviderCount === 0) {
    failingHealthChecks.push("No voice providers configured.")
  } else if (input.webhookPendingCount > 0) {
    status = input.webhookValidatedCount > 0 ? "partial" : "blocked"
    failingHealthChecks.push(`${input.webhookPendingCount} provider webhook(s) not validated.`)
  } else if (input.webhookValidatedCount > 0 && input.publicOriginConfigured) {
    status = "ready"
  } else if (input.webhookValidatedCount > 0) {
    status = "partial"
  }

  if (!input.env.twilioAuthToken) {
    failingHealthChecks.push("Webhook signature validation requires TWILIO_AUTH_TOKEN.")
  }

  let recommendedFix =
    "Ensure NEXT_PUBLIC_SITE_URL matches your deployed host and Twilio signature validation is enabled."
  if (!input.env.twilioCredentialsConfigured) {
    recommendedFix = "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Vercel Production, then redeploy."
  } else if (!input.twilioProvider) {
    recommendedFix =
      "Initialize Twilio Provider in Communications settings, then configure webhook URLs in Twilio Console."
  } else if (input.webhookPendingCount > 0) {
    recommendedFix =
      "Copy webhook URLs into Twilio Console, send a test call, then mark validation complete in Communications settings."
  }

  return { status, missingEnvVars, missingCredentials, failingHealthChecks, recommendedFix }
}

export const TWILIO_CONNECTION_DEPLOYMENT_DOC = VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC
