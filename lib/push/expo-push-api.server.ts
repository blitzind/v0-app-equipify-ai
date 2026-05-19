import "server-only"

import { isValidExpoPushToken } from "@/lib/push/push-device-validation"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

export type ExpoPushMessage = {
  to: string
  title: string
  body: string
  sound?: "default" | null
  data?: Record<string, string>
  priority?: "default" | "high"
}

export type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message?: string; details?: { error?: string } }

export type ExpoPushSendResult =
  | { ok: true; ticketId: string }
  | { ok: false; code: string; message?: string; deviceNotRegistered?: boolean }

function expoAccessToken(): string | undefined {
  const token = process.env.EXPO_ACCESS_TOKEN?.trim()
  return token || undefined
}

export function isExpoPushLiveSendEnabled(): boolean {
  const flag = process.env.EQUIPIFY_PUSH_LIVE_SEND?.trim()
  if (flag === "0" || flag === "false") return false
  return Boolean(expoAccessToken())
}

/**
 * Sends one Expo push message. Returns deviceNotRegistered when Expo reports an invalid token.
 */
export async function sendExpoPushMessage(message: ExpoPushMessage): Promise<ExpoPushSendResult> {
  if (!isValidExpoPushToken(message.to)) {
    return { ok: false, code: "invalid_token" }
  }

  if (!isExpoPushLiveSendEnabled()) {
    return { ok: true, ticketId: "noop_simulated" }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  const accessToken = expoAccessToken()
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  let response: Response
  try {
    response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify([
        {
          to: message.to.trim(),
          title: message.title,
          body: message.body,
          sound: message.sound ?? "default",
          data: message.data,
          priority: message.priority ?? "default",
        },
      ]),
    })
  } catch {
    return { ok: false, code: "network_error" }
  }

  if (!response.ok) {
    return { ok: false, code: "http_error", message: `status_${response.status}` }
  }

  let payload: { data?: ExpoPushTicket[] }
  try {
    payload = (await response.json()) as { data?: ExpoPushTicket[] }
  } catch {
    return { ok: false, code: "invalid_response" }
  }

  const ticket = payload.data?.[0]
  if (!ticket) {
    return { ok: false, code: "missing_ticket" }
  }

  if (ticket.status === "ok" && ticket.id) {
    return { ok: true, ticketId: ticket.id }
  }

  const errorCode = ticket.status === "error" ? ticket.details?.error : undefined
  const deviceNotRegistered = errorCode === "DeviceNotRegistered"
  return {
    ok: false,
    code: errorCode ?? "expo_error",
    message: ticket.status === "error" ? ticket.message : undefined,
    deviceNotRegistered,
  }
}
