/** Apollo sequence personalization constants — client-safe. */

export const APOLLO_SEQUENCE_PERSONALIZATION_SERVICE_QA_MARKER =
  "apollo-sequence-personalization-service-v1" as const

/** SMS personalization blocked — no valid E.164 phone on execution candidate. */
export const APOLLO_SMS_PERSONALIZATION_MISSING_PHONE_BLOCKER =
  "sms_personalization:missing_phone" as const
