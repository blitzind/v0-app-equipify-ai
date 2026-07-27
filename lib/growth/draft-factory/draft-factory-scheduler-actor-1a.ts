/**
 * AVA-SUPERVISED-GPT-SCHEDULER-WIRING-1A — Non-human automation actor for scheduler GPT generation.
 *
 * Authority: organization-scoped draft-factory scheduler service identity used only as
 * `created_by` audit metadata on scheduler-generated supervised drafts. This actor cannot
 * approve, assign senders, or transport outbound messages.
 */

export const GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_1A_QA_MARKER =
  "ava-supervised-gpt-scheduler-wiring-1a-v1" as const

/** Well-known service actor UUID — not a human operator. */
export const GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_USER_ID =
  "00000000-0000-4000-8000-000000000010" as const

export const GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL =
  "ava-scheduler@growth.equipify.internal" as const
