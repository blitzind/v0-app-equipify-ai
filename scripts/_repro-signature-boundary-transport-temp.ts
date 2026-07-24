/**
 * AVA-SIGNATURE-BOUNDARY-TRANSPORT-HOTFIX-1A — transport prep repro (no send).
 */
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1b-types"
import { prepareAvaSupervisedOutboundTransportEmail } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary"
import { prepareGrowthAiCopilotOutboundEmailContent } from "@/lib/growth/run-ai-copilot-generation"
import { prepareOutboundEmailContent } from "@/lib/growth/signatures/outbound-signature-runtime"
import { resolveOutboundSignatureForSender } from "@/lib/growth/signatures/signature-resolver"
import { appendSignatureToOutboundBody, outboundBodyContainsSignature } from "@/lib/growth/signatures/signature-injection"
import {
  countPlaintextSignatureSeparators,
  stripAccidentalAvaSignatureFromBody,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"

const APPROVED_SENDER_ACCOUNT_ID = "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720"

const QA_UNSIGNED_BODY = [
  "Hi Mike,",
  "",
  "This is a controlled AVA-SUPERVISED-OUTBOUND-1B certification send.",
  "The body should contain no sender signature block before transport.",
  `Probe marker: ${AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER}`,
].join("\n")

async function diagnoseTransportPrep(input: {
  label: string
  unsignedBody: string
  subject: string
  senderAccountId: string
}) {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const { admin } = boot

  console.log(`\n=== ${input.label} ===`)

  const resolved = await resolveOutboundSignatureForSender(admin, {
    senderAccountId: input.senderAccountId,
  })

  const sanitized = stripAccidentalAvaSignatureFromBody(
    input.unsignedBody,
    resolved.signature?.text ?? null,
  )

  console.log("sender", {
    senderAccountId: input.senderAccountId,
    resolutionSource: resolved.resolutionSource,
    profileId: resolved.profileId,
    displayName: resolved.displayName,
    hasSignatureHtml: Boolean(resolved.signature?.html?.trim()),
    hasSignatureText: Boolean(resolved.signature?.text?.trim()),
    signatureTextPreview: resolved.signature?.text?.split("\n").slice(0, 6),
  })

  console.log("unsigned", {
    rawSeparators: countPlaintextSignatureSeparators(input.unsignedBody),
    sanitizedSeparators: countPlaintextSignatureSeparators(sanitized),
    sanitizedBodyPreview: sanitized.split("\n").slice(-8),
  })

  let preparedOutbound
  try {
    preparedOutbound = await prepareOutboundEmailContent(admin, {
      senderAccountId: input.senderAccountId,
      subject: input.subject,
      bodyText: sanitized,
      unsubscribeFooterHtml:
        '<p style="font-size:12px;color:#666;margin-top:24px;">{{unsubscribe_link}} — Reply STOP to unsubscribe.</p>',
      unsubscribeTextSuffix: "Reply STOP to unsubscribe.",
    })
  } catch (error) {
    console.log("prepareOutboundEmailContent THROW", error)
    throw error
  }

  console.log("prepareOutboundEmailContent", {
    signatureInjected: preparedOutbound.signatureInjected,
    textSeparators: countPlaintextSignatureSeparators(preparedOutbound.textBody),
    containsSignatureMarker: outboundBodyContainsSignature(
      preparedOutbound.htmlBody,
      preparedOutbound.textBody,
    ),
    textTail: preparedOutbound.textBody.split("\n").slice(-12),
  })

  let preparedCopilot
  try {
    preparedCopilot = await prepareGrowthAiCopilotOutboundEmailContent(admin, {
      senderAccountId: input.senderAccountId,
      subject: input.subject,
      body: sanitized,
    })
  } catch (error) {
    console.log("prepareGrowthAiCopilotOutboundEmailContent THROW", error)
    throw error
  }

  console.log("prepareGrowthAiCopilotOutboundEmailContent", {
    signatureInjected: preparedCopilot.signatureInjected,
    textSeparators: countPlaintextSignatureSeparators(preparedCopilot.text),
    containsSignatureMarker: outboundBodyContainsSignature(preparedCopilot.html, preparedCopilot.text),
    textTail: preparedCopilot.text.split("\n").slice(-12),
  })

  try {
    const transport = await prepareAvaSupervisedOutboundTransportEmail(admin, {
      senderAccountId: input.senderAccountId,
      subject: input.subject,
      unsignedBody: input.unsignedBody,
    })
    console.log("prepareAvaSupervisedOutboundTransportEmail OK", {
      signatureInjected: transport.signatureInjected,
      textSeparators: countPlaintextSignatureSeparators(transport.text),
      bodyFingerprint: transport.bodyFingerprint,
      containsSignatureMarker: outboundBodyContainsSignature(transport.html, transport.text),
    })
    return { ok: true as const, transport }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.log("prepareAvaSupervisedOutboundTransportEmail THROW", { message, stack })
    return { ok: false as const, error: message, stack }
  }
}

async function main(): Promise<void> {
  const qa = await diagnoseTransportPrep({
    label: "QA certification body",
    unsignedBody: QA_UNSIGNED_BODY,
    subject: "AVA-SUPERVISED-OUTBOUND-1B controlled certification",
    senderAccountId: APPROVED_SENDER_ACCOUNT_ID,
  })

  // Simulate legacy signed draft that survived partial strip
  const legacySigned = [
    "Hi Josh,",
    "",
    "Block Imaging looks like a strong fit.",
    "",
    "--",
    "Mike Short",
    "Founder",
    "Blitz Industries",
    "mike@blitzind.com",
  ].join("\n")

  const legacy = await diagnoseTransportPrep({
    label: "Legacy sender-signed body (non-Ava markers)",
    unsignedBody: legacySigned,
    subject: "Legacy signed draft probe",
    senderAccountId: APPROVED_SENDER_ACCOUNT_ID,
  })

  // Simulate body with inline signature merge token
  const inlineToken = [
    "Hi Mike,",
    "",
    "Quick note about your fleet.",
    "",
    "{{sender.signature}}",
  ].join("\n")

  const inline = await diagnoseTransportPrep({
    label: "Inline {{sender.signature}} token",
    unsignedBody: inlineToken,
    subject: "Inline signature token probe",
    senderAccountId: APPROVED_SENDER_ACCOUNT_ID,
  })

  // Local append-only sanity
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const resolved = await resolveOutboundSignatureForSender(boot.admin, {
    senderAccountId: APPROVED_SENDER_ACCOUNT_ID,
  })
  if (resolved.signature) {
    const bodyWithExistingSeparator = `${QA_UNSIGNED_BODY}\n\n--\nPartial signature`
    const appended = appendSignatureToOutboundBody({
      htmlBody: `<div>${bodyWithExistingSeparator.replace(/\n/g, "<br/>")}</div>`,
      textBody: bodyWithExistingSeparator,
      signature: resolved.signature,
    })
    console.log("\n=== appendSignature with pre-existing separator ===")
    console.log({
      signatureInjected: appended.signatureInjected,
      textSeparators: countPlaintextSignatureSeparators(appended.textBody),
    })
  }

  if (!qa.ok || !legacy.ok || !inline.ok) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
