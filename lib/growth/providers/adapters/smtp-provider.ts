import { connect } from "net"
import { connect as tlsConnect } from "tls"
import { buildRfc822Message, hasCredential, truncateTransportError } from "@/lib/growth/providers/adapters/adapter-utils"
import type {
  GrowthProviderAdapter,
  ProviderAdapterCredentials,
  ProviderSendMessage,
  ProviderSendResult,
} from "@/lib/growth/providers/adapters/provider-adapter-types"

function readSmtpResponse(socket: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    function onData(chunk: Buffer | string) {
      const text = String(chunk)
      if (/^\d{3} /.test(text)) {
        socket.off("data", onData)
        socket.off("error", onError)
        resolve(text.trim())
      }
    }
    function onError(error: Error) {
      socket.off("data", onData)
      reject(error)
    }
    socket.on("data", onData)
    socket.on("error", onError)
  })
}

async function smtpCommand(socket: NodeJS.ReadWriteStream, command: string): Promise<string> {
  socket.write(`${command}\r\n`)
  return readSmtpResponse(socket)
}

export async function sendViaSmtpNative(
  credentials: ProviderAdapterCredentials,
  message: ProviderSendMessage,
): Promise<ProviderSendResult> {
  const host = credentials.smtp_host
  const port = credentials.smtp_port ?? 587
  const user = credentials.smtp_user
  const pass = credentials.smtp_password
  const secure = credentials.smtp_secure ?? port === 465

  if (!host || !user || !pass) {
    return { ok: false, error: "SMTP host, user, and password are required." }
  }

  if (process.env.GROWTH_TRANSPORT_SIMULATE === "true") {
    return { ok: true, provider_message_id: `sim-smtp-${Date.now()}`, simulated: true }
  }

  return new Promise((resolve) => {
    const socket = secure
      ? tlsConnect({ host, port, servername: host })
      : connect({ host, port })

    const fail = (error: string) => {
      socket.destroy()
      resolve({ ok: false, error: truncateTransportError(error) })
    }

    socket.once("error", (error) => fail(error.message))

    void (async () => {
      try {
        await readSmtpResponse(socket)
        await smtpCommand(socket, `EHLO equipify.local`)
        if (!secure && port === 587) {
          await smtpCommand(socket, "STARTTLS")
          fail("STARTTLS upgrade not supported in native SMTP adapter — use port 465 with smtp_secure.")
          return
        }
        await smtpCommand(socket, "AUTH LOGIN")
        await smtpCommand(socket, Buffer.from(user).toString("base64"))
        const authResponse = await smtpCommand(socket, Buffer.from(pass).toString("base64"))
        if (!authResponse.startsWith("235")) {
          fail(`SMTP authentication failed: ${authResponse}`)
          return
        }

        const from = credentials.from_address ?? message.from
        await smtpCommand(socket, `MAIL FROM:<${from}>`)
        await smtpCommand(socket, `RCPT TO:<${message.to}>`)
        await smtpCommand(socket, "DATA")
        socket.write(`${buildRfc822Message({ ...message, from })}\r\n.\r\n`)
        const dataResponse = await readSmtpResponse(socket)
        await smtpCommand(socket, "QUIT")
        socket.destroy()

        if (!dataResponse.startsWith("250")) {
          resolve({ ok: false, error: truncateTransportError(dataResponse) })
          return
        }
        resolve({ ok: true, provider_message_id: `smtp-${Date.now()}` })
      } catch (error) {
        fail(error instanceof Error ? error.message : "SMTP send failed.")
      }
    })()
  })
}

export const smtpProviderAdapter: GrowthProviderAdapter = {
  family: "smtp",

  capabilities() {
    return { oauthMailbox: false, smtp: true, apiKey: false, webhooks: false, tracking: false }
  },

  validate(credentials) {
    if (!hasCredential(credentials.smtp_host)) {
      return { ok: false, status: "invalid", summary: "SMTP host is required." }
    }
    if (!hasCredential(credentials.smtp_user) || !hasCredential(credentials.smtp_password)) {
      return { ok: false, status: "invalid", summary: "SMTP username and password are required." }
    }
    return { ok: true, status: "valid", summary: "SMTP credentials present." }
  },

  health(credentials) {
    const validation = this.validate(credentials)
    if (!validation.ok) return { ok: false, tier: "degraded", summary: validation.summary }
    return { ok: true, tier: "healthy", summary: "SMTP transport adapter ready." }
  },

  async send(credentials, message) {
    return sendViaSmtpNative(credentials, message)
  },
}
