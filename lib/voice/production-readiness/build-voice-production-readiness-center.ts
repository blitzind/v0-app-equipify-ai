import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getPublicAppOrigin } from "@/lib/email/config"
import { fetchAiCopilotReadiness } from "@/lib/voice/ai-copilot/ai-copilot-service"
import { fetchAiOutboundReadiness } from "@/lib/voice/ai-outbound/ai-outbound-service"
import { fetchAiReceptionistReadiness } from "@/lib/voice/ai-receptionist/receptionist-service"
import { fetchVoiceBrowserCallingReadiness } from "@/lib/voice/browser-calling/readiness"
import { fetchVoiceCallControlReadiness } from "@/lib/voice/call-control/readiness"
import {
  buildVoiceInboundTwilioUrl,
  buildVoiceRecordingCallbackUrl,
  buildVoiceStatusWebhookUrl,
} from "@/lib/voice/call-control/urls"
import { fetchComplianceReadiness } from "@/lib/voice/compliance-orchestration/compliance-orchestration-service"
import { fetchVoiceMediaStreamingReadiness } from "@/lib/voice/media-streaming/readiness"
import { fetchMultichannelIntelligenceReadiness } from "@/lib/voice/multi-channel-intelligence/multichannel-intelligence-service"
import {
  VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER,
  VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
  VOICE_PRODUCTION_READINESS_SECTION_IDS,
  VOICE_PRODUCTION_READINESS_TRANSCRIPT_PROVIDERS_HREF,
  type VoiceProductionReadinessCenterSnapshot,
  type VoiceProductionReadinessSection,
  type VoiceProductionReadinessSectionId,
  type VoiceProductionReadinessStatus,
} from "@/lib/voice/production-readiness/types"
import { fetchVoiceOperationsReadiness } from "@/lib/voice/repository/voice-operations-repository"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"
import { fetchVoiceDropReadiness } from "@/lib/voice/voice-drops/voice-drop-service"
import { fetchWorkflowOrchestrationReadiness } from "@/lib/voice/workflow-orchestration/workflow-orchestration-service"
import {
  evaluateTwilioConnectionReadiness,
  evaluateTwilioWebhookReadiness,
} from "@/lib/voice/production-readiness/evaluate-twilio-connection-readiness"
import { readTwilioEnvPresence } from "@/lib/voice/providers/twilio-env-readiness"

const SECTION_TITLES: Record<VoiceProductionReadinessSectionId, string> = {
  twilio_connection: "Twilio Connection",
  twilio_webhooks: "Twilio Webhook Validation",
  phone_numbers: "Phone Number Configuration",
  browser_calling: "Browser Calling Readiness",
  media_streaming: "Media Streaming Readiness",
  transcript_provider: "Transcript Provider Readiness",
  ai_provider: "AI Provider Readiness",
  receptionist: "Receptionist Readiness",
  voice_drops: "Voice Drop Readiness",
  compliance: "Compliance Readiness",
  workflow_orchestration: "Workflow Orchestration Readiness",
  multi_channel: "Multi-Channel Readiness",
}

