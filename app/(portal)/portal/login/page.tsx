"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, KeyRound, Mail, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PortalWorkspaceBrand } from "@/components/portal/portal-workspace-brand"

/**
 * Hex used by the main app sidebar (`components/app-sidebar.tsx` line ~396).
 * Pinned here so the portal login header reads as the same brand surface even
 * when the marketing site / portal-bg tokens shift.
 */
const APP_SIDEBAR_BG = "#0F172A"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const NOTICE_COPY: Record<string, string> = {
  no_staff_portal:
    "There is no customer portal login linked to your staff email for this workspace yet. Invite yourself from Customers → Portal Invite, or paste an invite token below.",
  portal_revoked: "Portal access for this email has been revoked. Contact your service provider to restore it.",
  org_archived: "This workspace is no longer available.",
  invalid_preview: "Preview could not be started. Return to Settings → Customer Portal and try again.",
}

type ConfigStatus =
  | { kind: "ok" }
  | { kind: "dev_unconfigured"; tone: "info" }
  | { kind: "prod_misconfigured"; tone: "warning" }

function PortalLoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [manualToken, setManualToken] = useState("")
  const [showTokenForm, setShowTokenForm] = useState(false)
  const [configStatus, setConfigStatus] = useState<ConfigStatus>({ kind: "ok" })
  const [loginBrand, setLoginBrand] = useState<{ organizationName: string; logoUrl: string | null } | null>(null)
  const [brandLoading, setBrandLoading] = useState(false)

  const orgIdParam = searchParams.get("organizationId")?.trim() ?? ""

  useEffect(() => {
    if (!orgIdParam || !UUID_RE.test(orgIdParam)) {
      setLoginBrand(null)
      setBrandLoading(false)
      return
    }
    let cancelled = false
    setBrandLoading(true)
    void fetch(`/api/portal/public-branding?organizationId=${encodeURIComponent(orgIdParam)}`)
      .then(async (r) => {
        if (!r.ok) return null
        return r.json() as Promise<{ organizationName?: string; logoUrl?: string | null }>
      })
      .then((j) => {
        if (cancelled || !j?.organizationName) return
        setLoginBrand({ organizationName: j.organizationName, logoUrl: j.logoUrl ?? null })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBrandLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orgIdParam])

  const isProd = useMemo(() => process.env.NODE_ENV === "production", [])

  useEffect(() => {
    const e = searchParams.get("error")
    const n = searchParams.get("notice")
    setErr(null)
    setInfo(null)
    if (e === "misconfigured") {
      setConfigStatus(
        isProd
          ? { kind: "prod_misconfigured", tone: "warning" }
          : { kind: "dev_unconfigured", tone: "info" },
      )
    } else if (e === "preview_forbidden") {
      setErr("You don't have permission to preview the portal for this organization.")
    }
    if (n && NOTICE_COPY[n]) {
      setInfo(NOTICE_COPY[n]!)
    }
  }, [searchParams, isProd])

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
      className="min-h-screen flex flex-col items-center justify-start px-4 py-8 sm:py-12"
      style={{ background: "var(--portal-bg)" }}
    >
      <main
        className="w-full max-w-[440px] rounded-2xl overflow-hidden border shadow-xl"
        style={{
          background: "var(--portal-surface)",
          borderColor: "var(--portal-border)",
          boxShadow: "0 12px 40px -12px rgba(15, 23, 42, 0.18), 0 4px 12px -4px rgba(15, 23, 42, 0.08)",
        }}
        aria-labelledby="portal-login-heading"
      >
        {/* ── Brand header (matches main app sidebar #0F172A) ───────────────── */}
        <div
          className="flex flex-col items-center justify-center gap-3 px-8 py-10 sm:py-11"
          style={{ background: APP_SIDEBAR_BG }}
        >
          {brandLoading ? (
            <p className="text-sm text-white/70" aria-live="polite">
              Loading branding…
            </p>
          ) : loginBrand ? (
            <PortalWorkspaceBrand
              organizationName={loginBrand.organizationName}
              logoUrl={loginBrand.logoUrl}
              size="hero"
              equipifyVariant="onDark"
              heroOnDark
              footerSlot={
                <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 mt-2">
                  <ShieldCheck size={11} className="text-white/70" aria-hidden />
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/70">
                    Secure invite access
                  </span>
                </div>
              }
            />
          ) : (
            <>
              <p className="text-center text-3xl sm:text-4xl font-semibold text-white tracking-tight leading-snug px-2 max-w-[min(22rem,92vw)] text-balance">
                Customer Portal
              </p>
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 mt-1">
                <ShieldCheck size={11} className="text-white/70" aria-hidden />
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/70">
                  Secure invite access
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Card body ────────────────────────────────────────────────────── */}
        <div className="px-7 sm:px-8 py-7 sm:py-8 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1
              id="portal-login-heading"
              className="text-xl font-semibold tracking-tight"
              style={{ color: "var(--portal-foreground)" }}
            >
              Sign in to your service portal
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
              Customers normally arrive here from a secure invite link sent by their service
              provider. Open that email link to sign in — no password required.
            </p>
          </div>

          {busy && !err && (
            <p
              className="text-sm text-center rounded-lg px-3 py-2.5 border"
              style={{
                color: "var(--portal-foreground)",
                background: "var(--portal-surface-2)",
                borderColor: "var(--portal-border)",
              }}
              aria-live="polite"
            >
              Signing you in…
            </p>
          )}

          {/* Soft dev-only configuration notice */}
          {configStatus.kind === "dev_unconfigured" && (
            <div
              role="status"
              className="flex items-start gap-2.5 text-[13px] rounded-lg px-3.5 py-3 border leading-relaxed"
              style={{
                background: "color-mix(in srgb, var(--portal-accent) 8%, transparent)",
                borderColor: "color-mix(in srgb, var(--portal-accent) 28%, transparent)",
                color: "var(--portal-foreground)",
              }}
            >
              <KeyRound
                size={14}
                className="mt-0.5 shrink-0"
                style={{ color: "var(--portal-accent)" }}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium">Portal invite sign-in is not configured yet for this environment.</p>
                <p
                  className="mt-0.5 text-[12px]"
                  style={{ color: "var(--portal-nav-text)" }}
                >
                  Set <code className="font-mono">PORTAL_SESSION_SECRET</code> (≥ 32 chars) in
                  your env, then restart the dev server. Customers can still receive invite
                  emails once this is enabled.
                </p>
              </div>
            </div>
          )}

          {/* Production warning */}
          {configStatus.kind === "prod_misconfigured" && (
            <div
              role="alert"
              className="text-sm rounded-lg px-3.5 py-3 border leading-relaxed"
              style={{
                background: "var(--portal-warning-muted)",
                borderColor: "color-mix(in srgb, var(--portal-warning) 35%, transparent)",
                color: "var(--portal-foreground)",
              }}
            >
              <p className="font-medium" style={{ color: "var(--portal-warning)" }}>
                Portal sign-in is temporarily unavailable.
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--portal-nav-text)" }}>
                Please contact your service provider — they'll be notified to restore portal
                access shortly.
              </p>
            </div>
          )}

          {/* Operator/preview notices (info tone) */}
          {info && (
            <div
              role="status"
              className="text-[13px] rounded-lg px-3.5 py-3 border leading-relaxed"
              style={{
                background: "color-mix(in srgb, var(--portal-accent) 10%, transparent)",
                borderColor: "color-mix(in srgb, var(--portal-accent) 32%, transparent)",
                color: "var(--portal-foreground)",
              }}
            >
              {info}
            </div>
          )}

          {/* Hard error */}
          {err && (
            <div
              role="alert"
              className="text-sm rounded-lg px-3.5 py-3 border leading-relaxed"
              style={{
                background: "var(--portal-danger-muted)",
                borderColor: "color-mix(in srgb, var(--portal-danger) 30%, transparent)",
                color: "var(--portal-danger)",
              }}
            >
              {err}
            </div>
          )}

          {/* Empty-state expectation card */}
          {configStatus.kind !== "prod_misconfigured" && (
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3.5 border"
              style={{
                background: "var(--portal-surface-2)",
                borderColor: "var(--portal-border-light)",
              }}
            >
              <span
                className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                style={{ background: "var(--portal-accent-muted)" }}
              >
                <Mail size={14} style={{ color: "var(--portal-accent)" }} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[13px] font-medium"
                  style={{ color: "var(--portal-foreground)" }}
                >
                  Need an invite link?
                </p>
                <p
                  className="text-[12px] mt-0.5 leading-relaxed"
                  style={{ color: "var(--portal-nav-text)" }}
                >
                  Reach out to your service provider — they can send a secure sign-in link to
                  your inbox.
                </p>
              </div>
            </div>
          )}

          {/* Token entry — collapsed by default to keep customer view clean */}
          {!showTokenForm ? (
            <button
              type="button"
              onClick={() => setShowTokenForm(true)}
              className="text-[12px] font-medium underline-offset-4 hover:underline self-start cursor-pointer"
              style={{ color: "var(--portal-accent)" }}
              aria-expanded={false}
              aria-controls="portal-token-form"
            >
              I have an invite token
            </button>
          ) : (
            <form
              id="portal-token-form"
              onSubmit={submitManual}
              className="flex flex-col gap-2.5 rounded-xl border p-4"
              style={{
                background: "var(--portal-surface-2)",
                borderColor: "var(--portal-border-light)",
              }}
            >
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="portal-invite-token"
                  className="text-[12px] font-medium"
                  style={{ color: "var(--portal-foreground)" }}
                >
                  Invite token
                </label>
                <Input
                  id="portal-invite-token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Paste the token from your invite email"
                  className="text-xs"
                  disabled={busy}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                  Tokens are one-time use and never stored in the URL.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  className="flex-1 gap-1.5"
                  disabled={busy || !manualToken.trim()}
                >
                  Continue
                  <ArrowRight size={14} aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-[12px]"
                  onClick={() => {
                    setShowTokenForm(false)
                    setManualToken("")
                  }}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div
          className="px-7 sm:px-8 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]"
          style={{
            background: "var(--portal-surface-2)",
            borderColor: "var(--portal-border-light)",
            color: "var(--portal-nav-text)",
          }}
        >
          <span className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
            Invite-based access · Powered by Equipify
          </span>
          <Link
            href="/login"
            className="font-medium underline-offset-4 hover:underline"
            style={{ color: "var(--portal-accent)" }}
          >
            Staff sign-in →
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function PortalLoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center text-sm"
          style={{ color: "var(--portal-nav-text)", background: "var(--portal-bg)" }}
        >
          Loading…
        </div>
      }
    >
      <PortalLoginInner />
    </Suspense>
  )
}
