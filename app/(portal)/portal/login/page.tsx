"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { BrandLogoOnLight } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const NOTICE_COPY: Record<string, string> = {
  no_staff_portal:
    "There is no customer portal login linked to your staff email for this workspace yet. Invite yourself from Customers (portal invite) or paste an invite token below.",
  portal_revoked: "Portal access for this email has been revoked.",
  org_archived: "This workspace is no longer available.",
  invalid_preview: "Preview could not be started. Return to Settings → Customer Portal and try again.",
}

function PortalLoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [manualToken, setManualToken] = useState("")

  useEffect(() => {
    const e = searchParams.get("error")
    const n = searchParams.get("notice")
    setErr(null)
    setInfo(null)
    if (e === "misconfigured") {
      setErr("Portal sign-in is not configured for this environment.")
    } else if (e === "preview_forbidden") {
      setErr("You don't have permission to preview the portal for this organization.")
    }
    if (n && NOTICE_COPY[n]) {
      setInfo(NOTICE_COPY[n]!)
    }
  }, [searchParams])

  useEffect(() => {
    const token = searchParams.get("token")
    if (!token) return
    setBusy(true)
    setErr(null)
    fetch("/api/portal/access/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { error?: string; redirectTo?: string }
        if (!r.ok) throw new Error(j.error ?? "Could not sign in.")
        const next = searchParams.get("next")?.trim()
        const safeNext =
          next && next.startsWith("/portal") && !next.startsWith("/portal/login") ? next : null
        router.replace(safeNext ?? j.redirectTo ?? "/portal/dashboard")
        router.refresh()
      })
      .catch((e: Error) => {
        setErr(e.message)
        setBusy(false)
      })
  }, [searchParams, router])

  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    const token = manualToken.trim()
    if (!token) return
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch("/api/portal/access/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string; redirectTo?: string }
      if (!r.ok) throw new Error(j.error ?? "Could not sign in.")
      const next = searchParams.get("next")?.trim()
      const safeNext =
        next && next.startsWith("/portal") && !next.startsWith("/portal/login") ? next : null
      router.replace(safeNext ?? j.redirectTo ?? "/portal/dashboard")
      router.refresh()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Sign-in failed.")
      setBusy(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--portal-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-8 space-y-6"
        style={{ background: "var(--portal-surface)", borderColor: "var(--portal-border)" }}
      >
        <div className="flex flex-col items-center gap-2">
          <BrandLogoOnLight logoClassName="h-8" />
          <h1 className="text-lg font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Customer Portal
          </h1>
          <p className="text-xs text-center" style={{ color: "var(--portal-nav-text)" }}>
            Sign in with the secure link emailed by your service provider.
          </p>
        </div>

        {busy && !err && (
          <p className="text-sm text-center" style={{ color: "var(--portal-nav-text)" }}>
            Signing you in…
          </p>
        )}

        {info && (
          <div
            className="text-sm rounded-lg px-3 py-2 border"
            style={{
              background: "color-mix(in srgb, var(--portal-accent) 12%, transparent)",
              borderColor: "color-mix(in srgb, var(--portal-accent) 35%, transparent)",
              color: "var(--portal-foreground)",
            }}
          >
            {info}
          </div>
        )}

        {err && (
          <div
            className="text-sm rounded-lg px-3 py-2 border"
            style={{
              background: "var(--portal-danger-muted)",
              borderColor: "#fecaca",
              color: "var(--portal-danger)",
            }}
          >
            {err}
          </div>
        )}

        <form onSubmit={submitManual} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--portal-foreground)" }}>
              Invite token (paste if needed)
            </label>
            <Input
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste token from your invite email"
              className="text-xs"
              disabled={busy}
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !manualToken.trim()}>
            Continue
          </Button>
        </form>

        <p className="text-[11px] text-center" style={{ color: "var(--portal-nav-text)" }}>
          Staff member?{" "}
          <Link href="/login" className="font-medium underline underline-offset-2" style={{ color: "var(--portal-accent)" }}>
            Sign in to Equipify
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function PortalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
          Loading…
        </div>
      }
    >
      <PortalLoginInner />
    </Suspense>
  )
}
