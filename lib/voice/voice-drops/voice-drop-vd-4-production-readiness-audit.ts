/** Voice Drop VD-4 production readiness audit — client-safe static checks. */

import fs from "node:fs"
import path from "node:path"
import {
  buildVoiceDropStatusWebhookUrl,
  buildVoiceDropTwimlWebhookUrl,
  canPlaceTwilioVoiceDropCalls,
  isTwilioVoiceDropConfigured,
  isTwilioVoiceDropCredentialsConfigured,
  isVoiceDropTwilioOutboundCertified,
  readTwilioVoiceDropFromNumber,
  resolveVoiceDropTwilioPublicOrigin,
} from "@/lib/voice/voice-drops/twilio-voice-drop-config"
import { isVoiceDropEnabledFromEnv } from "@/lib/voice/voice-drops/twilio-voice-drop-gates"
import {
  VOICE_DROP_APPROVAL_REQUIRED,
  VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED,
} from "@/lib/voice/voice-drops/types"

export const VOICE_DROP_VD_4_QA_MARKER = "voice-drop-sequence-vd-4" as const

export type VoiceDropVd4AuditStatus = "pass" | "fail" | "warn" | "manual"

export type VoiceDropVd4AuditFinding = {
  id: string
  category:
    | "env"
    | "twilio"
    | "webhooks"
    | "gates"
    | "routes"
    | "sequence"
    | "compliance"
    | "persistence"
  status: VoiceDropVd4AuditStatus
  message: string
  detail?: string
}

export type VoiceDropVd4ProductionReadinessReport = {
  marker: typeof VOICE_DROP_VD_4_QA_MARKER
  auditedAt: string
  environment: {
    voiceDropEnabled: boolean
    voiceDropProvider: string | null
    twilioCredentialsConfigured: boolean
    twilioFromNumberConfigured: boolean
    twilioOutboundCertified: boolean
    complianceOrchestrationEnabled: boolean
    publicOrigin: string
    canPlaceLiveCalls: boolean
  }
  safetyGates: {
    autonomousOutboundDisabled: boolean
    approvalRequired: boolean
  }
  webhookUrls: {
    twimlExample: string
    statusExample: string
  }
  findings: VoiceDropVd4AuditFinding[]
  summary: {
    pass: number
    fail: number
    warn: number
    manual: number
  }
}

const REQUIRED_ROUTE_FILES = [
  "app/api/voice/webhooks/twilio/voice-drop/twiml/route.ts",
  "app/api/voice/webhooks/twilio/voice-drop/status/route.ts",
  "app/api/platform/growth/voice/voice-drops/campaigns/approved/route.ts",
  "app/api/platform/growth/sequences/patterns/[patternId]/steps/[stepId]/route.ts",
] as const

const REQUIRED_SEQUENCE_FILES = [
  "lib/growth/sequences/execution/sequence-voice-drop-runner.ts",
  "lib/growth/sequences/execution/sequence-voice-drop-timeline.ts",
  "lib/growth/sequences/execution/sequence-voice-drop-webhook-timeline.ts",
  "lib/growth/sequence-orchestration/sequence-voice-drop-fatigue.ts",
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
] as const

function pushFinding(
  findings: VoiceDropVd4AuditFinding[],
  finding: VoiceDropVd4AuditFinding,
): void {
  findings.push(finding)
}

function countByStatus(findings: VoiceDropVd4AuditFinding[]): VoiceDropVd4ProductionReadinessReport["summary"] {
  return findings.reduce(
    (acc, finding) => {
      acc[finding.status] += 1
      return acc
    },
    { pass: 0, fail: 0, warn: 0, manual: 0 },
  )
}

