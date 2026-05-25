"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Eye, EyeOff, ArrowRight } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { clearAuthSessionClientStorage } from "@/lib/auth/session-context-storage"
import { BrandLogo } from "@/components/brand-logo"
import { OAuthSignInButtonStack } from "@/components/auth/oauth-sign-in-button"
import {
  buildLoginOAuthCallbackUrl,
  LOGIN_OAUTH_ERROR_MESSAGE,
  type EquipifyOAuthProvider,
} from "@/lib/auth/supabase-oauth"

function LoginPageInner() {
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<EquipifyOAuthProvider | null>(null)
  const [error, setError] = useState("")

  const archivedNotice =
    searchParams.get("error") === "archived"
      ? "This workspace has been archived. Contact support if you need access."
      : null

  const oauthNotice =
    searchParams.get("error") === "oauth" ? LOGIN_OAUTH_ERROR_MESSAGE : null

  async function signInWithEmailPassword(nextEmail: string, nextPassword: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: nextEmail,
      password: nextPassword,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!email || !password) {
      setError("Please enter your email and password.")
      return
    }

    setLoading(true)
    try {
      clearAuthSessionClientStorage()
      await signInWithEmailPassword(email, password)
      window.location.assign("/")
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unable to sign in."
      const message = raw.toLowerCase().includes("invalid login")
        ? "Email or password is incorrect."
        : raw.toLowerCase().includes("email not confirmed")
          ? "Please confirm your email before signing in."
          : "Unable to sign in. Check your email and password and try again."
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuthSignIn(provider: EquipifyOAuthProvider) {
    setError("")
    setOauthLoadingProvider(provider)
    try {
      const redirectTo =
        typeof window !== "undefined" ? buildLoginOAuthCallbackUrl(window.location.origin) : undefined
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })
      if (oauthError) {
        setError(LOGIN_OAUTH_ERROR_MESSAGE)
        setOauthLoadingProvider(null)
      }
    } catch {
      setError(LOGIN_OAUTH_ERROR_MESSAGE)
      setOauthLoadingProvider(null)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#f5f6f8" }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between p-12"
        style={{ background: "#0f172a" }}>
        <div className="flex items-center gap-2.5">
          <Link href="https://equipify.ai" className="w-full max-w-[198px] cursor-pointer">
            <BrandLogo
              priority
              sizes="(min-width: 768px) 198px, 182px"
              className="min-h-0 min-w-0 max-h-[calc(2.75rem-10px*280/1024)] w-full max-w-[calc(100%-10px)] select-none object-contain object-center sm:max-h-[calc(3rem-10px*280/1024)]"
            />
          </Link>
        </div>
        <div>
          <blockquote className="text-2xl font-medium leading-relaxed mb-6" style={{ color: "#e2e8f0" }}>
            &ldquo;Equipify cut our equipment downtime by 40% in the first 90 days. The AI insights pay for themselves.&rdquo;
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
              style={{ background: "#2563eb" }}>AM</div>
            <div>
              <p className="text-sm font-medium text-white">Angela Strom</p>
              <p className="text-xs" style={{ color: "#94a3b8" }}>Fleet Manager, Summit Construction</p>
            </div>
          </div>
        </div>
        <div className="flex gap-6">
          {["500+ companies", "48K+ equipment units", "99.9% uptime"].map((s) => (
            <div key={s}>
              <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden rounded-xl bg-[#0F172A] px-4 py-3">
            <Link href="https://equipify.ai" className="mx-auto block w-full max-w-[198px] cursor-pointer">
              <BrandLogo
                priority
                sizes="(min-width: 768px) 198px, 182px"
                className="min-h-0 min-w-0 max-h-[calc(2.75rem-10px*280/1024)] w-full max-w-[calc(100%-10px)] select-none object-contain object-center sm:max-h-[calc(3rem-10px*280/1024)]"
              />
            </Link>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-8">Sign in to your workspace</p>

          <OAuthSignInButtonStack
            disabled={loading || oauthLoadingProvider != null}
            loadingProvider={oauthLoadingProvider}
            onGoogleClick={() => void handleOAuthSignIn("google")}
            onAppleClick={() => void handleOAuthSignIn("apple")}
          />

          <div className="my-6 flex items-center gap-3" aria-hidden>
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-400 lowercase">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="portal-input"
                autoComplete="email"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Link href="#" className="text-xs font-medium" style={{ color: "#2563eb" }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="portal-input pr-10"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {(error || archivedNotice || oauthNotice) && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error || oauthNotice || archivedNotice}
              </p>
            )}
            <button type="submit" disabled={loading || oauthLoadingProvider != null}
              className="portal-btn-primary w-full justify-center h-10 text-base font-medium">
              {loading ? "Signing in…" : (
                <><span>Sign in</span><ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link href="/onboarding" className="font-medium" style={{ color: "#2563eb" }}>
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f5f6f8] text-sm text-gray-500">Loading…</div>}>
      <LoginPageInner />
    </Suspense>
  )
}
