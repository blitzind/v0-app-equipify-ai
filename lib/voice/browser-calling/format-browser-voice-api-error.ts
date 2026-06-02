type VoiceBrowserApiErrorPayload = {
  error?: string | null
  message?: string | null
  authStage?: string | null
}

export function formatBrowserVoiceApiError(
  payload: VoiceBrowserApiErrorPayload,
  fallback: string,
): string {
  const authStage = payload.authStage?.trim() ?? null
  const error = payload.error?.trim() ?? null
  const message = payload.message?.trim() ?? null

  if (authStage === "no_session_cookie") {
    return "Your sign-in session expired. Refresh this page to restore browser calling."
  }
  if (authStage === "session_invalid") {
    return "Could not verify your sign-in session. Refresh this page and try again."
  }
  if (authStage === "not_org_member") {
    return "Growth Engine voice access requires membership in the configured organization."
  }
  if (authStage === "org_not_configured") {
    return "Growth Engine voice is not configured for this deployment."
  }
  if (authStage === "session_not_owned") {
    return "This call session belongs to another operator."
  }
  if (authStage === "workspace_session_missing") {
    return "Call workspace session is missing. Refresh the page and try again."
  }
  if (error === "membership_lookup_failed") {
    return "Could not verify organization membership. Wait a moment and try again."
  }
  if (error === "session_lookup_failed") {
    return "Could not verify call session access. Wait a moment and try again."
  }
  if (error === "forbidden" && message) {
    return message
  }
  if (error === "unauthorized" && message && message !== "Sign in required.") {
    return message
  }
  if (error === "unauthorized") {
    return "Your sign-in session expired. Refresh this page to restore browser calling."
  }
  return message ?? fallback
}