export function runVoiceDropVd4ProductionReadinessAudit(options?: {
  cwd?: string
  nowIso?: string
}): VoiceDropVd4ProductionReadinessReport {
  const cwd = options?.cwd ?? process.cwd()
  const findings: VoiceDropVd4AuditFinding[] = []
  const voiceDropEnabled = isVoiceDropEnabledFromEnv()
  const twilioCredentialsConfigured = isTwilioVoiceDropCredentialsConfigured()
  const twilioFromNumberConfigured = Boolean(readTwilioVoiceDropFromNumber())
  const twilioOutboundCertified = isVoiceDropTwilioOutboundCertified()
  const complianceOrchestrationEnabled = process.env.VOICE_COMPLIANCE_ORCHESTRATION_ENABLED === "true"
  const publicOrigin = resolveVoiceDropTwilioPublicOrigin()
  const voiceDropProvider = process.env.VOICE_DROP_PROVIDER?.trim() || null

  pushFinding(findings, {
    id: "env.voice_drop_enabled",
    category: "env",
    status: voiceDropEnabled ? "pass" : "warn",
    message: voiceDropEnabled
      ? "VOICE_DROP_ENABLED=true"
      : "VOICE_DROP_ENABLED is not true — live sequence voice drops will not queue.",
  })

  pushFinding(findings, {
    id: "env.voice_drop_provider",
    category: "env",
    status: voiceDropProvider === "twilio" ? "pass" : voiceDropProvider === "stub" ? "warn" : "fail",
    message:
      voiceDropProvider === "twilio"
        ? "VOICE_DROP_PROVIDER=twilio"
        : `VOICE_DROP_PROVIDER=${voiceDropProvider ?? "(unset)"} — production certification requires twilio.`,
  })

  pushFinding(findings, {
    id: "twilio.credentials",
    category: "twilio",
    status: twilioCredentialsConfigured ? "pass" : "fail",
    message: twilioCredentialsConfigured
      ? "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are configured."
      : "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN.",
  })

  pushFinding(findings, {
    id: "twilio.from_number",
    category: "twilio",
    status: twilioFromNumberConfigured ? "pass" : "fail",
    message: twilioFromNumberConfigured
      ? `Outbound from number configured (${readTwilioVoiceDropFromNumber()}).`
      : "Set TWILIO_VOICE_FROM_NUMBER (or TWILIO_PHONE_NUMBER).",
  })

  pushFinding(findings, {
    id: "twilio.outbound_certified",
    category: "twilio",
    status: twilioOutboundCertified ? "pass" : "fail",
    message: twilioOutboundCertified
      ? "VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED=true"
      : "Live outbound blocked until VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED=true.",
  })

  pushFinding(findings, {
    id: "compliance.orchestration",
    category: "compliance",
    status: complianceOrchestrationEnabled ? "pass" : "warn",
    message: complianceOrchestrationEnabled
      ? "VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true"
      : "Compliance orchestration disabled — sequence fatigue compliance checks may be bypassed.",
  })

  const originLooksPlaceholder = publicOrigin.includes("your-deployment.example")
  pushFinding(findings, {
    id: "webhooks.public_origin",
    category: "webhooks",
    status: originLooksPlaceholder ? "fail" : "pass",
    message: originLooksPlaceholder
      ? "Public origin is placeholder — set VOICE_MEDIA_STREAM_PUBLIC_ORIGIN or NEXT_PUBLIC_SITE_URL."
      : `Public origin resolved: ${publicOrigin}`,
  })

  const twimlExample = buildVoiceDropTwimlWebhookUrl({
    origin: publicOrigin,
    organizationId: "00000000-0000-4000-8000-000000000001",
    recipientId: "00000000-0000-4000-8000-000000000002",
  })
  const statusExample = buildVoiceDropStatusWebhookUrl({
    origin: publicOrigin,
    organizationId: "00000000-0000-4000-8000-000000000001",
    recipientId: "00000000-0000-4000-8000-000000000002",
  })

  pushFinding(findings, {
    id: "webhooks.twiml_path",
    category: "webhooks",
    status: twimlExample.includes("/api/voice/webhooks/twilio/voice-drop/twiml?") ? "pass" : "fail",
    message: "TwiML callback URL path is correct.",
    detail: twimlExample,
  })

  pushFinding(findings, {
    id: "webhooks.status_path",
    category: "webhooks",
    status: statusExample.includes("/api/voice/webhooks/twilio/voice-drop/status?") ? "pass" : "fail",
    message: "Status callback URL path is correct.",
    detail: statusExample,
  })

  for (const relativePath of REQUIRED_ROUTE_FILES) {
    const exists = fs.existsSync(path.join(cwd, relativePath))
    pushFinding(findings, {
      id: `routes.${relativePath.replace(/\//g, "_")}`,
      category: "routes",
      status: exists ? "pass" : "fail",
      message: exists ? `Route file present: ${relativePath}` : `Missing route file: ${relativePath}`,
    })
  }

  for (const relativePath of REQUIRED_SEQUENCE_FILES) {
    const exists = fs.existsSync(path.join(cwd, relativePath))
    pushFinding(findings, {
      id: `sequence.${relativePath.replace(/\//g, "_")}`,
      category: "sequence",
      status: exists ? "pass" : "fail",
      message: exists ? `Sequence module present: ${relativePath}` : `Missing sequence module: ${relativePath}`,
    })
  }

  pushFinding(findings, {
    id: "gates.autonomous_outbound_disabled",
    category: "gates",
    status: VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED ? "pass" : "fail",
    message: "Autonomous bulk outbound remains disabled in code.",
  })

  pushFinding(findings, {
    id: "gates.approval_required",
    category: "gates",
    status: VOICE_DROP_APPROVAL_REQUIRED ? "pass" : "fail",
    message: "Campaign approval gate remains required in code.",
  })

  pushFinding(findings, {
    id: "persistence.delivery_evidence_ui",
    category: "persistence",
    status: fs.existsSync(path.join(cwd, "components/growth/growth-voice-drop-delivery-evidence-panel.tsx"))
      ? "pass"
      : "fail",
    message: "Delivery evidence panel component exists.",
  })

  pushFinding(findings, {
    id: "live.controlled_certification",
    category: "sequence",
    status: "manual",
    message:
      "Controlled live certification (one approved sequence → one test lead → one call) must be executed manually per docs/VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md.",
  })

  pushFinding(findings, {
    id: "live.twilio_webhook_reachability",
    category: "webhooks",
    status: "manual",
    message:
      "Confirm Twilio can reach deployed webhook URLs (HTTPS, valid signature validation in prod).",
  })

  return {
    marker: VOICE_DROP_VD_4_QA_MARKER,
    auditedAt: options?.nowIso ?? new Date().toISOString(),
    environment: {
      voiceDropEnabled,
      voiceDropProvider,
      twilioCredentialsConfigured,
      twilioFromNumberConfigured,
      twilioOutboundCertified,
      complianceOrchestrationEnabled,
      publicOrigin,
      canPlaceLiveCalls: canPlaceTwilioVoiceDropCalls() && isTwilioVoiceDropConfigured(),
    },
    safetyGates: {
      autonomousOutboundDisabled: VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED,
      approvalRequired: VOICE_DROP_APPROVAL_REQUIRED,
    },
    webhookUrls: {
      twimlExample,
      statusExample,
    },
    findings,
    summary: countByStatus(findings),
  }
}

