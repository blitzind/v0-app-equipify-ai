/** SMS opening hooks (Phase 5.3C). Client-safe. */

import {
  selectResearchEvidenceCandidate,
  truncateResearchSnippet,
} from "@/lib/growth/outreach/personalization/research-evidence-selection"
import { selectMemoryEvidenceCandidate } from "@/lib/growth/outreach/personalization/memory-backed-opener"
import {
  isExistingCustomerRelationship,
  shouldPreferMemoryOpener,
} from "@/lib/growth/outreach/personalization/memory-strategy"
import { pickVariantIndex } from "@/lib/growth/outreach/personalization/message-variability"
import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import type {
  SmsMessageType,
  SmsOpeningHookMetadata,
  SmsOpeningHookStrategy,
} from "@/lib/growth/sms/personalization/sms-personalization-types"

const GENERIC_BANNED = /\b(i hope this finds you well|touching base|just checking in|wanted to reach out|following up on my email)\b/i

function firstName(contactName: string | null, companyName: string): string {
  if (contactName?.trim()) return contactName.trim().split(/\s+/)[0] ?? contactName
  return companyName.split(/\s+/)[0] ?? "there"
}

function compact(text: string, max: number): string {
  const trimmed = text.trim().replace(/[.…]+$/, "")
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > 12 ? cut.slice(0, space) : cut).trim()}…`
}

const RESEARCH_HOOK_TEMPLATES = [
  "{{name}} — saw {{fact}}. Is dispatch still mostly manual?",
  "{{name}}, quick q: {{fact}} — still accurate?",
  "Re {{company}}: {{fact}}. Worth a 2-min compare?",
]

const PAIN_HOOK_TEMPLATES = [
  "{{name}} — is {{pain}} still slowing {{company}}?",
  "Quick q for {{name}}: still coordinating techs by phone?",
  "{{name}}, curious if {{pain}} is still a bottleneck at {{company}}?",
]

const FOLLOW_UP_TEMPLATES = [
  "{{name}} — still open to a quick compare on dispatch workflow?",
  "Following up — did routing questions from last week still matter?",
  "{{name}}, any update on the ops workflow note?",
]

const CUSTOMER_CHECK_IN_TEMPLATES = [
  "{{name}} — how's rollout going on your side?",
  "Quick check-in: anything blocking the next ops step?",
  "{{name}}, still on track for the checklist we discussed?",
]

const MEMORY_HOOK_TEMPLATES: Record<string, string[]> = {
  memory_commitment: ["{{name}} — still good on {{topic}}?", "Following through on {{topic}} — need anything?"],
  memory_open_loop: ["{{name}} — circling back on {{topic}}?", "{{name}} — quick update on {{topic}}?"],
  memory_objection: ["{{name}} — want me to clarify {{topic}}?", "One note on {{topic}} — still the blocker?"],
  memory_interaction: ["{{name}} — picking up on {{topic}}.", "Re {{topic}} — quick follow-up."],
}

function applyTemplate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => tokens[key] ?? "")
}

function memoryGenerationType(messageType: SmsMessageType): "cold_email" | "follow_up_email" | "response_draft" {
  if (messageType === "sms_reply") return "response_draft"
  if (messageType === "cold_sms") return "cold_email"
  return "follow_up_email"
}

export function selectSmsOpeningHook(input: {
  packet: OutreachContextPacket
  messageType: SmsMessageType
  variationKey: string
}): SmsOpeningHookMetadata & { text: string } {
  const { packet, messageType, variationKey } = input
  const name = firstName(packet.decisionMakerName, packet.companyName)
  const tokens = { name, company: packet.companyName }

  if (
    (messageType === "follow_up_sms" ||
      messageType === "sms_reply" ||
      messageType === "reengagement_sms" ||
      messageType === "customer_check_in_sms") &&
    shouldPreferMemoryOpener(packet, memoryGenerationType(messageType))
  ) {
    const memoryCandidate = selectMemoryEvidenceCandidate(packet)
    if (memoryCandidate) {
      const templates = MEMORY_HOOK_TEMPLATES[memoryCandidate.source] ?? MEMORY_HOOK_TEMPLATES.memory_interaction!
      const template = templates[pickVariantIndex(`${variationKey}:sms:memory`, templates.length)]!
      const topic = compact(memoryCandidate.topic, 40)
      const text = applyTemplate(template, { ...tokens, topic })
      return {
        strategy: "memory_continuation",
        evidence: memoryCandidate.evidence,
        evidenceSource: memoryCandidate.source,
        memoryOpener: { source: memoryCandidate.source, evidence: memoryCandidate.evidence },
        text,
      }
    }
  }

  if (messageType === "customer_check_in_sms" || isExistingCustomerRelationship(packet)) {
    const template =
      CUSTOMER_CHECK_IN_TEMPLATES[pickVariantIndex(`${variationKey}:sms:customer`, CUSTOMER_CHECK_IN_TEMPLATES.length)]!
    return {
      strategy: "customer_check_in",
      evidence: packet.relationshipSummary,
      evidenceSource: "relationship_stage",
      text: applyTemplate(template, tokens),
    }
  }

  if (messageType === "follow_up_sms" || messageType === "reengagement_sms" || packet.priorTouchCount > 0) {
    const template = FOLLOW_UP_TEMPLATES[pickVariantIndex(`${variationKey}:sms:follow`, FOLLOW_UP_TEMPLATES.length)]!
    return {
      strategy: "follow_up_question",
      evidence: packet.priorTouchSummaries[0] ?? packet.priorReplySummaries[0] ?? null,
      evidenceSource: "prior_touches",
      text: applyTemplate(template, tokens),
    }
  }

  const researchCandidate = selectResearchEvidenceCandidate(packet)
  if (researchCandidate) {
    const fact = compact(truncateResearchSnippet(researchCandidate.evidence, 55), 55)
    const template = RESEARCH_HOOK_TEMPLATES[pickVariantIndex(`${variationKey}:sms:research`, RESEARCH_HOOK_TEMPLATES.length)]!
    return {
      strategy: "research_question",
      evidence: researchCandidate.evidence,
      evidenceSource: researchCandidate.source,
      researchOpener: {
        source: researchCandidate.source,
        evidence: researchCandidate.evidence,
        confidenceTier: researchCandidate.confidenceTier,
      },
      text: applyTemplate(template, { ...tokens, fact }),
    }
  }

  const pain = packet.researchPainPoints[0] ?? packet.websiteFindings[0] ?? "manual dispatch"
  const painCompact = compact(pain, 45)
  const painTemplate = PAIN_HOOK_TEMPLATES[pickVariantIndex(`${variationKey}:sms:pain`, PAIN_HOOK_TEMPLATES.length)]!
  return {
    strategy: "pain_question",
    evidence: pain,
    evidenceSource: "research_pain_point",
    text: applyTemplate(painTemplate, { ...tokens, pain: painCompact }),
  }
}

export function isGenericSmsOpener(text: string): boolean {
  return GENERIC_BANNED.test(text) || text.length < 20
}

export function hookStrategyLabel(strategy: SmsOpeningHookStrategy): string {
  return strategy.replace(/_/g, " ")
}
