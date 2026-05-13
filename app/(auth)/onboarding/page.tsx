"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, ArrowRight, ArrowLeft, Building2, User, CreditCard } from "lucide-react"
import { PLANS } from "@/lib/plans"
import type { PlanId } from "@/lib/plans"
import { BrandLogo } from "@/components/brand-logo"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import {
  hasScaleTrialParam,
  ONBOARDING_INTENT_STORAGE_KEY,
  ONBOARDING_INTENDED_PLAN_STORAGE_KEY,
  parseOnboardingPlan,
  parseOnboardingText,
} from "@/lib/onboarding-intent"
import {
  normalizeIndustryKey,
  workspaceIndustrySelectOptions,
  getIndustrySetupCopy,
} from "@/lib/demo-seeding/profiles"
import { resolveOnboardingIndustryBundle } from "@/lib/onboarding-industry/resolve-onboarding-industry-bundle"
import { WORKSPACE_INDUSTRY_DEFINITIONS } from "@/lib/workspace-industry-registry"
import {
  ONBOARDING_CURRENT_SYSTEM_OPTIONS,
  ONBOARDING_TEAM_SIZE_OPTIONS,
  parseOnboardingSearchParams,
} from "@/lib/onboarding-canonical"

const STEPS = ["Your account", "Workspace", "Choose a plan"]
/** Central registry — labels and keys from `lib/workspace-industry-registry.ts` */
const INDUSTRY_OPTIONS = workspaceIndustrySelectOptions()
const TEAM_SIZE_OPTIONS = ONBOARDING_TEAM_SIZE_OPTIONS
const CURRENT_SYSTEM_OPTIONS = ONBOARDING_CURRENT_SYSTEM_OPTIONS
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type InviteContext = {
  email: string
  organizationId: string
  role: string
  expiresAt: string
}

function OnboardingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createBrowserSupabaseClient()
  const prefill = parseOnboardingSearchParams(searchParams)
  const firstNameParam = prefill.firstName
  const lastNameParam = prefill.lastName
  const emailParam = prefill.email
  const organizationIdParam = parseOnboardingText(searchParams.get("organizationId"))
  const inviteTokenParam =
    parseOnboardingText(searchParams.get("inviteToken")) ??
    parseOnboardingText(searchParams.get("invite")) ??
    parseOnboardingText(searchParams.get("token"))
  /** Self-serve: sample data on by default; use ?seedDemo=false to skip. Invites: off unless ?seedDemo=true. */
  const seedDemoChoice = inviteTokenParam
    ? searchParams.get("seedDemo")?.trim().toLowerCase() === "true"
    : searchParams.get("seedDemo")?.trim().toLowerCase() !== "false"
  const industryParam = prefill.industry
  const hasMarketingIdentity = Boolean(firstNameParam && lastNameParam && emailParam)
  const trialFromQuery = hasScaleTrialParam(searchParams.get("trial"))
  const [step, setStep] = useState(0)
  const [billing, setBilling] = useState<"monthly" | "annual">("annual")
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("growth")
  const [form, setForm] = useState({
    firstName: prefill.firstName ?? "",
    lastName: prefill.lastName ?? "",
    email: prefill.email ?? "",
    password: "",
    companyName: prefill.company ?? "",
    phone: prefill.phone ?? "",
    industry: prefill.industry,
    teamSize: prefill.teamSize ?? "",
    currentSystem: prefill.currentSystem ?? "",
    timezone: "America/New_York",
  })
  const [stepOneError, setStepOneError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteContext, setInviteContext] = useState<InviteContext | null>(null)

  useEffect(() => {
    if (!searchParams) return

    const selectedPlanFromQuery = parseOnboardingPlan(searchParams.get("plan"))
    const next = parseOnboardingSearchParams(searchParams)

    if (process.env.NODE_ENV === "development") {
      console.log("APPLYING PREFILL", {
        firstName: next.firstName,
        lastName: next.lastName,
        email: next.email,
      })
      console.log("onboarding params", {
        selectedPlan: selectedPlanFromQuery,
        trial: hasScaleTrialParam(searchParams.get("trial")) ? "scale" : null,
        firstName: next.firstName,
        lastName: next.lastName,
        email: next.email,
        company: next.company,
        phone: next.phone,
        industry: next.industry,
        industryFromQuery: next.industryFromQuery,
        teamSize: next.teamSize,
        currentSystem: next.currentSystem,
      })
    }

    if (selectedPlanFromQuery) {
      setSelectedPlan(selectedPlanFromQuery)
    }

    setForm((prev) => ({
      ...prev,
      firstName: next.firstName ?? prev.firstName,
      lastName: next.lastName ?? prev.lastName,
      email: next.email ?? prev.email,
      companyName: next.company ?? prev.companyName,
      phone: next.phone ?? prev.phone,
      // Only overwrite the industry select when the URL explicitly provided one;
      // otherwise keep whatever the user already chose in the dropdown.
      industry: next.industryFromQuery ? next.industry : prev.industry,
      teamSize: next.teamSize ?? prev.teamSize,
      currentSystem: next.currentSystem ?? prev.currentSystem,
    }))
  }, [searchParams])

  useEffect(() => {
    const topics = searchParams.get("ainsleyTopics")?.trim()
    if (!topics) return
    try {
      sessionStorage.setItem("equipify_onboarding_ainsley_topics", topics)
    } catch {
      /* */
    }
  }, [searchParams])

  useEffect(() => {
    if (!inviteTokenParam) {
      setInviteContext(null)
      setInviteError(null)
      return
    }

    let cancelled = false
    setInviteLoading(true)
    setInviteError(null)

    ;(async () => {
      try {
        const res = await fetch("/api/invites/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteToken: inviteTokenParam }),
        })
        const data = (await res.json()) as {
          invite?: InviteContext
          message?: string
        }
        if (cancelled) return
        if (!res.ok || !data.invite) {
          setInviteContext(null)
          setInviteError(data.message ?? "Invalid invite link.")
          return
        }
        setInviteContext(data.invite)
        setForm((prev) => ({ ...prev, email: data.invite!.email || prev.email }))
      } catch {
        if (cancelled) return
        setInviteContext(null)
        setInviteError("Unable to validate this invite right now. Please try again.")
      } finally {
        if (!cancelled) setInviteLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [inviteTokenParam])

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function finalizeOnboarding() {
    const effectiveFirstName = form.firstName || firstNameParam || ""
    const effectiveLastName = form.lastName || lastNameParam || ""
    const effectiveEmail = form.email || emailParam || ""
    const fullName = `${effectiveFirstName} ${effectiveLastName}`.trim()
    const email = (inviteContext?.email || effectiveEmail).toLowerCase()

    if (!inviteContext && organizationIdParam && !UUID_RE.test(organizationIdParam)) {
      setSubmitError("Invalid organization invite link. Please request a new invitation.")
      return
    }

    setSubmitError(null)
    setIsSubmitting(true)

    let authUserId: string | null = null
    try {
      const signUpResult = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            full_name: fullName,
            first_name: effectiveFirstName,
            last_name: effectiveLastName,
          },
        },
      })

      if (signUpResult.error) {
        const userExists = /already registered|already exists|user already/i.test(signUpResult.error.message)
        if (!userExists) {
          setSubmitError(signUpResult.error.message || "Could not create your account.")
          return
        }

        const signInResult = await supabase.auth.signInWithPassword({
          email,
          password: form.password,
        })
        if (signInResult.error || !signInResult.data.user) {
          const rawMsg = signInResult.error?.message ?? ""
          const looksLikeWrongPassword = /invalid login credentials|invalid credentials/i.test(rawMsg)
          setSubmitError(
            looksLikeWrongPassword
              ? "This email already has an account. Please sign in, reset your password, or use a different email."
              : rawMsg || "Account exists. Sign in or reset your password.",
          )
          return
        }
        authUserId = signInResult.data.user.id
      } else {
        authUserId = signUpResult.data.user?.id ?? null
      }

      if (!authUserId) {
        setSubmitError("Account created, but session is not ready yet. Check your email to verify your account.")
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setSubmitError(
          inviteTokenParam
            ? "We couldn't start your session. Verify your email if you just created an account, then try again."
            : "Account created, but session is not ready yet. Check your email to verify your account.",
        )
        return
      }

      const authedJsonHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      } as const

      if (inviteTokenParam) {
        const acceptRes = await fetch("/api/invites/accept", {
          method: "POST",
          headers: authedJsonHeaders,
          body: JSON.stringify({ inviteToken: inviteTokenParam }),
        })
        if (!acceptRes.ok) {
          const acceptData = (await acceptRes.json()) as { message?: string }
          setSubmitError(acceptData.message ?? "Could not accept invite. Request a new invite.")
          return
        }
      } else {
        const provisionRes = await fetch("/api/onboarding/provision", {
          method: "POST",
          headers: authedJsonHeaders,
          body: JSON.stringify({
            organizationId: organizationIdParam || null,
            organizationName: form.companyName || undefined,
            seedDemo: seedDemoChoice,
            industry: normalizeIndustryKey(form.industry || industryParam),
            selectedPlan,
            billingCycle: billing,
            firstName: effectiveFirstName,
            lastName: effectiveLastName,
            phone: form.phone.trim() || undefined,
          }),
        })
        if (!provisionRes.ok) {
          const provisionData = (await provisionRes.json()) as { message?: string }
          setSubmitError(provisionData.message ?? "Could not finish workspace setup. Please try again.")
          return
        }
      }
    } finally {
      setIsSubmitting(false)
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_INTENDED_PLAN_STORAGE_KEY, selectedPlan)
      window.localStorage.setItem(
        ONBOARDING_INTENT_STORAGE_KEY,
        JSON.stringify({
          selectedPlan,
          trial: "scale",
          firstName: form.firstName || firstNameParam || undefined,
          lastName: form.lastName || lastNameParam || undefined,
          email: form.email || emailParam || undefined,
          phone: form.phone || undefined,
          company: form.companyName || undefined,
          industry: form.industry || undefined,
          teamSize: form.teamSize || undefined,
          currentSystem: form.currentSystem || undefined,
          organizationId: organizationIdParam || undefined,
          inviteTokenPresent: Boolean(inviteTokenParam),
          inviteOrganizationId: inviteContext?.organizationId || undefined,
          inviteRole: inviteContext?.role || undefined,
        })
      )
    }
    if (inviteTokenParam) {
      router.push("/")
    } else if (parseOnboardingPlan(searchParams.get("plan"))) {
      router.push(`/settings/billing?plan=${selectedPlan}&source=onboarding`)
    } else {
      router.push("/")
    }
  }

  function next() {
    if (step === 0) {
      if (inviteTokenParam && inviteLoading) {
        setStepOneError("Validating invite...")
        return
      }
      if (inviteTokenParam && !inviteContext) {
        setStepOneError(inviteError ?? "Invalid invite link.")
        return
      }
      const effectiveFirstName = form.firstName || firstNameParam || ""
      const effectiveLastName = form.lastName || lastNameParam || ""
      const effectiveEmail = inviteContext?.email || form.email || emailParam || ""
      if (!effectiveFirstName || !effectiveLastName || !effectiveEmail || !form.password) {
        setStepOneError("First name, last name, email, and password are required to continue.")
        return
      }
      setStepOneError(null)
    }

    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else void finalizeOnboarding()
  }
  function back() { setStep((s) => Math.max(0, s - 1)) }

  const price = (plan: typeof PLANS[0]) =>
    billing === "annual" ? plan.priceAnnual : plan.priceMonthly

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f5f6f8" }}>
      {/* Top bar */}
      <header className="border-b border-white/10 bg-[#0F172A] shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="https://equipify.ai" className="cursor-pointer">
            <BrandLogo className="h-8 w-auto sm:h-9" priority />
          </Link>
          <p className="text-sm text-gray-300">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-white hover:text-gray-200">
              Sign in
            </Link>
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start py-12 px-4">
        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-10">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${i < step ? "bg-blue-600 text-white" : i === step ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span className={`text-xs mt-1.5 whitespace-nowrap ${i === step ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-24 h-px mx-2 mb-4 transition-colors ${i < step ? "bg-blue-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="w-full" style={{ maxWidth: step === 2 ? 1280 : 480 }}>
          {/* Step 0 — Account */}
          {step === 0 && (
            <div className="bg-white rounded-xl border p-8" style={{ borderColor: "#e5e7eb" }}>
              <div className="flex items-center gap-2 mb-6">
                <User size={18} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Create your account</h2>
              </div>
              {hasMarketingIdentity ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                  <p className="text-xs font-medium text-gray-600">Creating account for</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {form.firstName || firstNameParam} {form.lastName || lastNameParam}
                  </p>
                  <p className="text-sm text-gray-700">{inviteContext?.email || form.email || emailParam}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {([["firstName", "First name"], ["lastName", "Last name"]] as const).map(([k, label]) => (
                      <div key={k}>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                        <input value={form[k]} onChange={(e) => setField(k, e.target.value)}
                          className="portal-input" placeholder={label} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Work email</label>
                    <input
                      type="email"
                      value={inviteContext?.email || form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      disabled={Boolean(inviteContext)}
                      className="portal-input" placeholder="you@company.com" />
                  </div>
                </>
              )}
              {inviteLoading && <p className="mt-2 text-xs text-gray-500">Validating invite...</p>}
              {inviteError && <p className="mt-2 text-xs text-red-600">{inviteError}</p>}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <input type="password" value={form.password} onChange={(e) => setField("password", e.target.value)}
                  className="portal-input" placeholder="Min. 8 characters" />
                <p className="text-xs text-gray-400 mt-1">Use at least 8 characters with a mix of letters, numbers, and symbols.</p>
              </div>
              {stepOneError && (
                <p className="mt-3 text-xs text-red-600">{stepOneError}</p>
              )}
              {submitError && step === 0 && (
                <p className="mt-2 text-xs text-red-600">{submitError}</p>
              )}
              <button onClick={next} className="portal-btn-primary w-full justify-center h-10 mt-6">
                Continue <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* Step 1 — Workspace */}
          {step === 1 && (
            <div className="bg-white rounded-xl border p-8" style={{ borderColor: "#e5e7eb" }}>
              <div className="flex items-center gap-2 mb-6">
                <Building2 size={18} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Set up your workspace</h2>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  {getIndustrySetupCopy(form.industry)}
                </p>
                {(() => {
                  const ik = normalizeIndustryKey(form.industry)
                  const label = WORKSPACE_INDUSTRY_DEFINITIONS[ik].label
                  const bullets = resolveOnboardingIndustryBundle(ik, label).signupExampleWorkflows
                  if (bullets.length === 0) return null
                  return (
                    <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 mt-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">Examples you&apos;ll explore first</p>
                      <ul className="list-disc pl-4 text-xs text-gray-600 space-y-1">
                        {bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )
                })()}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company name</label>
                  <input value={form.companyName} onChange={(e) => setField("companyName", e.target.value)}
                    className="portal-input" placeholder="Acme Field Services" />
                </div>
                <div className={`grid gap-4 ${inviteTokenParam ? "grid-cols-1" : "grid-cols-2"}`}>
                  {!inviteTokenParam && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
                      <select
                        value={normalizeIndustryKey(form.industry)}
                        onChange={(e) => setField("industry", normalizeIndustryKey(e.target.value))}
                        className="portal-select"
                      >
                        {INDUSTRY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Team size</label>
                    <select value={form.teamSize} onChange={(e) => setField("teamSize", e.target.value)}
                      className="portal-select">
                      <option value="">Select size</option>
                      {TEAM_SIZE_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    className="portal-input"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                  <select value={form.timezone} onChange={(e) => setField("timezone", e.target.value)}
                    className="portal-select">
                    {["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "Europe/London"].map((tz) => (
                      <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Current system</label>
                  <select
                    value={form.currentSystem}
                    onChange={(e) => setField("currentSystem", e.target.value)}
                    className="portal-select"
                  >
                    <option value="">Select current system</option>
                    {CURRENT_SYSTEM_OPTIONS.map((system) => (
                      <option key={system} value={system}>{system}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={back} className="portal-btn-secondary h-10 px-4">
                  <ArrowLeft size={15} /> Back
                </button>
                <button onClick={next} className="portal-btn-primary flex-1 justify-center h-10">
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Plan */}
          {step === 2 && (
            <div>
              <div className="text-center mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard size={18} className="text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Choose a plan</h2>
                </div>
                <p className="text-sm text-gray-500">Start with a 14-day free trial. No credit card required.</p>
                {trialFromQuery && (
                  <p className="text-xs text-blue-600 mt-2">
                    You&apos;ll get Scale trial access during onboarding. Choose your intended paid plan below.
                  </p>
                )}
                {/* Billing toggle */}
                <div className="inline-flex items-center gap-1 mt-4 p-1 rounded-lg border bg-white" style={{ borderColor: "#e5e7eb" }}>
                  {(["monthly", "annual"] as const).map((cycle) => (
                    <button key={cycle} onClick={() => setBilling(cycle)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${billing === cycle ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                      {cycle === "monthly" ? "Monthly" : "Annual"}
                      {cycle === "annual" && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Save 20%</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                {PLANS.map((plan) => {
                  const selected = selectedPlan === plan.id
                  const monthly = price(plan)
                  return (
                    <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                      className={`text-left p-6 rounded-xl border-2 bg-white transition-all relative ${selected ? "border-blue-600 shadow-md" : "border-gray-200 hover:border-gray-300"}`}>
                      {plan.badge && (
                        <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-600 text-white">
                          {plan.badge}
                        </span>
                      )}
                      {selected && (
                        <div className="absolute top-4 left-4 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <Check size={11} className="text-white" />
                        </div>
                      )}
                      <h3 className="font-semibold text-gray-900 mt-4 mb-1">{plan.name}</h3>
                      <p className="text-xs text-gray-500 mb-4">{plan.description}</p>
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-gray-900">${(monthly / 100).toFixed(0)}</span>
                        <span className="text-sm text-gray-500">/mo</span>
                        {billing === "annual" && (
                          <p className="text-xs text-gray-400 mt-0.5">billed ${((monthly * 12) / 100).toFixed(0)}/yr</p>
                        )}
                      </div>
                      <ul className="space-y-2">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                            <Check size={12} className="text-blue-600 mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-3 max-w-md mx-auto">
                <button onClick={back} className="portal-btn-secondary h-10 px-5">
                  <ArrowLeft size={15} /> Back
                </button>
                <button onClick={next} disabled={isSubmitting} className="portal-btn-primary flex-1 justify-center h-10">
                  {isSubmitting ? "Creating account..." : <>Start free trial <ArrowRight size={15} /></>}
                </button>
              </div>
              {submitError && (
                <p className="text-center text-xs text-red-600 mt-3">{submitError}</p>
              )}
              <p className="text-center text-xs text-gray-400 mt-4">
                14-day free trial &bull; Cancel any time &bull; No credit card required
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        Loading onboarding...
      </div>
    }>
      <OnboardingPageContent />
    </Suspense>
  )
}
