"use client"

import { useCallback, useEffect, useState } from "react"
import { BellOff, BellRing, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_OPERATOR_NOTIFICATION_PUSH_SERVICE_WORKER_PATH } from "@/lib/growth/notifications/growth-notification-push-types"

type PushStatusResponse = {
  ok?: boolean
  supported?: boolean
  enabled?: boolean
  subscriptionCount?: number
  vapidPublicKey?: string | null
  serviceWorkerPath?: string
  message?: string
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function isBrowserPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
}

export function GrowthNotificationPushSubscribe() {
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [subscriptionCount, setSubscriptionCount] = useState(0)
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const browserSupported = isBrowserPushSupported()
      setSupported(browserSupported)
      setPermission(browserSupported ? Notification.permission : "unsupported")

      const res = await fetch("/api/platform/growth/notifications/push/status", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as PushStatusResponse
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load browser push status.")

      setEnabled(Boolean(data.enabled))
      setSubscriptionCount(data.subscriptionCount ?? 0)
      setVapidPublicKey(data.vapidPublicKey ?? null)
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not load browser push status.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  async function enableBrowserPush() {
    if (!supported || !vapidPublicKey) {
      setError("Browser push is not configured for this deployment.")
      return
    }

    setActing(true)
    setError(null)

    try {
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)
      if (permissionResult !== "granted") {
        throw new Error("Notification permission was not granted.")
      }

      const registration = await navigator.serviceWorker.register(
        GROWTH_OPERATOR_NOTIFICATION_PUSH_SERVICE_WORKER_PATH,
        { scope: "/admin/growth/" },
      )
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      const res = await fetch("/api/platform/growth/notifications/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as PushStatusResponse
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not enable browser push.")

      await refreshStatus()
    } catch (enableError) {
      setError(enableError instanceof Error ? enableError.message : "Could not enable browser push.")
    } finally {
      setActing(false)
    }
  }

  async function disableBrowserPush() {
    setActing(true)
    setError(null)

    try {
      const registration = await navigator.serviceWorker.getRegistration("/admin/growth/")
      const subscription = registration ? await registration.pushManager.getSubscription() : null

      if (subscription) {
        const res = await fetch("/api/platform/growth/notifications/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        const data = (await res.json().catch(() => ({}))) as PushStatusResponse
        if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not disable browser push.")
        await subscription.unsubscribe()
      }

      await refreshStatus()
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "Could not disable browser push.")
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">Browser push</p>
          <p className="text-sm text-muted-foreground">
            Deliver persisted operator notifications to this browser. Permission is requested only when you click
            enable.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <GrowthBadge
              label={enabled ? "Enabled" : "Disabled"}
              tone={enabled ? "high" : "neutral"}
            />
            {permission !== "unsupported" ? (
              <GrowthBadge label={`Permission: ${permission}`} tone="neutral" />
            ) : null}
            <GrowthBadge label={`Devices: ${subscriptionCount}`} tone="neutral" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {loading ? (
            <Button size="sm" variant="outline" disabled>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading
            </Button>
          ) : enabled ? (
            <Button size="sm" variant="outline" disabled={acting || !supported} onClick={() => void disableBrowserPush()}>
              {acting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <BellOff className="mr-2 size-4" />}
              Disable browser push
            </Button>
          ) : (
            <Button size="sm" disabled={acting || !supported || !vapidPublicKey} onClick={() => void enableBrowserPush()}>
              {acting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <BellRing className="mr-2 size-4" />}
              Enable browser push
            </Button>
          )}
        </div>
      </div>

      {!supported ? (
        <p className="mt-3 text-sm text-muted-foreground">Browser push is not supported in this browser.</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
