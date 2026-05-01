"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, ArrowRight } from "lucide-react"
import { supabase } from "@/lib/supabase"

const DEMO_ACCOUNTS = [
  { name: "Sarah Mitchell", role: "Admin", email: "sarah@acme.com", workspace: "Acme Field Services" },
  { name: "Tyler Oakes",    role: "Manager", email: "tyler@acme.com", workspace: "Acme Field Services" },
  { name: "Marcus Webb",    role: "Tech",    email: "marcus@acme.com", workspace: "Acme Field Services" },
  { name: "Jordan Kim",     role: "Read Only", email: "jordan@acme.com", workspace: "Acme Field Services" },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

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
      await signInWithEmailPassword(email, password)
      router.push("/")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in."
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function loginAs(demoEmail: string) {
    setError("")
    setEmail(demoEmail)
    setPassword("demo1234")
    setLoading(true)
    try {
      await signInWithEmailPassword(demoEmail, "demo1234")
      router.push("/")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in."
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#f5f6f8" }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between p-12"
        style={{ background: "#0f172a" }}>
        <div className="flex items-center gap-2.5">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/equipify-ai-logo-8FdWqyqT52Rmed0yjY565GPp5xlQsK.png"
            alt="Equipify.ai"
            className="h-8 w-auto object-contain"
            draggable={false}
          />
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
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/equipify-ai-logo-8FdWqyqT52Rmed0yjY565GPp5xlQsK.png"
              alt="Equipify.ai"
              className="h-7 w-auto object-contain"
              draggable={false}
            />
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-8">Sign in to your workspace</p>

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
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="portal-btn-primary w-full justify-center h-10 text-base font-medium"
              style={{ background: loading ? "#93c5fd" : "#2563eb" }}>
              {loading ? "Signing in…" : (
                <><span>Sign in</span><ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#f5f6f8] px-3 text-xs text-gray-400">Demo accounts</span>
            </div>
          </div>

          {/* Demo quick-login */}
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((d) => (
              <button key={d.email} onClick={() => loginAs(d.email)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors hover:bg-white group"
                style={{ borderColor: "#e5e7eb", background: "white" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                    style={{ background: "#2563eb" }}>
                    {d.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{d.name}</p>
                    <p className="text-xs text-gray-400">{d.email}</p>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: d.role === "Admin" ? "#eff6ff" : d.role === "Manager" ? "#f0fdf4" : d.role === "Tech" ? "#fffbeb" : "#f9fafb",
                    color: d.role === "Admin" ? "#1d4ed8" : d.role === "Manager" ? "#15803d" : d.role === "Tech" ? "#b45309" : "#6b7280",
                  }}>
                  {d.role}
                </span>
              </button>
            ))}
          </div>

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
