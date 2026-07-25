/**
 * AVA-SIGNATURE-BOUNDARY-TRANSPORT-HOTFIX-1B — production no-send preparation probe.
 */
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { readAvaSupervisedOutboundApprovalBinding } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { readAvaSupervisedOutboundSendLifecycle } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1b-types"
import { prepareAvaSupervisedOutboundTransportEmail } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary"
import {
  countHtmlSignatureMarkers,
  countPlaintextSignatureSeparators,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"

const QA_GENERATION_ID = "22a25173-1a93-441d-8125-ebfccdad5d02"

async function main(): Promise<void> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  const generation = await fetchGrowthAiCopilotGenerationById(boot.admin, QA_GENERATION_ID)
  if (!generation) throw new Error("generation_not_found")

  const binding = readAvaSupervisedOutboundApprovalBinding(generation.classification as Record<string, unknown>)
  if (!binding) throw new Error("binding_missing")

  const lifecycle = readAvaSupervisedOutboundSendLifecycle(generation.classification as Record<string, unknown>)
  const prepared = await prepareAvaSupervisedOutboundTransportEmail(boot.admin, {
    senderAccountId: binding.senderAccountId,
    subject: binding.subject,
    unsignedBody: binding.unsignedBody,
  })

  console.log(
    JSON.stringify(
      {
        generationId: generation.id,
        company: "Blitz Industries (Transport Fidelity Cert)",
        priorLifecycleStatus: lifecycle?.status ?? null,
        priorLifecycleErrorCode: lifecycle?.errorCode ?? null,
        transportPrepOk: true,
        textSignatureCount: countPlaintextSignatureSeparators(prepared.text),
        htmlSignatureMarkerCount: countHtmlSignatureMarkers(prepared.html),
        signatureInjected: prepared.signatureInjected,
        providerTransportInvoked: false,
        senderEmail: binding.senderEmail ?? "ava@equipifyai.com",
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
