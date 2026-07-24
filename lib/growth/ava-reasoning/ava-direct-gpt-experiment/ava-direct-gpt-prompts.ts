/**
 * AVA-DIRECT-GPT-1A — Experimental prompts (website → Ava, no Company Intelligence).
 */

import type {
  AvaContactEvidence,
  AvaOrganizationKnowledge,
  AvaRoleKnowledge,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"
import { AVA_SUPERVISED_OUTBOUND_SIGNATURE_PROHIBITION_LINES } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"

function compactOrganizationKnowledge(knowledge: AvaOrganizationKnowledge) {
  return {
    organizationName: knowledge.organizationName,
    identitySummary: knowledge.identitySummary,
    productsAndCapabilities: knowledge.productsAndCapabilities,
    customersServed: knowledge.customersServed,
    problemsSolved: knowledge.problemsSolved,
    differentiators: knowledge.differentiators,
    positioning: knowledge.positioning,
    disqualifiers: knowledge.disqualifiers,
    limitations: knowledge.limitations,
  }
}

function compactContacts(contacts: AvaContactEvidence[]) {
  return contacts.map((c) => ({
    contactId: c.contactId,
    name: c.name,
    title: c.title,
    email: c.email,
    contactabilityStatus: c.contactabilityStatus,
    evidenceSource: c.evidenceSource,
  }))
}

function compactRole(role: AvaRoleKnowledge) {
  return {
    roleName: role.roleName,
    summary: role.summary,
    responsibilities: role.responsibilities,
    constraints: role.constraints,
  }
}

export function buildAvaDirectGptSystemPrompt(roleKnowledge: AvaRoleKnowledge): string {
  return [
    `You are ${roleKnowledge.roleName}.`,
    "",
    roleKnowledge.summary,
    "",
    "You are working for the organization described in the supplied knowledge base.",
    "You are given the prospect's public website text — there is no pre-built Company Intelligence.",
    "Understand the business from the website, then decide whether pursuit is justified.",
    "",
    "In one reasoning pass:",
    "- understand what the company does",
    "- determine if outreach about your organization's offering is likely worth it",
    "- identify the strongest honest angle",
    "- choose the best available contact",
    "- write a first-touch email when pursuit is justified and a contactable recipient exists",
    "",
    "Email body rules:",
    ...AVA_SUPERVISED_OUTBOUND_SIGNATURE_PROHIBITION_LINES.map((line) => `- ${line}`),
    "",
    "Use only supplied information. Do not fabricate facts.",
    "Record your understanding in companyUnderstanding — this may be persisted as organizational memory later.",
    "",
    "outboundSendAuthorized=false means software will not send — still draft when pursuit is justified.",
    "",
    "Return JSON matching the required schema exactly.",
  ].join("\n")
}

export function buildAvaDirectGptUserPrompt(input: {
  companyName: string
  website: string | null
  websiteText: string
  roleKnowledge: AvaRoleKnowledge
  objective: string
  organizationKnowledge: AvaOrganizationKnowledge
  contacts: AvaContactEvidence[]
}): string {
  return [
    "ROLE KNOWLEDGE",
    JSON.stringify(compactRole(input.roleKnowledge), null, 2),
    "",
    "CURRENT OBJECTIVE",
    input.objective,
    "",
    "ORGANIZATION KNOWLEDGE BASE",
    JSON.stringify(compactOrganizationKnowledge(input.organizationKnowledge), null, 2),
    "",
    "PROSPECT",
    JSON.stringify(
      {
        companyName: input.companyName,
        website: input.website,
      },
      null,
      2,
    ),
    "",
    "PUBLIC WEBSITE TEXT (substantially unaltered — your primary evidence)",
    input.websiteText,
    "",
    "CONTACT EVIDENCE",
    JSON.stringify(compactContacts(input.contacts), null, 2),
    "",
    "HARD RULE STATE",
    JSON.stringify(
      {
        outboundSendAuthorized: false,
        draftGenerationAllowed: true,
        optOutBlocked: false,
        suppressed: false,
      },
      null,
      2,
    ),
    "",
    "Respond with JSON only.",
  ].join("\n")
}
