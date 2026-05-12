/** When true, `POST .../prepared-actions/prepare` may call `runAiTask` to propose intent (still merged + resolver-validated). */
export function isAidenPreparedIntentLlmEnabled(): boolean {
  const v = process.env.AIDEN_PREPARED_INTENT_LLM_ENABLED?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}
