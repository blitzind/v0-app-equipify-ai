"use client"

import { useCallback, useEffect, useState } from "react"
import { BellOff, BellRing, Loader2, MonitorSmartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GrowthSettingsCard,
  GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER,
} from "@/components/growth/growth-settings-ui"
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

function summarizeBrowserName(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return "Microsoft Edge"
  if (/Chrome\//.test(userAgent)) return "Google Chrome"
  if (/Firefox\//.test(userAgent)) return "Mozilla Firefox"
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "Safari"
  return "This browser"
}

function permissionLabel(permission: NotificationPermission | "unsupported"): string {
  if (permission === "unsupported") return "Not supported"
  if (permission === "granted") return "Allowed"
  if (permission === "denied") return "Blocked"
  return "Not requested"
}

type StatusRowProps = { label: string; value: string; valueClassName?: string }

function StatusRow({ label, value, valueClassName }: StatusRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2.5 last:border-b-0 dark:border-[#25324C]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`text-right text-sm font-medium text-foreground ${valueClassName ?? ""}`}>{value}</dd>
    </div>
  )
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
  const [browserName, setBrowserName] = useState("This browser")

  const refreshStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const browserSupported = isBrowserPushSupported()
      setSupported(browserSupported)
      setPermission(browserSupported ? Notification.permission : "unsupported")
      setBrowserName(typeof navigator !== "undefined" ? summarizeBrowserName(navigator.userAgent) : "This browser")

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
    <GrowthSettingsCard
      title="Browser status"
      icon={<MonitorSmartphone className="size-4" aria-hidden />}
    >
      <div data-qa-marker={GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER}>
        <p className="mb-4 text-sm text-muted-foreground">
          Receive live Growth alerts on this device. Permission is requested only when you enable notifications.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading browser status…
          </div>
        ) : (
          <>
            <dl className="rounded-lg border border-border/70 bg-muted/20 px-3 dark:border-[#25324C]">
              <StatusRow label="Status" value={enabled ? "Enabled" : "Disabled"} />
              <StatusRow label="Permission" value={permissionLabel(permission)} />
              <StatusRow label="Current browser" value={browserName} />
              <StatusRow
                label="Device registration"
                value={subscriptionCount === 0 ? "None" : `${subscriptionCount} registered`}
              />
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <GrowthBadge label={enabled ? "Receiving alerts" : "Not receiving alerts"} tone={enabled ? "high" : "neutral"} />
              {!supported ? (
                <GrowthBadge label="Unsupported browser" tone="attention" />
              ) : null}
            </div>
          </>
        )}

        {!supported && !loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Browser push is not supported in this browser.</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-border/60 pt-4 dark:border-[#25324C]">
          {loading ? (
            <Button size="sm" variant="outline" disabled>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading
            </Button>
          ) : enabled ? (
            <Button size="sm" variant="outline" disabled={acting || !supported} onClick={() => void disableBrowserPush()}>
              {acting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <BellOff className="mr-2 size-4" />}
              Disable notifications
            </Button>
          ) : (
            <Button size="sm" disabled={acting || !supported || !vapidPublicKey} onClick={() => void enableBrowserPush()}>
              {acting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <BellRing className="mr-2 size-4" />}
              Enable notifications
            </Button>
          )}
        </div>
      </div>
    </GrowthSettingsCard>
  )
}