function blockedSection(
  id: VoiceProductionReadinessSectionId,
  summary: string,
): VoiceProductionReadinessSection {
  return {
    id,
    title: SECTION_TITLES[id],
    status: "blocked",
    statusLabel: "Blocked",
    summary,
    missingEnvVars: ["GROWTH_ENGINE_AI_ORG_ID"],
    missingCredentials: [],
    missingWebhookUrls: [],
    phoneNumberIssues: [],
    failingHealthChecks: ["Organization scope not configured."],
    lastSuccessfulTest: null,
    recommendedFix: "Set GROWTH_ENGINE_AI_ORG_ID in environment configuration.",
    webhookUrls: [],
    settingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function statusLabel(status: VoiceProductionReadinessStatus): "Ready" | "Partial" | "Blocked" {
  if (status === "ready") return "Ready"
  if (status === "partial") return "Partial"
  return "Blocked"
}

function deriveOverallStatus(sections: VoiceProductionReadinessSection[]): VoiceProductionReadinessStatus {
  if (sections.some((s) => s.status === "blocked")) return "blocked"
  if (sections.some((s) => s.status === "partial")) return "partial"
  return "ready"
}

function envPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

function missingEnv(names: string[]): string[] {
  return names.filter((name) => !envPresent(name))
}

function buildTwilioConnectionSection(
  operations: VoiceOperationsReadinessSnapshot,
): VoiceProductionReadinessSection {
  const twilio = operations.configuredProviders.find((p) => p.provider === "twilio") ?? null
  const evaluation = evaluateTwilioConnectionReadiness({
    organizationId: operations.organizationId,
    twilioProvider: twilio,
    env: readTwilioEnvPresence(),
  })

  return {
    id: "twilio_connection",
    title: "Twilio Connection",
    status: evaluation.status,
    statusLabel: statusLabel(evaluation.status),
    summary: evaluation.summary,
    missingEnvVars: evaluation.missingEnvVars,
    missingCredentials: evaluation.missingCredentials,
    missingWebhookUrls: [],
    phoneNumberIssues: [],
    failingHealthChecks: evaluation.failingHealthChecks,
    lastSuccessfulTest: evaluation.lastSuccessfulTest,
    recommendedFix: evaluation.recommendedFix,
    webhookUrls: [],
    settingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function buildTwilioWebhooksSection(
  operations: VoiceOperationsReadinessSnapshot,
  origin: string,
  callControl: {
    inboundWebhookUrl: string
    statusWebhookUrl: string
    recordingCallbackUrl: string
  },
): VoiceProductionReadinessSection {
  const { validatedCount, pendingCount } = operations.webhookValidationSummary
  const twilio = operations.configuredProviders.find((p) => p.provider === "twilio") ?? null
  const publicOriginConfigured = envPresent("NEXT_PUBLIC_SITE_URL") || envPresent("NEXT_PUBLIC_APP_URL") || envPresent("APP_URL")
  const evaluation = evaluateTwilioWebhookReadiness({
    organizationId: operations.organizationId,
    configuredProviderCount: operations.configuredProviders.length,
    webhookValidatedCount: validatedCount,
    webhookPendingCount: pendingCount,
    twilioProvider: twilio,
    env: readTwilioEnvPresence(),
    publicOriginConfigured,
  })

  const webhookUrls = [
    { label: "Inbound voice", url: callControl.inboundWebhookUrl },
    { label: "Status callbacks", url: callControl.statusWebhookUrl },
    { label: "Recording callback", url: callControl.recordingCallbackUrl },
  ]

  const missingWebhookUrls: string[] = []
  if (!publicOriginConfigured) {
    missingWebhookUrls.push("Public deployment origin unset — webhook URLs use placeholder host.")
  }
  if (origin.includes("localhost") && !publicOriginConfigured) {
    missingWebhookUrls.push("Twilio cannot reach localhost — configure a public origin for production webhooks.")
  }

  return {
    id: "twilio_webhooks",
    title: "Twilio Webhook Validation",
    status: evaluation.status,
    statusLabel: statusLabel(evaluation.status),
    summary:
      validatedCount > 0
        ? `${validatedCount} validated · ${pendingCount} pending webhook validation.`
        : "Configure Twilio Console voice URLs and validate webhook delivery.",
    missingEnvVars: evaluation.missingEnvVars,
    missingCredentials: evaluation.missingCredentials,
    missingWebhookUrls,
    phoneNumberIssues: [],
    failingHealthChecks: evaluation.failingHealthChecks,
    lastSuccessfulTest: twilio?.lastValidationAt ?? null,
    recommendedFix: evaluation.recommendedFix,
    webhookUrls,
    settingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function buildPhoneNumbersSection(operations: VoiceOperationsReadinessSnapshot): VoiceProductionReadinessSection {
  const phoneNumberIssues: string[] = []
  let status: VoiceProductionReadinessStatus = "blocked"

  if (!operations.organizationId) {
    phoneNumberIssues.push("Organization scope not configured.")
  } else if (operations.phoneNumberCount === 0) {
    phoneNumberIssues.push("No phone numbers provisioned for this organization.")
  } else {
    const twilioReady = operations.configuredProviders.some(
      (p) => p.provider === "twilio" && p.status === "ready" && p.voiceEnabled,
    )
    if (twilioReady) {
      status = "ready"
    } else {
      status = "partial"
      phoneNumberIssues.push("Numbers exist but Twilio provider is not fully ready.")
    }
    if (operations.routingProfileCount === 0) {
      status = status === "ready" ? "partial" : status
      phoneNumberIssues.push("No routing profiles configured — inbound routing may be limited.")
    }
  }

  return {
    id: "phone_numbers",
    title: "Phone Number Configuration",
    status,
    statusLabel: statusLabel(status),
    summary:
      operations.phoneNumberCount > 0
        ? `${operations.phoneNumberCount} number(s) · ${operations.routingProfileCount} routing profile(s).`
        : "Provision and assign numbers before accepting inbound calls.",
    missingEnvVars: missingEnv(["GROWTH_ENGINE_AI_ORG_ID"]),
    missingCredentials: [],
    missingWebhookUrls: [],
    phoneNumberIssues,
    failingHealthChecks: phoneNumberIssues,
    lastSuccessfulTest: null,
    recommendedFix:
      operations.phoneNumberCount === 0
        ? "Add numbers via Twilio Console and sync inventory, or configure numbers in Communications settings."
        : "Assign routing profiles, business hours, and forwarding targets to each active number.",
    webhookUrls: [],
    settingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function buildBrowserCallingSection(
  browser: Awaited<ReturnType<typeof fetchVoiceBrowserCallingReadiness>>,
): VoiceProductionReadinessSection {
  const missingEnvVars = missingEnv([
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_TWIML_APP_SID",
  ])
  const missingCredentials: string[] = []
  if (browser.tokenReadiness === "missing_credentials") {
    missingCredentials.push("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN")
  }
  if (browser.tokenReadiness === "missing_twiml_app") {
    missingCredentials.push("TWILIO_TWIML_APP_SID")
  }

  const optionalApiKeyVars = missingEnv(["TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET"])
  const failingHealthChecks = [...browser.warnings]
  if (
    optionalApiKeyVars.length === 2 &&
    envPresent("TWILIO_ACCOUNT_SID") &&
    envPresent("TWILIO_AUTH_TOKEN")
  ) {
    failingHealthChecks.push(
      "Optional TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET unset — browser tokens fall back to account SID/auth token.",
    )
  }

  let status: VoiceProductionReadinessStatus = "blocked"
  if (browser.browserCallingReady) status = "ready"
  else if (browser.tokenReadiness === "stub_only") status = "partial"
  else if (browser.tokenReadiness === "missing_twiml_app") status = "partial"
  else status = "blocked"

  return {
    id: "browser_calling",
    title: "Browser Calling Readiness",
    status,
    statusLabel: statusLabel(status),
    summary: browser.browserCallingReady
      ? `Browser calling ready · ${browser.connectedOperatorCount} operator(s) connected.`
      : `Token readiness: ${browser.tokenReadiness.replace(/_/g, " ")}.`,
    missingEnvVars,
    missingCredentials,
    missingWebhookUrls: [],
    phoneNumberIssues: [],
    failingHealthChecks,
    lastSuccessfulTest: browser.browserCallingReady ? new Date().toISOString() : null,
    recommendedFix:
      browser.tokenReadiness === "missing_twiml_app"
        ? "Create a Twilio TwiML App and set TWILIO_TWIML_APP_SID for Voice SDK access tokens."
        : browser.tokenReadiness === "missing_credentials"
          ? "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN for browser token minting. For production, prefer TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET instead of auth token signing."
          : browser.browserCallingReady
            ? "Operators should grant microphone permission over HTTPS before placing calls."
            : optionalApiKeyVars.length > 0
              ? "Browser calling can use account credentials; set TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET for dedicated API key signing."
              : "Browser calling is in stub mode — configure Twilio Voice SDK credentials.",
    webhookUrls: [],
    settingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function buildMediaStreamingSection(
  media: Awaited<ReturnType<typeof fetchVoiceMediaStreamingReadiness>>,
): VoiceProductionReadinessSection {
  const missingEnvVars = missingEnv(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"])
  if (process.env.VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED?.trim() !== "true") {
    missingEnvVars.push("VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED")
  }
  if (envPresent("VOICE_MEDIA_STREAM_PUBLIC_ORIGIN") === false && !envPresent("NEXT_PUBLIC_SITE_URL")) {
    missingEnvVars.push("VOICE_MEDIA_STREAM_PUBLIC_ORIGIN or NEXT_PUBLIC_SITE_URL")
  }

  let status: VoiceProductionReadinessStatus = "blocked"
  if (media.mediaStreamingReady && media.twilioMediaStreamsReadiness === "ready") {
    status = media.websocketReadiness === "upgrade_requires_proxy" ? "partial" : "ready"
  } else if (media.twilioMediaStreamsReadiness === "stub_only" || media.mediaStreamingReady) {
    status = "partial"
  }

  const failingHealthChecks = [...media.warnings]
  if (media.streamHealth === "degraded") failingHealthChecks.push("Active media streams reporting degraded health.")
  if (media.reconnectHealth === "degraded") failingHealthChecks.push("Media stream reconnect count elevated.")

  return {
    id: "media_streaming",
    title: "Media Streaming Readiness",
    status,
    statusLabel: statusLabel(status),
    summary: media.message,
    missingEnvVars,
    missingCredentials:
      media.twilioMediaStreamsReadiness === "missing_credentials" ? ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"] : [],
    missingWebhookUrls:
      media.websocketReadiness === "upgrade_requires_proxy"
        ? ["Media stream websocket upgrade not enabled for this deployment."]
        : [],
    phoneNumberIssues: [],
    failingHealthChecks,
    lastSuccessfulTest: media.diagnostics.activeStreamCount > 0 ? new Date().toISOString() : null,
    recommendedFix:
      media.twilioMediaStreamsReadiness === "schema_pending"
        ? "Apply voice media streaming migration before enabling live Twilio Media Streams."
        : media.websocketReadiness === "upgrade_requires_proxy"
          ? "Set VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED=true or configure an external WSS proxy for Twilio Media Streams."
          : "Configure Twilio credentials and register the media stream URL on inbound TwiML.",
    webhookUrls: [{ label: "Media stream (HTTP)", url: media.mediaStreamUrl }],
    settingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function buildTranscriptProviderSection(
  media: Awaited<ReturnType<typeof fetchVoiceMediaStreamingReadiness>>,
): VoiceProductionReadinessSection {
  const provider = media.transcriptProviderStatus
  const missingEnvVars: string[] = []
  if (provider === "deepgram") missingEnvVars.push(...missingEnv(["DEEPGRAM_API_KEY"]))
  if (provider === "assemblyai") missingEnvVars.push(...missingEnv(["ASSEMBLYAI_API_KEY"]))

  let status: VoiceProductionReadinessStatus = "blocked"
  if (media.transcriptProviderReadiness === "ready") status = "ready"
  else if (media.transcriptProviderReadiness === "stub_only") status = "partial"
  else if (media.transcriptProviderReadiness === "missing_credentials") status = "blocked"
  else if (media.transcriptProviderReadiness === "schema_pending") status = "blocked"

  return {
    id: "transcript_provider",
    title: "Transcript Provider Readiness",
    status,
    statusLabel: statusLabel(status),
    summary: `Provider: ${provider} · ${media.activeTranscriptSessions} active transcript session(s).`,
    missingEnvVars,
    missingCredentials:
      media.transcriptProviderReadiness === "missing_credentials"
        ? provider === "deepgram"
          ? ["DEEPGRAM_API_KEY"]
          : provider === "assemblyai"
            ? ["ASSEMBLYAI_API_KEY"]
            : []
        : [],
    missingWebhookUrls: [],
    phoneNumberIssues: [],
    failingHealthChecks: media.warnings.filter((w) => w.toLowerCase().includes("transcript") || w.toLowerCase().includes("deepgram") || w.toLowerCase().includes("assemblyai")),
    lastSuccessfulTest: media.activeTranscriptSessions > 0 ? new Date().toISOString() : null,
    recommendedFix:
      media.transcriptProviderReadiness === "ready"
        ? "Transcript provider connected — validate live call transcription in Call Providers dashboard."
        : "Choose a transcript provider (Deepgram or AssemblyAI), set API keys, and verify in Call Providers.",
    webhookUrls: [],
    settingsHref: VOICE_PRODUCTION_READINESS_TRANSCRIPT_PROVIDERS_HREF,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function buildAiProviderSection(
  copilot: Awaited<ReturnType<typeof fetchAiCopilotReadiness>>,
  outbound: Awaited<ReturnType<typeof fetchAiOutboundReadiness>>,
): VoiceProductionReadinessSection {
  const missingEnvVars: string[] = []
  if (copilot.providerMode === "openai" || copilot.openAiAugmentationEnabled) {
    missingEnvVars.push(...missingEnv(["OPENAI_API_KEY"]))
  }
  if (outbound.providerMode === "openai_realtime") {
    missingEnvVars.push(...missingEnv(["OPENAI_API_KEY"]))
  }
  if (outbound.providerMode === "deepgram") {
    missingEnvVars.push(...missingEnv(["DEEPGRAM_API_KEY"]))
  }

  const failingHealthChecks: string[] = []
  if (!copilot.schemaReady) failingHealthChecks.push("AI copilot schema not ready.")
  if (copilot.providerMode === "openai" && !copilot.openAiEnabled) {
    failingHealthChecks.push("Copilot configured for OpenAI but OPENAI_API_KEY is missing.")
  }
  if (outbound.outboundEnabled && !outbound.providerReady) {
    failingHealthChecks.push(`Outbound AI provider (${outbound.providerMode}) not configured.`)
  }

  let status: VoiceProductionReadinessStatus = "blocked"
  const copilotReady = copilot.schemaReady && (copilot.deterministicModeActive || copilot.openAiEnabled)
  const outboundReady = !outbound.outboundEnabled || outbound.providerReady

  if (copilotReady && outboundReady && copilot.performanceInsightsReady) {
    status = copilot.openAiAugmentationEnabled || outbound.providerMode !== "deterministic" ? "ready" : "partial"
    if (copilot.deterministicModeActive && !copilot.openAiEnabled && outbound.providerMode === "deterministic") {
      status = "partial"
    }
  } else if (copilot.schemaReady || outbound.schemaReady) {
    status = "partial"
  }

  return {
    id: "ai_provider",
    title: "AI Provider Readiness",
    status,
    statusLabel: statusLabel(status),
    summary: `Copilot: ${copilot.providerMode} · Outbound: ${outbound.providerMode}${outbound.outboundEnabled ? " (enabled)" : " (disabled)"}.`,
    missingEnvVars: [...new Set(missingEnvVars)],
    missingCredentials:
      copilot.providerMode === "openai" && !copilot.openAiEnabled
        ? ["OPENAI_API_KEY"]
        : outbound.outboundEnabled && !outbound.providerReady
          ? [`${outbound.providerMode} provider credentials`]
          : [],
    missingWebhookUrls: [],
    phoneNumberIssues: [],
    failingHealthChecks,
    lastSuccessfulTest: copilot.activeSuggestionCount > 0 ? new Date().toISOString() : null,
    recommendedFix: !copilot.schemaReady
      ? "Apply AI copilot migrations, then configure OPENAI_API_KEY if using OpenAI augmentation."
      : outbound.outboundEnabled && !outbound.providerReady
        ? `Configure ${outbound.providerMode} credentials or switch to deterministic outbound mode.`
        : "Copilot runs in deterministic mode by default — set OPENAI_API_KEY for live augmentation.",
    webhookUrls: [],
    settingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function buildReceptionistSection(
  receptionist: Awaited<ReturnType<typeof fetchAiReceptionistReadiness>>,
): VoiceProductionReadinessSection {
  const missingEnvVars = missingEnv(["VOICE_AI_RECEPTIONIST_ENABLED"])
  const failingHealthChecks: string[] = []
  if (!receptionist.schemaReady) failingHealthChecks.push("AI receptionist schema not ready.")
  if (!receptionist.receptionistEnabled) failingHealthChecks.push("VOICE_AI_RECEPTIONIST_ENABLED is not true.")
  if (!receptionist.realtimeAudioReady) failingHealthChecks.push("Realtime audio provider not configured.")
  if (!receptionist.faqReady) failingHealthChecks.push("No FAQ entries configured.")
  if (!receptionist.qualificationFlowReady) failingHealthChecks.push("Qualification flow not configured.")

  let status: VoiceProductionReadinessStatus = "blocked"
  if (
    receptionist.receptionistEnabled &&
    receptionist.schemaReady &&
    receptionist.realtimeAudioReady &&
    receptionist.faqReady &&
    receptionist.qualificationFlowReady
  ) {
    status = "ready"
  } else if (receptionist.receptionistEnabled && receptionist.schemaReady) {
    status = "partial"
  } else if (receptionist.schemaReady) {
    status = "partial"
  }

  return {
    id: "receptionist",
    title: "Receptionist Readiness",
    status,
    statusLabel: statusLabel(status),
    summary: receptionist.message,
    missingEnvVars: receptionist.receptionistEnabled ? missingEnvVars.filter(() => false) : missingEnvVars,
    missingCredentials:
      receptionist.realtimeAudioReady || receptionist.providerMode === "deterministic"
        ? []
        : [`${receptionist.providerMode} provider credentials`],
    missingWebhookUrls: [],
    phoneNumberIssues: [],
    failingHealthChecks,
    lastSuccessfulTest: receptionist.activeSessionCount > 0 ? new Date().toISOString() : null,
    recommendedFix: !receptionist.receptionistEnabled
      ? "Set VOICE_AI_RECEPTIONIST_ENABLED=true after telephony and compliance surfaces are ready."
      : !receptionist.faqReady || !receptionist.qualificationFlowReady
        ? "Add FAQ entries and a qualification flow in Communications settings before routing inbound AI."
        : "Configure realtime audio provider credentials for live receptionist sessions.",
    webhookUrls: [],
    settingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function buildVoiceDropSection(
  voiceDrop: Awaited<ReturnType<typeof fetchVoiceDropReadiness>>,
): VoiceProductionReadinessSection {
  const missingEnvVars = voiceDrop.voiceDropEnabled ? [] : missingEnv(["VOICE_DROP_ENABLED"])
  const failingHealthChecks: string[] = []
  if (!voiceDrop.schemaReady) failingHealthChecks.push("Voice drop schema not ready.")
  if (!voiceDrop.complianceGatingReady) failingHealthChecks.push("Compliance orchestration required for voice drops.")
  if (!voiceDrop.callHourRulesReady) failingHealthChecks.push("Call hour rules not configured.")

  let status: VoiceProductionReadinessStatus = "blocked"
  if (
    voiceDrop.voiceDropEnabled &&
    voiceDrop.schemaReady &&
    voiceDrop.complianceGatingReady &&
    voiceDrop.callHourRulesReady
  ) {
    status = "ready"
  } else if (voiceDrop.voiceDropEnabled && voiceDrop.schemaReady) {
    status = "partial"
  } else if (voiceDrop.schemaReady) {
    status = "partial"
  }

  return {
    id: "voice_drops",
    title: "Voice Drop Readiness",
    status,
    statusLabel: statusLabel(status),
    summary: voiceDrop.message,
    missingEnvVars,
    missingCredentials: [],
    missingWebhookUrls: [],
    phoneNumberIssues: [],
    failingHealthChecks,
    lastSuccessfulTest: null,
    recommendedFix: !voiceDrop.voiceDropEnabled
      ? "Enable VOICE_DROP_ENABLED after compliance orchestration and approval workflows are verified."
      : !voiceDrop.complianceGatingReady
        ? "Enable VOICE_COMPLIANCE_ORCHESTRATION_ENABLED before running voice drop campaigns."
        : "Configure call hour rules and operator approval workflow for outbound voice drops.",
    webhookUrls: [],
    settingsHref: "/admin/growth/calls/voice-drops",
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function buildComplianceSection(
  compliance: Awaited<ReturnType<typeof fetchComplianceReadiness>>,
): VoiceProductionReadinessSection {
  const missingEnvVars = compliance.orchestrationEnabled ? [] : missingEnv(["VOICE_COMPLIANCE_ORCHESTRATION_ENABLED"])
  const failingHealthChecks: string[] = []
  if (!compliance.schemaReady) failingHealthChecks.push("Compliance schema not ready.")
  if (!compliance.orchestrationEnabled) failingHealthChecks.push("Compliance orchestration disabled.")
  if (!compliance.callHourRulesReady) failingHealthChecks.push("Call hour rules missing.")
  if (compliance.manualReviewQueueCount > 0) {
    failingHealthChecks.push(`${compliance.manualReviewQueueCount} item(s) in manual review queue.`)
  }

  let status: VoiceProductionReadinessStatus = "blocked"
  if (compliance.orchestrationEnabled && compliance.schemaReady && compliance.consentReadiness && compliance.callHourRulesReady) {
    status = compliance.manualReviewQueueCount > 0 ? "partial" : "ready"
  } else if (compliance.schemaReady) {
    status = "partial"
  }

  return {
    id: "compliance",
    title: "Compliance Readiness",
    status,
    statusLabel: statusLabel(status),
    summary: compliance.message,
    missingEnvVars,
    missingCredentials: [],
    missingWebhookUrls: [],
    phoneNumberIssues: [],
    failingHealthChecks,
    lastSuccessfulTest: compliance.auditEventCount > 0 ? new Date().toISOString() : null,
    recommendedFix: !compliance.orchestrationEnabled
      ? "Set VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true before enabling outbound voice features."
      : compliance.manualReviewQueueCount > 0
        ? "Review manual compliance queue items before increasing outbound volume."
        : "Compliance orchestration active — verify suppression registry and call hour rules.",
    webhookUrls: [],
    settingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function buildWorkflowSection(
  workflow: Awaited<ReturnType<typeof fetchWorkflowOrchestrationReadiness>>,
): VoiceProductionReadinessSection {
  const missingEnvVars = workflow.orchestrationEnabled ? [] : missingEnv(["VOICE_WORKFLOW_ORCHESTRATION_ENABLED"])
  const failingHealthChecks: string[] = []
  if (!workflow.schemaReady) failingHealthChecks.push("Workflow orchestration schema not ready.")
  if (!workflow.orchestrationEnabled) failingHealthChecks.push("Workflow orchestration disabled.")
  if (!workflow.observabilityIntegrationReady) failingHealthChecks.push("Observability integration pending.")

  let status: VoiceProductionReadinessStatus = "blocked"
  const subsystemsReady =
    workflow.escalationCoordinationReady &&
    workflow.routingVisibilityReady &&
    workflow.stalledWorkflowDetectionReady &&
    workflow.multiChannelCoordinationReady

  if (workflow.orchestrationEnabled && workflow.schemaReady && subsystemsReady && workflow.observabilityIntegrationReady) {
    status = "ready"
  } else if (workflow.orchestrationEnabled && workflow.schemaReady) {
    status = "partial"
  } else if (workflow.schemaReady) {
    status = "partial"
  }

  return {
    id: "workflow_orchestration",
    title: "Workflow Orchestration Readiness",
    status,
    statusLabel: statusLabel(status),
    summary: workflow.message,
    missingEnvVars,
    missingCredentials: [],
    missingWebhookUrls: [],
    phoneNumberIssues: [],
    failingHealthChecks,
    lastSuccessfulTest: null,
    recommendedFix: !workflow.orchestrationEnabled
      ? "Set VOICE_WORKFLOW_ORCHESTRATION_ENABLED=true after compliance and observability are live."
      : !workflow.observabilityIntegrationReady
        ? "Enable VOICE_OBSERVABILITY_ENABLED for workflow analytics integration."
        : "Workflow orchestration ready — operator-controlled coordination only.",
    webhookUrls: [],
    settingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

function buildMultiChannelSection(
  multichannel: Awaited<ReturnType<typeof fetchMultichannelIntelligenceReadiness>>,
): VoiceProductionReadinessSection {
  const missingEnvVars = multichannel.intelligenceEnabled ? [] : missingEnv(["VOICE_MULTICHANNEL_INTELLIGENCE_ENABLED"])
  const failingHealthChecks: string[] = []
  if (!multichannel.schemaReady) failingHealthChecks.push("Multi-channel intelligence schema not ready.")
  if (!multichannel.intelligenceEnabled) failingHealthChecks.push("Multi-channel intelligence disabled.")
  if (!multichannel.workflowIntegrationReady) failingHealthChecks.push("Workflow orchestration integration pending.")
  if (!multichannel.observabilityIntegrationReady) failingHealthChecks.push("Observability integration pending.")

  let status: VoiceProductionReadinessStatus = "blocked"
  const subsystemsReady =
    multichannel.unifiedTimelineReady &&
    multichannel.crossChannelCoordinationReady &&
    multichannel.escalationContinuityReady &&
    multichannel.communicationHealthReady

  if (multichannel.intelligenceEnabled && multichannel.schemaReady && subsystemsReady && multichannel.workflowIntegrationReady) {
    status = multichannel.observabilityIntegrationReady ? "ready" : "partial"
  } else if (multichannel.intelligenceEnabled && multichannel.schemaReady) {
    status = "partial"
  } else if (multichannel.schemaReady) {
    status = "partial"
  }

  return {
    id: "multi_channel",
    title: "Multi-Channel Readiness",
    status,
    statusLabel: statusLabel(status),
    summary: multichannel.message,
    missingEnvVars,
    missingCredentials: [],
    missingWebhookUrls: [],
    phoneNumberIssues: [],
    failingHealthChecks,
    lastSuccessfulTest: null,
    recommendedFix: !multichannel.intelligenceEnabled
      ? "Set VOICE_MULTICHANNEL_INTELLIGENCE_ENABLED=true after workflow orchestration is enabled."
      : !multichannel.workflowIntegrationReady
        ? "Enable workflow orchestration before unified multi-channel coordination."
        : "Multi-channel intelligence ready — operator-controlled coordination only.",
    webhookUrls: [],
    settingsHref: "/admin/growth/multichannel",
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
  }
}

export async function buildVoiceProductionReadinessCenter(
  admin: SupabaseClient,
  organizationId: string | null,
  origin?: string | null,
): Promise<VoiceProductionReadinessCenterSnapshot> {
  const resolvedOrigin = origin?.replace(/\/$/, "") || getPublicAppOrigin()
  const schemaProbe = await probeVoiceSchemaHealth(admin)

  if (!organizationId) {
    const emptyOperations: VoiceOperationsReadinessSnapshot = {
      qaMarker: "voice-foundation-v1",
      organizationId: null,
      configuredProviders: [],
      phoneNumberCount: 0,
      webhookValidationSummary: { validatedCount: 0, pendingCount: 0 },
      complianceReadiness: { optOutCount: 0, message: "Organization not configured." },
      infrastructureMessage: "Set GROWTH_ENGINE_AI_ORG_ID.",
      operationsQaMarker: "voice-operations-v1",
      routingProfileCount: 0,
      businessHoursCount: 0,
      voicemailBoxCount: 0,
      complianceReadinessExtended: {
        optOutTableReady: false,
        optOutCount: 0,
        dncEnforcementMessage: "",
        callRecordingDisclosureMessage: "",
        aiDisclosureMessage: "",
      },
    }
    const callControl = {
      inboundWebhookUrl: buildVoiceInboundTwilioUrl(resolvedOrigin),
      statusWebhookUrl: buildVoiceStatusWebhookUrl(resolvedOrigin),
      recordingCallbackUrl: buildVoiceRecordingCallbackUrl(resolvedOrigin),
    }
    const sections: VoiceProductionReadinessSection[] = [
      buildTwilioConnectionSection(emptyOperations),
      buildTwilioWebhooksSection(emptyOperations, resolvedOrigin, callControl),
      buildPhoneNumbersSection(emptyOperations),
    ]
    for (const id of VOICE_PRODUCTION_READINESS_SECTION_IDS) {
      if (sections.some((s) => s.id === id)) continue
      sections.push(blockedSection(id, "Set GROWTH_ENGINE_AI_ORG_ID to scope voice readiness checks."))
    }

    const ordered = VOICE_PRODUCTION_READINESS_SECTION_IDS.map(
      (id) => sections.find((s) => s.id === id)!,
    )

    return {
      qaMarker: VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER,
      generatedAt: new Date().toISOString(),
      organizationId: null,
      schemaReady: schemaProbe.ready,
      schemaMessage: schemaProbe.message,
      overallStatus: "blocked",
      summary: {
        readyCount: 0,
        partialCount: 0,
        blockedCount: ordered.length,
        totalSections: ordered.length,
      },
      sections: ordered,
      deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
      globalSettingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
      transcriptProvidersHref: VOICE_PRODUCTION_READINESS_TRANSCRIPT_PROVIDERS_HREF,
    }
  }

  const [
    operations,
    browserCalling,
    mediaStreaming,
    aiReceptionist,
    aiCopilot,
    aiOutbound,
    compliance,
    voiceDrop,
    workflow,
    multichannel,
  ] = await Promise.all([
    fetchVoiceOperationsReadiness(admin, organizationId),
    fetchVoiceBrowserCallingReadiness(admin, organizationId),
    fetchVoiceMediaStreamingReadiness(admin, organizationId, resolvedOrigin),
    fetchAiReceptionistReadiness(admin, organizationId),
    fetchAiCopilotReadiness(admin, organizationId),
    fetchAiOutboundReadiness(admin, organizationId),
    fetchComplianceReadiness(admin, organizationId),
    fetchVoiceDropReadiness(admin, organizationId),
    fetchWorkflowOrchestrationReadiness(admin, organizationId),
    fetchMultichannelIntelligenceReadiness(admin, organizationId),
  ])

  const callControl =
    operations.callControlReadiness ??
    (await fetchVoiceCallControlReadiness(admin, organizationId, resolvedOrigin))

  const sections: VoiceProductionReadinessSection[] = [
    buildTwilioConnectionSection(operations),
    buildTwilioWebhooksSection(operations, resolvedOrigin, callControl),
    buildPhoneNumbersSection(operations),
    buildBrowserCallingSection(browserCalling),
    buildMediaStreamingSection(mediaStreaming),
    buildTranscriptProviderSection(mediaStreaming),
    buildAiProviderSection(aiCopilot, aiOutbound),
    buildReceptionistSection(aiReceptionist),
    buildVoiceDropSection(voiceDrop),
    buildComplianceSection(compliance),
    buildWorkflowSection(workflow),
    buildMultiChannelSection(multichannel),
  ]

  if (!schemaProbe.ready) {
    for (const section of sections) {
      if (section.status === "ready") {
        section.status = "partial"
        section.statusLabel = "Partial"
      }
      section.failingHealthChecks.unshift(`Voice schema incomplete: ${schemaProbe.message}`)
      section.recommendedFix = `Apply pending voice migrations first. ${section.recommendedFix}`
    }
  }

  const readyCount = sections.filter((s) => s.status === "ready").length
  const partialCount = sections.filter((s) => s.status === "partial").length
  const blockedCount = sections.filter((s) => s.status === "blocked").length

  return {
    qaMarker: VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER,
    generatedAt: new Date().toISOString(),
    organizationId,
    schemaReady: schemaProbe.ready,
    schemaMessage: schemaProbe.message,
    overallStatus: deriveOverallStatus(sections),
    summary: {
      readyCount,
      partialCount,
      blockedCount,
      totalSections: sections.length,
    },
    sections,
    deploymentRequirementsHref: VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC,
    globalSettingsHref: VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
    transcriptProvidersHref: VOICE_PRODUCTION_READINESS_TRANSCRIPT_PROVIDERS_HREF,
  }
}

export type { VoiceProductionReadinessSectionId }
