"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  extractVoiceBrowserIncomingCallView,
  logBrowserIncomingCall,
  type TwilioVoiceSdkCall,
  type VoiceBrowserIncomingCallView,
} from "@/lib/voice/browser-calling/browser-incoming-call"
import { formatBrowserRegistrationError } from "@/lib/voice/browser-calling/format-browser-registration-error"
import {
  INBOUND_RING_DIAG_EVENTS,
  logInboundRingDiagnostic,
  withInboundRingElapsed,
} from "@/lib/voice/browser-calling/inbound-ring-diagnostics"
import type { VoiceBrowserSyncSnapshot } from "@/lib/voice/browser-calling/types"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "@/lib/voice/browser-calling/types"

type VoiceBrowserTokenResponse = {
  ok?: boolean
  token?: string | null
  clientIdentity?: string
  stubMode?: boolean
  message?: string
}

type VoiceBrowserRegisterResponse = {
  ok?: boolean
  device?: { clientIdentity: string }
  message?: string
}

type VoiceBrowserSyncResponse = {
  ok?: boolean
  snapshot?: VoiceBrowserSyncSnapshot
  message?: string
}

type TwilioVoiceDevice = {
  on: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void
  register: () => Promise<void>
  unregister?: () => Promise<void>
  destroy?: () => void
}

const VOICE_BROWSER_SYNC_INTERVAL_MS = 4000
const VOICE_BROWSER_RINGING_SYNC_INTERVAL_MS = 1000
const VOICE_BROWSER_ACTIVE_CALL_SYNC_INTERVAL_MS = 2000

