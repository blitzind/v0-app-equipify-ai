/** Client-safe Lemlist API error mapping (Growth Engine slice 6.15A). */

export class LemlistApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function mapLemlistApiError(status: number, payload: unknown): LemlistApiError {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.error === "string"
        ? record.error
        : typeof payload === "string"
          ? payload
          : "Lemlist API request failed."

  if (status === 401 || status === 403) {
    return new LemlistApiError("lemlist_auth_failed", "Lemlist API credentials were rejected.", status)
  }
  if (status === 429) {
    return new LemlistApiError("lemlist_rate_limited", "Lemlist rate limit reached. Retry shortly.", status)
  }
  if (status === 404) {
    return new LemlistApiError("lemlist_not_found", "Lemlist resource was not found.", status)
  }
  if (status >= 500) {
    return new LemlistApiError("lemlist_unavailable", "Lemlist is temporarily unavailable.", status)
  }
  return new LemlistApiError("lemlist_request_failed", message.slice(0, 240), status)
}

export function mapLemlistExecutionError(error: unknown): { code: string; message: string } {
  if (error instanceof LemlistApiError) {
    return { code: error.code, message: error.message }
  }
  const message = error instanceof Error ? error.message : String(error)
  return { code: "lemlist_execution_failed", message: message.slice(0, 240) || "Lemlist execution failed." }
}
