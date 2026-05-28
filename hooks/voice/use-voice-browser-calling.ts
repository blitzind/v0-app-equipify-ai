"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

export function useVoiceBrowserCalling(input?: {
  workspaceSessionId?: string | null
  enabled?: boolean
  onInboundOffer?: (snapshot: VoiceBrowserSyncSnapshot) => void
}) {
  const enabled = input?.enabled !== false
  const [snapshot, setSnapshot] = useState<VoiceBrowserSyncSnapshot | null>(null)
  const [clientIdentity, setClientIdentity] = useState<string | null>(null)
  const [registrationState, setRegistrationState] = useState<"idle" | "registering" | "registered" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const deviceRef = useRef<{ destroy?: () => void; unregister?: () => Promise<void> } | null>(null)
  const clientIdentityRef = useRef<string | null>(null)
  const inboundOfferRef = useRef(input?.onInboundOffer)
  inboundOfferRef.current = input?.onInboundOffer

  const disconnectDevice = useCallback(async () => {
    const device = deviceRef.current
    deviceRef.current = null
    if (!device) return
    try {
      await device.unregister?.()
    } catch {
      // ignore teardown errors
    }
    device.destroy?.()
  }, [])

  const sync = useCallback(async () => {
    if (!enabled) return null
    const params = new URLSearchParams()
    if (clientIdentityRef.current) params.set("clientIdentity", clientIdentityRef.current)
    if (input?.workspaceSessionId) params.set("workspaceSessionId", input.workspaceSessionId)
    const res = await fetch(`/api/platform/growth/voice/browser/sync?${params.toString()}`, {
      cache: "no-store",
    })
    const data = (await res.json().catch(() => ({}))) as VoiceBrowserSyncResponse
    if (!res.ok || !data.snapshot) {
      throw new Error(data.message ?? "Could not sync voice browser state.")
    }
    setSnapshot(data.snapshot)
    if (data.snapshot.inboundRinging) {
      inboundOfferRef.current?.(data.snapshot)
    }
    return data.snapshot
  }, [enabled, input?.workspaceSessionId])

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
        })
        await device.register()
        deviceRef.current = device
      }

      setRegistrationState("registered")
      await sync()
    } catch (e) {
      setRegistrationState("error")
      setError(e instanceof Error ? e.message : "Browser calling registration failed.")
    }
  }, [disconnectDevice, enabled, sync])

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
    const intervalId = window.setInterval(() => {
      void sync().catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(intervalId)
  }, [enabled, registrationState, sync])

  return {
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    snapshot,
    clientIdentity,
    registrationState,
    error,
    refresh: sync,
  }
}