export function useVoiceBrowserCalling(input?: {
  workspaceSessionId?: string | null
  enabled?: boolean
  onInboundOffer?: (snapshot: VoiceBrowserSyncSnapshot) => void
  onIncomingCleared?: (reason: string) => void
}) {
  const enabled = input?.enabled !== false
  const [snapshot, setSnapshot] = useState<VoiceBrowserSyncSnapshot | null>(null)
  const [clientIdentity, setClientIdentity] = useState<string | null>(null)
  const [incomingCall, setIncomingCall] = useState<VoiceBrowserIncomingCallView | null>(null)
  const [registrationState, setRegistrationState] = useState<"idle" | "registering" | "registered" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const deviceRef = useRef<TwilioVoiceDevice | null>(null)
  const clientIdentityRef = useRef<string | null>(null)
  const incomingTwilioCallRef = useRef<TwilioVoiceSdkCall | null>(null)
  const activeTwilioCallRef = useRef<TwilioVoiceSdkCall | null>(null)
  const callHandlersRef = useRef(new WeakMap<TwilioVoiceSdkCall, { cancel: () => void; disconnect: () => void }>())
  const workspaceSessionIdRef = useRef(input?.workspaceSessionId ?? null)
  const inboundOfferRef = useRef(input?.onInboundOffer)
  const onIncomingClearedRef = useRef(input?.onIncomingCleared)
  const voiceCallCreatedAtRef = useRef<string | null>(null)
  workspaceSessionIdRef.current = input?.workspaceSessionId ?? null
  inboundOfferRef.current = input?.onInboundOffer
  onIncomingClearedRef.current = input?.onIncomingCleared

  const clearIncomingCall = useCallback((reason: string) => {
    const call = incomingTwilioCallRef.current
    const hadIncoming = Boolean(call)
    if (call) {
      const handlers = callHandlersRef.current.get(call)
      if (handlers) {
        call.removeListener?.("cancel", handlers.cancel)
        call.removeListener?.("disconnect", handlers.disconnect)
        callHandlersRef.current.delete(call)
      }
    }
    incomingTwilioCallRef.current = null
    setIncomingCall(null)
    logBrowserIncomingCall("incoming_cleared", { reason })
    if (hadIncoming && (reason === "cancel" || reason === "disconnect")) {
      const callView = call ? extractVoiceBrowserIncomingCallView(call) : null
      logInboundRingDiagnostic(
        INBOUND_RING_DIAG_EVENTS.SDK_INCOMING_CANCELLED,
        withInboundRingElapsed(voiceCallCreatedAtRef.current, {
          reason,
          call_sid: callView?.callSid ?? null,
          voice_call_id: snapshotRef.current?.inboundRinging?.voiceCallId ?? null,
          native_session_id: snapshotRef.current?.inboundRinging?.workspaceSessionId ?? null,
        }),
      )
      onIncomingClearedRef.current?.(reason)
    }
  }, [])

  const attachCallLifecycleHandlers = useCallback(
    (call: TwilioVoiceSdkCall, role: "incoming" | "active") => {
      const onEnded = (reason: string) => {
        if (incomingTwilioCallRef.current === call) clearIncomingCall(reason)
        if (activeTwilioCallRef.current === call) activeTwilioCallRef.current = null
      }
      const cancelHandler = () => onEnded("cancel")
      const disconnectHandler = () => onEnded("disconnect")
      call.on?.("cancel", cancelHandler)
      call.on?.("disconnect", disconnectHandler)
      callHandlersRef.current.set(call, { cancel: cancelHandler, disconnect: disconnectHandler })
      if (role === "incoming") {
        const view = extractVoiceBrowserIncomingCallView(call)
        logBrowserIncomingCall("incoming_received", {
          role,
          ...view,
        })
        logInboundRingDiagnostic(
          INBOUND_RING_DIAG_EVENTS.SDK_INCOMING_RECEIVED,
          withInboundRingElapsed(voiceCallCreatedAtRef.current, {
            role,
            call_sid: view.callSid,
            from_number: view.fromNumber,
            to_number: view.toNumber,
            voice_call_id: snapshotRef.current?.inboundRinging?.voiceCallId ?? null,
            native_session_id: snapshotRef.current?.inboundRinging?.workspaceSessionId ?? null,
          }),
        )
      }
    },
    [clearIncomingCall],
  )

  const sync = useCallback(async () => {
    if (!enabled) return null
    const params = new URLSearchParams()
    if (clientIdentityRef.current) params.set("clientIdentity", clientIdentityRef.current)
    if (workspaceSessionIdRef.current) params.set("workspaceSessionId", workspaceSessionIdRef.current)
    const res = await fetch(`/api/platform/growth/voice/browser/sync?${params.toString()}`, {
      cache: "no-store",
    })
    const data = (await res.json().catch(() => ({}))) as VoiceBrowserSyncResponse
    if (!res.ok || !data.snapshot) {
      throw new Error(data.message ?? "Could not sync voice browser state.")
    }
    setSnapshot(data.snapshot)
    if (data.snapshot.inboundRinging?.voiceCallCreatedAt) {
      voiceCallCreatedAtRef.current = data.snapshot.inboundRinging.voiceCallCreatedAt
    }
    if (data.snapshot.inboundRinging || incomingTwilioCallRef.current) {
      inboundOfferRef.current?.(data.snapshot)
    }
    return data.snapshot
  }, [enabled])

  const syncRef = useRef(sync)
  syncRef.current = sync
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot

  const handleDeviceIncoming = useCallback(
    (call: TwilioVoiceSdkCall) => {
      incomingTwilioCallRef.current = call
      setIncomingCall(extractVoiceBrowserIncomingCallView(call))
      attachCallLifecycleHandlers(call, "incoming")
      void syncRef.current().catch(() => undefined)
    },
    [attachCallLifecycleHandlers],
  )

  const handleDeviceIncomingRef = useRef(handleDeviceIncoming)
  handleDeviceIncomingRef.current = handleDeviceIncoming

  const onDeviceIncoming = useCallback((call: unknown) => {
    handleDeviceIncomingRef.current(call as TwilioVoiceSdkCall)
  }, [])

  const disconnectDevice = useCallback(async () => {
    const device = deviceRef.current
    deviceRef.current = null
    if (device) {
      device.removeListener("incoming", onDeviceIncoming)
    }
    clearIncomingCall("device_disconnect")
    activeTwilioCallRef.current?.disconnect?.()
    activeTwilioCallRef.current = null
    if (!device) return
    try {
      await device.unregister?.()
    } catch {
      // ignore teardown errors
    }
    device.destroy?.()
  }, [clearIncomingCall, onDeviceIncoming])

  const acceptIncomingCall = useCallback(async () => {
    const call = incomingTwilioCallRef.current
    logBrowserIncomingCall("answer_clicked", {
      callSid: call ? extractVoiceBrowserIncomingCallView(call).callSid : null,
    })
    if (!call?.accept) {
      const message = "No Twilio browser call is available to answer."
      logBrowserIncomingCall("accept_failed", { message })
      throw new Error(message)
    }
    try {
      call.accept()
      activeTwilioCallRef.current = call
      incomingTwilioCallRef.current = null
      setIncomingCall(null)
      attachCallLifecycleHandlers(call, "active")
      logBrowserIncomingCall("accept_succeeded", {
        callSid: extractVoiceBrowserIncomingCallView(call).callSid,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Twilio call.accept() failed."
      logBrowserIncomingCall("accept_failed", { message })
      throw new Error(message)
    }
  }, [attachCallLifecycleHandlers])

  const rejectIncomingCall = useCallback(async () => {
    const call = incomingTwilioCallRef.current
    logBrowserIncomingCall("reject_clicked", {
      callSid: call ? extractVoiceBrowserIncomingCallView(call).callSid : null,
    })
    if (!call) return
    try {
      call.reject?.()
      logBrowserIncomingCall("reject_succeeded", {
        callSid: extractVoiceBrowserIncomingCallView(call).callSid,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Twilio call.reject() failed."
      logBrowserIncomingCall("reject_failed", { message })
      throw new Error(message)
    } finally {
      clearIncomingCall("operator_reject")
    }
  }, [clearIncomingCall])

  const disconnectActiveCall = useCallback(async () => {
    const call = activeTwilioCallRef.current ?? incomingTwilioCallRef.current
    logBrowserIncomingCall("hangup_clicked", {
      callSid: call ? extractVoiceBrowserIncomingCallView(call).callSid : null,
    })
    if (!call) return
    try {
      call.disconnect?.()
      logBrowserIncomingCall("hangup_succeeded", {
        callSid: extractVoiceBrowserIncomingCallView(call).callSid,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Twilio call.disconnect() failed."
      logBrowserIncomingCall("hangup_failed", { message })
      throw new Error(message)
    } finally {
      clearIncomingCall("operator_hangup")
      if (activeTwilioCallRef.current === call) activeTwilioCallRef.current = null
    }
  }, [clearIncomingCall])

  const register = useCallback(async () => {
    if (!enabled) return
    setRegistrationState("registering")
    setError(null)
    try {
      const tokenRes = await fetch("/api/platform/growth/voice/browser/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttlSeconds: 3600 }),
      })
      const tokenData = (await tokenRes.json().catch(() => ({}))) as VoiceBrowserTokenResponse
      if (!tokenRes.ok || !tokenData.clientIdentity) {
        throw new Error(tokenData.message ?? "Could not fetch browser calling token.")
      }

      const registerRes = await fetch("/api/platform/growth/voice/browser/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientIdentity: tokenData.clientIdentity,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        }),
      })
      const registerData = (await registerRes.json().catch(() => ({}))) as VoiceBrowserRegisterResponse
      if (!registerRes.ok) {
        throw new Error(registerData.message ?? "Could not register browser device.")
      }

      clientIdentityRef.current = tokenData.clientIdentity
      setClientIdentity(tokenData.clientIdentity)
      await disconnectDevice()

      if (tokenData.token && !tokenData.stubMode) {
        const { Device } = await import("@twilio/voice-sdk")
        const device = new Device(tokenData.token, {
          logLevel: 1,
          codecPreferences: ["opus", "pcmu"],
        }) as TwilioVoiceDevice

        let registrationError: unknown = null
        const captureRegistrationError = (error: unknown) => {
          registrationError = error
        }
        device.on("error", captureRegistrationError)
        device.on("incoming", onDeviceIncoming)
        device.on("tokenWillExpire", () => undefined)

        try {
          await device.register()
        } catch (registerError) {
          captureRegistrationError(registerError)
          device.removeListener("incoming", onDeviceIncoming)
          device.destroy?.()
          throw new Error(formatBrowserRegistrationError(registrationError ?? registerError))
        } finally {
          device.removeListener("error", captureRegistrationError)
        }

        deviceRef.current = device
      }

      setRegistrationState("registered")
      await syncRef.current()
    } catch (e) {
      setRegistrationState("error")
      setError(formatBrowserRegistrationError(e))
    }
  }, [disconnectDevice, enabled, onDeviceIncoming])

  useEffect(() => {
    if (!enabled) return
    void register()
    return () => {
      void disconnectDevice()
      const identity = clientIdentityRef.current
      if (identity) {
        void fetch(`/api/platform/growth/voice/browser/register?clientIdentity=${encodeURIComponent(identity)}`, {
          method: "DELETE",
        })
      }
    }
  }, [disconnectDevice, enabled, register])

  useEffect(() => {
    if (!enabled || registrationState !== "registered") return

    const intervalMs =
      incomingCall || snapshot?.inboundRinging
        ? VOICE_BROWSER_RINGING_SYNC_INTERVAL_MS
        : snapshot?.browserCallState &&
            ["active", "held", "muted", "ringing", "connecting"].includes(snapshot.browserCallState)
          ? VOICE_BROWSER_ACTIVE_CALL_SYNC_INTERVAL_MS
          : VOICE_BROWSER_SYNC_INTERVAL_MS

    const intervalId = window.setInterval(() => {
      void syncRef.current().catch(() => undefined)
    }, intervalMs)

    return () => window.clearInterval(intervalId)
  }, [enabled, registrationState, incomingCall, snapshot?.inboundRinging, snapshot?.browserCallState])

  return {
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    snapshot,
    clientIdentity,
    incomingCall,
    registrationState,
    error,
    refresh: sync,
    acceptIncomingCall,
    rejectIncomingCall,
    disconnectActiveCall,
  }
}
