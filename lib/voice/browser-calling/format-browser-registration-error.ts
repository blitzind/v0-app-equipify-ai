type TwilioRegistrationErrorLike = {
  code?: number
  message?: string
  twilioError?: {
    code?: number
    message?: string
  }
}

function readTwilioRegistrationErrorCode(error: TwilioRegistrationErrorLike): number | null {
  if (typeof error.code === "number") return error.code
  if (typeof error.twilioError?.code === "number") return error.twilioError.code
  return null
}

function readTwilioRegistrationErrorMessage(error: TwilioRegistrationErrorLike): string | null {
  if (typeof error.message === "string" && error.message.trim()) return error.message.trim()
  if (typeof error.twilioError?.message === "string" && error.twilioError.message.trim()) {
    return error.twilioError.message.trim()
  }
  return null
}

export function formatBrowserRegistrationError(error: unknown): string {
  if (error instanceof Error) {
    const code = readTwilioRegistrationErrorCode(error as TwilioRegistrationErrorLike)
    const message = readTwilioRegistrationErrorMessage(error as TwilioRegistrationErrorLike) ?? error.message
    if (code === 31204 || /31204/.test(message) || /jwt is invalid/i.test(message)) {
      return `Twilio error 31204: JWT is invalid. Twilio could not validate the browser access token. Verify TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET belong to the same Twilio account as TWILIO_ACCOUNT_SID, then redeploy. (${message})`
    }
    if (code != null) {
      return `Twilio error ${code}: ${message}`
    }
    return message
  }

  if (error && typeof error === "object") {
    const code = readTwilioRegistrationErrorCode(error as TwilioRegistrationErrorLike)
    const message = readTwilioRegistrationErrorMessage(error as TwilioRegistrationErrorLike)
    if (code === 31204 || (message && (/31204/.test(message) || /jwt is invalid/i.test(message)))) {
      return `Twilio error 31204: JWT is invalid. Twilio could not validate the browser access token. Verify TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET belong to the same Twilio account as TWILIO_ACCOUNT_SID, then redeploy.${message ? ` (${message})` : ""}`
    }
    if (code != null && message) {
      return `Twilio error ${code}: ${message}`
    }
    if (message) return message
  }

  return "Browser calling registration failed before Twilio Device registration completed. Check server token diagnostics and browser console for Twilio error details."
}
