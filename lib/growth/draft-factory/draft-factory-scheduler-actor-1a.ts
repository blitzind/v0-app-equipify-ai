/**
 * AVA-SUPERVISED-GPT-SCHEDULER-WIRING-1A / AVA-SCHEDULER-ACTOR-PERSISTENCE-HOTFIX-1A
 *
 * Non-human automation actor for draft-factory scheduler GPT generation.
 *
 * Scheduler generations persist with `created_by = null` (canonical autonomous contract —
 * FK targets auth.users). Attribution lives in input_snapshot/classification provenance.
 * This actor cannot approve, assign senders, or transport outbound messages.
 */

export const GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_1A_QA_MARKER =
  "ava-supervised-gpt-scheduler-wiring-1a-v1" as const

/** Logical service actor id for audit metadata — not written to created_by FK. */
export const GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_USER_ID =
  "00000000-0000-4000-8000-000000000010" as const

export const GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL =
  "ava-scheduler@growth.equipify.internal" as const

export type DraftFactorySchedulerGenerationProvenance = {
  generationSource: "draft_factory_scheduler"
  qaMarker: typeof GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_1A_QA_MARKER
  schedulerActorEmail: typeof GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL
  schedulerActorLogicalId: typeof GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_USER_ID
  organizationId: string
  generatedAt: string
}

export function buildDraftFactorySchedulerGenerationProvenance(input: {
  organizationId: string
  generatedAt: string
}): DraftFactorySchedulerGenerationProvenance {
  return {
    generationSource: "draft_factory_scheduler",
    qaMarker: GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_1A_QA_MARKER,
    schedulerActorEmail: GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL,
    schedulerActorLogicalId: GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_USER_ID,
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
  }
}
