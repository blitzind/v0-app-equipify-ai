/**
 * Fuzor OS — Ava Reasoning platform package entry (Layer 3).
 *
 * Reusable contract:
 *   runAvaReasoning({ ownerOrganizationId, companyIntelligence, organizationKnowledge, roleKnowledge, objective, contacts, hardRuleState })
 *
 * Equipify deployment adapter lives under lib/growth/ava-reasoning/ (consumer).
 */

export {
  AVA_CI_INTEGRATION_1A_QA_MARKER,
  AVA_REASONING_GENERATION_MODE,
  AVA_REASONING_PROMPT_VERSION,
  AVA_REASONING_MODEL,
  type AvaReasoningDecision,
  type AvaOrganizationKnowledge,
  type AvaRoleKnowledge,
  type AvaContactEvidence,
  type AvaHardRuleState,
  type AvaReasoningResult,
  type AvaReasoningRecommendedContact,
  type AvaReasoningEmail,
  type RunAvaReasoningInput,
  type RunAvaReasoningOutput,
  type AvaReasoningModelRunner,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"

export {
  AVA_GROWTH_ROLE_KNOWLEDGE_V1,
} from "@/lib/fuzor/ava-reasoning/ava-role-knowledge"

export {
  avaReasoningResultSchema,
  AVA_REASONING_JSON_CONTRACT,
  normalizeAvaReasoningResult,
  enforceAvaReasoningEmailPolicy,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-schema"

export {
  buildAvaReasoningSystemPrompt,
  buildAvaReasoningUserPrompt,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-prompts"

export {
  runAvaReasoning,
  type RunAvaReasoningResult,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-service"
