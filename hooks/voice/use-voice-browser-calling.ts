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
  updateToken?: (token: string) => void
}

type DeviceLifecycleHandlers = {
  registered: () => void
  unregistered: () => void
  error: (error: unknown) => void
  tokenWillExpire: () => void
}

async function fetchVoiceBrowserAccessToken(): Promise<VoiceBrowserTokenResponse> {
  const tokenRes = await fetch("/api/platform/growth/voice/browser/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ttlSeconds: 3600 }),
  })
  const tokenData = (await tokenRes.json().catch(() => ({}))) as VoiceBrowserTokenResponse
  if (!tokenRes.ok || !tokenData.clientIdentity) {
    throw new Error(tokenData.message ?? "Could not fetch browser calling token.")
  }
  return tokenData
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
  const sdkRegisteredRef = useRef(false)
  const deviceLifecycleHandlersRef = useRef<DeviceLifecycleHandlers | null>(null)
  const reregisterTimeoutRef = useRef<number | null>(null)
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
    if (sdkRegisteredRef.current && clientIdentityRef.current) {
      params.set("clientIdentity", clientIdentityRef.current)
    }
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

  const clearReregisterTimeout = useCallback(() => {
    if (reregisterTimeoutRef.current !== null) {
      window.clearTimeout(reregisterTimeoutRef.current)
      reregisterTimeoutRef.current = null
    }
  }, [])

  const detachDeviceLifecycleHandlers = useCallback((device: TwilioVoiceDevice) => {
    const handlers = deviceLifecycleHandlersRef.current
    if (!handlers) return
    device.removeListener("registered", handlers.registered)
    device.removeListener("unregistered", handlers.unregistered)
    device.removeListener("error", handlers.error)
    device.removeListener("tokenWillExpire", handlers.tokenWillExpire)
    deviceLifecycleHandlersRef.current = null
  }, [])

  const markBrowserDeviceOffline = useCallback(async () => {
    const identity = clientIdentityRef.current
    if (!identity) return
    await fetch(`/api/platform/growth/voice/browser/register?clientIdentity=${encodeURIComponent(identity)}`, {
      method: "DELETE",
    }).catch(() => undefined)
  }, [])

  const disconnectDevice = useCallback(async () => {
    clearReregisterTimeout()
    sdkRegisteredRef.current = false
    const device = deviceRef.current
    deviceRef.current = null
    if (device) {
      device.removeListener("incoming", onDeviceIncoming)
      detachDeviceLifecycleHandlers(device)
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
  }, [clearIncomingCall, clearReregisterTimeout, detachDeviceLifecycleHandlers, onDeviceIncoming])

  const registerRef = useRef<(() => Promise<void>) | null>(null)
  const scheduleReregisterRef = useRef<(() => void) | null>(null)

  const scheduleReregister = useCallback(() => {
    if (!enabled || reregisterTimeoutRef.current !== null) return
    setRegistrationState("registering")
    reregisterTimeoutRef.current = window.setTimeout(() => {
      reregisterTimeoutRef.current = null
      void registerRef.current?.()
    }, 2000)
  }, [enabled])

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
      if (!sdkRegisteredRef.current) {
        scheduleReregisterRef.current?.()
      }
    }
  }, [clearIncomingCall])

  const register = useCallback(async () => {
    if (!enabled) return
    clearReregisterTimeout()
    setRegistrationState("registering")
    setError(null)
    sdkRegisteredRef.current = false
    try {
      const tokenData = await fetchVoiceBrowserAccessToken()

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

        const lifecycleHandlers: DeviceLifecycleHandlers = {
          registered: () => {
            if (deviceRef.current !== device) return
            sdkRegisteredRef.current = true
            setRegistrationState("registered")
            setError(null)
            logBrowserIncomingCall("sdk_registered", {})
          },
          unregistered: () => {
            if (deviceRef.current !== device) return
            sdkRegisteredRef.current = false
            setRegistrationState("error")
            setError("Browser phone disconnected. Reconnecting…")
            logBrowserIncomingCall("sdk_unregistered", {})
            void markBrowserDeviceOffline()
            if (!activeTwilioCallRef.current && !incomingTwilioCallRef.current) {
              scheduleReregister()
            }
          },
          error: (deviceError: unknown) => {
            if (deviceRef.current !== device) return
            logBrowserIncomingCall("sdk_error", {
              message: deviceError instanceof Error ? deviceError.message : String(deviceError),
            })
            if (activeTwilioCallRef.current || incomingTwilioCallRef.current) return
            sdkRegisteredRef.current = false
            setRegistrationState("error")
            setError(formatBrowserRegistrationError(deviceError))
            void markBrowserDeviceOffline()
            scheduleReregister()
          },
          tokenWillExpire: () => {
            if (deviceRef.current !== device) return
            void (async () => {
              try {
                const refreshed = await fetchVoiceBrowserAccessToken()
                if (refreshed.token) {
                  device.updateToken?.(refreshed.token)
                  logBrowserIncomingCall("sdk_token_refreshed", {})
                }
              } catch (refreshError) {
                logBrowserIncomingCall("sdk_token_refresh_failed", {
                  message: refreshError instanceof Error ? refreshError.message : String(refreshError),
                })
                sdkRegisteredRef.current = false
                void markBrowserDeviceOffline()
                scheduleReregister()
              }
            })()
          },
        }
        deviceLifecycleHandlersRef.current = lifecycleHandlers

        device.on("error", captureRegistrationError)
        device.on("incoming", onDeviceIncoming)
        device.on("registered", lifecycleHandlers.registered)
        device.on("unregistered", lifecycleHandlers.unregistered)
        device.on("error", lifecycleHandlers.error)
        device.on("tokenWillExpire", lifecycleHandlers.tokenWillExpire)

        try {
          await device.register()
        } catch (registerError) {
          captureRegistrationError(registerError)
          device.removeListener("incoming", onDeviceIncoming)
          detachDeviceLifecycleHandlers(device)
          device.destroy?.()
          throw new Error(formatBrowserRegistrationError(registrationError ?? registerError))
        } finally {
          device.removeListener("error", captureRegistrationError)
        }

        deviceRef.current = device
      } else {
        sdkRegisteredRef.current = true
      }

      setRegistrationState("registered")
      await syncRef.current()
    } catch (e) {
      setRegistrationState("error")
      setError(formatBrowserRegistrationError(e))
    }
  }, [
    clearReregisterTimeout,
    detachDeviceLifecycleHandlers,
    disconnectDevice,
    enabled,
    markBrowserDeviceOffline,
    onDeviceIncoming,
    scheduleReregister,
  ])

  registerRef.current = register
  scheduleReregisterRef.current = scheduleReregister

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
