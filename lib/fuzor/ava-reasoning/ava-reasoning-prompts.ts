/**
 * Lean Ava reasoning prompts — generic deployment context, no hard-coded seller facts.
 */

import type {
  AvaContactEvidence,
  AvaOrganizationKnowledge,
  AvaRoleKnowledge,
  RunAvaReasoningInput,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"

function compactOrganizationKnowledge(knowledge: AvaOrganizationKnowledge) {
  return {
    source: knowledge.source,
    versionId: knowledge.versionId,
    organizationName: knowledge.organizationName,
    identitySummary: knowledge.identitySummary,
    productsAndCapabilities: knowledge.productsAndCapabilities,
    customersServed: knowledge.customersServed,
    problemsSolved: knowledge.problemsSolved,
    differentiators: knowledge.differentiators,
    positioning: knowledge.positioning,
    approvedTerminologyPrefer: knowledge.approvedTerminologyPrefer,
    approvedTerminologyAvoid: knowledge.approvedTerminologyAvoid,
    customerOutcomes: knowledge.customerOutcomes,
    limitations: knowledge.limitations,
    disqualifiers: knowledge.disqualifiers,
  }
}

function compactContacts(contacts: AvaContactEvidence[]) {
  return contacts.map((c) => ({
    contactId: c.contactId,
    name: c.name,
    title: c.title,
    role: c.role,
    email: c.email,
    linkedinUrl: c.linkedinUrl,
    companyAssociation: c.companyAssociation,
    professionalSummary: c.professionalSummary,
    contactabilityStatus: c.contactabilityStatus,
    evidenceSource: c.evidenceSource,
    evidenceExcerpt: c.evidenceExcerpt,
  }))
}

function compactRole(role: AvaRoleKnowledge) {
  return {
    roleId: role.roleId,
    roleName: role.roleName,
    summary: role.summary,
    responsibilities: role.responsibilities,
    constraints: role.constraints,
  }
}

export function buildAvaReasoningSystemPrompt(roleKnowledge: AvaRoleKnowledge): string {
  return [
    `You are ${roleKnowledge.roleName}.`,
    "",
    roleKnowledge.summary,
    "",
    "You are working for the organization described in the supplied organization knowledge base.",
    "Review the canonical understanding of the prospect, the available contacts, and the current objective.",
    "Determine whether pursuing this company is genuinely justified.",
    "",
    "Use only the supplied information.",
    "Do not fabricate facts or force a sales angle.",
    "",
    "When pursuit is justified:",
    "- explain why",
    "- identify the strongest honest angle",
    "- identify the best available contact from the supplied list",
    "- write a concise first-touch email (only if a responsible recipient can be identified)",
    "",
    "When evidence or contact information is inadequate:",
    "- hold",
    "- explain what is missing",
    "",
    "When the company is not a reasonable prospect for the objective:",
    "- reject",
    "- explain why",
    "",
    "Do not mention internal scores, AI architecture, Company Intelligence, DataMoon, or research systems in the email.",
    "",
    "Hard rule state notes:",
    "- outboundSendAuthorized=false means software will not send. It is NOT a reason to hold or skip drafting.",
    "- When pursuit is justified and a responsible recipient exists, write the email draft for human review.",
    "- Only hold/reject for business-fit or evidence reasons, or when optOutBlocked/suppressed is true.",
    "",
    "Return JSON matching the required schema exactly.",
  ].join("\n")
}

export function buildAvaReasoningUserPrompt(input: RunAvaReasoningInput): string {
  const ci = input.companyIntelligence
  return [
    "ROLE KNOWLEDGE",
    JSON.stringify(compactRole(input.roleKnowledge), null, 2),
    "",
    "CURRENT OBJECTIVE",
    input.objective,
    "",
    "ORGANIZATION KNOWLEDGE BASE (the organization you represent)",
    JSON.stringify(compactOrganizationKnowledge(input.organizationKnowledge), null, 2),
    "",
    "CANONICAL COMPANY INTELLIGENCE (prospect understanding)",
    JSON.stringify(
      {
        companyName: ci.companyName,
        website: ci.website,
        companyIntelligenceVersionId: ci.companyIntelligenceVersionId,
        evidenceFingerprint: ci.evidenceFingerprint,
        understanding: ci.understanding,
      },
      null,
      2,
    ),
    "",
    "CONTACT EVIDENCE",
    JSON.stringify(compactContacts(input.contacts), null, 2),
    "",
    "HARD RULE STATE (software-authoritative; do not override)",
    JSON.stringify(input.hardRuleState, null, 2),
    "",
    "Respond with JSON only.",
  ].join("\n")
}
