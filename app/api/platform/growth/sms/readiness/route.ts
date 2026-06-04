import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGrowthSmsArchitectureAudit, GROWTH_SMS_INFRASTRUCTURE_QA_MARKER } from "@/lib/growth/sms/sms-architecture-audit"
import {
  isGrowthSmsLiveSendEnabled,
  readGrowthSmsFromE164,
  resolveDefaultGrowthSmsProviderKind,
  resolveGrowthSmsProvider,
} from "@/lib/growth/sms/providers/sms-provider-registry"
import { fetchGrowthSmsWorkspaceSettings } from "@/lib/growth/sms/sms-repository"
import { isGrowthSmsSchemaReady } from "@/lib/growth/sms/schema-health"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthSmsSchemaReady(access.admin)
  const providerKind = resolveDefaultGrowthSmsProviderKind()
  const provider = resolveGrowthSmsProvider(providerKind)
  const providerHealth = await provider.health()
  const settings = schemaReady ? await fetchGrowthSmsWorkspaceSettings(access.admin) : null

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SMS_INFRASTRUCTURE_QA_MARKER,
    schemaReady,
    architectureAudit: buildGrowthSmsArchitectureAudit(),
    provider: {
      kind: providerKind,
      health: providerHealth,
      capabilities: provider.capabilities(),
    },
    workspace: settings,
    fromE164: settings?.fromE164 ?? readGrowthSmsFromE164(),
    liveSendEnabled: isGrowthSmsLiveSendEnabled(),
    twilioSetup: {
      approvedNumber: "+18333784743",
      requiredEnv: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "GROWTH_SMS_FROM_E164"],
      optionalEnv: ["GROWTH_SMS_SEND_ENABLED", "GROWTH_SMS_STATUS_CALLBACK_URL", "GROWTH_ENGINE_PUBLIC_BASE_URL"],
      inboundWebhook: "/api/growth/webhooks/sms/twilio/inbound",
      statusWebhook: "/api/growth/webhooks/sms/twilio/status",
    },
  })
}