export function formatVoiceDropVd4AuditReportMarkdown(report: VoiceDropVd4ProductionReadinessReport): string {
  const lines: string[] = [
    "# Voice Drop VD-4 Production Readiness Audit",
    "",
    `Audited at: ${report.auditedAt}`,
    "",
    "## Summary",
    "",
    `| Status | Count |`,
    `|--------|-------|`,
    `| pass | ${report.summary.pass} |`,
    `| fail | ${report.summary.fail} |`,
    `| warn | ${report.summary.warn} |`,
    `| manual | ${report.summary.manual} |`,
    "",
    "## Environment",
    "",
    `- Voice drop enabled: ${report.environment.voiceDropEnabled}`,
    `- Provider: ${report.environment.voiceDropProvider ?? "(unset)"}`,
    `- Twilio credentials: ${report.environment.twilioCredentialsConfigured}`,
    `- From number: ${report.environment.twilioFromNumberConfigured}`,
    `- Outbound certified: ${report.environment.twilioOutboundCertified}`,
    `- Compliance orchestration: ${report.environment.complianceOrchestrationEnabled}`,
    `- Can place live calls: ${report.environment.canPlaceLiveCalls}`,
    `- Public origin: ${report.environment.publicOrigin}`,
    "",
    "## Webhook URLs (example)",
    "",
    `- TwiML: \`${report.webhookUrls.twimlExample}\``,
    `- Status: \`${report.webhookUrls.statusExample}\``,
    "",
    "## Findings",
    "",
    "| ID | Category | Status | Message |",
    "|----|----------|--------|---------|",
  ]

  for (const finding of report.findings) {
    lines.push(`| ${finding.id} | ${finding.category} | ${finding.status} | ${finding.message} |`)
  }

  return lines.join("\n")
}
